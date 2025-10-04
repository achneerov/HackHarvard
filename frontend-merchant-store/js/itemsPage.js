import { products, formatCurrency } from './products.js';
import { addToCart } from './storage.js';
import { refreshCartIndicator } from './header.js';

const productGrid = document.getElementById('product-grid');

const renderProducts = () => {
  if (!productGrid) return;
  productGrid.innerHTML = '';
  products.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'group overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur transition hover:border-gold hover:bg-white/10';

    card.innerHTML = `
      <div class="relative aspect-[4/5] overflow-hidden">
        <img src="${product.image}" alt="${product.name}" class="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
        <button data-product="${product.id}" class="absolute left-4 bottom-4 rounded-full border border-gold bg-gold px-5 py-2 text-xs uppercase tracking-[0.3em] text-night transition hover:bg-transparent hover:text-gold">Add to Cart</button>
      </div>
      <div class="space-y-3 p-6">
        <h3 class="font-display text-xl uppercase tracking-[0.3em] text-gold">${product.name}</h3>
        <p class="text-sm text-champagne/70">${product.description}</p>
        <p class="text-lg text-champagne/90">${formatCurrency(product.price)}</p>
      </div>
    `;

    productGrid.appendChild(card);
  });
};

const handleAddToCart = (event) => {
  const button = event.target.closest('button[data-product]');
  if (!button) return;
  const productId = button.getAttribute('data-product');
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  addToCart(product, 1);
  refreshCartIndicator();
  button.textContent = 'Added';
  button.classList.remove('bg-gold', 'text-night');
  button.classList.add('border-white/40', 'text-champagne/80');
  setTimeout(() => {
    button.textContent = 'Add to Cart';
    button.classList.add('bg-gold', 'text-night');
    button.classList.remove('border-white/40', 'text-champagne/80');
  }, 1400);
};

if (productGrid) {
  renderProducts();
  productGrid.addEventListener('click', handleAddToCart);
  refreshCartIndicator();
}
