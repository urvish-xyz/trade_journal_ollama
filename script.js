class TradingJournal {
    constructor() {
        this.trades = [];
        this.strategies = ['Breakout', 'Swing', 'Scalp', 'News Trade', 'Reversal'];
        this.tags = ['High Confidence', 'Quick Trade', 'Long Hold', 'Risky', 'Safe'];
        this.notes = [];
        this.settings = { defaultRisk: 2, theme: 'auto' };
        this.currentUserId = null;

        this.charts = {};
        this.currentSection = 'dashboard';
        this.currentMonth = new Date();
        this.sortConfig = { key: null, direction: 'asc' };
        this.filters = {};
        this.resizeTimeout = null;
        this.autoLogoutTimeout = null;

        this.emotionalStates = ['Calm', 'Frustrated', 'Overconfident', 'Anxious', 'Impatient', 'Focused', 'Stressed'];
        this.mistakes = ['overtrading', 'risked-too-much', 'exited-too-late', 'ignored-signals', 'ignored-stoploss', 'revenge-trading', 'exited-too-early', 'fomo-entry', 'no-clear-plan', 'no-mistake'];
    }

    init() {
        this.checkExistingSession();
        this.setupLoginEventListeners();
    }

    checkExistingSession() {
        const savedUserId = sessionStorage.getItem('tradingJournalUserId');
        const loginTime = sessionStorage.getItem('loginTime');
        
        if (savedUserId && loginTime) {
            const elapsed = Date.now() - parseInt(loginTime);
            const twentyFourHours = 24 * 60 * 60 * 1000;
            
            if (elapsed > twentyFourHours) {
                // Auto logout - session expired
                this.logout();
            } else {
                this.currentUserId = savedUserId;
                this.loadUserData();
                // Set timer for remaining time
                const remaining = twentyFourHours - elapsed;
                this.autoLogoutTimeout = setTimeout(() => this.logout(), remaining);
            }
        } else {
            this.showLoginModal();
        }
    }

    showLoginModal() {
        document.getElementById('login-modal').style.display = 'flex';
    }

    hideLoginModal() {
        document.getElementById('login-modal').style.display = 'none';
    }

    async setupLoginEventListeners() {
        const loginForm = document.getElementById('login-form');
        const createAccountBtn = document.getElementById('create-account-btn');
        const userIdInput = document.getElementById('user-id');
        const secretKeyInput = document.getElementById('secret-key');
        const loginBtn = document.getElementById('login-btn');
        const errorDiv = document.getElementById('login-error');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = userIdInput.value.trim().toLowerCase();
            const secretKey = secretKeyInput.value.trim();

            if (!userId || !secretKey) {
                errorDiv.textContent = 'Please enter both User ID and Secret Key';
                return;
            }
            if (userId.length < 3) {
                errorDiv.textContent = 'User ID must be at least 3 characters';
                return;
            }
            if (secretKey.length < 4 || secretKey.length > 6) {
                errorDiv.textContent = 'Secret key must be 4-6 digits';
                return;
            }

            loginBtn.disabled = true;
            loginBtn.textContent = 'Loading...';
            errorDiv.textContent = '';

            const result = await FirebaseDB.login(userId, secretKey);

            if (result.success) {
                this.currentUserId = userId;
                sessionStorage.setItem('tradingJournalUserId', userId);
                sessionStorage.setItem('loginTime', Date.now().toString());
                this.hideLoginModal();
                this.loadUserData();
                this.startAutoLogoutTimer();
            } else {
                errorDiv.textContent = result.error;
                loginBtn.disabled = false;
                loginBtn.textContent = 'Access Account';
            }
        });

        createAccountBtn.addEventListener('click', async () => {
            const userId = userIdInput.value.trim().toLowerCase();
            const secretKey = secretKeyInput.value.trim();

            if (userId.length < 3) {
                errorDiv.textContent = 'User ID must be at least 3 characters';
                return;
            }
            if (secretKey.length < 4 || secretKey.length > 6) {
                errorDiv.textContent = 'Secret key must be 4-6 digits';
                return;
            }

            createAccountBtn.disabled = true;
            createAccountBtn.textContent = 'Creating...';
            errorDiv.textContent = '';

            const result = await FirebaseDB.createAccount(userId, secretKey);

            if (result.success) {
                alert('Account created! Now login with your credentials.');
                userIdInput.value = '';
                secretKeyInput.value = '';
                loginBtn.textContent = 'Access Account';
                loginBtn.disabled = false;
                createAccountBtn.disabled = false;
                createAccountBtn.textContent = 'Create one';
            } else {
                errorDiv.textContent = result.error;
                createAccountBtn.disabled = false;
                createAccountBtn.textContent = 'Create one';
            }
        });
    }

    async loadUserData() {
        if (!this.currentUserId) return;

        const tradesResult = await FirebaseDB.getTrades(this.currentUserId);
        if (tradesResult.success) {
            this.trades = tradesResult.trades.map(t => ({
                ...t,
                entryTime: t.entryTime || t.date,
                exitTime: t.exitTime || t.date
            }));
        }

        const strategiesResult = await FirebaseDB.getStrategies(this.currentUserId);
        if (strategiesResult.success) {
            this.strategies = strategiesResult.strategies;
        }

        const tagsResult = await FirebaseDB.getTags(this.currentUserId);
        if (tagsResult.success) {
            this.tags = tagsResult.tags;
        }

        const settingsResult = await FirebaseDB.getSettings(this.currentUserId);
        if (settingsResult.success) {
            this.settings = { ...this.settings, ...settingsResult.settings };
        }

        this.setupAppEventListeners();
        this.setupTheme();
        this.showAppUI();
        setTimeout(() => this.setupCharts(), 100);
    }

    showAppUI() {
        document.getElementById('app-container').style.display = 'block';
        this.renderAllSections();
    }

    loadData() {
        // Now handled by Firebase in loadUserData()
    }

    saveData() {
        // Now handled by Firebase in individual operations
    }

    async syncTradeToFirebase(trade, isNew = false) {
        if (!this.currentUserId) return;
        trade.entryTime = trade.entryTime || trade.date;
        trade.exitTime = trade.exitTime || trade.date;
        
        if (isNew) {
            await FirebaseDB.saveTrade(this.currentUserId, trade);
        } else if (trade.id) {
            await FirebaseDB.saveTrade(this.currentUserId, trade);
        }
        
        // Refresh trade list
        const result = await FirebaseDB.getTrades(this.currentUserId);
        if (result.success) {
            this.trades = result.trades.map(t => ({
                ...t,
                entryTime: t.entryTime || t.date,
                exitTime: t.exitTime || t.date
            }));
        }
        
        this.renderAllTrades();
        this.renderDashboard();
    }

    async deleteTradeFromFirebase(tradeId) {
        if (!this.currentUserId) return;
        
        await FirebaseDB.deleteTrade(this.currentUserId, tradeId);
        
        // Refresh trade list
        const result = await FirebaseDB.getTrades(this.currentUserId);
        if (result.success) {
            this.trades = result.trades.map(t => ({
                ...t,
                entryTime: t.entryTime || t.date,
                exitTime: t.exitTime || t.date
            }));
        }
        
        this.renderAllTrades();
        this.renderDashboard();
    }

    async syncSettingsToFirebase() {
        if (!this.currentUserId) return;
        await FirebaseDB.saveSettings(this.currentUserId, this.settings);
    }

    async syncStrategiesToFirebase() {
        if (!this.currentUserId) return;
        await FirebaseDB.saveStrategies(this.currentUserId, this.strategies);
    }

    async syncTagsToFirebase() {
        if (!this.currentUserId) return;
        await FirebaseDB.saveTags(this.currentUserId, this.tags);
    }

    async setupAppEventListeners() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.showSection(e.currentTarget.dataset.section));
        });

        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        document.getElementById('mobile-menu-toggle').addEventListener('click', () => this.toggleMobileNav());
        document.getElementById('mobile-nav-close').addEventListener('click', () => this.closeMobileNav());
        document.getElementById('mobile-nav-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'mobile-nav-overlay') this.closeMobileNav();
        });
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.showSection(e.currentTarget.dataset.section);
                this.closeMobileNav();
            });
        });

        document.getElementById('apply-filter').addEventListener('click', () => this.applyDateFilter());

        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.renderCalendar();
        });
        document.getElementById('next-month').addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.renderCalendar();
        });

        document.getElementById('trade-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTrade();
        });

        document.getElementById('entry-confidence').addEventListener('input', (e) => {
            document.getElementById('confidence-value').textContent = e.target.value;
        });
        document.getElementById('satisfaction').addEventListener('input', (e) => {
            document.getElementById('satisfaction-value').textContent = e.target.value;
        });

        document.getElementById('apply-filters').addEventListener('click', () => this.applyTradeFilters());
        document.getElementById('clear-filters').addEventListener('click', () => this.clearTradeFilters());
        document.getElementById('export-csv').addEventListener('click', () => this.exportCSV());
        document.getElementById('export-json').addEventListener('click', () => this.exportJSON());
        document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-json').click());
        document.getElementById('import-json').addEventListener('change', (e) => this.importJSON(e));

        document.querySelectorAll('[data-sort]').forEach(th => {
            th.addEventListener('click', (e) => this.sortTrades(e.currentTarget.dataset.sort));
        });

        document.getElementById('add-note-btn').addEventListener('click', () => this.openNotesModal());
        document.getElementById('add-demo-data').addEventListener('click', () => this.addDemoData());
        document.getElementById('save-notes').addEventListener('click', () => this.addNote());
        document.getElementById('cancel-notes').addEventListener('click', () => this.closeNotesModal());
        document.getElementById('close-notes-modal').addEventListener('click', () => this.closeNotesModal());

        document.getElementById('add-strategy').addEventListener('click', () => this.addStrategy());
        document.getElementById('add-tag').addEventListener('click', () => this.addTag());
        document.getElementById('default-risk').addEventListener('change', async (e) => {
            this.settings.defaultRisk = parseFloat(e.target.value);
            await this.syncSettingsToFirebase();
        });
        document.getElementById('monthly-goal').addEventListener('change', async (e) => {
            this.settings.monthlyGoal = parseInt(e.target.value);
            await this.syncSettingsToFirebase();
            this.updateMetrics();
        });
        document.getElementById('weekly-goal').addEventListener('change', async (e) => {
            this.settings.weeklyGoal = parseInt(e.target.value);
            await this.syncSettingsToFirebase();
            this.updateMetrics();
        });
        document.getElementById('clear-all-data').addEventListener('click', () => this.clearAllData());

        document.getElementById('close-edit-modal').addEventListener('click', () => this.closeEditModal());
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeEditModal();
                this.closeNotesModal();
            }
        });

        window.addEventListener('resize', () => this.handleWindowResize());
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('tradingJournal_theme');
        if (savedTheme) {
            this.settings.theme = savedTheme;
        }
        this.applyTheme();
    }

    applyTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        let theme = this.settings.theme;

        if (theme === 'auto') {
            theme = prefersDark ? 'dark' : 'light';
        }

        document.documentElement.setAttribute('data-theme', theme);

        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        this.settings.theme = newTheme;
        localStorage.setItem('tradingJournal_theme', newTheme);
        this.applyTheme();

        setTimeout(() => {
            this.updateAllCharts();
        }, 100);
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            sessionStorage.removeItem('tradingJournalUserId');
            sessionStorage.removeItem('loginTime');
            this.currentUserId = null;
            this.trades = [];
            document.getElementById('app-container').style.display = 'none';
            document.getElementById('login-modal').style.display = 'flex';
            document.getElementById('user-id').value = '';
            document.getElementById('secret-key').value = '';
        }
    }

    checkAutoLogout() {
        const loginTime = sessionStorage.getItem('loginTime');
        if (loginTime) {
            const elapsed = Date.now() - parseInt(loginTime);
            const twentyFourHours = 24 * 60 * 60 * 1000;
            if (elapsed > twentyFourHours) {
                this.logout();
            } else {
                // Set timer for remaining time
                const remaining = twentyFourHours - elapsed;
                setTimeout(() => this.logout(), remaining);
            }
        }
    }

