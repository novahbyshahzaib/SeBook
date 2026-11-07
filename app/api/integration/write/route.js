import { NextResponse } from "next/server";
import { isValidKey, loadCloudBooks, saveCloudBooks } from "../../../../lib/cloud";
import { createBook } from "../../../../lib/store";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function esc(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// POST /api/integration/write
// This is the endpoint Muse uses when the user asks it to write in SeBook
// from chat. Every call needs the integration key from the app's Settings.
//
// Actions:
//   { key, action: "list_books" }
//   { key, action: "get_book", bookId }
//   { key, action: "create_book", title, type, author }
//   { key, action: "create_chapter", bookId, title, content }
//   { key, action: "append_chapter", bookId, chapterId?, text }
//   { key, action: "set_chapter", bookId, chapterId, content }
//   { key, action: "set_title", bookId, title }
//   { key, action: "add_character", bookId, name, role, desc }
//
// `text` / `content` may be plain text (turned into paragraphs) or HTML.
export async function POST(request) {
  try {
    const body = await request.json();
    const { key, action } = body || {};
    if (!isValidKey(key)) {
      return NextResponse.json({ error: "Invalid or missing integration key" }, { status: 401 });
    }
    const { books } = await loadCloudBooks(key);
    const save = async () => {
      await saveCloudBooks(key, books);
    };

    if (action === "list_books") {
      return NextResponse.json({
        books: books.map((b) => ({
          id: b.id,
          title: b.title,
          typeName: b.typeName,
          chapters: (b.chapters || []).map((c) => ({ id: c.id, title: c.title })),
          updatedAt: b.updatedAt
        }))
      });
    }

    if (action === "get_book") {
      const book = books.find((b) => b.id === body.bookId);
      if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
      return NextResponse.json({ book });
    }

    if (action === "create_book") {
      const book = createBook(body.title || "Untitled Book", body.type || "novel", body.author || "Shahzaib Muzaffar");
      books.unshift(book);
      await save();
      return NextResponse.json({ ok: true, book });
    }

    const book = books.find((b) => b.id === body.bookId);
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

    const toHtml = (text) => {
      const t = String(text || "");
      if (/<(p|h1|h2|h3|ul|ol|li|blockquote)\b/i.test(t)) return t;
      return t
        .split(/\n\s*\n/)
        .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
        .join("");
    };

    if (action === "create_chapter") {
      const ch = { id: uid(), title: body.title || `Chapter ${(book.chapters || []).length + 1}`, outline: body.outline || "", content: toHtml(body.content || body.text || ""), notes: "" };
      book.chapters = [...(book.chapters || []), ch];
      book.updatedAt = Date.now();
      await save();
      return NextResponse.json({ ok: true, chapter: ch });
    }

    if (action === "append_chapter") {
      let ch = body.chapterId
        ? (book.chapters || []).find((c) => c.id === body.chapterId)
        : (book.chapters || [])[(book.chapters || []).length - 1];
      if (!ch) return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
      ch.content = (ch.content || "") + toHtml(body.text || "");
      book.updatedAt = Date.now();
      await save();
      return NextResponse.json({ ok: true, chapter: ch });
    }

    if (action === "set_chapter") {
      const ch = (book.chapters || []).find((c) => c.id === body.chapterId);
      if (!ch) return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
      ch.content = toHtml(body.content || body.text || "");
      book.updatedAt = Date.now();
      await save();
      return NextResponse.json({ ok: true, chapter: ch });
    }

    if (action === "set_title") {
      book.title = body.title || book.title;
      book.updatedAt = Date.now();
      await save();
      return NextResponse.json({ ok: true, book });
    }

    if (action === "add_character") {
      book.characters = book.characters || [];
      const ch = { id: uid(), name: body.name || "New Character", role: body.role || "", desc: body.desc || "" };
      book.characters.push(ch);
      book.updatedAt = Date.now();
      await save();
      return NextResponse.json({ ok: true, character: ch });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}
