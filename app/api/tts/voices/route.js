import { NextResponse } from "next/server";

// The voice Listen offers: the basic voice only. No key, no sign-up.
// (The Groq API key system was removed 2026-11-08 at the user's
// request — he did not want an API key system.)

const VOICES = [
  { Name: "google-basic", ShortName: "google-basic", FriendlyName: "Basic", DisplayName: "Basic", Gender: "Female", Locale: "en-US", Provider: "Google", NeedsKey: false }
];

export async function GET() {
  return NextResponse.json({ voices: VOICES, fallback: false });
}
