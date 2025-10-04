const STATUS = {
  FAILURE: 'FAILURE',
  SUCCESS: 'SUCCESS',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  SIGN_UP_REQUIRED: 'SIGN_UP_REQUIRED',
};

const NUMERIC_STATUS = {
  0: STATUS.FAILURE,
  1: STATUS.SUCCESS,
  2: STATUS.AUTH_REQUIRED,
  3: STATUS.SIGN_UP_REQUIRED,
};

const METHOD_LABELS = {
  email: 'Email One-Time Code',
  sms: 'Text Message',
};

const DEFAULT_METHOD_OPTIONS = [
  { id: 'sms', label: METHOD_LABELS.sms },
  { id: 'email', label: METHOD_LABELS.email },
];

const upper = (value) => (typeof value === 'string' ? value.toUpperCase() : value);

const normalizeStatus = (status) => {
  if (status == null) return status;
  if (typeof status === 'number') return NUMERIC_STATUS[status] || STATUS.FAILURE;
  const normalized = upper(status);
  return STATUS[normalized] || normalized;
};

const resolveWindowConfig = () => {
  if (typeof window === 'undefined') return {};
  const raw = window.VeritasConfig || window.veritasConfig || {};
  const config = raw.backend || raw;
  if (!config.merchantApiKey && window.merchantApiKey) {
    config.merchantApiKey = window.merchantApiKey;
  }
  return config;
};

const toArray = (value) => (Array.isArray(value) ? value : value != null ? [value] : []);

const mapMethod = (entry) => {
  if (!entry && entry !== 0) return null;
  if (typeof entry === 'number') {
    if (entry === 1) return { id: 'email', label: METHOD_LABELS.email };
    if (entry === 2) return { id: 'sms', label: METHOD_LABELS.sms };
    return { id: `method-${entry}`, label: `Authentication Method ${entry}` };
  }

  if (typeof entry === 'string') {
    const normalized = entry.toLowerCase();
    if (normalized === 'phone' || normalized === 'text') {
      return { id: 'sms', label: METHOD_LABELS.sms };
    }
    if (METHOD_LABELS[normalized]) {
      return { id: normalized, label: METHOD_LABELS[normalized] };
    }
    return { id: normalized, label: `Verification via ${normalized}` };
  }

  if (typeof entry === 'object') {
    const id = entry.id || entry.method || entry.mode || entry.type;
    const normalizedId = id ? String(id).toLowerCase() : null;
    if (normalizedId && METHOD_LABELS[normalizedId]) {
      return { id: normalizedId, label: entry.label || METHOD_LABELS[normalizedId] };
    }
    return {
      id: normalizedId || 'veritas-method',
      label: entry.label || `Verification via ${normalizedId || 'method'}`,
    };
  }

  return null;
};

const convertMethods = (methods) =>
  toArray(methods)
    .map((method) => mapMethod(method))
    .filter(Boolean);

const ensureFetch = (fetchImpl) => {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch === 'function') return fetch.bind(globalThis);
  throw new Error('Veritas: Fetch API is not available in this environment.');
};

const normalizeTransactionResponse = (payload = {}) => {
  const status = normalizeStatus(payload.status);
  const base = {
    ...payload,
    status,
  };

  if (!base.reason && payload.message && status === STATUS.FAILURE) {
    base.reason = payload.message;
  }

  const rawMethods = payload.methods || payload.authMethods;
  if (status === STATUS.AUTH_REQUIRED && rawMethods) {
    base.methods = convertMethods(rawMethods);
  }

  return base;
};

const normalizeRequestResponse = (payload = {}) => ({
  ...payload,
  status: normalizeStatus(payload.status),
});

