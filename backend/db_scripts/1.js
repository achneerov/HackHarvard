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

  // Insert merchant API key
  db.run(`INSERT INTO MerchantApiKeys (apiKey) VALUES (?)`, ['merchant_key_abc123'], function(err) {
    if (err) console.error('Error inserting merchant API key:', err);
    else console.log('✓ Inserted merchant API key');
  });

  // Insert merchant
  db.run(`INSERT INTO Merchants (email, password, merchantApiKey) VALUES (?, ?, ?)`,
    ['merchant@gmail.com', 'password123', 'merchant_key_abc123'],
    function(err) {
      if (err) console.error('Error inserting merchant:', err);
      else console.log('✓ Inserted merchant');
    }
  );

  // Insert 5 users
  const users = [
    ['hash001', 'user1@example.com', '+1234567890', 'enabled', 'enabled', 'enabled', null, 'New York'],
    ['hash002', 'user2@example.com', '+1987654321', 'enabled', null, 'enabled', null, 'Los Angeles'],
    ['hash003', 'user3@example.com', '+1555555555', null, 'enabled', null, null, 'Chicago'],
    ['hash004', 'user4@example.com', '+1444444444', 'enabled', 'enabled', null, null, 'Boston'],
    ['hash005', 'user5@example.com', '+1666666666', null, null, 'enabled', null, 'Miami']
  ];

  users.forEach((user, index) => {
    db.run(`INSERT INTO Users (cchash, email, phone, otp, biometric, hardwareToken, authCode, signUpLocation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, user, function(err) {
      if (err) console.error(`Error inserting user ${index + 1}:`, err);
      else console.log(`✓ Inserted user ${index + 1}`);
    });
  });

  // Insert 50 MFA events
  const locations = ['New York', 'Los Angeles', 'Chicago', 'Boston', 'Miami', 'Seattle', 'Austin', 'Denver'];
  const statuses = [0, 1, 2]; // FAILURE, SUCCESS, AUTH_REQUIRED
  const userHashes = ['hash001', 'hash002', 'hash003', 'hash004', 'hash005'];

  for (let i = 0; i < 50; i++) {
    const cchash = userHashes[Math.floor(Math.random() * userHashes.length)];
    const amount = (Math.random() * 2000).toFixed(2);
    const location = locations[Math.floor(Math.random() * locations.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    db.run(`INSERT INTO MFAEvents (cchash, transactionAmount, location, merchantApiKey, status)
            VALUES (?, ?, ?, ?, ?)`,
      [cchash, amount, location, 'merchant_key_abc123', status],
      function(err) {
        if (err) console.error(`Error inserting MFA event ${i + 1}:`, err);
        else if (i === 49) console.log(`✓ Inserted 50 MFA events`);
      }
    );
  }

  // Insert sample rules
  const rules = [
    // Highest priority: Decline if different location than signup location
    { merchantApiKey: 'merchant_key_abc123', priority: 100, amount: null, location: 'HOME_LOCATION', timeStart: null, timeEnd: null, condition: 'NOT', successStatus: 0 },

    // High priority: Decline transactions over $10,000
    { merchantApiKey: 'merchant_key_abc123', priority: 10, amount: 10000, location: null, timeStart: null, timeEnd: null, condition: 'GREATER', successStatus: 0 },

    // Medium priority: Require MFA for transactions between $1,000 - $10,000
    { merchantApiKey: 'merchant_key_abc123', priority: 8, amount: 1000, location: null, timeStart: null, timeEnd: null, condition: 'GREATER', successStatus: 2 },

    // Low priority: Accept transactions under $1,000
    { merchantApiKey: 'merchant_key_abc123', priority: 5, amount: 1000, location: null, timeStart: null, timeEnd: null, condition: 'LESS_THAN', successStatus: 1 }
  ];

  rules.forEach((rule, index) => {
    db.run(`INSERT INTO Rules (merchantApiKey, priority, amount, location, timeStart, timeEnd, condition, successStatus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.merchantApiKey, rule.priority, rule.amount, rule.location, rule.timeStart, rule.timeEnd, rule.condition, rule.successStatus],
      function(err) {
        if (err) console.error(`Error inserting rule ${index + 1}:`, err);
        else if (index === rules.length - 1) console.log(`✓ Inserted ${rules.length} rules`);
      }
    );
  });
});

db.close();
