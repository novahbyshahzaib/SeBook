// SeBook read-aloud, server voice (Microsoft Edge read-aloud service).
// The voice is generated on the server through the free Edge TTS service
// (no key, no account) and streamed back as MP3, so the phone does no
// heavy work at all: no big download, no warming up a model in the
// browser, and the first sound starts in seconds. It needs internet
// every time it reads, which the user accepted.
//
// The service is unofficial (Microsoft's own read-aloud endpoint, used
// here through the small `edge-tts` library). If Microsoft ever changes
// it, this route returns a 502 and the player shows a clear error.

import { tts } from "edge-tts/out/index.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

// A voice name must look like a real Edge neural voice, e.g.
// en-US-AriaNeural. Anything else is rejected so a crafted value cannot
// inject SSML into the synthesis request.
const VOICE_RE = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/;
const MAX_TEXT = 1200;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const voice = typeof body?.voice === "string" ? body.voice.trim() : "";
  if (!text || text.length > MAX_TEXT) {
    return Response.json({ error: "Text must be 1–1200 characters." }, { status: 400 });
  }
  if (!VOICE_RE.test(voice)) {
    return Response.json({ error: "Unknown voice." }, { status: 400 });
  }
  try {
    const audio = await tts(text, { voice });
    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400, immutable"
      }
    });
  } catch (err) {
    console.error("Edge TTS failed:", err?.message || err);
    return Response.json(
      { error: "The read-aloud service did not answer. Check your connection and try again.", detail: String(err?.message || err) },
      { status: 502 }
    );
  }
}
