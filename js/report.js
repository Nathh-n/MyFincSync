// STATE UNTUK PAGINATION & INSIGHT
let currentTransactions = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentInsight = { title: '', message: '', type: 'neutral' }; // Menyimpan data insight saat ini

// ==========================================
// FUNGSI MENGHITUNG RENTANG TANGGAL (LOCAL)
// ==========================================
function getDateRange(period) {
  const now = new Date();
  const formatYYYYMMDD = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const todayStr = formatYYYYMMDD(now);

  if (period === 'today') return { start: todayStr, end: todayStr };
  if (period === 'weekly') {
    const currentDay = now.getDay(); 
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now); monday.setDate(now.getDate() + distanceToMonday);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { start: formatYYYYMMDD(monday), end: formatYYYYMMDD(sunday) };
  } 
  if (period === 'monthly') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: formatYYYYMMDD(firstDay), end: formatYYYYMMDD(lastDay) };
  } 
  if (period === 'yearly') {
    const firstDay = new Date(now.getFullYear(), 0, 1);
    const lastDay = new Date(now.getFullYear(), 11, 31);
    return { start: formatYYYYMMDD(firstDay), end: formatYYYYMMDD(lastDay) };
  }
  if (period === 'custom') {
    const start = document.getElementById('custom-start').value || todayStr;
    const end = document.getElementById('custom-end').value || todayStr;
    return { start, end };
  }
  return { start: todayStr, end: todayStr };
}

function formatIndoDateLong(dateStr) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

const formatRp = (num) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
};

// ==========================================
// LOAD DATA DARI DATABASE
// ==========================================
async function loadReport() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const period = document.getElementById('period-filter').value;
  const { start, end } = getDateRange(period);

  document.getElementById('date-range-text').innerHTML = `<i class="fas fa-clock"></i> <b>${formatIndoDateLong(start)}</b> s/d <b>${formatIndoDateLong(end)}</b>`;

  const { data: transactions, error } = await supabaseClient
    .from('transactions')
    .select(`id, title, amount, type, transaction_date, description, categories (name), wallets (name)`)
    .eq('user_id', user.id)
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) { console.error("Error:", error.message); return; }

  currentTransactions = transactions;
  currentPage = 1; // Reset kembali ke halaman 1 tiap kali filter diganti

  renderReportSummary(); 
  renderTransactionPage(); 
}

// ==========================================
// RENDER RINGKASAN & SIAPKAN DATA INSIGHT
// ==========================================
function renderReportSummary() {
  let totalIncome = 0;
  let totalExpense = 0;

  currentTransactions.forEach(trx => {
    if (trx.type === 'income') totalIncome += trx.amount;
    else if (trx.type === 'expense') totalExpense += trx.amount;
  });

  const netBalance = totalIncome - totalExpense;

  document.getElementById('period-income').innerText = formatRp(totalIncome);
  document.getElementById('period-expense').innerText = formatRp(totalExpense);
  
  const netBalanceEl = document.getElementById('period-net-balance');
  const netCardEl = document.getElementById('period-net-card');
  const insightBtn = document.getElementById('insight-btn');
  
  netBalanceEl.innerText = formatRp(netBalance);

  // Styling Kartu Net
  if (netBalance < 0) {
    netBalanceEl.style.color = '#dc2626';
    netBalanceEl.innerText += ' (DEFISIT)';
    netCardEl.classList.add('warning-glow');
  } else {
    netBalanceEl.style.color = '#16a34a';
    netCardEl.classList.remove('warning-glow');
  }

  // Siapkan Ikon dan Pesan Insight
  if (totalIncome === 0 && totalExpense === 0) {
    insightBtn.style.display = 'none'; // Sembunyikan ikon jika tidak ada transaksi
  } else {
    insightBtn.style.display = 'block';
    
    if (netBalance > 0) {
      insightBtn.innerHTML = '<i class="fas fa-lightbulb" style="color: #16a34a;"></i>';
      insightBtn.classList.remove('pulse-animation');
      currentInsight = { title: 'Insight Analisis', message: 'Bagus! Pemasukanmu lebih besar dari pengeluaran periode ini. Pertahankan!', type: 'success' };
    } else if (netBalance < 0) {
      insightBtn.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>';
      insightBtn.classList.add('pulse-animation'); // Berkedip peringatan
      currentInsight = { title: 'Peringatan Defisit', message: 'Perhatian: Kamu belanja lebih besar dari penghasilan. Evaluasi kembali pengeluaranmu!', type: 'error' };
    } else {
      insightBtn.innerHTML = '<i class="fas fa-balance-scale" style="color: #475569;"></i>';
      insightBtn.classList.remove('pulse-animation');
      currentInsight = { title: 'Arus Kas Impas', message: 'Arus kas kamu seimbang (Titik impas). Uang yang masuk setara dengan yang keluar.', type: 'neutral' };
    }
  }
}

