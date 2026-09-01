let financeChart;

// STATE UNTUK HIDE/SHOW BALANCE
let isBalanceHidden = localStorage.getItem('hideBalance') === 'true';

// Variabel Memori
let currentFormattedBalance = "Rp 0";
let currentFormattedIncome = "Rp 0";
let currentFormattedExpense = "Rp 0";
let isBalanceMinus = false;

// Global Data untuk Render Ulang saat Hide/Show Ditekan
let globalWallets = [];
let globalActiveBalance = 0;
let globalExpenseByCategory = {};

// State Periode (Bulan Ini / Semua Data)
let currentPeriod = 'month';

function setPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });
  loadSummary();
  loadRecentTransactions();
}

async function loadSummary() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  let query = supabaseClient
    .from('transactions')
    .select('amount, type, categories(name)')
    .eq('user_id', user.id);

  if (currentPeriod === 'month') {
    query = query.gte('transaction_date', getFirstDayOfMonth());
  }

  const { data: transactions } = await query;

  let totalIncome = 0; 
  let totalExpense = 0;
  let expenseByCategory = {};

  if (transactions) {
    transactions.forEach(trx => {
      if (trx.type === 'income') {
        totalIncome += trx.amount;
      } else if (trx.type === 'expense') {
        totalExpense += trx.amount;
        
        let catName = trx.categories ? trx.categories.name : 'Lainnya';
        if (!expenseByCategory[catName]) expenseByCategory[catName] = 0;
        expenseByCategory[catName] += trx.amount;
      }
    });
  }

  const { data: wallets } = await supabaseClient.from('wallets').select('name, balance').eq('user_id', user.id);
  let activeBalance = 0;
  if (wallets) { 
    wallets.forEach(wallet => { activeBalance += Number(wallet.balance) || 0; }); 
  }

  currentFormattedIncome = formatRp(totalIncome);
  currentFormattedExpense = formatRp(totalExpense);
  currentFormattedBalance = formatRp(activeBalance);
  isBalanceMinus = activeBalance < 0;
  
  globalWallets = wallets || [];
  globalActiveBalance = activeBalance;
  globalExpenseByCategory = expenseByCategory;

  const netBalanceEl = document.getElementById('net-balance');
  const mainCardEl = document.querySelector('.main-balance-card');

  if (isBalanceMinus) {
    netBalanceEl.style.color = '#fee2e2'; 
    if(mainCardEl) mainCardEl.style.background = 'linear-gradient(135deg, #ef4444, #f87171)';
  } else {
    netBalanceEl.style.color = 'white';
    if(mainCardEl) mainCardEl.style.background = 'linear-gradient(135deg, var(--primary), #60a5fa)';
  }

  updateBalanceDisplay();
  renderFinanceChart(totalIncome, totalExpense);
}

// =========================
// FUNGSI TOGGLE HIDE/SHOW BALANCE
// =========================
function toggleBalance() {
  isBalanceHidden = !isBalanceHidden;
  localStorage.setItem('hideBalance', isBalanceHidden);
  updateBalanceDisplay();
}

function updateBalanceDisplay() {
  const netBalanceEl = document.getElementById('net-balance');
  const incomeEl = document.getElementById('total-income');
  const expenseEl = document.getElementById('total-expense');
  const eyeIcon = document.getElementById('eye-icon');
  
  if (isBalanceHidden) {
    netBalanceEl.innerText = "Rp •••••••";
    incomeEl.innerText = "Rp •••••••";
    expenseEl.innerText = "Rp •••••••";
    eyeIcon.classList.remove('fa-eye');
    eyeIcon.classList.add('fa-eye-slash'); 
  } else {
    netBalanceEl.innerText = currentFormattedBalance + (isBalanceMinus ? ' (MINUS)' : '');
    incomeEl.innerText = currentFormattedIncome;
    expenseEl.innerText = currentFormattedExpense;
    eyeIcon.classList.remove('fa-eye-slash');
    eyeIcon.classList.add('fa-eye');
  }

  renderTopSpends();
  renderWalletDistribution();
}

// =========================
// RENDER COMPONENT STRUKTUR KEUANGAN (COMPACT)
// =========================
function renderFinanceChart(income, expense) {
  const ctx = document.getElementById('financeChart').getContext('2d');
  if (financeChart) financeChart.destroy();
  const hasData = income > 0 || expense > 0;
  financeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: hasData ? ['Pemasukan', 'Pengeluaran'] : ['Belum Ada Data', ''],
      datasets: [{ data: hasData ? [income, expense] : [1, 0], backgroundColor: hasData ? ['#10b981', '#ef4444'] : ['#e2e8f0', '#e2e8f0'], borderWidth: 0 }]
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false, 
      cutout: '65%', // KUNCI PERBAIKAN: Memperbesar lubang donat agar elegan di area sempit
      layout: { padding: 0 },
      plugins: { 
        legend: { 
          position: 'right',
          labels: { boxWidth: 10, padding: 8, font: { size: 10 } } 
        }, 
        tooltip: { enabled: hasData } 
      } 
    }
  });
}

