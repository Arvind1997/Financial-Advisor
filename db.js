const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

const DEFAULT_SCHEMA = {
  profile: {
    salary: 0,
    payFrequency: 'Monthly',
    riskAppetite: 'Moderate'
  },
  plaidAccessTokens: [],
  krakenCredentials: null,
  history: [],
  manualAccounts: [],
  accountOverrides: {}
};

// Helper to safely read database
function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(DEFAULT_SCHEMA);
      return DEFAULT_SCHEMA;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Database] Read error, resetting to default:', error.message);
    writeDb(DEFAULT_SCHEMA);
    return DEFAULT_SCHEMA;
  }
}

// Helper to safely write database
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('[Database] Write error:', error.message);
  }
}

module.exports = {
  getProfile() {
    const db = readDb();
    return db.profile || DEFAULT_SCHEMA.profile;
  },

  updateProfile(profileData) {
    const db = readDb();
    db.profile = {
      ...DEFAULT_SCHEMA.profile,
      ...db.profile,
      ...profileData
    };
    writeDb(db);
    return db.profile;
  },

  getPlaidTokens() {
    const db = readDb();
    return db.plaidAccessTokens || [];
  },

  addPlaidToken(token) {
    const db = readDb();
    if (!db.plaidAccessTokens) {
      db.plaidAccessTokens = [];
    }
    if (!db.plaidAccessTokens.includes(token)) {
      db.plaidAccessTokens.push(token);
      writeDb(db);
    }
    return db.plaidAccessTokens;
  },

  removePlaidToken(token) {
    const db = readDb();
    if (db.plaidAccessTokens) {
      db.plaidAccessTokens = db.plaidAccessTokens.filter(t => t !== token);
      writeDb(db);
    }
    return db.plaidAccessTokens;
  },

  getKrakenCredentials() {
    const db = readDb();
    return db.krakenCredentials || null;
  },

  saveKrakenCredentials(apiKey, apiSecret) {
    const db = readDb();
    db.krakenCredentials = { apiKey, apiSecret };
    writeDb(db);
    return db.krakenCredentials;
  },

  getHistory() {
    const db = readDb();
    return db.history || [];
  },

  recordDailyBalance({ cash, crypto, credit }) {
    const db = readDb();
    if (!db.history) {
      db.history = [];
    }

    const todayStr = new Date().toLocaleDateString('en-CA'); // Outputs YYYY-MM-DD in local timezone
    const netWorth = (cash + crypto) - credit;

    const snapshot = {
      date: todayStr,
      cash: Number(cash.toFixed(2)),
      crypto: Number(crypto.toFixed(2)),
      credit: Number(credit.toFixed(2)),
      netWorth: Number(netWorth.toFixed(2))
    };

    const existingIndex = db.history.findIndex(entry => entry.date === todayStr);
    if (existingIndex !== -1) {
      db.history[existingIndex] = snapshot;
    } else {
      db.history.push(snapshot);
    }

    // Keep up to 365 days of history to limit storage footprint
    if (db.history.length > 365) {
      db.history.shift();
    }

    writeDb(db);
    return db.history;
  },

  getManualAccounts() {
    const db = readDb();
    return db.manualAccounts || [];
  },

  addManualAccount(account) {
    const db = readDb();
    if (!db.manualAccounts) {
      db.manualAccounts = [];
    }
    const newAccount = {
      id: account.id || `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: account.name,
      institution: account.institution || 'Manual Entry',
      balance: Number(account.balance) || 0,
      type: account.type || 'depository' // depository (asset) or credit (liability)
    };
    db.manualAccounts.push(newAccount);
    writeDb(db);
    return newAccount;
  },

  deleteManualAccount(id) {
    const db = readDb();
    if (db.manualAccounts) {
      db.manualAccounts = db.manualAccounts.filter(acc => acc.id !== id);
      writeDb(db);
    }
    return db.manualAccounts || [];
  },

  getAccountOverrides() {
    const db = readDb();
    return db.accountOverrides || {};
  },

  updateAccountOverride(accountId, overrideData) {
    const db = readDb();
    if (!db.accountOverrides) {
      db.accountOverrides = {};
    }
    db.accountOverrides[accountId] = {
      apr: (overrideData.apr !== undefined && overrideData.apr !== null && overrideData.apr !== '') ? Number(overrideData.apr) : null,
      nextPaymentDueDate: overrideData.nextPaymentDueDate || null,
      minimumPayment: (overrideData.minimumPayment !== undefined && overrideData.minimumPayment !== null && overrideData.minimumPayment !== '') ? Number(overrideData.minimumPayment) : null
    };
    writeDb(db);
    return db.accountOverrides[accountId];
  },

  deleteAccountOverride(accountId) {
    const db = readDb();
    if (db.accountOverrides && db.accountOverrides[accountId]) {
      delete db.accountOverrides[accountId];
      writeDb(db);
    }
    return db.accountOverrides || {};
  },

  clearAll() {
    writeDb(DEFAULT_SCHEMA);
    console.log('[Database] Reset all credentials, tokens, settings, and history.');
    return DEFAULT_SCHEMA;
  }
};
