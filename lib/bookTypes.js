// SeBook book types. Each type ships with its own starter structure so a
// new book never starts from a blank page.

export const BOOK_TYPES = [
  {
    id: "novel",
    name: "Novel",
    emoji: "📖",
    tagline: "A long story with chapters, characters and a full arc.",
    chapters: [
      { title: "Chapter 1 — The Beginning", outline: "Introduce the main character and their ordinary world." },
      { title: "Chapter 2 — The Call", outline: "Something changes. The character must respond." },
      { title: "Chapter 3 — The Journey", outline: "Trials, new people, and the stakes grow." },
      { title: "Chapter 4 — The Turning Point", outline: "Everything goes wrong. The hardest choice." },
      { title: "Chapter 5 — The Ending", outline: "How it resolves, and what changed forever." }
    ],
    starter:
      "<p>It was an ordinary day, until it wasn't.</p><p>Write your opening here — who is your character, where are they, and what do they want most?</p>"
  },
  {
    id: "short-story",
    name: "Short Story",
    emoji: "✨",
    tagline: "One moment, one change, one ending — short and sharp.",
    chapters: [
      { title: "The Opening", outline: "Drop the reader into the moment." },
      { title: "The Twist", outline: "The turn that changes everything." },
      { title: "The Ending", outline: "Land the last line." }
    ],
    starter:
      "<p>Begin in the middle of something. No long introductions — let the reader catch up.</p>"
  },
  {
    id: "poetry",
    name: "Poetry",
    emoji: "🖋️",
    tagline: "Poems, verses and collections, one poem per chapter.",
    chapters: [
      { title: "Poem 1", outline: "What feeling does this poem hold?" },
      { title: "Poem 2", outline: "" },
      { title: "Poem 3", outline: "" }
    ],
    starter:
      "<p>Write your poem here — one line at a time, like breathing.</p>"
  },
  {
    id: "non-fiction",
    name: "Non-Fiction",
    emoji: "📚",
    tagline: "Real facts, real knowledge, written clearly.",
    chapters: [
      { title: "Chapter 1 — The Big Idea", outline: "What is this book teaching, and why does it matter?" },
      { title: "Chapter 2 — The Evidence", outline: "Facts, examples and stories that prove it." },
      { title: "Chapter 3 — How To Use It", outline: "Steps the reader can follow." },
      { title: "Chapter 4 — Conclusion", outline: "The one thing the reader must remember." }
    ],
    starter:
      "<p>State your big idea in one clear sentence. Then prove it.</p>"
  },
  {
    id: "children",
    name: "Children's Book",
    emoji: "🧒",
    tagline: "Simple words, big heart, a lesson in every story.",
    chapters: [
      { title: "Once Upon a Time", outline: "Meet the hero and their world." },
      { title: "The Adventure", outline: "The fun and the trouble." },
      { title: "The Lesson", outline: "What the hero learns — and the happy ending." }
    ],
    starter:
      "<p>Once upon a time, in a place not far from here, there lived...</p>"
  },
  {
    id: "biography",
    name: "Biography",
    emoji: "👤",
    tagline: "A real person's life, told as a story.",
    chapters: [
      { title: "Chapter 1 — Early Life", outline: "Where they came from." },
      { title: "Chapter 2 — The Struggle", outline: "What stood in their way." },
      { title: "Chapter 3 — The Rise", outline: "How they made their mark." },
      { title: "Chapter 4 — Legacy", outline: "What they left behind." }
    ],
    starter: "<p>Every great life begins somewhere small. Start at the beginning.</p>"
  },
  {
    id: "fantasy",
    name: "Fantasy",
    emoji: "🐉",
    tagline: "Magic, new worlds, quests and creatures.",
    chapters: [
      { title: "Chapter 1 — The World", outline: "Show the magic and its rules." },
      { title: "Chapter 2 — The Quest", outline: "The mission begins." },
      { title: "Chapter 3 — The Battle", outline: "The darkest hour." },
      { title: "Chapter 4 — The Return", outline: "The world, changed." }
    ],
    starter:
      "<p>The map said the mountains were empty. The map was wrong.</p>"
  },
  {
    id: "mystery",
    name: "Mystery",
    emoji: "🔍",
    tagline: "Clues, suspects, and a truth waiting to be found.",
    chapters: [
      { title: "Chapter 1 — The Crime", outline: "What happened, and who found it." },
      { title: "Chapter 2 — The Clues", outline: "What does not add up." },
      { title: "Chapter 3 — The Suspects", outline: "Everyone has a secret." },
      { title: "Chapter 4 — The Reveal", outline: "The truth, at last." }
    ],
    starter:
      "<p>Nobody heard the door open. That was the first clue.</p>"
  },
  {
    id: "romance",
    name: "Romance",
    emoji: "❤️",
    tagline: "Two hearts, one story, and everything in between.",
    chapters: [
      { title: "Chapter 1 — The Meeting", outline: "How they meet — and why it matters." },
      { title: "Chapter 2 — The Spark", outline: "What pulls them together." },
      { title: "Chapter 3 — The Distance", outline: "What keeps them apart." },
      { title: "Chapter 4 — The Choice", outline: "Love, chosen on purpose." }
    ],
    starter: "<p>They met on the worst day of the year. It was the best thing that happened.</p>"
  },
  {
    id: "self-help",
    name: "Self-Help",
    emoji: "🌱",
    tagline: "Help the reader change one thing for the better.",
    chapters: [
      { title: "Chapter 1 — The Problem", outline: "Name the pain honestly." },
      { title: "Chapter 2 — The Shift", outline: "The new way of seeing it." },
      { title: "Chapter 3 — The Practice", outline: "Daily steps that work." },
      { title: "Chapter 4 — Your New Life", outline: "What changes when you keep going." }
    ],
    starter:
      "<p>Start with the reader's problem — the one they feel right now.</p>"
  },
  {
    id: "screenplay",
    name: "Screenplay",
    emoji: "🎬",
    tagline: "Scenes, dialogue and action — written for the screen.",
    chapters: [
      { title: "Scene 1 — Opening", outline: "Where and when. Who is on screen." },
      { title: "Scene 2 — Conflict", outline: "What the characters want, clashing." },
      { title: "Scene 3 — Climax", outline: "The scene everything builds to." },
      { title: "Scene 4 — Ending", outline: "The final image." }
    ],
    starter:
      "<p>INT. SOMEWHERE — DAY</p><p>A character enters. What do they want?</p>"
  },
  {
    id: "journal",
    name: "Journal",
    emoji: "📓",
    tagline: "Your days, thoughts and memories, kept as a book.",
    chapters: [
      { title: "Day 1", outline: "How today felt." },
      { title: "Day 2", outline: "" },
      { title: "Day 3", outline: "" }
    ],
    starter: "<p>Today I...</p>"
  }
];

export function getBookType(id) {
  return BOOK_TYPES.find((t) => t.id === id) || BOOK_TYPES[0];
}
