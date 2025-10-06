# Veritas 🛡️

**Winner of the Truth and Transparency Track sponsored by Visa at HackHarvard 2025**

Enterprise-grade fraud protection for small businesses at a fraction of the cost. Veritas is a plug-and-play MFA SDK that prevents chargebacks before they happen.

## 💡 The Problem

Chargebacks cost merchants up to **3x the transaction amount** in fees, penalties, and lost inventory. Enterprise fraud protection solutions exist, but they charge $2,500+ per month—completely out of reach for small and medium-sized businesses. SMBs are left vulnerable to fraudulent transactions that can devastate their bottom line.

## ✨ Our Solution

Veritas sits between your customers and payment processors (Stripe, PayPal, Square), adding a security layer that:

- **Verifies customers** via email/SMS before payment completion
- **Assesses risk** using device fingerprinting and behavioral analysis
- **Provides merchants** with a real-time dashboard to spot suspicious patterns
- **Enables custom rules** to prevent fraud based on your specific needs

All of this requires **minimal code changes** and can be integrated in **minutes**, not days.

## 🏗️ How It Works

1. **Customer initiates checkout** on your e-commerce site
2. **Veritas intercepts** the payment flow before it reaches the processor
3. **MFA verification** via email or SMS confirms customer identity
4. **Device fingerprinting** analyzes browser, location, and behavioral data
5. **Risk assessment** flags suspicious transactions in real-time
6. **Merchant dashboard** provides fraud analytics and custom rule configuration
7. **Payment proceeds** only after verification—or gets blocked if flagged

## 🔧 Tech Stack

### Backend

- **Node.js** with Express for API endpoints
- **SQLite** for secure transaction and user data storage
- **SendGrid** for email verification
- **Twilio** for SMS authentication
- **Salted hashing** and **HTTPS encryption** for all sensible data

### Frontend

- **Vanilla JavaScript** for lightweight, fast integration
- **Device fingerprinting** via browser APIs
- **Real-time analytics** dashboard for merchants
- **Stripe, PayPal, Square** demo integrations

## 🚀 Quick Start

### Prerequisites

- Node.js 14+
- npm or yarn
- SendGrid API key
- Twilio credentials (optional, for SMS)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/veritas.git
cd veritas
```

2. **Set up environment variables**
   Create a `.env` file in the root directory:

```env
SENDGRID_API_KEY=your_sendgrid_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
PORT=3001
```

3. **Install backend dependencies**

```bash
cd backend
npm install
```

4. **Start the backend server**

```bash
npm start
```

The API will run on `http://localhost:3001`

5. **Access the merchant dashboard**

```bash
cd ../frontend-merchant-dashboard
npm start
# Open index.html in your browser
```

### Integrate with Your Site

Add Veritas to your checkout flow with **2 lines of code** in your checkout page:

```html
<script src="veritas.js"></script>
<script>
  merchantApiKey = "${your_merchant_key}";
</script>
```

That's it! Veritas handles the rest.

## 🎯 Features

### For Merchants

- ✅ **Real-time fraud detection** dashboard
- ✅ **Custom rule configuration** decide when user should have to use 2FA based on device, location and transaction amount
- ✅ **Transaction history** with risk scores
- ✅ **Anonymized fraud pattern analytics**
- ✅ **Email and SMS alerts** for suspicious activity

### For Customers

- ✅ **Fast, seamless MFA** that doesn't disrupt checkout
- ✅ **Multiple verification methods** (email, SMS)
- ✅ **Privacy-first** approach with encrypted data
- ✅ **Mobile-friendly** verification flow

### Security Features

- 🔒 **Salted password hashing** for all sensitive data
- 🔒 **HTTPS encryption** for data transmission
- 🔒 **Device fingerprinting** without invasive tracking
- 🔒 **Anonymized analytics** to protect customer privacy

## 🏆 Accomplishments

We're proud to have built:

- A **plug-and-play solution** requiring minimal code changes
- **Enterprise-level security** at a fraction of the cost
- **Unprecedented fraud visibility** for small businesses
- A system that **balances security with UX**—strong authentication without checkout friction

## 📚 What We Learned

- Deep dive into **payment processor APIs** (Stripe, PayPal, Square)
- **Security best practices** for handling financial data with end-to-end encryption and hashing
- The **economics of chargebacks** and their impact on SMBs
- How to build **developer-friendly integrations** that don't disrupt existing workflows
- **Device fingerprinting techniques** that respect user privacy

## 👥 Team

Built with ❤️ by the ConUCracks team at HackHarvard 2025.

## 🙏 Acknowledgments

Special thanks to:

- **Visa** for sponsoring the Truth and Transparency track
- **HackHarvard 2025** organizers
