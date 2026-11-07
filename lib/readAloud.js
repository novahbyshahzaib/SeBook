// Read-aloud for SeBook — a real, natural server voice.
//
// The voice is Microsoft's free read-aloud service (Edge TTS):
// realistic neural voices, no key and no account. The reader's own
// browser opens a WebSocket straight to Microsoft and the audio
// streams back as MP3, so the first sound starts in seconds and the
// page stays responsive. It needs internet every time it reads, which
// the user accepted in exchange for instant, reliable playback.
//
// This replaced the earlier in-browser Kokoro voice (2026-11-07): that
// voice ran entirely on the phone, so the first listen had to download
// ~45 MB and wake a model up inside the browser — on a slow Android
// phone that took minutes and the page stopped answering taps.
//
// The voice first went through our own server (app/api/tts), but
// Microsoft's service refuses the messages when they come from
// Vercel's datacenter IPs, so the connection now comes from the
// reader's browser instead — the same way Microsoft Edge's own Read
// Aloud works. See lib/edgeTtsBrowser.js.

import { synthesizeInBrowser } from "./edgeTtsBrowser";

// A small curated set, used before the full live list loads and as a
// fallback if the live list cannot be reached.
export const VOICES = [
  { Name: "en-US-AriaNeural", ShortName: "en-US-AriaNeural", FriendlyName: "Aria", DisplayName: "Aria", Gender: "Female", Locale: "en-US" },
  { Name: "en-US-JennyNeural", ShortName: "en-US-JennyNeural", FriendlyName: "Jenny", DisplayName: "Jenny", Gender: "Female", Locale: "en-US" },
  { Name: "en-US-GuyNeural", ShortName: "en-US-GuyNeural", FriendlyName: "Guy", DisplayName: "Guy", Gender: "Male", Locale: "en-US" },
  { Name: "en-US-EricNeural", ShortName: "en-US-EricNeural", FriendlyName: "Eric", DisplayName: "Eric", Gender: "Male", Locale: "en-US" },
  { Name: "en-GB-SoniaNeural", ShortName: "en-GB-SoniaNeural", FriendlyName: "Sonia", DisplayName: "Sonia", Gender: "Female", Locale: "en-GB" },
  { Name: "en-GB-RyanNeural", ShortName: "en-GB-RyanNeural", FriendlyName: "Ryan", DisplayName: "Ryan", Gender: "Male", Locale: "en-GB" },
  { Name: "en-IN-NeerjaNeural", ShortName: "en-IN-NeerjaNeural", FriendlyName: "Neerja", DisplayName: "Neerja", Gender: "Female", Locale: "en-IN" },
  { Name: "en-IN-PrabhatNeural", ShortName: "en-IN-PrabhatNeural", FriendlyName: "Prabhat", DisplayName: "Prabhat", Gender: "Male", Locale: "en-IN" },
  { Name: "en-AU-NatashaNeural", ShortName: "en-AU-NatashaNeural", FriendlyName: "Natasha", DisplayName: "Natasha", Gender: "Female", Locale: "en-AU" },
  { Name: "en-AU-WilliamNeural", ShortName: "en-AU-WilliamNeural", FriendlyName: "William", DisplayName: "William", Gender: "Male", Locale: "en-AU" }
];

export const DEFAULT_VOICE = "en-US-AriaNeural";
const VOICES_CACHE_KEY = "sebook-voices-v1";
const VOICES_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// The full live list (300+ free voices), cached in the browser for a week.
export async function fetchVoices() {
  try {
    const raw = localStorage.getItem(VOICES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.at && Date.now() - parsed.at < VOICES_CACHE_TTL && Array.isArray(parsed.voices) && parsed.voices.length > 20) {
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
// each no longer than about 280 characters. Small pieces keep the
// player responsive and let the next piece be ready before it is needed.
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
    const bytes = await synthesizeInBrowser(this.chunks[i], this.voice);
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    return URL.createObjectURL(blob);
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
        // The trace (open / close code / message path) and the HTTPS
        // reachability probe are shown with the error so a failed
        // listen can actually be diagnosed.
        const parts = [err?.message || "The read-aloud service did not answer."];
        if (err?.trace) parts.push(`[${err.trace}]`);
        if (err?.reachable) parts.push(`(${err.reachable})`);
        this.status("error", parts.join(" "));
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
