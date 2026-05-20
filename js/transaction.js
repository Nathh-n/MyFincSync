async function initTransactionForm() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const isIncome = window.location.href.includes('income');
  const transactionType = isIncome ? 'income' : 'expense';

  await loadWallets(user.id);
  await loadCategories(user.id, transactionType);
  setupFormSubmit(user.id, transactionType);
}

async function loadWallets(userId) {
  const { data } = await supabaseClient.from('wallets').select('id, name').eq('user_id', userId);
  const walletSelect = document.getElementById('wallet_id');
  walletSelect.innerHTML = '<option value="">Pilih Dompet</option>'; 
  if(data) data.forEach(w => walletSelect.innerHTML += `<option value="${w.id}">${w.name}</option>`);
}

async function loadCategories(userId, type) {
  const { data } = await supabaseClient.from('categories').select('id, name').eq('user_id', userId).eq('type', type);
  const categorySelect = document.getElementById('category_id');
  categorySelect.innerHTML = '<option value="">Pilih Kategori</option>';
  if(data) data.forEach(c => categorySelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);
}

function setupFormSubmit(userId, transactionType) {
  const formId = transactionType === 'income' ? 'income-form' : 'expense-form';
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('title').value;
    const amountStr = document.getElementById('amount').value.replace(/\./g, '');
    const amount = parseInt(amountStr);
    const transaction_date = document.getElementById('transaction_date').value;
    const wallet_id = document.getElementById('wallet_id').value;
    const category_id = document.getElementById('category_id').value;
    const description = document.getElementById('description').value;

    // Ambil saldo dompet saat ini
    const { data: walletData } = await supabaseClient.from('wallets').select('balance').eq('id', wallet_id).single();
    let currentBalance = walletData ? parseInt(walletData.balance) || 0 : 0;

    // FUNGSI INTI PENYIMPANAN
    const executeTransaction = async () => {
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
      btn.disabled = true;

      // 1. Simpan Transaksi
      const { error: txError } = await supabaseClient.from('transactions').insert([{
        user_id: userId, title, amount, type: transactionType, transaction_date, wallet_id, category_id, description
      }]);

      if (txError) {
        alert("Gagal menyimpan: " + txError.message);
        btn.innerHTML = originalText; btn.disabled = false; return;
      }

      // 2. Update Saldo Dompet
      let newBalance = transactionType === 'income' ? currentBalance + amount : currentBalance - amount;
      await supabaseClient.from('wallets').update({ balance: newBalance }).eq('id', wallet_id);

      window.location.href = 'dashboard.html';
    };

    // CEK LOGIKA SALDO MINUS
    if (transactionType === 'expense' && amount > currentBalance) {
      showCustomConfirm(`Saldo dompet saat ini hanya Rp ${new Intl.NumberFormat('id-ID').format(currentBalance)}.<br>Yakin ingin mencatat pengeluaran ini dan membuat saldo menjadi minus (hutang)?`, executeTransaction);
    } else {
      executeTransaction();
    }
  });
}

// SISTEM POP-UP KHUSUS TRANSAKSI
let confirmCallback = null;
function showCustomConfirm(message, callback) {
  const modalOverlay = document.getElementById('confirm-modal-overlay');
  if(!modalOverlay) {
    if(confirm(message.replace(/<br>/g, "\n"))) callback(); // Fallback aman jika pop-up tidak ada (cth: di income)
    return;
  }
  document.getElementById('confirm-message').innerHTML = message;
  confirmCallback = callback;
  modalOverlay.classList.add('active');
  document.getElementById('confirm-modal').classList.add('active');
}
function closeCustomConfirm(isConfirmed) {
  document.getElementById('confirm-modal-overlay').classList.remove('active');
  document.getElementById('confirm-modal').classList.remove('active');
  if (isConfirmed && confirmCallback) confirmCallback(); 
}
function formatRupiah(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

initTransactionForm();