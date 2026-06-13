# Aura Financial Advisor Agent API Integration Starter

This repository is a premium, high-fidelity developer starter template showing how to connect traditional bank accounts and credit cards (via **Plaid Link**) and cryptocurrency holdings (via **Kraken API**) to a financial advisor agent. 

Out of the box, the app runs in **Simulator Mode** so you can click around and see the visual effects without configuring API keys immediately.

## Tech Stack
*   **Backend:** Node.js, Express, Plaid official Node SDK
*   **Frontend:** Vanilla HTML5, Premium CSS3 (Glassmorphism layout, animated background orbs, hover states), Vanilla ES6 JavaScript (integrated with Plaid Link SDK)
*   **API Integrations:** Plaid Link flow + Kraken REST Ticker and Balance APIs

---

## Quick Start

### 1. Install Dependencies
Run the package installer to fetch Express and the Plaid Node libraries:
```bash
npm install
```

### 2. Configure Environment Variables
Copy the template environment file to `.env`:
```bash
cp .env.template .env
```
Open `.env` and fill in your keys:
*   **Plaid Credentials:** Register at [Plaid Dashboard](https://dashboard.plaid.com/) to get your `client_id` and `secret`. Use `sandbox` environment for testing.
*   **Kraken Credentials:** Generate an API Key and Private Key (Secret) inside your Kraken Account Settings. Ensure they have "Query Funds/Balances" permissions enabled.

### 3. Launch Server
Start the Express server:
```bash
npm start
```
Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## How it Works

### Traditional Banks (Chase, BofA, SoFi, Marcus, etc.)
Because retail banks do not provide direct APIs, the flow uses Plaid Link:
1.  The frontend queries the backend `/api/create_link_token` endpoint.
2.  The backend calls Plaid's API to construct a link token and returns it to the client.
3.  The client launches Plaid Link (modal overlay). The user selects their bank and logs in.
4.  Plaid returns a temporary `public_token` on success.
5.  The client sends the `public_token` to `/api/exchange_public_token`, where the backend exchanges it for a permanent `access_token` and saves it.
6.  The backend uses that `access_token` to call `/accounts/balance/get` and aggregates bank balances.

### Cryptocurrency Exchange (Kraken)
Kraken provides direct REST API endpoints. Private API calls require HMAC-SHA512 cryptographic signatures:
1.  To fetch balance, the backend calls the `/0/private/Balance` endpoint.
2.  Every request must send an `API-Key` header and a signature in the `API-Sign` header.
3.  The signature is constructed using Node's native `crypto` module:
    $$\text{Signature} = \text{HMAC-SHA512}(\text{Path} + \text{SHA256}(\text{Nonce} + \text{PostData}), \text{Secret})$$
4.  The backend then queries Kraken public ticker API to fetch live USD prices for your assets and displays their real-time net-worth equivalent.

---

## Project Structure
```text
├── public/
│   ├── index.html   # Main Dashboard UI
│   ├── style.css    # Premium CSS design system (glassmorphism & dark mode)
│   └── app.js       # Front-end API fetching and Plaid Link controller
├── .env             # Environment variables (ignored by Git)
├── .env.template    # Environment template file
├── .gitignore       # Node and environment git ignoring configs
├── package.json     # Project dependencies
└── server.js        # Express application with Plaid client & Kraken signatures
```

---

## Security Guidelines
*   **Never commit `.env` files** containing real Plaid secrets or Kraken API keys to public repositories. A `.gitignore` has been pre-configured for this template.
*   In production, store API tokens and user keys in a secure, encrypted database (e.g., PostgreSQL with pgcrypto or AWS Secrets Manager) rather than in-memory arrays.
