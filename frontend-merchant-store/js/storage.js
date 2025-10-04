const CART_KEY = 'lb_cart';
const CUSTOMER_KEY = 'lb_customer';
const ORDER_KEY = 'lb_order';

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn('Failed to parse stored value', error);
    return fallback;
  }
};

export const getCart = () => safeParse(localStorage.getItem(CART_KEY), []);

export const saveCart = (items) => {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
};

export const addToCart = (product, quantity = 1) => {
  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...product, quantity });
  }
  saveCart(cart);
  return cart;
};

export const removeFromCart = (productId) => {
  const cart = getCart().filter((item) => item.id !== productId);
  saveCart(cart);
  return cart;
};

export const updateQuantity = (productId, quantity) => {
  const cart = getCart().map((item) =>
    item.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
  );
  saveCart(cart);
  return cart;
};

export const clearCart = () => {
  localStorage.removeItem(CART_KEY);
};

export const saveCustomerDetails = (details) => {
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(details));
};

export const getCustomerDetails = () => safeParse(localStorage.getItem(CUSTOMER_KEY), null);

export const saveOrder = (order) => {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
};

export const getOrder = () => safeParse(localStorage.getItem(ORDER_KEY), null);

export const clearOrder = () => {
  localStorage.removeItem(ORDER_KEY);
};
