import { products } from "./products.js";
import { Storage } from "./storage.js";

const findProduct = (id) => products.find((product) => product.id === id);
const formatCurrency = (value) => `$${value.toFixed(2)}`;

const renderCart = () => {
  const list = document.querySelector("[data-role='cart-items']");
  const summaryTotal = document.querySelector("[data-role='order-total']");
  const cart = Storage.getCart();

  list.innerHTML = "";
  if (cart.length === 0) {
    list.innerHTML = `<p class="text-slate-500">Your cart is empty. <a href="index.html" class="text-indigo-600">Continue shopping</a></p>`;
    summaryTotal.textContent = "$0.00";
    document.querySelector("[data-role='checkout-button']").disabled = true;
    return;
  }

  let total = 0;
  cart.forEach((item) => {
    const product = findProduct(item.productId);
    if (!product) return;
    const lineTotal = product.price * item.quantity;
    total += lineTotal;

    const row = document.createElement("div");
    row.className = "flex items-center justify-between py-4 border-b border-slate-200 gap-4";
    row.innerHTML = `
      <div class="flex items-center gap-4">
        <img src="${product.image}" alt="${product.name}" class="h-16 w-16 rounded-lg object-cover" />
        <div>
          <p class="font-medium text-slate-900">${product.name}</p>
          <p class="text-sm text-slate-500">${formatCurrency(product.price)}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <input type="number" min="1" value="${item.quantity}" data-role="quantity" data-product-id="${product.id}" class="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center" />
        <button data-role="remove" data-product-id="${product.id}" class="text-sm text-red-600">Remove</button>
        <span class="font-semibold text-slate-900">${formatCurrency(lineTotal)}</span>
      </div>
    `;
    list.appendChild(row);
  });

  summaryTotal.textContent = formatCurrency(total);
  document.querySelector("[data-role='checkout-button']").disabled = false;
};

const updateCartBadge = () => {
  const badge = document.querySelector("[data-role='cart-count']");
  if (!badge) return;
  const count = Storage.getCart().reduce((total, item) => total + item.quantity, 0);
  badge.textContent = count;
  badge.classList.toggle("hidden", count === 0);
};

const bindCartEvents = () => {
  const list = document.querySelector("[data-role='cart-items']");
  list.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-role='quantity']");
    if (!input) return;
    const quantity = Math.max(1, parseInt(input.value, 10) || 1);
    Storage.updateQuantity(input.dataset.productId, quantity);
    renderCart();
    updateCartBadge();
  });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-role='remove']");
    if (!button) return;
    Storage.removeItem(button.dataset.productId);
    renderCart();
    updateCartBadge();
  });
};

const bindShippingForm = () => {
  const form = document.querySelector("[data-role='shipping-form']");
  const saved = Storage.getShipping();
  Object.keys(saved).forEach((key) => {
    if (form.elements[key]) {
      form.elements[key].value = saved[key];
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const shipping = Object.fromEntries(formData.entries());
    Storage.setShipping(shipping);
    window.location.href = "payment.html";
  });
};

const init = () => {
  renderCart();
  updateCartBadge();
  bindCartEvents();
  bindShippingForm();
};

document.addEventListener("DOMContentLoaded", init);
