const walletForm = document.getElementById('wallet-form');

if (walletForm) {
  walletForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const wallet_name = document.getElementById('wallet_name').value;
    const balanceStr = document.getElementById('wallet_balance').value.replace(/\./g, '');
    const wallet_balance = Number(balanceStr) || 0;
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

let currentWallets = [];
let walletSortMode = 'asc';

async function getWallets() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const { data } = await supabaseClient.from('wallets').select('*').eq('user_id', user.id);
  if (data) {
    currentWallets = data;
    renderWallets(sortWallets(currentWallets));
  }
}

function sortWallets(wallets) {
  const arr = [...wallets];
  if (walletSortMode === 'asc') {
    arr.sort((a, b) => Number(a.balance) - Number(b.balance));
  } else if (walletSortMode === 'desc') {
    arr.sort((a, b) => Number(b.balance) - Number(a.balance));
  } else {
    arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return arr;
}

function setWalletSort(mode, chip) {
  walletSortMode = mode;
  document.querySelectorAll('#wallet-sort-chips .sort-chip').forEach(c => c.classList.remove('active'));
  if (chip) chip.classList.add('active');
  renderWallets(sortWallets(currentWallets));
}

function renderWallets(wallets) {
  const walletContainer = document.getElementById('wallet-container');
  walletContainer.innerHTML = '';

  if (!wallets || wallets.length === 0) {
    showEmptyState(walletContainer, 'fa-wallet', 'Belum ada dompet. Kelola dompet dari halaman Profile.');
    return;
  }

  wallets.forEach((wallet) => {
    const formattedBalance = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(wallet.balance);
    walletContainer.innerHTML += `
      <div class="wallet-card">
        <div class="wallet-info"><h3>${escapeHTML(wallet.name)}</h3><p>${formattedBalance}</p></div>
      </div>
    `;
  });
}

getWallets();