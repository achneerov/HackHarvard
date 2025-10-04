const pendingTransactions = new Map();

const randomId = () => "txn_" + Math.random().toString(36).slice(2, 10);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const MockBackend = {
  async processTransaction(payload) {
    await delay(700);
    const { amount, ccHash, last4, shipping } = payload;

    if (!payload.cart || payload.cart.length === 0) {
      return { status: "FAILURE", message: "Cart is empty" };
    }

    if (shipping?.fullName?.toLowerCase().includes("cancel")) {
      return { status: "FAILURE", message: "Customer requested cancellation." };
    }

    if (last4 === "0000") {
      return { status: "FAILURE", message: "Card declined by issuer." };
    }

    if (last4 === "1111") {
      const transactionId = randomId();
      const methods = [
        { id: "sms", label: "SMS Passcode" },
        { id: "email", label: "Email Passcode" }
      ];
      pendingTransactions.set(transactionId, {
        ccHash,
        attempts: 0,
        methods
      });
      return {
        status: "AUTH_REQUIRED",
        ccHash,
        transactionId,
        methods,
        message: "Extra verification required"
      };
    }

    const orderId = "ORD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    await this.emitWebhook({
      type: "payment.completed",
      payload: { orderId, amount, ccHash }
    });
    return { status: "SUCCESS", orderId };
  },

  async verifyMFA({ transactionId, methodId, code }) {
    await delay(500);
    const record = pendingTransactions.get(transactionId);
    if (!record) {
      return { status: "FAILURE", message: "Session expired." };
    }

    record.attempts += 1;

    if (code === "123456") {
      pendingTransactions.delete(transactionId);
      const orderId = "ORD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      await this.emitWebhook({
        type: "payment.completed",
        payload: { orderId, ccHash: record.ccHash }
      });
      return { status: "SUCCESS", orderId };
    }

    if (record.attempts >= 3) {
      pendingTransactions.delete(transactionId);
      return { status: "FAILURE", message: "Too many attempts" };
    }

    return {
      status: "AUTH_REQUIRED",
      methods: record.methods,
      message: "Incorrect code, try again"
    };
  },

  async emitWebhook(event) {
    await delay(200);
    console.info("[MockWebhook]", event);
  }
};
