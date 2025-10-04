import "./payment-processor.js";
import { products } from "./products.js";
import { Storage } from "./storage.js";
import { MfaModal } from "./mfa-modal.js";
import { MockBackend } from "./mock-backend.js";

const formatCurrency = (value) => `$${value.toFixed(2)}`;
const encoder = new TextEncoder();

const hashCardDetails = async ({ number, expMonth, expYear, cvc }) => {
  const normalized = `${number.replace(/\s+/g, "")}|${expMonth}|${expYear}|${cvc}`;
  const data = encoder.encode(normalized);
  if (window.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash)}`;
};

const calculateCartSummary = () => {
  const cart = Storage.getCart();
  let total = 0;
  const lines = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return null;
      const lineTotal = product.price * item.quantity;
      total += lineTotal;
      return { ...product, quantity: item.quantity, lineTotal };
    })
    .filter(Boolean);
  return { lines, total };
};

const statusStyles = {
  info: "bg-slate-50 text-slate-600 border border-slate-200",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  error: "bg-rose-50 text-rose-700 border border-rose-200"
};

const renderSummary = () => {
  const { lines, total } = calculateCartSummary();
  const container = document.querySelector("[data-role='order-lines']");
  const totalEl = document.querySelector("[data-role='order-total']");
  const shipping = Storage.getShipping();
  const shippingEl = document.querySelector("[data-role='shipping-summary']");

  container.innerHTML = "";
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = "flex justify-between text-sm text-slate-700";
    row.innerHTML = `
      <span>${line.name} × ${line.quantity}</span>
      <span>${formatCurrency(line.lineTotal)}</span>
    `;
    container.appendChild(row);
  });

  totalEl.textContent = formatCurrency(total);
  shippingEl.innerHTML = `
    <p class="font-medium text-slate-900">${shipping.fullName || "—"}</p>
    <p class="text-sm text-slate-600">${shipping.address || "Address pending"}</p>
    <p class="text-sm text-slate-600">${shipping.city || ""} ${shipping.state || ""} ${shipping.postalCode || ""}</p>
    <p class="text-xs text-slate-500 mt-1">${shipping.email || ""}${shipping.phone ? ` • ${shipping.phone}` : ""}</p>
  `;
};

const setStatus = (message, variant = "info") => {
  const el = document.querySelector("[data-role='status']");
  el.textContent = message;
  el.dataset.variant = variant;
  const base = "rounded-lg px-4 py-3 text-sm";
  el.className = `${base} ${statusStyles[variant] || statusStyles.info}`;
};

const setLoading = (loading) => {
  const button = document.querySelector("[data-role='pay-button']");
  button.disabled = loading;
  button.textContent = loading ? "Processing…" : "Pay now";
};

const redirectToConfirmation = (orderId) => {
  Storage.setTransaction({ orderId, placedAt: new Date().toISOString() });
  Storage.clearAfterPurchase();
  window.location.href = "order-confirmation.html";
};

document.addEventListener("DOMContentLoaded", () => {
  renderSummary();
  setStatus("Enter your card details to continue.", "info");

  const modal = new MfaModal(document.querySelector("#mfa-modal"));

  modal.onRequestCode = async ({ methodId, transactionId }) => {
    await MockBackend.emitWebhook({
      type: "auth.code.requested",
      payload: { methodId, transactionId }
    });
    modal.message(`Code sent via ${methodId.toUpperCase()}`, "info");
  };

  modal.onSubmit = async ({ methodId, code, transactionId }) => {
    const response = await MockBackend.verifyMFA({ methodId, code, transactionId });
    if (response.status === "SUCCESS") {
      modal.message("Verification successful", "success");
      modal.close();
      redirectToConfirmation(response.orderId);
      return;
    }

    if (response.status === "AUTH_REQUIRED") {
      modal.open({
        methods: response.methods,
        transactionId,
        message: response.message
      });
      return;
    }

    modal.message(response.message || "Verification failed", "error");
  };

  const form = document.querySelector("[data-role='card-form']");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(form);
    const cardNumber = formData.get("cardNumber");
    const ccHash = await hashCardDetails({
      number: cardNumber,
      expMonth: formData.get("expMonth"),
      expYear: formData.get("expYear"),
      cvc: formData.get("cvc")
    });

    const { lines, total } = calculateCartSummary();
    if (lines.length === 0) {
      setStatus("Your cart is empty.", "error");
      setLoading(false);
      return;
    }

    const payload = {
      amount: total,
      cart: lines.map((line) => ({ productId: line.id, quantity: line.quantity, price: line.price })),
      shipping: Storage.getShipping(),
      ccHash,
      last4: cardNumber.replace(/\s+/g, "").slice(-4)
    };

    try {
      setStatus("Processing payment through PaymentProcessor…", "info");
      const result = await window.PaymentProcessor.processPayment(payload);
      if (result.status === "SUCCESS") {
        redirectToConfirmation(result.orderId);
        return;
      }

      if (result.status === "AUTH_REQUIRED") {
        modal.open({
          methods: result.methods,
          transactionId: result.transactionId,
          message: result.message
        });
        setStatus("Additional authentication required", "warning");
        return;
      }

      setStatus(result.message || "Transaction cancelled, please contact merchant", "error");
    } catch (err) {
      console.error(err);
      setStatus("Unexpected error while processing payment.", "error");
    } finally {
      setLoading(false);
    }
  });
});
