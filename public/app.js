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
                        const isCredit = acc.type === 'credit';
                        const balance = acc.balance;
                        
                        if (isCredit) {
                            totalCredit += Math.abs(balance);
                        } else {
                            totalCash += balance;
                        }

                        accountsHtml += `
                            <div class="account-row-card">
                                <div class="acc-info">
                                    <span class="acc-name">${acc.name}</span>
                                    <span class="acc-meta">${acc.subtype.toUpperCase()} •••• ${acc.mask}</span>
                                </div>
                                <div class="acc-balance-container">
                                    <span class="acc-val ${isCredit ? 'credit-neg' : ''}">
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
    const navDashboard = document.getElementById('nav-dashboard');
    const navChat = document.getElementById('nav-chat');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const viewTitle = document.getElementById('view-title');

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
        navChat.classList.remove('active');
        navDashboard.classList.add('active');
        viewTitle.textContent = 'Overview';
    }

    function showChat() {
        dashboardView.classList.add('hidden');
        chatView.classList.remove('hidden');
        navDashboard.classList.remove('active');
        navChat.classList.add('active');
        viewTitle.textContent = 'AI Financial Advisor';

        // Sync mini-metrics
        chatCashVal.textContent = formatCurrency(totalCash);
        chatCryptoVal.textContent = formatCurrency(totalCrypto);
        chatCreditVal.textContent = formatCurrency(totalCredit);
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
    backToDashboardBtn.addEventListener('click', showDashboard);

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        sendChatMessage(text);
    });

    // Initial load
    fetchDashboardData();
});

