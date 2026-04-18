import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// gemini-1.5-flash: 1,500 req/day free vs 20/day for preview models
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Cache model instance — avoids SDK overhead on every call
const model = genAI.getGenerativeModel({ model: MODEL });

// ── Step 1: Visual Analysis ────────────────────────────────────────────────────
const VISION_PROMPT = `You are a visual analyst for a sustainability repair app.
Analyze this household item image. Return ONLY valid compact JSON (no markdown):
{"objectType":"...","brand":null,"condition":"good|fair|poor|broken","damageDetails":[],"repairability":"easy|moderate|difficult|not-recommended","summary":"2-sentence plain English description"}`;

// ── Step 2: Reasoning + Decision Engine ───────────────────────────────────────
function buildReasoningPrompt(visualAnalysis, conversationHistory, userMessage) {
  const historyText = (conversationHistory || [])
    .slice(-4)  // fewer tokens
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `You are ReLife AI, a sustainability repair expert. Prioritise sustainability over replacement.

VISUAL ANALYSIS:
${JSON.stringify(visualAnalysis)}

CONVERSATION:
${historyText || 'First interaction.'}

USER: "${userMessage}"

Return ONLY valid compact JSON (no markdown, no code fences):
{"diagnosis":{"primaryIssue":"","likelyCause":"","severity":"minor|moderate|severe","confidence":0.8},"clarifyingQuestions":[],"options":[{"action":"Repair","description":"","estimatedCost":{"min":0,"max":0,"currency":"INR"},"timeRequired":"","difficulty":"beginner|intermediate|advanced","environmentalImpact":{"score":9,"label":"Excellent","kgCO2Saved":5},"repairSteps":[],"toolsNeeded":[],"recommended":true},{"action":"Replace Component","description":"","estimatedCost":{"min":0,"max":0,"currency":"INR"},"timeRequired":"","difficulty":"intermediate","environmentalImpact":{"score":8,"label":"Good","kgCO2Saved":4},"repairSteps":[],"toolsNeeded":[],"recommended":false},{"action":"Resell for Parts","description":"","estimatedCost":{"min":0,"max":0,"currency":"INR"},"timeRequired":"","difficulty":"beginner","environmentalImpact":{"score":7,"label":"Good","kgCO2Saved":3},"repairSteps":[],"toolsNeeded":[],"recommended":false},{"action":"Donate","description":"","estimatedCost":{"min":0,"max":0,"currency":"INR"},"timeRequired":"","difficulty":"beginner","environmentalImpact":{"score":6,"label":"Fair","kgCO2Saved":2},"repairSteps":[],"toolsNeeded":[],"recommended":false},{"action":"Recycle","description":"","estimatedCost":{"min":0,"max":0,"currency":"INR"},"timeRequired":"","difficulty":"beginner","environmentalImpact":{"score":5,"label":"Fair","kgCO2Saved":1},"repairSteps":[],"toolsNeeded":[],"recommended":false}],"recommendation":"Repair","recommendationReason":"","sustainabilityInsight":"","impactMetrics":{"moneySaved":0,"ewasteReduced":"1 kg","co2Avoided":5,"landfillDiverted":"0.8 kg"}}`;
}

// ── Step 3: Repair Step Detail ─────────────────────────────────────────────────
function buildStepPrompt(option, step, itemDescription) {
  return `You are guiding a user step-by-step through: ${option.action} of ${itemDescription}.
Current step to explain in detail: "${step}"

Return ONLY valid JSON:
{
  "stepTitle": "short step title",
  "detailedInstructions": "3-4 sentences of clear, friendly, voice-readable instructions",
  "warnings": ["safety warning if any"],
  "tips": ["pro tip 1", "pro tip 2"],
  "estimatedTime": "time for this step",
  "nextStepHint": "brief preview of next step"
}`;
}

// ── Retry helper ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Calls Gemini with up to `maxRetries` automatic retries on 429 rate-limit.
 * Parses the first JSON object from the response text.
 */
