const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
dotenv.config();

// Initialize Gemini Client
const isGeminiConfigured = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key';
let genAI = null;
if (isGeminiConfigured) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('[Gemini] AI Advisor Engine configured.');
} else {
  console.warn('[Gemini] WARNING: GEMINI_API_KEY not set. Running Advisor in Demo Mode.');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory token storage (for demonstration purposes)
const tokenStore = {
  plaidAccessTokens: [],
  krakenCredentials: null // Stored in-memory if entered via UI, otherwise uses .env
};

// Check if Plaid is configured
const isPlaidConfigured = 
  process.env.PLAID_CLIENT_ID && 
  process.env.PLAID_CLIENT_ID !== 'your_plaid_client_id' &&
  process.env.PLAID_SECRET && 
  process.env.PLAID_SECRET !== 'your_plaid_secret';

let plaidClient = null;

if (isPlaidConfigured) {
  console.log(`[Plaid] Configuring client for environment: ${process.env.PLAID_ENV || 'sandbox'}`);
  const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });
  plaidClient = new PlaidApi(configuration);
} else {
  console.warn('[Plaid] WARNING: Credentials not configured. Server will run in Simulator Mode.');
}

// Check if Kraken is configured in .env
const getKrakenKeys = () => {
  if (tokenStore.krakenCredentials) {
    return tokenStore.krakenCredentials;
  }
  const key = process.env.KRAKEN_API_KEY;
  const secret = process.env.KRAKEN_API_SECRET;
  if (key && key !== 'your_kraken_api_key' && secret && secret !== 'your_kraken_api_secret') {
    return { key, secret };
  }
  return null;
};

// --- PLAID ENDPOINTS ---

// Create link token
app.post('/api/create_link_token', async (req, res) => {
  if (!isPlaidConfigured) {
    return res.json({ 
      simulated: true, 
      message: 'Running in Simulator Mode. No Plaid Link token generated.' 
    });
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'user_financial_advisor_1' },
      client_name: 'Financial Advisor Agent',
      products: (process.env.PLAID_PRODUCTS || 'auth,transactions').split(','),
      country_codes: (process.env.PLAID_COUNTRY_CODES || 'US').split(','),
      language: 'en',
    });
    res.json(response.data);
  } catch (error) {
    console.error('[Plaid] Error creating link token:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message });
  }
});

// Exchange public token
app.post('/api/exchange_public_token', async (req, res) => {
  const { public_token } = req.body;

  if (!isPlaidConfigured) {
    // Simulator Mode
    console.log('[Plaid Simulator] Simulated exchange for public token:', public_token);
    const mockAccessToken = `access-sandbox-${crypto.randomUUID()}`;
    tokenStore.plaidAccessTokens.push(mockAccessToken);
    return res.json({ success: true, simulated: true });
  }

  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });
    const accessToken = response.data.access_token;
    tokenStore.plaidAccessTokens.push(accessToken);
    res.json({ success: true, item_id: response.data.item_id });
  } catch (error) {
    console.error('[Plaid] Error exchanging token:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message });
  }
});

