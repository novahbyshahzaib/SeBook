# SeBook

**SeBook — write books of every type, with all the tools a writer needs.**

A full-stack web app for writing books. Pick a book type, get a ready-made
structure for it, and write chapter by chapter with a rich editor, outline,
characters, notes, goals and export — everything in one place.

## Book types

Novel, Short Story, Poetry, Non-Fiction, Children's Book, Biography,
Fantasy, Mystery, Romance, Self-Help, Screenplay, Journal — each with its
own starter chapters and structure.

## Tools included

- **Rich text editor** — bold, italic, underline, headings, lists, quotes
- **Chapters** — add, rename, delete and reorder chapters
- **Outline** — plot points for every chapter
- **Characters** — character cards with role and description
- **Research notes** — a notes space per book
- **Word count** — live per-chapter and whole-book counts, reading time
- **Daily goal** — set a words-per-day goal and watch the bar fill
- **Focus mode** — distraction-free writing
- **Search** — find any word across the whole book
- **Export** — download as text or Markdown, or print to PDF
- **Autosave** — every word is saved on your device as you type

## How it works

Your books are saved in your own browser (local storage), so your writing
stays on your device. The app is a Next.js full-stack app: the editor and
library run in the browser, and the server (`/api/export`) formats and
serves your finished book as a downloadable file.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy

Deploy to Vercel from this repository. No environment variables needed.
