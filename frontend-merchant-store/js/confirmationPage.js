import { getOrder, clearOrder } from './storage.js';

const summary = document.getElementById('confirmation-summary');

if (summary) {
  const order = getOrder();
  if (!order) {
    summary.innerHTML = '<p class="text-sm text-champagne/70">No recent order found. Return to the collections to begin a purchase.</p>';
  } else {
    summary.innerHTML = `
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-champagne/60">Order Reference</p>
        <p class="mt-2 text-lg text-gold">${order.reference}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-champagne/60">Total Paid</p>
        <p class="mt-2 text-lg text-champagne/80">${order.total}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-champagne/60">Timestamp</p>
        <p class="mt-2 text-sm text-champagne/70">${new Date(order.timestamp).toLocaleString()}</p>
      </div>
    `;
    clearOrder();
  }
}
