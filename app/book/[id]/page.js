"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, BookOpen, Pencil, Eye, Maximize, Minimize, Plus,
  ChevronUp, ChevronDown, Trash2, Download, Printer, FileText,
  Lightbulb, BarChart3, Target, Clock, Menu, X, ChevronLeft, ChevronRight,
  PenLine, Map, Users, StickyNote, ListOrdered, Volume2, Play, Pause, Square
} from "lucide-react";
import {
  loadBooks, saveBooks, countWords, bookWordCount, readingMinutes,
  getTodayWords, addTodayWords, bookToMarkdown, extractFacts, htmlToText,
  isIntegrationEnabled, pushBooksToCloud, pullBooksFromCloud
} from "../../../lib/store";
import { ReadAloud, VOICES, DEFAULT_VOICE } from "../../../lib/readAloud";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function BookPage() {
  const router = useRouter();
  const params = useParams();
  const [book, setBook] = useState(null);
  const [chapterId, setChapterId] = useState(null);
  const [tab, setTab] = useState("write");
  const [mode, setMode] = useState("read");
  const [focus, setFocus] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [search, setSearch] = useState("");
  const [today, setToday] = useState(0);
  const editorRef = useRef(null);
  const pushTimerRef = useRef(null);
  // Read-aloud (Kokoro — a real open-source voice, not the system voice).
  const readerRef = useRef(null);
  const [listenState, setListenState] = useState("idle"); // idle | loading | reading | paused | done | error
  const [listenDetail, setListenDetail] = useState("");
  const [listenProg, setListenProg] = useState({ index: 0, total: 0, fraction: 0 });
  const [voice, setVoice] = useState(() => {
    try { return localStorage.getItem("sebook-voice") || DEFAULT_VOICE; } catch { return DEFAULT_VOICE; }
  });
  const [speed, setSpeed] = useState(() => {
    try { return parseFloat(localStorage.getItem("sebook-speed") || "1") || 1; } catch { return 1; }
  });

  useEffect(() => {
    const books = loadBooks();
    const found = books.find((b) => b.id === params.id);
    if (!found) { router.push("/"); return; }
    setBook(found);
    setChapterId(found.chapters?.[0]?.id || null);
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
  const chapterIndex = (book?.chapters || []).findIndex((c) => c.id === chapterId);
  const totalWords = book ? bookWordCount(book) : 0;
  const chapterWords = chapter ? countWords(chapter.content || "") : 0;
  const facts = useMemo(() => extractFacts(chapter?.content || ""), [chapter]);
  const maxChapterWords = Math.max(1, ...(book?.chapters || []).map((c) => countWords(c.content || "")));
  const progressPct = totalWords > 0 ? Math.round((chapterWords / totalWords) * 100) : 0;
  const goalPct = Math.min(100, Math.round((today / (book?.goal || 500)) * 100));

  function persist(next) {
    next.updatedAt = Date.now();
    setBook(next);
    const books = loadBooks().map((b) => (b.id === next.id ? next : b));
    saveBooks(books);
    setSavedAt(new Date());
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

  // Stop the voice when the chapter changes, when switching to Edit,
  // or when leaving the page.
  useEffect(() => {
    stopListen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, mode]);
  useEffect(() => () => { try { readerRef.current?.stop(); } catch {} }, []);

  function getReader() {
    if (!readerRef.current) {
      readerRef.current = new ReadAloud();
      readerRef.current.setCallbacks({
        onStatus: (s, detail) => { setListenState(s); setListenDetail(detail); },
        onProgress: (p) => setListenProg(p)
      });
    }
    return readerRef.current;
  }

  function startListen() {
    if (!chapter) return;
    const reader = getReader();
    setListenState("loading");
    setListenDetail("Starting the voice…");
    reader.start(htmlToText(chapter.content || ""), { voice, speed });
  }

  function stopListen() {
    try { readerRef.current?.stop(); } catch {}
    setListenState("idle");
    setListenDetail("");
    setListenProg({ index: 0, total: 0, fraction: 0 });
  }

  function toggleListenPause() {
    const reader = readerRef.current;
    if (!reader) return;
    if (listenState === "paused") reader.resume();
    else reader.pause();
  }

  function changeVoice(v) {
    setVoice(v);
    try { localStorage.setItem("sebook-voice", v); } catch {}
    readerRef.current?.setVoice(v);
  }

  function changeSpeed(n) {
    setSpeed(n);
    try { localStorage.setItem("sebook-speed", String(n)); } catch {}
    readerRef.current?.setSpeed(n);
  }

  function goChapter(dir) {
    const list = book?.chapters || [];
    const next = list[chapterIndex + dir];
    if (next) { setChapterId(next.id); window.scrollTo({ top: 0 }); }
  }

  const searchHits = useMemo(() => {
    if (!search.trim() || !book) return [];
    const q = search.toLowerCase();
    return book.chapters.filter((c) =>
      (c.title + " " + (c.content || "").replace(/<[^>]*>/g, " ")).toLowerCase().includes(q)
    );
  }, [search, book]);

  if (!book) return <div style={{ padding: 40, fontStyle: "italic" }}>Opening your book…</div>;

  const editing = mode === "edit";

  // Shared visual cards: shown beside the page on desktop, and as a
  // condensed strip under the page on mobile (read mode only).
  const factCard = chapter ? (
    <div className="inscard factcard">
      <h3><Lightbulb size={14} /> The fact hidden in this chapter</h3>
      {facts.length > 0 ? (
        facts.map((f, i) => <p key={i}>{f}</p>)
      ) : (
        <p>Every chapter of this book hides one true fact inside the story. This chapter does not have one yet — write one in, and it will appear here.</p>
      )}
      <div className="src">From “{chapter.title}” — story first, fact inside.</div>
    </div>
  ) : null;

  const chartCard = chapter ? (
    <div className="inscard">
      <h3><BarChart3 size={14} /> Chapter lengths</h3>
      <div className="chartbar">
        {(book.chapters || []).map((c) => {
          const w = countWords(c.content || "");
          return (
            <div key={c.id} className={"col" + (c.id === chapterId ? " cur" : "")} onClick={() => setChapterId(c.id)} style={{ cursor: "pointer" }} title={`${c.title} — ${w.toLocaleString()} words`}>
              <div className="bar" style={{ height: Math.max(6, Math.round((w / maxChapterWords) * 64)) + "px" }} />
              <div className="clbl">{c.title.replace(/^Chapter \d+ — /, "").slice(0, 10) || "Ch"}</div>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className={editing ? "mode-edit" : "mode-read"}>
      <header className="wtop">
        {editing ? (
          <>
            <button className="navtoggle" onClick={() => setNavOpen(true)}><Menu size={16} /> Chapters</button>
            <button className="back" onClick={() => router.push("/")}><ArrowLeft size={15} /> Library</button>
            <div className="title">
              <h1>{book.title}</h1>
              <div className="meta">{book.typeName} · by {book.author} · {totalWords.toLocaleString()} words · ~{readingMinutes(totalWords)} min</div>
            </div>
            <div className="spacer" />
            {savedAt && <span className="saved">Saved {savedAt.toLocaleTimeString()}</span>}
            <div className="segmented">
              <button className={mode === "read" ? "active" : ""} onClick={() => setMode("read")}>
                <Eye size={14} /> <span className="seg-label">Read</span>
              </button>
              <button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>
                <Pencil size={14} /> <span className="seg-label">Edit</span>
              </button>
            </div>
            <button className="back" onClick={() => setFocus(!focus)}>
              {focus ? <Minimize size={15} /> : <Maximize size={15} />} {focus ? "Exit" : "Focus"}
            </button>
          </>
        ) : (
          <>
            <button className="back" onClick={() => router.push("/")} title="Library"><ChevronLeft size={15} /></button>
            <div className="title">
              <h1>{book.title}</h1>
              <div className="meta">{book.typeName} · by {book.author} · {totalWords.toLocaleString()} words · ~{readingMinutes(totalWords)} min</div>
            </div>
            <div className="spacer" />
            <button className="btn btn-dark" onClick={() => setMode("edit")}><Pencil size={14} /> Edit</button>
          </>
        )}
      </header>

      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <div className="wlayout">
        {!focus && (
          <aside className={"side" + (navOpen ? " open" : "")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>Contents</span>
              <button className="iconbtn close" onClick={() => setNavOpen(false)}><X size={14} /> Close</button>
            </div>
            <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this book…" />
            {search.trim() ? (
              <div>
                <div className="sidehead">Found in {searchHits.length} chapter{searchHits.length === 1 ? "" : "s"}</div>
                {searchHits.map((c) => (
                  <div key={c.id} className="chap" onClick={() => { setChapterId(c.id); setSearch(""); setNavOpen(false); }}>
                    <span>{c.title}</span>
                  </div>
                ))}
                {searchHits.length === 0 && <div className="sidehead">Nothing found.</div>}
              </div>
            ) : (
              <>
                <div className="sidehead"><span>Chapters</span><span>{(book.chapters || []).length}</span></div>
                {(book.chapters || []).map((c) => (
                  <div key={c.id} className={"chap" + (c.id === chapterId ? " active" : "")} onClick={() => { setChapterId(c.id); setNavOpen(false); }}>
                    <span>{c.title}</span>
                    <span className="cw">{countWords(c.content || "").toLocaleString()}w</span>
                  </div>
                ))}
                {editing && <button className="addchap" onClick={addChapter}><Plus size={15} /> Add chapter</button>}

                <div className="sidehead">Daily goal</div>
                <div className="sidecard">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b>{today} / {book.goal || 500} words</b><span>{goalPct}%</span>
                  </div>
                  <div className="prog"><i style={{ width: goalPct + "%" }} /></div>
                  {editing ? (
                    <div className="row" style={{ marginTop: 8 }}>
                      <span>Goal (words/day)</span>
                      <input type="number" value={book.goal || 500} min="50" step="50" style={{ width: 84, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--line)" }}
                        onChange={(e) => updateBook((n) => { n.goal = parseInt(e.target.value || "500", 10); })} />
                    </div>
                  ) : (
                    <div className="row"><span>Today&rsquo;s goal</span><b>{book.goal || 500} words</b></div>
                  )}
                </div>

                <div className="sidehead">Export</div>
                <div className="exportbtns">
                  <button className="iconbtn" onClick={exportTxt}><Download size={14} /> Text (.txt)</button>
                  <button className="iconbtn" onClick={exportMd}><FileText size={14} /> Markdown (.md)</button>
                  <button className="iconbtn" onClick={() => window.print()}><Printer size={14} /> Print / Save as PDF</button>
                </div>
              </>
            )}
          </aside>
        )}

        <main className="maincol">
          {editing && (
            <div className="tabs no-print">
              {[
                { id: "write", label: "Write", icon: PenLine },
                { id: "outline", label: "Outline", icon: Map },
                { id: "characters", label: "Characters", icon: Users },
                { id: "notes", label: "Notes", icon: StickyNote }
              ].map((t) => (
                <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
              <span className="tabmeta">{chapterWords.toLocaleString()} words in this chapter</span>
            </div>
          )}

          {!editing && chapter && (
            <>
              <div className="listenbar no-print">
                {listenState === "idle" ? (
                  <>
                    <button className="btn btn-dark" onClick={startListen}>
                      <Volume2 size={16} /> Listen to this chapter
                    </button>
                    <span className="listen-note">Read aloud by a real voice (Kokoro, open source) — not the phone&rsquo;s robot voice. First listen downloads the voice once (about 45 MB), then it plays instantly.</span>
                  </>
                ) : (
                  <div className="listen-controls">
                    <button className="btn btn-dark" onClick={toggleListenPause} disabled={listenState === "loading" || listenState === "error"}>
                      {listenState === "paused" ? <><Play size={15} /> Resume</> : <><Pause size={15} /> Pause</>}
                    </button>
                    <button className="btn btn-light" onClick={stopListen}><Square size={14} /> Stop</button>
                    <div className="listen-mid">
                      <div className="listen-status">{listenDetail || "Reading…"}</div>
                      {listenProg.total > 0 && (
                        <>
                          <div className="lprog"><i style={{ width: Math.round(listenProg.fraction * 100) + "%" }} /></div>
                          <div className="listen-status">Part {Math.min(listenProg.index + 1, listenProg.total)} of {listenProg.total}</div>
                        </>
                      )}
                    </div>
                    <label className="listen-pick">
                      Voice
                      <select value={voice} onChange={(e) => changeVoice(e.target.value)}>
                        {VOICES.map((v) => (
                          <option key={v.id} value={v.id}>{v.label} — {v.desc}</option>
                        ))}
                      </select>
                    </label>
                    <label className="listen-pick">
                      Speed
                      <select value={String(speed)} onChange={(e) => changeSpeed(parseFloat(e.target.value))}>
                        <option value="0.75">0.75×</option>
                        <option value="1">1×</option>
                        <option value="1.25">1.25×</option>
                        <option value="1.5">1.5×</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
              <article className="page">
                <div className="kicker">{book.typeName} · Chapter {chapterIndex + 1} of {(book.chapters || []).length}</div>
                <h2>{chapter.title}</h2>
                <div className="byline">{book.title} — by {book.author}</div>
                <div className="ornament">✦</div>
                <div className="readbody" dangerouslySetInnerHTML={{ __html: chapter.content || "<p>This chapter is empty. Switch to Edit to write it.</p>" }} />
              </article>
              <div className="pager no-print">
                <button className="btn btn-light" disabled={chapterIndex <= 0} onClick={() => goChapter(-1)}>
                  <ChevronLeft size={15} /> Previous
                </button>
                <button className="btn btn-dark" disabled={chapterIndex >= (book.chapters || []).length - 1} onClick={() => goChapter(1)}>
                  Next <ChevronRight size={15} />
                </button>
              </div>
              <div className="mvisuals no-print">
                {factCard}
                {chartCard}
              </div>
            </>
          )}

          {editing && tab === "write" && chapter && (
            <>
              <div className="chaptitle no-print">
                <input className="input" value={chapter.title} onChange={(e) => renameChapter(chapter.id, e.target.value)} />
                <button className="iconbtn" onClick={() => moveChapter(chapter.id, -1)} title="Move up"><ChevronUp size={15} /></button>
                <button className="iconbtn" onClick={() => moveChapter(chapter.id, 1)} title="Move down"><ChevronDown size={15} /></button>
                <button className="iconbtn danger" onClick={() => deleteChapter(chapter.id)} title="Delete chapter"><Trash2 size={15} /></button>
              </div>
              <div className="toolbar no-print">
                <button onClick={() => exec("bold")} title="Bold"><b>B</b></button>
                <button onClick={() => exec("italic")} title="Italic"><i>I</i></button>
                <button onClick={() => exec("underline")} title="Underline"><u>U</u></button>
                <span className="sep" />
                <button onClick={() => exec("formatBlock", "h1")}>H1</button>
                <button onClick={() => exec("formatBlock", "h2")}>H2</button>
                <span className="sep" />
                <button onClick={() => exec("insertUnorderedList")}>Bullet list</button>
                <button onClick={() => exec("insertOrderedList")}>Numbered list</button>
                <button onClick={() => exec("formatBlock", "blockquote")}>Quote</button>
                <span className="sep" />
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
              <p className="hint no-print">Everything saves automatically as you type. Switch back to Read to see the finished page.</p>
            </>
          )}

          {editing && tab === "outline" && (
            <div className="panel">
              <h2>Outline — {chapter?.title || "no chapter"}</h2>
              <p>What happens in this chapter? Write the beats of the story here.</p>
              <textarea value={chapter?.outline || ""} onChange={(e) => setOutline(e.target.value)} placeholder={"1. …\n2. …\n3. …"} />
              <h3 style={{ marginTop: 22, fontFamily: "var(--font-display)", fontSize: 19 }}>All chapters at a glance</h3>
              {(book.chapters || []).map((c) => (
                <div key={c.id} className="outlineRow" onClick={() => setChapterId(c.id)}>
                  <b>{c.title}</b>
                  <span>{c.outline || "No outline yet."}</span>
                </div>
              ))}
            </div>
          )}

          {editing && tab === "characters" && (
            <div className="panel">
              <h2>Characters</h2>
              <p>Keep every person in your book in one place.</p>
              <button className="btn btn-bronze btn-sm" onClick={addCharacter} style={{ margin: "10px 0 16px" }}><Plus size={14} /> Add character</button>
              {(book.characters || []).length === 0 && <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No characters yet.</p>}
              <div className="chgrid">
                {(book.characters || []).map((c) => (
                  <div key={c.id} className="charcard">
                    <input value={c.name} onChange={(e) => updateCharacter(c.id, "name", e.target.value)} placeholder="Name" style={{ fontWeight: "bold", fontSize: 16 }} />
                    <input value={c.role} onChange={(e) => updateCharacter(c.id, "role", e.target.value)} placeholder="Role (hero, villain, friend…)" />
                    <textarea value={c.desc} onChange={(e) => updateCharacter(c.id, "desc", e.target.value)} placeholder="Who are they? What do they want? What are they afraid of?" />
                    <button onClick={() => deleteCharacter(c.id)} style={{ color: "var(--red)", background: "none", border: "none", alignSelf: "flex-start", fontSize: 13, fontWeight: 600 }}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editing && tab === "notes" && (
            <div className="panel">
              <h2>Research &amp; notes</h2>
              <p>Facts, ideas, links and scraps for this book. Everything you gather while writing.</p>
              <textarea value={book.notes || ""} onChange={(e) => setNotes(e.target.value)} placeholder="Paste facts, links, ideas here…" style={{ minHeight: 300 }} />
            </div>
          )}
        </main>

        {!focus && chapter && (
          <aside className="insights">
            {factCard}

            {chartCard}

            <div className="inscard">
              <h3><Target size={14} /> Reading this book</h3>
              <div className="kv"><span>This chapter</span><b>{chapterWords.toLocaleString()} words</b></div>
              <div className="kv"><span>Whole book</span><b>{totalWords.toLocaleString()} words</b></div>
              <div className="kv"><span>Reading time left</span><b>~{readingMinutes(totalWords - chapterWords)} min</b></div>
              <div className="kv"><span>Chapter progress</span><b>{progressPct}% of the book</b></div>
              <div className="prog"><i style={{ width: progressPct + "%" }} /></div>
              <div className="kv" style={{ marginTop: 8 }}><span><Clock size={13} /> Today&rsquo;s goal</span><b>{today} / {book.goal || 500} words</b></div>
            </div>

            <div className="inscard">
              <h3><ListOrdered size={14} /> In this book</h3>
              {(book.chapters || []).map((c, i) => (
                <div key={c.id} className="kv" onClick={() => setChapterId(c.id)} style={{ cursor: "pointer" }}>
                  <span>{i + 1}. {c.title}</span><b>{countWords(c.content || "").toLocaleString()}w</b>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
