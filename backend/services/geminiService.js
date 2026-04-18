import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL = 'gemini-3-flash-preview';

// Visual Analysis ke liye  

const VISION_PROMPT = `You are a precise visual analyst for a sustainability repair app.
Analyze this household item image. Return ONLY valid JSON (no markdown, no explanation):
{
  "objectType": "specific item name",
  "brand": "brand name or null",
  "components": ["list of visible parts"],
  "condition": "good|fair|poor|broken",
  "damageDetails": ["specific damage observations"],
  "repairability": "easy|moderate|difficult|not-recommended",
  "estimatedAge": "age estimate or null",
  "summary": "2-3 sentence plain English description for a non-technical user"
}`;

// Reasoning Step + Decision engine

function buildReasoningPrompt(visualAnalysis, conversationHistory, userMessage) {
  const historyText = (conversationHistory || [])
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `You are ReLife AI, a sustainability-focused repair expert. Your mission is to help users fix, repurpose, or responsibly dispose of household items. Always prioritize sustainability over replacement.

VISUAL ANALYSIS RESULT:
${JSON.stringify(visualAnalysis, null, 2)}

CONVERSATION HISTORY:
${historyText || 'First interaction.'}

USER MESSAGE: "${userMessage}"

Generate a comprehensive sustainability decision analysis. Return ONLY valid JSON (no markdown, no code fences):
{
  "diagnosis": {
    "primaryIssue": "main problem identified",
    "likelyCause": "probable root cause",
    "severity": "minor|moderate|severe",
    "confidence": 0.85
  },
  "clarifyingQuestions": [],
  "options": [
    {
      "action": "Repair",
      "description": "specific repair description for this item",
      "estimatedCost": { "min": 0, "max": 0, "currency": "INR" },
      "timeRequired": "e.g. 1-2 hours",
      "difficulty": "beginner|intermediate|advanced",
      "environmentalImpact": { "score": 9, "label": "Excellent", "kgCO2Saved": 5.2 },
      "repairSteps": ["Step 1", "Step 2", "Step 3"],
      "toolsNeeded": ["tool1", "tool2"],
      "recommended": false
    },
    { "action": "Replace Component", "description": "...", "estimatedCost": {"min":0,"max":0,"currency":"INR"}, "timeRequired": "...", "difficulty": "intermediate", "environmentalImpact": {"score":8,"label":"Good","kgCO2Saved":4.0}, "repairSteps": [], "toolsNeeded": [], "recommended": false },
    { "action": "Resell for Parts", "description": "...", "estimatedCost": {"min":0,"max":0,"currency":"INR"}, "timeRequired": "...", "difficulty": "beginner", "environmentalImpact": {"score":7,"label":"Good","kgCO2Saved":3.0}, "repairSteps": [], "toolsNeeded": [], "recommended": false },
    { "action": "Donate", "description": "...", "estimatedCost": {"min":0,"max":0,"currency":"INR"}, "timeRequired": "...", "difficulty": "beginner", "environmentalImpact": {"score":6,"label":"Fair","kgCO2Saved":2.0}, "repairSteps": [], "toolsNeeded": [], "recommended": false },
    { "action": "Recycle", "description": "...", "estimatedCost": {"min":0,"max":0,"currency":"INR"}, "timeRequired": "...", "difficulty": "beginner", "environmentalImpact": {"score":5,"label":"Fair","kgCO2Saved":1.0}, "repairSteps": [], "toolsNeeded": [], "recommended": false }
  ],
  "recommendation": "Repair",
  "recommendationReason": "Clear explanation of why this is the best choice",
  "sustainabilityInsight": "Broader environmental context and encouragement",
  "impactMetrics": {
    "moneySaved": 9600,
    "ewasteReduced": "1.2 kg",
    "co2Avoided": 5.2,
    "landfillDiverted": "0.8 kg"
  }
}`;
}

// Repair Step damage Details
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

// API CALL 
export async function analyzeImageWithGemini(base64Image, mimeType = 'image/jpeg') {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent([
      VISION_PROMPT,
      { inlineData: { data: base64Image, mimeType } }
    ]);
    const text = result.response.text();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (err) {
    console.error('Gemini API Error (Analyze Image):', err.message);
  }
  return { objectType: 'Item', condition: 'unknown', components: [], damageDetails: [], repairability: 'unknown', summary: 'Could not analyze image due to a temporary API disruption. Proceeding with basic profile.' };
}

export async function generateDecisionsWithGemini(visualAnalysis, conversationHistory, userMessage) {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const prompt = buildReasoningPrompt(visualAnalysis, conversationHistory, userMessage);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (err) {
    console.error('Gemini API Error (Decisions):', err.message);
  }
  return buildFallbackDecisions();
}

export async function generateRepairStepDetail(option, step, itemDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(buildStepPrompt(option, step, itemDescription));
    const text = result.response.text();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (err) {
    console.error('Gemini API Error (Repair Step):', err.message);
  }
  return { stepTitle: step, detailedInstructions: 'Follow the standard procedure carefully.', warnings: [], tips: ['Proceed cautiously.', 'Consult the manual if stuck.'], estimatedTime: 'A few minutes', nextStepHint: '' };
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