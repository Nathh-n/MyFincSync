// =========================
// ADD WALLET (TAMBAH DOMPET)
// =========================
const walletForm = document.getElementById('wallet-form');

if (walletForm) {
  walletForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const wallet_name = document.getElementById('wallet_name').value;
    
    // HAPUS TITIK SEBELUM DISIMPAN
    const balanceStr = document.getElementById('wallet_balance').value.replace(/\./g, '');
    const wallet_balance = parseInt(balanceStr) || 0;

    const { data: { user } } = await supabaseClient.auth.getUser();

    // Efek Loading Tombol (Opsional UX)
    const btn = walletForm.querySelector('button[type="submit"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    const { error } = await supabaseClient
      .from('wallets')
      .insert([
        {
          user_id: user.id,
          name: wallet_name,
          balance: wallet_balance 
        }
      ]);

    // Kembalikan tombol seperti semula
    btn.innerHTML = originalContent;
    btn.disabled = false;

    if (error) {
      showCustomAlert('Gagal Menyimpan', error.message, 'error');
      return;
    }

    // PANGGIL POP-UP CUSTOM KITA!
    showCustomAlert('Berhasil!', 'Dompet baru berhasil ditambahkan.', 'success');
    
    walletForm.reset();
    getWallets(); 
  });
}

// =========================
// GET WALLETS (AMBIL DAFTAR DOMPET)
// =========================
async function getWallets() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.log(error.message);
    return;
  }

  renderWallets(data);
}

// =========================
// RENDER WALLETS (TAMPILKAN KE DASHBOARD)
// =========================
function renderWallets(wallets) {
  const walletContainer = document.getElementById('wallet-container');
  walletContainer.innerHTML = '';

  wallets.forEach((wallet) => {
    const formattedBalance = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(wallet.balance);

    const walletHTML = `
      <div class="wallet-card">
        <div class="wallet-info">
          <h3>${wallet.name}</h3>
          <p>${formattedBalance}</p>
        </div>
        <div class="wallet-actions">
          <button onclick="deleteWallet('${wallet.id}')">
            <i class="fas fa-trash"></i> Hapus
          </button>
        </div>
      </div>
    `;

    walletContainer.innerHTML += walletHTML;
  });
}

// =========================
// DELETE WALLET (HAPUS DOMPET)
// =========================
function deleteWallet(id) {
  // PANGGIL POP-UP CONFIRM KITA!
  showCustomConfirm('Yakin ingin menghapus dompet ini? Semua data terkait mungkin ikut terhapus.', async () => {
    
    // Jika user klik "Ya, Lanjutkan", kode di bawah ini tereksekusi
    const { error } = await supabaseClient
      .from('wallets')
      .delete()
      .eq('id', id);

    if (error) {
      showCustomAlert('Gagal', error.message, 'error');
      return;
    }

    showCustomAlert('Terhapus', 'Dompet berhasil dihapus dari sistem.', 'success');
    getWallets(); 
  });
}

// =========================
// INIT
// =========================
getWallets();