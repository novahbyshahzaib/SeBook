import { NextResponse } from "next/server";

// The voices Listen offers. A short static list — the provider's
// voices are fixed, so there is no live list to fetch anymore.
// (The old Microsoft list of 322 voices is gone: Microsoft's service
// refuses connections from normal browsers and from this server.)
//
// Groq Orpheus voices are realistic and expressive, and free with the
// reader's own Groq key (free tier, no card). The Google basic voice
// is the plain computer voice, offered only as a no-key fallback.

const VOICES = [
  { Name: "autumn", ShortName: "autumn", FriendlyName: "Autumn", DisplayName: "Autumn", Gender: "Female", Locale: "en-US", Provider: "Groq", NeedsKey: true },
  { Name: "diana", ShortName: "diana", FriendlyName: "Diana", DisplayName: "Diana", Gender: "Female", Locale: "en-US", Provider: "Groq", NeedsKey: true },
  { Name: "hannah", ShortName: "hannah", FriendlyName: "Hannah", DisplayName: "Hannah", Gender: "Female", Locale: "en-US", Provider: "Groq", NeedsKey: true },
  { Name: "austin", ShortName: "austin", FriendlyName: "Austin", DisplayName: "Austin", Gender: "Male", Locale: "en-US", Provider: "Groq", NeedsKey: true },
  { Name: "daniel", ShortName: "daniel", FriendlyName: "Daniel", DisplayName: "Daniel", Gender: "Male", Locale: "en-US", Provider: "Groq", NeedsKey: true },
  { Name: "troy", ShortName: "troy", FriendlyName: "Troy", DisplayName: "Troy", Gender: "Male", Locale: "en-US", Provider: "Groq", NeedsKey: true },
  { Name: "google-basic", ShortName: "google-basic", FriendlyName: "Basic", DisplayName: "Basic", Gender: "Female", Locale: "en-US", Provider: "Google", NeedsKey: false }
];

export async function GET() {
  return NextResponse.json({ voices: VOICES, fallback: false });
}
