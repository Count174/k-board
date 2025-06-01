const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS finances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- income / expense
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task TEXT NOT NULL,
      completed INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      target INTEGER DEFAULT 100
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      mood INTEGER,
      energy INTEGER,
      symptoms TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS nutrition (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      mealType TEXT,
      description TEXT,
      calories INTEGER
    )
  `);
});

db.close();