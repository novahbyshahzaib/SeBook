// The full list of free voices for the read-aloud service, fetched live
// from Microsoft's voice list so the picker always offers everything
// available (300+ voices). Cached in memory and at the edge for a day.
// If the live list cannot be reached, a curated fallback list is served
// so Listen never breaks because of the list alone.

import { getVoices } from "edge-tts/out/index.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const FALLBACK_VOICES = [
  { Name: "en-US-AriaNeural", ShortName: "en-US-AriaNeural", FriendlyName: "Aria", DisplayName: "Aria", Gender: "Female", Locale: "en-US" },
  { Name: "en-US-JennyNeural", ShortName: "en-US-JennyNeural", FriendlyName: "Jenny", DisplayName: "Jenny", Gender: "Female", Locale: "en-US" },
  { Name: "en-US-GuyNeural", ShortName: "en-US-GuyNeural", FriendlyName: "Guy", DisplayName: "Guy", Gender: "Male", Locale: "en-US" },
  { Name: "en-US-EricNeural", ShortName: "en-US-EricNeural", FriendlyName: "Eric", DisplayName: "Eric", Gender: "Male", Locale: "en-US" },
  { Name: "en-US-DavisNeural", ShortName: "en-US-DavisNeural", FriendlyName: "Davis", DisplayName: "Davis", Gender: "Male", Locale: "en-US" },
  { Name: "en-US-AmberNeural", ShortName: "en-US-AmberNeural", FriendlyName: "Amber", DisplayName: "Amber", Gender: "Female", Locale: "en-US" },
  { Name: "en-GB-SoniaNeural", ShortName: "en-GB-SoniaNeural", FriendlyName: "Sonia", DisplayName: "Sonia", Gender: "Female", Locale: "en-GB" },
  { Name: "en-GB-RyanNeural", ShortName: "en-GB-RyanNeural", FriendlyName: "Ryan", DisplayName: "Ryan", Gender: "Male", Locale: "en-GB" },
  { Name: "en-GB-LibbyNeural", ShortName: "en-GB-LibbyNeural", FriendlyName: "Libby", DisplayName: "Libby", Gender: "Female", Locale: "en-GB" },
  { Name: "en-IN-NeerjaNeural", ShortName: "en-IN-NeerjaNeural", FriendlyName: "Neerja", DisplayName: "Neerja", Gender: "Female", Locale: "en-IN" },
  { Name: "en-IN-PrabhatNeural", ShortName: "en-IN-PrabhatNeural", FriendlyName: "Prabhat", DisplayName: "Prabhat", Gender: "Male", Locale: "en-IN" },
  { Name: "en-AU-NatashaNeural", ShortName: "en-AU-NatashaNeural", FriendlyName: "Natasha", DisplayName: "Natasha", Gender: "Female", Locale: "en-AU" },
  { Name: "en-AU-WilliamNeural", ShortName: "en-AU-WilliamNeural", FriendlyName: "William", DisplayName: "William", Gender: "Male", Locale: "en-AU" },
  { Name: "en-CA-ClaraNeural", ShortName: "en-CA-ClaraNeural", FriendlyName: "Clara", DisplayName: "Clara", Gender: "Female", Locale: "en-CA" },
  { Name: "en-IE-EmilyNeural", ShortName: "en-IE-EmilyNeural", FriendlyName: "Emily", DisplayName: "Emily", Gender: "Female", Locale: "en-IE" },
  { Name: "en-NZ-MollyNeural", ShortName: "en-NZ-MollyNeural", FriendlyName: "Molly", DisplayName: "Molly", Gender: "Female", Locale: "en-NZ" }
];

let cached = null;
let cachedAt = 0;

function displayName(friendly) {
  // "Microsoft Aria Online (Natural) - English (United States)" -> "Aria"
  const m = String(friendly || "").match(/^Microsoft\s+(.+?)\s+Online/);
  return m ? m[1] : String(friendly || "");
}

function clean(list) {
  return (Array.isArray(list) ? list : [])
    .filter((v) => v && typeof v.ShortName === "string" && typeof v.Locale === "string")
    .map((v) => ({
      // The short name (en-US-AriaNeural) is the voice's id everywhere:
      // the picker value and the synthesis request both use it.
      Name: v.ShortName,
      ShortName: v.ShortName,
      FriendlyName: v.FriendlyName || v.ShortName,
      DisplayName: displayName(v.FriendlyName || v.ShortName),
      Gender: v.Gender || "",
      Locale: v.Locale
    }));
}

export async function GET() {
  const now = Date.now();
  if (cached && now - cachedAt < 60 * 60 * 1000) {
    return Response.json({ voices: cached, fallback: false }, {
      headers: { "Cache-Control": "public, s-maxage=86400, max-age=3600" }
    });
  }
  try {
    const voices = clean(await getVoices());
    if (voices.length > 20) {
      cached = voices;
      cachedAt = now;
      return Response.json({ voices, fallback: false }, {
        headers: { "Cache-Control": "public, s-maxage=86400, max-age=3600" }
      });
    }
    throw new Error("voice list too short");
  } catch (err) {
    console.error("Voice list fetch failed, serving fallback:", err?.message || err);
    return Response.json({ voices: FALLBACK_VOICES, fallback: true }, {
      headers: { "Cache-Control": "public, s-maxage=3600, max-age=300" }
    });
  }
}
