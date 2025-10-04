import { Storage } from "./storage.js";

const formatDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleString();
};

document.addEventListener("DOMContentLoaded", () => {
  const summaryEl = document.querySelector("[data-role='summary']");
  const transaction = Storage.getTransaction();

  if (!transaction) {
    summaryEl.innerHTML = `
      <p class="text-slate-600">We couldn't find your order details. This usually happens if the page was refreshed after completion.</p>
      <a href="index.html" class="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Return to shop</a>
    `;
    return;
  }

  summaryEl.innerHTML = `
    <div class="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
      <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Order ID</p>
      <p class="mt-1 text-xl font-semibold text-slate-900">${transaction.orderId}</p>
      <p class="mt-4 text-sm text-slate-600">Placed on ${formatDate(transaction.placedAt)}</p>
      <a href="index.html" class="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Continue shopping</a>
    </div>
  `;

  Storage.clearTransaction();
});
