// STATE UNTUK PAGINATION & INSIGHT
let currentTransactions = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentInsight = { title: '', message: '', type: 'neutral' };

// STATE UNTUK EDIT TRANSAKSI
let walletOptions = [];
let categoryOptions = [];
let editingOldTrx = null;

// STATE UNTUK FILTER & EXPORT
let filteredTransactions = [];
let currentRange = { start: '', end: '' };

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

  const detailStamp = document.getElementById('detail-range-text');
  if (detailStamp) detailStamp.innerHTML = `<i class="fas fa-calendar-alt"></i> Periode: <b>${formatIndoDateLong(start)}</b> s/d <b>${formatIndoDateLong(end)}</b>`;

  const { data: transactions, error } = await supabaseClient
    .from('transactions')
    .select(`id, title, amount, type, transaction_date, description, wallet_id, category_id, categories (id, name), wallets (id, name)`)
    .eq('user_id', user.id)
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) { console.error("Error:", error.message); showCustomAlert("Gagal Memuat", "Gagal memuat data laporan: " + error.message, "error"); return; }

  currentTransactions = transactions;
  currentRange = { start, end };
  currentPage = 1; 

  renderReportSummary();
  applyFilters();
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

  if (netBalance < 0) {
    netBalanceEl.style.color = '#dc2626';
    netBalanceEl.innerText += ' (DEFISIT)';
    netCardEl.classList.add('warning-glow');
  } else {
    netBalanceEl.style.color = '#16a34a';
    netCardEl.classList.remove('warning-glow');
  }

  if (totalIncome === 0 && totalExpense === 0) {
    insightBtn.style.display = 'none';
  } else {
    insightBtn.style.display = 'block';
    
    if (netBalance > 0) {
      insightBtn.innerHTML = '<i class="fas fa-lightbulb" style="color: #16a34a;"></i>';
      insightBtn.classList.remove('pulse-animation');
      currentInsight = { title: 'Insight Analisis', message: 'Bagus! Pemasukanmu lebih besar dari pengeluaran periode ini. Pertahankan!', type: 'success' };
    } else if (netBalance < 0) {
      insightBtn.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #dc2626;"></i>';
      insightBtn.classList.add('pulse-animation');
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

  if (filteredTransactions.length === 0) {
    transactionList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 30px; font-size:13px;">Tidak ada transaksi pada periode ini.</p>';
    paginationControls.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const slicedTransactions = filteredTransactions.slice(startIndex, endIndex);

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
       savingsBadgeHTML = `<span class="savings-badge"><i class="fas fa-bullseye"></i> Alokasi</span>`;
    }
    
    const descHTML = trx.description ? `<p class="trx-desc"><i class="fas fa-comment-dots"></i> ${trx.description}</p>` : '';

    const editBtnHTML = trx.type === 'transfer' ? ''
      : `<button onclick="openEditModal('${trx.id}')" class="btn-edit-action"><i class="fas fa-pen"></i> Edit</button>`;

    const itemHTML = `
      <div class="transaction-item">
        <div class="trx-header-row">
          <div class="transaction-detail">
            <h4>${trx.title}${savingsBadgeHTML}</h4>
            <p class="trx-meta">${formattedDate} • <b>${categoryName}</b> • ${walletName}</p>
          </div>
          <div class="trx-right">
            <div class="trx-amount-rendered ${amountColor}">
              ${amountSign} ${formatRp(trx.amount)}
            </div>
            ${editBtnHTML}
          </div>
        </div>
        ${descHTML}
      </div>
    `;
    transactionList.innerHTML += itemHTML;
  });

  if (totalPages > 1) {
    paginationControls.style.display = 'flex';
    document.getElementById('page-info').innerText = `Halaman ${currentPage} dari ${totalPages}`;
    
    document.getElementById('prev-page-btn').disabled = (currentPage === 1);
    document.getElementById('next-page-btn').disabled = (currentPage === totalPages);
  } else {
    paginationControls.style.display = 'none';
  }
}

function changePage(direction) {
  currentPage += direction;
  renderTransactionPage(); 
}

function switchReportTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.getElementById('pane-summary').classList.toggle('active', tabName === 'summary');
  document.getElementById('pane-detail').classList.toggle('active', tabName === 'detail');
}

