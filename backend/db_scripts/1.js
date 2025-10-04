const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Drop existing tables
  db.run(`DROP TABLE IF EXISTS Rules`);
  db.run(`DROP TABLE IF EXISTS Attempts`);
  db.run(`DROP TABLE IF EXISTS MerchantApiKey`);
  db.run(`DROP TABLE IF EXISTS Users`);

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS Users (
      cchash TEXT PRIMARY KEY,
      email TEXT,
      phone TEXT,
      otp TEXT,
      biometric TEXT,
      HardwareToken TEXT
    )
  `);

  // MerchantApiKey table
  db.run(`
    CREATE TABLE IF NOT EXISTS MerchantApiKey (
      MerchantApiKey TEXT PRIMARY KEY
    )
  `);

  // Attempts table
  db.run(`
    CREATE TABLE IF NOT EXISTS Attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cchash TEXT,
      transaction_amount REAL,
      location TEXT,
      merchantapikey TEXT,
      status INTEGER CHECK(status IN (0, 1, 2)),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cchash) REFERENCES Users(cchash),
      FOREIGN KEY (merchantapikey) REFERENCES MerchantApiKey(MerchantApiKey)
    )
  `);

  // Rules table
  db.run(`
    CREATE TABLE IF NOT EXISTS Rules (
      rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchantapikey TEXT,
      priority INTEGER DEFAULT 0,
      amount REAL,
      location TEXT,
      time_start TEXT,
      time_end TEXT,
      condition TEXT CHECK(condition IN ('EQUAL', 'GREATER', 'LESS_THAN', 'NOT', 'IS')),
      success_status INTEGER CHECK(success_status IN (0, 1, 2)),
      FOREIGN KEY (merchantapikey) REFERENCES MerchantApiKey(MerchantApiKey)
    )
  `);

  console.log('Database tables created successfully!');
});

db.close();
