// Read-aloud for SeBook — a real, natural voice, not the phone's robotic
// system voice.
//
// The voice is Kokoro, an open-source (Apache 2.0) neural text-to-speech
// model. It runs 100% in the reader's own browser through kokoro-js, so
// there is no server, no key and no account. The first time someone taps
// Listen, the voice model (about 45 MB, q4) downloads once from Hugging
// Face and is then cached by the browser, so later listens start at once.
// The model is loaded lazily — only when Listen is tapped — so the app
// itself stays small and fast.
//
// Phone lesson (2026-11-07): the first version used the bigger q8 voice
// and 600-character pieces. On a slower phone, making one big piece took
// so long the page looked frozen and Pause/Stop stopped responding. So
// the voice is now the lighter q4 build and the text is cut into small
// ~280-character pieces, so the first sound starts quickly and the page
// stays responsive between pieces. A watchdog also stops the player with
// a clear message instead of hanging forever if one piece stalls.

export const VOICES = [
  { id: "af_heart", label: "Heart", desc: "Warm female voice" },
  { id: "af_bella", label: "Bella", desc: "Clear female voice" },
  { id: "bf_emma", label: "Emma", desc: "British female voice" },
  { id: "am_fenrir", label: "Fenrir", desc: "Deep male voice" },
  { id: "am_michael", label: "Michael", desc: "Calm male voice" },
  { id: "bm_george", label: "George", desc: "British male voice" }
];

export const DEFAULT_VOICE = "af_heart";
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
// The Kokoro web runtime is vendored under /public/tts/ (kokoro.web.js
// plus the onnxruntime bundle files it loads relative to itself) and is
// imported at runtime, so webpack never tries to bundle it. The ONNX
// wasm runtime itself is loaded from the jsDelivr CDN (same version the
// bundle was built against), and the voice model (~80 MB, q8) comes from
// Hugging Face on first use and is then cached by the browser.
const TTS_URL = "/tts/kokoro.web.js";
const WASM_PATHS = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";

let ttsPromise = null;
let ttsInstance = null;

async function loadKokoroModule() {
  // webpackIgnore keeps this a native browser dynamic import.
  const mod = await import(/* webpackIgnore: true */ TTS_URL);
  if (mod.env?.backends?.onnx?.wasm) {
    mod.env.backends.onnx.wasm.wasmPaths = WASM_PATHS;
  }
  return mod;
}

function loadModel(progressCb) {
  if (ttsInstance) return Promise.resolve(ttsInstance);
  if (!ttsPromise) {
    ttsPromise = loadKokoroModule().then(async ({ KokoroTTS }) => {
      const files = {};
      const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
        // q4: the lighter build — about half the download of q8 and
        // noticeably faster to run on a phone, still a real human voice.
        dtype: "q4",
        device: "wasm",
        progress_callback: (p) => {
          if (!p || !p.file) return;
          // Transformers.js reports progress as p.progress (0-100) on
          // some files and as loaded/total on others; use whichever it gives.
          let frac = null;
          if (typeof p.progress === "number") frac = p.progress / 100;
          else if (p.status === "progress" && p.total > 0) frac = p.loaded / p.total;
          if (p.status === "done") frac = 1;
          if (frac === null) return;
          // Weight each file by its size when known, so the big model
          // file — not a tiny config file — decides the percentage.
          files[p.file] = { frac, weight: p.total > 0 ? p.total : 1 };
          const all = Object.values(files);
          const wSum = all.reduce((n, f) => n + f.weight, 0);
          const avg = all.reduce((n, f) => n + f.frac * f.weight, 0) / wSum;
          if (progressCb) progressCb(Math.min(1, Math.max(0, avg)));
        }
      });
      ttsInstance = tts;
      return tts;
    }).catch((err) => {
      ttsPromise = null;
      throw err;
    });
  }
  return ttsPromise;
}

