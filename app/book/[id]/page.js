"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  loadBooks, saveBooks, countWords, bookWordCount, readingMinutes,
  getTodayWords, addTodayWords, bookToMarkdown,
  isIntegrationEnabled, pushBooksToCloud, pullBooksFromCloud
} from "../../../lib/store";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function BookPage() {
  const router = useRouter();
  const params = useParams();
  const [book, setBook] = useState(null);
  const [chapterId, setChapterId] = useState(null);
  const [tab, setTab] = useState("write");
  const [focus, setFocus] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [search, setSearch] = useState("");
  const [today, setToday] = useState(0);
  const editorRef = useRef(null);
  const lastCountRef = useRef(0);
  const pushTimerRef = useRef(null);

  useEffect(() => {
    const books = loadBooks();
    const found = books.find((b) => b.id === params.id);
    if (!found) { router.push("/"); return; }
    setBook(found);
    setChapterId(found.chapters?.[0]?.id || null);
    lastCountRef.current = bookWordCount(found);
    setToday(getTodayWords());
    if (isIntegrationEnabled()) {
      pullBooksFromCloud().then((r) => {
        if (r.changed) {
          const fresh = loadBooks().find((b) => b.id === params.id);
          if (fresh) setBook(fresh);
        }
      }).catch(() => {});
    }
  }, [params.id]);

  const chapter = useMemo(
    () => (book?.chapters || []).find((c) => c.id === chapterId) || null,
    [book, chapterId]
  );
  const totalWords = book ? bookWordCount(book) : 0;
  const chapterWords = chapter ? countWords(chapter.content || "") : 0;

  function persist(next) {
    next.updatedAt = Date.now();
    setBook(next);
    const books = loadBooks().map((b) => (b.id === next.id ? next : b));
    saveBooks(books);
    setSavedAt(new Date());
    // If the Muse Integration is on, sync the change to the cloud a
    // couple of seconds after the writer stops typing.
    if (isIntegrationEnabled()) {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushBooksToCloud().catch(() => {});
      }, 2000);
    }
  }

  function updateBook(fn) {
    if (!book) return;
    const next = JSON.parse(JSON.stringify(book));
    fn(next);
    persist(next);
  }

  function onEditorInput() {
    if (!editorRef.current || !chapter) return;
    const html = editorRef.current.innerHTML;
    const now = countWords(html);
    const before = countWords(chapter.content || "");
    if (now > before) addTodayWords(now - before);
    setToday(getTodayWords());
    updateBook((next) => {
      const ch = next.chapters.find((c) => c.id === chapter.id);
      if (ch) ch.content = html;
    });
  }

  function exec(cmd, value = null) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    onEditorInput();
  }

  function addChapter() {
    updateBook((next) => {
      const n = next.chapters.length + 1;
      const id = uid();
      next.chapters.push({ id, title: `Chapter ${n}`, outline: "", content: "", notes: "" });
      setChapterId(id);
    });
  }

  function moveChapter(id, dir) {
    updateBook((next) => {
      const i = next.chapters.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= next.chapters.length) return;
      const [c] = next.chapters.splice(i, 1);
      next.chapters.splice(j, 0, c);
    });
  }

  function deleteChapter(id) {
    if (!window.confirm("Delete this chapter?")) return;
    updateBook((next) => {
      next.chapters = next.chapters.filter((c) => c.id !== id);
      if (chapterId === id) setChapterId(next.chapters[0]?.id || null);
    });
  }

  function renameChapter(id, title) {
    updateBook((next) => {
      const ch = next.chapters.find((c) => c.id === id);
      if (ch) ch.title = title;
    });
  }

  function setOutline(text) {
    updateBook((next) => {
      const ch = next.chapters.find((c) => c.id === chapterId);
      if (ch) ch.outline = text;
    });
  }

  function setNotes(text) {
    updateBook((next) => { next.notes = text; });
  }

  function addCharacter() {
    updateBook((next) => {
      next.characters.push({ id: uid(), name: "New Character", role: "", desc: "" });
    });
  }

  function updateCharacter(id, field, value) {
    updateBook((next) => {
      const ch = next.characters.find((c) => c.id === id);
      if (ch) ch[field] = value;
    });
  }

  function deleteCharacter(id) {
    updateBook((next) => {
      next.characters = next.characters.filter((c) => c.id !== id);
    });
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportTxt() {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, format: "txt" })
    });
    const text = await res.text();
    download(`${book.title.replace(/[^\w\- ]/g, "") || "book"}.txt`, text, "text/plain");
  }

  function exportMd() {
    download(`${book.title.replace(/[^\w\- ]/g, "") || "book"}.md`, bookToMarkdown(book), "text/markdown");
  }

  const searchHits = useMemo(() => {
    if (!search.trim() || !book) return [];
    const q = search.toLowerCase();
    return book.chapters.filter((c) =>
      (c.title + " " + (c.content || "").replace(/<[^>]*>/g, " ")).toLowerCase().includes(q)
    );
  }, [search, book]);

  if (!book) return <div style={{ padding: 40, fontStyle: "italic" }}>Opening your book…</div>;

  const goalPct = Math.min(100, Math.round((today / (book.goal || 500)) * 100));

  return (
    <div>
      <header className="topbar no-print">
        <button onClick={() => router.push("/")} style={{ background: "none", border: "1px solid #57534e", color: "#faf7f2", padding: "8px 14px", borderRadius: 999 }}>← Library</button>
        <div>
          <div style={{ fontSize: 19, fontWeight: "bold" }}>{book.title}</div>
          <div style={{ fontSize: 12, color: "#d6d3d1" }}>{book.typeName} • by {book.author} • {totalWords.toLocaleString()} words • ~{readingMinutes(totalWords)} min read</div>
        </div>
        <div className="spacer" />
        <span style={{ fontSize: 13, color: savedAt ? "#a7f3d0" : "#d6d3d1" }}>{savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Autosave on"}</span>
        <button onClick={() => setFocus(!focus)}>{focus ? "Exit Focus" : "Focus Mode"}</button>
      </header>

      <div className="workspace">
        {!focus && (
          <aside className="side no-print">
            <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this book…" />
            {search.trim() ? (
              <div>
                <div className="sidehead">Found in {searchHits.length} chapter(s)</div>
                {searchHits.map((c) => (
                  <div key={c.id} className="chap" onClick={() => { setChapterId(c.id); setSearch(""); setTab("write"); }}>{c.title}</div>
                ))}
                {searchHits.length === 0 && <div className="sidehead">Nothing found.</div>}
              </div>
            ) : (
              <>
                <div className="sidehead">Chapters</div>
                {(book.chapters || []).map((c) => (
                  <div key={c.id} className={"chap" + (c.id === chapterId ? " active" : "")} onClick={() => { setChapterId(c.id); setTab("write"); }}>
                    <span>{c.title}</span>
                    <span className="chapwords">{countWords(c.content || "").toLocaleString()}w</span>
                  </div>
                ))}
                <button className="addchap" onClick={addChapter}>+ Add chapter</button>
                <div className="sidehead" style={{ marginTop: 18 }}>Daily goal</div>
                <div className="goalmini">
                  <div>{today} / {book.goal || 500} words today — {goalPct}%</div>
                  <div className="goalbar" style={{ background: "#e8e2d9", marginTop: 6 }}><i style={{ width: goalPct + "%", background: "#b45309" }} /></div>
                  <label style={{ fontSize: 12, color: "#6b645c" }}>Goal (words/day)
                    <input type="number" value={book.goal || 500} min="50" step="50" style={{ width: "100%", padding: 8, marginTop: 4, borderRadius: 8, border: "1px solid #e8e2d9" }}
                      onChange={(e) => updateBook((n) => { n.goal = parseInt(e.target.value || "500", 10); })} />
                  </label>
                </div>
                <div className="sidehead" style={{ marginTop: 18 }}>Export</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="toolbtn" onClick={exportTxt}>Download as Text (.txt)</button>
                  <button className="toolbtn" onClick={exportMd}>Download as Markdown (.md)</button>
                  <button className="toolbtn" onClick={() => window.print()}>Print / Save as PDF</button>
                </div>
              </>
            )}
          </aside>
        )}

        <main className="editor">
          <div className="tabs no-print">
            {["write", "outline", "characters", "notes"].map((t) => (
              <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                {t === "write" ? "✍️ Write" : t === "outline" ? "🗺️ Outline" : t === "characters" ? "👥 Characters" : "📝 Notes"}
              </button>
            ))}
            <span className="tabmeta">{chapterWords.toLocaleString()} words in this chapter</span>
          </div>

          {tab === "write" && chapter && (
            <>
              <div className="chaptitle no-print">
                <input value={chapter.title} onChange={(e) => renameChapter(chapter.id, e.target.value)} />
                <button onClick={() => moveChapter(chapter.id, -1)} title="Move up">↑</button>
                <button onClick={() => moveChapter(chapter.id, 1)} title="Move down">↓</button>
                <button onClick={() => deleteChapter(chapter.id)} title="Delete chapter" style={{ color: "#b91c1c" }}>Delete</button>
              </div>
              <div className="toolbar no-print">
                <button onClick={() => exec("bold")}><b>B</b></button>
                <button onClick={() => exec("italic")}><i>I</i></button>
                <button onClick={() => exec("underline")}><u>U</u></button>
                <button onClick={() => exec("formatBlock", "h1")}>H1</button>
                <button onClick={() => exec("formatBlock", "h2")}>H2</button>
                <button onClick={() => exec("insertUnorderedList")}>• List</button>
                <button onClick={() => exec("insertOrderedList")}>1. List</button>
                <button onClick={() => exec("formatBlock", "blockquote")}>❝ Quote</button>
                <button onClick={() => exec("removeFormat")}>Clear format</button>
              </div>
              <div
                key={chapter.id}
                ref={editorRef}
                className="editarea"
                contentEditable
                suppressContentEditableWarning
                onInput={onEditorInput}
                dangerouslySetInnerHTML={{ __html: chapter.content || "" }}
              />
              <p className="hint no-print">Tip: everything saves automatically as you type. Use Focus Mode to hide everything else and just write.</p>
            </>
          )}

          {tab === "outline" && (
            <div className="panel">
              <h2>Outline — {chapter?.title || "no chapter"}</h2>
              <p>What happens in this chapter? Write the beats of the story here.</p>
              <textarea value={chapter?.outline || ""} onChange={(e) => setOutline(e.target.value)} placeholder="1. …&#10;2. …&#10;3. …" />
              <h3 style={{ marginTop: 20 }}>All chapters at a glance</h3>
              {(book.chapters || []).map((c) => (
                <div key={c.id} className="outlineRow" onClick={() => setChapterId(c.id)}>
                  <b>{c.title}</b>
                  <span>{c.outline || "No outline yet."}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "characters" && (
            <div className="panel">
              <h2>Characters</h2>
              <p>Keep every person in your book in one place.</p>
              <button className="toolbtn" onClick={addCharacter} style={{ margin: "10px 0 16px" }}>+ Add character</button>
              {(book.characters || []).length === 0 && <p style={{ color: "#6b645c", fontStyle: "italic" }}>No characters yet.</p>}
              <div className="chgrid">
                {(book.characters || []).map((c) => (
                  <div key={c.id} className="charcard">
                    <input value={c.name} onChange={(e) => updateCharacter(c.id, "name", e.target.value)} placeholder="Name" style={{ fontWeight: "bold", fontSize: 17 }} />
                    <input value={c.role} onChange={(e) => updateCharacter(c.id, "role", e.target.value)} placeholder="Role (hero, villain, friend…)" />
                    <textarea value={c.desc} onChange={(e) => updateCharacter(c.id, "desc", e.target.value)} placeholder="Who are they? What do they want? What are they afraid of?" />
                    <button onClick={() => deleteCharacter(c.id)} style={{ color: "#b91c1c", background: "none", border: "none", alignSelf: "flex-start" }}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "notes" && (
            <div className="panel">
              <h2>Research &amp; notes</h2>
              <p>Facts, ideas, links and scraps for this book. Everything you gather while writing.</p>
              <textarea value={book.notes || ""} onChange={(e) => setNotes(e.target.value)} placeholder="Paste facts, links, ideas here…" style={{ minHeight: 300 }} />
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .workspace { display: flex; max-width: 1200px; margin: 0 auto; min-height: 70vh; }
        .side { width: 280px; flex-shrink: 0; padding: 20px 16px; border-right: 1px solid var(--line); }
        .search { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; background: #fff; }
        .sidehead { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin: 16px 0 8px; }
        .chap { display: flex; justify-content: space-between; gap: 8px; padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 14.5px; }
        .chap:hover { background: #f1ebe1; }
        .chap.active { background: var(--accent-soft); font-weight: bold; }
        .chapwords { color: var(--muted); font-size: 12px; white-space: nowrap; }
        .addchap { width: 100%; margin-top: 10px; padding: 9px; border: 1px dashed var(--line); background: none; border-radius: 10px; color: var(--accent); font-weight: bold; }
        .goalmini { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px; font-size: 13.5px; }
        .toolbtn { background: #fff; border: 1px solid var(--line); padding: 9px 12px; border-radius: 10px; text-align: left; font-size: 14px; }
        .toolbtn:hover { border-color: var(--accent); }
        .editor { flex: 1; padding: 20px 28px 60px; min-width: 0; }
        .tabs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
        .tabs button { background: none; border: 1px solid var(--line); padding: 8px 14px; border-radius: 999px; font-size: 14px; }
        .tabs button.active { background: #1c1a17; color: #faf7f2; border-color: #1c1a17; }
        .tabmeta { margin-left: auto; color: var(--muted); font-size: 13px; font-style: italic; }
        .chaptitle { display: flex; gap: 8px; margin-bottom: 12px; }
        .chaptitle input { flex: 1; font-size: 24px; font-weight: bold; border: none; background: transparent; border-bottom: 2px solid var(--line); padding: 4px 2px; }
        .chaptitle input:focus { outline: none; border-color: var(--accent); }
        .chaptitle button { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; }
        .toolbar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
        .toolbar button { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 7px 11px; font-size: 14px; }
        .toolbar button:hover { border-color: var(--accent); }
        .editarea { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 28px 30px; min-height: 55vh; font-size: 18px; line-height: 1.85; outline: none; }
        .editarea h1 { font-size: 30px; margin: 10px 0; }
        .editarea h2 { font-size: 24px; margin: 10px 0; }
        .editarea blockquote { border-left: 3px solid var(--accent); margin: 12px 0; padding-left: 14px; font-style: italic; color: var(--muted); }
        .hint { color: var(--muted); font-size: 13px; font-style: italic; margin-top: 10px; }
        .panel h2 { font-size: 24px; margin-bottom: 4px; }
        .panel p { color: var(--muted); font-size: 14px; margin-bottom: 10px; }
        .panel textarea { width: 100%; min-height: 160px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; font-size: 15px; line-height: 1.7; background: #fff; }
        .outlineRow { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-top: 8px; cursor: pointer; }
        .outlineRow b { display: block; margin-bottom: 2px; }
        .outlineRow span { color: var(--muted); font-size: 13.5px; }
        .chgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
        .charcard { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .charcard input, .charcard textarea { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-size: 14px; width: 100%; }
        .charcard textarea { min-height: 90px; }
        @media (max-width: 760px) {
          .workspace { flex-direction: column; }
          .side { width: 100%; border-right: none; border-bottom: 1px solid var(--line); }
          .editor { padding: 16px; }
          .editarea { padding: 18px; font-size: 16px; }
        }
      `}</style>
    </div>
  );
}
