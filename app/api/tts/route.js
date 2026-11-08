import { NextResponse } from "next/server";

// Read-aloud synthesis — no key, no sign-up.
//
// Uses Google's free read-aloud voice through our server, so the phone
// downloads nothing and the page stays responsive. It needs internet
// every time it reads.
//
// The Groq API key system was removed (2026-11-08) at the user's
// request: he did not want an API key system. The realistic Groq
// voices needed a key, so Listen now uses the basic voice only.

export const maxDuration = 10;

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "There is nothing to read." }, { status: 400 });
  if (text.length > 200) return NextResponse.json({ error: "That piece of text is too long." }, { status: 400 });
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=en&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return NextResponse.json({ error: "The voice did not answer. Try again." }, { status: 502 });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return NextResponse.json({ error: "The voice returned no audio." }, { status: 502 });
    return new NextResponse(buf, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400, immutable" }
    });
  } catch {
    return NextResponse.json({ error: "The voice did not answer. Check your connection and try again." }, { status: 502 });
  }
}