const createBackendClient = (options = {}) => {
  const globalConfig = resolveWindowConfig();
  const merged = {
    ...globalConfig,
    ...options,
  };

  const fetchImpl = ensureFetch(merged.fetch);
  const baseUrl = (merged.baseUrl || '/api').replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/json',
    ...merged.headers,
  };
  const merchantApiKey = merged.merchantApiKey;
  const defaultLocation = merged.defaultLocation;

  const waitForAuth =
    typeof merged.waitForAuth === 'function'
      ? merged.waitForAuth
      : async () => ({ status: 'READY' });

  const post = async (endpoint, body) => {
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = { message: 'Invalid response format from Veritas server.' };
      }
    }
    if (!response.ok) {
      return {
        ...data,
        status: normalizeStatus(data.status) || STATUS.FAILURE,
      };
    }
    return data;
  };

  const resolveRequestPayload = (payload = {}) => {
    const hashCC = payload.hashCC || payload.ccHash;
    const cardNumber = payload.cardNumber;
    const amount =
      payload.amount ?? payload.total ?? payload.totals?.subtotal ?? payload.transactionAmount;
    const emailAddress =
      payload.emailAddress || payload.customer?.email || payload.customer?.emailAddress;
    const useCustomerLocation =
      payload.useCustomerLocation ?? merged.useCustomerLocation ?? true;
    const locationCandidate = (() => {
      if (payload.location !== undefined) return payload.location;
      if (!useCustomerLocation) {
        return defaultLocation ?? null;
      }
      return (
        payload.customer?.city ??
        payload.customer?.country ??
        defaultLocation ??
        null
      );
    })();
    const apiKey = payload.merchantApiKey || merchantApiKey;

    if (!cardNumber && !hashCC) throw new Error('Veritas: Missing `cardNumber` or `ccHash` in payload.');
    if (amount == null) throw new Error('Veritas: Missing `amount` in payload.');
    if (!apiKey) throw new Error('Veritas: Missing `merchantApiKey`.');
    if (!emailAddress) throw new Error('Veritas: Missing `emailAddress`.');

    const requestBody = {
      amount,
      merchantApiKey: apiKey,
      emailAddress,
    };

    // Send cardNumber if available, otherwise send hashCC
    if (cardNumber) {
      requestBody.cardNumber = cardNumber;
    } else {
      requestBody.hashCC = hashCC;
    }

    if (locationCandidate !== undefined) {
      let normalizedLocation = locationCandidate;
      if (typeof normalizedLocation === 'string') {
        normalizedLocation = normalizedLocation.trim();
        if (normalizedLocation === '') {
          normalizedLocation = null;
        }
      }
      requestBody.location = normalizedLocation ?? null;
    }

    if (payload.useCustomerLocation !== undefined) {
      requestBody.useCustomerLocation = payload.useCustomerLocation;
    }

    return requestBody;
  };

  return {
    waitForAuth,
    async processTransaction(payload) {
      const requestBody = resolveRequestPayload(payload);
      const data = await post('/processTransaction', requestBody);
      const normalized = normalizeTransactionResponse(data);
      return {
        ...normalized,
        context: {
          requestBody,
          originalPayload: payload,
        },
      };
    },
    async requestCode({ ccHash, cardNumber, method, email, phone, merchantApiKey: overrideKey, location } = {}) {
      if (!cardNumber && !ccHash) throw new Error('Veritas: Missing `cardNumber` or `ccHash` when requesting a code.');
      if (!method) throw new Error('Veritas: Missing `method` when requesting a code.');
      const body = {
        authMode: method,
      };
      if (cardNumber) {
        body.cardNumber = cardNumber;
      } else {
        body.hashCC = ccHash;
      }
      if (email) body.email = email;
      if (phone) body.phone = phone;
      const keyToUse = overrideKey || merchantApiKey;
      if (keyToUse) body.merchantApiKey = keyToUse;
      if (location !== undefined) body.location = location;
      const data = await post('/requestCode', body);
      return normalizeRequestResponse(data);
    },
    async verifyMfa({ ccHash, cardNumber, code } = {}) {
      if (!cardNumber && !ccHash) throw new Error('Veritas: Missing `cardNumber` or `ccHash` when verifying MFA.');
      if (!code) throw new Error('Veritas: Missing `code` when verifying MFA.');
      const body = { code };
      if (cardNumber) {
        body.cardNumber = cardNumber;
      } else {
        body.hashCC = ccHash;
      }
      const data = await post('/verifyMFA', body);
      return normalizeRequestResponse(data);
    },
    async completeSignup({
      ccHash,
      cardNumber,
      email,
      phone,
      location,
      merchantApiKey: overrideKey,
      amount,
    } = {}) {
      if (!cardNumber && !ccHash) throw new Error('Veritas: Missing `cardNumber` or `ccHash` when completing sign-up.');
      if (!email) throw new Error('Veritas: Missing `email` when completing sign-up.');
      if (!phone) throw new Error('Veritas: Missing `phone` when completing sign-up.');
      const keyToUse = overrideKey || merchantApiKey;
      if (!keyToUse) throw new Error('Veritas: Missing `merchantApiKey` when completing sign-up.');
      if (amount == null) throw new Error('Veritas: Missing `amount` when completing sign-up.');

      const body = {
        email,
        phone,
        merchantApiKey: keyToUse,
        amount,
      };
      if (cardNumber) {
        body.cardNumber = cardNumber;
      } else {
        body.hashCC = ccHash;
      }

      if (location !== undefined) {
        body.location = location;
      }

      const data = await post('/registerUser', body);
      return normalizeRequestResponse(data);
    },
  };
};

let memoizedDefaultBackend = null;

const getDefaultBackend = () => {
  if (!memoizedDefaultBackend) {
    memoizedDefaultBackend = createBackendClient();
  }
  return memoizedDefaultBackend;
};

