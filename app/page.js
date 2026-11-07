"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BOOK_TYPES } from "../lib/bookTypes";
import {
  loadBooks, saveBooks, createBook, bookWordCount, getTodayWords
} from "../lib/store";

export default function Home() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("novel");
  const [author, setAuthor] = useState("Shahzaib Muzaffar");
  const [today, setToday] = useState(0);

  useEffect(() => {
    setBooks(loadBooks());
    setToday(getTodayWords());
    setLoaded(true);
  }, []);

  const totalWords = books.reduce((n, b) => n + bookWordCount(b), 0);
  const goal = 500;
  const pct = Math.min(100, Math.round((today / goal) * 100));

  function handleCreate() {
    const book = createBook(title, type, author);
    const next = [book, ...books];
    setBooks(next);
    saveBooks(next);
    router.push(`/book/${book.id}`);
  }

  function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm("Delete this book? This cannot be undone.")) return;
    const next = books.filter((b) => b.id !== id);
    setBooks(next);
    saveBooks(next);
  }

  function handleDuplicate(id, e) {
    e.stopPropagation();
    const src = books.find((b) => b.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    copy.title = src.title + " (Copy)";
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    const next = [copy, ...books];
    setBooks(next);
    saveBooks(next);
  }

  return (
    <div>
      <header className="topbar">
        <div className="logo">Se<span>Book</span></div>
        <div className="tag">Write books of every type</div>
        <div className="spacer" />
        <button onClick={() => document.getElementById("new-title")?.focus()}>+ New Book</button>
      </header>

      <main className="wrap">
        <h1>Your library</h1>
        <p className="sub">Every book you write lives here. Pick one up, or start a new one.</p>

        <div className="goalbox">
          <div>
            <div className="big">{today} words today</div>
            <div className="lbl">Daily goal: {goal} words • {totalWords.toLocaleString()} words in all your books</div>
          </div>
          <div className="goalbar"><i style={{ width: pct + "%" }} /></div>
          <div className="lbl">{pct}% of today&rsquo;s goal</div>
        </div>

        <div className="section">
          <h2>Start a new book</h2>
          <p>Choose a type — each one comes with its own chapters, ready to write.</p>
          <div className="typegrid">
            {BOOK_TYPES.map((t) => (
              <button key={t.id} className={"typecard" + (type === t.id ? " sel" : "")} onClick={() => setType(t.id)}>
                <span className="e">{t.emoji}</span>
                <b>{t.name}</b>
                <small>{t.tagline}</small>
              </button>
            ))}
          </div>
          <div className="newbook">
            <label>Book title</label>
            <input id="new-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Last Library" />
            <label>Author</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" />
            <button className="create" onClick={handleCreate}>Create my {BOOK_TYPES.find((t) => t.id === type)?.name} →</button>
          </div>
        </div>

        <div className="section">
          <h2>My books</h2>
          {!loaded ? <p className="empty">Loading…</p> : books.length === 0 ? (
            <p className="empty">No books yet. Your first book is waiting above.</p>
          ) : (
            <div className="grid">
              {books.map((b) => {
                const words = bookWordCount(b);
                const target = Math.max(10000, (b.chapters || []).length * 1500);
                return (
                  <div key={b.id} className="bookcard" onClick={() => router.push(`/book/${b.id}`)}>
                    <button className="del" title="Delete book" onClick={(e) => handleDelete(b.id, e)}>✕</button>
                    <div className="emoji">{(BOOK_TYPES.find((t) => t.id === b.type) || {}).emoji || "📖"}</div>
                    <h3>{b.title}</h3>
                    <div className="meta">{b.typeName} • {(b.chapters || []).length} chapters • {words.toLocaleString()} words</div>
                    <div className="meta">by {b.author}</div>
                    <div className="bar"><i style={{ width: Math.min(100, Math.round((words / target) * 100)) + "%" }} /></div>
                    <div className="meta" style={{ marginTop: 6 }}>
                      <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={(e) => handleDuplicate(b.id, e)}>Duplicate</span>
                      {"  •  "}Updated {new Date(b.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">SeBook — stories and facts, written your way.</footer>
    </div>
  );
}
