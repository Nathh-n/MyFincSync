let financeChart;

// STATE UNTUK HIDE/SHOW BALANCE
// Mengecek apakah sebelumnya user menyembunyikan saldo (tersimpan di browser)
let isBalanceHidden = localStorage.getItem('hideBalance') === 'true';
let currentFormattedBalance = "Rp 0";
let isBalanceMinus = false;

async function loadSummary() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data: transactions } = await supabaseClient.from('transactions').select('amount, type').eq('user_id', user.id);
  let totalIncome = 0; let totalExpense = 0;

  if (transactions) {
    transactions.forEach(trx => {
      if (trx.type === 'income') totalIncome += trx.amount;
      else if (trx.type === 'expense') totalExpense += trx.amount;
    });
  }

  const { data: wallets } = await supabaseClient.from('wallets').select('balance').eq('user_id', user.id);
  let activeBalance = 0;
  if (wallets) { wallets.forEach(wallet => { activeBalance += Number(wallet.balance) || 0; }); }

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  document.getElementById('total-income').innerText = formatRp(totalIncome);
  document.getElementById('total-expense').innerText = formatRp(totalExpense);
  
  const netBalanceEl = document.getElementById('net-balance');
  const mainCardEl = document.querySelector('.main-balance-card');
  
  // Simpan data saldo murni sebelum difilter oleh sistem Hide/Show
  currentFormattedBalance = formatRp(activeBalance);
  isBalanceMinus = activeBalance < 0;

  if (isBalanceMinus) {
    netBalanceEl.style.color = '#fee2e2'; 
    if(mainCardEl) mainCardEl.style.background = 'linear-gradient(135deg, #ef4444, #f87171)';
  } else {
    netBalanceEl.style.color = 'white';
    if(mainCardEl) mainCardEl.style.background = 'linear-gradient(135deg, var(--primary), #60a5fa)';
  }

  // Panggil fungsi render balance
  updateBalanceDisplay();
  renderFinanceChart(totalIncome, totalExpense);
}

// =========================
// FUNGSI TOGGLE HIDE/SHOW BALANCE
// =========================
function toggleBalance() {
  isBalanceHidden = !isBalanceHidden;
  localStorage.setItem('hideBalance', isBalanceHidden); // Simpan pilihan ke memori browser
  updateBalanceDisplay();
}

function updateBalanceDisplay() {
  const netBalanceEl = document.getElementById('net-balance');
  const eyeIcon = document.getElementById('eye-icon');
  
  if (isBalanceHidden) {
    // Jika mode rahasia aktif
    netBalanceEl.innerText = "Rp •••••••";
    eyeIcon.classList.remove('fa-eye');
    eyeIcon.classList.add('fa-eye-slash'); // Ganti icon jadi mata tercoret
  } else {
    // Jika mode rahasia mati (tampilkan angka asli)
    netBalanceEl.innerText = currentFormattedBalance + (isBalanceMinus ? ' (MINUS)' : '');
    eyeIcon.classList.remove('fa-eye-slash');
    eyeIcon.classList.add('fa-eye');
  }
}

// =========================
// SISA FUNGSI BAWAAN
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
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { enabled: hasData } } }
  });
}

async function loadRecentTransactions() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data: transactions } = await supabaseClient
    .from('transactions').select(`id, title, amount, type, transaction_date, categories (name), wallets (id, name)`)
    .eq('user_id', user.id).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(5);

  const transactionList = document.getElementById('transaction-list');
  transactionList.innerHTML = '';

  if (!transactions || transactions.length === 0) {
    transactionList.innerHTML = '<p style="color: #94a3b8; font-size: 13px; text-align: center; padding: 15px;">Belum ada transaksi.</p>'; return;
  }

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

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
          <h4>${trx.title}</h4>
          <p>${formattedDate} • ${categoryName} • ${walletName}</p>
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

function undoTransaction(trxId, walletId, amount, type) {
  if (type === 'transfer') {
    showCustomAlert("Ditolak", "Transaksi tabungan internal tidak dapat dibatalkan dari Dashboard.", "error");
    return;
  }

  showCustomConfirm("Yakin ingin membatalkan transaksi ini?<br>Uang akan dikembalikan secara otomatis ke dompet.", async () => {
    if (walletId) {
      const { data: wData } = await supabaseClient.from('wallets').select('balance').eq('id', walletId).single();
      if (wData) {
        let currentBalance = parseInt(wData.balance) || 0;
        let restoredBalance = currentBalance;

        if (type === 'expense') {
          restoredBalance = currentBalance + amount; 
        } else if (type === 'income') {
          restoredBalance = currentBalance - amount; 
        }

        await supabaseClient.from('wallets').update({ balance: restoredBalance }).eq('id', walletId);
      }
    }
    await supabaseClient.from('transactions').delete().eq('id', trxId);
    showCustomAlert("Berhasil", "Transaksi dibatalkan. Saldo dompet telah disesuaikan.", "success");
    loadSummary();
    loadRecentTransactions();
  });
}

function showCustomAlert(title, message, type = 'success') {
  document.getElementById('alert-title').innerText = title; document.getElementById('alert-message').innerText = message;
  const iconEl = document.getElementById('alert-icon');
  if(type === 'success') { iconEl.innerHTML = '<i class="fas fa-check-circle"></i>'; iconEl.style.color = 'var(--green)'; } 
  else { iconEl.innerHTML = '<i class="fas fa-times-circle"></i>'; iconEl.style.color = 'var(--red)'; }
  document.getElementById('alert-modal-overlay').classList.add('active'); document.getElementById('alert-modal').classList.add('active');
}
function closeCustomAlert() { document.getElementById('alert-modal-overlay').classList.remove('active'); document.getElementById('alert-modal').classList.remove('active'); }

let confirmCallback = null;
function showCustomConfirm(message, callback) {
  document.getElementById('confirm-message').innerHTML = message;
  confirmCallback = callback;
  document.getElementById('confirm-modal-overlay').classList.add('active'); document.getElementById('confirm-modal').classList.add('active');
}
function closeCustomConfirm(isConfirmed) {
  document.getElementById('confirm-modal-overlay').classList.remove('active'); document.getElementById('confirm-modal').classList.remove('active');
  if (isConfirmed && confirmCallback) confirmCallback(); 
}
function formatRupiah(input) { let value = input.value.replace(/[^0-9]/g, ''); input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

loadSummary();
loadRecentTransactions();