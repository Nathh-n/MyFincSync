const walletForm = document.getElementById('wallet-form');

if (walletForm) {
  walletForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wallet_name = document.getElementById('wallet_name').value;
    const balanceStr = document.getElementById('wallet_balance').value.replace(/\./g, '');
    const wallet_balance = parseInt(balanceStr) || 0;
    const { data: { user } } = await supabaseClient.auth.getUser();

    const btn = walletForm.querySelector('button[type="submit"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    const { error } = await supabaseClient.from('wallets').insert([{ user_id: user.id, name: wallet_name, balance: wallet_balance }]);
    btn.innerHTML = originalContent; btn.disabled = false;

    if (error) { showCustomAlert('Gagal Menyimpan', error.message, 'error'); return; }
    showCustomAlert('Berhasil!', 'Dompet baru ditambahkan.', 'success');
    walletForm.reset(); getWallets();
    loadSummary(); // Refresh dashboard data
    loadRecentTransactions();
  });
}

async function getWallets() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const { data } = await supabaseClient.from('wallets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (data) renderWallets(data);
}

function renderWallets(wallets) {
  const walletContainer = document.getElementById('wallet-container');
  walletContainer.innerHTML = '';

  if (!wallets || wallets.length === 0) {
    walletContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px; border: 1px dashed var(--border); border-radius: 12px;">Belum ada dompet. Kelola dompet dari halaman Profile.</p>';
    return;
  }

  wallets.forEach((wallet) => {
    const formattedBalance = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(wallet.balance);
    walletContainer.innerHTML += `
      <div class="wallet-card">
        <div class="wallet-info"><h3>${wallet.name}</h3><p>${formattedBalance}</p></div>
      </div>
    `;
  });
}

function deleteWallet(id) {
  // PERBAIKAN LOGIKA DOMINO
  showCustomConfirm('PERINGATAN KERAS!<br>Menghapus dompet ini akan <b>MENGHAPUS SEMUA riwayat transaksi</b> yang menggunakan dompet ini.<br>Yakin ingin melanjutkan?', async () => {
    const { error } = await supabaseClient.from('wallets').delete().eq('id', id);
    if (error) { showCustomAlert('Gagal', error.message, 'error'); return; }
    showCustomAlert('Terhapus', 'Dompet dan seluruh riwayatnya telah dihapus.', 'success');
    getWallets(); 
    loadSummary(); // Refresh dashboard data
    loadRecentTransactions();
  });
}

getWallets();