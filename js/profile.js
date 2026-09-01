let profileUser = null;

function openSheet(id) {
  const sheet = document.getElementById(id);
  if (!sheet) return;
  document.getElementById('sheet-overlay').classList.add('active');
  sheet.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  document.getElementById('sheet-overlay').classList.remove('active');
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('active'));
  document.body.style.overflow = '';
}

async function initProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  profileUser = user;

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pengguna';
  const email = user.email || '-';

  document.getElementById('profile-name').innerText = name;
  document.getElementById('profile-email').innerText = email;
  document.getElementById('profile_new_name').value = name;

  document.getElementById('avatar-initial').innerText = name.charAt(0).toUpperCase();

  const createdAt = user.created_at ? new Date(user.created_at) : null;
  if (createdAt) {
    const formatted = createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('profile-since').innerHTML = `<i class="fas fa-calendar-alt"></i> Member sejak ${formatted}`;
  }

  await loadProfileStats(user.id);
}

async function loadProfileStats(userId) {
  const [walletsRes, goalsRes, plansRes, trxRes] = await Promise.all([
    supabaseClient.from('wallets').select('id').eq('user_id', userId),
    supabaseClient.from('savings_goals').select('id').eq('user_id', userId),
    supabaseClient.from('budget_plans').select('id').eq('user_id', userId),
    supabaseClient.from('transactions').select('id').eq('user_id', userId)
      .in('type', ['income', 'expense'])
      .gte('transaction_date', getFirstDayOfMonth())
  ]);

  document.getElementById('stat-wallet-count').innerText = (walletsRes.data || []).length;
  document.getElementById('stat-goal-count').innerText = (goalsRes.data || []).length;
  document.getElementById('stat-plan-count').innerText = (plansRes.data || []).length;
  document.getElementById('stat-trx-count').innerText = (trxRes.data || []).length;
}

function getFirstDayOfMonth() {
  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = localDate.getTimezoneOffset();
  return new Date(localDate.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
}

document.getElementById('profile-name-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const newName = document.getElementById('profile_new_name').value.trim();
  if (!newName) {
    showCustomAlert("Peringatan", "Nama tidak boleh kosong!", "error");
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
  btn.disabled = true;

  const { error } = await supabaseClient.auth.updateUser({
    data: { full_name: newName }
  });

  btn.innerHTML = originalText;
  btn.disabled = false;

  if (error) {
    showCustomAlert("Gagal", "Gagal mengubah nama: " + error.message, "error");
    return;
  }

  document.getElementById('profile-name').innerText = newName;
  document.getElementById('avatar-initial').innerText = newName.charAt(0).toUpperCase();
  closeSheet();
  showCustomAlert("Berhasil", "Nama berhasil diperbarui.", "success");
});

document.getElementById('profile-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const newPassword = document.getElementById('profile_new_password').value;
  const confirmPassword = document.getElementById('profile_confirm_password').value;

  if (newPassword.length < 6) {
    showCustomAlert("Peringatan", "Password harus minimal 6 karakter!", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showCustomAlert("Peringatan", "Konfirmasi password tidak cocok!", "error");
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
  btn.disabled = true;

  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

  btn.innerHTML = originalText;
  btn.disabled = false;

  if (error) {
    showCustomAlert("Gagal", "Gagal mengubah password: " + error.message, "error");
    return;
  }

  e.target.reset();
  closeSheet();
  showCustomAlert("Berhasil", "Password berhasil diubah.", "success");
});

function confirmLogout() {
  showCustomConfirm("Yakin ingin keluar dari akun?", async () => {
    await logout();
  });
}

function formatRupiah(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// =========================
// KELOLA DOMPET (dari Profile)
// =========================
async function loadManageWallets() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data } = await supabaseClient
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  renderManageWallets(data || []);
}

function renderManageWallets(wallets) {
  const container = document.getElementById('profile-wallet-list');
  if (!container) return;
  container.innerHTML = '';

  if (wallets.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 16px; border: 1px dashed var(--border); border-radius: 12px;">Belum ada dompet.</p>';
    return;
  }

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  wallets.forEach(wallet => {
    container.innerHTML += `
      <div class="manage-item">
        <div>
          <h4>${wallet.name}</h4>
          <p class="manage-amount">${formatRp(wallet.balance)}</p>
        </div>
        <button class="btn-delete-small" onclick="deleteManageWallet('${wallet.id}')">
          <i class="fas fa-trash"></i> Hapus
        </button>
      </div>
    `;
  });
}

function deleteManageWallet(id) {
  showCustomConfirm('PERINGATAN KERAS!<br>Menghapus dompet ini akan <b>MENGHAPUS SEMUA riwayat transaksi</b> yang menggunakan dompet ini.<br>Yakin ingin melanjutkan?', async () => {
    const { error } = await supabaseClient.from('wallets').delete().eq('id', id);
    if (error) {
      showCustomAlert("Gagal", error.message, "error");
      return;
    }
    showCustomAlert("Terhapus", "Dompet dan seluruh riwayatnya telah dihapus.", "success");
    loadManageWallets();
    loadProfileStats(profileUser.id);
  });
}

// =========================
// KELOLA KATEGORI (dari Profile)
// =========================
async function loadManageCategories() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data } = await supabaseClient
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  renderManageCategories(data || []);
}

