const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const twilio = require('twilio');
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200
}));
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

// Helper function to generate random user ID
function generateRandomUserId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let randomChars = '';
  for (let i = 0; i < 4; i++) {
    randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `user-${randomChars}`;
}

// Helper function to hash and salt credit card numbers
function hashAndSaltCardNumber(cardNumber) {
  // Generate a random salt (32 bytes)
  const salt = crypto.randomBytes(32).toString('hex');

  // Hash the card number with the salt using PBKDF2
  const hash = crypto.pbkdf2Sync(cardNumber, salt, 100000, 64, 'sha512').toString('hex');

  // Return both hash and salt (separated by a delimiter)
  return `${salt}:${hash}`;
}

// Helper function to verify a card number against a stored hash
function verifyCardNumber(cardNumber, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(cardNumber, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Helper function to check if device matches user's stored device info
async function checkDeviceTrust(user, deviceFingerprint, deviceInfo) {
  // If no device fingerprint provided, treat as new device
  if (!deviceFingerprint) {
    return { trusted: false, isNewDevice: true };
  }

  // Check if user has device info stored
  if (!user.deviceFingerprint) {
    // No device stored yet - this is a new device
    return { trusted: false, isNewDevice: true };
  }

  // Check if fingerprint matches
  if (user.deviceFingerprint === deviceFingerprint) {
    return { trusted: true, isNewDevice: false };
  }

  // Different fingerprint - untrusted device
  return { trusted: false, isNewDevice: true };
}

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
      "[Veritas] logMFAEvent received unsupported status. Coercing value.",
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
  const { cardNumber, amount, location, merchantApiKey, emailAddress, deviceFingerprint, deviceInfo } = req.body;

  if (!cardNumber) {
    return res.json({
      status: STATUS.FAILURE,
      message: "Card number required",
    });
  }

  try {
    // Validate merchant API key
    const merchantExists = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM Merchants WHERE merchantApiKey = ?",
        [merchantApiKey],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!merchantExists) {
      console.warn("[Veritas] processTransaction denied: invalid merchant", {
        merchantApiKey,
        amount,
        location,
      });
      const tempHash = hashAndSaltCardNumber(cardNumber);
      await logMFAEvent(
        tempHash,
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

    // Get all users and verify card number against stored hashes
    const allUsers = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM Users", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Find matching user by verifying card number
    let user = null;
    for (const u of allUsers) {
      if (verifyCardNumber(cardNumber, u.cchash)) {
        user = u;
        break;
      }
    }

    if (!user) {
      console.warn("[Veritas] processTransaction denied: user not found", {
        merchantApiKey,
        amount,
        location,
      });
      const tempHash = hashAndSaltCardNumber(cardNumber);
      await logMFAEvent(
        tempHash,
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

    // Use the user's stored cchash for subsequent operations
    const ccHash = user.cchash;

    // Check device trust if fingerprint provided
    let deviceTrustResult = { trusted: true, isNewDevice: false };
    if (deviceFingerprint) {
      deviceTrustResult = await checkDeviceTrust(user, deviceFingerprint, deviceInfo);
      console.log('[Veritas] Device trust check:', {
        ccHash: ccHash.substring(0, 20) + '...',
        trusted: deviceTrustResult.trusted,
        isNewDevice: deviceTrustResult.isNewDevice
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

    await logMFAEvent(ccHash, amount, location, merchantApiKey, ruleStatus);

    // Force AUTH_REQUIRED if this is a new/untrusted device
    if (deviceTrustResult.isNewDevice || !deviceTrustResult.trusted) {
      const authMethods = getEnabledAuthMethods(user);
      console.log("[Veritas] processTransaction requires auth (new/untrusted device)", {
        merchantApiKey,
        ccHash: ccHash.substring(0, 20) + '...',
        amount,
        location,
        isNewDevice: deviceTrustResult.isNewDevice,
        authMethods,
      });
      return res.json({
        status: STATUS.AUTH_REQUIRED,
        message: deviceTrustResult.isNewDevice
          ? "New device detected - verification required"
          : "Untrusted device - verification required",
        authMethods,
        reason: deviceTrustResult.isNewDevice ? "new_device" : "untrusted_device",
      });
    }

    if (ruleStatus === STATUS.SUCCESS) {
      console.log("[Veritas] processTransaction approved", {
        merchantApiKey,
        ccHash: ccHash.substring(0, 20) + '...',
        amount,
        location,
      });
      return res.json({
        status: STATUS.SUCCESS,
        message: "Transaction approved",
      });
    } else if (ruleStatus === STATUS.AUTH_REQUIRED) {
      const authMethods = getEnabledAuthMethods(user);
      console.log("[Veritas] processTransaction requires additional auth", {
        merchantApiKey,
        ccHash: ccHash.substring(0, 20) + '...',
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
      console.warn("[Veritas] processTransaction denied by rules", {
        merchantApiKey,
        ccHash: ccHash.substring(0, 20) + '...',
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
  const { cardNumber, authMode, email, phone, merchantApiKey, location } = req.body;

  if (!cardNumber) {
    return res.json({
      status: STATUS.FAILURE,
      message: "Card number required",
    });
  }

  // Hash and salt the card number for new users
  let ccHash = hashAndSaltCardNumber(cardNumber);

  try {
    // Get all users and verify card number against stored hashes
    const allUsers = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM Users", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Find matching user by verifying card number
    let user = null;
    for (const u of allUsers) {
      if (verifyCardNumber(cardNumber, u.cchash)) {
        user = u;
        break;
      }
    }

    // Use the user's stored cchash if user exists
    if (user) {
      ccHash = user.cchash;
    }

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    if (user) {
      // Update user's authCode for existing profiles
      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE Users SET authCode = ? WHERE cchash = ?",
          [code, ccHash],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Send code via selected auth method
      console.log(
        `[AUTH CODE] User: ${ccHash.substring(0, 20)}..., Method: ${authMode}, Code: ${code}`
      );

      switch (authMode) {
        case AUTH_METHODS.email:
          console.log(`[EMAIL] Sending code to ${user.email}: ${code}`);
          try {
            const msg = {
              to: user.email,
              from: "Veritas@mystaticsite.com",
              subject: "Your Veritas Verification Code",
              text: `Your verification code is: ${code}`,
              html: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Veritas Verification</h2>
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
          try {
            await twilioClient.messages.create({
              body: `Your Veritas verification code is: ${code}`,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: user.phone
            });
            console.log(`[SMS] Successfully sent code to ${user.phone}`);
          } catch (smsError) {
            console.error(`[SMS] Failed to send SMS:`, smsError);
            // Don't fail the request if SMS fails, code is still stored
          }
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
        [ccHash, email, phone, code, location || null, merchantApiKey || null],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(
      `[AUTH CODE][SIGNUP] Pending user: ${ccHash.substring(0, 20)}..., Method: ${authMode}, Code: ${code}`
    );

    // Send code via email or phone for new sign-ups
    if (authMode === AUTH_METHODS.email && email) {
      console.log(`[EMAIL][SIGNUP] Sending code to ${email}: ${code}`);
      try {
        const msg = {
          to: email,
          from: "Veritas@mystaticsite.com",
          subject: "Your Veritas Verification Code - Sign Up",
          text: `Your verification code is: ${code}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Welcome to Veritas!</h2>
              <p>Your verification code is:</p>
              <h1 style="color: #4F46E5; letter-spacing: 5px;">${code}</h1>
              <p>This code will expire in 10 minutes.</p>
              <p style="color: #6B7280; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
            </div>
          `,
        };
        await sgMail.send(msg);
        console.log(`[EMAIL][SIGNUP] Successfully sent code to ${email}`);
      } catch (emailError) {
        console.error(`[EMAIL][SIGNUP] Failed to send email:`, emailError);
        // Don't fail the request if email fails, code is still stored
      }
    } else if (authMode === AUTH_METHODS.phone && phone) {
      console.log(`[SMS][SIGNUP] Sending code to ${phone}: ${code}`);
      try {
        await twilioClient.messages.create({
          body: `Welcome to Veritas! Your verification code is: ${code}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
        console.log(`[SMS][SIGNUP] Successfully sent code to ${phone}`);
      } catch (smsError) {
        console.error(`[SMS][SIGNUP] Failed to send SMS:`, smsError);
        // Don't fail the request if SMS fails, code is still stored
      }
    }

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
  const { cardNumber, code, deviceFingerprint, deviceInfo } = req.body;

  if (!cardNumber) {
    return res.json({
      status: STATUS.FAILURE,
      message: "Card number required",
    });
  }

  // Hash and salt the card number for new users
  let ccHash = hashAndSaltCardNumber(cardNumber);

  try {
    // Get all users and verify card number against stored hashes
    const allUsers = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM Users", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Find matching user by verifying card number
    let user = null;
    for (const u of allUsers) {
      if (verifyCardNumber(cardNumber, u.cchash)) {
        user = u;
        break;
      }
    }

    // Use the user's stored cchash if user exists
    if (user) {
      ccHash = user.cchash;
    }

    if (!user) {
      // Check pending sign-ups - check all pending users
      const allPendingUsers = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM PendingUsers", [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // Find matching pending user by verifying card number
      let pendingUser = null;
      for (const u of allPendingUsers) {
        if (verifyCardNumber(cardNumber, u.cchash)) {
          pendingUser = u;
          break;
        }
      }

      // Use the pending user's stored cchash if exists
      if (pendingUser) {
        ccHash = pendingUser.cchash;
      }

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
            [ccHash],
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
          [ccHash],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Store/update device info after successful MFA
      if (deviceFingerprint) {
        try {
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE Users SET deviceFingerprint = ?, userAgent = ?, platform = ?, screenResolution = ?, timezone = ?, language = ? WHERE cchash = ?`,
              [
                deviceFingerprint,
                deviceInfo?.userAgent || null,
                deviceInfo?.platform || null,
                deviceInfo?.screenResolution || null,
                deviceInfo?.timezone || null,
                deviceInfo?.language || null,
                ccHash
              ],
              function (err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          console.log('[Veritas] Device info saved after successful MFA:', {
            ccHash: ccHash.substring(0, 20) + '...',
            deviceFingerprint: deviceFingerprint.substring(0, 20) + '...'
          });
        } catch (error) {
          console.error('[Veritas] Failed to save device info:', error);
        }
      }

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
  const { cardNumber, email, phone, location, merchantApiKey, amount } = req.body;

  if (!cardNumber) {
    return res.json({
      status: STATUS.FAILURE,
      message: "Card number required",
    });
  }

  if (!email || !phone || !merchantApiKey || amount == null) {
    return res.json({
      status: STATUS.FAILURE,
      message: "Missing required registration details",
    });
  }

  // Hash and salt the card number for new users
  let ccHash = hashAndSaltCardNumber(cardNumber);

  try {
    const merchantExists = await new Promise((resolve, reject) => {
      db.get(
        "SELECT 1 FROM Merchants WHERE merchantApiKey = ?",
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

    // Get all users and verify card number against stored hashes
    const allUsers = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM Users", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Find matching user by verifying card number
    let existingUser = null;
    for (const u of allUsers) {
      if (verifyCardNumber(cardNumber, u.cchash)) {
        existingUser = u;
        break;
      }
    }

    // Check pending users
    const allPendingUsers = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM PendingUsers", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Find matching pending user by verifying card number
    let pendingUser = null;
    for (const u of allPendingUsers) {
      if (verifyCardNumber(cardNumber, u.cchash)) {
        pendingUser = u;
        break;
      }
    }

    // Use the stored cchash if user or pending user exists
    if (existingUser) {
      ccHash = existingUser.cchash;
    } else if (pendingUser) {
      ccHash = pendingUser.cchash;
    }

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

    console.log('[Veritas] registerUser location resolution:', {
      providedLocation: location,
      pendingUserLocation: pendingUser?.location,
      existingUserLocation: existingUser?.signUpLocation,
      resolvedLocation
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO Users (cchash, email, phone, otp, biometric, hardwareToken, authCode, signUpLocation, deviceFingerprint, userAgent, platform, screenResolution, timezone, language)
         VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL)
         ON CONFLICT(cchash) DO UPDATE SET
           email = excluded.email,
           phone = excluded.phone,
           signUpLocation = excluded.signUpLocation`,
        [ccHash, email, phone, resolvedLocation],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    const userRecord = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM Users WHERE cchash = ?", [ccHash], (err, row) => {
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

    console.log('[Veritas] registerUser rule evaluation:', {
      transactionLocation,
      userHomeLocation,
      amount: numericAmount
    });

    const ruleStatus = await evaluateRules(
      merchantApiKey,
      numericAmount,
      transactionLocation,
      new Date(),
      userHomeLocation
    );

    await logMFAEvent(
      ccHash,
      numericAmount,
      transactionLocation,
      merchantApiKey,
      ruleStatus
    );

    if (pendingUser) {
      await new Promise((resolve, reject) => {
        db.run(
          "DELETE FROM PendingUsers WHERE cchash = ?",
          [ccHash],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    if (ruleStatus === STATUS.FAILURE) {
      console.warn("[Veritas] registerUser denied by rules", {
        merchantApiKey,
        ccHash: ccHash.substring(0, 20) + '...',
        amount: numericAmount,
        location: transactionLocation,
      });
      return res.json({
        status: STATUS.FAILURE,
        message: "Transaction denied",
      });
    }

    console.log("[Veritas] registerUser approved", {
      merchantApiKey,
      ccHash: ccHash.substring(0, 20) + '...',
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

// Endpoint 10: Reorder Rules (Bulk Priority Update)
app.put("/api/rules/reorder", async (req, res) => {
  const { merchantApiKey, priorities } = req.body;

  try {
    if (!merchantApiKey) {
      return res
        .status(400)
        .json({ status: STATUS.FAILURE, message: "Merchant API key required" });
    }

    if (!priorities || !Array.isArray(priorities)) {
      return res
        .status(400)
        .json({ status: STATUS.FAILURE, message: "Priorities array required" });
    }

    // Update each rule's priority in a transaction
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        let completed = 0;
        let hasError = false;

        priorities.forEach(({ ruleId, priority }) => {
          db.run(
            "UPDATE Rules SET priority = ? WHERE ruleId = ? AND merchantApiKey = ?",
            [priority, ruleId, merchantApiKey],
            (err) => {
              if (err && !hasError) {
                hasError = true;
                db.run("ROLLBACK");
                reject(err);
              }

              completed++;
              if (completed === priorities.length && !hasError) {
                db.run("COMMIT", (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              }
            }
          );
        });
      });
    });

    res.json({ status: STATUS.SUCCESS, message: "Priorities updated" });
  } catch (error) {
    console.error("Error reordering rules:", error);
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
          u.email,
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
          else resolve(rows.map(row => ({
            ...row,
            name: generateRandomUserId()
          })));
        }
      );
    });

    // Get detailed risk metrics for each customer
    const riskMetrics = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          u.email,
          e.cchash,
          SUM(CASE WHEN e.status = 1 THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN e.status = 0 THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN e.status = 2 THEN 1 ELSE 0 END) as authRequired,
          COUNT(*) as totalAttempts,
          COUNT(DISTINCT e.location) as locationCount,
          GROUP_CONCAT(DISTINCT e.location) as locations
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
                  (row.locationCount > 3 ? 15 : 0)
              );

              return {
                ...row,
                name: generateRandomUserId(),
                maxConsecutiveFails,
                maxConsecutiveSuccesses,
                avgTimeBetweenAuths,
                avgTimeBetweenFails,
                recentTimestamps,
                riskScore,
                allEvents: events.map(evt => ({
                  status: evt.status,
                  timestamp: evt.timestamp,
                  location: evt.location
                }))
              };
            })
          )
            .then((enrichedRows) => {
              // Sort by sum of auth required + access denied (failed) descending
              enrichedRows.sort((a, b) => (b.authRequired + b.failed) - (a.authRequired + a.failed));
              resolve(enrichedRows);
            })
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

// Endpoint 11: Delete Device (Clear device info from user)
app.delete("/api/devices/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const { merchantApiKey } = req.query;

  try {
    if (!merchantApiKey) {
      return res
        .status(400)
        .json({ status: STATUS.FAILURE, message: "Merchant API key required" });
    }

    // Get all users who have transacted with this merchant
    const users = await new Promise((resolve, reject) => {
      db.all(
        `SELECT u.cchash
         FROM Users u
         WHERE EXISTS (
           SELECT 1 FROM MFAEvents
           WHERE MFAEvents.cchash = u.cchash
           AND MFAEvents.merchantApiKey = ?
         )
         ORDER BY (SELECT MAX(timestamp) FROM MFAEvents WHERE MFAEvents.cchash = u.cchash) DESC`,
        [merchantApiKey],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Session ID is just an index, so get the user at that index
    const userIndex = parseInt(sessionId) - 1;
    if (userIndex < 0 || userIndex >= users.length) {
      return res.json({
        status: STATUS.FAILURE,
        message: "Device not found",
      });
    }

    const targetUser = users[userIndex];

    // Clear device info for this user
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE Users SET deviceFingerprint = NULL, userAgent = NULL, platform = NULL,
         screenResolution = NULL, timezone = NULL, language = NULL WHERE cchash = ?`,
        [targetUser.cchash],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`[Veritas] Device info cleared for user:`, {
      sessionId,
      merchantApiKey,
    });

    res.json({
      status: STATUS.SUCCESS,
      message: "Device information cleared successfully",
    });
  } catch (error) {
    console.error("Error deleting device:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Endpoint 12: Get Users with Device Info for Merchant
app.get("/api/devices", async (req, res) => {
  const { merchantApiKey } = req.query;

  try {
    if (!merchantApiKey) {
      return res
        .status(400)
        .json({ status: STATUS.FAILURE, message: "Merchant API key required" });
    }

    // Get all users who have transacted with this merchant along with their device info
    const devices = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          u.cchash,
          u.email,
          u.deviceFingerprint,
          u.userAgent,
          u.platform,
          u.screenResolution,
          u.timezone,
          u.language,
          COUNT(DISTINCT e.id) as transactionCount,
          MAX(e.timestamp) as lastTransaction
         FROM Users u
         LEFT JOIN MFAEvents e ON u.cchash = e.cchash AND e.merchantApiKey = ?
         WHERE EXISTS (
           SELECT 1 FROM MFAEvents
           WHERE MFAEvents.cchash = u.cchash
           AND MFAEvents.merchantApiKey = ?
         )
         GROUP BY u.cchash
         ORDER BY lastTransaction DESC`,
        [merchantApiKey, merchantApiKey],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Anonymize cchash for privacy and add missing fields
    const sanitizedDevices = devices.map((device, index) => ({
      ...device,
      sessionId: index + 1, // Generate a sequential ID for frontend compatibility
      cchash: device.cchash ? device.cchash.substring(0, 20) + '...' : null,
      deviceFingerprint: device.deviceFingerprint ? device.deviceFingerprint.substring(0, 16) + '...' : null,
      userId: generateRandomUserId(),
      trusted: device.deviceFingerprint ? 1 : 0, // Has device info = trusted
      lastSeen: device.lastTransaction || null, // Use last transaction as last seen
      firstSeen: null, // We don't track this anymore, could add it to Users table if needed
    }));

    res.json({ status: STATUS.SUCCESS, data: sanitizedDevices });
  } catch (error) {
    console.error("Error fetching devices:", error);
    res
      .status(500)
      .json({ status: STATUS.FAILURE, message: "Internal server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