const ensureVeritasModal = () => {
  if (window.VeritasModal) return window.VeritasModal;

  const styleId = 'veritas-mfa-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .veritas-mfa-overlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(8, 6, 19, 0.85);
        backdrop-filter: blur(8px);
        z-index: 9999;
      }
      .veritas-mfa-overlay.is-visible {
        display: flex;
      }
      .veritas-mfa-dialog {
        width: min(460px, calc(100% - 32px));
        border-radius: 24px;
        padding: 32px 28px 28px;
        background: #ffffff;
        border: 1px solid #e5e7ef;
        box-shadow: 0 28px 48px rgba(15, 23, 42, 0.16);
        color: #1f2937;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        position: relative;
      }
      .veritas-mfa-dialog:focus {
        outline: none;
        box-shadow: 0 28px 48px rgba(15, 23, 42, 0.16), 0 0 0 2px rgba(99, 102, 241, 0.2);
      }
      .veritas-mfa-close {
        position: absolute;
        top: 18px;
        right: 18px;
        border: none;
        background: #f3f4f6;
        color: #1f2937;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        transition: background 160ms ease, transform 160ms ease;
      }
      .veritas-mfa-close:hover {
        background: #e5e7eb;
        transform: scale(1.05);
      }
      .veritas-mfa-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        background: #eef2ff;
        border: 1px solid #c7d2fe;
        font-size: 11px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #3730a3;
      }
      .veritas-mfa-heading {
        margin: 18px 0 10px;
        font-size: 26px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #1f2937;
      }
      .veritas-mfa-copy {
        margin: 0 0 24px;
        font-size: 13px;
        line-height: 1.6;
        color: #4b5563;
      }
      .veritas-mfa-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 18px;
      }
      .veritas-mfa-label {
        font-size: 11px;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: #6b7280;
      }
      .veritas-mfa-select,
      .veritas-mfa-input {
        border: 1px solid #d1d5db;
        border-radius: 14px;
        padding: 12px 14px;
        background: #ffffff;
        color: #111827;
        font-size: 14px;
        letter-spacing: 0.08em;
      }
      .veritas-mfa-select:focus,
      .veritas-mfa-input:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
      }
      .veritas-mfa-input::placeholder {
        color: #9ca3af;
      }
      .veritas-mfa-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .veritas-mfa-button {
        border: none;
        border-radius: 999px;
        padding: 13px 18px;
        font-size: 12px;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        cursor: pointer;
        transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
      }
      .veritas-mfa-request {
        background: linear-gradient(120deg, #6366f1, #8b5cf6);
        color: #ffffff;
        box-shadow: 0 12px 24px rgba(79, 70, 229, 0.25);
      }
      .veritas-mfa-submit {
        background: transparent;
        border: 1px solid #d1d5db;
        color: #1f2937;
      }
      .veritas-mfa-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 14px 28px rgba(79, 70, 229, 0.2);
      }
      .veritas-mfa-button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
      .veritas-mfa-status {
        margin-top: 16px;
        border-radius: 16px;
        padding: 12px 16px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        display: none;
        border: 1px solid transparent;
      }
      .veritas-mfa-status.is-visible {
        display: block;
      }
      .veritas-mfa-status[data-type="info"] {
        border-color: #c7d2fe;
        color: #4338ca;
      }
      .veritas-mfa-status[data-type="success"] {
        border-color: #bbf7d0;
        color: #047857;
      }
      .veritas-mfa-status[data-type="failure"] {
        border-color: #fecdd3;
        color: #be123c;
      }
      .veritas-mfa-hidden {
        display: none !important;
      }
      @media (max-width: 480px) {
        .veritas-mfa-heading {
          font-size: 22px;
        }
        .veritas-mfa-dialog {
          padding: 28px 22px 24px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.id = 'veritas-mfa-overlay';
  overlay.className = 'veritas-mfa-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="veritas-mfa-dialog" role="dialog" aria-modal="true" aria-labelledby="veritas-mfa-title" tabindex="-1">
      <button type="button" class="veritas-mfa-close" data-veritas-close aria-label="Cancel verification">×</button>
      <span class="veritas-mfa-chip">Veritas Shield</span>
      <h2 id="veritas-mfa-title" class="veritas-mfa-heading">Multi-Factor Checkpoint</h2>
      <p class="veritas-mfa-copy">Confirm this maison purchase with a one-time code delivered through your preferred channel.</p>
      <div class="veritas-mfa-section veritas-mfa-hidden" data-veritas-signup>
        <div class="veritas-mfa-field">
          <label class="veritas-mfa-label" for="veritas-signup-email">Email Address</label>
          <input id="veritas-signup-email" class="veritas-mfa-input" type="email" data-veritas-signup-email placeholder="name@example.com" autocomplete="email" />
        </div>
        <div class="veritas-mfa-field">
          <label class="veritas-mfa-label" for="veritas-signup-phone">Phone Number</label>
          <input id="veritas-signup-phone" class="veritas-mfa-input" type="tel" data-veritas-signup-phone placeholder="+1 555 555 5555" autocomplete="tel" />
        </div>
        <button type="button" class="veritas-mfa-button veritas-mfa-request" data-veritas-signup-submit>Confirm & Send Code</button>
      </div>
      <div class="veritas-mfa-field" data-veritas-method-block>
        <label class="veritas-mfa-label" for="veritas-mfa-method">Verification Channel</label>
        <select id="veritas-mfa-method" class="veritas-mfa-select" data-veritas-method></select>
      </div>
      <div class="veritas-mfa-actions">
        <button type="button" class="veritas-mfa-button veritas-mfa-request" data-veritas-request>Send Code</button>
        <div class="veritas-mfa-field veritas-mfa-field--code veritas-mfa-hidden" data-veritas-code-block>
          <label class="veritas-mfa-label" for="veritas-mfa-code">Enter Code</label>
          <input id="veritas-mfa-code" class="veritas-mfa-input" data-veritas-code inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="one-time-code" />
        </div>
        <button type="button" class="veritas-mfa-button veritas-mfa-submit veritas-mfa-hidden" data-veritas-submit>Verify & Continue</button>
      </div>
      <p class="veritas-mfa-status" data-veritas-status></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const dialog = overlay.querySelector('.veritas-mfa-dialog');
  const closeButton = overlay.querySelector('[data-veritas-close]');
  const methodSelect = overlay.querySelector('[data-veritas-method]');
  const methodBlock = overlay.querySelector('[data-veritas-method-block]');
  const requestButton = overlay.querySelector('[data-veritas-request]');
  const codeBlock = overlay.querySelector('[data-veritas-code-block]');
  const codeInput = overlay.querySelector('[data-veritas-code]');
  const submitButton = overlay.querySelector('[data-veritas-submit]');
  const statusMessage = overlay.querySelector('[data-veritas-status]');
  const signupSection = overlay.querySelector('[data-veritas-signup]');
  const signupEmailInput = overlay.querySelector('[data-veritas-signup-email]');
  const signupPhoneInput = overlay.querySelector('[data-veritas-signup-phone]');
  const signupButton = overlay.querySelector('[data-veritas-signup-submit]');
  const chipElement = overlay.querySelector('.veritas-mfa-chip');
  const headingElement = overlay.querySelector('.veritas-mfa-heading');
  const copyElement = overlay.querySelector('.veritas-mfa-copy');

  const defaultSurfaceText = {
    chip: chipElement?.textContent || '',
    heading: headingElement?.textContent || '',
    copy: copyElement?.textContent || '',
  };

  let currentHandlers = null;
  const elementsRequiringCode = [codeBlock, submitButton];

  const applySurfaceText = ({ chipText, headline, copyText } = {}) => {
    if (chipElement) {
      chipElement.textContent = chipText ?? defaultSurfaceText.chip;
    }
    if (headingElement) {
      headingElement.textContent = headline ?? defaultSurfaceText.heading;
    }
    if (copyElement) {
      copyElement.textContent = copyText ?? defaultSurfaceText.copy;
    }
  };

  const setSignupValues = ({ email = '', phone = '' } = {}) => {
    if (signupEmailInput) signupEmailInput.value = email;
    if (signupPhoneInput) signupPhoneInput.value = phone;
  };

  const getSignupValues = () => ({
    email: signupEmailInput?.value?.trim() || '',
    phone: signupPhoneInput?.value?.trim() || '',
  });

  const setMode = (mode = 'mfa') => {
    overlay.dataset.veritasMode = mode;
    const isSignup = mode === 'signup';
    signupSection?.classList.toggle('veritas-mfa-hidden', !isSignup);
    methodBlock?.classList.toggle('veritas-mfa-hidden', isSignup);
    requestButton?.classList.toggle('veritas-mfa-hidden', isSignup);
  };

  const clearStatus = () => {
    statusMessage.textContent = '';
    statusMessage.classList.remove('is-visible');
    statusMessage.removeAttribute('data-type');
  };

  const setCodeEntryVisible = (visible) => {
    elementsRequiringCode.forEach((element) => {
      if (!element) return;
      element.classList.toggle('veritas-mfa-hidden', !visible);
    });
    if (codeInput) {
      codeInput.value = '';
    }
    if (visible) {
      codeInput?.focus();
    }
  };

  const closeOverlay = () => {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    clearStatus();
    codeInput.value = '';
    currentHandlers = null;
    setCodeEntryVisible(false);
    setSignupValues();
    setMode('mfa');
    applySurfaceText();
  };

  const runSafely = async (button, handler, payload) => {
    if (!handler) return;
    button.disabled = true;
    try {
      await handler(payload);
    } finally {
      button.disabled = false;
    }
  };

  const api = {
    open({
      mode = 'mfa',
      methods,
      onRequestCode,
      onSubmitCode,
      onSubmitSignup,
      onCancel,
      signupValues,
      headline,
      copy,
      chipText,
    } = {}) {
      const methodList = Array.isArray(methods) ? methods : [];
      methodSelect.innerHTML = '';
      methodList.forEach((method) => {
        const option = document.createElement('option');
        option.value = method.id;
        option.textContent = method.label;
        methodSelect.appendChild(option);
      });

      currentHandlers = { onRequestCode, onSubmitCode, onSubmitSignup, onCancel };
      codeInput.value = '';
      clearStatus();
      applySurfaceText({ chipText, headline, copyText: copy });
      setSignupValues(signupValues);
      setMode(mode);
      setCodeEntryVisible(false);
      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-hidden', 'false');
      if (mode === 'signup') {
        signupEmailInput?.focus();
      } else {
        dialog.focus();
      }
    },
    close() {
      closeOverlay();
    },
    setStatus(type, message) {
      if (!message) {
        clearStatus();
        return;
      }
      statusMessage.textContent = message;
      statusMessage.setAttribute('data-type', type);
      statusMessage.classList.add('is-visible');
    },
    updateMethods(methods = []) {
      const methodList = Array.isArray(methods) ? methods : [];
      methodSelect.innerHTML = '';
      methodList.forEach((method) => {
        const option = document.createElement('option');
        option.value = method.id;
        option.textContent = method.label;
        methodSelect.appendChild(option);
      });
    },
    setSignupValues(values) {
      setSignupValues(values);
    },
    getSignupValues() {
      return getSignupValues();
    },
    setMode(mode) {
      setMode(mode);
    },
    showCodeEntry() {
      setCodeEntryVisible(true);
    },
    hideCodeEntry() {
      setCodeEntryVisible(false);
    },
  };

  if (signupButton) {
    signupButton.addEventListener('click', () => {
      if (!currentHandlers?.onSubmitSignup) return;
      const values = getSignupValues();
      if (!values.email || !values.phone) {
        api.setStatus('failure', 'Please provide both email and phone number.');
        return;
      }
      runSafely(signupButton, () => currentHandlers.onSubmitSignup(values));
    });
  }

  requestButton.addEventListener('click', () => {
    if (!currentHandlers?.onRequestCode) return;
    const method = methodSelect.value;
    runSafely(requestButton, () => currentHandlers.onRequestCode(method));
  });

  submitButton.addEventListener('click', () => {
    if (!currentHandlers?.onSubmitCode) return;
    const code = codeInput.value.trim();
    if (code.length !== 6) {
      api.setStatus('failure', 'Please enter the 6-digit code.');
      return;
    }
    runSafely(submitButton, () => currentHandlers.onSubmitCode(code));
  });

  codeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitButton.click();
    }
  });

  const handleCancel = () => {
    const cancelHandler = currentHandlers?.onCancel;
    closeOverlay();
    if (cancelHandler) cancelHandler();
  };

  closeButton.addEventListener('click', handleCancel);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      handleCancel();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('is-visible')) {
      handleCancel();
    }
  });

  window.VeritasModal = api;
  return api;
};

