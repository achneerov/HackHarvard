import { MockBackend } from "./mock-backend.js";

const DEFAULT_DELAY_MS = 600;

const createOrderId = () => "ORD-" + Math.random().toString(36).slice(2, 8).toUpperCase();

const defaultHandler = async (payload) => {
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_DELAY_MS));
  // The default handler simulates an immediate success without AuthPay.
  const { ccHash } = payload;
  const orderId = createOrderId();
  await MockBackend.emitWebhook({
    type: "payment.completed",
    payload: { orderId, ccHash, total: payload.amount }
  });
  return { status: "SUCCESS", orderId };
};

const PaymentProcessor = (() => {
  let handler = defaultHandler;

  return {
    async processPayment(payload) {
      return handler(payload);
    },
    setHandler(fn) {
      handler = fn;
    },
    getDefaultHandler() {
      return defaultHandler;
    }
  };
})();

window.PaymentProcessor = PaymentProcessor;
