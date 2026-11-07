import { NextResponse } from "next/server";
import { isValidKey, loadCloudBooks, saveCloudBooks } from "../../../../lib/cloud";

// GET /api/integration/books?key=sb_...
// Returns the cloud copy of the books for this integration key.
export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!isValidKey(key)) {
    return NextResponse.json({ error: "Invalid or missing integration key" }, { status: 401 });
  }
  const data = await loadCloudBooks(key);
  return NextResponse.json(data);
}

// POST /api/integration/books  { key, books }
// Replaces the whole cloud copy (used by the app's sync).
export async function POST(request) {
  try {
    const { key, books } = await request.json();
    if (!isValidKey(key)) {
      return NextResponse.json({ error: "Invalid or missing integration key" }, { status: 401 });
    }
    if (!Array.isArray(books)) {
      return NextResponse.json({ error: "books must be an array" }, { status: 400 });
    }
    const result = await saveCloudBooks(key, books);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
