// Read-aloud for SeBook — a free voice, no key, no sign-up.
//
// The voice comes from our own server (POST /api/tts), which speaks
// through Google's free read-aloud voice. The phone downloads no model
// and does no heavy work — the audio streams back as MP3, so the first
// sound starts in seconds and the page stays responsive. It needs
// internet every time it reads, which the user accepted in exchange
// for instant, reliable playback.
//
// Voice history (2026-11-07/08): the first voice ran Kokoro in the
// browser — on a slow Android phone the ~45 MB download and the
// on-device model took minutes and froze the page. Then Microsoft
// Edge TTS was tried two ways — through our server (Microsoft refused
// the messages from Vercel's datacenter IPs) and straight from the
// browser (Microsoft refuses the connection from normal browsers; it
// only accepts its own Edge browser) — on both its old and new
// endpoints. Then Groq Orpheus (realistic voices) was built, but it
// needed the reader's own free Groq API key, and the user asked for
// the API key system to be removed (2026-11-08). So Listen now uses
// the basic voice only: it works with no key at all.

// The voice Listen offers, used before the live list loads and as a
// fallback if the live list cannot be reached.
export const VOICES = [
  { Name: "google-basic", ShortName: "google-basic", FriendlyName: "Basic", DisplayName: "Basic", Gender: "Female", Locale: "en-US", Provider: "Google", NeedsKey: false }
];

export const DEFAULT_VOICE = "google-basic";
const VOICES_CACHE_KEY = "sebook-voices-v3";
const VOICES_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// The voice list, cached in the browser for a week.
export async function fetchVoices() {
  try {
    const raw = localStorage.getItem(VOICES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.at && Date.now() - parsed.at < VOICES_CACHE_TTL && Array.isArray(parsed.voices) && parsed.voices.length > 0) {
        return parsed.voices;
      }
    }
  } catch {}
  try {
    const res = await fetch("/api/tts/voices", { cache: "no-store" });
    const data = await res.json();
    if (Array.isArray(data.voices) && data.voices.length > 0) {
      try { localStorage.setItem(VOICES_CACHE_KEY, JSON.stringify({ at: Date.now(), voices: data.voices })); } catch {}
      return data.voices;
    }
  } catch {}
  return VOICES;
}

export function voiceLabel(v) {
  if (!v) return "";
  const name = v.DisplayName || v.FriendlyName || v.Name;
  const lang = (v.Locale || "").replace("-", " ").toUpperCase();
  return `${name} — ${v.Gender === "Male" ? "Male" : "Female"} · ${lang}`;
}

// Split plain text into speakable chunks at sentence boundaries,
// each no longer than about 180 characters. The voice allows at most
// 200 characters per request, and small pieces keep the player
// responsive and let the next piece be ready before it is needed.
export function splitIntoChunks(text) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || [clean];
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    const sentence = s.trim();
    if (!sentence) continue;
    if ((cur + " " + sentence).trim().length > 180 && cur) {
      chunks.push(cur.trim());
      cur = sentence;
    } else {
      cur = (cur + " " + sentence).trim();
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  // A single very long sentence is split hard at 180 characters so no
  // request ever exceeds the provider's limit.
  const out = [];
  for (const c of chunks) {
    if (c.length <= 180) { out.push(c); continue; }
    for (let i = 0; i < c.length; i += 180) out.push(c.slice(i, i + 180).trim());
  }
  return out.filter(Boolean);
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
    this.buffer = new Map(); // index -> object URL, fetched ahead
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

  async fetchChunk(i) {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: this.chunks[i], voice: this.voice })
    });
    if (!res.ok) {
      let msg = "The read-aloud service did not answer.";
      try { const d = await res.json(); if (d?.error) msg = d.error; } catch {}
      throw new Error(msg);
    }
    return URL.createObjectURL(await res.blob());
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
    this.status("reading", "Getting the voice…");
    this.progress();
    this.playChunk(this.index);
    this.prefetch(this.index + 1);
  }

  async prefetch(i) {
    if (i < 0 || i >= this.chunks.length || this.buffer.has(i) || this.stopped) return;
    try {
      const url = await this.fetchChunk(i);
      if (this.stopped) { URL.revokeObjectURL(url); return; }
      this.buffer.set(i, url);
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
      this.status("reading", `Getting the voice for part ${i + 1} of ${this.chunks.length}…`);
      // Watchdog: the server usually answers in seconds. If one piece
      // stalls, stop with a clear message instead of hanging.
      const watchdog = setTimeout(() => {
        if (this.generating && !this.stopped) {
          this.stop();
          this.status("error", "The read-aloud service is taking too long. Check your connection and tap Listen again.");
        }
      }, 45000);
      try {
        url = await this.fetchChunk(i);
        clearTimeout(watchdog);
        if (this.stopped) { URL.revokeObjectURL(url); return; }
      } catch (err) {
        clearTimeout(watchdog);
        if (this.stopped) return;
        this.status("error", err?.message || "The read-aloud service did not answer. Tap Listen to try again.");
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
