async function initTransactionForm() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Gunakan href dan cukup cari kata 'income'. 
  // Ini mencegah error jika Netlify/Live Server menghilangkan akhiran .html di link-nya.
  const isIncome = window.location.href.includes('income');
  const transactionType = isIncome ? 'income' : 'expense';

  await loadWallets(user.id);
  await loadCategories(user.id, transactionType);
  
  setupFormSubmit(user.id, transactionType);
}

async function loadWallets(userId) {
  const { data, error } = await supabaseClient
    .from('wallets')
    .select('id, name')
    .eq('user_id', userId);

  if (error) {
    console.error("Error loading wallets:", error);
    return;
  }

  const walletSelect = document.getElementById('wallet_id');
  walletSelect.innerHTML = '<option value="">Pilih Dompet</option>'; 
  
  data.forEach(wallet => {
    walletSelect.innerHTML += `<option value="${wallet.id}">${wallet.name}</option>`;
  });
}

async function loadCategories(userId, type) {
  // Hanya panggil kategori yang tipenya sesuai (income / expense)
  const { data, error } = await supabaseClient
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('type', type);

  if (error) {
    console.error("Error loading categories:", error);
    return;
  }

  const categorySelect = document.getElementById('category_id');
  categorySelect.innerHTML = '<option value="">Pilih Kategori</option>';
  
  data.forEach(category => {
    categorySelect.innerHTML += `<option value="${category.id}">${category.name}</option>`;
  });
}

function setupFormSubmit(userId, transactionType) {
  // Pastikan form yang dipilih sesuai dengan halaman
  const formId = transactionType === 'income' ? 'income-form' : 'expense-form';
  const form = document.getElementById(formId);

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    const title = document.getElementById('title').value;
    
    // Hapus titik pemisah ribuan sebelum disimpan ke database
    const amountStr = document.getElementById('amount').value.replace(/\./g, '');
    const amount = parseInt(amountStr);
    
    const transaction_date = document.getElementById('transaction_date').value;
    const wallet_id = document.getElementById('wallet_id').value;
    const category_id = document.getElementById('category_id').value;
    const description = document.getElementById('description').value;

    // ==========================================
    // 1. SIMPAN DATA KE TABEL TRANSACTIONS
    // ==========================================
    const { error: txError } = await supabaseClient
      .from('transactions')
      .insert([{
        user_id: userId,
        title,
        amount: amount, 
        type: transactionType,
        transaction_date,
        wallet_id,
        category_id,
        description
      }]);

    if (txError) {
      alert("Gagal menyimpan transaksi: " + txError.message);
      btn.innerHTML = originalText;
      btn.disabled = false;
      return;
    }

    // ==========================================
    // 2. UPDATE SALDO DOMPET KE TABEL WALLETS
    // ==========================================
    // Ambil dulu saldo dompet saat ini dari database
    const { data: walletData, error: walletError } = await supabaseClient
      .from('wallets')
      .select('balance')
      .eq('id', wallet_id)
      .single();

    if (!walletError && walletData) {
      let currentBalance = parseInt(walletData.balance) || 0;
      
      // Jika Pemasukan, saldo dompet ditambah. Jika Pengeluaran, dikurang.
      let newBalance = transactionType === 'income' ? currentBalance + amount : currentBalance - amount;

      // Update nilai balance baru ke database dompet
      await supabaseClient
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallet_id);
    }

    // Jika sukses, langsung kembalikan ke dashboard
    window.location.href = 'dashboard.html';
  });
}

// Jalankan form
initTransactionForm();

// Fungsi untuk titik otomatis format uang (Rupiah)
function formatRupiah(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}