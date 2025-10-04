import { products } from "./products.js";
import { Storage } from "./storage.js";

const formatCurrency = (value) => `$${value.toFixed(2)}`;

const renderProduct = (product) => {
  const card = document.createElement("article");
  card.className = "bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden";
  card.innerHTML = `
    <img src="${product.image}" alt="${product.name}" class="h-48 w-full object-cover" />
    <div class="p-4 flex-1 flex flex-col">
      <h3 class="text-lg font-semibold text-slate-900">${product.name}</h3>
      <p class="mt-2 text-sm text-slate-600 flex-1">${product.description}</p>
      <div class="mt-4 flex items-center justify-between">
        <span class="text-lg font-bold text-slate-900">${formatCurrency(product.price)}</span>
        <button class="add-to-cart px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2" data-product-id="${product.id}">
          Add to cart
        </button>
      </div>
    </div>
  `;
  return card;
};

const updateCartBadge = () => {
  const badge = document.querySelector("[data-role='cart-count']");
  if (!badge) return;
  const count = Storage.getCart().reduce((total, item) => total + item.quantity, 0);
  badge.textContent = count;
  badge.classList.toggle("hidden", count === 0);
};

const renderCatalog = () => {
  const container = document.querySelector("[data-role='product-grid']");
  products.forEach((product) => {
    container.appendChild(renderProduct(product));
  });

  container.addEventListener("click", (event) => {
    const button = event.target.closest("button.add-to-cart");
    if (!button) return;
    const productId = button.dataset.productId;
    const product = products.find((item) => item.id === productId);
    Storage.addItem(productId);
    updateCartBadge();
    showToast(`${product?.name ?? "Item"} added to cart`);
  });
};

const showToast = (message) => {
  const toast = document.querySelector("[data-role='toast']");
  toast.textContent = message;
  toast.classList.remove("translate-y-6", "opacity-0");
  setTimeout(() => toast.classList.add("translate-y-6", "opacity-0"), 1800);
};

document.addEventListener("DOMContentLoaded", () => {
  renderCatalog();
  updateCartBadge();
});