// Split plain text into speakable chunks at sentence boundaries,
// each no longer than about 280 characters. Small pieces matter: on a
// slower phone, making one big piece of audio can take minutes and the
// page looks frozen while it works. Small pieces start playing quickly
// and keep the Pause/Stop buttons responsive between pieces.
export function splitIntoChunks(text) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || [clean];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    const sentence = s.trim();
    if (!sentence) continue;
    if ((cur + " " + sentence).trim().length > 280 && cur) {
      chunks.push(cur.trim());
      cur = sentence;
    } else {
      cur = (cur + " " + sentence).trim();
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export class ReadAloud {
  constructor() {
    this.audio = null;
    this.chunks = [];
    this.index = 0;
    this.voice = DEFAULT_VOICE;
    this.speed = 1;
    this.stopped = true;
    this.paused = false;
    this.generating = false;
    this.onStatus = null;
    this.onProgress = null;
    this.buffer = new Map(); // index -> object URL, generated ahead
  }

  setCallbacks({ onStatus, onProgress }) {
    this.onStatus = onStatus;
    this.onProgress = onProgress;
  }

  status(s, detail) {
    if (this.onStatus) this.onStatus(s, detail || "");
  }

  progress() {
    if (this.onProgress) {
      this.onProgress({
        index: this.index,
        total: this.chunks.length,
        fraction: this.chunks.length ? this.index / this.chunks.length : 0
      });
    }
  }

  async start(plainText, { voice, speed } = {}) {
    this.stop();
    this.voice = voice || this.voice || DEFAULT_VOICE;
    this.speed = speed || this.speed || 1;
    this.chunks = splitIntoChunks(plainText);
    if (this.chunks.length === 0) {
      this.status("error", "There is nothing to read in this chapter yet.");
      return;
    }
    this.stopped = false;
    this.paused = false;
    this.index = 0;
    this.status("loading", "Loading the voice for the first time… (about 45 MB, once only)");
    try {
      await loadModel((p) => {
        this.status("loading", `Downloading the voice… ${Math.round(p * 100)}% (once only, about 45 MB)`);
      });
    } catch {
      this.status("error", "The voice could not be loaded. Check your connection and try again.");
      this.stopped = true;
      return;
    }
    this.status("reading", "Reading…");
    this.progress();
    this.playChunk(this.index);
    this.prefetch(this.index + 1);
  }

  async prefetch(i) {
    if (i < 0 || i >= this.chunks.length || this.buffer.has(i) || this.stopped) return;
    try {
      const tts = await loadModel();
      const audio = await tts.generate(this.chunks[i], { voice: this.voice });
      if (this.stopped) return;
      this.buffer.set(i, URL.createObjectURL(audio.toBlob()));
    } catch { /* prefetch failures are retried when the chunk plays */ }
  }

  async playChunk(i) {
    if (this.stopped || i >= this.chunks.length) {
      if (!this.stopped) this.finish();
      return;
    }
    this.index = i;
    this.progress();
    this.generating = true;
    let url = this.buffer.get(i);
    this.buffer.delete(i);
    if (!url) {
      this.status("reading", `Making the voice for part ${i + 1} of ${this.chunks.length} — this can take a minute on a slower phone…`);
      // Watchdog: if one piece stalls, stop with a clear message instead
      // of hanging on "Preparing…" forever with dead buttons.
      const watchdog = setTimeout(() => {
        if (this.generating && !this.stopped) {
          this.stop();
          this.status("error", "This phone is taking too long to make the voice. Close the app fully, reopen it, and tap Listen again — or try a shorter chapter first.");
        }
      }, 150000);
      try {
        const tts = await loadModel();
        const audio = await tts.generate(this.chunks[i], { voice: this.voice });
        clearTimeout(watchdog);
        if (this.stopped) return;
        url = URL.createObjectURL(audio.toBlob());
      } catch {
        clearTimeout(watchdog);
        if (this.stopped) return;
        this.status("error", "The voice stopped unexpectedly. Tap Listen to try again.");
        this.stopped = true;
        return;
      }
    }
    this.generating = false;
    if (this.stopped) return;
    if (this.audio) { this.audio.pause(); }
    const el = new Audio(url);
    el.playbackRate = this.speed;
    el.onended = () => {
      URL.revokeObjectURL(url);
      if (!this.stopped && !this.paused) {
        this.index += 1;
        this.playChunk(this.index);
      }
    };
    el.onerror = () => {
      if (!this.stopped) this.status("error", "Audio playback failed on this device.");
    };
    this.audio = el;
    this.status("reading", "Reading…");
    try {
      await el.play();
    } catch {
      if (!this.stopped) this.status("error", "Playback was blocked. Tap the play button to start.");
    }
    this.prefetch(i + 1);
  }

  pause() {
    if (!this.audio || this.stopped) return;
    this.paused = true;
    this.audio.pause();
    this.status("paused", "Paused.");
  }

  resume() {
    if (!this.audio || this.stopped) return;
    this.paused = false;
    this.audio.playbackRate = this.speed;
    this.audio.play().catch(() => {});
    this.status("reading", "Reading…");
  }

  setSpeed(n) {
    this.speed = n;
    if (this.audio) this.audio.playbackRate = n;
  }

  setVoice(v) {
    if (v === this.voice) return;
    this.voice = v;
    this.buffer.forEach((u) => URL.revokeObjectURL(u));
    this.buffer.clear();
    if (!this.stopped) {
      if (this.audio) this.audio.pause();
      this.playChunk(this.index);
      this.prefetch(this.index + 1);
    }
  }

  finish() {
    this.stopped = true;
    this.status("done", "Finished reading this chapter.");
    this.progress();
  }

  stop() {
    this.stopped = true;
    this.paused = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.onended = null;
      this.audio = null;
    }
    this.buffer.forEach((u) => URL.revokeObjectURL(u));
    this.buffer.clear();
    this.generating = false;
  }
}