const resolveElement = (target) => {
  if (!target) return null;
  if (typeof target === 'string') return document.querySelector(target);
  return target;
};

const toClassList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
};

const createDefaultUI = ({
  form,
  statusElement,
  hiddenClass = 'hidden',
  baseStatusClass = '',
  statusClasses = {},
} = {}) => {
  const modal = ensureVeritasModal();
  const formEl = resolveElement(form);
  const statusEl = resolveElement(statusElement);
  const baseClasses = toClassList(baseStatusClass);
  const statusClassMap = {
    info: toClassList(statusClasses.info),
    success: toClassList(statusClasses.success),
    failure: toClassList(statusClasses.failure),
  };

  const removeVariantClasses = () => {
    if (!statusEl) return;
    Object.values(statusClassMap).forEach((classes) => {
      classes.forEach((cls) => statusEl.classList.remove(cls));
    });
  };

  const applyStatusClasses = (type) => {
    if (!statusEl) return;
    if (hiddenClass) statusEl.classList.remove(hiddenClass);
    baseClasses.forEach((cls) => statusEl.classList.add(cls));
    removeVariantClasses();
    (statusClassMap[type] || []).forEach((cls) => statusEl.classList.add(cls));
    statusEl.dataset.status = type;
  };

  return {
    showStatus(type, message) {
      if (!statusEl) return;
      applyStatusClasses(type);
      statusEl.textContent = message;
    },
    clearStatus() {
      if (!statusEl) return;
      statusEl.textContent = '';
      if (hiddenClass) statusEl.classList.add(hiddenClass);
      statusEl.removeAttribute('data-status');
      removeVariantClasses();
    },
    toggleProcessing(isProcessing) {
      if (!formEl) return;
      Array.from(formEl.elements || []).forEach((element) => {
        if (typeof element.disabled === 'boolean') {
          element.disabled = isProcessing;
        }
      });
    },
    showMfa(config) {
      modal.open({ ...config, mode: 'mfa' });
    },
    showSignup(config = {}) {
      modal.open({ ...config, mode: 'signup' });
    },
    hideMfa() {
      modal.close();
    },
    setMfaStatus(type, message) {
      modal.setStatus(type, message);
    },
    updateMfaMethods(methods) {
      modal.updateMethods?.(methods);
    },
    updateSignupValues(values) {
      modal.setSignupValues?.(values);
    },
    getSignupValues() {
      return modal.getSignupValues?.();
    },
    showCodeEntry() {
      modal.showCodeEntry?.();
    },
    hideCodeEntry() {
      modal.hideCodeEntry?.();
    },
  };
};

