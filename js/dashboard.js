let financeChart;

// =========================
// LOAD SUMMARY TRANSAKSI & RENDER CHART
// =========================
async function loadSummary() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  // 1. AMBIL DATA TRANSAKSI (Hanya untuk badge Pemasukan & Pengeluaran)
  const { data: transactions, error: txError } = await supabaseClient
    .from('transactions')
    .select('amount, type')
    .eq('user_id', user.id);

  let totalIncome = 0;
  let totalExpense = 0;

  if (!txError && transactions) {
    transactions.forEach(trx => {
      if (trx.type === 'income') {
        totalIncome += trx.amount;
      } else if (trx.type === 'expense') {
        totalExpense += trx.amount;
      }
    });
  }

  // 2. AMBIL DATA DOMPET (Untuk menghitung Total Uang Real / Total Saldo)
  const { data: wallets, error: walletError } = await supabaseClient
    .from('wallets')
    .select('balance')
    .eq('user_id', user.id);

  let totalWalletBalance = 0;
  
  if (!walletError && wallets) {
    wallets.forEach(wallet => {
      // Jumlahkan semua uang yang ada di tiap dompet
      totalWalletBalance += Number(wallet.balance) || 0;
    });
  }

  // 3. RENDER ANGKA KE LAYAR
  const formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(num);
  };

  // Render Pemasukan & Pengeluaran
  document.getElementById('total-income').innerText = formatRp(totalIncome);
  document.getElementById('total-expense').innerText = formatRp(totalExpense);
  
  // Render Uang Real (Total Saldo)
  const netBalanceEl = document.getElementById('net-balance');
  const mainCardEl = document.querySelector('.main-balance-card');

  netBalanceEl.innerText = formatRp(totalWalletBalance);

  // Ubah warna jika entah bagaimana saldo dompet sampai minus (ngutang)
  if (totalWalletBalance < 0) {
    netBalanceEl.style.color = '#fee2e2';
    netBalanceEl.innerText += ' (MINUS)';
    if(mainCardEl) mainCardEl.style.background = 'linear-gradient(135deg, #ef4444, #f87171)';
  } else {
    netBalanceEl.style.color = 'white';
    if(mainCardEl) mainCardEl.style.background = 'linear-gradient(135deg, var(--primary), #60a5fa)';
  }

  // Render grafik berdasarkan rasio pemasukan vs pengeluaran
  renderFinanceChart(totalIncome, totalExpense);
}

// =========================
// RENDER GRAPHIC CHART
// =========================
function renderFinanceChart(income, expense) {
  const ctx = document.getElementById('financeChart').getContext('2d');

  if (financeChart) {
    financeChart.destroy();
  }

  const hasData = income > 0 || expense > 0;
  const chartData = hasData ? [income, expense] : [1, 0]; 
  const chartColors = hasData ? ['#10b981', '#ef4444'] : ['#e2e8f0', '#e2e8f0']; 
  const chartLabels = hasData ? ['Pemasukan', 'Pengeluaran'] : ['Belum Ada Data', ''];

  financeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartData,
        backgroundColor: chartColors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#64748b', 
            font: { family: 'Inter', size: 12 }
          }
        },
        tooltip: {
          enabled: hasData
        }
      }
    }
  });
}

// =========================
// LOAD RECENT TRANSACTIONS
// =========================
async function loadRecentTransactions() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data: transactions, error } = await supabaseClient
    .from('transactions')
    .select(`
      id, title, amount, type, transaction_date,
      categories (name),
      wallets (name)
    `)
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching recent transactions:", error.message);
    return;
  }

  const transactionList = document.getElementById('transaction-list');
  transactionList.innerHTML = '';

  if (transactions.length === 0) {
    transactionList.innerHTML = '<p style="color: #94a3b8; font-size: 13px; text-align: center; padding: 15px;">Belum ada transaksi.</p>';
    return;
  }

  const formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(num);
  };

  transactions.forEach(trx => {
    const isIncome = trx.type === 'income';
    const amountColor = isIncome ? 'text-green' : 'text-red';
    const amountSign = isIncome ? '+' : '-';
    
    const dateObj = new Date(trx.transaction_date);
    const formattedDate = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    const categoryName = trx.categories ? trx.categories.name : 'Uncategorized';
    const walletName = trx.wallets ? trx.wallets.name : 'Unknown';

    const itemHTML = `
      <div class="transaction-item">
        <div class="transaction-detail">
          <h4>${trx.title}</h4>
          <p>${formattedDate} • ${categoryName} • ${walletName}</p>
        </div>
        <div class="transaction-amount ${amountColor}">
          ${amountSign} ${formatRp(trx.amount)}
        </div>
      </div>
    `;
    transactionList.innerHTML += itemHTML;
  });
}

// =========================
// SISTEM POP-UP GLOBAL (BISA DIPANGGIL FILE LAIN)
// =========================
function showCustomAlert(title, message, type = 'success') {
  document.getElementById('alert-title').innerText = title;
  document.getElementById('alert-message').innerText = message;
  const iconEl = document.getElementById('alert-icon');
  
  if(type === 'success') {
     iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
     iconEl.style.color = 'var(--green)';
  } else {
     iconEl.innerHTML = '<i class="fas fa-times-circle"></i>';
     iconEl.style.color = 'var(--red)';
  }
  
  document.getElementById('alert-modal-overlay').classList.add('active');
  document.getElementById('alert-modal').classList.add('active');
}

function closeCustomAlert() {
  document.getElementById('alert-modal-overlay').classList.remove('active');
  document.getElementById('alert-modal').classList.remove('active');
}

let confirmCallback = null;
function showCustomConfirm(message, callback) {
  document.getElementById('confirm-message').innerText = message;
  confirmCallback = callback;
  
  document.getElementById('confirm-modal-overlay').classList.add('active');
  document.getElementById('confirm-modal').classList.add('active');
}

function closeCustomConfirm(isConfirmed) {
  document.getElementById('confirm-modal-overlay').classList.remove('active');
  document.getElementById('confirm-modal').classList.remove('active');
  if (isConfirmed && confirmCallback) {
    confirmCallback(); // Eksekusi fungsi jika user klik "Ya"
  }
}

// =========================
// FUNGSI FORMAT RUPIAH SAAT KETIK
// =========================
function formatRupiah(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// JALANKAN SEMUA FUNGSI SAAT HALAMAN DIBUKA
loadSummary();
loadRecentTransactions();