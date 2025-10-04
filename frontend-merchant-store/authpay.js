import { waitForAuth, webhookClient, verifyMFA } from './js/mockBackend.js';

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
      <div class="authpay-mfa-field">
        <label class="authpay-mfa-label" for="authpay-mfa-method">Verification Channel</label>
        <select id="authpay-mfa-method" class="authpay-mfa-select" data-authpay-method></select>
      </div>
      <div class="authpay-mfa-actions">
        <button type="button" class="authpay-mfa-button authpay-mfa-request" data-authpay-request>Send Code</button>
        <div class="authpay-mfa-field authpay-mfa-field--code">
          <label class="authpay-mfa-label" for="authpay-mfa-code">Enter Code</label>
          <input id="authpay-mfa-code" class="authpay-mfa-input" data-authpay-code inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="one-time-code" />
        </div>
        <button type="button" class="authpay-mfa-button authpay-mfa-submit" data-authpay-submit>Verify & Continue</button>
      </div>
      <p class="authpay-mfa-status" data-authpay-status></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const dialog = overlay.querySelector('.authpay-mfa-dialog');
  const closeButton = overlay.querySelector('[data-authpay-close]');
  const methodSelect = overlay.querySelector('[data-authpay-method]');
  const requestButton = overlay.querySelector('[data-authpay-request]');
  const codeInput = overlay.querySelector('[data-authpay-code]');
  const submitButton = overlay.querySelector('[data-authpay-submit]');
  const statusMessage = overlay.querySelector('[data-authpay-status]');

  let currentHandlers = null;

  const clearStatus = () => {
    statusMessage.textContent = '';
    statusMessage.classList.remove('is-visible');
    statusMessage.removeAttribute('data-type');
  };

  const closeOverlay = () => {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    clearStatus();
    codeInput.value = '';
    currentHandlers = null;
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

  requestButton.addEventListener('click', () => {
    if (!currentHandlers?.onRequestCode) return;
    const method = methodSelect.value;
    runSafely(requestButton, () => currentHandlers.onRequestCode(method));
  });

  submitButton.addEventListener('click', () => {
    if (!currentHandlers?.onSubmitCode) return;
    const code = codeInput.value.trim();
    if (code.length !== 6) {
      window.AuthPayModal.setStatus('failure', 'Please enter the 6-digit code.');
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

  const open = ({ methods, onRequestCode, onSubmitCode, onCancel }) => {
    methodSelect.innerHTML = '';
    methods.forEach((method) => {
      const option = document.createElement('option');
      option.value = method.id;
      option.textContent = method.label;
      methodSelect.appendChild(option);
    });

    currentHandlers = { onRequestCode, onSubmitCode, onCancel };
    codeInput.value = '';
    clearStatus();
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    dialog.focus();
  };

  const close = () => {
    closeOverlay();
  };

  const setStatus = (type, message) => {
    if (!message) {
      clearStatus();
      return;
    }
    statusMessage.textContent = message;
    statusMessage.setAttribute('data-type', type);
    statusMessage.classList.add('is-visible');
  };

  const api = { open, close, setStatus };
  window.AuthPayModal = api;
  return api;
};

const enableAuthPay = () => {
  ensureAuthPayModal();
  const fallbackProcess = window.process_payment;

  const orchestrateAuthPay = async (payload, ui) => {
    ui.showStatus('info', 'Routing through AuthPay orchestration...');
    ui.toggleProcessing(true);

    await waitForAuth();
    const response = await webhookClient.processTransaction(payload);

    if (response.status === 'SUCCESS') {
      ui.showStatus('success', 'Payment authorized. Preparing confirmation...');
      return response;
    }

    if (response.status === 'FAILURE') {
      ui.showStatus('failure', response.reason || 'Transaction cancelled, please contact merchant.');
      ui.toggleProcessing(false);
      return response;
    }

    if (response.status !== 'AUTH_REQUIRED') {
      ui.toggleProcessing(false);
      return response;
    }

    ui.showStatus('info', 'Additional authentication required.');

    return await new Promise((resolve) => {
      const launchMfa = (methods) => {
        ui.showMfa({
          methods,
          onRequestCode: async (method) => {
            ui.setMfaStatus('info', `Requesting code via ${method.toUpperCase()}...`);
            const result = await webhookClient.requestMfaCode({ ccHash: payload.ccHash, method });
            ui.setMfaStatus('success', result.message || 'Verification code dispatched.');
            return result;
          },
          onSubmitCode: async (code) => {
            ui.setMfaStatus('info', 'Validating code...');
            const verification = await verifyMFA({ ccHash: payload.ccHash, code });
            if (verification.status === 'SUCCESS') {
              ui.setMfaStatus('success', 'Verification accepted. Completing transaction...');
              ui.hideMfa();
              resolve(verification);
            } else if (verification.status === 'FAILURE') {
              ui.setMfaStatus('failure', verification.reason || 'Verification failed. Transaction cancelled.');
              ui.hideMfa();
              ui.toggleProcessing(false);
              resolve(verification);
            } else if (verification.status === 'AUTH_REQUIRED') {
              ui.setMfaStatus('info', verification.message || 'Select an alternate authentication method.');
              launchMfa(verification.methods);
            }
          },
          onCancel: () => {
            const failure = {
              status: 'FAILURE',
              reason: 'Transaction cancelled, please contact merchant.',
            };
            ui.hideMfa();
            ui.toggleProcessing(false);
            resolve(failure);
          },
        });
      };

      launchMfa(response.methods);
    });
  };

  window.process_payment = orchestrateAuthPay;
  window.AuthPayIntegration = {
    processPayment: orchestrateAuthPay,
    fallbackProcess,
  };
};

if (window.PaymentUI) {
  enableAuthPay();
} else {
  window.addEventListener('DOMContentLoaded', enableAuthPay, { once: true });
}
