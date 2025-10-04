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
  const raw = window.AuthPayConfig || window.authPayConfig || {};
  return raw.backend || raw;
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
      id: normalizedId || 'authpay-method',
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
  throw new Error('AuthPay: Fetch API is not available in this environment.');
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
        data = { message: 'Invalid response format from AuthPay server.' };
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

    if (!hashCC) throw new Error('AuthPay: Missing `ccHash` in payload.');
    if (amount == null) throw new Error('AuthPay: Missing `amount` in payload.');
    if (!apiKey) throw new Error('AuthPay: Missing `merchantApiKey`.');
    if (!emailAddress) throw new Error('AuthPay: Missing `emailAddress`.');

    const requestBody = {
      hashCC,
      amount,
      merchantApiKey: apiKey,
      emailAddress,
    };

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
    async requestCode({ ccHash, method, email, phone, merchantApiKey: overrideKey, location } = {}) {
      if (!ccHash) throw new Error('AuthPay: Missing `ccHash` when requesting a code.');
      if (!method) throw new Error('AuthPay: Missing `method` when requesting a code.');
      const body = {
        hashCC: ccHash,
        authMode: method,
      };
      if (email) body.email = email;
      if (phone) body.phone = phone;
      const keyToUse = overrideKey || merchantApiKey;
      if (keyToUse) body.merchantApiKey = keyToUse;
      if (location !== undefined) body.location = location;
      const data = await post('/requestCode', body);
      return normalizeRequestResponse(data);
    },
    async verifyMfa({ ccHash, code } = {}) {
      if (!ccHash) throw new Error('AuthPay: Missing `ccHash` when verifying MFA.');
      if (!code) throw new Error('AuthPay: Missing `code` when verifying MFA.');
      const data = await post('/verifyMFA', { hashCC: ccHash, code });
      return normalizeRequestResponse(data);
    },
    async completeSignup({
      ccHash,
      email,
      phone,
      location,
      merchantApiKey: overrideKey,
      amount,
    } = {}) {
      if (!ccHash) throw new Error('AuthPay: Missing `ccHash` when completing sign-up.');
      if (!email) throw new Error('AuthPay: Missing `email` when completing sign-up.');
      if (!phone) throw new Error('AuthPay: Missing `phone` when completing sign-up.');
      const keyToUse = overrideKey || merchantApiKey;
      if (!keyToUse) throw new Error('AuthPay: Missing `merchantApiKey` when completing sign-up.');
      if (amount == null) throw new Error('AuthPay: Missing `amount` when completing sign-up.');

      const body = {
        hashCC: ccHash,
        email,
        phone,
        merchantApiKey: keyToUse,
        amount,
      };

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

const ensureAuthPayModal = () => {
  if (window.AuthPayModal) return window.AuthPayModal;

  const styleId = 'authpay-mfa-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .authpay-mfa-overlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(8, 6, 19, 0.85);
        backdrop-filter: blur(8px);
        z-index: 9999;
      }
      .authpay-mfa-overlay.is-visible {
        display: flex;
      }
      .authpay-mfa-dialog {
        width: min(460px, calc(100% - 32px));
        border-radius: 24px;
        padding: 32px 28px 28px;
        background: radial-gradient(circle at top left, rgba(118, 92, 184, 0.45), rgba(22, 15, 38, 0.95));
        border: 1px solid rgba(174, 144, 245, 0.35);
        box-shadow: 0 32px 60px rgba(4, 0, 24, 0.45);
        color: #f0ecff;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        position: relative;
      }
      .authpay-mfa-dialog:focus {
        outline: none;
        box-shadow: 0 32px 60px rgba(4, 0, 24, 0.45), 0 0 0 2px rgba(174, 144, 245, 0.55);
      }
      .authpay-mfa-close {
        position: absolute;
        top: 18px;
        right: 18px;
        border: none;
        background: rgba(240, 236, 255, 0.08);
        color: #f0ecff;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        transition: background 160ms ease, transform 160ms ease;
      }
      .authpay-mfa-close:hover {
        background: rgba(240, 236, 255, 0.18);
        transform: scale(1.05);
      }
      .authpay-mfa-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(174, 144, 245, 0.18);
        border: 1px solid rgba(174, 144, 245, 0.35);
        font-size: 11px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
      }
      .authpay-mfa-heading {
        margin: 18px 0 10px;
        font-size: 26px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .authpay-mfa-copy {
        margin: 0 0 24px;
        font-size: 13px;
        line-height: 1.6;
        color: rgba(240, 236, 255, 0.78);
      }
      .authpay-mfa-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 18px;
      }
      .authpay-mfa-label {
        font-size: 11px;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: rgba(240, 236, 255, 0.66);
      }
      .authpay-mfa-select,
      .authpay-mfa-input {
        border: 1px solid rgba(174, 144, 245, 0.35);
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(10, 8, 22, 0.78);
        color: #f0ecff;
        font-size: 14px;
        letter-spacing: 0.08em;
      }
      .authpay-mfa-select:focus,
      .authpay-mfa-input:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(174, 144, 245, 0.45);
      }
      .authpay-mfa-input::placeholder {
        color: rgba(240, 236, 255, 0.35);
      }
      .authpay-mfa-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .authpay-mfa-button {
        border: none;
        border-radius: 999px;
        padding: 13px 18px;
        font-size: 12px;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        cursor: pointer;
        transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
      }
      .authpay-mfa-request {
        background: linear-gradient(120deg, rgba(173, 143, 245, 0.95), rgba(124, 97, 198, 0.95));
        color: #0c0416;
        box-shadow: 0 16px 30px rgba(52, 30, 126, 0.45);
      }
      .authpay-mfa-submit {
        background: transparent;
        border: 1px solid rgba(174, 144, 245, 0.55);
        color: #f0ecff;
      }
      .authpay-mfa-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 18px 36px rgba(52, 30, 126, 0.35);
      }
      .authpay-mfa-button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
      .authpay-mfa-status {
        margin-top: 16px;
        border-radius: 16px;
        padding: 12px 16px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        display: none;
        border: 1px solid transparent;
      }
      .authpay-mfa-status.is-visible {
        display: block;
      }
      .authpay-mfa-status[data-type="info"] {
        border-color: rgba(173, 143, 245, 0.45);
        color: rgba(240, 236, 255, 0.78);
      }
      .authpay-mfa-status[data-type="success"] {
        border-color: rgba(75, 214, 166, 0.45);
        color: rgba(181, 246, 219, 0.9);
      }
      .authpay-mfa-status[data-type="failure"] {
        border-color: rgba(242, 119, 145, 0.45);
        color: rgba(254, 194, 208, 0.9);
      }
      .authpay-mfa-hidden {
        display: none !important;
      }
      @media (max-width: 480px) {
        .authpay-mfa-heading {
          font-size: 22px;
        }
        .authpay-mfa-dialog {
          padding: 28px 22px 24px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.id = 'authpay-mfa-overlay';
  overlay.className = 'authpay-mfa-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="authpay-mfa-dialog" role="dialog" aria-modal="true" aria-labelledby="authpay-mfa-title" tabindex="-1">
      <button type="button" class="authpay-mfa-close" data-authpay-close aria-label="Cancel verification">×</button>
      <span class="authpay-mfa-chip">AuthPay Shield</span>
      <h2 id="authpay-mfa-title" class="authpay-mfa-heading">Multi-Factor Checkpoint</h2>
      <p class="authpay-mfa-copy">Confirm this maison purchase with a one-time code delivered through your preferred channel.</p>
      <div class="authpay-mfa-section authpay-mfa-hidden" data-authpay-signup>
        <div class="authpay-mfa-field">
          <label class="authpay-mfa-label" for="authpay-signup-email">Email Address</label>
          <input id="authpay-signup-email" class="authpay-mfa-input" type="email" data-authpay-signup-email placeholder="name@example.com" autocomplete="email" />
        </div>
        <div class="authpay-mfa-field">
          <label class="authpay-mfa-label" for="authpay-signup-phone">Phone Number</label>
          <input id="authpay-signup-phone" class="authpay-mfa-input" type="tel" data-authpay-signup-phone placeholder="+1 555 555 5555" autocomplete="tel" />
        </div>
        <button type="button" class="authpay-mfa-button authpay-mfa-request" data-authpay-signup-submit>Confirm & Send Code</button>
      </div>
      <div class="authpay-mfa-field" data-authpay-method-block>
        <label class="authpay-mfa-label" for="authpay-mfa-method">Verification Channel</label>
        <select id="authpay-mfa-method" class="authpay-mfa-select" data-authpay-method></select>
      </div>
      <div class="authpay-mfa-actions">
        <button type="button" class="authpay-mfa-button authpay-mfa-request" data-authpay-request>Send Code</button>
        <div class="authpay-mfa-field authpay-mfa-field--code authpay-mfa-hidden" data-authpay-code-block>
          <label class="authpay-mfa-label" for="authpay-mfa-code">Enter Code</label>
          <input id="authpay-mfa-code" class="authpay-mfa-input" data-authpay-code inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="one-time-code" />
        </div>
        <button type="button" class="authpay-mfa-button authpay-mfa-submit authpay-mfa-hidden" data-authpay-submit>Verify & Continue</button>
      </div>
      <p class="authpay-mfa-status" data-authpay-status></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const dialog = overlay.querySelector('.authpay-mfa-dialog');
  const closeButton = overlay.querySelector('[data-authpay-close]');
  const methodSelect = overlay.querySelector('[data-authpay-method]');
  const methodBlock = overlay.querySelector('[data-authpay-method-block]');
  const requestButton = overlay.querySelector('[data-authpay-request]');
  const codeBlock = overlay.querySelector('[data-authpay-code-block]');
  const codeInput = overlay.querySelector('[data-authpay-code]');
  const submitButton = overlay.querySelector('[data-authpay-submit]');
  const statusMessage = overlay.querySelector('[data-authpay-status]');
  const signupSection = overlay.querySelector('[data-authpay-signup]');
  const signupEmailInput = overlay.querySelector('[data-authpay-signup-email]');
  const signupPhoneInput = overlay.querySelector('[data-authpay-signup-phone]');
  const signupButton = overlay.querySelector('[data-authpay-signup-submit]');
  const chipElement = overlay.querySelector('.authpay-mfa-chip');
  const headingElement = overlay.querySelector('.authpay-mfa-heading');
  const copyElement = overlay.querySelector('.authpay-mfa-copy');

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
    overlay.dataset.authpayMode = mode;
    const isSignup = mode === 'signup';
    signupSection?.classList.toggle('authpay-mfa-hidden', !isSignup);
    methodBlock?.classList.toggle('authpay-mfa-hidden', isSignup);
    requestButton?.classList.toggle('authpay-mfa-hidden', isSignup);
  };

  const clearStatus = () => {
    statusMessage.textContent = '';
    statusMessage.classList.remove('is-visible');
    statusMessage.removeAttribute('data-type');
  };

  const setCodeEntryVisible = (visible) => {
    elementsRequiringCode.forEach((element) => {
      if (!element) return;
      element.classList.toggle('authpay-mfa-hidden', !visible);
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

  window.AuthPayModal = api;
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
  const modal = ensureAuthPayModal();
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

  const orchestrateAuthPay = async (payload, overrideUI) => {
    const paymentUI = overrideUI || ui;
    const invoke = (method, ...args) =>
      typeof paymentUI?.[method] === 'function'
        ? paymentUI[method](...args)
        : undefined;

    invoke('showStatus', 'info', 'Routing through AuthPay orchestration...');
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
          headline: 'Create AuthPay Profile',
          copy: 'Provide your email and phone to finish verifying this purchase.',
          chipText: 'AuthPay Onboarding',
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
    const result = await orchestrateAuthPay(payload, overrideUI);
    if (!result?.status) {
      return fallbackProcessor(payload, overrideUI);
    }
    return result;
  };

  wrapped.fallback = fallbackProcessor;
  return wrapped;
};

const enable = ({ processPayment, ui, backend } = {}) => {
  const modal = ensureAuthPayModal();
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

const AuthPay = {
  ensureModal: ensureAuthPayModal,
  createDefaultUI,
  wrapProcessor,
  enable,
  createBackendClient,
  STATUS,
};

if (typeof window !== 'undefined') {
  window.AuthPay = AuthPay;
}

export default AuthPay;