async function generateJsonFromPrompt(promptContent, fallback, errorContext, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(promptContent);
      const text = result.response.text();
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      console.warn(`[Gemini] ${errorContext}: no JSON in response, using fallback.`);
      return fallback;
    } catch (err) {
      const is429 = err.message?.includes('429') || err.status === 429;
      if (is429 && attempt < maxRetries) {
        // Extract retry-after seconds from the error message if present
        const retryMatch = err.message?.match(/(\d+(?:\.\d+)?)s/);
        const waitMs = retryMatch ? Math.min(parseFloat(retryMatch[1]) * 1000, 10000) : (attempt + 1) * 3000;
        console.warn(`[Gemini] ${errorContext}: rate-limited. Retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(waitMs);
        continue;
      }
      if (is429) {
        console.warn(`[Gemini] ${errorContext}: quota exceeded — returning fallback. Switch to a paid plan or wait for quota reset.`);
      } else {
        console.error(`[Gemini] ${errorContext}:`, err.message);
      }
      return fallback;
    }
  }
  return fallback;
}

export async function analyzeImageWithGemini(base64Image, mimeType = 'image/jpeg') {
  const fallback = { objectType: 'Item', condition: 'unknown', components: [], damageDetails: [], repairability: 'unknown', summary: 'Could not analyze image due to a temporary API disruption. Proceeding with basic profile.' };
  return generateJsonFromPrompt([VISION_PROMPT, { inlineData: { data: base64Image, mimeType } }], fallback, 'Analyze Image');
}

export async function generateDecisionsWithGemini(visualAnalysis, conversationHistory, userMessage) {
  return generateJsonFromPrompt(
    buildReasoningPrompt(visualAnalysis, conversationHistory, userMessage),
    buildFallbackDecisions(),
    'Decisions'
  );
}

export async function generateRepairStepDetail(option, step, itemDescription) {
  const fallback = { stepTitle: step, detailedInstructions: 'Follow the standard procedure carefully.', warnings: [], tips: ['Proceed cautiously.', 'Consult the manual if stuck.'], estimatedTime: 'A few minutes', nextStepHint: '' };
  return generateJsonFromPrompt(buildStepPrompt(option, step, itemDescription), fallback, 'Repair Step');
}

function buildFallbackDecisions() {
  return {
    diagnosis: { primaryIssue: 'Needs inspection', likelyCause: 'Unknown', severity: 'moderate', confidence: 0.5 },
    clarifyingQuestions: ['Can you describe what is broken or not working?'],
    options: [
      { action: 'Repair', description: 'Attempt to repair the item', estimatedCost: { min: 800, max: 4000, currency: 'INR' }, timeRequired: '1-2 hours', difficulty: 'intermediate', environmentalImpact: { score: 9, label: 'Excellent', kgCO2Saved: 5 }, repairSteps: ['Diagnose the issue', 'Source replacement parts', 'Perform repair', 'Test the item'], toolsNeeded: ['Screwdriver', 'Multimeter'], recommended: true },
      { action: 'Replace Component', description: 'Replace only the broken part', estimatedCost: { min: 1600, max: 6400, currency: 'INR' }, timeRequired: '2-3 hours', difficulty: 'intermediate', environmentalImpact: { score: 8, label: 'Good', kgCO2Saved: 4 }, repairSteps: ['Identify faulty component', 'Order replacement', 'Swap component'], toolsNeeded: ['Screwdriver'], recommended: false },
      { action: 'Resell for Parts', description: 'Sell functional parts online', estimatedCost: { min: 0, max: 0, currency: 'INR' }, timeRequired: '1 hour', difficulty: 'beginner', environmentalImpact: { score: 7, label: 'Good', kgCO2Saved: 3 }, repairSteps: ['Disassemble item', 'Test each part', 'List on marketplace'], toolsNeeded: [], recommended: false },
      { action: 'Donate', description: 'Donate to a repair café or charity', estimatedCost: { min: 0, max: 0, currency: 'INR' }, timeRequired: '30 min', difficulty: 'beginner', environmentalImpact: { score: 6, label: 'Fair', kgCO2Saved: 2 }, repairSteps: ['Find local repair café', 'Drop off item'], toolsNeeded: [], recommended: false },
      { action: 'Recycle', description: 'Take to an e-waste recycling centre', estimatedCost: { min: 0, max: 800, currency: 'INR' }, timeRequired: '1 hour', difficulty: 'beginner', environmentalImpact: { score: 5, label: 'Fair', kgCO2Saved: 1 }, repairSteps: ['Find local e-waste facility', 'Drop off item'], toolsNeeded: [], recommended: false }
    ],
    recommendation: 'Repair',
    recommendationReason: 'Repairing is almost always the most sustainable and cost-effective choice.',
    sustainabilityInsight: 'By repairing instead of replacing, you keep materials in use and reduce demand for new manufacturing.',
    impactMetrics: { moneySaved: 6400, ewasteReduced: '1 kg', co2Avoided: 5, landfillDiverted: '0.8 kg' }
  };
}
