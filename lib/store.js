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
