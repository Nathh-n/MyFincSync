async function initTransferForm() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { window.location.href = 'login.html'; return; }

  await loadWallets(user.id);
  setupFormSubmit(user.id);
}

async function loadWallets(userId) {
  const { data } = await supabaseClient.from('wallets').select('id, name, balance').eq('user_id', userId);
  const sourceSelect = document.getElementById('source_wallet_id');
  const destSelect = document.getElementById('dest_wallet_id');
  
  if (data) {
    data.forEach(w => {
      sourceSelect.innerHTML += `<option value="${w.id}" data-balance="${w.balance}">${w.name} (Rp ${new Intl.NumberFormat('id-ID').format(w.balance)})</option>`;
      destSelect.innerHTML += `<option value="${w.id}">${w.name}</option>`;
    });
  }
}

function setupFormSubmit(userId) {
  const form = document.getElementById('transfer-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amountStr = document.getElementById('amount').value.replace(/\./g, '');
    const amount = Number(amountStr);
    const adminStr = document.getElementById('admin_fee').value.replace(/\./g, '');
    const adminFee = Number(adminStr) || 0;
    
    const sourceSelect = document.getElementById('source_wallet_id');
    const destSelect = document.getElementById('dest_wallet_id');
    const sourceId = sourceSelect.value;
    const destId = destSelect.value;
    const sourceName = sourceSelect.options[sourceSelect.selectedIndex].text.split(' (')[0];
    const destName = destSelect.options[destSelect.selectedIndex].text;
    
    const transaction_date = document.getElementById('transaction_date').value;
    const description = document.getElementById('description').value || 'Transfer Internal';

    if (sourceId === destId) {
      showCustomAlert("Gagal", "Dompet asal dan tujuan tidak boleh sama!", "error"); return;
    }
    if (isNaN(amount) || amount <= 0) {
      showCustomAlert("Gagal", "Masukkan jumlah transfer yang valid!", "error"); return;
    }

    const currentSourceBalance = Number(sourceSelect.options[sourceSelect.selectedIndex].getAttribute('data-balance'));
    const totalDeduction = amount + adminFee;

    if (totalDeduction > currentSourceBalance) {
      showCustomAlert("Gagal", `Saldo dompet asal tidak cukup! Total yang ditarik (termasuk admin) adalah Rp ${new Intl.NumberFormat('id-ID').format(totalDeduction)}.`, "error"); return;
    }

    const confirmMessage = `Yakin ingin mentransfer <b>Rp ${new Intl.NumberFormat('id-ID').format(amount)}</b> dari <b>${sourceName}</b> ke <b>${destName}</b>?${adminFee > 0 ? `<br>Biaya admin: <b>Rp ${new Intl.NumberFormat('id-ID').format(adminFee)}</b>` : ''}`;

    showCustomConfirm(confirmMessage, async () => {
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;

    // Ambil saldo dompet tujuan
    const { data: destData } = await supabaseClient.from('wallets').select('balance').eq('id', destId).single();
    let currentDestBalance = destData ? Number(destData.balance) || 0 : 0;

    // 1. UPDATE SALDO DOMPET
    const newSourceBalance = currentSourceBalance - totalDeduction;
    const newDestBalance = currentDestBalance + amount;

    await supabaseClient.from('wallets').update({ balance: newSourceBalance }).eq('id', sourceId);
    await supabaseClient.from('wallets').update({ balance: newDestBalance }).eq('id', destId);

    // 2. CATAT TRANSAKSI (Jejak Audit)
    const txRecords = [];
    
    // Transaksi Keluar
    txRecords.push({
      user_id: userId, title: `Transfer ke ${destName}`, amount: amount, type: 'transfer', 
      transaction_date, wallet_id: sourceId, description
    });
    
    // Transaksi Masuk
    txRecords.push({
      user_id: userId, title: `Terima dari ${sourceName}`, amount: amount, type: 'transfer', 
      transaction_date, wallet_id: destId, description
    });

    // Transaksi Admin (Jika ada)
    if (adminFee > 0) {
      txRecords.push({
        user_id: userId, title: `Biaya Admin Transfer`, amount: adminFee, type: 'expense', 
        transaction_date, wallet_id: sourceId, description: `Admin transfer ke ${destName}`
      });
    }

    await supabaseClient.from('transactions').insert(txRecords);

    window.location.href = 'dashboard.html';
    });
  });
}

initTransferForm();