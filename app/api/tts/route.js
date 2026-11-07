import { NextResponse } from "next/server";

// Read-aloud synthesis, through our own server.
//
// Two free voices, both server-side so the phone downloads nothing
// and the page stays responsive:
//
//  1. Groq Orpheus (canopylabs/orpheus-v1-english) — a real,
//     expressive neural voice, 6 personas. Needs the reader's own
//     free Groq API key (free tier, no card), which the browser sends
//     with each request; the key is never stored on the server.
//     https://api.groq.com/openai/v1/audio/speech
//     Input is limited to 200 characters per request, so the player
//     sends ~180-character pieces.
//
//  2. Google basic (Google Translate TTS) — the plain computer voice,
//     no key needed. A fallback so Listen works out of the box; the
//     user asked for a realistic voice, so the Groq voices are the
//     default and this one is only offered as "Basic".
//
// This replaced Microsoft Edge TTS (2026-11-07): Microsoft's service
// refuses WebSocket connections from Vercel's servers (1007) and from
// normal browsers (the handshake never opens — it only accepts its
// own Edge browser), on both its old and new endpoints.

export const maxDuration = 10;

const GROQ_URL = "https://api.groq.com/openai/v1/audio/speech";
const GROQ_MODEL = "canopylabs/orpheus-v1-english";

export const GROQ_VOICES = ["autumn", "diana", "hannah", "austin", "daniel", "troy"];
export const GOOGLE_VOICE = "google-basic";

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonError("Could not read the request.", 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voice = typeof body.voice === "string" ? body.voice.trim() : "";
  if (!text) return jsonError("There is nothing to read.", 400);

  if (voice === GOOGLE_VOICE) {
    if (text.length > 200) return jsonError("That piece of text is too long for the basic voice.", 400);
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=en&q=${encodeURIComponent(text)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return jsonError("The basic voice did not answer. Try again.", 502);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 100) return jsonError("The basic voice returned no audio.", 502);
      return new NextResponse(buf, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400, immutable" }
      });
    } catch {
      return jsonError("The basic voice did not answer. Check your connection and try again.", 502);
    }
  }

  if (!GROQ_VOICES.includes(voice)) return jsonError("That voice is not available.", 400);
  if (text.length > 200) return jsonError("That piece of text is too long for this voice.", 400);
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) {
    return jsonError("Listen needs a free Groq key. Add it below — it takes a minute at console.groq.com, no card needed — or pick the Basic voice.", 400);
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        input: text,
        voice,
        response_format: "mp3"
      }),
      signal: AbortSignal.timeout(9000)
    });
    if (res.status === 401) {
      return jsonError("The Groq key was rejected. Check the key in the voice settings.", 401);
    }
    if (res.status === 429) {
      return jsonError("The free voice limit was reached for now. Try again in a little while, or use the Basic voice.", 429);
    }
    if (!res.ok) {
      let detail = "";
      try { const d = await res.json(); detail = d?.error?.message || ""; } catch {}
      return jsonError(detail || "The voice service did not answer. Try again.", 502);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return jsonError("The voice service returned no audio.", 502);
    const type = res.headers.get("content-type") || "audio/mpeg";
    return new NextResponse(buf, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, immutable" }
    });
  } catch {
    return jsonError("The voice service did not answer. Check your connection and try again.", 502);
  }
}
