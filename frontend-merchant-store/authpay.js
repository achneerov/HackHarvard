import "./assets/js/payment-processor.js";
import { MockBackend } from "./assets/js/mock-backend.js";

const waitForAuth = async () => {
  console.info("[AuthPay] Waiting for device fingerprint...");
  await new Promise((resolve) => setTimeout(resolve, 400));
};

const authPayHandler = async (payload) => {
  await waitForAuth();
  const response = await MockBackend.processTransaction(payload);
  if (response.status === "FAILURE") {
    return {
      status: "FAILURE",
      message: response.message || "Transaction cancelled, please contact merchant"
    };
  }

  if (response.status === "AUTH_REQUIRED") {
    console.info("[AuthPay] MFA required", response.methods);
    return response;
  }

  console.info("[AuthPay] Transaction approved", response.orderId);
  return response;
};

if (window?.PaymentProcessor) {
  window.PaymentProcessor.setHandler(authPayHandler);
}

window.AuthPay = {
  waitForAuth,
  processPayment: authPayHandler
};
