const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Drop ALL tables
  db.run(`SELECT name FROM sqlite_master WHERE type='table'`, (err, tables) => {
    if (!err && tables) {
      tables.forEach(table => {
        if (table.name !== 'sqlite_sequence') {
          db.run(`DROP TABLE IF EXISTS ${table.name}`);
        }
      });
    }
  });

  db.run(`DROP TABLE IF EXISTS Rules`);
  db.run(`DROP TABLE IF EXISTS MFAEvents`);
  db.run(`DROP TABLE IF EXISTS MerchantApiKeys`);
  db.run(`DROP TABLE IF EXISTS Merchants`);
  db.run(`DROP TABLE IF EXISTS Users`);
  db.run(`DELETE FROM sqlite_sequence`);

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS Users (
      cchash TEXT PRIMARY KEY,
      email TEXT,
      phone TEXT,
      otp TEXT,
      biometric TEXT,
      hardwareToken TEXT,
      authCode TEXT,
      signUpLocation TEXT
    )
  `);

  // Merchants table
  db.run(`
    CREATE TABLE IF NOT EXISTS Merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      merchantApiKey TEXT UNIQUE,
      FOREIGN KEY (merchantApiKey) REFERENCES MerchantApiKeys(apiKey)
    )
  `);

  // MerchantApiKeys table
  db.run(`
    CREATE TABLE IF NOT EXISTS MerchantApiKeys (
      apiKey TEXT PRIMARY KEY
    )
  `);

  // MFAEvents table
  db.run(`
    CREATE TABLE IF NOT EXISTS MFAEvents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cchash TEXT,
      transactionAmount REAL,
      location TEXT,
      merchantApiKey TEXT,
      status INTEGER CHECK(status IN (0, 1, 2)),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cchash) REFERENCES Users(cchash),
      FOREIGN KEY (merchantApiKey) REFERENCES MerchantApiKeys(apiKey)
    )
  `);

  // Rules table
  db.run(`
    CREATE TABLE IF NOT EXISTS Rules (
      ruleId INTEGER PRIMARY KEY AUTOINCREMENT,
      merchantApiKey TEXT,
      priority INTEGER DEFAULT 0,
      amount REAL,
      location TEXT,
      timeStart TEXT,
      timeEnd TEXT,
      condition TEXT CHECK(condition IN ('EQUAL', 'GREATER', 'LESS_THAN', 'NOT', 'IS')),
      successStatus INTEGER CHECK(successStatus IN (0, 1, 2)),
      FOREIGN KEY (merchantApiKey) REFERENCES MerchantApiKeys(apiKey)
    )
  `);

  console.log('Database tables created successfully!');
});

db.close();
