const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Auth method mapping
const AUTH_METHODS = {
  email: 1,
  phone: 2,
  otp: 3,
  biometric: 4,
  hardwareToken: 5
};

// Status codes
const STATUS = {
  FAILURE: 0,
  SUCCESS: 1,
  AUTH_REQUIRED: 2
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
function logMFAEvent(cchash, transactionAmount, location, merchantApiKey, status) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO MFAEvents (cchash, transactionAmount, location, merchantApiKey, status)
       VALUES (?, ?, ?, ?, ?)`,
      [cchash, transactionAmount, location, merchantApiKey, status],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// Helper function to evaluate transaction rules
function evaluateRules(merchantApiKey, amount, location, timestamp, userHomeLocation) {
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
              case 'EQUAL':
                conditionMet = conditionMet && (amount === rule.amount);
                break;
              case 'GREATER':
                conditionMet = conditionMet && (amount > rule.amount);
                break;
              case 'LESS_THAN':
                conditionMet = conditionMet && (amount < rule.amount);
                break;
              case 'NOT':
                conditionMet = conditionMet && (amount !== rule.amount);
                break;
              case 'IS':
                conditionMet = conditionMet && (amount === rule.amount);
                break;
            }
          }

          // Check location condition (only if location is specified in rule)
          if (rule.location) {
            // Special handling for HOME_LOCATION
            const checkLocation = rule.location === 'HOME_LOCATION' ? userHomeLocation : rule.location;

            if (rule.condition === 'IS') {
              conditionMet = conditionMet && (location === checkLocation);
            } else if (rule.condition === 'NOT') {
              conditionMet = conditionMet && (location !== checkLocation);
            }
          }

          // Check time window
          if (rule.timeStart && rule.timeEnd) {
            const currentTime = new Date(timestamp).toTimeString().split(' ')[0];
            conditionMet = conditionMet && (currentTime >= rule.timeStart && currentTime <= rule.timeEnd);
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
app.post('/api/processTransaction', async (req, res) => {
  const { hashCC, amount, location, merchantApiKey, emailAddress } = req.body;

  try {
    // Validate merchant API key
    const merchantExists = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM MerchantApiKeys WHERE apiKey = ?', [merchantApiKey], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!merchantExists) {
      await logMFAEvent(hashCC, amount, location, merchantApiKey, STATUS.FAILURE);
      return res.json({ status: STATUS.FAILURE, message: 'Invalid merchant API key' });
    }

    // Check if user exists
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM Users WHERE cchash = ?', [hashCC], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      await logMFAEvent(hashCC, amount, location, merchantApiKey, STATUS.AUTH_REQUIRED);
      return res.json({
        status: STATUS.AUTH_REQUIRED,
        message: 'User not found',
        authMethods: []
      });
    }

    // Evaluate transaction rules
    const ruleStatus = await evaluateRules(merchantApiKey, amount, location, new Date(), user.signUpLocation);

    await logMFAEvent(hashCC, amount, location, merchantApiKey, ruleStatus);

    if (ruleStatus === STATUS.SUCCESS) {
      return res.json({ status: STATUS.SUCCESS, message: 'Transaction approved' });
    } else if (ruleStatus === STATUS.AUTH_REQUIRED) {
      const authMethods = getEnabledAuthMethods(user);
      return res.json({
        status: STATUS.AUTH_REQUIRED,
        message: 'Authentication required',
        authMethods
      });
    } else {
      return res.json({ status: STATUS.FAILURE, message: 'Transaction denied' });
    }

  } catch (error) {
    console.error('Error in processTransaction:', error);
    res.status(500).json({ status: STATUS.FAILURE, message: 'Internal server error' });
  }
});

// Endpoint 2: Request Code
app.post('/api/requestCode', async (req, res) => {
  const { hashCC, authMode } = req.body;

  try {
    // Get user
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM Users WHERE cchash = ?', [hashCC], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.json({ status: STATUS.FAILURE, message: 'User not found' });
    }

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Update user's authCode
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE Users SET authCode = ? WHERE cchash = ?',
        [code, hashCC],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // TODO: Send code via selected method (email, SMS, etc.)
    // For now, we'll just log it (in production, integrate with email/SMS service)
    console.log(`[AUTH CODE] User: ${hashCC}, Method: ${authMode}, Code: ${code}`);

    res.json({
      status: STATUS.SUCCESS,
      message: 'Code sent successfully',
      // Remove in production - only for testing
      debug_code: code
    });

  } catch (error) {
    console.error('Error in requestCode:', error);
    res.status(500).json({ status: STATUS.FAILURE, message: 'Internal server error' });
  }
});

// Endpoint 3: Verify MFA
app.post('/api/verifyMFA', async (req, res) => {
  const { hashCC, code } = req.body;

  try {
    // Get user with stored auth code
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM Users WHERE cchash = ?', [hashCC], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.json({ status: STATUS.FAILURE, message: 'User not found' });
    }

    if (!user.authCode) {
      return res.json({ status: STATUS.FAILURE, message: 'No code generated' });
    }

    // Compare codes
    if (user.authCode === code) {
      // Clear the auth code after successful verification
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE Users SET authCode = NULL WHERE cchash = ?',
          [hashCC],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({ status: STATUS.SUCCESS, message: 'Authentication successful' });
    } else {
      res.json({ status: STATUS.AUTH_REQUIRED, message: 'Invalid code' });
    }

  } catch (error) {
    console.error('Error in verifyMFA:', error);
    res.status(500).json({ status: STATUS.FAILURE, message: 'Internal server error' });
  }
});

// Endpoint 4: Merchant Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Get merchant by email
    const merchant = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM Merchants WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!merchant) {
      return res.json({ status: STATUS.FAILURE, message: 'Invalid credentials' });
    }

    // Check password (in production, use bcrypt for hashed passwords)
    if (merchant.password === password) {
      res.json({
        status: STATUS.SUCCESS,
        message: 'Login successful',
        merchantApiKey: merchant.merchantApiKey,
        email: merchant.email
      });
    } else {
      res.json({ status: STATUS.FAILURE, message: 'Invalid credentials' });
    }

  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ status: STATUS.FAILURE, message: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