// Fetch balances for all linked accounts
app.get('/api/balances', async (req, res) => {
  const results = [];
  const errors = [];

  // Simulated accounts when in Simulator Mode or no accounts connected yet
  if (!isPlaidConfigured || tokenStore.plaidAccessTokens.length === 0) {
    // Return mock data for BofA and Chase to showcase the dashboard immediately
    const mockAccounts = [
      {
        institution: 'Chase Bank',
        accounts: [
          { id: '1', name: 'Total Checking', balance: 5430.82, type: 'depository', subtype: 'checking', mask: '1244' },
          { id: '2', name: 'Sapphire Preferred', balance: -1254.30, type: 'credit', subtype: 'credit card', mask: '9822' }
        ]
      },
      {
        institution: 'Marcus by Goldman Sachs',
        accounts: [
          { id: '3', name: 'Online Savings', balance: 25000.00, type: 'depository', subtype: 'savings', mask: '5311' }
        ]
      }
    ];
    return res.json({ accounts: mockAccounts, simulated: tokenStore.plaidAccessTokens.length === 0 });
  }

  for (const token of tokenStore.plaidAccessTokens) {
    if (token.startsWith('access-sandbox-')) {
      // Handle in-app simulated accounts added during sandbox flow
      results.push({
        institution: 'Simulated Bank Account',
        accounts: [
          { id: 'sim-1', name: 'Simulated Checking', balance: 7500.00, type: 'depository', subtype: 'checking', mask: '9999' }
        ]
      });
      continue;
    }

    try {
      const response = await plaidClient.accountsBalanceGet({ access_token: token });
      
      // Try to fetch institution metadata
      let institutionName = 'Connected Bank Account';
      try {
        const itemResponse = await plaidClient.itemGet({ access_token: token });
        const instId = itemResponse.data.item.institution_id;
        const instResponse = await plaidClient.institutionsGetById({
          institution_id: instId,
          country_codes: (process.env.PLAID_COUNTRY_CODES || 'US').split(',')
        });
        institutionName = instResponse.data.institution.name;
      } catch (instErr) {
        console.warn('[Plaid] Could not fetch institution info, using default name');
      }

      results.push({
        institution: institutionName,
        accounts: response.data.accounts.map(acc => ({
          id: acc.account_id,
          name: acc.name,
          balance: acc.balances.current,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask
        }))
      });
    } catch (error) {
      console.error('[Plaid] Error fetching balance:', error.response ? error.response.data : error.message);
      errors.push(error.message);
    }
  }

  res.json({ accounts: results, errors });
});

// --- KRAKEN ENDPOINTS ---

// Helper function to sign Kraken private API requests
const getKrakenSignature = (path, requestData, secret) => {
  const nonce = requestData.nonce;
  const postData = querystring.stringify(requestData);
  
  const sha256 = crypto.createHash('sha256');
  sha256.update(nonce + postData);
  const hash256 = sha256.digest();
  
  const pathBuffer = Buffer.from(path, 'utf-8');
  const message = Buffer.concat([pathBuffer, hash256]);
  
  const secretBuffer = Buffer.from(secret, 'base64');
  const hmac = crypto.createHmac('sha512', secretBuffer);
  hmac.update(message);
  
  return hmac.digest('base64');
};

// Handle input of Kraken Credentials from UI
app.post('/api/kraken/credentials', (req, res) => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'API Key and API Secret are required' });
  }
  tokenStore.krakenCredentials = { key: apiKey, secret: apiSecret };
  res.json({ success: true });
});

