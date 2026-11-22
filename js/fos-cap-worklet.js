// Microphone capture for Jarvis voice: downsamples to 24 kHz PCM. Loaded as a static file so the security policy can stay strict.
class FosCap extends AudioWorkletProcessor {
  constructor() { super(); this.r = sampleRate / 24000; this.p = 0; this.last = 0; this.out = new Int16Array(2400); this.n = 0; this.lv = 0; this.k = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]; if (!ch || !ch.length) return true;
    let sum = 0; for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    this.lv = Math.max(this.lv * 0.8, Math.sqrt(sum / ch.length)); if (++this.k % 8 === 0) this.port.postMessage({ lv: this.lv });
    const x = new Float32Array(ch.length + 1); x[0] = this.last; x.set(ch, 1); this.last = ch[ch.length - 1];
    let t = this.p;
    while (t < x.length - 1) {
      const i = Math.floor(t), f = t - i; let s = x[i] + (x[i + 1] - x[i]) * f; s = s < -1 ? -1 : s > 1 ? 1 : s;
      this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.out.length) { this.port.postMessage({ pcm: this.out.buffer }, [this.out.buffer]); this.out = new Int16Array(2400); this.n = 0; }
      t += this.r;
    }
    this.p = t - (x.length - 1);
    return true;
  }
}
registerProcessor('fos-cap', FosCap);
