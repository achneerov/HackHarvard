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
  db.run(`DROP TABLE IF EXISTS Merchants`);
  db.run(`DROP TABLE IF EXISTS Users`);
  db.run(`DROP TABLE IF EXISTS PendingUsers`);
  db.run(`DELETE FROM sqlite_sequence WHERE 1`, (err) => {
    // Ignore error if table doesn't exist
    if (err && !err.message.includes('no such table')) {
      console.error('Error clearing sqlite_sequence:', err);
    }
  });

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
      merchantApiKey TEXT UNIQUE NOT NULL
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
      FOREIGN KEY (merchantApiKey) REFERENCES Merchants(merchantApiKey)
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
      FOREIGN KEY (merchantApiKey) REFERENCES Merchants(merchantApiKey)
    )
  `);

  console.log("Database tables created successfully!");

  // Insert merchant
  db.run(
    `INSERT INTO Merchants (email, password, merchantApiKey) VALUES (?, ?, ?)`,
    ["merchant@gmail.com", "password123", "merchant_key_abc123"],
    function (err) {
      if (err) console.error("Error inserting merchant:", err);
      else console.log("✓ Inserted merchant");
    }
  );

  // Insert 50 users with realistic attributes
  const users = [
    ["hash001", "user1@example.com", "+1234567890", "enabled", "enabled", "enabled", null, "New York"],
    ["hash002", "user2@example.com", "+1987654321", "enabled", null, "enabled", null, "Los Angeles"],
    ["hash003", "user3@example.com", "+1555555555", null, "enabled", null, null, "Chicago"],
    ["hash004", "user4@example.com", "+1444444444", "enabled", "enabled", null, null, "Boston"],
    ["hash005", "user5@example.com", "+1666666666", null, null, "enabled", null, "Miami"],
    ["24245b52fa8a42a5410f97829bbc54eb707f8a742a4dca5bc09c84b6d0aeac73:3e1cad821309e4bb6671a868ee854b92efa568d4a3ac0c37f039429e31dee8d92e080b64ace0f81f87df7e1e6268f0948b297f801c9f7ace58f21c75b6b74c59", "renaudbernier@hotmail.fr", "+33652458849", null, null, "enabled", null, "Paris"],
    ["hash006", "sarah.johnson@gmail.com", "+14155551234", "enabled", "enabled", null, null, "San Francisco"],
    ["hash007", "michael.chen@yahoo.com", "+12125559876", null, "enabled", "enabled", null, "New York"],
    ["hash008", "emily.rodriguez@outlook.com", "+13105552341", "enabled", null, "enabled", null, "Los Angeles"],
    ["hash009", "david.kim@protonmail.com", "+17735558765", "enabled", "enabled", "enabled", null, "Chicago"],
    ["hash010", "jessica.martinez@gmail.com", "+16175554321", null, "enabled", null, null, "Boston"],
    ["hash011", "christopher.lee@hotmail.com", "+13055556789", "enabled", null, null, null, "Miami"],
    ["hash012", "amanda.wilson@gmail.com", "+12065557654", "enabled", "enabled", "enabled", null, "Seattle"],
    ["hash013", "daniel.brown@yahoo.com", "+15125558901", null, null, "enabled", null, "Austin"],
    ["hash014", "jennifer.davis@outlook.com", "+17205559012", "enabled", "enabled", null, null, "Denver"],
    ["hash015", "matthew.garcia@gmail.com", "+14045553210", null, "enabled", "enabled", null, "Atlanta"],
    ["hash016", "ashley.taylor@protonmail.com", "+16025554567", "enabled", null, "enabled", null, "Phoenix"],
    ["hash017", "joshua.anderson@hotmail.com", "+15035556543", "enabled", "enabled", null, null, "Portland"],
    ["hash018", "stephanie.thomas@gmail.com", "+17025558765", null, "enabled", null, null, "Las Vegas"],
    ["hash019", "andrew.jackson@yahoo.com", "+12155552109", "enabled", null, "enabled", null, "Philadelphia"],
    ["hash020", "melissa.white@outlook.com", "+12145559876", "enabled", "enabled", "enabled", null, "Dallas"],
    ["hash021", "ryan.harris@gmail.com", "+17135554321", null, null, "enabled", null, "Houston"],
    ["hash022", "nicole.martin@protonmail.com", "+14805557890", "enabled", "enabled", null, null, "Phoenix"],
    ["hash023", "brandon.thompson@hotmail.com", "+16195556543", "enabled", null, "enabled", null, "San Diego"],
    ["hash024", "rachel.moore@gmail.com", "+14085553210", null, "enabled", "enabled", null, "San Jose"],
    ["hash025", "kevin.lewis@yahoo.com", "+15035552109", "enabled", "enabled", null, null, "Portland"],
    ["hash026", "laura.walker@outlook.com", "+13035558901", "enabled", null, null, null, "Denver"],
    ["hash027", "jason.hall@gmail.com", "+18015557654", null, "enabled", "enabled", null, "Salt Lake City"],
    ["hash028", "kimberly.allen@protonmail.com", "+15055556789", "enabled", "enabled", "enabled", null, "Albuquerque"],
    ["hash029", "eric.young@hotmail.com", "+14155554321", "enabled", null, "enabled", null, "San Francisco"],
    ["hash030", "lisa.hernandez@gmail.com", "+17025559876", null, "enabled", null, null, "Las Vegas"],
    ["hash031", "brian.king@yahoo.com", "+16025552341", "enabled", "enabled", null, null, "Phoenix"],
    ["hash032", "karen.wright@outlook.com", "+19165558765", "enabled", null, "enabled", null, "Sacramento"],
    ["hash033", "jeffrey.lopez@gmail.com", "+13235554567", null, "enabled", "enabled", null, "Los Angeles"],
    ["hash034", "michelle.hill@protonmail.com", "+18585556543", "enabled", "enabled", null, null, "San Diego"],
    ["hash035", "gary.scott@hotmail.com", "+14805553210", "enabled", null, null, null, "Phoenix"],
    ["hash036", "donna.green@gmail.com", "+17025552109", null, "enabled", "enabled", null, "Las Vegas"],
    ["hash037", "steven.adams@yahoo.com", "+12125558901", "enabled", "enabled", "enabled", null, "New York"],
    ["hash038", "carol.baker@outlook.com", "+13105557654", "enabled", null, "enabled", null, "Los Angeles"],
    ["hash039", "joseph.nelson@gmail.com", "+17735556789", null, "enabled", null, null, "Chicago"],
    ["hash040", "sharon.carter@protonmail.com", "+16175554321", "enabled", "enabled", null, null, "Boston"],
    ["hash041", "ronald.mitchell@hotmail.com", "+13055559876", "enabled", null, "enabled", null, "Miami"],
    ["hash042", "betty.perez@gmail.com", "+12065552341", null, "enabled", "enabled", null, "Seattle"],
    ["hash043", "anthony.roberts@yahoo.com", "+15125558765", "enabled", "enabled", null, null, "Austin"],
    ["hash044", "sandra.turner@outlook.com", "+17205554567", "enabled", null, null, null, "Denver"],
    ["hash045", "mark.phillips@gmail.com", "+14045556543", null, "enabled", "enabled", null, "Atlanta"],
    ["hash046", "patricia.campbell@protonmail.com", "+16025553210", "enabled", "enabled", "enabled", null, "Phoenix"],
    ["hash047", "donald.parker@hotmail.com", "+15035552109", "enabled", null, "enabled", null, "Portland"],
    ["hash048", "dorothy.evans@gmail.com", "+17025558901", null, "enabled", null, null, "Las Vegas"],
    ["hash049", "paul.edwards@yahoo.com", "+12155557654", "enabled", "enabled", null, null, "Philadelphia"],
    ["hash050", "helen.collins@outlook.com", "+12145556789", "enabled", null, "enabled", null, "Dallas"],
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
    "New York", "Los Angeles", "Chicago", "Boston", "Miami", "Seattle", "Austin", "Denver",
    "San Francisco", "Philadelphia", "Dallas", "Houston", "San Diego", "San Jose", "Portland",
    "Las Vegas", "Atlanta", "Phoenix", "Sacramento", "Salt Lake City", "Albuquerque", "Paris"
  ];
  const userHashes = [
    "hash001", "hash002", "hash003", "hash004", "hash005", "hash006", "hash007", "hash008", "hash009", "hash010",
    "hash011", "hash012", "hash013", "hash014", "hash015", "hash016", "hash017", "hash018", "hash019", "hash020",
    "hash021", "hash022", "hash023", "hash024", "hash025", "hash026", "hash027", "hash028", "hash029", "hash030",
    "hash031", "hash032", "hash033", "hash034", "hash035", "hash036", "hash037", "hash038", "hash039", "hash040",
    "hash041", "hash042", "hash043", "hash044", "hash045", "hash046", "hash047", "hash048", "hash049", "hash050",
    "24245b52fa8a42a5410f97829bbc54eb707f8a742a4dca5bc09c84b6d0aeac73:3e1cad821309e4bb6671a868ee854b92efa568d4a3ac0c37f039429e31dee8d92e080b64ace0f81f87df7e1e6268f0948b297f801c9f7ace58f21c75b6b74c59"
  ];
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
      priority: 1,
      amount: null,
      location: "HOME_LOCATION",
      timeStart: null,
      timeEnd: null,
      condition: "NOT",
      successStatus: 0,
    },

    // High priority: Require MFA for transactions over $50,000
    {
      merchantApiKey: "merchant_key_abc123",
      priority: 2,
      amount: 50000,
      location: null,
      timeStart: null,
      timeEnd: null,
      condition: "GREATER",
      successStatus: 2,
    },

    // Medium priority: Require MFA for transactions between $1,000 - $50,000
    {
      merchantApiKey: "merchant_key_abc123",
      priority: 3,
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
      priority: 4,
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