// Fetch Kraken balance
app.get('/api/kraken/balances', async (req, res) => {
  const keys = getKrakenKeys();

  // If no keys configured, return mock data combined with live prices
  if (!keys) {
    const mockHoldings = {
      'XXBT': 0.65, // Bitcoin
      'XETH': 4.5,  // Ethereum
      'USDT': 1250.0 // Tether
    };
    try {
      const balances = await getLiveCryptoUSDValues(mockHoldings);
      return res.json({ holdings: balances, simulated: true });
    } catch (e) {
      return res.json({
        simulated: true,
        holdings: [
          { asset: 'BTC', amount: 0.65, price: 65000, value: 42250 },
          { asset: 'ETH', amount: 4.5, price: 3500, value: 15750 },
          { asset: 'USDT', amount: 1250.0, price: 1.0, value: 1250.0 }
        ]
      });
    }
  }

  const path = '/0/private/Balance';
  const nonce = Date.now().toString();
  const requestData = { nonce };
  
  const signature = getKrakenSignature(path, requestData, keys.secret);

  try {
    const response = await fetch('https://api.kraken.com' + path, {
      method: 'POST',
      headers: {
        'API-Key': keys.key,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: querystring.stringify(requestData)
    });

    const data = await response.json();
    if (data.error && data.error.length > 0) {
      return res.status(400).json({ error: data.error });
    }

    // Filter zero balances
    const holdings = {};
    for (const [asset, amountStr] of Object.entries(data.result)) {
      const amount = parseFloat(amountStr);
      if (amount > 0) {
        holdings[asset] = amount;
      }
    }

    const usdHoldings = await getLiveCryptoUSDValues(holdings);
    res.json({ holdings: usdHoldings, simulated: false });
  } catch (error) {
    console.error('[Kraken] API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to fetch live crypto ticker prices from Kraken and format holdings
function getTickerPair(asset) {
  if (asset === 'ZUSD' || asset === 'USD') return null;

  const customMapping = {
    'XXBT': 'XXBTZUSD',
    'XETH': 'XETHZUSD',
    'USDT': 'USDTZUSD',
    'XXDG': 'XDGUSD',
    'XXRP': 'XRPUSD',
    'ZEUR': 'EURUSD'
  };

  if (customMapping[asset]) {
    return customMapping[asset];
  }

  let cleanAsset = asset;
  if (asset.startsWith('X') && asset.length === 4) {
    cleanAsset = asset.substring(1);
  } else if (asset.startsWith('Z') && asset.length === 4) {
    cleanAsset = asset.substring(1);
  }
  return `${cleanAsset}USD`;
}

function getDisplaySymbol(asset) {
  const displayMapping = {
    'XXBT': 'BTC',
    'XETH': 'ETH',
    'XXDG': 'DOGE',
    'XXRP': 'XRP',
    'ZUSD': 'USD',
    'ZEUR': 'EUR',
    'USDT': 'USDT'
  };
  if (displayMapping[asset]) return displayMapping[asset];
  
  let clean = asset;
  if (asset.startsWith('X') && asset.length === 4) {
    clean = asset.substring(1);
  } else if (asset.startsWith('Z') && asset.length === 4) {
    clean = asset.substring(1);
  }
  return clean === 'XBT' ? 'BTC' : clean;
}

async function getLiveCryptoUSDValues(holdings) {
  const assets = Object.keys(holdings);
  if (assets.length === 0) return [];

  const queryPairs = assets
    .map(getTickerPair)
    .filter(p => p !== null);

  let prices = {};
  if (queryPairs.length > 0) {
    const pairsToQuery = queryPairs.join(',');
    try {
      const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pairsToQuery}`);
      const data = await response.json();
      if (data.result) {
        prices = data.result;
      }
    } catch (e) {
      console.warn('[Kraken Prices] Failed to fetch live prices, using fallbacks', e);
    }
  }

  return assets.map(asset => {
    const displayAsset = getDisplaySymbol(asset);
    const queryPair = getTickerPair(asset);
    
    let price = 1.0;
    if (displayAsset === 'BTC') price = 67250.00;
    else if (displayAsset === 'ETH') price = 3480.00;
    
    if (queryPair) {
      const tickerKey = Object.keys(prices).find(k => {
        const upperKey = k.toUpperCase();
        const upperAsset = asset.toUpperCase();
        const display = displayAsset.toUpperCase();
        return (
          upperKey === queryPair.toUpperCase() ||
          upperKey === upperAsset ||
          upperKey.includes(display) ||
          upperKey.includes(upperAsset.replace(/^X/, ''))
        );
      });
      if (tickerKey && prices[tickerKey]) {
        price = parseFloat(prices[tickerKey].c[0]);
      }
    }

    const amount = holdings[asset];
    return {
      asset: displayAsset,
      amount: amount,
      price: price,
      value: amount * price
    };
  });
}

// Helper to format currency values
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(val);
};

// Helper to aggregate balances across all connected Plaid bank accounts
async function getAggregatedBankBalances() {
  let totalCash = 0;
  let totalCredit = 0;
  const accounts = [];

  if (!isPlaidConfigured || tokenStore.plaidAccessTokens.length === 0) {
    return {
      totalCash: 30430.82,
      totalCredit: 1254.30,
      accounts: [
        { name: 'Total Checking', balance: 5430.82, type: 'depository', subtype: 'checking' },
        { name: 'Sapphire Preferred', balance: -1254.30, type: 'credit', subtype: 'credit card' },
        { name: 'Online Savings', balance: 25000.00, type: 'depository', subtype: 'savings' }
      ]
    };
  }

  for (const token of tokenStore.plaidAccessTokens) {
    if (token.startsWith('access-sandbox-')) {
      totalCash += 7500.00;
      accounts.push({ name: 'Simulated Checking', balance: 7500.00, type: 'depository', subtype: 'checking' });
      continue;
    }
    try {
      const response = await plaidClient.accountsBalanceGet({ access_token: token });
      response.data.accounts.forEach(acc => {
        const balance = acc.balances.current;
        const isCredit = acc.type === 'credit';
        if (isCredit) {
          totalCredit += Math.abs(balance);
        } else {
          totalCash += balance;
        }
        accounts.push({
          name: acc.name,
          balance: balance,
          type: acc.type,
          subtype: acc.subtype
        });
      });
    } catch (e) {
      console.warn('[Plaid Balance Aggregator Error]', e.message);
    }
  }

  return { totalCash, totalCredit, accounts };
}

// Helper to pull recent transactions for a Plaid access token
async function fetchRecentTransactions(accessToken) {
  if (accessToken.startsWith('access-sandbox-')) {
    return [
      { date: new Date().toISOString().split('T')[0], name: 'Mock Sandbox Cafe', amount: 8.50, category: 'Food & Drink', type: 'expense' },
      { date: new Date(Date.now() - 86400000).toISOString().split('T')[0], name: 'Mock Sandbox Rent', amount: 1200.00, category: 'Rent', type: 'expense' }
    ];
  }
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = thirtyDaysAgo.toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];

    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: start,
      end_date: end,
      options: { count: 10 }
    });
    
    return response.data.transactions.map(t => ({
      date: t.date,
      name: t.name,
      amount: Math.abs(t.amount),
      category: t.category ? t.category[0] : 'General',
      type: t.amount > 0 ? 'expense' : 'deposit'
    }));
  } catch (e) {
    console.warn('[Plaid Transactions Error]', e.message);
    return [];
  }
}

// Fetch transactions endpoint
app.get('/api/transactions', async (req, res) => {
  let allTransactions = [];
  if (!isPlaidConfigured || tokenStore.plaidAccessTokens.length === 0) {
    allTransactions = [
      { date: '2026-06-12', name: 'Starbucks Coffee', amount: 5.42, category: 'Food & Drink', type: 'expense' },
      { date: '2026-06-11', name: 'Uber Trip', amount: 24.50, category: 'Travel', type: 'expense' },
      { date: '2026-06-10', name: 'Netflix Subscription', amount: 15.49, category: 'Entertainment', type: 'expense' },
      { date: '2026-06-08', name: 'Whole Foods Market', amount: 112.30, category: 'Groceries', type: 'expense' },
      { date: '2026-06-05', name: 'Landlord Rent Payment', amount: 2200.00, category: 'Rent', type: 'expense' },
      { date: '2026-06-01', name: 'Employer Payroll Deposit', amount: 4500.00, category: 'Income', type: 'deposit' }
    ];
    return res.json({ transactions: allTransactions, simulated: true });
  }

  for (const token of tokenStore.plaidAccessTokens) {
    const txs = await fetchRecentTransactions(token);
    allTransactions.push(...txs);
  }
  
  allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ transactions: allTransactions.slice(0, 10), simulated: false });
});

// Fetch proactive Advisor Tips using Gemini
app.get('/api/advisor/tips', async (req, res) => {
  let totalCash = 0;
  let totalCredit = 0;
  let totalCrypto = 0;
  let holdings = [];
  let accountsList = [];

  const bankRes = await getAggregatedBankBalances();
  totalCash = bankRes.totalCash;
  totalCredit = bankRes.totalCredit;
  accountsList = bankRes.accounts;

  const keys = getKrakenKeys();
  let cryptoSimulated = false;
  if (!keys) {
    const mockHoldings = { 'XXBT': 0.65, 'XETH': 4.5, 'USDT': 1250.0 };
    holdings = await getLiveCryptoUSDValues(mockHoldings);
    cryptoSimulated = true;
  } else {
    try {
      const path = '/0/private/Balance';
      const nonce = Date.now().toString();
      const requestData = { nonce };
      const signature = getKrakenSignature(path, requestData, keys.secret);
      
      const response = await fetch('https://api.kraken.com' + path, {
        method: 'POST',
        headers: {
          'API-Key': keys.key,
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: querystring.stringify(requestData)
      });
      const data = await response.json();
      if (data.result) {
        const rawHoldings = {};
        for (const [asset, amountStr] of Object.entries(data.result)) {
          const amount = parseFloat(amountStr);
          if (amount > 0) rawHoldings[asset] = amount;
        }
        holdings = await getLiveCryptoUSDValues(rawHoldings);
      }
    } catch (e) {
      console.warn('[Kraken Balance Error]', e.message);
    }
  }
  totalCrypto = holdings.reduce((sum, h) => sum + h.value, 0);

  let allTransactions = [];
  if (!isPlaidConfigured || tokenStore.plaidAccessTokens.length === 0) {
    allTransactions = [
      { date: '2026-06-12', name: 'Starbucks Coffee', amount: 5.42, category: 'Food & Drink', type: 'expense' },
      { date: '2026-06-11', name: 'Uber Trip', amount: 24.50, category: 'Travel', type: 'expense' },
      { date: '2026-06-10', name: 'Netflix Subscription', amount: 15.49, category: 'Entertainment', type: 'expense' },
      { date: '2026-06-08', name: 'Whole Foods Market', amount: 112.30, category: 'Groceries', type: 'expense' },
      { date: '2026-06-05', name: 'Landlord Rent Payment', amount: 2200.00, category: 'Rent', type: 'expense' },
      { date: '2026-06-01', name: 'Employer Payroll Deposit', amount: 4500.00, category: 'Income', type: 'deposit' }
    ];
  } else {
    for (const token of tokenStore.plaidAccessTokens) {
      const txs = await fetchRecentTransactions(token);
      allTransactions.push(...txs);
    }
  }

  const netWorth = (totalCash + totalCrypto) - totalCredit;

  if (!genAI) {
    return res.json({
      simulated: true,
      tips: [
        {
          id: 'tip-1',
          type: 'danger',
          title: 'Optimize Interest Threat',
          description: `You have ${formatCurrency(totalCredit)} in credit card liabilities (such as Sapphire Preferred). Pay this off using your Online Savings cash balance immediately to secure a guaranteed return against card interest.`,
          chatPrompt: `Explain how paying off my credit card liability of ${formatCurrency(totalCredit)} from savings is better than keeping it in cash.`
        },
        {
          id: 'tip-2',
          type: 'warning',
          title: 'Review Crypto Asset Allocation',
          description: `Your cash savings stand at ${formatCurrency(totalCash)}, while your crypto assets (such as Kraken) value is ${formatCurrency(totalCrypto)}. Evaluate if this risk ratio matches your targets.`,
          chatPrompt: `Analyze my cash-to-crypto ratio of ${formatCurrency(totalCash)} vs ${formatCurrency(totalCrypto)} and suggest rebalancing ideas.`
        },
        {
          id: 'tip-3',
          type: 'info',
          title: 'Track Daily Expense Trends',
          description: `We detected food, travel, and subscription expenses in your transactions. I recommend setting up an automated weekly budget cap of $150 on dining out.`,
          chatPrompt: `Analyze my recent expenses and help me draft a weekly budget cap strategy.`
        }
      ]
    });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const prompt = `
    You are Aura Financial, a premium, fiduciary AI financial advisor agent. 
    Analyze the user's financial profile and generate exactly 3 highly actionable, math-driven financial tips.
    
    FINANCIAL PROFILE:
    - Net Worth: ${formatCurrency(netWorth)}
    - Total Cash Assets: ${formatCurrency(totalCash)}
    - Total Crypto Assets: ${formatCurrency(totalCrypto)}
    - Total Credit Liabilities: ${formatCurrency(totalCredit)}
    - Stored Accounts: ${JSON.stringify(accountsList)}
    - Crypto Holdings Details: ${JSON.stringify(holdings)}
    - Recent Transactions: ${JSON.stringify(allTransactions.slice(0, 8))}
    
    INSTRUCTIONS:
    1. Focus on optimizing high-interest debt, saving rate, investment gaps, and subscription leakage.
    2. Be highly specific and do math based on their actual numbers.
    3. Return your response in JSON format as a list of exactly 3 items.
    
    Format requirements:
    Return ONLY a JSON array matching this schema (do not wrap in markdown code blocks):
    [
      {
        "id": "insight-1",
        "type": "danger" | "warning" | "success" | "info",
        "title": "Short title",
        "description": "Fiduciary advice with specific numbers...",
        "chatPrompt": "The question the user would ask to deep-dive into this tip in the chat"
      }
    ]
    `;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    // Sanitize in case model wraps it in ```json ... ```
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    }

    const tips = JSON.parse(responseText);
    res.json({ simulated: false, tips });
  } catch (err) {
    console.error('[Gemini Tips Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Interactive Advisor Chat Endpoint
app.post('/api/advisor/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const bankRes = await getAggregatedBankBalances();
  const keys = getKrakenKeys();
  let holdings = [];
  if (!keys) {
    holdings = [
      { asset: 'BTC', amount: 0.65, price: 65000, value: 42250 },
      { asset: 'ETH', amount: 4.5, price: 3500, value: 15750 },
      { asset: 'USDT', amount: 1250.0, price: 1.0, value: 1250.0 }
    ];
  } else {
    try {
      const path = '/0/private/Balance';
      const nonce = Date.now().toString();
      const requestData = { nonce };
      const signature = getKrakenSignature(path, requestData, keys.secret);
      const response = await fetch('https://api.kraken.com' + path, {
        method: 'POST',
        headers: {
          'API-Key': keys.key,
          'API-Sign': signature,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: querystring.stringify(requestData)
      });
      const data = await response.json();
      if (data.result) {
        const rawHoldings = {};
        for (const [asset, amountStr] of Object.entries(data.result)) {
          const amount = parseFloat(amountStr);
          if (amount > 0) rawHoldings[asset] = amount;
        }
        holdings = await getLiveCryptoUSDValues(rawHoldings);
      }
    } catch (e) {}
  }
  const totalCrypto = holdings.reduce((sum, h) => sum + h.value, 0);
  const netWorth = (bankRes.totalCash + totalCrypto) - bankRes.totalCredit;

  const systemInstruction = `
  You are Aura Financial, a premium, fiduciary AI financial advisor agent. 
  You are chatting with the user about their financial health. 
  Provide objective, clear, math-driven financial advice. Reference their actual holdings, assets, and debt numbers whenever possible.
  Always format your responses cleanly in Markdown. Keep your tone professional, advisory, and helpful.
  
  FINANCIAL PROFILE:
  - Net Worth: ${formatCurrency(netWorth)}
  - Total Cash Assets: ${formatCurrency(bankRes.totalCash)}
  - Total Crypto Assets: ${formatCurrency(totalCrypto)} (Holdings: ${JSON.stringify(holdings)})
  - Total Credit Debt (Liabilities): ${formatCurrency(bankRes.totalCredit)}
  - Connected Accounts: ${JSON.stringify(bankRes.accounts)}
  `;

  if (!genAI) {
    const lastUserMsg = messages[messages.length - 1].content;
    return res.json({
      content: `**[Demo Mode]** Aura Financial Advisor is running in offline demo mode. 
      
To enable full generative advisory responses, please configure your **GEMINI_API_KEY** in your local \`.env\` file.
      
*Your message was:* "${lastUserMsg}"
*Current Net Worth Context:* **${formatCurrency(netWorth)}** (${formatCurrency(bankRes.totalCash)} Cash, ${formatCurrency(totalCrypto)} Crypto, ${formatCurrency(bankRes.totalCredit)} Credit Card Debt).`
    });
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      systemInstruction: systemInstruction
    });

    const firstUserIndex = messages.findIndex(m => m.role === 'user');
    let history = [];
    if (firstUserIndex !== -1) {
      history = messages.slice(firstUserIndex, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
    }

    const lastMessage = messages[messages.length - 1].content;

    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 800,
      }
    });

    const result = await chat.sendMessage(lastMessage);
    res.json({ content: result.response.text() });
  } catch (err) {
    console.error('[Gemini Chat Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset Endpoint (for demo reset)
app.post('/api/reset', (req, res) => {
  tokenStore.plaidAccessTokens = [];
  tokenStore.krakenCredentials = null;
  res.json({ success: true });
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Financial Advisor Agent Backend running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log(`==================================================`);
});