// ==========================================
// RENDER TRANSAKSI DENGAN PAGINATION
// ==========================================
function renderTransactionPage() {
  const transactionList = document.getElementById('report-transaction-list');
  const paginationControls = document.getElementById('pagination-controls');
  transactionList.innerHTML = '';

  if (currentTransactions.length === 0) {
    transactionList.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 30px; font-size:13px;">Tidak ada transaksi pada periode ini.</p>';
    paginationControls.style.display = 'none';
    return;
  }

  // Hitung jumlah halaman
  const totalPages = Math.ceil(currentTransactions.length / itemsPerPage);
  
  // Ambil hanya transaksi untuk halaman saat ini
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const slicedTransactions = currentTransactions.slice(startIndex, endIndex);

  // Render list yang sudah dipotong (max 10)
  slicedTransactions.forEach(trx => {
    let amountColor = '';
    let amountSign = '';
    if (trx.type === 'income') { amountColor = 'text-green'; amountSign = '+'; }
    else if (trx.type === 'expense') { amountColor = 'text-red'; amountSign = '-'; }

    const dateObj = new Date(trx.transaction_date);
    const formattedDate = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

    let categoryName = trx.categories ? trx.categories.name : 'Sistem';
    const walletName = trx.wallets ? trx.wallets.name : 'Unknown';
    
    let savingsBadgeHTML = '';
    const descText = trx.description ? trx.description.toLowerCase() : '';
    if (descText.includes('tabungan')) {
       categoryName = "Target Tabungan";
       savingsBadgeHTML = ` <span style="background: #e0f2fe; color: #0369a1; padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: bold; margin-left: 5px; vertical-align: middle;"><i class="fas fa-bullseye"></i> Alokasi</span>`;
    }
    
    const descHTML = trx.description ? `<p style="font-size:11px; color:#94a3b8; margin-top:4px; font-style: italic;"><i class="fas fa-comment-dots"></i> ${trx.description}</p>` : '';
    const transferStyle = trx.type === 'transfer' ? 'style="color: #64748b;"' : '';

    const itemHTML = `
      <div class="transaction-item" style="flex-direction: column; align-items: flex-start; gap: 2px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div class="transaction-detail">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 3px; display: flex; align-items: center;">
              ${trx.title}${savingsBadgeHTML}
            </h4>
            <p style="font-size: 11px; color: #94a3b8;">${formattedDate} • <span style="color:#64748b; font-weight:600;">${categoryName}</span> • ${walletName}</p>
          </div>
          <div class="transaction-amount ${amountColor}" ${transferStyle} style="font-size: 14px; font-weight: 700;">
            ${amountSign} ${formatRp(trx.amount)}
          </div>
        </div>
        ${descHTML}
      </div>
    `;
    transactionList.innerHTML += itemHTML;
  });

  // Urus Tampilan Pagination
  if (totalPages > 1) {
    paginationControls.style.display = 'flex';
    document.getElementById('page-info').innerText = `Halaman ${currentPage} dari ${totalPages}`;
    
    // Matikan tombol jika di awal atau akhir
    document.getElementById('prev-page-btn').disabled = (currentPage === 1);
    document.getElementById('next-page-btn').disabled = (currentPage === totalPages);
  } else {
    paginationControls.style.display = 'none';
  }
}

// FUNGSI GANTI HALAMAN PAGINATION
function changePage(direction) {
  currentPage += direction;
  renderTransactionPage(); // Render ulang hanya daftarnya (tanpa ke database)
}

// ==========================================
// ALERT & EVENT LISTENER
// ==========================================
function showInsightAlert() {
  const iconEl = document.getElementById('alert-icon');
  document.getElementById('alert-title').innerText = currentInsight.title; 
  document.getElementById('alert-message').innerText = currentInsight.message;
  
  if(currentInsight.type === 'success') { 
    iconEl.innerHTML = '<i class="fas fa-lightbulb"></i>'; iconEl.style.color = '#16a34a'; 
  } else if (currentInsight.type === 'error') { 
    iconEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i>'; iconEl.style.color = '#dc2626'; 
  } else {
    iconEl.innerHTML = '<i class="fas fa-balance-scale"></i>'; iconEl.style.color = '#475569'; 
  }
  
  document.getElementById('alert-modal-overlay').classList.add('active'); 
  document.getElementById('alert-modal').classList.add('active');
}

function closeCustomAlert() { 
  document.getElementById('alert-modal-overlay').classList.remove('active'); 
  document.getElementById('alert-modal').classList.remove('active'); 
}

// Event Saat Filter Diganti
document.getElementById('period-filter').addEventListener('change', (e) => {
  const customContainer = document.getElementById('custom-date-container');
  if (e.target.value === 'custom') {
    customContainer.style.display = 'flex'; 
  } else {
    customContainer.style.display = 'none'; 
  }
  loadReport();
});

document.getElementById('custom-start').addEventListener('change', loadReport);
document.getElementById('custom-end').addEventListener('change', loadReport);

loadReport();