startAutoLogoutTimer() {
        // Clear any existing timer
        if (this.autoLogoutTimeout) {
            clearTimeout(this.autoLogoutTimeout);
        }
        // Set 24 hour timer
        const twentyFourHours = 24 * 60 * 60 * 1000;
        this.autoLogoutTimeout = setTimeout(() => this.logout(), twentyFourHours);
    }

    toggleMobileNav() {
        const overlay = document.getElementById('mobile-nav-overlay');
        overlay.classList.toggle('active');

        if (overlay.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    closeMobileNav() {
        const overlay = document.getElementById('mobile-nav-overlay');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    showSection(sectionName) {
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === sectionName) {
                btn.classList.add('active');
            }
        });

        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionName).classList.add('active');

        this.currentSection = sectionName;

        switch (sectionName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'add-trade':
                this.renderAddTradeForm();
                break;
            case 'all-trades':
                this.renderAllTrades();
                break;
            case 'notes':
                this.renderNotes();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    renderDashboard() {
        this.updateMetrics();
        this.renderDayCards();
        this.renderCalendar();
        this.updateAllCharts();
        this.renderStrategyTable();
        this.renderDayAnalysis();
        this.renderMistakeCounter();
        this.renderEmotionPieChart();
        this.renderTimeAnalysis();
        this.renderHoldingTimeAnalysis();
        this.renderConfidenceAnalysis();
    }

    updateMetrics() {
        const filteredTrades = this.getFilteredTrades().sort((a, b) =>
            new Date(a.entryTime || a.date) - new Date(b.entryTime || a.date)
        );

        if (filteredTrades.length === 0) {
            document.getElementById('win-rate').textContent = '0%';
            document.getElementById('avg-rr').textContent = '0:0';
            document.getElementById('best-trade').textContent = 'Rs. 0';
            document.getElementById('worst-trade').textContent = 'Rs. 0';
            document.getElementById('profit-factor').textContent = 'N/A';
            document.getElementById('win-streak').textContent = '0';
            document.getElementById('loss-streak').textContent = '0';
            document.getElementById('total-pnl').textContent = 'Rs. 0';
            return;
        }

        const winningTrades = filteredTrades.filter(trade => this.calculatePnL(trade) > 0);
        const losingTrades = filteredTrades.filter(trade => this.calculatePnL(trade) < 0);
        const winRate = (winningTrades.length / filteredTrades.length) * 100;
        document.getElementById('win-rate').textContent = `${winRate.toFixed(1)}%`;

        const rrRatios = filteredTrades.map(trade => this.calculateRRRatio(trade)).filter(rr => rr > 0);
        const avgRR = rrRatios.length > 0 ? rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length : 0;
        document.getElementById('avg-rr').textContent = `1:${avgRR.toFixed(2)}`;

        const pnls = filteredTrades.map(trade => this.calculatePnL(trade));
        const bestTrade = Math.max(...pnls);
        const worstTrade = Math.min(...pnls);

        document.getElementById('best-trade').textContent = this.formatCurrency(bestTrade, true);
        document.getElementById('worst-trade').textContent = this.formatCurrency(worstTrade, true);

        const grossProfit = winningTrades.reduce((sum, trade) => sum + this.calculatePnL(trade), 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + this.calculatePnL(trade), 0));
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? '∞' : 'N/A');
        document.getElementById('profit-factor').textContent = typeof profitFactor === 'number' ? profitFactor.toFixed(2) : profitFactor;

        let currentWinStreak = 0, maxWinStreak = 0;
        let currentLossStreak = 0, maxLossStreak = 0;
        filteredTrades.forEach(trade => {
            const pnl = this.calculatePnL(trade);
            if (pnl > 0) {
                currentWinStreak++;
                maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
                currentLossStreak = 0;
            } else if (pnl < 0) {
                currentLossStreak++;
                maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
                currentWinStreak = 0;
            }
        });
        document.getElementById('win-streak').textContent = maxWinStreak;
        document.getElementById('loss-streak').textContent = maxLossStreak;

        const totalPnL = pnls.reduce((a, b) => a + b, 0);
        document.getElementById('total-pnl').textContent = this.formatCurrency(totalPnL, true);

        this.renderGoalProgress(totalPnL);
    }

    renderGoalProgress(currentPnL) {
        const monthlyGoal = this.settings.monthlyGoal || 10000;
        const weeklyGoal = this.settings.weeklyGoal || 2500;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
        weekStart.setHours(0, 0, 0, 0);

        const monthTrades = this.trades.filter(t => {
            const tradeDate = new Date(t.entryTime || t.date);
            return tradeDate >= monthStart;
        });
        
        const weekTrades = this.trades.filter(t => {
            const tradeDate = new Date(t.entryTime || t.date);
            return tradeDate >= weekStart;
        });

        const monthPnL = monthTrades.reduce((sum, tr) => sum + this.calculatePnL(tr), 0);
        const weekPnL = weekTrades.reduce((sum, tr) => sum + this.calculatePnL(tr), 0);

        const monthlyPercent = monthlyGoal > 0 ? Math.min((monthPnL / monthlyGoal) * 100, 100) : 0;
        const weeklyPercent = weeklyGoal > 0 ? Math.min((weekPnL / weeklyGoal) * 100, 100) : 0;

        const monthlyProgressText = document.getElementById('monthly-progress-text');
        const weeklyProgressText = document.getElementById('weekly-progress-text');
        const monthlyFill = document.getElementById('monthly-progress-fill');
        const weeklyFill = document.getElementById('weekly-progress-fill');

        if (monthlyProgressText) {
            monthlyProgressText.textContent = `${this.formatCurrency(monthPnL, true)} / ${this.formatCurrency(monthlyGoal, true)}`;
        }
        if (weeklyProgressText) {
            weeklyProgressText.textContent = `${this.formatCurrency(weekPnL, true)} / ${this.formatCurrency(weeklyGoal, true)}`;
        }
        if (monthlyFill) {
            monthlyFill.style.width = `${monthlyPercent}%`;
            monthlyFill.className = 'progress-fill' + (monthlyPercent >= 100 ? '' : monthlyPercent >= 75 ? ' warning' : '');
        }
        if (weeklyFill) {
            weeklyFill.style.width = `${weeklyPercent}%`;
            weeklyFill.className = 'progress-fill' + (weeklyPercent >= 100 ? '' : weeklyPercent >= 75 ? ' warning' : '');
        }
    }

    renderDayCards() {
        const container = document.getElementById('day-cards');
        const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        container.innerHTML = '';

        weekDays.forEach(day => {
            const dayTrades = this.getTradesForDay(day);
            const totalPnL = dayTrades.reduce((sum, trade) => sum + this.calculatePnL(trade), 0);
            const avgRR = this.calculateAverageRR(dayTrades);
            const profitability = dayTrades.length > 0 ?
                (dayTrades.filter(trade => this.calculatePnL(trade) > 0).length / dayTrades.length) * 100 : 0;

            const dayCard = document.createElement('div');
            dayCard.className = `day-card ${totalPnL > 0 ? 'positive' : totalPnL < 0 ? 'negative' : ''}`;
            dayCard.setAttribute('data-day', day);

            dayCard.innerHTML = `
                <div class="day-name">${day}</div>
                <div class="day-pnl ${totalPnL > 0 ? 'positive' : totalPnL < 0 ? 'negative' : ''}">${this.formatCurrency(totalPnL, true)}</div>
                <div class="day-stats">
                    R:R ${avgRR.toFixed(2)} | ${profitability.toFixed(0)}% win
                </div>
            `;

            dayCard.addEventListener('mouseenter', (e) => this.showDayTooltip(e, day, dayTrades, totalPnL, avgRR, profitability));
            dayCard.addEventListener('mouseleave', () => this.hideDayTooltip());

            container.appendChild(dayCard);
        });
    }

    renderCalendar() {
        const container = document.getElementById('calendar');
        const monthYear = document.getElementById('current-month');

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();

        monthYear.textContent = this.currentMonth.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        const firstDay = new Date(year, month, 1);
        let startDayOfWeek = firstDay.getDay();
        if (startDayOfWeek === 0) startDayOfWeek = 7;

        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - (startDayOfWeek - 1));

        container.innerHTML = '';

        const headerDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        headerDays.forEach(day => {
            const headerCell = document.createElement('div');
            headerCell.className = 'calendar-header-cell';
            headerCell.textContent = day;
            container.appendChild(headerCell);
        });

        const currentDate = new Date(startDate);
        for (let i = 0; i < 42; i++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';

            if (currentDate.getMonth() !== month) {
                dayElement.classList.add('other-month');
            }

            const today = new Date();
            if (currentDate.toDateString() === today.toDateString()) {
                dayElement.classList.add('today');
            }

            const dayTrades = this.trades.filter(trade => {
                const tradeDate = new Date(trade.entryTime || trade.date || Date.now());
                return tradeDate.toDateString() === currentDate.toDateString();
            });

            const totalPnL = dayTrades.reduce((sum, trade) => sum + this.calculatePnL(trade), 0);
            if (dayTrades.length > 0) {
                if (totalPnL > 0) {
                    dayElement.classList.add('profitable');
                } else if (totalPnL < 0) {
                    dayElement.classList.add('losing');
                }
            }

            dayElement.textContent = currentDate.getDate();

            const dateStr = currentDate.getFullYear() + '-' + 
                String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
                String(currentDate.getDate()).padStart(2, '0');
            dayElement.dataset.date = dateStr;

            dayElement.addEventListener('click', () => {
                const fromInput = document.getElementById('filter-date-from');
                const toInput = document.getElementById('filter-date-to');
                if (fromInput) fromInput.value = dateStr;
                if (toInput) toInput.value = dateStr;
                this.filters.dateFrom = dateStr;
                this.filters.dateTo = dateStr;
                this.filters.symbol = '';
                this.filters.strategy = '';
                this.filters.direction = '';
                this.filters.emotionalState = '';
                this.filters.tags = '';
                this.filters.pnlMin = '';
                this.filters.pnlMax = '';
                this.showSection('all-trades');
                this.renderTradesTable();
                this.showNotification(`Showing trades from ${dateStr}`, 'success');
            });

            dayElement.addEventListener('mouseenter', (e) => {
                this.showCalendarTooltip(e, currentDate, dayTrades, totalPnL);
            });

            dayElement.addEventListener('mouseleave', () => {
                this.hideDayTooltip();
            });

            container.appendChild(dayElement);

            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    renderStrategyTable() {
        const tbody = document.getElementById('strategy-table-body');
        if (!tbody) return;

        const strategyMetrics = this.calculateStrategyMetrics();

        if (strategyMetrics.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 1rem;">No strategy data yet</td></tr>';
            return;
        }

        tbody.innerHTML = strategyMetrics.map(s => `
            <tr>
                <td>${s.name}</td>
                <td>${s.winRate.toFixed(1)}%</td>
                <td class="${s.totalPnL >= 0 ? 'profit' : 'loss'}">${this.formatCurrency(s.totalPnL, true)}</td>
                <td>${s.tradeCount}</td>
                <td>1:${s.avgRR.toFixed(2)}</td>
                <td class="profit">${this.formatCurrency(s.bestTrade, true)}</td>
                <td class="loss">${this.formatCurrency(s.worstTrade, true)}</td>
            </tr>
        `).join('');
    }

    calculateStrategyMetrics() {
        const metrics = [];

        this.strategies.forEach(strategy => {
            const strategyTrades = this.trades.filter(t => t.strategy === strategy);
            if (strategyTrades.length === 0) return;

            const winningTrades = strategyTrades.filter(t => this.calculatePnL(t) > 0);
            const winRate = (winningTrades.length / strategyTrades.length) * 100;
            const totalPnL = strategyTrades.reduce((sum, t) => sum + this.calculatePnL(t), 0);

            const rrRatios = strategyTrades.map(t => this.calculateRRRatio(t)).filter(rr => rr > 0);
            const avgRR = rrRatios.length > 0 ? rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length : 0;

            const pnls = strategyTrades.map(t => this.calculatePnL(t));
            const bestTrade = Math.max(...pnls);
            const worstTrade = Math.min(...pnls);

            metrics.push({
                name: strategy,
                winRate: winRate,
                totalPnL: totalPnL,
                tradeCount: strategyTrades.length,
                avgRR: avgRR,
                bestTrade: bestTrade,
                worstTrade: worstTrade
            });
        });

        return metrics.sort((a, b) => b.totalPnL - a.totalPnL);
    }

    renderDayAnalysis() {
        const container = document.getElementById('day-analysis-grid');
        if (!container) return;

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        container.innerHTML = '';

        days.forEach(day => {
            const dayTrades = this.getTradesForDay(day);
            const totalPnL = dayTrades.reduce((sum, t) => sum + this.calculatePnL(t), 0);
            const pnlClass = totalPnL > 0 ? 'profit' : totalPnL < 0 ? 'loss' : '';

            const item = document.createElement('div');
            item.className = 'day-analysis-item';
            item.innerHTML = `
                <div class="day-name">${day}</div>
                <div class="day-pnl ${pnlClass}">${this.formatCurrency(totalPnL, true)}</div>
                <div class="day-count">${dayTrades.length} trades</div>
            `;
            container.appendChild(item);
        });
    }

    renderMistakeCounter() {
        const container = document.getElementById('mistake-counter-list');
        if (!container) return;

        const mistakeCounts = {};

        this.trades.forEach(trade => {
            if (trade.psychology?.mistakes) {
                trade.psychology.mistakes.forEach(mistake => {
                    mistakeCounts[mistake] = (mistakeCounts[mistake] || 0) + 1;
                });
            }
        });

        const sortedMistakes = Object.entries(mistakeCounts)
            .sort((a, b) => b[1] - a[1]);

        if (sortedMistakes.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-secondary);">No mistakes recorded yet</div>';
            return;
        }

        container.innerHTML = sortedMistakes.map(([mistake, count]) => `
            <div class="mistake-item">
                <span class="mistake-name">${mistake.replace(/-/g, ' ')}</span>
                <span class="mistake-count">${count}</span>
            </div>
        `).join('');
    }

    renderEmotionPieChart() {
        const canvas = document.getElementById('emotion-pie-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const emotionCounts = {};
        this.trades.forEach(trade => {
            if (trade.psychology?.emotionalState) {
                emotionCounts[trade.psychology.emotionalState] = (emotionCounts[trade.psychology.emotionalState] || 0) + 1;
            }
        });

        const labels = Object.keys(emotionCounts);
        const data = Object.values(emotionCounts);

        if (labels.length === 0) {
            canvas.parentElement.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Add emotional state to trades to see distribution</div>';
            return;
        }

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

        if (this.charts.emotion) {
            this.charts.emotion.destroy();
        }

        this.charts.emotion = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });

        const legendContainer = document.getElementById('emotion-legend');
        if (legendContainer) {
            legendContainer.innerHTML = labels.map((label, i) => `
                <div class="emotion-legend-item">
                    <span class="color-dot" style="background: ${colors[i]}"></span>
                    <span>${label.charAt(0).toUpperCase() + label.slice(1)} (${emotionCounts[label]})</span>
                </div>
            `).join('');
        }
    }

    renderTimeAnalysis() {
        const container = document.getElementById('time-analysis-grid');
        if (!container) return;

        const timeSlots = {
            'Morning': { start: 6, end: 12 },
            'Afternoon': { start: 12, end: 17 },
            'Evening': { start: 17, end: 24 }
        };

        let html = '';
        Object.keys(timeSlots).forEach(slot => {
            const slotTrades = this.trades.filter(t => {
                const hour = new Date(t.entryTime || t.date).getHours();
                return hour >= timeSlots[slot].start && hour < timeSlots[slot].end;
            });
            const pnl = slotTrades.reduce((sum, tr) => sum + this.calculatePnL(tr), 0);
            const pnlClass = pnl >= 0 ? 'profit' : pnl < 0 ? 'loss' : '';

            html += `
                <div class="time-analysis-item">
                    <div class="time-label">${slot}</div>
                    <div class="time-pnl ${pnlClass}">${this.formatCurrency(pnl, true)}</div>
                    <div class="time-count">${slotTrades.length} trades</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderHoldingTimeAnalysis() {
        const container = document.getElementById('holding-time-stats');
        if (!container) return;

        const holdingTimes = this.trades.map(t => {
            const entry = new Date(t.entryTime || t.date);
            const exit = new Date(t.exitTime || t.date);
            return (exit - entry) / (1000 * 60 * 60);
        }).filter(t => t > 0);

        if (holdingTimes.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-secondary);">No holding time data</div>';
            return;
        }

        const avgHours = holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length;
        const minHours = Math.min(...holdingTimes);
        const maxHours = Math.max(...holdingTimes);

        container.innerHTML = `
            <div class="holding-stat">
                <div class="stat-label">Avg Holding Time</div>
                <div class="stat-value">${avgHours.toFixed(1)} hrs</div>
            </div>
            <div class="holding-stat">
                <div class="stat-label">Quickest Trade</div>
                <div class="stat-value">${minHours.toFixed(1)} hrs</div>
            </div>
        `;

        const canvas = document.getElementById('holding-time-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const quick = holdingTimes.filter(h => h < 1).length;
            const medium = holdingTimes.filter(h => h >= 1 && h < 24).length;
            const long = holdingTimes.filter(h => h >= 24).length;

            if (this.charts.holding) {
                this.charts.holding.destroy();
            }

            this.charts.holding = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['< 1hr', '1-24hrs', '> 24hrs'],
                    datasets: [{
                        data: [quick, medium, long],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, ticks: { stepSize: 1 } }
                    }
                }
            });
        }
    }

    renderConfidenceAnalysis() {
        const container = document.getElementById('confidence-stats');
        if (!container) return;

        const confidenceLevels = {
            'High': this.trades.filter(t => t.psychology?.entryConfidence >= 7).map(tr => this.calculatePnL(tr)),
            'Medium': this.trades.filter(t => t.psychology?.entryConfidence >= 4 && t.psychology?.entryConfidence < 7).map(tr => this.calculatePnL(tr)),
            'Low': this.trades.filter(t => t.psychology?.entryConfidence < 4).map(tr => this.calculatePnL(tr))
        };

        const highPnl = confidenceLevels['High'].reduce((a, b) => a + b, 0);
        const medPnl = confidenceLevels['Medium'].reduce((a, b) => a + b, 0);
        const lowPnl = confidenceLevels['Low'].reduce((a, b) => a + b, 0);
        const highCount = confidenceLevels['High'].length;
        const medCount = confidenceLevels['Medium'].length;
        const lowCount = confidenceLevels['Low'].length;

        if (highCount + medCount + lowCount === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-secondary); grid-column: 1/-1;">No confidence data. Add confidence ratings to trades.</div>';
            return;
        }

        container.innerHTML = `
            <div class="confidence-stat">
                <div class="stat-label">High (7-10)</div>
                <div class="stat-value" style="color: ${highPnl >= 0 ? 'var(--success)' : 'var(--danger)'}">${this.formatCurrency(highPnl, true)} <small>(${highCount})</small></div>
            </div>
            <div class="confidence-stat">
                <div class="stat-label">Medium (4-6)</div>
                <div class="stat-value" style="color: ${medPnl >= 0 ? 'var(--success)' : 'var(--danger)'}">${this.formatCurrency(medPnl, true)} <small>(${medCount})</small></div>
            </div>
            <div class="confidence-stat">
                <div class="stat-label">Low (1-3)</div>
                <div class="stat-value" style="color: ${lowPnl >= 0 ? 'var(--success)' : 'var(--danger)'}">${this.formatCurrency(lowPnl, true)} <small>(${lowCount})</small></div>
            </div>
        `;

        const canvas = document.getElementById('confidence-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');

            if (this.charts.confidence) {
                this.charts.confidence.destroy();
            }

            this.charts.confidence = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['High (7-10)', 'Medium (4-6)', 'Low (1-3)'],
                    datasets: [{
                        data: [highPnl, medPnl, lowPnl],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false } },
                        y: {beginAtZero: true }
                    }
                }
            });
        }
    }

    showCalendarTooltip(event, date, dayTrades, totalPnL) {
        this.hideDayTooltip();
        const tooltip = document.createElement('div');
        tooltip.id = 'day-tooltip';

        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        let tradeListHTML = dayTrades.length > 0
            ? dayTrades.map(t => `
                <div class="tooltip-trade">
                    <span>${t.symbol}</span>
                    <span class="${this.calculatePnL(t) >= 0 ? 'profit' : 'loss'}">${this.formatCurrency(this.calculatePnL(t))}</span>
                </div>`).join('')
            : '<p>No trades on this day.</p>';

        tooltip.innerHTML = `
            <h3>${dateStr}</h3>
            <p><strong>P&L:</strong> <span class="${totalPnL >= 0 ? 'profit' : 'loss'}">${this.formatCurrency(totalPnL, true)}</span></p>
            <p><strong>Trades:</strong> ${dayTrades.length}</p>
            ${tradeListHTML}
        `;
        document.body.appendChild(tooltip);

        const rect = event.currentTarget.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    }

    setupCharts() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            this.showNotification('Chart library not loaded. Refresh the page.', 'error');
            return;
        }

        try {
            this.destroyAllCharts();
            this.setupPnLChart();
            this.setupWeeklyChart();
        } catch (error) {
            console.error('Error setting up charts:', error);
            this.showNotification('Error loading charts', 'warning');
        }
    }

    destroyAllCharts() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key] && typeof this.charts[key].destroy === 'function') {
                this.charts[key].destroy();
            }
        });
        this.charts = {};
    }

    handleWindowResize() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            if (this.charts.pnl && typeof this.charts.pnl.resize === 'function') {
                this.charts.pnl.resize();
            }
            if (this.charts.weekly && typeof this.charts.weekly.resize === 'function') {
                this.charts.weekly.resize();
            }
        }, 250);
    }

    setupPnLChart() {
        const canvas = document.getElementById('pnl-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        this.charts.pnl = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Cumulative P&L',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: isDark ? '#f1f5f9' : '#1e293b' } }
                },
                scales: {
                    x: {
                        ticks: { color: isDark ? '#cbd5e1' : '#64748b' },
                        grid: { color: isDark ? '#334155' : '#e2e8f0' }
                    },
                    y: {
                        ticks: {
                            color: isDark ? '#cbd5e1' : '#64748b',
                            callback: value => '₹' + value.toFixed(2)
                        },
                        grid: { color: isDark ? '#334155' : '#e2e8f0' }
                    }
                }
            }
        });

        this.updatePnLChart();
    }

    setupWeeklyChart() {
        const canvas = document.getElementById('weekly-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        this.charts.weekly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Daily P&L',
                    data: [],
                    backgroundColor: [],
                    borderColor: [],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { color: isDark ? '#cbd5e1' : '#64748b' },
                        grid: { color: isDark ? '#334155' : '#e2e8f0' }
                    },
                    y: {
                        ticks: {
                            color: isDark ? '#cbd5e1' : '#64748b',
                            callback: value => '₹' + value.toFixed(2)
                        },
                        grid: { color: isDark ? '#334155' : '#e2e8f0' }
                    }
                }
            }
        });

        this.updateWeeklyChart();
    }

    updatePnLChart() {
        if (!this.charts.pnl) return;

        const filteredTrades = this.getFilteredTrades().sort((a, b) =>
            new Date(a.entryTime || a.date) - new Date(b.entryTime || b.date)
        );

        const labels = [];
        const data = [];
        let cumulativePnL = 0;

        filteredTrades.forEach((trade, index) => {
            labels.push(`Trade ${index + 1}`);
            cumulativePnL += this.calculatePnL(trade);
            data.push(cumulativePnL);
        });

        this.charts.pnl.data.labels = labels;
        this.charts.pnl.data.datasets[0].data = data;
        this.charts.pnl.update();
    }

    updateWeeklyChart() {
        if (!this.charts.weekly) return;

        const last7Days = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            last7Days.push(date);
        }

        const labels = last7Days.map(date =>
            date.toLocaleDateString('en-US', { weekday: 'short' })
        );

        const data = last7Days.map(date => {
            const dayTrades = this.trades.filter(trade => {
                const tradeDate = new Date(trade.entryTime || trade.date || Date.now());
                return tradeDate.toDateString() === date.toDateString();
            });
            return dayTrades.reduce((sum, trade) => sum + this.calculatePnL(trade), 0);
        });

        const backgroundColors = data.map(value =>
            value > 0 ? '#10b981' : value < 0 ? '#ef4444' : '#6b7280'
        );

        this.charts.weekly.data.labels = labels;
        this.charts.weekly.data.datasets[0].data = data;
        this.charts.weekly.data.datasets[0].backgroundColor = backgroundColors;
        this.charts.weekly.data.datasets[0].borderColor = backgroundColors;
        this.charts.weekly.update();
    }

    updateAllCharts() {
        if (this.charts.pnl && typeof this.charts.pnl.update === 'function') {
            this.updatePnLChart();
        }
        if (this.charts.weekly && typeof this.charts.weekly.update === 'function') {
            this.updateWeeklyChart();
        }
    }

    renderAddTradeForm() {
        this.populateStrategies();
        this.populateTags();
        this.populateEmotionalStates();
        document.getElementById('default-risk').value = this.settings.defaultRisk;

        const now = new Date();
        const localISOTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('entry-time').value = localISOTime;
    }

    populateStrategies() {
        const select = document.getElementById('strategy');
        select.innerHTML = '<option value="">Select Strategy</option>';
        this.strategies.forEach(strategy => {
            const option = document.createElement('option');
            option.value = strategy;
            option.textContent = strategy;
            select.appendChild(option);
        });
    }

    populateTags() {
        const container = document.getElementById('tags-container');
        container.innerHTML = '';
        this.tags.forEach(tag => {
            const tagElement = document.createElement('label');
            tagElement.className = 'tag-checkbox';
            tagElement.innerHTML = `
                <input type="checkbox" name="tags" value="${tag}">
                <span>${tag}</span>
            `;
            container.appendChild(tagElement);
        });
    }

    populateEmotionalStates() {
        const select = document.getElementById('emotional-state');
        select.innerHTML = '<option value="">Select State</option>';
        this.emotionalStates.forEach(state => {
            const option = document.createElement('option');
            option.value = state.toLowerCase();
            option.textContent = state;
            select.appendChild(option);
        });
    }

    async addTrade() {
        const form = document.getElementById('trade-form');

        const entryPriceEl = document.getElementById('entry-price');
        const exitPriceEl = document.getElementById('exit-price');
        const quantityEl = document.getElementById('quantity');
        const stopLossEl = document.getElementById('stop-loss');
        const takeProfitEl = document.getElementById('take-profit');
        const entryTimeEl = document.getElementById('entry-time');
        const exitTimeEl = document.getElementById('exit-time');

        const entryPrice = parseFloat(entryPriceEl?.value);
        const exitPrice = parseFloat(exitPriceEl?.value);
        const quantity = parseInt(quantityEl?.value);
        const stopLoss = stopLossEl?.value ? parseFloat(stopLossEl.value) : null;
        const takeProfit = takeProfitEl?.value ? parseFloat(takeProfitEl.value) : null;
        const entryTime = entryTimeEl?.value;
        const exitTime = exitTimeEl?.value;

        const directionEl = document.querySelector('input[name="direction"]:checked');
        if (!directionEl) {
            this.showNotification('Please select Buy or Sell', 'warning');
            return;
        }

        this.clearValidationErrors();

        let hasErrors = false;

        if (!entryPriceEl?.value || isNaN(entryPrice) || entryPrice <= 0) {
            this.showFieldError('entry-price', 'Entry price must be greater than 0');
            hasErrors = true;
        }
        if (!exitPriceEl?.value || isNaN(exitPrice) || exitPrice <= 0) {
            this.showFieldError('exit-price', 'Exit price must be greater than 0');
            hasErrors = true;
        }
        if (!quantityEl?.value || isNaN(quantity) || quantity < 1) {
            this.showFieldError('quantity', 'Quantity must be at least 1');
            hasErrors = true;
        }
        if (stopLossEl?.value && (isNaN(stopLoss) || stopLoss <= 0)) {
            this.showFieldError('stop-loss', 'Stop loss must be greater than 0');
            hasErrors = true;
        }
        if (takeProfitEl?.value && (isNaN(takeProfit) || takeProfit <= 0)) {
            this.showFieldError('take-profit', 'Take profit must be greater than 0');
            hasErrors = true;
        }
        if (entryTime && exitTime && new Date(exitTime) <= new Date(entryTime)) {
            this.showFieldError('exit-time', 'Exit time must be after entry time');
            hasErrors = true;
        }

        if (hasErrors) return;

        const formData = new FormData(form);
        const selectedTags = Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(input => input.value);
        const selectedMistakes = Array.from(document.querySelectorAll('input[name="mistakes"]:checked')).map(input => input.value);

        const trade = {
            id: `trade_${Date.now()}`,
            symbol: formData.get('symbol').toUpperCase(),
            quantity: quantity,
            direction: directionEl.value,
            entryPrice: entryPrice,
            exitPrice: exitPrice,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            strategy: formData.get('strategy'),
            entryTime: entryTime || new Date().toISOString(),
            exitTime: exitTime || new Date().toISOString(),
            tags: selectedTags,
            psychology: {
                entryConfidence: parseInt(formData.get('entryConfidence')),
                satisfaction: parseInt(formData.get('satisfaction')),
                emotionalState: formData.get('emotionalState'),
                mistakes: selectedMistakes,
                lessons: formData.get('lessons')
            },
            date: new Date().toISOString()
        };

        this.trades.push(trade);
        await this.syncTradeToFirebase(trade, true);

        this.showNotification('Trade added successfully!', 'success');
        form.reset();
        document.getElementById('confidence-value').textContent = '5';
        document.getElementById('satisfaction-value').textContent = '5';
        this.renderAddTradeForm();

        if (this.currentSection === 'dashboard') this.renderDashboard();
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        const error = document.createElement('div');
        error.className = 'field-error';
        error.style.color = 'var(--danger)';
        error.style.fontSize = '0.75rem';
        error.style.marginTop = '0.25rem';
        error.textContent = message;
        field.parentElement.appendChild(error);
        field.style.borderColor = 'var(--danger)';
    }

    clearValidationErrors() {
        document.querySelectorAll('.field-error').forEach(el => el.remove());
        document.querySelectorAll('input, select, textarea').forEach(el => el.style.borderColor = '');
    }

    renderAllTrades() {
        this.populateFilterDropdowns();
        this.renderTradesTable();
    }

    populateFilterDropdowns() {
        const strategyFilter = document.getElementById('filter-strategy');
        strategyFilter.innerHTML = '<option value="">All Strategies</option>';
        this.strategies.forEach(strategy => {
            strategyFilter.innerHTML += `<option value="${strategy}">${strategy}</option>`;
        });

        const emotionFilter = document.getElementById('filter-emotional-state');
        emotionFilter.innerHTML = '<option value="">All States</option>';
        this.emotionalStates.forEach(state => {
            emotionFilter.innerHTML += `<option value="${state.toLowerCase()}">${state}</option>`;
        });

        const tagsFilter = document.getElementById('filter-tags');
        tagsFilter.innerHTML = '<option value="">All Tags</option>';
        this.tags.forEach(tag => {
            tagsFilter.innerHTML += `<option value="${tag}">${tag}</option>`;
        });
    }

    renderTradesTable() {
        const tbody = document.getElementById('trades-tbody');
        const filteredTrades = this.getFilteredTrades();
        const mobileContainer = document.getElementById('mobile-trades-container');

        if (filteredTrades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 2rem;">No trades found</td></tr>';
            if (mobileContainer) mobileContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">No trades found</div>';
            return;
        }

        tbody.innerHTML = '';
        let mobileHTML = '';

        filteredTrades.forEach(trade => {
            const row = tbody.insertRow();
            const pnl = this.calculatePnL(trade);
            const rrRatio = this.calculateRRRatio(trade);
            row.className = pnl >= 0 ? 'profit' : 'loss';

            row.innerHTML = `
                <td>${trade.symbol}</td>
                <td>${new Date(trade.entryTime || trade.date).toLocaleDateString()}</td>
                <td><span class="badge ${trade.direction}">${trade.direction.toUpperCase()}</span></td>
                <td>${trade.quantity}</td>
                <td>₹${trade.entryPrice.toFixed(2)}</td>
                <td>₹${trade.exitPrice.toFixed(2)}</td>
                <td class="${pnl >= 0 ? 'profit' : 'loss'}">${this.formatCurrency(pnl)}</td>
                <td>1:${rrRatio.toFixed(2)}</td>
                <td>${trade.strategy || '-'}</td>
                <td><span class="badge emotion-badge ${trade.psychology?.emotionalState || 'none'}">${trade.psychology?.emotionalState || '-'}</span></td>
                <td class="table-actions">
                    <button class="btn btn-secondary edit-btn" data-trade-id="${trade.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger delete-btn" data-trade-id="${trade.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;

            mobileHTML += `
                <div class="mobile-trade-card" data-trade-id="${trade.id}">
                    <div class="mobile-trade-header">
                        <span class="mobile-trade-symbol">${trade.symbol}</span>
                        <span class="mobile-trade-direction ${trade.direction}">${trade.direction.toUpperCase()}</span>
                    </div>
                    <div class="mobile-trade-details">
                        <div class="mobile-trade-detail">
                            <span class="mobile-trade-label">Date</span>
                            <span class="mobile-trade-value">${new Date(trade.entryTime || trade.date).toLocaleDateString()}</span>
                        </div>
                        <div class="mobile-trade-detail">
                            <span class="mobile-trade-label">Qty</span>
                            <span class="mobile-trade-value">${trade.quantity}</span>
                        </div>
                        <div class="mobile-trade-detail">
                            <span class="mobile-trade-label">Entry</span>
                            <span class="mobile-trade-value">₹${trade.entryPrice.toFixed(2)}</span>
                        </div>
                        <div class="mobile-trade-detail">
                            <span class="mobile-trade-label">Exit</span>
                            <span class="mobile-trade-value">₹${trade.exitPrice.toFixed(2)}</span>
                        </div>
                        <div class="mobile-trade-detail">
                            <span class="mobile-trade-label">R:R</span>
                            <span class="mobile-trade-value">1:${rrRatio.toFixed(2)}</span>
                        </div>
                        <div class="mobile-trade-detail">
                            <span class="mobile-trade-label">Strategy</span>
                            <span class="mobile-trade-value">${trade.strategy || '-'}</span>
                        </div>
                    </div>
                    <div class="mobile-trade-pnl ${pnl >= 0 ? 'profit' : 'loss'}">${this.formatCurrency(pnl, true)}</div>
                    <div class="mobile-trade-actions">
                        <button class="btn btn-secondary edit-btn" data-trade-id="${trade.id}"><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn btn-danger delete-btn" data-trade-id="${trade.id}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;

            tbody.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tradeId = e.currentTarget.dataset.tradeId;
                    this.editTrade(tradeId);
                });
            });

            tbody.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tradeId = e.currentTarget.dataset.tradeId;
                    this.deleteTrade(tradeId);
                });
            });
        });

        if (mobileContainer) {
            mobileContainer.innerHTML = mobileHTML;
            mobileContainer.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tradeId = e.currentTarget.dataset.tradeId;
                    this.editTrade(tradeId);
                });
            });
            mobileContainer.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tradeId = e.currentTarget.dataset.tradeId;
                    this.deleteTrade(tradeId);
                });
            });
        }
    }

    applyTradeFilters() {
        this.filters = {
            symbol: document.getElementById('filter-symbol').value.toUpperCase(),
            strategy: document.getElementById('filter-strategy').value,
            direction: document.getElementById('filter-direction').value,
            emotionalState: document.getElementById('filter-emotional-state').value,
            tags: document.getElementById('filter-tags').value,
            dateFrom: document.getElementById('filter-date-from').value,
            dateTo: document.getElementById('filter-date-to').value,
            pnlMin: document.getElementById('filter-pnl-min').value,
            pnlMax: document.getElementById('filter-pnl-max').value
        };
        this.renderTradesTable();
    }

    clearTradeFilters() {
        document.getElementById('filter-symbol').value = '';
        document.getElementById('filter-strategy').value = '';
        document.getElementById('filter-direction').value = '';
        document.getElementById('filter-emotional-state').value = '';
        document.getElementById('filter-tags').value = '';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        document.getElementById('filter-pnl-min').value = '';
        document.getElementById('filter-pnl-max').value = '';
        this.filters = {};
        this.renderTradesTable();
    }

    sortTrades(key) {
        if (this.sortConfig.key === key) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.key = key;
            this.sortConfig.direction = 'asc';
        }
        this.renderTradesTable();
    }

    editTrade(id) {
        const trade = this.trades.find(t => t.id === id);
        if (!trade) return;
        this.openEditModal(trade);
    }

    async deleteTrade(id) {
        if (confirm('Are you sure you want to delete this trade?')) {
            await this.deleteTradeFromFirebase(id);
            this.renderTradesTable();
            this.showNotification('Trade deleted successfully!', 'success');
            if (this.currentSection === 'dashboard') this.renderDashboard();
        }
    }

    openEditModal(trade) {
        const modal = document.getElementById('edit-modal');
        const form = document.getElementById('edit-trade-form');

        const stopLossVal = trade.stopLoss ?? '';
        const takeProfitVal = trade.takeProfit ?? '';
        const entryTimeVal = trade.entryTime ? new Date(trade.entryTime).toISOString().slice(0, 16) : '';
        const exitTimeVal = trade.exitTime ? new Date(trade.exitTime).toISOString().slice(0, 16) : '';

        const tagsHTML = this.tags.map(tag => `
            <label class="tag-checkbox ${trade.tags?.includes(tag) ? 'selected' : ''}">
                <input type="checkbox" name="edit-tags" value="${tag}" ${trade.tags?.includes(tag) ? 'checked' : ''}>
                <span>${tag}</span>
            </label>
        `).join('');

        const mistakesHTML = this.mistakes.map(m => `
            <label class="checkbox-label">
                <input type="checkbox" name="edit-mistakes" value="${m}" ${trade.psychology?.mistakes?.includes(m) ? 'checked' : ''}>
                <span>${m.replace(/-/g, ' ')}</span>
            </label>
        `).join('');

        form.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label for="edit-symbol">Trade Symbol</label>
                    <input type="text" id="edit-symbol" value="${trade.symbol}" required>
                </div>
                <div class="form-group">
                    <label for="edit-quantity">Quantity</label>
                    <input type="number" id="edit-quantity" value="${trade.quantity}" required min="1" step="1">
                </div>
                <div class="form-group">
                    <label>Direction</label>
                    <div class="radio-group">
                        <label class="radio-label">
                            <input type="radio" name="edit-direction" value="buy" ${trade.direction === 'buy' ? 'checked' : ''}> <span>Buy</span>
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="edit-direction" value="sell" ${trade.direction === 'sell' ? 'checked' : ''}> <span>Sell</span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label for="edit-entry-price">Entry Price</label>
                    <input type="number" id="edit-entry-price" value="${trade.entryPrice}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="edit-exit-price">Exit Price</label>
                    <input type="number" id="edit-exit-price" value="${trade.exitPrice}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="edit-stop-loss">Stop Loss</label>
                    <input type="number" id="edit-stop-loss" value="${stopLossVal}" step="0.01">
                </div>
                <div class="form-group">
                    <label for="edit-take-profit">Take Profit</label>
                    <input type="number" id="edit-take-profit" value="${takeProfitVal}" step="0.01">
                </div>
                <div class="form-group">
                    <label for="edit-strategy">Strategy</label>
                    <select id="edit-strategy">
                        <option value="">Select Strategy</option>
                        ${this.strategies.map(s => `<option value="${s}" ${trade.strategy === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="edit-entry-time">Entry Time</label>
                    <input type="datetime-local" id="edit-entry-time" value="${entryTimeVal}">
                </div>
                <div class="form-group">
                    <label for="edit-exit-time">Exit Time</label>
                    <input type="datetime-local" id="edit-exit-time" value="${exitTimeVal}">
                </div>
                <div class="form-group full-width">
                    <label>Tags</label>
                    <div class="tags-container">${tagsHTML}</div>
                </div>
            </div>
            <div class="psychology-section">
                <h3>Psychology Tracking</h3>
                <div class="psychology-grid">
                    <div class="slider-group">
                        <label for="edit-entry-confidence">Entry Confidence: <span id="edit-confidence-value">${trade.psychology?.entryConfidence || 5}</span></label>
                        <input type="range" id="edit-entry-confidence" name="editEntryConfidence" min="1" max="10" value="${trade.psychology?.entryConfidence || 5}" class="slider">
                    </div>
                    <div class="slider-group">
                        <label for="edit-satisfaction">Satisfaction Level: <span id="edit-satisfaction-value">${trade.psychology?.satisfaction || 5}</span></label>
                        <input type="range" id="edit-satisfaction" name="editSatisfaction" min="1" max="10" value="${trade.psychology?.satisfaction || 5}" class="slider">
                    </div>
                    <div class="form-group">
                        <label for="edit-emotional-state">Emotional State</label>
                        <select id="edit-emotional-state">
                            <option value="">Select State</option>
                            ${this.emotionalStates.map(s => `<option value="${s.toLowerCase()}" ${trade.psychology?.emotionalState === s.toLowerCase() ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div class="mistakes-section">
                        <label>Mistakes Made</label>
                        <div class="checkbox-grid">${mistakesHTML}</div>
                    </div>
                    <div class="form-group full-width">
                        <label for="edit-lessons">Lessons Learned</label>
                        <textarea id="edit-lessons" rows="3" placeholder="What did you learn from this trade?">${trade.psychology?.lessons || ''}</textarea>
                    </div>
                </div>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Update Trade</button>
            </div>
        `;

        document.getElementById('edit-entry-confidence').addEventListener('input', (e) => {
            document.getElementById('edit-confidence-value').textContent = e.target.value;
        });
        document.getElementById('edit-satisfaction').addEventListener('input', (e) => {
            document.getElementById('edit-satisfaction-value').textContent = e.target.value;
        });

        form.onsubmit = (e) => {
            e.preventDefault();
            this.updateTrade(trade.id);
        };

        modal.classList.add('active');
    }

    async updateTrade(id) {
        const trade = this.trades.find(t => t.id === id);
        if (!trade) return;

        const directionEl = document.querySelector('input[name="edit-direction"]:checked');
        if (!directionEl) {
            this.showNotification('Please select Buy or Sell', 'warning');
            return;
        }

        const entryPrice = parseFloat(document.getElementById('edit-entry-price').value);
        const exitPrice = parseFloat(document.getElementById('edit-exit-price').value);
        const quantity = parseInt(document.getElementById('edit-quantity').value);
        const stopLoss = document.getElementById('edit-stop-loss').value ? parseFloat(document.getElementById('edit-stop-loss').value) : null;
        const takeProfit = document.getElementById('edit-take-profit').value ? parseFloat(document.getElementById('edit-take-profit').value) : null;

        if (isNaN(entryPrice) || entryPrice <= 0 || isNaN(exitPrice) || exitPrice <= 0 || isNaN(quantity) || quantity < 1) {
            this.showNotification('Please enter valid values', 'error');
            return;
        }

        const selectedTags = Array.from(document.querySelectorAll('input[name="edit-tags"]:checked')).map(input => input.value);
        const selectedMistakes = Array.from(document.querySelectorAll('input[name="edit-mistakes"]:checked')).map(input => input.value);

        trade.symbol = document.getElementById('edit-symbol').value.toUpperCase();
        trade.quantity = quantity;
        trade.direction = directionEl.value;
        trade.entryPrice = entryPrice;
        trade.exitPrice = exitPrice;
        trade.stopLoss = stopLoss;
        trade.takeProfit = takeProfit;
        trade.strategy = document.getElementById('edit-strategy').value;
        trade.entryTime = document.getElementById('edit-entry-time').value || new Date().toISOString();
        trade.exitTime = document.getElementById('edit-exit-time').value || new Date().toISOString();
        trade.tags = selectedTags;
        trade.psychology = {
            entryConfidence: parseInt(document.getElementById('edit-entry-confidence').value),
            satisfaction: parseInt(document.getElementById('edit-satisfaction').value),
            emotionalState: document.getElementById('edit-emotional-state').value,
            mistakes: selectedMistakes,
            lessons: document.getElementById('edit-lessons').value
        };

        await this.syncTradeToFirebase(trade, false);
        this.closeEditModal();
        this.renderTradesTable();
        this.showNotification('Trade updated successfully!', 'success');
        if (this.currentSection === 'dashboard') this.renderDashboard();
    }

    closeEditModal() {
        document.getElementById('edit-modal').classList.remove('active');
    }

    exportCSV() {
        if (this.trades.length === 0) {
            this.showNotification('No trades to export', 'warning');
            return;
        }

        const headers = ['Symbol', 'Date', 'Direction', 'Quantity', 'Entry Price', 'Exit Price', 'P&L', 'R:R Ratio', 'Strategy', 'Tags', 'Emotional State', 'Lessons'];
        const csvContent = [
            headers.join(','),
            ...this.trades.map(trade => [
                trade.symbol,
                new Date(trade.entryTime || trade.date).toLocaleDateString(),
                trade.direction,
                trade.quantity,
                trade.entryPrice,
                trade.exitPrice,
                this.calculatePnL(trade),
                this.calculateRRRatio(trade),
                trade.strategy || '',
                trade.tags?.join(';') || '',
                trade.psychology?.emotionalState || '',
                `"${(trade.psychology?.lessons || '').replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        this.downloadFile(csvContent, 'trades.csv', 'text/csv');
    }

    exportJSON() {
        const data = {
            trades: this.trades,
            strategies: this.strategies,
            tags: this.tags,
            notes: this.notes,
            settings: this.settings
        };
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, 'trading-journal-backup.json', 'application/json');
    }

    importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (confirm('This will replace all current data. Are you sure?')) {
                    this.trades = data.trades || [];
                    this.strategies = data.strategies || this.strategies;
                    this.tags = data.tags || this.tags;
                    this.notes = data.notes || [];
                    this.settings = { ...this.settings, ...(data.settings || {}) };
                    this.saveData();
                    this.renderAllSections();
                    this.showNotification('Data imported successfully!', 'success');
                }
            } catch (error) {
                this.showNotification('Error importing data. Check file format.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    renderNotes() {
        const notesContainer = document.getElementById('notes-container');
        notesContainer.innerHTML = '';

        if (this.notes.length === 0) {
            notesContainer.innerHTML = `
                <div class="empty-notes">
                    <i class="fas fa-sticky-note"></i>
                    <h3>No notes yet</h3>
                    <p>Click "Add Note" to create your first trading note</p>
                </div>`;
            return;
        }

        this.notes.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(note => {
            const noteElement = document.createElement('div');
            noteElement.className = 'note-item';
            noteElement.innerHTML = `
                <div class="note-header">
                    <div class="note-title-section">
                        <h3>${this.escapeHTML(note.title)}</h3>
                        <span class="note-date">${new Date(note.date).toLocaleDateString()}</span>
                    </div>
                    <div class="note-actions">
                        <button class="btn btn-secondary edit-note-btn" data-note-id="${note.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger delete-note-btn" data-note-id="${note.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="note-content">${this.escapeHTML(note.content).replace(/\n/g, '<br>')}</div>
            `;
            notesContainer.appendChild(noteElement);
        });

        notesContainer.querySelectorAll('.edit-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.editNote(parseInt(e.currentTarget.dataset.noteId)));
        });
        notesContainer.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteNote(parseInt(e.currentTarget.dataset.noteId)));
        });
    }

    addNote() {
        const noteTitle = document.getElementById('note-title').value.trim();
        const noteContent = document.getElementById('notes-editor').value.trim();

        if (!noteContent) {
            this.showNotification('Please enter note content', 'warning');
            return;
        }

        if (this.currentNoteId) {
            const note = this.notes.find(n => n.id === this.currentNoteId);
            if (note) {
                note.title = noteTitle || 'Untitled Note';
                note.content = noteContent;
                note.date = new Date().toISOString();
                this.showNotification('Note updated successfully!', 'success');
            }
        } else {
            this.notes.push({
                id: Date.now(),
                title: noteTitle || 'Untitled Note',
                content: noteContent,
                date: new Date().toISOString()
            });
            this.showNotification('Note added successfully!', 'success');
        }

        this.saveData();
        this.closeNotesModal();
        this.renderNotes();
    }

    editNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        this.currentNoteId = id;
        document.getElementById('notes-modal-title').textContent = 'Edit Note';
        document.getElementById('note-title').value = note.title;
        document.getElementById('notes-editor').value = note.content;
        document.getElementById('notes-modal').classList.add('active');
    }

    deleteNote(id) {
        if (confirm('Are you sure you want to delete this note?')) {
            this.notes = this.notes.filter(n => n.id !== id);
            this.saveData();
            this.renderNotes();
            this.showNotification('Note deleted successfully!', 'success');
        }
    }

    openNotesModal() {
        this.currentNoteId = null;
        document.getElementById('notes-modal-title').textContent = 'Add New Note';
        document.getElementById('note-title').value = '';
        document.getElementById('notes-editor').value = '';
        document.getElementById('notes-modal').classList.add('active');
    }

    closeNotesModal() {
        document.getElementById('notes-modal').classList.remove('active');
    }

    async addDemoData() {
        if (this.trades.length > 0) {
            if (!confirm('You already have data. Add demo data anyway?')) return;
        }

        const symbols = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'];
        const directions = ['buy', 'sell'];
        const strategies = this.strategies;
        const emotionalStates = this.emotionalStates.map(s => s.toLowerCase());

        for (let i = 0; i < 10; i++) {
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const entryPrice = Math.random() * 500 + 50;
            const exitPrice = entryPrice + (Math.random() - 0.4) * 50;
            const quantity = Math.floor(Math.random() * 100) + 10;
            const entryDate = new Date();
            entryDate.setDate(entryDate.getDate() - Math.floor(Math.random() * 30));
            const exitDate = new Date(entryDate);
            exitDate.setHours(exitDate.getHours() + Math.floor(Math.random() * 48));

            const trade = {
                id: `trade_${Date.now()}_${i}`,
                symbol: symbol,
                quantity: quantity,
                direction: direction,
                entryPrice: parseFloat(entryPrice.toFixed(2)),
                exitPrice: parseFloat(exitPrice.toFixed(2)),
                stopLoss: parseFloat((entryPrice - Math.random() * 10).toFixed(2)),
                takeProfit: parseFloat((entryPrice + Math.random() * 20).toFixed(2)),
                strategy: strategies[Math.floor(Math.random() * strategies.length)],
                entryTime: entryDate.toISOString(),
                exitTime: exitDate.toISOString(),
                tags: [this.tags[Math.floor(Math.random() * this.tags.length)]],
                psychology: {
                    entryConfidence: Math.floor(Math.random() * 10) + 1,
                    satisfaction: Math.floor(Math.random() * 10) + 1,
                    emotionalState: emotionalStates[Math.floor(Math.random() * emotionalStates.length)],
                    mistakes: [],
                    lessons: ''
                },
                date: entryDate.toISOString()
            };

            this.trades.push(trade);
            await FirebaseDB.saveTrade(this.currentUserId, trade);
        }

        this.notes.push({
            id: Date.now(),
            title: 'Demo Trading Note',
            content: 'This is a demo note to show how the notes feature works.\n\nYou can create notes about your trading analysis, lessons learned, or market observations.',
            date: new Date().toISOString()
        });

        this.renderAllSections();
        this.showNotification('Demo data added! Added 10 trades and 1 note.', 'success');
    }

    renderSettings() {
        this.renderStrategiesList();
        this.renderTagsList();
        document.getElementById('default-risk').value = this.settings.defaultRisk;
    }

    renderStrategiesList() {
        const container = document.getElementById('strategies-list');
        container.innerHTML = '';
        this.strategies.forEach((strategy, index) => {
            const item = document.createElement('div');
            item.className = 'strategy-item';
            item.innerHTML = `<span>${this.escapeHTML(strategy)}</span><button class="btn btn-danger" data-index="${index}"><i class="fas fa-trash"></i></button>`;
            container.appendChild(item);
        });
        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeStrategy(parseInt(e.currentTarget.dataset.index)));
        });
    }

    renderTagsList() {
        const container = document.getElementById('settings-tags-list');
        container.innerHTML = '';
        this.tags.forEach((tag, index) => {
            const item = document.createElement('div');
            item.className = 'tag-item';
            item.innerHTML = `<span>${this.escapeHTML(tag)}</span><button class="btn btn-danger" data-index="${index}"><i class="fas fa-trash"></i></button>`;
            container.appendChild(item);
        });
        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeTag(parseInt(e.currentTarget.dataset.index)));
        });
    }

    async addStrategy() {
        const input = document.getElementById('new-strategy');
        const strategy = input.value.trim();
        if (strategy && !this.strategies.includes(strategy)) {
            this.strategies.push(strategy);
            await this.syncStrategiesToFirebase();
            this.renderStrategiesList();
            input.value = '';
        }
    }

    async removeStrategy(index) {
        this.strategies.splice(index, 1);
        await this.syncStrategiesToFirebase();
        this.renderStrategiesList();
    }

    async addTag() {
        const input = document.getElementById('new-tag');
        const tag = input.value.trim();
        if (tag && !this.tags.includes(tag)) {
            this.tags.push(tag);
            await this.syncTagsToFirebase();
            this.renderTagsList();
            input.value = '';
        }
    }

    async removeTag(index) {
        this.tags.splice(index, 1);
        await this.syncTagsToFirebase();
        this.renderTagsList();
    }

    async clearAllData() {
        if (confirm('Are you SURE you want to delete ALL data? This cannot be undone!')) {
            // Delete all trades from Firebase
            const tradesResult = await FirebaseDB.getTrades(this.currentUserId);
            if (tradesResult.success) {
                for (const trade of tradesResult.trades) {
                    await FirebaseDB.deleteTrade(this.currentUserId, trade.id);
                }
            }
            
            // Reset to defaults
            this.trades = [];
            this.notes = [];
            this.strategies = ['Breakout', 'Swing', 'Scalp', 'News Trade', 'Reversal'];
            this.tags = ['High Confidence', 'Quick Trade', 'Long Hold', 'Risky', 'Safe'];
            
            // Sync strategies and tags
            await this.syncStrategiesToFirebase();
            await this.syncTagsToFirebase();
            
            this.renderAllSections();
            this.showNotification('All data cleared successfully!', 'success');
        }
    }

    calculatePnL(trade) {
        const { direction, quantity, entryPrice, exitPrice } = trade;
        if (direction === 'buy') {
            return (exitPrice - entryPrice) * quantity;
        } else {
            return (entryPrice - exitPrice) * quantity;
        }
    }

    calculateRRRatio(trade) {
        const { entryPrice, exitPrice, stopLoss } = trade;
        if (!stopLoss) return 0;
        const profit = Math.abs(exitPrice - entryPrice);
        const risk = Math.abs(entryPrice - stopLoss);
        return risk > 0 ? profit / risk : 0;
    }

    getFilteredTrades() {
        let filtered = [...this.trades];

        const fromInput = document.getElementById('date-from');
        const toInput = document.getElementById('date-to');
        if (this.currentSection === 'dashboard' && (fromInput?.value || toInput?.value)) {
            const from = fromInput?.value ? new Date(fromInput.value) : new Date('1900-01-01');
            const to = toInput?.value ? new Date(toInput.value) : new Date('2100-12-31');
            filtered = filtered.filter(t => new Date(t.entryTime || t.date) >= from && new Date(t.entryTime || t.date) <= to);
        }

        const filterFromInput = document.getElementById('filter-date-from');
        const filterToInput = document.getElementById('filter-date-to');
        if (filterFromInput?.value && filterToInput?.value) {
            const from = new Date(filterFromInput.value);
            const to = new Date(filterToInput.value);
            to.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => new Date(t.entryTime || t.date) >= from && new Date(t.entryTime || t.date) <= to);
        } else if (this.filters.dateFrom || this.filters.dateTo) {
            if (this.filters.dateFrom) filtered = filtered.filter(t => new Date(t.entryTime || t.date) >= new Date(this.filters.dateFrom));
            if (this.filters.dateTo) filtered = filtered.filter(t => new Date(t.entryTime || t.date) <= new Date(this.filters.dateTo + 'T23:59:59'));
        }

        if (this.filters.symbol) filtered = filtered.filter(t => t.symbol.includes(this.filters.symbol));
        if (this.filters.strategy) filtered = filtered.filter(t => t.strategy === this.filters.strategy);
        if (this.filters.direction) filtered = filtered.filter(t => t.direction === this.filters.direction);
        if (this.filters.emotionalState) filtered = filtered.filter(t => t.psychology?.emotionalState === this.filters.emotionalState);
        if (this.filters.tags) filtered = filtered.filter(t => t.tags?.includes(this.filters.tags));
        if (this.filters.pnlMin !== undefined && this.filters.pnlMin !== '') {
            filtered = filtered.filter(t => this.calculatePnL(t) >= parseFloat(this.filters.pnlMin));
        }
        if (this.filters.pnlMax !== undefined && this.filters.pnlMax !== '') {
            filtered = filtered.filter(t => this.calculatePnL(t) <= parseFloat(this.filters.pnlMax));
        }

        if (this.sortConfig.key) {
            filtered.sort((a, b) => {
                let aVal = a[this.sortConfig.key], bVal = b[this.sortConfig.key];
                if (this.sortConfig.key === 'pnl') {
                    aVal = this.calculatePnL(a); bVal = this.calculatePnL(b);
                } else if (this.sortConfig.key === 'rrRatio') {
                    aVal = this.calculateRRRatio(a); bVal = this.calculateRRRatio(b);
                } else if (this.sortConfig.key === 'emotionalState') {
                    aVal = a.psychology?.emotionalState || ''; bVal = b.psychology?.emotionalState || '';
                }

                if (typeof aVal === 'string') {
                    return this.sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                } else {
                    return this.sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }
            });
        }

        return filtered;
    }

    getTradesForDay(dayName) {
        const dayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dayName);
        if (dayIndex === -1) return [];

        const today = new Date();
        const currentDay = today.getDay();
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset + dayIndex);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 1);

        return this.trades.filter(trade => {
            const tradeDate = new Date(trade.entryTime || trade.date);
            return tradeDate >= monday && tradeDate < sunday;
        });
    }

    calculateAverageRR(trades) {
        if (trades.length === 0) return 0;
        const rrRatios = trades.map(t => this.calculateRRRatio(t)).filter(rr => rr > 0);
        return rrRatios.length > 0 ? rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length : 0;
    }

    formatCurrency(amount, includeSymbol = false) {
        const sign = amount >= 0 ? '+' : '-';
        const symbol = includeSymbol ? 'Rs. ' : '';
        return `${sign} ${symbol}${Math.abs(amount).toFixed(2)}`;
    }

    applyDateFilter() {
        this.updateMetrics();
        this.updateAllCharts();
    }

    renderAllSections() {
        this.showSection(this.currentSection);
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const iconMap = {
            success: 'fa-check-circle', error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle', info: 'fa-info-circle'
        };

        notification.innerHTML = `<i class="fas ${iconMap[type]}"></i><span>${message}</span>`;
        container.appendChild(notification);

        setTimeout(() => notification.remove(), 5000);
    }

    showDayTooltip(event, day, dayTrades, totalPnL, avgRR, profitability) {
        this.hideDayTooltip();
        const tooltip = document.createElement('div');
        tooltip.id = 'day-tooltip';

        let tradeListHTML = dayTrades.length > 0
            ? `<h4>Trades:</h4>` + dayTrades.map(t => `
                <div class="tooltip-trade">
                    <span>${t.symbol}</span>
                    <span class="${this.calculatePnL(t) >= 0 ? 'profit' : 'loss'}">${this.formatCurrency(this.calculatePnL(t))}</span>
                </div>`).join('')
            : '<p>No trades on this day.</p>';

        tooltip.innerHTML = `
            <h3>${day}</h3>
            <p><strong>P&L:</strong> <span class="${totalPnL >= 0 ? 'profit' : 'loss'}">${this.formatCurrency(totalPnL, true)}</span></p>
            <p><strong>Trades:</strong> ${dayTrades.length}</p>
            <p><strong>Win Rate:</strong> ${profitability.toFixed(0)}%</p>
            ${tradeListHTML}
        `;
        document.body.appendChild(tooltip);

        const rect = event.currentTarget.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    }

    hideDayTooltip() {
        const tooltip = document.getElementById('day-tooltip');
        if (tooltip) tooltip.remove();
    }

    escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new TradingJournal();
    app.init();
});