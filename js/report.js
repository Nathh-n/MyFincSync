// ==========================================
// FUNGSI MENGHITUNG RENTANG TANGGAL (LOCAL)
// ==========================================
function getDateRange(period) {
  const now = new Date();
  let startDate, endDate;

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
    const currentDay = now.getDay(); 
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
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
  return { start: todayStr, end: todayStr };
}

function formatIndoDateLong(dateStr) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

// ==========================================
// LOAD & FILTER DATA
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

  renderReportData(transactions);
}

// ==========================================
// RENDER DATA & MICRO INSIGHTS
// ==========================================
function renderReportData(transactions) {
  let totalIncome = 0;
  let totalExpense = 0;

  const transactionList = document.getElementById('report-transaction-list');
  transactionList.innerHTML = '';

  const formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  if (transactions.length === 0) {
    transactionList.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 30px; font-size:13px;">Tidak ada transaksi pada periode ini.</p>';
  } else {
    transactions.forEach(trx => {
      
      if (trx.type === 'income') totalIncome += trx.amount;
      else if (trx.type === 'expense') totalExpense += trx.amount;

      let amountColor = '';
      let amountSign = '';
      if (trx.type === 'income') { amountColor = 'text-green'; amountSign = '+'; }
      else if (trx.type === 'expense') { amountColor = 'text-red'; amountSign = '-'; }

      const dateObj = new Date(trx.transaction_date);
      // Format tanggal dibuat lebih ringkas agar visualnya tidak menumpuk
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

      // VISUAL HIERARCHY DITERAPKAN DI SINI
      // Title = Lebih besar & Bold (14px). Meta (Date, Cat, Wallet) = Lebih kecil & Redup (11px).
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
  }

  const netBalance = totalIncome - totalExpense;

  // Render Angka ke Kartu Ringkasan
  document.getElementById('period-income').innerText = formatRp(totalIncome);
  document.getElementById('period-expense').innerText = formatRp(totalExpense);
  
  const netBalanceEl = document.getElementById('period-net-balance');
  const netCardEl = document.getElementById('period-net-card');
  netBalanceEl.innerText = formatRp(netBalance);

  if (netBalance < 0) {
    netBalanceEl.style.color = '#dc2626';
    netBalanceEl.innerText += ' (DEFISIT)';
    netCardEl.classList.add('warning-glow');
  } else {
    netBalanceEl.style.color = '#16a34a';
    netCardEl.classList.remove('warning-glow');
  }

  // LOGIKA MICRO INSIGHT
  const insightContainer = document.getElementById('micro-insight-container');
  if (totalIncome === 0 && totalExpense === 0) {
    insightContainer.style.display = 'none'; // Sembunyikan jika tidak ada data
  } else {
    insightContainer.style.display = 'block';
    
    if (netBalance > 0) {
      insightContainer.className = 'micro-insight insight-positive';
      insightContainer.innerHTML = '<i class="fas fa-lightbulb"></i> Bagus! Pemasukanmu lebih besar dari pengeluaran bulan ini.';
    } else if (netBalance < 0) {
      insightContainer.className = 'micro-insight insight-negative';
      insightContainer.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Perhatian: Kamu belanja lebih besar dari penghasilan.';
    } else {
      insightContainer.className = 'micro-insight insight-neutral';
      insightContainer.innerHTML = '<i class="fas fa-balance-scale"></i> Arus kas kamu sangat seimbang (Titik impas).';
    }
  }
}

document.getElementById('period-filter').addEventListener('change', loadReport);

loadReport();