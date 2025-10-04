const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Drop existing tables
  db.run(`DROP TABLE IF EXISTS Rules`);
  db.run(`DROP TABLE IF EXISTS MFAEvents`);
  db.run(`DROP TABLE IF EXISTS MerchantApiKeys`);
  db.run(`DROP TABLE IF EXISTS Users`);

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS Users (
      cchash TEXT PRIMARY KEY,
      email TEXT,
      phone TEXT,
      otp TEXT,
      biometric TEXT,
      hardwareToken TEXT,
      authCode TEXT
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