// ==========================================
// SEARCH & FILTER
// ==========================================
function populateFilterDropdowns() {
  const catSelect = document.getElementById('filter-category');
  if (catSelect) {
    const currentVal = catSelect.value;
    catSelect.innerHTML = '<option value="">Semua Kategori</option>';
    [...new Map(categoryOptions.map(c => [c.id, c])).values()].forEach(c => {
      catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    catSelect.value = currentVal;
  }

  const walletSelect = document.getElementById('filter-wallet');
  if (walletSelect) {
    const currentVal = walletSelect.value;
    walletSelect.innerHTML = '<option value="">Semua Dompet</option>';
    walletOptions.forEach(w => {
      walletSelect.innerHTML += `<option value="${w.id}">${w.name}</option>`;
    });
    walletSelect.value = currentVal;
  }
}

function applyFilters() {
  const keyword = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
  const typeVal = document.getElementById('filter-type')?.value || '';
  const catVal = document.getElementById('filter-category')?.value || '';
  const walletVal = document.getElementById('filter-wallet')?.value || '';

  filteredTransactions = currentTransactions.filter(trx => {
    const matchKeyword = !keyword
      || (trx.title && trx.title.toLowerCase().includes(keyword))
      || (trx.description && trx.description.toLowerCase().includes(keyword));
    const matchType = !typeVal || trx.type === typeVal;
    const matchCat = !catVal || String(trx.category_id) === catVal;
    const matchWallet = !walletVal || String(trx.wallet_id) === walletVal;
    return matchKeyword && matchType && matchCat && matchWallet;
  });

  currentPage = 1;
  renderTransactionPage();
}

function resetFilters() {
  const search = document.getElementById('search-input');
  if (search) search.value = '';
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-wallet').value = '';
  applyFilters();
}

// ==========================================
// EXPORT CSV
// ==========================================
function csvEscape(value) {
  const s = (value === null || value === undefined) ? '' : String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCSV() {
  if (filteredTransactions.length === 0) {
    showCustomAlert("Info", "Tidak ada data yang bisa diexport.", "info");
    return;
  }

  const typeLabel = (t) => t === 'income' ? 'Pemasukan' : (t === 'expense' ? 'Pengeluaran' : 'Transfer');
  const header = ['Tanggal', 'Judul', 'Kategori', 'Dompet', 'Tipe', 'Jumlah', 'Catatan'];

  const rows = filteredTransactions.map(trx => [
    trx.transaction_date || '',
    csvEscape(trx.title),
    csvEscape(trx.categories ? trx.categories.name : 'Sistem'),
    csvEscape(trx.wallets ? trx.wallets.name : 'Unknown'),
    typeLabel(trx.type),
    trx.amount ?? '',
    csvEscape(trx.description)
  ]);

  const csvContent = '\uFEFF' + [header.map(csvEscape).join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const periodPart = `${currentRange.start || 'semua'}-${currentRange.end || ''}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan-${periodPart}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// REUSABLE HELPER & EDIT TRANSAKSI
// ==========================================
function formatRupiah(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

async function loadEditOptions() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const [walletRes, categoryRes] = await Promise.all([
    supabaseClient.from('wallets').select('id, name').eq('user_id', user.id),
    supabaseClient.from('categories').select('id, name, type').eq('user_id', user.id)
  ]);

  walletOptions = walletRes.data || [];
  categoryOptions = categoryRes.data || [];

  populateFilterDropdowns();
}

function openEditModal(trxId) {
  const trx = currentTransactions.find(t => t.id === trxId);
  if (!trx) return;
  if (trx.type === 'transfer') return; 

  editingOldTrx = trx;

  document.getElementById('edit-id').value = trx.id;
  document.getElementById('edit-type').value = trx.type;
  document.getElementById('edit-title').value = trx.title || '';
  document.getElementById('edit-date').value = trx.transaction_date || '';

  const amountInput = document.getElementById('edit-amount');
  amountInput.value = (trx.amount || 0).toLocaleString('id-ID').replace(/,/g, '.');

  document.getElementById('edit-description').value = trx.description || '';

  const walletSelect = document.getElementById('edit-wallet');
  walletSelect.innerHTML = '<option value="">Pilih Dompet</option>';
  walletOptions.forEach(w => {
    const sel = String(w.id) === String(trx.wallet_id) ? 'selected' : '';
    walletSelect.innerHTML += `<option value="${w.id}" ${sel}>${w.name}</option>`;
  });

  const catSelect = document.getElementById('edit-category');
  catSelect.innerHTML = '<option value="">Pilih Kategori</option>';
  categoryOptions
    .filter(c => c.type === trx.type)
    .forEach(c => {
      const sel = String(c.id) === String(trx.category_id) ? 'selected' : '';
      catSelect.innerHTML += `<option value="${c.id}" ${sel}>${c.name}</option>`;
    });

  document.getElementById('edit-modal-overlay').classList.add('active');
  document.getElementById('edit-modal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('edit-modal-overlay').classList.remove('active');
  document.getElementById('edit-modal').classList.remove('active');
  editingOldTrx = null;
}

async function saveEditedTransaction() {
  const id = document.getElementById('edit-id').value;
  const type = document.getElementById('edit-type').value;
  const title = document.getElementById('edit-title').value.trim();
  const amount = parseInt(document.getElementById('edit-amount').value.replace(/\./g, '')) || 0;
  const transaction_date = document.getElementById('edit-date').value;
  const wallet_id = document.getElementById('edit-wallet').value;
  const category_id = document.getElementById('edit-category').value;
  const description = document.getElementById('edit-description').value;

  if (!title) { showCustomAlert("Peringatan", "Judul transaksi tidak boleh kosong.", "error"); return; }
  if (!amount || amount <= 0) { showCustomAlert("Peringatan", "Masukkan nominal yang valid.", "error"); return; }
  if (!wallet_id) { showCustomAlert("Peringatan", "Pilih dompet terlebih dahulu.", "error"); return; }
  if (!category_id) { showCustomAlert("Peringatan", "Pilih kategori terlebih dahulu.", "error"); return; }

  const old = editingOldTrx;
  if (!old) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const walletIds = [...new Set([old.wallet_id, wallet_id])];
  const { data: walletRows } = await supabaseClient.from('wallets')
    .select('id, balance').in('id', walletIds);
  const balanceMap = {};
  (walletRows || []).forEach(w => balanceMap[w.id] = parseInt(w.balance) || 0);

  const effect = (t, amt) => t === 'income' ? amt : -amt;

  const doSave = async () => {
    const btn = document.getElementById('save-edit-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    const { error: txError } = await supabaseClient.from('transactions')
      .update({ title, amount, type, transaction_date, wallet_id, category_id, description })
      .eq('id', id).eq('user_id', user.id);

    if (txError) {
      showCustomAlert("Gagal", txError.message, "error");
      btn.innerHTML = originalText; btn.disabled = false;
      return;
    }

    if (String(old.wallet_id) === String(wallet_id)) {
      const newBal = (balanceMap[wallet_id] || 0) - effect(old.type, old.amount) + effect(type, amount);
      await supabaseClient.from('wallets').update({ balance: newBal }).eq('id', wallet_id);
    } else {
      const newOldBal = (balanceMap[old.wallet_id] || 0) - effect(old.type, old.amount);
      const newNewBal = (balanceMap[wallet_id] || 0) + effect(type, amount);
      await supabaseClient.from('wallets').update({ balance: newOldBal }).eq('id', old.wallet_id);
      await supabaseClient.from('wallets').update({ balance: newNewBal }).eq('id', wallet_id);
    }

    btn.innerHTML = originalText; btn.disabled = false;
    closeEditModal();
    showCustomAlert("Berhasil", "Transaksi berhasil diperbarui.", "success");
    loadReport();
  };

  if (type === 'expense') {
    const targetBal = String(old.wallet_id) === String(wallet_id)
      ? (balanceMap[wallet_id] || 0) - effect(old.type, old.amount)
      : (balanceMap[wallet_id] || 0);

    if (amount > targetBal) {
      showCustomConfirm(`Saldo dompet saat ini hanya Rp ${new Intl.NumberFormat('id-ID').format(targetBal)}.<br>Yakin ingin mencatat pengeluaran ini dan membuat saldo menjadi minus (hutang)?`, doSave);
      return;
    }
  }

  doSave();
}

document.getElementById('save-edit-btn').addEventListener('click', saveEditedTransaction);

// ==========================================
// ALERT & EVENT LISTENER
// ==========================================
let confirmCallback = null;

function showCustomAlert(title, message, type = 'success') {
  document.getElementById('alert-title').innerText = title;
  document.getElementById('alert-message').innerText = message;
  const iconEl = document.getElementById('alert-icon');
  if(type === 'success') { iconEl.innerHTML = '<i class="fas fa-check-circle"></i>'; iconEl.style.color = '#16a34a'; }
  else if(type === 'info') { iconEl.innerHTML = '<i class="fas fa-info-circle"></i>'; iconEl.style.color = '#3b82f6'; }
  else { iconEl.innerHTML = '<i class="fas fa-times-circle"></i>'; iconEl.style.color = '#dc2626'; }
  document.getElementById('alert-modal-overlay').classList.add('active');
  document.getElementById('alert-modal').classList.add('active');
}

function showCustomConfirm(message, callback) {
  const overlay = document.getElementById('confirm-modal-overlay');
  if (!overlay) {
    if (confirm(message.replace(/<br>/g, "\n"))) callback();
    return;
  }
  document.getElementById('confirm-message').innerHTML = message;
  confirmCallback = callback;
  overlay.classList.add('active');
  document.getElementById('confirm-modal').classList.add('active');
}

function closeCustomConfirm(isConfirmed) {
  const overlay = document.getElementById('confirm-modal-overlay');
  if (overlay) overlay.classList.remove('active');
  document.getElementById('confirm-modal').classList.remove('active');
  if (isConfirmed && confirmCallback) confirmCallback();
}

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

const searchInput = document.getElementById('search-input');
if (searchInput) searchInput.addEventListener('input', applyFilters);
const filterType = document.getElementById('filter-type');
if (filterType) filterType.addEventListener('change', applyFilters);
const filterCat = document.getElementById('filter-category');
if (filterCat) filterCat.addEventListener('change', applyFilters);
const filterWallet = document.getElementById('filter-wallet');
if (filterWallet) filterWallet.addEventListener('change', applyFilters);

async function init() {
  await loadEditOptions();
  loadReport();
}
init();