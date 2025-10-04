const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const authMethods = [
  { id: 'email', label: 'Email One-Time Code' },
  { id: 'sms', label: 'SMS Text Message' },
  { id: 'whatsapp', label: 'WhatsApp Secure Link' },
];

const evaluateOutcome = (ccHash) => {
  const lastChar = ccHash.slice(-1);
  if (lastChar === '0') return 'SUCCESS';
  if (lastChar === '1') return 'FAILURE';
  return 'AUTH_REQUIRED';
};

let lastChallenge = null;

export const webhookClient = {
  async processTransaction(payload) {
    await delay(900);
    const outcome = evaluateOutcome(payload.ccHash);
    if (outcome === 'SUCCESS') {
      return {
        status: 'SUCCESS',
        reference: `LB-${Date.now()}`,
      };
    }
    if (outcome === 'FAILURE') {
      return {
        status: 'FAILURE',
        reason: 'Issuer declined the authorization request.',
      };
    }

    const challenge = {
      status: 'AUTH_REQUIRED',
      ccHash: payload.ccHash,
      transactionId: `txn_${Date.now()}`,
      methods: authMethods,
    };
    lastChallenge = challenge;
    return challenge;
  },

  async requestMfaCode({ ccHash, method }) {
    await delay(800);
    lastChallenge = {
      ...(lastChallenge || {}),
      ccHash,
      method,
      challengeId: `chal_${Date.now()}`,
    };
    return {
      status: 'AUTH_REQUIRED',
      challengeId: lastChallenge.challengeId,
      method,
      message: `Verification code sent via ${method.toUpperCase()}.`,
    };
  },

  async verifyMfa({ ccHash, code }) {
    await delay(1000);
    if (code === '000000') {
      return {
        status: 'SUCCESS',
        reference: `LB-${Date.now()}`,
      };
    }
    if (code === '999999') {
      return {
        status: 'FAILURE',
        reason: 'Code entered is invalid. Transaction cancelled.',
      };
    }
    return {
      status: 'AUTH_REQUIRED',
      methods: authMethods,
      message: 'Additional verification required. Try a different method.',
    };
  },
};

export const waitForAuth = async () => {
  await delay(500);
  return { status: 'READY' };
};

export const verifyMFA = webhookClient.verifyMfa;
