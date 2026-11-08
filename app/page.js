"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Library, PenLine, Target, Plus, Copy, KeyRound,
  RefreshCw, Trash2, Files, Clock
} from "lucide-react";
import { BOOK_TYPES } from "../lib/bookTypes";
import { TypeIcon } from "../lib/icons";
import {
  loadBooks, saveBooks, createBook, bookWordCount, getTodayWords,
  getIntegrationKey, generateIntegrationKey, clearIntegrationKey,
  isIntegrationEnabled, setIntegrationEnabled, getLastSynced,
  pushBooksToCloud, pullBooksFromCloud, readingMinutes
} from "../lib/store";

export default function Home() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("novel");
  const [author, setAuthor] = useState("Shahzaib Muzaffar");
  const [today, setToday] = useState(0);
  const [intKey, setIntKey] = useState("");
  const [intEnabled, setIntEnabled] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSynced, setLastSynced] = useState(0);

  useEffect(() => {
    setBooks(loadBooks());
    setToday(getTodayWords());
    setIntKey(getIntegrationKey());
    setIntEnabled(isIntegrationEnabled());
    setLastSynced(getLastSynced());
    setLoaded(true);
    if (isIntegrationEnabled()) {
      pullBooksFromCloud().then((r) => {
        if (r.changed) setBooks(loadBooks());
        setLastSynced(getLastSynced());
      }).catch(() => {});
    }
  }, []);

  const totalWords = books.reduce((n, b) => n + bookWordCount(b), 0);
  const totalChapters = books.reduce((n, b) => n + (b.chapters || []).length, 0);
  const goal = 500;
  const pct = Math.min(100, Math.round((today / goal) * 100));
  const selectedType = BOOK_TYPES.find((t) => t.id === type);

  // The exact message to paste into your AI — it teaches the AI how
  // SeBook's integration works (the address, the key, and every command),
  // so it can read and write your books. The key is already filled in.
  function integrationMessage() {
    const k = intKey;
    return `SeBook is my book-writing app at https://sebook.vercel.app. It has a Muse Integration: with my key, you can read and write my books through its API. My integration key is: ${k}

To see my books, POST JSON to https://sebook.vercel.app/api/integration/write with {"key": "${k}", "action": "list_books"}. To read one book fully, use {"key": "${k}", "action": "get_book", "bookId": "BOOK_ID"}.
To write, POST to the same address:
- New book: {"key": "${k}", "action": "create_book", "title": "...", "type": "novel", "author": "..."}
- New chapter: {"key": "${k}", "action": "create_chapter", "bookId": "...", "title": "...", "content": "..."}
- Rewrite a chapter: {"key": "${k}", "action": "set_chapter", "bookId": "...", "chapterId": "...", "content": "..."}
- Add text to a chapter: {"key": "${k}", "action": "append_chapter", "bookId": "...", "chapterId": "...", "text": "..."}
- Rename the book: {"key": "${k}", "action": "set_title", "bookId": "...", "title": "..."}
- Add a character: {"key": "${k}", "action": "add_character", "bookId": "...", "name": "...", "role": "...", "desc": "..."}
Content can be plain text or HTML. After you write, tell me to open SeBook or tap Sync now to see it.`;
  }

  function handleCreate() {
    const book = createBook(title, type, author);
    const next = [book, ...books];
    setBooks(next);
    saveBooks(next);
    pushBooksToCloud().catch(() => {});
    router.push(`/book/${book.id}`);
  }

  function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm("Delete this book? This cannot be undone.")) return;
    const next = books.filter((b) => b.id !== id);
    setBooks(next);
    saveBooks(next);
    pushBooksToCloud().catch(() => {});
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
    pushBooksToCloud().catch(() => {});
  }

  async function syncNow() {
    setSyncMsg("Syncing…");
    try {
      const pulled = await pullBooksFromCloud();
      if (pulled.changed) setBooks(loadBooks());
      const pushed = await pushBooksToCloud();
      setLastSynced(getLastSynced());
      setSyncMsg(pushed.ok ? "Synced just now." : "Sync failed — check your connection and try again.");
    } catch {
      setSyncMsg("Sync failed — check your connection and try again.");
    }
  }

  return (
    <div>
      <header className="topbar">
        <div className="logo">Se<em>Book</em></div>
        <div className="tag">Write books of every type</div>
        <div className="spacer" />
        <button className="btn btn-gold" onClick={() => document.getElementById("new-title")?.focus()}>
          <Plus size={16} /> New Book
        </button>
      </header>

      <main className="wrap">
        <div className="pagehead">
          <h1>Your library</h1>
          <p className="sub">Every book you write lives here. Pick one up, or start a new one.</p>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="ic"><Library size={20} /></div>
            <div><div className="num">{books.length}</div><div className="lbl">Books</div></div>
          </div>
          <div className="stat">
            <div className="ic"><PenLine size={20} /></div>
            <div><div className="num">{totalWords.toLocaleString()}</div><div className="lbl">Words written</div></div>
          </div>
          <div className="stat">
            <div className="ic"><Clock size={20} /></div>
            <div><div className="num">~{readingMinutes(totalWords)} min</div><div className="lbl">Reading time</div></div>
          </div>
        </div>

        <div className="goalcard">
          <div>
            <div className="big">{today} words today</div>
            <div className="lbl">Daily goal: {goal} words · {totalChapters} chapters across your books</div>
          </div>
          <div className="goalbar"><i style={{ width: pct + "%" }} /></div>
          <div className="lbl">{pct}% of today&rsquo;s goal</div>
        </div>

        <div className="section">
          <h2>Start a new book</h2>
          <p className="hint">Choose a type — each one comes with its own chapters, ready to write.</p>
          <div className="typegrid">
            {BOOK_TYPES.map((t) => (
              <button key={t.id} className={"typecard" + (type === t.id ? " sel" : "")} onClick={() => setType(t.id)}>
                <span className="ic"><TypeIcon name={t.icon} size={19} /></span>
                <span><b>{t.name}</b><small>{t.tagline}</small></span>
              </button>
            ))}
          </div>
          <div className="panel">
            <div className="field">
              <label>Book title</label>
              <input id="new-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Last Library" />
              <label>Author</label>
              <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" />
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn btn-bronze" onClick={handleCreate}>
                <Plus size={16} /> Create my {selectedType?.name}
              </button>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>My books</h2>
          {!loaded ? <p className="empty">Loading…</p> : books.length === 0 ? (
            <p className="empty">No books yet. Your first book is waiting above.</p>
          ) : (
            <div className="grid">
              {books.map((b, i) => {
                const words = bookWordCount(b);
                const target = Math.max(10000, (b.chapters || []).length * 1500);
                const typeInfo = BOOK_TYPES.find((t) => t.id === b.type);
                return (
                  <div key={b.id} className="bookcard" onClick={() => router.push(`/book/${b.id}`)}>
                    <div className={`cover cover-${i % 6}`}>
                      <div className="ctype"><TypeIcon name={typeInfo?.icon || "BookOpen"} size={13} /> {b.typeName}</div>
                      <div className="ctitle">{b.title}</div>
                      <div className="cauthor">{b.author}</div>
                    </div>
                    <div className="bookbody">
                      <div className="bookmeta">
                        <span>{(b.chapters || []).length} chapters</span>·<span>{words.toLocaleString()} words</span>·<span>~{readingMinutes(words)} min</span>
                      </div>
                      <div className="progress"><i style={{ width: Math.min(100, Math.round((words / target) * 100)) + "%" }} /></div>
                      <div className="bookactions">
                        <button className="iconbtn" onClick={(e) => { e.stopPropagation(); router.push(`/book/${b.id}`); }}>
                          <BookOpen size={14} /> Open
                        </button>
                        <button className="iconbtn" onClick={(e) => handleDuplicate(b.id, e)}>
                          <Files size={14} /> Duplicate
                        </button>
                        <button className="iconbtn danger" onClick={(e) => handleDelete(b.id, e)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                      <div className="bookmeta">Updated {new Date(b.updatedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="section">
          <h2>Muse Integration</h2>
          <p className="hint">Let Muse write in this app for you. Turn it on, copy your key, and give the key to Muse in chat. Then you can say “write Chapter 2 of my book” here, and Muse will write it straight into SeBook. The key is the only protection — keep it private like a password.</p>
          <div className="panel">
            <div className="introw">
              <button className="btn btn-bronze" onClick={() => {
                const key = intKey || generateIntegrationKey();
                setIntKey(key);
                setShowKey(true);
                setIntegrationEnabled(true);
                setIntEnabled(true);
                syncNow();
              }}>
                <KeyRound size={15} /> {intKey ? "Show my key" : "Generate my key"}
              </button>
              {intKey && (
                <>
                  <button className="btn btn-light" onClick={() => {
                    const next = !intEnabled;
                    setIntegrationEnabled(next);
                    setIntEnabled(next);
                    if (next) syncNow();
                  }}>{intEnabled ? "Turn off" : "Turn on"}</button>
                  <button className="btn btn-light" onClick={syncNow}><RefreshCw size={15} /> Sync now</button>
                  <button className="btn btn-danger" onClick={() => {
                    if (!window.confirm("Remove the key? Muse will no longer be able to write in this app until you make a new one.")) return;
                    clearIntegrationKey();
                    setIntKey("");
                    setIntEnabled(false);
                    setShowKey(false);
                  }}><Trash2 size={15} /> Remove key</button>
                </>
              )}
            </div>
            {intKey && showKey && (
              <div className="keyrow">
                <input className="input input-mono" readOnly value={intKey} onFocus={(e) => e.target.select()} />
                <button className="btn btn-light" onClick={() => { navigator.clipboard?.writeText(intKey); setSyncMsg("Key copied. Paste it to Muse in chat."); }}>
                  <Copy size={15} /> Copy
                </button>
              </div>
            )}
            <p className="intstatus">
              Status: <b>{intEnabled ? "On — Muse can write here." : intKey ? "Off — key exists but Muse cannot write until you turn it on." : "Off — no key yet."}</b>
              {lastSynced > 0 && <> Last synced {new Date(lastSynced).toLocaleTimeString()}.</>}
              {syncMsg && <> {syncMsg}</>}
            </p>
            <p className="intstatus">When this is on, a copy of your books is also kept in SeBook&rsquo;s private cloud so Muse and this app can see the same books. Turn it off any time to stop that.</p>
            {intKey && (
              <>
                <h3 className="inthead">What to paste in your AI</h3>
                <p className="intstatus">Copy this whole message and paste it into your Muse chat. It tells your AI how SeBook works, so it can read and write your books. This message already has your key inside it — keep it private, like a password.</p>
                <textarea className="intmsg" readOnly value={integrationMessage()} onFocus={(e) => e.target.select()} />
                <div className="introw" style={{ marginTop: 10 }}>
                  <button className="btn btn-bronze" onClick={() => { navigator.clipboard?.writeText(integrationMessage()); setSyncMsg("Instructions copied — paste them into your Muse chat."); }}>
                    <Copy size={15} /> Copy the message for your AI
                  </button>
                </div>
                <h3 className="inthead">What your AI will do after you paste it</h3>
                <ul className="intsteps">
                  <li>It will be able to see your books and read any chapter.</li>
                  <li>You can ask it to write a chapter, a whole story, or add characters — it writes straight into SeBook.</li>
                  <li>After it writes, it will tell you to open SeBook or tap Sync now, and the new writing will be there.</li>
                </ul>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="footer">SeBook — stories and facts, written your way.</footer>
    </div>
  );
}
