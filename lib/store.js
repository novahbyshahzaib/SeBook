// SeBook storage: every book lives in the browser's local storage, so
// writing works offline and stays on the writer's own device.
import { getBookType } from "./bookTypes";

const BOOKS_KEY = "sebook-books-v1";
const DAILY_KEY = "sebook-daily-v1";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadBooks() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(BOOKS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveBooks(books) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

export function countWords(html) {
  if (!html) return 0;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  const words = text.trim().split(/\s+/).filter(Boolean);
  return text.trim() ? words.length : 0;
}

export function bookWordCount(book) {
  return (book.chapters || []).reduce((n, c) => n + countWords(c.content || ""), 0);
}

export function readingMinutes(words) {
  return Math.max(1, Math.round(words / 200));
}

export function createBook(title, typeId, author) {
  const type = getBookType(typeId);
  const now = Date.now();
  const chapters = type.chapters.map((c, i) => ({
    id: uid(),
    title: c.title,
    outline: c.outline || "",
    content: i === 0 ? type.starter : "",
    notes: ""
  }));
  return {
    id: uid(),
    title: title.trim() || "Untitled Book",
    author: author || "Shahzaib Muzaffar",
    type: type.id,
    typeName: type.name,
    goal: 500,
    createdAt: now,
    updatedAt: now,
    chapters,
    characters: [],
    notes: ""
  };
}

// Daily goal tracking: words written today, stored by date.
export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getTodayWords() {
  if (typeof window === "undefined") return 0;
  try {
    const data = JSON.parse(localStorage.getItem(DAILY_KEY) || "{}");
    return data[todayKey()] || 0;
  } catch {
    return 0;
  }
}

export function addTodayWords(delta) {
  if (typeof window === "undefined" || !delta) return;
  try {
    const data = JSON.parse(localStorage.getItem(DAILY_KEY) || "{}");
    const key = todayKey();
    data[key] = (data[key] || 0) + delta;
    localStorage.setItem(DAILY_KEY, JSON.stringify(data));
  } catch {}
}

export function htmlToText(html) {
  if (!html) return "";
  return html
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h1>/gi, "\n\n")
    .replace(/<\/h2>/gi, "\n\n")
    .replace(/<\/h3>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function bookToMarkdown(book) {
  const lines = [];
  lines.push(`# ${book.title}`);
  lines.push("");
  lines.push(`*by ${book.author || "Shahzaib Muzaffar"}*`);
  lines.push("");
  lines.push(`*${book.typeName} — ${bookWordCount(book)} words*`);
  lines.push("");
  (book.chapters || []).forEach((ch) => {
    lines.push(`## ${ch.title}`);
    lines.push("");
    lines.push(htmlToText(ch.content || ""));
    lines.push("");
  });
  return lines.join("\n");
}

// Find the real facts hidden inside a chapter's story text.
// A "fact" is a sentence that announces a true thing (e.g. "here is the
// first true thing this story is hiding: ...") plus the sentence after it.
export function extractFacts(html) {
  if (!html) return [];
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return [];
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || [text];
  const facts = [];
  for (let i = 0; i < sentences.length; i++) {
    if (/true thing/i.test(sentences[i])) {
      let fact = sentences[i].trim();
      // Drop the lead-in ("here is the first true thing...:") and keep
      // the fact itself plus the next sentence when it continues it.
      const colon = fact.indexOf(":");
      if (colon > 0 && colon < fact.length - 5) fact = fact.slice(colon + 1).trim();
      if (sentences[i + 1]) fact += " " + sentences[i + 1].trim();
      fact = fact.replace(/^(here is the (first|second|last|next) true thing[^:]*:\s*)/i, "").trim();
      if (fact) facts.push(fact);
    }
  }
  return facts.slice(0, 3);
}

export function bookToPlainText(book) {
  const lines = [];
  lines.push(book.title.toUpperCase());
  lines.push(`by ${book.author || "Shahzaib Muzaffar"}`);
  lines.push("");
  (book.chapters || []).forEach((ch) => {
    lines.push(ch.title);
    lines.push("=".repeat(Math.min(ch.title.length, 60)));
    lines.push("");
    lines.push(htmlToText(ch.content || ""));
    lines.push("");
  });
  return lines.join("\n");
}

// ---- Muse Integration ----
// The app can sync its books to SeBook's cloud (Vercel Blob) under one
// secret integration key. With that key, Muse can read and write the
// books from chat through /api/integration/*, and the app picks the
// changes up. The key is the only protection — keep it private.

const KEY_KEY = "sebook-integration-key";
const ENABLED_KEY = "sebook-integration-enabled";
const SYNCED_KEY = "sebook-last-synced";

export function getIntegrationKey() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY_KEY) || "";
}

export function generateIntegrationKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `sb_${hex}`;
  localStorage.setItem(KEY_KEY, key);
  return key;
}

export function clearIntegrationKey() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_KEY);
  localStorage.removeItem(ENABLED_KEY);
  localStorage.removeItem(SYNCED_KEY);
}

export function isIntegrationEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY) === "1" && !!getIntegrationKey();
}

export function setIntegrationEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

export function getLastSynced() {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(SYNCED_KEY) || "0", 10);
}

export async function pushBooksToCloud() {
  const key = getIntegrationKey();
  if (!key || !isIntegrationEnabled()) return { ok: false, reason: "not-enabled" };
  const books = loadBooks();
  const res = await fetch("/api/integration/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, books })
  });
  if (!res.ok) return { ok: false, reason: "server" };
  localStorage.setItem(SYNCED_KEY, String(Date.now()));
  return { ok: true };
}

export async function pullBooksFromCloud() {
  const key = getIntegrationKey();
  if (!key || !isIntegrationEnabled()) return { ok: false, reason: "not-enabled" };
  const res = await fetch(`/api/integration/books?key=${encodeURIComponent(key)}`, { cache: "no-store" });
  if (!res.ok) return { ok: false, reason: "server" };
  const data = await res.json();
  if (!Array.isArray(data.books)) return { ok: false, reason: "bad-data" };
  const local = loadBooks();
  const localMax = local.reduce((n, b) => Math.max(n, b.updatedAt || 0), 0);
  // Cloud wins only when it is newer than everything local.
  if ((data.updatedAt || 0) > localMax && data.books.length > 0) {
    saveBooks(data.books);
    localStorage.setItem(SYNCED_KEY, String(Date.now()));
    return { ok: true, changed: true, count: data.books.length };
  }
  return { ok: true, changed: false, count: data.books.length };
}
