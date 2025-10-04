import { formatCurrency } from './products.js';
import {
  getCart,
  getCustomerDetails,
  clearCart,
  saveOrder,
} from './storage.js';
import { generateDeviceFingerprint } from './deviceFingerprint.js';

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

const buildPayload = async (formData, backendConfig = {}) => {
  const cart = getCart();
  const customer = getCustomerDetails();
  const rawCardNumber = formData.get('cardNumber') || '';
  const cardNumber = rawCardNumber.replace(/\s+/g, '');
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const normalizedTotal = Number(total.toFixed(2));
  const locationSuggestion = [customer?.city, customer?.country]
    .filter(Boolean)
    .join(', ');

  const preferCustomerLocation = backendConfig.preferCustomerLocation ?? false;
  const location = preferCustomerLocation
    ? locationSuggestion
    : backendConfig.defaultLocation ?? null;

  // Generate device fingerprint
  const deviceData = await generateDeviceFingerprint();

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
    deviceFingerprint: deviceData.fingerprint,
    deviceInfo: deviceData.info,
  };
};

const handleResponse = (response, PaymentUI) => {
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
    if (PaymentUI) {
      PaymentUI.showStatus(
        'failure',
        response.reason || 'Transaction cancelled, please contact merchant.'
      );
      PaymentUI.toggleProcessing(false);
    }
  } else if (response.status === 'AUTH_REQUIRED') {
    if (PaymentUI) {
      PaymentUI.toggleProcessing(false);
    }
  }
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitInFlight) return;

  submitInFlight = true;

  // Check if merchantApiKey is defined at runtime
  const hasMerchantKey = typeof window.merchantApiKey !== 'undefined' &&
                         window.merchantApiKey &&
                         window.merchantApiKey.trim() !== '';

  console.log('merchantApiKey check:', {
    defined: typeof window.merchantApiKey !== 'undefined',
    value: window.merchantApiKey,
    hasMerchantKey
  });

  if (hasMerchantKey) {
    // Dynamically import and use Veritas MFA flow
    try {
      const VeritasModule = await import('../veritas.js');
      const Veritas = VeritasModule.default;

      const backendConfig = {
        ...(window.VeritasConfig?.backend || window.VeritasConfig || {}),
      };

      const veritasBackendClient = Veritas.createBackendClient(backendConfig);

      const PaymentUI = Veritas.createDefaultUI({
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

      const veritasIntegration = Veritas.enable({
        ui: PaymentUI,
        backend: veritasBackendClient,
      });

      PaymentUI.clearStatus();
      PaymentUI.showStatus('info', 'Authorizing payment...');

      const formData = new FormData(form);
      const payload = await buildPayload(formData, backendConfig);

      const response = await veritasIntegration.processPayment(payload, PaymentUI);
      handleResponse(response, PaymentUI);

      if (response?.status !== 'SUCCESS') {
        submitInFlight = false;
      }
    } catch (error) {
      console.error('Payment error', error);
      if (statusPanel) {
        statusPanel.classList.remove('hidden');
        statusPanel.textContent = 'An unexpected error occurred. Please try again.';
      }
      submitInFlight = false;
    }
  } else {
    // Skip MFA and go directly to completion page when no merchant key
    if (statusPanel) {
      statusPanel.classList.remove('hidden');
      statusPanel.textContent = 'Processing payment...';
    }

    // Simulate a brief delay for better UX
    setTimeout(() => {
      const order = {
        reference: `LB-${Date.now()}`,
        total: grandTotalEl?.textContent,
        timestamp: new Date().toISOString(),
      };
      saveOrder(order);
      clearCart();
      window.location.href = 'confirmation.html';
    }, 500);
  }
});

renderSummary();

// Autofill shortcut with tilde (~) key
document.addEventListener('keydown', (event) => {
  if (event.key === '~' && form) {
    event.preventDefault();
    const testData = {
      cardName: 'Sophie Beaumont',
      cardNumber: '4242424242424242',
      expiry: '12/25',
      cvv: '123'
    };
    Object.entries(testData).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field) field.value = value;
    });
  }
});
