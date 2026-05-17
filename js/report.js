// ==========================================
// FUNGSI MENGHITUNG RENTANG TANGGAL (LOCAL)
// ==========================================
function getDateRange(period) {
  const now = new Date();
  let startDate, endDate;

  // Format ke YYYY-MM-DD sesuai zona waktu lokal
  const formatYYYYMMDD = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const todayStr = formatYYYYMMDD(now);

  if (period === 'today') {
    return { start: todayStr, end: todayStr };
  } 
  
  if (period === 'weekly') {
    // Cari hari Senin di minggu ini
    const currentDay = now.getDay(); 
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    
    // Cari hari Minggu di minggu ini
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return { start: formatYYYYMMDD(monday), end: formatYYYYMMDD(sunday) };
  } 
  
  if (period === 'monthly') {
    // Tanggal 1 bulan ini sampai tanggal terakhir bulan ini
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: formatYYYYMMDD(firstDay), end: formatYYYYMMDD(lastDay) };
  } 
  
  if (period === 'yearly') {
    // 1 Januari sampai 31 Desember tahun ini
    const firstDay = new Date(now.getFullYear(), 0, 1);
    const lastDay = new Date(now.getFullYear(), 11, 31);
    return { start: formatYYYYMMDD(firstDay), end: formatYYYYMMDD(lastDay) };
  }

  return { start: todayStr, end: todayStr };
}

// ==========================================
// LOAD & FILTER DATA TRANSAKSI FROM SUPABASE
// ==========================================
async function loadReport() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const period = document.getElementById('period-filter').value;
  const { start, end } = getDateRange(period);

  // Ambil data transaksi di antara start date dan end date
  const { data: transactions, error } = await supabaseClient
    .from('transactions')
    .select(`
      id, title, amount, type, transaction_date, description,
      categories (name),
      wallets (name)
    `)
    .eq('user_id', user.id)
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error loading report:", error.message);
    return;
  }

  renderReportData(transactions);
}

// ==========================================
// RENDER DATA KE HALAMAN HTML
// ==========================================
function renderReportData(transactions) {
  let totalIncome = 0;
  let totalExpense = 0;

  const transactionList = document.getElementById('report-transaction-list');
  transactionList.innerHTML = '';

  const formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(num);
  };

  if (transactions.length === 0) {
    transactionList.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 30px;">Tidak ada transaksi pada periode ini.</p>';
  } else {
    transactions.forEach(trx => {
      if (trx.type === 'income') totalIncome += trx.amount;
      else totalExpense += trx.amount;

      const isIncome = trx.type === 'income';
      const amountColor = isIncome ? 'text-green' : 'text-red';
      const amountSign = isIncome ? '+' : '-';
      
      const dateObj = new Date(trx.transaction_date);
      const formattedDate = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      const categoryName = trx.categories ? trx.categories.name : 'Uncategorized';
      const walletName = trx.wallets ? trx.wallets.name : 'Unknown Wallet';
      
      // Tampilkan deskripsi jika user mengisinya
      const descHTML = trx.description ? `<p style="font-size:13px; color:#cbd5e1; margin-top:5px; font-style: italic;">"${trx.description}"</p>` : '';

      const itemHTML = `
        <div class="transaction-item" style="flex-direction: column; align-items: flex-start; gap: 3px;">
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
            <div class="transaction-detail">
              <h4>${trx.title}</h4>
              <p>${formattedDate} • ${categoryName} • ${walletName}</p>
            </div>
            <div class="transaction-amount ${amountColor}">
              ${amountSign} ${formatRp(trx.amount)}
            </div>
          </div>
          ${descHTML}
        </div>
      `;
      transactionList.innerHTML += itemHTML;
    });
  }

  // Hitung Nilai Bersih (Net)
  const netBalance = totalIncome - totalExpense;

  document.getElementById('period-income').innerText = formatRp(totalIncome);
  document.getElementById('period-expense').innerText = formatRp(totalExpense);
  
  const netBalanceEl = document.getElementById('period-net-balance');
  const netCardEl = document.getElementById('period-net-card');
  
  netBalanceEl.innerText = formatRp(netBalance);

  // Deteksi jika hasil kalkulasi filter berstatus minus
  if (netBalance < 0) {
    netBalanceEl.style.color = '#ef4444';
    netBalanceEl.innerText += ' (MINUS!)';
    netCardEl.classList.add('warning-glow');
  } else {
    netBalanceEl.style.color = '#22c55e';
    netCardEl.classList.remove('warning-glow');
  }
}

// ==========================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================
document.getElementById('period-filter').addEventListener('change', loadReport);

// Jalankan otomatis saat halaman dibuka
loadReport();