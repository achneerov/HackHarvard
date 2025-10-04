const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

// Ensure pending user table exists for onboarding flows
db.run(`
  CREATE TABLE IF NOT EXISTS PendingUsers (
    cchash TEXT PRIMARY KEY,
    email TEXT,
    phone TEXT,
    authCode TEXT,
    location TEXT,
    merchantApiKey TEXT,
    verified INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Auth method mapping
const AUTH_METHODS = {
  email: 1,
  phone: 2,
  otp: 3,
  biometric: 4,
  hardwareToken: 5,
};

// Status codes
const STATUS = {
  FAILURE: 0,
  SUCCESS: 1,
  AUTH_REQUIRED: 2,
  SIGN_UP_REQUIRED: 3,
};

// Helper function to get enabled auth methods for a user
function getEnabledAuthMethods(user) {
  const enabledMethods = [];

  if (user.email) enabledMethods.push(AUTH_METHODS.email);
  if (user.phone) enabledMethods.push(AUTH_METHODS.phone);
  if (user.otp) enabledMethods.push(AUTH_METHODS.otp);
  if (user.biometric) enabledMethods.push(AUTH_METHODS.biometric);
  if (user.hardwareToken) enabledMethods.push(AUTH_METHODS.hardwareToken);

  return enabledMethods;
}

// Helper function to log MFA events
function logMFAEvent(
  cchash,
  transactionAmount,
  location,
  merchantApiKey,
  status
) {
  const allowedStatuses = new Set([
    STATUS.FAILURE,
    STATUS.SUCCESS,
    STATUS.AUTH_REQUIRED,
  ]);
  let persistedStatus = status;

  if (!allowedStatuses.has(status)) {
    persistedStatus =
      status === STATUS.SIGN_UP_REQUIRED
        ? STATUS.AUTH_REQUIRED
        : STATUS.FAILURE;
    console.warn(
      "[AuthPay] logMFAEvent received unsupported status. Coercing value.",
      {
        requestedStatus: status,
        persistedStatus,
        cchash,
        merchantApiKey,
      }
    );
  }

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO MFAEvents (cchash, transactionAmount, location, merchantApiKey, status)
       VALUES (?, ?, ?, ?, ?)`,
      [cchash, transactionAmount, location, merchantApiKey, persistedStatus],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// Helper function to evaluate transaction rules
function evaluateRules(
  merchantApiKey,
  amount,
  location,
  timestamp,
  userHomeLocation
) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM Rules WHERE merchantApiKey = ? ORDER BY priority DESC`,
      [merchantApiKey],
      (err, rules) => {
        if (err) {
          reject(err);
          return;
        }

        // If no rules, default to AUTH_REQUIRED
        if (!rules || rules.length === 0) {
          resolve(STATUS.AUTH_REQUIRED);
          return;
        }

        // Evaluate each rule by priority
        for (const rule of rules) {
          let conditionMet = true;

          // Check amount condition (only if amount is specified in rule)
          if (rule.amount !== null && rule.amount !== undefined) {
            switch (rule.condition) {
              case "EQUAL":
                conditionMet = conditionMet && amount === rule.amount;
                break;
              case "GREATER":
                conditionMet = conditionMet && amount > rule.amount;
                break;
              case "LESS_THAN":
                conditionMet = conditionMet && amount < rule.amount;
                break;
              case "NOT":
                conditionMet = conditionMet && amount !== rule.amount;
                break;
              case "IS":
                conditionMet = conditionMet && amount === rule.amount;
                break;
            }
          }

          // Check location condition (only if location is specified in rule)
          if (rule.location) {
            // Special handling for HOME_LOCATION
            const checkLocation =
              rule.location === "HOME_LOCATION"
                ? userHomeLocation
                : rule.location;

            if (rule.condition === "IS") {
              conditionMet = conditionMet && location === checkLocation;
            } else if (rule.condition === "NOT") {
              conditionMet = conditionMet && location !== checkLocation;
            }
          }

          // Check time window
          if (rule.timeStart && rule.timeEnd) {
            const currentTime = new Date(timestamp)
              .toTimeString()
              .split(" ")[0];
            conditionMet =
              conditionMet &&
              currentTime >= rule.timeStart &&
              currentTime <= rule.timeEnd;
          }

          // If condition is met, return the rule's success status
          if (conditionMet) {
            resolve(rule.successStatus);
            return;
          }
        }

        // If no rules matched, default to AUTH_REQUIRED
        resolve(STATUS.AUTH_REQUIRED);
      }
    );
  });
}

// Endpoint 1: Process Transaction
app.post("/api/processTransaction", async (req, res) => {
  const { hashCC, amount, location, merchantApiKey, emailAddress } = req.body;

  try {
    // Validate merchant API key
    const merchantExists = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM MerchantApiKeys WHERE apiKey = ?",
        [merchantApiKey],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!merchantExists) {
      console.warn("[AuthPay] processTransaction denied: invalid merchant", {
        merchantApiKey,
        hashCC,
        amount,
        location,
      });
      await logMFAEvent(
        hashCC,
        amount,
        location,
        merchantApiKey,
        STATUS.FAILURE
      );
      return res.json({
        status: STATUS.FAILURE,
        message: "Invalid merchant API key",
      });
    }

    // Check if user exists
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM Users WHERE cchash = ?", [hashCC], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      console.warn("[AuthPay] processTransaction denied: user not found", {
        merchantApiKey,
        hashCC,
        amount,
        location,
      });
      await logMFAEvent(
        hashCC,
        amount,
        location,
        merchantApiKey,
        STATUS.SIGN_UP_REQUIRED
      );
      return res.json({
        status: STATUS.SIGN_UP_REQUIRED,
        message: "User not found - sign up required",
      });
    }

    // Evaluate transaction rules
    const ruleStatus = await evaluateRules(
      merchantApiKey,
      amount,
      location,
      new Date(),
      user.signUpLocation
    );

    await logMFAEvent(hashCC, amount, location, merchantApiKey, ruleStatus);

    if (ruleStatus === STATUS.SUCCESS) {
      console.log("[AuthPay] processTransaction approved", {
        merchantApiKey,
        hashCC,
        amount,
        location,
      });
      return res.json({
        status: STATUS.SUCCESS,
        message: "Transaction approved",
      });
    } else if (ruleStatus === STATUS.AUTH_REQUIRED) {
      const authMethods = getEnabledAuthMethods(user);
      console.log("[AuthPay] processTransaction requires additional auth", {
        merchantApiKey,
        hashCC,
        amount,
        location,
        authMethods,
      });
      return res.json({
        status: STATUS.AUTH_REQUIRED,
        message: "Authentication required",
        authMethods,
      });
    } else {
      console.warn("[AuthPay] processTransaction denied by rules", {
        merchantApiKey,
        hashCC,
        amount,
        location,
        userSignUpLocation: user.signUpLocation,
      });
      return res.json({
        status: STATUS.FAILURE,
        message: "Transaction denied",
      });
    }
  } catch (error) {
    console.error("Error in processTransaction:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 2: Request Code
app.post("/api/requestCode", async (req, res) => {
  const { hashCC, authMode, email, phone, merchantApiKey, location } = req.body;

  try {
    // Get user
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM Users WHERE cchash = ?", [hashCC], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    if (user) {
      // Update user's authCode for existing profiles
      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE Users SET authCode = ? WHERE cchash = ?",
          [code, hashCC],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Send code via selected auth method
      console.log(
        `[AUTH CODE] User: ${hashCC}, Method: ${authMode}, Code: ${code}`
      );

      switch (authMode) {
        case AUTH_METHODS.email:
          console.log(`[EMAIL] Sending code to ${user.email}: ${code}`);
          try {
            const msg = {
              to: user.email,
              from: "Veritas@mystaticsite.com",
              subject: "Your AuthPay Verification Code",
              text: `Your verification code is: ${code}`,
              html: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>AuthPay Verification</h2>
                <p>Your verification code is:</p>
                <h1 style="color: #4F46E5; letter-spacing: 5px;">${code}</h1>
                <p>This code will expire in 10 minutes.</p>
                <p style="color: #6B7280; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
              </div>
            `,
            };
            await sgMail.send(msg);
            console.log(`[EMAIL] Successfully sent code to ${user.email}`);
          } catch (emailError) {
            console.error(`[EMAIL] Failed to send email:`, emailError);
            // Don't fail the request if email fails, code is still stored
          }
          break;

        case AUTH_METHODS.phone:
          console.log(`[SMS] Sending code to ${user.phone}: ${code}`);
          // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
          break;

        case AUTH_METHODS.otp:
          console.log(
            `[OTP] User should use authenticator app for: ${user.email}`
          );
          // TODO: OTP apps generate their own codes using TOTP algorithm
          break;

        case AUTH_METHODS.biometric:
          console.log(
            `[BIOMETRIC] Requesting biometric auth for: ${user.email}`
          );
          // TODO: Trigger biometric verification on user's device
          break;

        case AUTH_METHODS.hardwareToken:
          console.log(
            `[HARDWARE TOKEN] User should use hardware token for: ${user.email}`
          );
          // TODO: Hardware tokens generate their own codes
          break;

        default:
          console.log(
            `[UNKNOWN AUTH METHOD] Method ${authMode} not recognized`
          );
          break;
      }

      console.log(
        `[AUTH CODE] User: ${hashCC}, Method: ${authMode}, Code: ${code}`
      );

      return res.json({
        status: STATUS.SUCCESS,
        message: "Code sent successfully",
        // Remove in production - only for testing
        debug_code: code,
      });
    }

    if (!email || !phone) {
      return res.json({
        status: STATUS.FAILURE,
        message: "Sign-up requires both email and phone number",
      });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO PendingUsers (cchash, email, phone, authCode, location, merchantApiKey, verified, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
         ON CONFLICT(cchash) DO UPDATE SET
           email = excluded.email,
           phone = excluded.phone,
           authCode = excluded.authCode,
           location = excluded.location,
           merchantApiKey = excluded.merchantApiKey,
           verified = 0,
           createdAt = CURRENT_TIMESTAMP`,
        [hashCC, email, phone, code, location || null, merchantApiKey || null],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(
      `[AUTH CODE][SIGNUP] Pending user: ${hashCC}, Method: ${authMode}, Code: ${code}`
    );

    res.json({
      status: STATUS.SUCCESS,
      message: "Sign-up code sent successfully",
      debug_code: code,
    });
  } catch (error) {
    console.error("Error in requestCode:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 3: Verify MFA
app.post("/api/verifyMFA", async (req, res) => {
  const { hashCC, code } = req.body;

  try {
    // Get user with stored auth code
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM Users WHERE cchash = ?", [hashCC], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      // Check pending sign-ups
      const pendingUser = await new Promise((resolve, reject) => {
        db.get(
          "SELECT * FROM PendingUsers WHERE cchash = ?",
          [hashCC],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!pendingUser) {
        return res.json({ status: STATUS.FAILURE, message: "User not found" });
      }

      if (!pendingUser.authCode) {
        return res.json({
          status: STATUS.FAILURE,
          message: "No code generated",
        });
      }

      if (pendingUser.authCode === code) {
        await new Promise((resolve, reject) => {
          db.run(
            "UPDATE PendingUsers SET authCode = NULL, verified = 1 WHERE cchash = ?",
            [hashCC],
            function (err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        return res.json({
          status: STATUS.SUCCESS,
          message: "Authentication successful",
          pendingSignup: true,
        });
      }

      return res.json({
        status: STATUS.AUTH_REQUIRED,
        message: "Invalid code",
      });
    }

    if (!user.authCode) {
      return res.json({ status: STATUS.FAILURE, message: "No code generated" });
    }

    // Compare codes
    if (user.authCode === code) {
      // Clear the auth code after successful verification
      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE Users SET authCode = NULL WHERE cchash = ?",
          [hashCC],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({
        status: STATUS.SUCCESS,
        message: "Authentication successful",
      });
    } else {
      res.json({ status: STATUS.AUTH_REQUIRED, message: "Invalid code" });
    }
  } catch (error) {
    console.error("Error in verifyMFA:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 4: Register User After Sign-Up Verification
app.post("/api/registerUser", async (req, res) => {
  const { hashCC, email, phone, location, merchantApiKey, amount } = req.body;

  if (!hashCC || !email || !phone || !merchantApiKey || amount == null) {
    return res.json({
      status: STATUS.FAILURE,
      message: "Missing required registration details",
    });
  }

  try {
    const merchantExists = await new Promise((resolve, reject) => {
      db.get(
        "SELECT 1 FROM MerchantApiKeys WHERE apiKey = ?",
        [merchantApiKey],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!merchantExists) {
      return res.json({
        status: STATUS.FAILURE,
        message: "Invalid merchant API key",
      });
    }

    const existingUser = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM Users WHERE cchash = ?", [hashCC], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const pendingUser = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM PendingUsers WHERE cchash = ?",
        [hashCC],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!existingUser && !pendingUser) {
      return res.json({
        status: STATUS.FAILURE,
        message: "No pending registration found",
      });
    }

    if (!existingUser && pendingUser && !pendingUser.verified) {
      return res.json({
        status: STATUS.FAILURE,
        message: "Verification code not confirmed yet",
      });
    }

    const resolvedLocation =
      location || pendingUser?.location || existingUser?.signUpLocation || null;

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO Users (cchash, email, phone, otp, biometric, hardwareToken, authCode, signUpLocation)
         VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?)
         ON CONFLICT(cchash) DO UPDATE SET
           email = excluded.email,
           phone = excluded.phone,
           signUpLocation = excluded.signUpLocation`,
        [hashCC, email, phone, resolvedLocation],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    const userRecord = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM Users WHERE cchash = ?", [hashCC], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const numericAmount =
      typeof amount === "number" ? amount : parseFloat(amount);
    if (Number.isNaN(numericAmount)) {
      return res.json({ status: STATUS.FAILURE, message: "Invalid amount" });
    }
    const transactionLocation = resolvedLocation;
    const userHomeLocation = userRecord?.signUpLocation || resolvedLocation;

    const ruleStatus = await evaluateRules(
      merchantApiKey,
      numericAmount,
      transactionLocation,
      new Date(),
      userHomeLocation
    );

    await logMFAEvent(
      hashCC,
      numericAmount,
      transactionLocation,
      merchantApiKey,
      ruleStatus
    );

    if (pendingUser) {
      await new Promise((resolve, reject) => {
        db.run(
          "DELETE FROM PendingUsers WHERE cchash = ?",
          [hashCC],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    if (ruleStatus === STATUS.FAILURE) {
      console.warn("[AuthPay] registerUser denied by rules", {
        merchantApiKey,
        hashCC,
        amount: numericAmount,
        location: transactionLocation,
      });
      return res.json({
        status: STATUS.FAILURE,
        message: "Transaction denied",
      });
    }

    console.log("[AuthPay] registerUser approved", {
      merchantApiKey,
      hashCC,
      amount: numericAmount,
      location: transactionLocation,
    });

    res.json({
      status: STATUS.SUCCESS,
      message: "User registered and transaction approved",
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 5: Merchant Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Get merchant by email
    const merchant = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM Merchants WHERE email = ?", [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!merchant) {
      return res.json({
        status: STATUS.FAILURE,
        message: "Invalid credentials",
      });
    }

    // Check password (in production, use bcrypt for hashed passwords)
    if (merchant.password === password) {
      res.json({
        status: STATUS.SUCCESS,
        message: "Login successful",
        merchantApiKey: merchant.merchantApiKey,
        email: merchant.email,
      });
    } else {
      res.json({ status: STATUS.FAILURE, message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error in login:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 6: Get Rules
app.get("/api/rules", async (req, res) => {
  const { merchantApiKey } = req.query;

  try {
    if (!merchantApiKey) {
      return res
        .status(400)
        .json({ status: STATUS.FAILURE, message: "Merchant API key required" });
    }

    const rules = await new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM Rules WHERE merchantApiKey = ? ORDER BY priority DESC",
        [merchantApiKey],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ status: STATUS.SUCCESS, data: rules });
  } catch (error) {
    console.error("Error fetching rules:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 7: Create Rule
app.post("/api/rules", async (req, res) => {
  const {
    merchantApiKey,
    priority,
    amount,
    location,
    timeStart,
    timeEnd,
    condition,
    successStatus,
  } = req.body;

  try {
    if (!merchantApiKey) {
      return res
        .status(400)
        .json({ status: STATUS.FAILURE, message: "Merchant API key required" });
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO Rules (merchantApiKey, priority, amount, location, timeStart, timeEnd, condition, successStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          merchantApiKey,
          priority,
          amount,
          location,
          timeStart,
          timeEnd,
          condition,
          successStatus,
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.json({
      status: STATUS.SUCCESS,
      message: "Rule created",
      ruleId: result,
    });
  } catch (error) {
    console.error("Error creating rule:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 8: Update Rule
app.put("/api/rules/:id", async (req, res) => {
  const { id } = req.params;
  const {
    merchantApiKey,
    priority,
    amount,
    location,
    timeStart,
    timeEnd,
    condition,
    successStatus,
  } = req.body;

  try {
    if (!merchantApiKey) {
      return res
        .status(400)
        .json({ status: STATUS.FAILURE, message: "Merchant API key required" });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE Rules SET priority = ?, amount = ?, location = ?, timeStart = ?, timeEnd = ?, condition = ?, successStatus = ?
         WHERE ruleId = ? AND merchantApiKey = ?`,
        [
          priority,
          amount,
          location,
          timeStart,
          timeEnd,
          condition,
          successStatus,
          id,
          merchantApiKey,
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ status: STATUS.SUCCESS, message: "Rule updated" });
  } catch (error) {
    console.error("Error updating rule:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 9: Delete Rule
app.delete("/api/rules/:id", async (req, res) => {
  const { id } = req.params;
  const { merchantApiKey } = req.query;

  try {
    if (!merchantApiKey) {
      return res
        .status(400)
        .json({ status: STATUS.FAILURE, message: "Merchant API key required" });
    }

    await new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM Rules WHERE ruleId = ? AND merchantApiKey = ?",
        [id, merchantApiKey],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ status: STATUS.SUCCESS, message: "Rule deleted" });
  } catch (error) {
    console.error("Error deleting rule:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 10: Get Dashboard Stats
app.get("/api/dashboard/stats", async (req, res) => {
  const { merchantApiKey, timePeriod = "all" } = req.query;

  try {
    if (!merchantApiKey) {
      return res
        .status(400)
        .json({ status: STATUS.FAILURE, message: "Merchant API key required" });
    }

    // Calculate time filter based on timePeriod
    let timeFilter = "";
    let timelineFilter = "";
    switch (timePeriod) {
      case "day":
        timeFilter = "AND timestamp >= datetime('now', '-1 day')";
        timelineFilter = "AND timestamp >= datetime('now', '-1 day')";
        break;
      case "week":
        timeFilter = "AND timestamp >= datetime('now', '-7 days')";
        timelineFilter = "AND timestamp >= datetime('now', '-7 days')";
        break;
      case "month":
        timeFilter = "AND timestamp >= datetime('now', '-30 days')";
        timelineFilter = "AND timestamp >= datetime('now', '-30 days')";
        break;
      case "year":
        timeFilter = "AND timestamp >= datetime('now', '-365 days')";
        timelineFilter = "AND timestamp >= datetime('now', '-365 days')";
        break;
      case "all":
      default:
        timeFilter = "";
        timelineFilter = "";
        break;
    }

    // Get total transactions
    const totalTransactions = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM MFAEvents WHERE merchantApiKey = ? ${timeFilter}`,
        [merchantApiKey],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Get success/failure/auth counts
    const statusCounts = await new Promise((resolve, reject) => {
      db.all(
        `SELECT status, COUNT(*) as count FROM MFAEvents
         WHERE merchantApiKey = ? ${timeFilter}
         GROUP BY status`,
        [merchantApiKey],
        (err, rows) => {
          if (err) reject(err);
          else {
            const counts = { success: 0, failure: 0, authRequired: 0 };
            rows.forEach((row) => {
              if (row.status === STATUS.SUCCESS) counts.success = row.count;
              else if (row.status === STATUS.FAILURE)
                counts.failure = row.count;
              else if (row.status === STATUS.AUTH_REQUIRED)
                counts.authRequired = row.count;
            });
            resolve(counts);
          }
        }
      );
    });

    // Get transaction timeline
    const timeline = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          DATE(timestamp) as date,
          SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as flagged
         FROM MFAEvents
         WHERE merchantApiKey = ? ${timelineFilter}
         GROUP BY DATE(timestamp)
         ORDER BY date ASC`,
        [merchantApiKey],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Get location distribution
    const locationStats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          location,
          COUNT(*) as transactions,
          SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as flagged,
          SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as failed
         FROM MFAEvents
         WHERE merchantApiKey = ? ${timeFilter}
         GROUP BY location
         ORDER BY transactions DESC
         LIMIT 5`,
        [merchantApiKey],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Get per-customer stats
    const customerStats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          u.email as name,
          SUM(CASE WHEN e.status = 1 THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN e.status = 0 THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN e.status = 2 THEN 1 ELSE 0 END) as authRequired
         FROM MFAEvents e
         JOIN Users u ON e.cchash = u.cchash
         WHERE e.merchantApiKey = ? ${timeFilter}
         GROUP BY u.email
         ORDER BY (success + failed + authRequired) DESC`,
        [merchantApiKey],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Get detailed risk metrics for each customer
    const riskMetrics = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          u.email as name,
          e.cchash,
          SUM(CASE WHEN e.status = 1 THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN e.status = 0 THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN e.status = 2 THEN 1 ELSE 0 END) as authRequired,
          COUNT(*) as totalAttempts,
          COUNT(DISTINCT e.location) as countryCount,
          GROUP_CONCAT(DISTINCT e.location) as countries
         FROM MFAEvents e
         JOIN Users u ON e.cchash = u.cchash
         WHERE e.merchantApiKey = ? ${timeFilter}
         GROUP BY u.email, e.cchash`,
        [merchantApiKey],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          // Calculate additional metrics for each user
          Promise.all(
            rows.map(async (row) => {
              // Get all events for this user sorted by timestamp
              const events = await new Promise((res, rej) => {
                db.all(
                  `SELECT status, timestamp, location FROM MFAEvents
                 WHERE cchash = ? AND merchantApiKey = ? ${timeFilter}
                 ORDER BY timestamp DESC`,
                  [row.cchash, merchantApiKey],
                  (err, evts) => {
                    if (err) rej(err);
                    else res(evts);
                  }
                );
              });

              // Calculate consecutive stats
              let maxConsecutiveFails = 0;
              let maxConsecutiveSuccesses = 0;
              let currentFails = 0;
              let currentSuccesses = 0;

              // Calculate time between auth required and failures
              const authTimestamps = [];
              const failTimestamps = [];

              events.forEach((evt) => {
                if (evt.status === STATUS.FAILURE) {
                  currentFails++;
                  currentSuccesses = 0;
                  maxConsecutiveFails = Math.max(
                    maxConsecutiveFails,
                    currentFails
                  );
                  failTimestamps.push(new Date(evt.timestamp));
                } else if (evt.status === STATUS.SUCCESS) {
                  currentSuccesses++;
                  currentFails = 0;
                  maxConsecutiveSuccesses = Math.max(
                    maxConsecutiveSuccesses,
                    currentSuccesses
                  );
                } else if (evt.status === STATUS.AUTH_REQUIRED) {
                  currentFails = 0;
                  currentSuccesses = 0;
                  authTimestamps.push(new Date(evt.timestamp));
                } else {
                  currentFails = 0;
                  currentSuccesses = 0;
                }
              });

              // Calculate average time between events
              const calcAvgTimeBetween = (timestamps) => {
                if (timestamps.length < 2) return "N/A";
                let totalMinutes = 0;
                for (let i = 0; i < timestamps.length - 1; i++) {
                  totalMinutes +=
                    (timestamps[i] - timestamps[i + 1]) / (1000 * 60);
                }
                const avgMinutes = totalMinutes / (timestamps.length - 1);
                if (avgMinutes < 60) return `${avgMinutes.toFixed(0)}m`;
                if (avgMinutes < 1440)
                  return `${(avgMinutes / 60).toFixed(1)}h`;
                return `${(avgMinutes / 1440).toFixed(1)}d`;
              };

              const avgTimeBetweenAuths = calcAvgTimeBetween(authTimestamps);
              const avgTimeBetweenFails = calcAvgTimeBetween(failTimestamps);

              // Get recent timestamps (top 3)
              const recentTimestamps = events.slice(0, 3).map((evt) => {
                const date = new Date(evt.timestamp);
                return date.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              });

              // Calculate risk score (0-100)
              const failureRate =
                row.totalAttempts > 0 ? row.failed / row.totalAttempts : 0;
              const authRate =
                row.totalAttempts > 0
                  ? row.authRequired / row.totalAttempts
                  : 0;
              const riskScore = Math.round(
                failureRate * 50 +
                  authRate * 30 +
                  maxConsecutiveFails * 5 +
                  (row.countryCount > 3 ? 15 : 0)
              );

              return {
                ...row,
                maxConsecutiveFails,
                maxConsecutiveSuccesses,
                avgTimeBetweenAuths,
                avgTimeBetweenFails,
                recentTimestamps,
                riskScore,
              };
            })
          )
            .then((enrichedRows) => resolve(enrichedRows))
            .catch((err) => reject(err));
        }
      );
    });

    const successRate =
      totalTransactions > 0
        ? ((statusCounts.success / totalTransactions) * 100).toFixed(1)
        : 0;

    res.json({
      status: STATUS.SUCCESS,
      data: {
        totalTransactions,
        successRate,
        statusCounts,
        timeline,
        locationStats,
        customerStats,
        riskMetrics,
      },
    });
  } catch (error) {
    console.error("Error in dashboard stats:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
