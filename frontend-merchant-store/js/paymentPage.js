import { formatCurrency } from './products.js';
import { getCart, getCustomerDetails, clearCart, saveOrder } from './storage.js';

const form = document.getElementById('payment-form');
const statusPanel = document.getElementById('payment-status');
const summaryContainer = document.getElementById('order-summary');
const grandTotalEl = document.getElementById('grand-total');
let submitHandler = null;
let fallbackInFlight = false;

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

const computeCartTotal = () => {
  const cart = getCart();
  if (!Array.isArray(cart) || cart.length === 0) return 0;
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

const resolveDisplayTotal = (totalValue) => {
  if (grandTotalEl?.textContent) {
    return grandTotalEl.textContent;
  }
  return formatCurrency(totalValue);
};

const runFallbackPayment = () => {
  if (fallbackInFlight) return;
  fallbackInFlight = true;

  if (statusPanel) {
    statusPanel.classList.remove('hidden');
    statusPanel.textContent = 'Processing payment...';
  }

  setTimeout(() => {
    const totalValue = computeCartTotal();
    const order = {
      reference: `LB-${Date.now()}`,
      total: resolveDisplayTotal(totalValue),
      timestamp: new Date().toISOString(),
    };
    saveOrder(order);
    clearCart();
    fallbackInFlight = false;
    window.location.href = 'confirmation.html';
  }, 500);
};

const setSubmitHandler = (handler) => {
  submitHandler = typeof handler === 'function' ? handler : null;
};

const clearSubmitHandler = () => {
  submitHandler = null;
};

const handleFormSubmit = (event) => {
  if (typeof submitHandler === 'function') {
    submitHandler(event);
    return;
  }
  event.preventDefault();
  runFallbackPayment();
};

if (form) {
  form.addEventListener('submit', handleFormSubmit);
}

const paymentContext = {
  getCart,
  getCustomerDetails,
  clearCart,
  saveOrder,
  formatCurrency,
  disableForm,
  renderSummary,
  setSubmitHandler,
  clearSubmitHandler,
  elements: {
    form,
    statusPanel,
    summaryContainer,
    grandTotalEl,
  },
};

window.PaymentContext = paymentContext;
document.dispatchEvent(
  new CustomEvent('veritas:payment-context-ready', { detail: paymentContext })
);

renderSummary();

document.addEventListener('keydown', (event) => {
  if (event.key === '~' && form) {
    event.preventDefault();
    const testData = {
      cardName: 'Sophie Beaumont',
      cardNumber: '4242424242424242',
      expiry: '12/25',
      cvv: '123',
    };
    Object.entries(testData).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field) field.value = value;
    });
  }
});
