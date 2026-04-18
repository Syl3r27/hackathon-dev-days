/**
 * AudioWorklet processor that captures microphone audio,
 * downsamples to 16kHz, and converts to 16-bit PCM.
 * 
 * Gemini Live API expects: audio/pcm;rate=16000 (16-bit, mono, little-endian)
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 2048; // ~128ms at 16kHz — good balance of latency vs overhead
  }

  /**
   * Downsample from source sample rate to 16kHz and convert to Int16.
   */
  _downsampleAndConvert(float32Array, fromSampleRate) {
    const toSampleRate = 16000;
    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.floor(float32Array.length / ratio);
    const int16Array = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = Math.floor(i * ratio);
      // Clamp and convert float32 [-1, 1] to int16 [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, float32Array[srcIndex]));
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    return int16Array;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    // Take first channel (mono)
    const channelData = input[0];

    // Downsample and convert to Int16 PCM
    const pcmData = this._downsampleAndConvert(channelData, sampleRate);

    // Accumulate in buffer
    for (let i = 0; i < pcmData.length; i++) {
      this._buffer.push(pcmData[i]);
    }

    // When buffer is full, send it
    if (this._buffer.length >= this._bufferSize) {
      const chunk = new Int16Array(this._buffer.splice(0, this._bufferSize));
      this.port.postMessage({
        type: 'pcm',
        data: chunk.buffer
      }, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
