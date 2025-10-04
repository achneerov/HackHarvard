import { formatCurrency } from './products.js';
import {
  getCart,
  removeFromCart,
  updateQuantity,
  saveCustomerDetails,
  getCustomerDetails,
} from './storage.js';
import { refreshCartIndicator } from './header.js';

const cartItemsContainer = document.getElementById('cart-items');
const emptyMessage = document.getElementById('empty-message');
const subtotalValue = document.getElementById('subtotal-value');
const subtotalLabel = document.getElementById('subtotal-label');
const form = document.getElementById('customer-form');

const renderCart = () => {
  if (!cartItemsContainer) return;
  const cart = getCart();
  refreshCartIndicator();
  cartItemsContainer.innerHTML = '';

  if (cart.length === 0) {
    emptyMessage?.classList.remove('hidden');
    subtotalLabel.textContent = 'Subtotal';
    subtotalValue.textContent = formatCurrency(0);
    return;
  }

  emptyMessage?.classList.add('hidden');

  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  subtotalValue.textContent = formatCurrency(subtotal);

  cart.forEach((item) => {
    const wrapper = document.createElement('article');
    wrapper.className = 'flex gap-6 rounded-3xl border border-white/10 bg-white/5 p-6';
    wrapper.innerHTML = `
      <div class="h-32 w-24 overflow-hidden rounded-2xl">
        <img src="${item.image}" alt="${item.name}" class="h-full w-full object-cover" />
      </div>
      <div class="flex flex-1 flex-col justify-between">
        <div>
          <div class="flex items-center justify-between">
            <h3 class="font-display text-lg uppercase tracking-[0.3em] text-gold">${item.name}</h3>
            <button data-remove="${item.id}" class="text-xs uppercase tracking-[0.3em] text-champagne/50 transition hover:text-failure">Remove</button>
          </div>
          <p class="mt-2 text-sm text-champagne/70">${item.description}</p>
        </div>
        <div class="mt-4 flex items-center justify-between text-sm text-champagne/80">
          <div class="flex items-center gap-3">
            <button data-quantity="down" data-product="${item.id}" class="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-lg leading-none transition hover:border-gold hover:text-gold">−</button>
            <span class="w-8 text-center text-sm tracking-[0.2em]">${item.quantity}</span>
            <button data-quantity="up" data-product="${item.id}" class="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-lg leading-none transition hover:border-gold hover:text-gold">+</button>
          </div>
          <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
      </div>
    `;
    cartItemsContainer.appendChild(wrapper);
  });
};

const hydrateForm = () => {
  if (!form) return;
  const details = getCustomerDetails();
  if (!details) return;
  Object.entries(details).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  });
};

const handleCartClick = (event) => {
  const removeButton = event.target.closest('button[data-remove]');
  if (removeButton) {
    removeFromCart(removeButton.dataset.remove);
    renderCart();
    return;
  }
  const quantityButton = event.target.closest('button[data-quantity]');
  if (quantityButton) {
    const { quantity, product } = quantityButton.dataset;
    const cart = getCart();
    const item = cart.find((entry) => entry.id === product);
    if (!item) return;
    const newQty = quantity === 'up' ? item.quantity + 1 : item.quantity - 1;
    updateQuantity(product, Math.max(1, newQty));
    renderCart();
  }
};

const handleFormSubmit = (event) => {
  event.preventDefault();
  const cart = getCart();
  if (cart.length === 0) {
    alert('Your cart is empty. Please add items before proceeding.');
    return;
  }
  const data = Object.fromEntries(new FormData(form).entries());
  saveCustomerDetails(data);
  window.location.href = 'payment.html';
};

if (cartItemsContainer) {
  renderCart();
  cartItemsContainer.addEventListener('click', handleCartClick);
}

if (form) {
  hydrateForm();
  form.addEventListener('submit', handleFormSubmit);
}

// Autofill shortcut with tilde (~) key
document.addEventListener('keydown', (event) => {
  if (event.key === '~' && form) {
    event.preventDefault();
    const testData = {
      fullName: 'Sophie Beaumont',
      email: 'sophie.beaumont@example.com',
      phone: '+33 6 45 78 92 31',
      postalCode: '75008',
      address: '124 Avenue des Champs-Élysées',
      city: 'Paris',
      country: 'France'
    };
    Object.entries(testData).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field) field.value = value;
    });
  }
});
