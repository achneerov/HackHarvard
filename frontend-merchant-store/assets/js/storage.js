const CART_KEY = "demo_store_cart";
const SHIPPING_KEY = "demo_store_shipping";
const TRANSACTION_KEY = "demo_store_payment";

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (err) {
    console.warn("Storage read failed", err);
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Storage write failed", err);
  }
};

export const Storage = {
  getCart() {
    return read(CART_KEY, []);
  },
  setCart(items) {
    write(CART_KEY, items);
  },
  addItem(productId) {
    const cart = this.getCart();
    const existing = cart.find((item) => item.productId === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({ productId, quantity: 1 });
    }
    this.setCart(cart);
    return cart;
  },
  updateQuantity(productId, quantity) {
    const cart = this.getCart()
      .map((item) => (item.productId === productId ? { ...item, quantity } : item))
      .filter((item) => item.quantity > 0);
    this.setCart(cart);
    return cart;
  },
  removeItem(productId) {
    const cart = this.getCart().filter((item) => item.productId !== productId);
    this.setCart(cart);
    return cart;
  },
  clearCart() {
    this.setCart([]);
  },
  getShipping() {
    return read(SHIPPING_KEY, {
      fullName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      postalCode: ""
    });
  },
  setShipping(data) {
    write(SHIPPING_KEY, data);
  },
  setTransaction(data) {
    write(TRANSACTION_KEY, data);
  },
  getTransaction() {
    return read(TRANSACTION_KEY, null);
  },
  clearAfterPurchase() {
    localStorage.removeItem(CART_KEY);
  },
  clearTransaction() {
    localStorage.removeItem(TRANSACTION_KEY);
  }
};