function renderTopSpends() {
  const container = document.getElementById('top-spends-container');
  if (!container) return;

  const sorted = Object.keys(globalExpenseByCategory)
    .map(cat => ({ name: cat, amount: globalExpenseByCategory[cat] }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3); 

  if (sorted.length === 0) {
    container.innerHTML = '<p style="font-size:11px; color:var(--text-muted); text-align:center;">Belum ada pengeluaran.</p>';
    return;
  }

  let html = '';

  sorted.forEach((item, index) => {
    const displayAmount = isBalanceHidden ? "Rp •••••••" : formatRp(item.amount);
    html += `
      <div class="top-spend-item">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="background:var(--red-light); color:var(--red); width:20px; height:20px; border-radius:6px; display:flex; justify-content:center; align-items:center; font-size:10px; font-weight:bold;">${index+1}</div>
          <span style="font-size:12px; font-weight:600; color:var(--text-main);">${escapeHTML(item.name)}</span>
        </div>
        <span style="font-size:12px; font-weight:700; color:var(--red);">${displayAmount}</span>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function renderWalletDistribution() {
  const container = document.getElementById('wallet-dist-container');
  if (!container) return;

  if (globalWallets.length === 0 || globalActiveBalance === 0) {
    container.innerHTML = '<p style="font-size:11px; color:var(--text-muted); text-align:center;">Data dompet tidak tersedia.</p>';
    return;
  }

  let html = '';

  const sortedWallets = [...globalWallets].sort((a,b) => b.balance - a.balance).slice(0, 3);

  sortedWallets.forEach(w => {
    let percentage = globalActiveBalance > 0 ? (w.balance / globalActiveBalance) * 100 : 0;
    if (percentage < 0) percentage = 0; 
    if (percentage > 100) percentage = 100;

    const displayAmount = isBalanceHidden ? "Rp •••••••" : formatRp(w.balance);

    html += `
      <div style="margin-bottom: 6px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
          <span style="font-weight:600; color:var(--text-main);">${escapeHTML(w.name)}</span>
          <span style="color:var(--text-muted);">${displayAmount} <b style="color:var(--green);">(${percentage.toFixed(1)}%)</b></span>
        </div>
        <div style="background:#f1f5f9; border-radius:4px; height:6px; width:100%; overflow:hidden;">
          <div style="background:var(--green); height:100%; border-radius:4px; width:${percentage}%; transition: 1s ease-out;"></div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// =========================
// DATA TRANSAKSI
// =========================
async function loadRecentTransactions() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  let txQuery = supabaseClient
    .from('transactions').select(`id, title, amount, type, transaction_date, categories (name), wallets (id, name)`)
    .eq('user_id', user.id);

  if (currentPeriod === 'month') {
    txQuery = txQuery.gte('transaction_date', getFirstDayOfMonth());
  }

  const { data: transactions } = await txQuery.order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(5);

  const transactionList = document.getElementById('transaction-list');
  transactionList.innerHTML = '';

  if (!transactions || transactions.length === 0) {
    showEmptyState(transactionList, 'fa-receipt', 'Belum ada transaksi.');
    return;
  }

  transactions.forEach(trx => {
    let amountColor = '';
    let amountSign = '';
    if (trx.type === 'income') { amountColor = 'text-green'; amountSign = '+'; }
    else if (trx.type === 'expense') { amountColor = 'text-red'; amountSign = '-'; }

    const formattedDate = new Date(trx.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const categoryName = trx.categories ? trx.categories.name : 'Sistem';
    const walletName = trx.wallets ? trx.wallets.name : 'Unknown';
    const walletId = trx.wallets ? trx.wallets.id : '';

    const undoBtn = trx.type === 'transfer' ? '' : `<button onclick="undoTransaction('${trx.id}', '${walletId}', ${trx.amount}, '${trx.type}')" style="background: none; border: none; color: #ef4444; font-size: 11px; cursor: pointer; font-weight: 600;"><i class="fas fa-undo"></i> Batal</button>`;
    const transferStyle = trx.type === 'transfer' ? 'style="color: #64748b;"' : '';

    transactionList.innerHTML += `
      <div class="transaction-item" style="align-items: center;">
        <div class="transaction-detail">
          <h4>${escapeHTML(trx.title)}</h4>
          <p>${formattedDate} • ${escapeHTML(categoryName)} • ${escapeHTML(walletName)}</p>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div class="transaction-amount ${amountColor}" ${transferStyle}>
            ${amountSign} ${formatRp(trx.amount)}
          </div>
          ${undoBtn}
        </div>
      </div>
    `;
  });
}

function toggleHistory() {
  const content = document.getElementById('history-content');
  const chevron = document.getElementById('history-chevron');
  content.classList.toggle('closed');
  chevron.classList.toggle('closed');
}

function undoTransaction(trxId, walletId, amount, type) {
  if (type === 'transfer') {
    showCustomAlert("Ditolak", "Transaksi internal tidak dapat dibatalkan dari Dashboard.", "error");
    return;
  }

  showCustomConfirm("Yakin ingin membatalkan transaksi ini?<br>Uang akan dikembalikan secara otomatis ke dompet.", async () => {
    if (walletId) {
      const { data: wData } = await supabaseClient.from('wallets').select('balance').eq('id', walletId).single();
      if (wData) {
        let currentBalance = Number(wData.balance) || 0;
        let restoredBalance = currentBalance;

        if (type === 'expense') restoredBalance = currentBalance + amount; 
        else if (type === 'income') restoredBalance = currentBalance - amount; 

        await supabaseClient.from('wallets').update({ balance: restoredBalance }).eq('id', walletId);
      }
    }
    await supabaseClient.from('transactions').delete().eq('id', trxId);
    showCustomAlert("Berhasil", "Transaksi dibatalkan. Saldo dompet telah disesuaikan.", "success");
    loadSummary();
    loadRecentTransactions();
  });
}

async function loadUserName() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Dashboard';
  document.getElementById('user-name').innerText = name;
}

showGlobalLoading();
Promise.all([loadUserName(), loadSummary(), loadRecentTransactions()])
  .catch(err => console.error('Dashboard load error:', err))
  .finally(hideGlobalLoading);