function renderManageCategories(categories) {
  const incomeContainer = document.getElementById('profile-income-category-container');
  const expenseContainer = document.getElementById('profile-expense-category-container');
  if (incomeContainer) incomeContainer.innerHTML = '';
  if (expenseContainer) expenseContainer.innerHTML = '';

  categories.forEach(category => {
    const html = `
      <div class="category-item">
        <span>${category.name}</span>
        <button onclick="deleteManageCategory('${category.id}')" title="Hapus Kategori"><i class="fas fa-times"></i></button>
      </div>
    `;
    if (category.type === 'income' && incomeContainer) incomeContainer.innerHTML += html;
    else if (category.type === 'expense' && expenseContainer) expenseContainer.innerHTML += html;
  });

  if (incomeContainer && incomeContainer.innerHTML === '') {
    incomeContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px; border: 1px dashed var(--border); border-radius: 8px;">Belum ada kategori pemasukan.</p>';
  }
  if (expenseContainer && expenseContainer.innerHTML === '') {
    expenseContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px; border: 1px dashed var(--border); border-radius: 8px;">Belum ada kategori pengeluaran.</p>';
  }
}

function deleteManageCategory(id) {
  showCustomConfirm('PERINGATAN!<br>Menghapus kategori ini juga akan <b>MENGHAPUS SEMUA riwayat transaksi</b> yang menggunakan kategori ini.<br>Yakin ingin menghapus?', async () => {
    const { error } = await supabaseClient.from('categories').delete().eq('id', id);
    if (error) {
      showCustomAlert("Gagal", error.message, "error");
      return;
    }
    showCustomAlert("Terhapus", "Kategori dan seluruh riwayatnya telah dihapus.", "success");
    loadManageCategories();
  });
}

// =========================
// SISTEM POP-UP GLOBAL (lokal untuk halaman profile)
// =========================
function showCustomAlert(title, message, type = 'success') {
  document.getElementById('alert-title').innerText = title;
  document.getElementById('alert-message').innerText = message;
  const iconEl = document.getElementById('alert-icon');

  if (type === 'success') {
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
    confirmCallback();
  }
}

// =========================
// FORM KELOLA DOMPET
// =========================
const profileWalletForm = document.getElementById('profile-wallet-form');
if (profileWalletForm) {
  profileWalletForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const name = document.getElementById('profile_wallet_name').value;
    const balanceStr = document.getElementById('profile_wallet_balance').value.replace(/\./g, '');
    const balance = parseInt(balanceStr) || 0;

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    const { error } = await supabaseClient.from('wallets').insert([{ user_id: user.id, name, balance }]);

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (error) {
      showCustomAlert("Gagal", error.message, "error");
      return;
    }

    showCustomAlert("Berhasil", "Dompet baru ditambahkan.", "success");
    e.target.reset();
    loadManageWallets();
    loadProfileStats(user.id);
  });
}

// =========================
// FORM KELOLA KATEGORI
// =========================
const profileCategoryForm = document.getElementById('profile-category-form');
if (profileCategoryForm) {
  profileCategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const name = document.getElementById('profile_category_name').value;
    const type = document.getElementById('profile_category_type').value;

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    const { error } = await supabaseClient.from('categories').insert([{ user_id: user.id, name, type }]);

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (error) {
      showCustomAlert("Gagal", error.message, "error");
      return;
    }

    showCustomAlert("Berhasil", "Kategori baru ditambahkan.", "success");
    e.target.reset();
    loadManageCategories();
  });
}

initProfile();
loadManageWallets();
loadManageCategories();
