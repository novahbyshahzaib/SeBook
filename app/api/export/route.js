import { NextResponse } from "next/server";
import { bookToPlainText } from "../../../lib/store";

// Server-side export: the browser sends the book, the server formats it
// and returns it as a downloadable text file.
export async function POST(request) {
  try {
    const { book, format } = await request.json();
    if (!book || !Array.isArray(book.chapters)) {
      return NextResponse.json({ error: "Invalid book" }, { status: 400 });
    }
    const text = bookToPlainText(book);
    const safeTitle = (book.title || "book").replace(/[^\w\- ]/g, "").trim() || "book";
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}.txt"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
