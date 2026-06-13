document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const netWorthEl = document.getElementById('net-worth');
    const totalCashEl = document.getElementById('total-cash');
    const totalCryptoEl = document.getElementById('total-crypto');
    
    const barCash = document.getElementById('bar-cash');
    const barCrypto = document.getElementById('bar-crypto');
    const barCredit = document.getElementById('bar-credit');
    
    const pctCash = document.getElementById('pct-cash');
    const pctCrypto = document.getElementById('pct-crypto');
    const pctCredit = document.getElementById('pct-credit');
    
    const bankCountEl = document.getElementById('bank-count');
    const cryptoCountEl = document.getElementById('crypto-count');
    
    const banksContainer = document.getElementById('banks-container');
    const cryptoContainer = document.getElementById('crypto-container');
    
    const simulatedBadge = document.getElementById('simulated-badge');
    const resetBtn = document.getElementById('reset-btn');
    const plaidLinkBtn = document.getElementById('plaid-link-btn');
    const krakenLinkBtn = document.getElementById('kraken-link-btn');
    
    // Kraken Modal Elements
    const krakenModal = document.getElementById('kraken-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const krakenForm = document.getElementById('kraken-form');
    const krakenDemoBtn = document.getElementById('kraken-demo-btn');
    
    // Toast Notification
    const toast = document.getElementById('toast');

    // Set Date in Header
    const dateEl = document.getElementById('current-date');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);

    // Global dashboard data state
    let totalCash = 0;
    let totalCrypto = 0;
    let totalCredit = 0;
    let globalAccounts = [];

    // Toast Helper
    function showToast(message, type = 'info') {
        toast.textContent = message;
        toast.className = 'toast'; // reset classes
        if (type === 'error') {
            toast.style.borderColor = 'var(--accent-rose)';
        } else if (type === 'success') {
            toast.style.borderColor = 'var(--accent-emerald)';
        } else {
            toast.style.borderColor = 'var(--accent-indigo)';
        }
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 4000);
    }

    // Number formatting helper
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(val);
    };

    // Animated counter helper
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = formatCurrency(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Fetch Dashboard Data (Both Plaid Banks & Kraken Crypto)
    async function fetchDashboardData() {
        showLoadingState();
        
        let plaidSimulated = false;
        let krakenSimulated = false;

        try {
            // 1. Fetch Plaid Balances
            const plaidRes = await fetch('/api/balances');
            const plaidData = await plaidRes.json();
            plaidSimulated = plaidData.simulated;
            globalAccounts = plaidData.accounts || [];
            populateOverrideDropdown();
            fetchOverrides();
            fetchPlaidConnections();

            // 2. Fetch Kraken Balances
            const krakenRes = await fetch('/api/kraken/balances');
            const krakenData = await krakenRes.json();
            krakenSimulated = krakenData.simulated;

            // Process Bank Accounts
            totalCash = 0;
            totalCredit = 0;
            let bankAccountCount = 0;

            banksContainer.innerHTML = '';
            if (plaidData.accounts && plaidData.accounts.length > 0) {
                plaidData.accounts.forEach(group => {
                    const groupEl = document.createElement('div');
                    groupEl.className = 'bank-group';
                    
                    let accountsHtml = '';
                    group.accounts.forEach(acc => {
                        bankAccountCount++;
                        const isLiability = acc.type === 'credit' || acc.type === 'loan';
                        const balance = acc.balance;
                        
                        if (isLiability) {
                            totalCredit += Math.abs(balance);
                        } else {
                            totalCash += balance;
                        }

                        let metaText = `${acc.subtype.toUpperCase()} •••• ${acc.mask}`;
                        if (acc.apr !== undefined && acc.apr !== null) {
                            metaText += ` • ${acc.apr}% APR`;
                        }
                        if (acc.nextPaymentDueDate) {
                            try {
                                const dueDate = new Date(acc.nextPaymentDueDate + 'T00:00:00');
                                const formattedDate = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
                                metaText += ` • Due ${formattedDate}`;
                            } catch (e) {
                                metaText += ` • Due ${acc.nextPaymentDueDate}`;
                            }
                        }

                        accountsHtml += `
                            <div class="account-row-card">
                                <div class="acc-info">
                                    <span class="acc-name">${acc.name}</span>
                                    <span class="acc-meta">${metaText}</span>
                                </div>
                                <div class="acc-balance-container">
                                    <span class="acc-val ${isLiability ? 'credit-neg' : ''}">
                                        ${formatCurrency(balance)}
                                    </span>
                                </div>
                            </div>
                        `;
                    });

                    groupEl.innerHTML = `
                        <div class="bank-group-header">
                            <i class="fa-solid fa-building-columns"></i> ${group.institution}
                        </div>
                        <div class="account-items-container">
                            ${accountsHtml}
                        </div>
                    `;
                    banksContainer.appendChild(groupEl);
                });
                bankCountEl.textContent = `${bankAccountCount} connected`;
            } else {
                banksContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-building-columns"></i>
                        <p>No bank accounts connected.</p>
                    </div>
                `;
                bankCountEl.textContent = '0 connected';
            }

            // Process Crypto Holdings
            totalCrypto = 0;
            cryptoContainer.innerHTML = '';

            if (krakenData.holdings && krakenData.holdings.length > 0) {
                krakenData.holdings.forEach(hold => {
                    totalCrypto += hold.value;

                    const row = document.createElement('div');
                    row.className = 'account-row-card';
                    
                    // Determine crypto icon
                    let iconClass = 'fa-solid fa-circle-nodes';
                    if (hold.asset === 'BTC') iconClass = 'fa-brands fa-bitcoin';
                    else if (hold.asset === 'ETH') iconClass = 'fa-brands fa-ethereum';
                    else if (hold.asset === 'USDT') iconClass = 'fa-solid fa-dollar-sign';

                    row.innerHTML = `
                        <div class="acc-info">
                            <span class="acc-name">${hold.amount.toFixed(4)} ${hold.asset}</span>
                            <span class="acc-meta">Market Price: ${formatCurrency(hold.price)}</span>
                        </div>
                        <div class="acc-balance-container" style="display:flex; align-items:center; gap: 0.8rem;">
                            <i class="${iconClass}" style="color:var(--accent-cyan); font-size:1.1rem;"></i>
                            <span class="acc-val">${formatCurrency(hold.value)}</span>
                        </div>
                    `;
                    cryptoContainer.appendChild(row);
                });
                cryptoCountEl.textContent = `${krakenData.holdings.length} tokens`;
            } else {
                cryptoContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-brands fa-bitcoin"></i>
                        <p>No cryptocurrency accounts connected.</p>
                    </div>
                `;
                cryptoCountEl.textContent = '0 connected';
            }

            // Update Net Worth Summary
            const netWorth = (totalCash + totalCrypto) - totalCredit;
            
            // Animate counters
            animateValue(netWorthEl, 0, netWorth, 1000);
            totalCashEl.innerHTML = formatCurrency(totalCash);
            totalCryptoEl.innerHTML = formatCurrency(totalCrypto);

            // Update Progress Bar Allocations
            const totalAssets = totalCash + totalCrypto + totalCredit;
            if (totalAssets > 0) {
                const cashPct = Math.round((totalCash / totalAssets) * 100);
                const cryptoPct = Math.round((totalCrypto / totalAssets) * 100);
                const creditPct = Math.round((totalCredit / totalAssets) * 100);

                barCash.style.width = `${cashPct}%`;
                barCrypto.style.width = `${cryptoPct}%`;
                barCredit.style.width = `${creditPct}%`;

                pctCash.textContent = `${cashPct}%`;
                pctCrypto.textContent = `${cryptoPct}%`;
                pctCredit.textContent = `${creditPct}%`;
            } else {
                barCash.style.width = '0%';
                barCrypto.style.width = '0%';
                barCredit.style.width = '0%';
                pctCash.textContent = '0%';
                pctCrypto.textContent = '0%';
                pctCredit.textContent = '0%';
            }

            // Handle badge display
            if (plaidSimulated || krakenSimulated) {
                simulatedBadge.classList.remove('hidden');
            } else {
                simulatedBadge.classList.add('hidden');
            }

            // Fetch Trend History
            try {
                const historyRes = await fetch('/api/history');
                const history = await historyRes.json();
                updateTrendBadge(netWorth, history);
                renderNetWorthChart(history);
            } catch (histErr) {
                console.warn('[History] Failed to load trend:', histErr);
            }

            // Load AI Advisor recommendations
            fetchAdvisorTips();

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            showToast('Failed to fetch account metrics.', 'error');
        }
    }

    function showLoadingState() {
        netWorthEl.innerHTML = '<span class="loading-pulse">...</span>';
    }

    // --- PLAID LINK IMPLEMENTATION ---
    async function initPlaidLink() {
        try {
            const response = await fetch('/api/create_link_token', { method: 'POST' });
            const data = await response.json();

            // Check if backend runs in Simulated Mode (Plaid keys not set)
            if (data.simulated) {
                showToast('Simulator Mode: Connecting simulated bank account...', 'info');
                
                // Simulate a bank account creation by directly calling exchange with mock public token
                setTimeout(async () => {
                    const exchangeRes = await fetch('/api/exchange_public_token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ public_token: 'public-sandbox-mock-token' })
                    });
                    const exchangeData = await exchangeRes.json();
                    if (exchangeData.success) {
                        showToast('Simulated Account Linked successfully!', 'success');
                        fetchDashboardData();
                    }
                }, 1500);
                return;
            }

            // Real Plaid Link initialization
            const handler = Plaid.create({
                token: data.link_token,
                onSuccess: async (public_token, metadata) => {
                    showToast('Bank Authorized. Finalizing connection...', 'info');
                    
                    const exchangeResponse = await fetch('/api/exchange_public_token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ public_token: public_token }),
                    });
                    
                    const exchangeData = await exchangeResponse.json();
                    if (exchangeData.success) {
                        showToast(`Successfully linked ${metadata.institution.name}!`, 'success');
                        fetchDashboardData();
                    } else {
                        showToast('Failed to link account token exchange.', 'error');
                    }
                },
                onExit: (err, metadata) => {
                    if (err != null) {
                        showToast('Plaid Link exited with error.', 'error');
                    }
                },
            });
            
            handler.open();

        } catch (error) {
            console.error('Plaid Link initialization failed:', error);
            showToast('Unable to connect to Plaid. Check credentials.', 'error');
        }
    }

    // --- KRAKEN MODAL ACTIONS ---
    function openKrakenModal() {
        krakenModal.classList.remove('hidden');
    }

    function closeKrakenModal() {
        krakenModal.classList.add('hidden');
        krakenForm.reset();
    }

    krakenForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const apiKey = document.getElementById('kraken-key').value.trim();
        const apiSecret = document.getElementById('kraken-secret').value.trim();

        showToast('Saving Kraken API Credentials...', 'info');

        try {
            const res = await fetch('/api/kraken/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, apiSecret })
            });

            const data = await res.json();
            if (data.success) {
                showToast('Kraken credentials set successfully!', 'success');
                closeKrakenModal();
                fetchDashboardData();
            } else {
                showToast('Failed to set Kraken credentials.', 'error');
            }
        } catch (err) {
            showToast('Error setting credentials.', 'error');
        }
    });

    krakenDemoBtn.addEventListener('click', () => {
        closeKrakenModal();
        showToast('Running Kraken in Simulator Mode.', 'info');
        fetchDashboardData();
    });

    // Reset Connected Data
    resetBtn.addEventListener('click', async () => {
        showToast('Resetting all account links...', 'info');
        try {
            const res = await fetch('/api/reset', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast('Accounts reset successfully.', 'success');
                fetchDashboardData();
            }
        } catch (e) {
            showToast('Reset failed.', 'error');
        }
    });

    // --- AI ADVISOR INSIGHTS & CHAT IMPLEMENTATION ---
    const insightsContainer = document.getElementById('insights-container');
    const dashboardView = document.getElementById('dashboard-view');
    const chatView = document.getElementById('chat-view');
    const settingsView = document.getElementById('settings-view');
    const transactionsView = document.getElementById('transactions-view');
    const navDashboard = document.getElementById('nav-dashboard');
    const navChat = document.getElementById('nav-chat');
    const navSettings = document.getElementById('nav-settings');
    const navTransactions = document.getElementById('nav-transactions');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const viewTitle = document.getElementById('view-title');

    // Settings elements
    const settingsForm = document.getElementById('settings-form');
    const settingsSalary = document.getElementById('settings-salary');
    const settingsPayFrequency = document.getElementById('settings-pay-frequency');

    // Manual accounts elements
    const manualAccountForm = document.getElementById('manual-account-form');
    const manualName = document.getElementById('manual-name');
    const manualInstitution = document.getElementById('manual-institution');
    const manualBalance = document.getElementById('manual-balance');
    const manualType = document.getElementById('manual-type');
    const manualAccountsListBody = document.getElementById('manual-accounts-list-body');
    const manualEmptyState = document.getElementById('manual-empty-state');

    // Transactions elements
    const txTableBody = document.getElementById('transactions-table-body');
    const txSearch = document.getElementById('tx-search');
    const txTypeFilter = document.getElementById('tx-type-filter');
    const txEmptyState = document.getElementById('tx-empty-state');
    const txLoadingShimmer = document.getElementById('tx-loading-shimmer');
    let allTransactionsCache = [];

    // Chat sidebar elements
    const chatCashVal = document.getElementById('chat-cash-val');
    const chatCryptoVal = document.getElementById('chat-crypto-val');
    const chatCreditVal = document.getElementById('chat-credit-val');

    // Chat state
    let chatMessages = [
        { role: 'assistant', content: 'Hello! I am Aura, your fiduciary AI advisor. I have analyzed your accounts and recent transactions. You can select one of the tips from the dashboard, or type a question below to analyze your expenses, savings, liabilities, or crypto portfolio allocation.' }
    ];

    const chatHistoryEl = document.getElementById('chat-history');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');

    // Toggle screens
    function showDashboard() {
        dashboardView.classList.remove('hidden');
        chatView.classList.add('hidden');
        settingsView.classList.add('hidden');
        transactionsView.classList.add('hidden');
        navChat.classList.remove('active');
        navSettings.classList.remove('active');
        navTransactions.classList.remove('active');
        navDashboard.classList.add('active');
        viewTitle.textContent = 'Overview';
    }

    function showChat() {
        dashboardView.classList.add('hidden');
        chatView.classList.remove('hidden');
        settingsView.classList.add('hidden');
        transactionsView.classList.add('hidden');
        navDashboard.classList.remove('active');
        navSettings.classList.remove('active');
        navTransactions.classList.remove('active');
        navChat.classList.add('active');
        viewTitle.textContent = 'AI Financial Advisor';

        // Sync mini-metrics
        chatCashVal.textContent = formatCurrency(totalCash);
        chatCryptoVal.textContent = formatCurrency(totalCrypto);
        chatCreditVal.textContent = formatCurrency(totalCredit);
    }

    function showSettings() {
        dashboardView.classList.add('hidden');
        chatView.classList.add('hidden');
        settingsView.classList.remove('hidden');
        transactionsView.classList.add('hidden');
        navDashboard.classList.remove('active');
        navChat.classList.remove('active');
        navTransactions.classList.remove('active');
        navSettings.classList.add('active');
        viewTitle.textContent = 'Settings & Profile';
        fetchManualAccounts();
    }

    function showTransactions() {
        dashboardView.classList.add('hidden');
        chatView.classList.add('hidden');
        settingsView.classList.add('hidden');
        transactionsView.classList.remove('hidden');
        navDashboard.classList.remove('active');
        navChat.classList.remove('active');
        navSettings.classList.remove('active');
        navTransactions.classList.add('active');
        viewTitle.textContent = 'Transactions Log';
        loadTransactionsPage();
    }

    // Fetch and populate Profile Settings
    async function fetchProfileSettings() {
        try {
            const res = await fetch('/api/profile');
            const data = await res.json();
            
            settingsSalary.value = data.salary || '';
            settingsPayFrequency.value = data.payFrequency || 'Monthly';
            
            const riskValue = data.riskAppetite || 'Moderate';
            const radio = document.querySelector(`input[name="settings-risk"][value="${riskValue}"]`);
            if (radio) radio.checked = true;
        } catch (e) {
            console.error('Error fetching settings:', e);
        }
    }

    // Manual accounts logic
    async function fetchManualAccounts() {
        try {
            const res = await fetch('/api/manual_accounts');
            const accounts = await res.json();
            renderManualAccountsList(accounts);
        } catch (err) {
            console.error('[Manual accounts] Load failed:', err);
        }
    }

    function renderManualAccountsList(accounts) {
        manualAccountsListBody.innerHTML = '';
        if (!accounts || accounts.length === 0) {
            manualEmptyState.classList.remove('hidden');
            return;
        }
        manualEmptyState.classList.add('hidden');

        accounts.forEach(acc => {
            const tr = document.createElement('tr');
            const displayBalance = formatCurrency(acc.balance);
            const isLiability = acc.type === 'credit' || acc.type === 'loan';
            const balanceClass = (isLiability || acc.balance < 0) ? 'credit-neg' : '';
            const typeBadge = isLiability ? (acc.type === 'loan' ? 'Liability (Loan)' : 'Liability (Credit)') : 'Asset';

            tr.innerHTML = `
                <td style="font-weight: 500;">${acc.name}</td>
                <td>${acc.institution}</td>
                <td><span class="tx-type-label">${typeBadge}</span></td>
                <td class="${balanceClass}" style="font-weight: 700;">${displayBalance}</td>
                <td>
                    <button class="btn-delete-manual" data-id="${acc.id}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;

            tr.querySelector('.btn-delete-manual').addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete "${acc.name}"?`)) {
                    await deleteManualAccount(acc.id);
                }
            });

            manualAccountsListBody.appendChild(tr);
        });
    }

    async function deleteManualAccount(id) {
        try {
            const res = await fetch(`/api/manual_accounts/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Manual account deleted.', 'success');
                fetchManualAccounts();
                fetchDashboardData();
            }
        } catch (err) {
            showToast('Delete failed.', 'error');
        }
    }

    // Render trend badge
    function updateTrendBadge(currentNetWorth, history) {
        const trendEl = document.getElementById('net-worth-trend');
        if (!trendEl) return;

        if (!history || history.length < 2) {
            trendEl.className = 'trend-badge neutral';
            trendEl.querySelector('.trend-icon').className = 'trend-icon fa-solid fa-arrows-left-right';
            trendEl.querySelector('.trend-pct').textContent = '0.0%';
            trendEl.classList.remove('hidden');
            return;
        }

        let previousSnapshot = history[history.length - 2];
        const todayStr = new Date().toLocaleDateString('en-CA');
        let baseline = previousSnapshot.netWorth;
        
        if (history[history.length - 1].date !== todayStr) {
            baseline = history[history.length - 1].netWorth;
        }

        if (baseline === 0) {
            trendEl.className = 'trend-badge neutral';
            trendEl.querySelector('.trend-icon').className = 'trend-icon fa-solid fa-arrows-left-right';
            trendEl.querySelector('.trend-pct').textContent = '0.0%';
            trendEl.classList.remove('hidden');
            return;
        }

        const change = currentNetWorth - baseline;
        const pctChange = (change / Math.abs(baseline)) * 100;

        const iconEl = trendEl.querySelector('.trend-icon');
        const pctEl = trendEl.querySelector('.trend-pct');

        if (pctChange > 0.05) {
            trendEl.className = 'trend-badge up';
            iconEl.className = 'trend-icon fa-solid fa-arrow-trend-up';
            pctEl.textContent = `+${pctChange.toFixed(1)}%`;
        } else if (pctChange < -0.05) {
            trendEl.className = 'trend-badge down';
            iconEl.className = 'trend-icon fa-solid fa-arrow-trend-down';
            pctEl.textContent = `${pctChange.toFixed(1)}%`;
        } else {
            trendEl.className = 'trend-badge neutral';
            iconEl.className = 'trend-icon fa-solid fa-arrows-left-right';
            pctEl.textContent = '0.0%';
        }
        trendEl.classList.remove('hidden');
    }

    // Chart.js render helper
    let netWorthChartInstance = null;
    function renderNetWorthChart(history) {
        const ctx = document.getElementById('netWorthChart');
        const emptyState = document.getElementById('chart-empty-state');
        if (!ctx) return;

        if (!history || history.length === 0) {
            ctx.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        ctx.classList.remove('hidden');
        emptyState.classList.add('hidden');

        if (netWorthChartInstance) {
            netWorthChartInstance.destroy();
        }

        const labels = history.map(h => {
            const date = new Date(h.date + 'T00:00:00');
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        });

        const cashData = history.map(h => h.cash);
        const cryptoData = history.map(h => h.crypto);
        const netWorthData = history.map(h => h.netWorth);

        netWorthChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Net Worth',
                        data: netWorthData,
                        borderColor: '#10b981',
                        borderWidth: 3,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: 'rgba(255,255,255,0.1)',
                        pointHoverRadius: 6,
                        tension: 0.35,
                        fill: false
                    },
                    {
                        label: 'Cash Assets',
                        data: cashData,
                        borderColor: '#0ea5e9',
                        borderWidth: 2,
                        pointBackgroundColor: '#0ea5e9',
                        pointHoverRadius: 4,
                        tension: 0.35,
                        fill: true,
                        backgroundColor: 'rgba(14, 165, 233, 0.05)'
                    },
                    {
                        label: 'Crypto Assets',
                        data: cryptoData,
                        borderColor: '#a855f7',
                        borderWidth: 2,
                        pointBackgroundColor: '#a855f7',
                        pointHoverRadius: 4,
                        tension: 0.35,
                        fill: true,
                        backgroundColor: 'rgba(168, 85, 247, 0.05)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#111422',
                        titleColor: '#f8fafc',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        padding: 10,
                        bodyFont: {
                            family: 'Plus Jakarta Sans'
                        },
                        titleFont: {
                            family: 'Plus Jakarta Sans',
                            weight: 'bold'
                        },
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255,255,255,0.02)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'Plus Jakarta Sans',
                                size: 10
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255,255,255,0.04)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'Plus Jakarta Sans',
                                size: 10
                            },
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // Transactions Log Functions
    async function loadTransactionsPage() {
        txTableBody.innerHTML = '';
        txEmptyState.classList.add('hidden');
        txLoadingShimmer.classList.remove('hidden');

        try {
            const res = await fetch('/api/transactions');
            const data = await res.json();
            allTransactionsCache = data.transactions || [];
            renderTransactionsTable(allTransactionsCache);
        } catch (err) {
            console.error('[Transactions] Failed to load transactions:', err);
            showToast('Failed to load transaction data.', 'error');
            txEmptyState.classList.remove('hidden');
        } finally {
            txLoadingShimmer.classList.add('hidden');
        }
    }

    function renderTransactionsTable(transactions) {
        txTableBody.innerHTML = '';
        
        if (!transactions || transactions.length === 0) {
            txEmptyState.classList.remove('hidden');
            return;
        }
        txEmptyState.classList.add('hidden');

        transactions.forEach(tx => {
            const tr = document.createElement('tr');
            const amountClass = tx.type === 'deposit' ? 'deposit' : 'expense';
            const amountSign = tx.type === 'deposit' ? '+' : '-';
            const categoryClass = tx.category.toLowerCase().replace(/[^a-z0-9]/g, '-');
            
            const formattedDate = new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC'
            });

            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td style="font-weight: 500;">${tx.name}</td>
                <td><span class="category-tag ${categoryClass}">${tx.category}</span></td>
                <td><span class="tx-type-label">${tx.type}</span></td>
                <td class="tx-amount ${amountClass}">${amountSign}${formatCurrency(tx.amount)}</td>
            `;
            txTableBody.appendChild(tr);
        });
    }

    function applyTransactionFilters() {
        const query = txSearch.value.trim().toLowerCase();
        const type = txTypeFilter.value;

        const filtered = allTransactionsCache.filter(tx => {
            const matchesSearch = tx.name.toLowerCase().includes(query) || 
                                  tx.category.toLowerCase().includes(query);
            const matchesType = type === 'all' || tx.type === type;
            return matchesSearch && matchesType;
        });

        renderTransactionsTable(filtered);
    }

    // Render message bubbles in chat
    function renderMessage(role, content) {
        const msgEl = document.createElement('div');
        msgEl.className = `chat-message ${role}`;
        
        let formattedContent = content;
        if (role === 'assistant') {
            formattedContent = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>')
                .replace(/- (.*?)(<br>|$)/g, '<li>$1</li>')
                .replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
        } else {
            formattedContent = `<p>${content}</p>`;
        }

        msgEl.innerHTML = `<div class="message-content">${formattedContent}</div>`;
        chatHistoryEl.appendChild(msgEl);
        chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
    }

    // Send chat message to backend
    async function sendChatMessage(userText) {
        if (!userText) return;
        
        chatInput.disabled = true;
        sendChatBtn.disabled = true;

        renderMessage('user', userText);
        chatMessages.push({ role: 'user', content: userText });

        const typingEl = document.createElement('div');
        typingEl.className = 'chat-message assistant typing-indicator';
        typingEl.innerHTML = `<div class="message-content"><span class="loading-pulse">Aura is thinking...</span></div>`;
        chatHistoryEl.appendChild(typingEl);
        chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;

        try {
            const res = await fetch('/api/advisor/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatMessages })
            });
            const data = await res.json();
            
            typingEl.remove();

            if (data.content) {
                renderMessage('assistant', data.content);
                chatMessages.push({ role: 'assistant', content: data.content });
            } else if (data.error) {
                renderMessage('assistant', `Error: ${data.error}`);
            }
        } catch (e) {
            typingEl.remove();
            renderMessage('assistant', 'Sorry, I encountered an error communicating with the agent.');
        } finally {
            chatInput.disabled = false;
            sendChatBtn.disabled = false;
            chatInput.focus();
        }
    }

    // Fetch and render daily tips
    async function fetchAdvisorTips() {
        insightsContainer.innerHTML = `
            <div class="insight-card-shimmer">
                <div class="shimmer-pulse" style="width: 40%; height: 16px; margin-bottom: 1rem; border-radius: 4px;"></div>
                <div class="shimmer-pulse" style="width: 90%; height: 12px; margin-bottom: 0.5rem; border-radius: 4px;"></div>
                <div class="shimmer-pulse" style="width: 70%; height: 12px; border-radius: 4px;"></div>
            </div>
            <div class="insight-card-shimmer">
                <div class="shimmer-pulse" style="width: 45%; height: 16px; margin-bottom: 1rem; border-radius: 4px;"></div>
                <div class="shimmer-pulse" style="width: 85%; height: 12px; margin-bottom: 0.5rem; border-radius: 4px;"></div>
                <div class="shimmer-pulse" style="width: 65%; height: 12px; border-radius: 4px;"></div>
            </div>
            <div class="insight-card-shimmer">
                <div class="shimmer-pulse" style="width: 35%; height: 16px; margin-bottom: 1rem; border-radius: 4px;"></div>
                <div class="shimmer-pulse" style="width: 90%; height: 12px; margin-bottom: 0.5rem; border-radius: 4px;"></div>
                <div class="shimmer-pulse" style="width: 60%; height: 12px; border-radius: 4px;"></div>
            </div>
        `;

        try {
            const res = await fetch('/api/advisor/tips');
            const data = await res.json();
            
            insightsContainer.innerHTML = '';
            if (data.tips && data.tips.length > 0) {
                data.tips.forEach(tip => {
                    const card = document.createElement('div');
                    card.className = `insight-card ${tip.type}`;
                    
                    let icon = 'fa-solid fa-circle-exclamation';
                    if (tip.type === 'danger') icon = 'fa-solid fa-triangle-exclamation';
                    else if (tip.type === 'warning') icon = 'fa-solid fa-circle-info';
                    else if (tip.type === 'info') icon = 'fa-solid fa-lightbulb';
                    else if (tip.type === 'success') icon = 'fa-solid fa-circle-check';

                    card.innerHTML = `
                        <div>
                            <div class="insight-title"><i class="${icon}"></i> ${tip.title}</div>
                            <div class="insight-desc">${tip.description}</div>
                        </div>
                        <div class="insight-action-hint">
                            <i class="fa-solid fa-comment-dots"></i> Ask Advisor Deep-Dive
                        </div>
                    `;

                    // Click handler to launch chat deep-dive
                    card.addEventListener('click', () => {
                        showChat();
                        
                        chatHistoryEl.innerHTML = '';
                        chatMessages = [
                            { role: 'assistant', content: `You selected the tip: **${tip.title}**.\n\n*${tip.description}*` }
                        ];
                        renderMessage('assistant', chatMessages[0].content);
                        
                        sendChatMessage(tip.chatPrompt);
                    });

                    insightsContainer.appendChild(card);
                });
            } else {
                insightsContainer.innerHTML = `
                    <div class="empty-state" style="grid-column: span 3; padding: 2rem;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                        <p>No new financial recommendations at this time.</p>
                    </div>
                `;
            }
        } catch (e) {
            console.error('Error fetching tips:', e);
            insightsContainer.innerHTML = `
                <div class="empty-state" style="grid-column: span 3; padding: 2rem; border-color: var(--accent-rose);">
                    <i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-rose); font-size:1.5rem; margin-bottom:0.5rem;"></i>
                    <p>Failed to load recommendations.</p>
                </div>
            `;
        }
    }

    // Event Listeners
    plaidLinkBtn.addEventListener('click', initPlaidLink);
    krakenLinkBtn.addEventListener('click', openKrakenModal);
    closeModalBtn.addEventListener('click', closeKrakenModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === krakenModal) {
            closeKrakenModal();
        }
    });

    navDashboard.addEventListener('click', (e) => { e.preventDefault(); showDashboard(); });
    navChat.addEventListener('click', (e) => { e.preventDefault(); showChat(); });
    navSettings.addEventListener('click', (e) => { e.preventDefault(); showSettings(); });
    navTransactions.addEventListener('click', (e) => { e.preventDefault(); showTransactions(); });
    backToDashboardBtn.addEventListener('click', showDashboard);

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        sendChatMessage(text);
    });

    txSearch.addEventListener('input', applyTransactionFilters);
    txTypeFilter.addEventListener('change', applyTransactionFilters);

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const salary = parseFloat(settingsSalary.value) || 0;
        const payFrequency = settingsPayFrequency.value;
        const riskAppetite = document.querySelector('input[name="settings-risk"]:checked').value;

        showToast('Saving settings...', 'info');

        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ salary, payFrequency, riskAppetite })
            });
            const data = await res.json();
            showToast('Settings saved successfully!', 'success');
            fetchDashboardData();
            showDashboard();
        } catch (err) {
            showToast('Failed to save settings.', 'error');
        }
    });

    manualAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = manualName.value.trim();
        const institution = manualInstitution.value.trim() || 'Manual Entry';
        const balance = parseFloat(manualBalance.value) || 0;
        const type = manualType.value;

        showToast('Adding manual account...', 'info');

        try {
            const res = await fetch('/api/manual_accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, institution, balance, type })
            });
            const data = await res.json();
            showToast('Manual account added!', 'success');
            
            manualName.value = '';
            manualInstitution.value = '';
            manualBalance.value = '';
            
            fetchManualAccounts();
            fetchDashboardData();
        } catch (err) {
            showToast('Failed to add manual account.', 'error');
        }
    });

    // Overrides DOM elements
    const overrideForm = document.getElementById('override-form');
    const overrideAccountSelect = document.getElementById('override-account-select');
    const overrideApr = document.getElementById('override-apr');
    const overrideDueDate = document.getElementById('override-due-date');
    const overridesListBody = document.getElementById('overrides-list-body');
    const overridesEmptyState = document.getElementById('overrides-empty-state');

    // Overrides management helpers
    async function fetchOverrides() {
        try {
            const res = await fetch('/api/account_overrides');
            const overrides = await res.json();
            renderOverridesList(overrides);
        } catch (err) {
            console.error('[Overrides] Load failed:', err);
        }
    }

    function populateOverrideDropdown() {
        const selectedVal = overrideAccountSelect.value;
        overrideAccountSelect.innerHTML = '<option value="" disabled selected>Select an account...</option>';
        
        if (!globalAccounts || globalAccounts.length === 0) {
            return;
        }

        globalAccounts.forEach(group => {
            group.accounts.forEach(acc => {
                const isLiability = acc.type === 'credit' || acc.type === 'loan';
                if (isLiability) {
                    const opt = document.createElement('option');
                    opt.value = acc.id;
                    opt.textContent = `${group.institution} - ${acc.name} (•••• ${acc.mask || 'MANUAL'})`;
                    overrideAccountSelect.appendChild(opt);
                }
            });
        });

        if (selectedVal) {
            overrideAccountSelect.value = selectedVal;
        }
    }

    function renderOverridesList(overrides) {
        overridesListBody.innerHTML = '';
        const keys = Object.keys(overrides);
        if (keys.length === 0) {
            overridesEmptyState.classList.remove('hidden');
            return;
        }
        overridesEmptyState.classList.add('hidden');

        keys.forEach(accId => {
            const override = overrides[accId];
            
            let accName = accId;
            let found = false;
            globalAccounts.forEach(group => {
                const match = group.accounts.find(a => a.id === accId);
                if (match) {
                    accName = `${group.institution} - ${match.name}`;
                    found = true;
                }
            });

            if (!found) {
                accName = `Account ID: ${accId.substring(0, 15)}...`;
            }

            const tr = document.createElement('tr');
            const formattedDate = override.nextPaymentDueDate 
                ? new Date(override.nextPaymentDueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                : 'Not Set';

            tr.innerHTML = `
                <td style="font-weight: 500;">${accName}</td>
                <td><span class="tx-type-label" style="background: rgba(6,182,212,0.1); color: var(--accent-cyan); border-color: rgba(6,182,212,0.2);">${override.apr}%</span></td>
                <td>${formattedDate}</td>
                <td>
                    <button class="btn-delete-override" data-id="${accId}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;

            tr.querySelector('.btn-delete-override').addEventListener('click', async () => {
                if (confirm(`Remove override for this account?`)) {
                    await deleteOverride(accId);
                }
            });

            overridesListBody.appendChild(tr);
        });
    }

    async function deleteOverride(accountId) {
        showToast('Deleting override...', 'info');
        try {
            const res = await fetch(`/api/account_overrides/${accountId}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Override deleted successfully.', 'success');
                fetchOverrides();
                fetchDashboardData();
            } else {
                showToast('Failed to delete override.', 'error');
            }
        } catch (err) {
            showToast('Failed to delete override.', 'error');
        }
    }

    overrideForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const accountId = overrideAccountSelect.value;
        const apr = parseFloat(overrideApr.value);
        const nextPaymentDueDate = overrideDueDate.value || null;

        if (!accountId) {
            showToast('Please select an account first.', 'error');
            return;
        }

        showToast('Saving override...', 'info');

        try {
            const res = await fetch('/api/account_overrides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId, apr, nextPaymentDueDate })
            });

            if (res.ok) {
                showToast('Override saved successfully!', 'success');
                overrideApr.value = '';
                overrideDueDate.value = '';
                overrideAccountSelect.selectedIndex = 0;
                fetchOverrides();
                fetchDashboardData();
            } else {
                showToast('Failed to save override.', 'error');
            }
        } catch (err) {
            showToast('Failed to save override.', 'error');
        }
    });

    // Plaid Connections DOM elements
    const plaidConnectionsListBody = document.getElementById('plaid-connections-list-body');
    const plaidConnectionsEmptyState = document.getElementById('plaid-connections-empty-state');

    async function fetchPlaidConnections() {
        try {
            const res = await fetch('/api/plaid_connections');
            const connections = await res.json();
            renderPlaidConnectionsList(connections);
        } catch (err) {
            console.error('[Plaid Connections] Load failed:', err);
        }
    }

    function renderPlaidConnectionsList(connections) {
        plaidConnectionsListBody.innerHTML = '';
        if (!connections || connections.length === 0) {
            plaidConnectionsEmptyState.classList.remove('hidden');
            return;
        }
        plaidConnectionsEmptyState.classList.add('hidden');

        connections.forEach(conn => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td style="font-weight: 500; padding: 12px;">
                    <i class="fa-solid fa-building-columns" style="color: var(--accent-cyan); margin-right: 8px;"></i>
                    ${conn.institutionName}
                </td>
                <td style="color: var(--text-secondary); font-size: 0.85rem; padding: 12px;">
                    ${conn.accountsSummary || 'No accounts found'}
                </td>
                <td style="text-align: center; padding: 12px;">
                    <button class="btn-delete-connection" data-token="${conn.token}" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#f43f5e'" onmouseout="this.style.color='var(--text-secondary)'">
                        <i class="fa-solid fa-link-slash"></i>
                    </button>
                </td>
            `;

            tr.querySelector('.btn-delete-connection').addEventListener('click', async () => {
                if (confirm(`Are you sure you want to disconnect this connection to ${conn.institutionName}? This will stop syncing the associated accounts.`)) {
                    await disconnectPlaidConnection(conn.token);
                }
            });

            plaidConnectionsListBody.appendChild(tr);
        });
    }

    async function disconnectPlaidConnection(token) {
        showToast('Disconnecting bank connection...', 'info');
        try {
            const res = await fetch('/api/plaid_connections', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            if (res.ok) {
                showToast('Bank connection disconnected successfully.', 'success');
                fetchPlaidConnections();
                fetchDashboardData();
            } else {
                showToast('Failed to disconnect bank connection.', 'error');
            }
        } catch (err) {
            showToast('Failed to disconnect bank connection.', 'error');
        }
    }

    // Initial load
    fetchProfileSettings();
    fetchManualAccounts();
    fetchDashboardData();
    fetchPlaidConnections();
});