const resolveBackendClient = (backend) => {
  const baseBackend = getDefaultBackend();
  if (!backend) return baseBackend;

  const hasFunctions =
    typeof backend.processTransaction === 'function' ||
    typeof backend.requestCode === 'function' ||
    typeof backend.verifyMfa === 'function';

  if (!hasFunctions && !backend.webhookClient) {
    return createBackendClient(backend);
  }

  const legacyWebhook = backend.webhookClient || {};
  return {
    waitForAuth:
      typeof backend.waitForAuth === 'function'
        ? backend.waitForAuth
        : baseBackend.waitForAuth,
    processTransaction:
      backend.processTransaction ||
      legacyWebhook.processTransaction?.bind(legacyWebhook) ||
      baseBackend.processTransaction,
    requestCode:
      backend.requestCode ||
      backend.requestMfaCode ||
      legacyWebhook.requestMfaCode?.bind(legacyWebhook) ||
      baseBackend.requestCode,
    verifyMfa:
      backend.verifyMfa ||
      backend.verifyMFA ||
      legacyWebhook.verifyMfa?.bind(legacyWebhook) ||
      legacyWebhook.verifyMFA?.bind(legacyWebhook) ||
      baseBackend.verifyMfa,
    completeSignup:
      backend.completeSignup ||
      backend.registerUser ||
      legacyWebhook.completeSignup?.bind(legacyWebhook) ||
      baseBackend.completeSignup,
  };
};

