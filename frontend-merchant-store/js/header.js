import { getCart } from './storage.js';

const CART_STORAGE_KEY = 'lb_cart';
const CART_BUTTON_SELECTOR = '[data-cart-button]';

const calculateCartCount = () =>
  getCart().reduce((total, item) => total + (item.quantity ?? 0), 0);

const updateCartButton = () => {
  const cartButton = document.querySelector(CART_BUTTON_SELECTOR);
  if (!cartButton) return;

  const badge = cartButton.querySelector('[data-cart-count]');
  const count = calculateCartCount();

  if (badge) {
    badge.textContent = count;
  }

  cartButton.setAttribute('aria-label', `Cart (${count} items)`);
};

const handleStorageChange = (event) => {
  if (event.storageArea !== localStorage) return;
  if (event.key !== CART_STORAGE_KEY) return;
  updateCartButton();
};

updateCartButton();
window.addEventListener('storage', handleStorageChange);

export const refreshCartIndicator = () => {
  updateCartButton();
  const cartButton = document.querySelector(CART_BUTTON_SELECTOR);
  cartButton?.dispatchEvent(new CustomEvent('cart-indicator:updated', { detail: { count: calculateCartCount() } }));
};
