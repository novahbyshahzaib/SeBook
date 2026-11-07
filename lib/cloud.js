// SeBook cloud store for the Muse Integration.
// Books synced here live in the Vercel Blob store (sebook-data) under one
// file per integration key. The key is the only protection — anyone with
// the key can read and write that key's books, so keep it private like a
// password and never post it publicly.
import { put } from "@vercel/blob";

export const KEY_PREFIX = "sb_";

export function isValidKey(key) {
  return typeof key === "string" && /^sb_[0-9a-f]{32}$/.test(key);
}

export function blobPath(key) {
  return `sebook-keys/${key}/books.json`;
}

export function blobUrl(key) {
  const base = process.env.BLOB_URL || process.env.VERCEL_BLOB_URL || "";
  // The Blob store URL is injected as BLOB_READ_WRITE_TOKEN's companion;
  // when it is not set, fall back to the public store host pattern via list.
  return base ? `${base.replace(/\/$/, "")}/${blobPath(key)}` : null;
}

export async function loadCloudBooks(key) {
  if (!isValidKey(key)) return { books: [], updatedAt: 0 };
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: blobPath(key), limit: 1 });
    if (!blobs || blobs.length === 0) return { books: [], updatedAt: 0 };
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return { books: [], updatedAt: 0 };
    const data = await res.json();
    if (!data || !Array.isArray(data.books)) return { books: [], updatedAt: 0 };
    return { books: data.books, updatedAt: data.updatedAt || 0 };
  } catch {
    return { books: [], updatedAt: 0 };
  }
}

export async function saveCloudBooks(key, books) {
  const payload = JSON.stringify({ updatedAt: Date.now(), books: books || [] });
  await put(blobPath(key), payload, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false
  });
  return { updatedAt: Date.now(), count: (books || []).length };
}