const wrapProcessor = ({ processPayment, ui, backend } = {}) => {
  const activeBackend = resolveBackendClient(backend);

  const fallbackProcessor =
    typeof processPayment === 'function'
      ? processPayment
      : async () => ({ status: 'SUCCESS' });

  const orchestrateVeritas = async (payload, overrideUI) => {
    const paymentUI = overrideUI || ui;
    const invoke = (method, ...args) =>
      typeof paymentUI?.[method] === 'function'
        ? paymentUI[method](...args)
        : undefined;

    invoke('showStatus', 'info', 'Routing through Veritas orchestration...');
    invoke('toggleProcessing', true);

    await activeBackend.waitForAuth(payload);
    const response = await activeBackend.processTransaction(payload);

    if (response.status === STATUS.SUCCESS) {
      invoke(
        'showStatus',
        'success',
        'Payment authorized. Preparing confirmation...'
      );
      invoke('toggleProcessing', false);
      return response;
    }

    if (response.status === STATUS.FAILURE) {
      invoke(
        'showStatus',
        'failure',
        response.reason || 'Transaction cancelled, please contact merchant.'
      );
      invoke('toggleProcessing', false);
      return response;
    }

    if (response.status === STATUS.SIGN_UP_REQUIRED) {
      const requestContext = response.context?.requestBody || {};
      const ccHash =
        payload.ccHash ||
        payload.hashCC ||
        requestContext.hashCC ||
        requestContext.ccHash;
      const cardNumber = payload.cardNumber || requestContext.cardNumber;
      const merchantKey =
        requestContext.merchantApiKey ||
        payload.merchantApiKey ||
        backend?.merchantApiKey;
      const transactionAmount =
        requestContext.amount ??
        payload.amount ??
        payload.total ??
        payload.totals?.subtotal ??
        payload.transactionAmount;
      const transactionLocation =
        requestContext.location ??
        payload.location ??
        payload.customer?.city ??
        payload.customer?.country ??
        null;
      const defaultEmail =
        requestContext.emailAddress ||
        payload.emailAddress ||
        payload.customer?.email ||
        payload.customer?.emailAddress ||
        '';
      const defaultPhone =
        payload.phone ||
        payload.customer?.phone ||
        payload.customer?.phoneNumber ||
        '';

      invoke(
        'showStatus',
        'info',
        'First-time customer detected. Complete sign-up to continue.'
      );

      return new Promise((resolve) => {
        let latestEmail = defaultEmail;
        let latestPhone = defaultPhone;

        const finalize = (result) => {
          invoke('toggleProcessing', false);
          resolve(result);
        };

        const handleCancel = () => {
          const failure = {
            status: STATUS.FAILURE,
            reason: 'Transaction cancelled, please contact merchant.',
          };
          invoke('hideMfa');
          finalize(failure);
        };

        const requestSignupCode = async ({ email, phone }) => {
          latestEmail = email;
          latestPhone = phone;
          invoke('setMfaStatus', 'info', 'Sending verification code...');
          invoke('hideCodeEntry');
          try {
            const result = await activeBackend.requestCode({
              ccHash,
              cardNumber,
              method: 1,
              email,
              phone,
              merchantApiKey: merchantKey,
              location: transactionLocation,
            });
            if (result.status === STATUS.SUCCESS) {
              invoke(
                'setMfaStatus',
                'success',
                result.message || 'Check your email for the verification code.'
              );
              invoke('showCodeEntry');
            } else {
              invoke(
                'setMfaStatus',
                'failure',
                result.message || 'Unable to deliver the verification code.'
              );
            }
            return result;
          } catch (error) {
            invoke(
              'setMfaStatus',
              'failure',
              'Network issue while requesting the code. Please retry.'
            );
            return {
              status: STATUS.FAILURE,
              reason: error?.message,
            };
          }
        };

        const sendCompletion = async () => {
          if (typeof activeBackend.completeSignup !== 'function') {
            return { status: STATUS.SUCCESS };
          }
          if (!merchantKey || transactionAmount == null) {
            return {
              status: STATUS.FAILURE,
              message: 'Missing merchant context for completing sign-up.',
            };
          }
          try {
            return await activeBackend.completeSignup({
              ccHash,
              cardNumber,
              email: latestEmail,
              phone: latestPhone,
              location: transactionLocation,
              merchantApiKey: merchantKey,
              amount: transactionAmount,
            });
          } catch (error) {
            return {
              status: STATUS.FAILURE,
              message: 'Unable to complete registration.',
              reason: error?.message,
            };
          }
        };

        const submitCode = async (code) => {
          invoke('setMfaStatus', 'info', 'Validating code...');
          try {
            const verification = await activeBackend.verifyMfa({
              ccHash,
              cardNumber,
              code,
            });
            if (verification.status === STATUS.SUCCESS) {
              const completion = await sendCompletion();
              if (completion.status === STATUS.FAILURE) {
                invoke(
                  'setMfaStatus',
                  'failure',
                  completion.message || 'Registration failed. Please try again.'
                );
                return;
              }
              invoke(
                'setMfaStatus',
                'success',
                completion.message || 'Registration confirmed. Completing transaction...'
              );
              invoke('hideMfa');
              finalize({
                ...completion,
                status: STATUS.SUCCESS,
              });
            } else if (verification.status === STATUS.AUTH_REQUIRED) {
              invoke('showCodeEntry');
              invoke(
                'setMfaStatus',
                'failure',
                verification.message ||
                  'Code mismatch. Please try again or request a new code.'
              );
            } else {
              invoke(
                'setMfaStatus',
                'failure',
                verification.message || 'Verification failed. Transaction cancelled.'
              );
              invoke('hideMfa');
              finalize(verification);
            }
          } catch (error) {
            invoke('showCodeEntry');
            invoke(
              'setMfaStatus',
              'failure',
              'Network issue while verifying the code. Please retry.'
            );
          }
        };

        invoke('showSignup', {
          signupValues: { email: defaultEmail, phone: defaultPhone },
          onSubmitSignup: requestSignupCode,
          onSubmitCode: submitCode,
          onCancel: handleCancel,
          headline: 'Create Veritas Profile',
          copy: 'Provide your email and phone to finish verifying this purchase.',
          chipText: 'Veritas Onboarding',
        });
        invoke('setMfaStatus', 'info', 'Enter your contact details to get started.');
      });
    }

    if (response.status !== STATUS.AUTH_REQUIRED) {
      invoke('toggleProcessing', false);
      return response;
    }

    invoke('showStatus', 'info', 'Additional authentication required.');

    return new Promise((resolve) => {
      const launchMfa = (methods) => {
        const methodList =
          Array.isArray(methods) && methods.length
            ? methods
            : DEFAULT_METHOD_OPTIONS.map((method) => ({ ...method }));
        invoke('showMfa', {
          methods: methodList,
          onRequestCode: async (method) => {
            invoke(
              'setMfaStatus',
              'info',
              `Requesting code via ${method.toUpperCase()}...`
            );
            try {
              const authModeValue = method === 'email' ? 1 : method === 'sms' || method === 'phone' ? 2 : method;
              const result = await activeBackend.requestCode({
                ccHash: payload.ccHash,
                cardNumber: payload.cardNumber,
                method: authModeValue,
              });
              if (result.status === STATUS.FAILURE) {
                invoke(
                  'setMfaStatus',
                  'failure',
                  result.message ||
                    'Unable to deliver code. Please choose another method.'
                );
                return result;
              }
              invoke(
                'setMfaStatus',
                'success',
                result.message || 'Verification code dispatched.'
              );
              invoke('showCodeEntry');
              return result;
            } catch (error) {
              invoke(
                'setMfaStatus',
                'failure',
                'Network issue while requesting the code. Please retry.'
              );
              return {
                status: STATUS.FAILURE,
                reason: error?.message,
              };
            }
          },
          onSubmitCode: async (code) => {
            invoke('setMfaStatus', 'info', 'Validating code...');
            try {
              const verification = await activeBackend.verifyMfa({
                ccHash: payload.ccHash,
                cardNumber: payload.cardNumber,
                code,
              });
              if (verification.status === STATUS.SUCCESS) {
                invoke(
                  'setMfaStatus',
                  'success',
                  'Verification accepted. Completing transaction...'
                );
                invoke('hideMfa');
                invoke('toggleProcessing', false);
                resolve(verification);
              } else if (verification.status === STATUS.FAILURE) {
                invoke(
                  'setMfaStatus',
                  'failure',
                  verification.reason ||
                    'Verification failed. Transaction cancelled.'
                );
                invoke('hideMfa');
                invoke('toggleProcessing', false);
                resolve(verification);
              } else if (verification.status === STATUS.AUTH_REQUIRED) {
                if (verification.methods?.length) {
                  invoke('updateMfaMethods', verification.methods);
                }
                invoke('showCodeEntry');
                invoke(
                  'setMfaStatus',
                  'failure',
                  verification.message ||
                    'Code mismatch. Please try again or send a fresh code.'
                );
              }
            } catch (error) {
              invoke('showCodeEntry');
              invoke(
                'setMfaStatus',
                'failure',
                'Network issue while verifying the code. Please retry.'
              );
            }
          },
          onCancel: () => {
            const failure = {
              status: 'FAILURE',
              reason: 'Transaction cancelled, please contact merchant.',
            };
            invoke('hideMfa');
            invoke('toggleProcessing', false);
            resolve(failure);
          },
        });
      };

      launchMfa(response.methods);
    });
  };

  const wrapped = async (payload, overrideUI) => {
    const result = await orchestrateVeritas(payload, overrideUI);
    if (!result?.status) {
      return fallbackProcessor(payload, overrideUI);
    }
    return result;
  };

  wrapped.fallback = fallbackProcessor;
  return wrapped;
};

