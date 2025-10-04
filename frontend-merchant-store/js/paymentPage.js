import AuthPay from '../authpay.js';
import { formatCurrency } from './products.js';
import {
  getCart,
  getCustomerDetails,
  clearCart,
  saveOrder,
} from './storage.js';

const backendConfig =
  (typeof window !== 'undefined' && {
    ...(window.AuthPayConfig?.backend || window.AuthPayConfig || {}),
  }) || {};

const authPayBackendClient = AuthPay.createBackendClient(backendConfig);

const form = document.getElementById('payment-form');
const statusPanel = document.getElementById('payment-status');
const summaryContainer = document.getElementById('order-summary');
const grandTotalEl = document.getElementById('grand-total');
let submitInFlight = false;

const disableForm = (disabled) => {
  if (!form) return;
  Array.from(form.elements).forEach((element) => {
    element.disabled = disabled;
  });
};

const PaymentUI = AuthPay.createDefaultUI({
  form,
  statusElement: statusPanel,
  hiddenClass: 'hidden',
  baseStatusClass:
    'mt-6 rounded-2xl border border-white/10 bg-black/40 p-6 text-sm',
  statusClasses: {
    info: 'text-champagne/80',
    success: 'border-success/50 text-success',
    failure: 'border-failure/50 text-failure',
  },
});

const originalToggleProcessing = PaymentUI.toggleProcessing?.bind(PaymentUI);
if (originalToggleProcessing) {
  PaymentUI.toggleProcessing = (state) => {
    originalToggleProcessing(state);
    submitInFlight = state;
  };
}

window.PaymentUI = PaymentUI;

const renderSummary = () => {
  if (!summaryContainer || !grandTotalEl) return;
  const cart = getCart();
  const customer = getCustomerDetails();
  if (cart.length === 0 || !customer) {
    summaryContainer.innerHTML =
      '<p class="text-sm text-champagne/70">Your cart is empty or missing concierge details. Return to the cart to continue.</p>';
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
      <span class="text-sm text-champagne/80">${formatCurrency(
        item.price * item.quantity
      )}</span>
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
  const rawCardNumber = formData.get('cardNumber') || '';
  const cardNumber = rawCardNumber.replace(/\s+/g, '');
  const ccHash = await hashCardNumber(cardNumber);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const normalizedTotal = Number(total.toFixed(2));
  const locationSuggestion = [customer?.city, customer?.country]
    .filter(Boolean)
    .join(', ');

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
      subtotal: normalizedTotal,
      currency: 'USD',
    },
    amount: normalizedTotal,
    location: locationSuggestion || backendConfig.defaultLocation || 'Online',
    merchantApiKey: backendConfig.merchantApiKey,
    emailAddress: customer?.email,
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
    PaymentUI.showStatus(
      'failure',
      response.reason || 'Transaction cancelled, please contact merchant.'
    );
    PaymentUI.toggleProcessing(false);
  } else if (response.status === 'AUTH_REQUIRED') {
    PaymentUI.toggleProcessing(false);
  }
};

const authPayIntegration = AuthPay.enable({
  ui: PaymentUI,
  backend: authPayBackendClient,
});

window.AuthPayIntegration = authPayIntegration;
const processWithAuthPay = authPayIntegration.processPayment;

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitInFlight) return;

  PaymentUI.clearStatus();
  PaymentUI.showStatus('info', 'Authorizing payment...');

  submitInFlight = true;
  const formData = new FormData(form);
  const payload = await buildPayload(formData);

  try {
    const response = await processWithAuthPay(payload, PaymentUI);
    handleResponse(response);
    if (response?.status !== 'SUCCESS') {
      submitInFlight = false;
    }
  } catch (error) {
    console.error('Payment error', error);
    PaymentUI.showStatus(
      'failure',
      'An unexpected error occurred. Please try again.'
    );
    PaymentUI.toggleProcessing(false);
    submitInFlight = false;
  }
});

renderSummary();
