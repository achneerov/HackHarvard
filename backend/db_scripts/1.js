const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "../database.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Drop ALL tables
  db.run(`SELECT name FROM sqlite_master WHERE type='table'`, (err, tables) => {
    if (!err && tables) {
      tables.forEach((table) => {
        if (table.name !== "sqlite_sequence") {
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
      status INTEGER CHECK(status IN (0, 1, 2, 3)),
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

  console.log("Database tables created successfully!");

  // Insert merchant API key
  db.run(
    `INSERT INTO MerchantApiKeys (apiKey) VALUES (?)`,
    ["merchant_key_abc123"],
    function (err) {
      if (err) console.error("Error inserting merchant API key:", err);
      else console.log("✓ Inserted merchant API key");
    }
  );

  // Insert merchant
  db.run(
    `INSERT INTO Merchants (email, password, merchantApiKey) VALUES (?, ?, ?)`,
    ["merchant@gmail.com", "password123", "merchant_key_abc123"],
    function (err) {
      if (err) console.error("Error inserting merchant:", err);
      else console.log("✓ Inserted merchant");
    }
  );

  // Insert 5 users
  const users = [
    [
      "hash001",
      "user1@example.com",
      "+1234567890",
      "enabled",
      "enabled",
      "enabled",
      null,
      "New York",
    ],
    [
      "hash002",
      "user2@example.com",
      "+1987654321",
      "enabled",
      null,
      "enabled",
      null,
      "Los Angeles",
    ],
    [
      "hash003",
      "user3@example.com",
      "+1555555555",
      null,
      "enabled",
      null,
      null,
      "Chicago",
    ],
    [
      "hash004",
      "user4@example.com",
      "+1444444444",
      "enabled",
      "enabled",
      null,
      null,
      "Boston",
    ],
    [
      "hash005",
      "user5@example.com",
      "+1666666666",
      null,
      null,
      "enabled",
      null,
      "Miami",
    ],
    [
      "0866a6eaea5cb085e4cf6ef19296bf19647552dd5f96f1e530db3ae61837efe7",
      "renaudbernier@hotmail.fr",
      "+33652458849",
      null,
      null,
      "enabled",
      null,
      "Paris",
    ],
  ];

  users.forEach((user, index) => {
    db.run(
      `INSERT INTO Users (cchash, email, phone, otp, biometric, hardwareToken, authCode, signUpLocation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      user,
      function (err) {
        if (err) console.error(`Error inserting user ${index + 1}:`, err);
        else console.log(`✓ Inserted user ${index + 1}`);
      }
    );
  });

  // Insert 3000 MFA events across the last 12 months with realistic distribution
  const locations = [
    "New York",
    "Los Angeles",
    "Chicago",
    "Boston",
    "Miami",
    "Seattle",
    "Austin",
    "Denver",
  ];
  const userHashes = ["hash001", "hash002", "hash003", "hash004", "hash005"];
  const totalTransactions = 3000;

  // Generate realistic status distribution with random spikes
  // Overall: ~85% success, ~10% auth required, ~5% failed
  function getRealisticStatus(monthOffset) {
    // Base probabilities
    let successRate = 0.85;
    let authRate = 0.1;
    let failRate = 0.05;

    // Add random monthly variations (±5%)
    const monthVariation = Math.sin(monthOffset * 0.5) * 0.05;
    successRate += monthVariation;
    authRate -= monthVariation * 0.5;
    failRate -= monthVariation * 0.5;

    // Random spikes - occasional bad days
    if (Math.random() < 0.05) {
      // 5% chance of a spike
      const spikeType = Math.random();
      if (spikeType < 0.5) {
        // Auth spike
        authRate += 0.15;
        successRate -= 0.15;
      } else {
        // Failure spike
        failRate += 0.1;
        successRate -= 0.1;
      }
    }

    const rand = Math.random();
    if (rand < successRate) return 1; // SUCCESS
    if (rand < successRate + authRate) return 2; // AUTH_REQUIRED
    return 0; // FAILURE
  }

  // Generate timestamp in the last 12 months (365 days)
  function getRandomTimestamp() {
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 365); // 0-364 days ago
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    const secondsAgo = Math.floor(Math.random() * 60);

    const timestamp = new Date(now);
    timestamp.setDate(timestamp.getDate() - daysAgo);
    timestamp.setHours(timestamp.getHours() - hoursAgo);
    timestamp.setMinutes(timestamp.getMinutes() - minutesAgo);
    timestamp.setSeconds(timestamp.getSeconds() - secondsAgo);

    return {
      timestamp: timestamp.toISOString().replace("T", " ").substring(0, 19),
      daysAgo,
    };
  }

  // Generate more transactions for recent months (realistic business growth)
  const transactionsByMonth = [];
  for (let month = 0; month < 12; month++) {
    // More recent months have more transactions
    const baseCount = 200 + month * 15; // Growth over time
    const variance = Math.floor(Math.random() * 100 - 50);
    transactionsByMonth.push(Math.max(150, baseCount + variance));
  }

  let insertedCount = 0;
  for (let i = 0; i < totalTransactions; i++) {
    const cchash = userHashes[Math.floor(Math.random() * userHashes.length)];
    const amount = (Math.random() * 2000).toFixed(2);
    const location = locations[Math.floor(Math.random() * locations.length)];

    const { timestamp, daysAgo } = getRandomTimestamp();
    const monthOffset = Math.floor(daysAgo / 30);
    const status = getRealisticStatus(monthOffset);

    db.run(
      `INSERT INTO MFAEvents (cchash, transactionAmount, location, merchantApiKey, status, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)`,
      [cchash, amount, location, "merchant_key_abc123", status, timestamp],
      function (err) {
        if (err) console.error(`Error inserting MFA event ${i + 1}:`, err);
        else {
          insertedCount++;
          if (insertedCount === totalTransactions) {
            console.log(
              `✓ Inserted ${totalTransactions} MFA events across 12 months`
            );
          }
        }
      }
    );
  }

  // Insert sample rules
  const rules = [
    // Highest priority: Decline if different location than signup location
    {
      merchantApiKey: "merchant_key_abc123",
      priority: 100,
      amount: null,
      location: "HOME_LOCATION",
      timeStart: null,
      timeEnd: null,
      condition: "NOT",
      successStatus: 0,
    },

    // High priority: Decline transactions over $10,000
    {
      merchantApiKey: "merchant_key_abc123",
      priority: 10,
      amount: 10000,
      location: null,
      timeStart: null,
      timeEnd: null,
      condition: "GREATER",
      successStatus: 0,
    },

    // Medium priority: Require MFA for transactions between $1,000 - $10,000
    {
      merchantApiKey: "merchant_key_abc123",
      priority: 8,
      amount: 1000,
      location: null,
      timeStart: null,
      timeEnd: null,
      condition: "GREATER",
      successStatus: 2,
    },

    // Low priority: Accept transactions under $1,000
    {
      merchantApiKey: "merchant_key_abc123",
      priority: 5,
      amount: 1000,
      location: null,
      timeStart: null,
      timeEnd: null,
      condition: "LESS_THAN",
      successStatus: 1,
    },
  ];

  rules.forEach((rule, index) => {
    db.run(
      `INSERT INTO Rules (merchantApiKey, priority, amount, location, timeStart, timeEnd, condition, successStatus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.merchantApiKey,
        rule.priority,
        rule.amount,
        rule.location,
        rule.timeStart,
        rule.timeEnd,
        rule.condition,
        rule.successStatus,
      ],
      function (err) {
        if (err) console.error(`Error inserting rule ${index + 1}:`, err);
        else if (index === rules.length - 1)
          console.log(`✓ Inserted ${rules.length} rules`);
      }
    );
  });
});

db.close();