const enable = ({ processPayment, ui, backend } = {}) => {
  const modal = ensureVeritasModal();
  const resolvedUI = ui || createDefaultUI();
  const wrappedProcessor = wrapProcessor({
    processPayment,
    ui: resolvedUI,
    backend,
  });

  return {
    modal,
    ui: resolvedUI,
    processPayment: wrappedProcessor,
    fallbackProcess: wrappedProcessor.fallback,
  };
};

const computeCartTotal = (context) => {
  if (!context || typeof context.getCart !== 'function') return 0;
  const cart = context.getCart();
  if (!Array.isArray(cart)) return 0;
  return cart.reduce((sum, item) => {
    const price = Number(item?.price ?? 0);
    const quantity = Number(item?.quantity ?? 0);
    return sum + price * quantity;
  }, 0);
};

const resolveAutoPaymentContext = () => {
  if (typeof window === 'undefined') return null;
  const context = window.PaymentContext;
  if (!context) return null;
  const { elements = {} } = context;
  const form =
    elements.form ||
    document.querySelector('[data-veritas-payment-form]') ||
    document.getElementById('payment-form');
  if (!form) return null;

  return {
    ...context,
    elements: {
      form,
      statusPanel: elements.statusPanel || document.getElementById('payment-status'),
      summaryContainer: elements.summaryContainer || document.getElementById('order-summary'),
      grandTotalEl: elements.grandTotalEl || document.getElementById('grand-total'),
    },
  };
};

const formatTotalForDisplay = (context, totalValue) => {
  const formatter = context?.formatCurrency;
  if (typeof formatter === 'function') {
    return formatter(totalValue);
  }
  const numericValue = Number.isFinite(totalValue) ? Number(totalValue) : 0;
  return numericValue.toFixed(2);
};

const resolveDisplayedTotal = (context, totalValue) => {
  const totalEl = context?.elements?.grandTotalEl;
  if (totalEl?.textContent) {
    return totalEl.textContent;
  }
  return formatTotalForDisplay(context, totalValue);
};

const buildAutoPaymentPayload = (formEl, backendConfig = {}, context) => {
  const formData = new FormData(formEl);
  const cart = typeof context.getCart === 'function' ? context.getCart() : [];
  const customer =
    typeof context.getCustomerDetails === 'function' ? context.getCustomerDetails() : null;
  const rawCardNumber = (formData.get('cardNumber') || '').toString();
  const cardNumber = rawCardNumber.replace(/\s+/g, '');
  const total = computeCartTotal(context);
  const normalizedTotal = Number(total.toFixed(2));
  const locationSuggestion = [customer?.city, customer?.country].filter(Boolean).join(', ');

  const preferCustomerLocation = backendConfig.preferCustomerLocation ?? false;
  const location = preferCustomerLocation
    ? locationSuggestion
    : backendConfig.defaultLocation ?? null;

  return {
    cart,
    customer,
    cardNumber,
    cardMeta: {
      last4: cardNumber.slice(-4),
      brand: cardNumber.startsWith('4') ? 'Visa' : 'Luxury Card',
      expiry: formData.get('expiry'),
    },
    totals: {
      subtotal: normalizedTotal,
      currency: 'USD',
    },
    amount: normalizedTotal,
    location,
    useCustomerLocation: preferCustomerLocation,
    merchantApiKey: backendConfig.merchantApiKey,
    emailAddress: customer?.email,
  };
};

const handleAutoPaymentResponse = (response, PaymentUI, context) => {
  if (!response) return;

  if (response.status === STATUS.SUCCESS) {
    const totalValue = computeCartTotal(context);
    const order = {
      reference: response.reference || `LB-${Date.now()}`,
      total: resolveDisplayedTotal(context, totalValue),
      timestamp: new Date().toISOString(),
    };
    if (typeof context.saveOrder === 'function') {
      context.saveOrder(order);
    }
    if (typeof context.clearCart === 'function') {
      context.clearCart();
    }
    window.location.href = 'confirmation.html';
    return;
  }

  if (response.status === STATUS.FAILURE) {
    if (PaymentUI) {
      PaymentUI.showStatus(
        'failure',
        response.reason || 'Transaction cancelled, please contact merchant.'
      );
      PaymentUI.toggleProcessing?.(false);
    }
    return;
  }

  if (response.status === STATUS.AUTH_REQUIRED) {
    PaymentUI?.toggleProcessing?.(false);
  }
};

