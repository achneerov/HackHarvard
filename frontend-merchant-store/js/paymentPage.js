import { formatCurrency } from './products.js';
import {
  getCart,
  getCustomerDetails,
  clearCart,
  saveOrder,
} from './storage.js';

const form = document.getElementById('payment-form');
const statusPanel = document.getElementById('payment-status');
const summaryContainer = document.getElementById('order-summary');
const grandTotalEl = document.getElementById('grand-total');
const modal = document.getElementById('mfa-modal');
const modalClose = document.getElementById('mfa-close');
const modalSelect = document.getElementById('mfa-method');
const modalRequest = document.getElementById('mfa-request');
const modalCode = document.getElementById('mfa-code');
const modalSubmit = document.getElementById('mfa-submit');
const modalStatus = document.getElementById('mfa-status');

let submitInFlight = false;
let mfaHandlers = null;

const disableForm = (disabled) => {
  if (!form) return;
  Array.from(form.elements).forEach((element) => {
    element.disabled = disabled;
  });
};

const PaymentUI = {
  showStatus(type, message) {
    if (!statusPanel) return;
    statusPanel.classList.remove('hidden');
    statusPanel.textContent = message;
    statusPanel.className = 'mt-6 rounded-2xl border border-white/10 bg-black/40 p-6 text-sm';
    if (type === 'success') {
      statusPanel.classList.add('border-success/50', 'text-success');
    } else if (type === 'failure') {
      statusPanel.classList.add('border-failure/50', 'text-failure');
    } else {
      statusPanel.classList.add('text-champagne/80');
    }
  },
  clearStatus() {
    if (!statusPanel) return;
    statusPanel.classList.add('hidden');
    statusPanel.textContent = '';
  },
  toggleProcessing(isProcessing) {
    disableForm(isProcessing);
    submitInFlight = isProcessing;
  },
  showMfa({ methods, onRequestCode, onSubmitCode, onCancel }) {
    if (!modal) return;
    mfaHandlers = { onRequestCode, onSubmitCode, onCancel };
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modalStatus?.classList.add('hidden');
    modalStatus.textContent = '';
    modalCode.value = '';
    modalSelect.innerHTML = '';
    methods.forEach((method) => {
      const option = document.createElement('option');
      option.value = method.id;
      option.textContent = method.label;
      modalSelect.appendChild(option);
    });
  },
  hideMfa() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    mfaHandlers = null;
  },
  setMfaStatus(type, message) {
    if (!modalStatus) return;
    modalStatus.classList.remove('hidden');
    modalStatus.textContent = message;
    modalStatus.className = 'hidden rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-champagne/70';
    modalStatus.classList.remove('hidden');
    if (type === 'success') {
      modalStatus.classList.add('border-success/60', 'text-success');
    } else if (type === 'failure') {
      modalStatus.classList.add('border-failure/60', 'text-failure');
    } else {
      modalStatus.classList.add('text-champagne/80');
    }
  },
};

window.PaymentUI = PaymentUI;

modalRequest?.addEventListener('click', async () => {
  if (!mfaHandlers?.onRequestCode) return;
  PaymentUI.setMfaStatus('info', 'Requesting verification code...');
  const method = modalSelect.value;
  await mfaHandlers.onRequestCode(method);
});

modalSubmit?.addEventListener('click', async () => {
  if (!mfaHandlers?.onSubmitCode) return;
  const code = modalCode.value.trim();
  if (code.length !== 6) {
    PaymentUI.setMfaStatus('failure', 'Please enter the 6-digit code.');
    return;
  }
  await mfaHandlers.onSubmitCode(code);
});

modalClose?.addEventListener('click', () => {
  if (mfaHandlers?.onCancel) {
    mfaHandlers.onCancel();
  }
  PaymentUI.hideMfa();
});

const renderSummary = () => {
  if (!summaryContainer || !grandTotalEl) return;
  const cart = getCart();
  const customer = getCustomerDetails();
  if (cart.length === 0 || !customer) {
    summaryContainer.innerHTML = '<p class="text-sm text-champagne/70">Your cart is empty or missing concierge details. Return to the cart to continue.</p>';
    grandTotalEl.textContent = formatCurrency(0);
    disableForm(true);
    return;
  }
  disableForm(false);
  summaryContainer.innerHTML = '';
  cart.forEach((item) => {
    const line = document.createElement('div');
    line.className = 'flex items-start justify-between gap-4';
    line.innerHTML = `
      <span class="text-sm text-champagne/70">${item.name} × ${item.quantity}</span>
      <span class="text-sm text-champagne/80">${formatCurrency(item.price * item.quantity)}</span>
    `;
    summaryContainer.appendChild(line);
  });
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  grandTotalEl.textContent = formatCurrency(total);
};

const hashCardNumber = async (cardNumber) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(cardNumber);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const buildPayload = async (formData) => {
  const cart = getCart();
  const customer = getCustomerDetails();
  const cardNumber = formData.get('cardNumber');
  const ccHash = await hashCardNumber(cardNumber);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    cart,
    customer,
    ccHash,
    cardMeta: {
      last4: cardNumber.slice(-4),
      brand: cardNumber.startsWith('4') ? 'Visa' : 'Luxury Card',
      expiry: formData.get('expiry'),
    },
    totals: {
      subtotal: total,
      currency: 'USD',
    },
  };
};

const handleResponse = (response) => {
  if (!response) return;
  if (response.status === 'SUCCESS') {
    const order = {
      reference: response.reference || `LB-${Date.now()}`,
      total: grandTotalEl?.textContent,
      timestamp: new Date().toISOString(),
    };
    saveOrder(order);
    clearCart();
    window.location.href = 'confirmation.html';
  } else if (response.status === 'FAILURE') {
    PaymentUI.showStatus('failure', response.reason || 'Transaction cancelled, please contact merchant.');
    PaymentUI.toggleProcessing(false);
  } else if (response.status === 'AUTH_REQUIRED') {
    PaymentUI.toggleProcessing(false);
  }
};

const baseProcessPayment = async () => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return {
    status: 'SUCCESS',
    reference: `LB-${Date.now()}`,
  };
};

window.process_payment = window.process_payment || baseProcessPayment;

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitInFlight) return;
  PaymentUI.clearStatus();
  PaymentUI.showStatus('info', 'Authorizing payment...');

  const formData = new FormData(form);

  PaymentUI.toggleProcessing(true);
  const payload = await buildPayload(formData);

  try {
    const response = await window.process_payment(payload, PaymentUI);
    handleResponse(response);
  } catch (error) {
    console.error('Payment error', error);
    PaymentUI.showStatus('failure', 'An unexpected error occurred. Please try again.');
    PaymentUI.toggleProcessing(false);
  }
});

renderSummary();