const processPaymentWithoutVeritas = (context, { onComplete } = {}) => {
  const statusPanel = context?.elements?.statusPanel;
  if (statusPanel) {
    statusPanel.classList.remove('hidden');
    statusPanel.textContent = 'Processing payment...';
  }

  setTimeout(() => {
    const totalValue = computeCartTotal(context);
    const order = {
      reference: `LB-${Date.now()}`,
      total: resolveDisplayedTotal(context, totalValue),
      timestamp: new Date().toISOString(),
    };
    if (typeof context.saveOrder === 'function') {
      context.saveOrder(order);
    }
    if (typeof context.clearCart === 'function') {
      context.clearCart();
    }
    if (typeof onComplete === 'function') {
      onComplete();
    }
    window.location.href = 'confirmation.html';
  }, 500);
};

let autoPaymentBound = false;

const setupAutoPaymentFormIntegration = () => {
  if (autoPaymentBound) return;
  const context = resolveAutoPaymentContext();
  const form = context?.elements?.form;
  if (!context || !form) return;
  if (!form.hasAttribute('data-veritas-payment-form')) return;
  if (form.dataset.veritasBound === 'true') return;

  const statusPanel = context.elements.statusPanel;
  let submitInFlight = false;
  let cachedUI = null;

  const getPaymentUI = () => {
    if (cachedUI) return cachedUI;
    cachedUI = createDefaultUI({
      form,
      statusElement: statusPanel,
      hiddenClass: 'hidden',
      baseStatusClass: 'mt-6 rounded-2xl border border-white/10 bg-black/40 p-6 text-sm',
      statusClasses: {
        info: 'text-champagne/80',
        success: 'border-success/50 text-success',
        failure: 'border-failure/50 text-failure',
      },
    });
    return cachedUI;
  };

  const submitHandler = async (event) => {
    event.preventDefault();
    if (submitInFlight) return;

    submitInFlight = true;

    const trimmedKey =
      typeof window.merchantApiKey === 'string' ? window.merchantApiKey.trim() : '';
    const baseConfig = window.VeritasConfig?.backend || window.VeritasConfig || {};
    const backendConfig = {
      ...baseConfig,
    };
    if (backendConfig.merchantApiKey == null && trimmedKey) {
      backendConfig.merchantApiKey = trimmedKey;
    }

    const hasMerchantKey = Boolean(
      typeof backendConfig.merchantApiKey === 'string'
        ? backendConfig.merchantApiKey.trim()
        : backendConfig.merchantApiKey
    );

    if (!hasMerchantKey) {
      processPaymentWithoutVeritas(context, {
        onComplete: () => {
          submitInFlight = false;
        },
      });
      return;
    }

    const PaymentUI = getPaymentUI();
    PaymentUI.clearStatus();
    PaymentUI.showStatus('info', 'Authorizing payment...');

    try {
      const payload = buildAutoPaymentPayload(form, backendConfig, context);
      const backendClient = createBackendClient(backendConfig);
      const integration = enable({
        ui: PaymentUI,
        backend: backendClient,
      });

      const response = await integration.processPayment(payload, PaymentUI);
      handleAutoPaymentResponse(response, PaymentUI, context);

      if (response?.status !== STATUS.SUCCESS) {
        submitInFlight = false;
      }
    } catch (error) {
      console.error('Payment error', error);
      if (statusPanel) {
        statusPanel.classList.remove('hidden');
        statusPanel.textContent = 'An unexpected error occurred. Please try again.';
      }
      if (cachedUI?.toggleProcessing) {
        cachedUI.toggleProcessing(false);
      }
      submitInFlight = false;
    }
  };

  const assignSubmitHandler =
    typeof context.setSubmitHandler === 'function' ? context.setSubmitHandler : null;

  if (assignSubmitHandler) {
    assignSubmitHandler(submitHandler);
  } else {
    form.addEventListener('submit', submitHandler);
  }

  autoPaymentBound = true;
  form.dataset.veritasBound = 'true';
};

const Veritas = {
  ensureModal: ensureVeritasModal,
  createDefaultUI,
  wrapProcessor,
  enable,
  createBackendClient,
  STATUS,
};

if (typeof window !== 'undefined') {
  window.Veritas = Veritas;

  // Auto-configure Veritas if not already configured
  if (!window.VeritasConfig) {
    try {
      const LOCAL_API_PORT = '3001';
      const isLocalHost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      const origin = isLocalHost
        ? `http://localhost:${LOCAL_API_PORT}`
        : window.location.origin;
      const trimTrailingSlash = (value) =>
        typeof value === 'string' && value.endsWith('/')
          ? value.slice(0, -1)
          : value;
      const baseOrigin = trimTrailingSlash(origin);
      window.VeritasConfig = {
        backend: {
          baseUrl: `${baseOrigin}/api`,
          defaultLocation: 'Paris',
          useCustomerLocation: false,
        },
      };
    } catch (error) {
      console.warn('Unable to configure Veritas defaults', error);
    }
  }

  const autoInitHandler = () => {
    try {
      setupAutoPaymentFormIntegration();
    } catch (error) {
      console.error('Veritas auto-init failed', error);
    }
  };

  document.addEventListener('veritas:payment-context-ready', autoInitHandler);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitHandler, { once: false });
  } else if (typeof queueMicrotask === 'function') {
    queueMicrotask(autoInitHandler);
  } else {
    Promise.resolve().then(autoInitHandler);
  }
}

export default Veritas;
