let goals = [];
let currentUserId = null;

// STATE UNTUK MODAL AKSI
let currentAction = null; // 'nabung', 'tarik', 'cairkan', 'hapus_refund'
let selectedGoalId = null;
let tempGoalData = {};

async function initGoals() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUserId = user.id;

  const { data, error } = await supabaseClient
    .from('savings_goals')
    .select('*')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false });

  if (!error && data) {
    goals = data;
    renderGoals();
  }
}

const formatRp = (num) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
};
function formatRupiah(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function renderGoals() {
  const container = document.getElementById('goals-container');
  container.innerHTML = '';

  if (goals.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px; border: 1px dashed var(--border); border-radius: 12px;">Belum ada target tabungan yang dibuat.</p>';
    return;
  }

  goals.forEach(goal => {
    let percentage = 0;
    if (goal.target > 0) {
      percentage = (goal.current / goal.target) * 100;
      if (percentage > 100) percentage = 100;
    }

    const isCompleted = percentage === 100;
    const barColor = isCompleted ? 'var(--green)' : '#0ea5e9'; 
    const statusText = isCompleted ? `<span style="color:var(--green); font-weight:600;"><i class="fas fa-check-circle"></i> Target Tercapai!</span>` : `<span style="color:var(--primary); font-weight:600;">${percentage.toFixed(1)}% Terkumpul</span>`;

    let buttonsHTML = '';
    if (isCompleted) {
      buttonsHTML = `
        <button onclick="liquidateGoal('${goal.id}', ${goal.current})" style="flex: 1; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 10px rgba(59,130,246,0.3);">
          <i class="fas fa-box-open"></i> Cairkan Tabungan
        </button>
        <button onclick="deleteGoal('${goal.id}', ${goal.current})" style="padding: 12px 16px; background: var(--red-light); color: var(--red); border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
          <i class="fas fa-trash"></i>
        </button>
      `;
    } else {
      buttonsHTML = `
        <button onclick="openActionNominal('${goal.id}', ${goal.current}, ${goal.target}, 'nabung')" style="flex: 1; padding: 10px; background: var(--green-light); color: var(--green); border: none; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;">
          <i class="fas fa-plus"></i> Nabung
        </button>
        <button onclick="openActionNominal('${goal.id}', ${goal.current}, ${goal.target}, 'tarik')" style="flex: 1; padding: 10px; background: #fef08a; color: #b45309; border: none; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;">
          <i class="fas fa-minus"></i> Tarik
        </button>
        <button onclick="deleteGoal('${goal.id}', ${goal.current})" style="padding: 10px 14px; background: var(--red-light); color: var(--red); border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
          <i class="fas fa-trash"></i>
        </button>
      `;
    }

    const html = `
      <div class="card" style="border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h3 style="font-size: 15px; color: var(--text-main); font-weight: 600;">${goal.name}</h3>
          <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">${formatRp(goal.current)} / ${formatRp(goal.target)}</span>
        </div>
        
        <div style="background: #f1f5f9; border-radius: 8px; height: 10px; width: 100%; overflow: hidden; margin-bottom: 12px;">
          <div style="height: 100%; border-radius: 8px; transition: width 0.4s ease; background: ${barColor}; width: ${percentage}%;"></div>
        </div>
        
        <div style="display:flex; justify-content: space-between; margin-bottom: 16px; font-size:12px;">
          ${statusText}
          <span style="color: var(--text-muted);">Sisa: ${formatRp(goal.target - goal.current)}</span>
        </div>

        <div style="display: flex; gap: 8px;">
          ${buttonsHTML}
        </div>
      </div>
    `;
    container.innerHTML += html;
  });
}

document.getElementById('goal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('goal_name').value;
  const target = parseInt(document.getElementById('goal_target').value.replace(/\./g, ''));
  let current = parseInt(document.getElementById('goal_current').value.replace(/\./g, '')) || 0;

  if (!target || target <= 0) {
    showCustomAlert("Peringatan", "Target nominal harus lebih dari 0!", "error"); return;
  }

  if (current > target) {
    showCustomAlert("Peringatan", "Uang terkumpul tidak boleh lebih dari target nominal!", "error"); return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; btn.disabled = true;

  const { error } = await supabaseClient.from('savings_goals').insert([{ user_id: currentUserId, name, target, current }]);
  if (error) { showCustomAlert("Gagal", error.message, "error"); } 
  else { e.target.reset(); document.getElementById('goal_current').value = '0'; showCustomAlert("Berhasil", "Target baru dibuat.", "success"); await initGoals(); }
  btn.innerHTML = originalText; btn.disabled = false;
});

function setupCustomDropdown(wrapperId, triggerId, textId, optionsId, inputId, dataList) {
  const wrapper = document.getElementById(wrapperId);
  const trigger = document.getElementById(triggerId);
  const optionsContainer = document.getElementById(optionsId);
  const hiddenInput = document.getElementById(inputId);

  const newTrigger = trigger.cloneNode(true);
  trigger.parentNode.replaceChild(newTrigger, trigger);
  const triggerText = document.getElementById(textId);

  newTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (wrapper && !wrapper.contains(e.target)) wrapper.classList.remove('open');
  });

  optionsContainer.innerHTML = '';
  hiddenInput.value = ''; hiddenInput.removeAttribute('data-balance'); triggerText.innerText = 'Pilih Dompet...';

  if (!dataList || dataList.length === 0) {
    optionsContainer.innerHTML = '<div class="custom-option">Tidak ada dompet</div>'; return;
  }

  dataList.forEach(wallet => {
    const formattedBalance = new Intl.NumberFormat('id-ID').format(wallet.balance);
    const optionEl = document.createElement('div');
    optionEl.className = 'custom-option';
    optionEl.innerHTML = `<span style="font-weight: 600;">${wallet.name}</span><span style="font-size: 12px; color: var(--text-muted);">Rp ${formattedBalance}</span>`;
    
    optionEl.addEventListener('click', () => {
      hiddenInput.value = wallet.id;
      hiddenInput.setAttribute('data-balance', wallet.balance);
      triggerText.innerText = wallet.name; 
      wrapper.classList.remove('open');
    });
    optionsContainer.appendChild(optionEl);
  });
}

async function fetchWallets() {
  const { data } = await supabaseClient.from('wallets').select('id, name, balance').eq('user_id', currentUserId);
  return data || [];
}

async function openActionNominal(id, currentAmt, targetAmt, actionType) {
  currentAction = actionType; selectedGoalId = id; tempGoalData = { currentAmt, targetAmt };
  document.getElementById('nominal_amount').value = '';
  
  const wallets = await fetchWallets();
  setupCustomDropdown('nominal-wallet-select', 'nominal-select-trigger', 'nominal-select-text', 'nominal-select-options', 'nominal_wallet_id', wallets);

  const titleEl = document.getElementById('nominal-modal-title');
  const descEl = document.getElementById('nominal-modal-desc');
  const labelEl = document.getElementById('nominal-wallet-label');
  const btnEl = document.getElementById('confirm-nominal-btn');
  const btnText = document.getElementById('nominal-btn-text');

  if (actionType === 'nabung') {
    titleEl.innerText = "Tambah Tabungan"; descEl.innerText = "Masukkan nominal yang ingin ditabung.";
    labelEl.innerText = "Ambil uang dari dompet:"; btnEl.style.background = "var(--green)"; btnText.innerText = "Nabung Sekarang";
  } else {
    titleEl.innerText = "Tarik Tabungan"; descEl.innerText = "Tarik uang dari tabungan untuk dikembalikan ke dompet.";
    labelEl.innerText = "Kembalikan uang ke dompet:"; btnEl.style.background = "#f59e0b"; btnText.innerText = "Tarik Sekarang";
  }
  
  document.getElementById('nominal-modal-overlay').classList.add('active');
  document.getElementById('nominal-modal').classList.add('active');
}

async function liquidateGoal(id, currentAmt) {
  currentAction = 'cairkan'; selectedGoalId = id; tempGoalData = { currentAmt };
  
  const wallets = await fetchWallets();
  setupCustomDropdown('full-wallet-select', 'full-select-trigger', 'full-select-text', 'full-select-options', 'full_wallet_id', wallets);

  document.getElementById('full-modal-title').innerText = "Cairkan Tabungan";
  document.getElementById('full-modal-desc').innerText = `Target Tercapai! Silakan pilih dompet untuk menerima pencairan dana sebesar ${formatRp(currentAmt)}.`;
  document.getElementById('confirm-full-btn').style.background = "var(--primary)";
  document.getElementById('full-btn-text').innerText = "Cairkan Sekarang";

  document.getElementById('full-action-modal-overlay').classList.add('active');
  document.getElementById('full-action-modal').classList.add('active');
}

function deleteGoal(id, currentAmt) {
  if (currentAmt > 0) {
    currentAction = 'hapus_refund'; selectedGoalId = id; tempGoalData = { currentAmt };
    
    fetchWallets().then(wallets => {
      setupCustomDropdown('full-wallet-select', 'full-select-trigger', 'full-select-text', 'full-select-options', 'full_wallet_id', wallets);
      document.getElementById('full-modal-title').innerText = "Hapus Target Berisi Saldo";
      document.getElementById('full-modal-desc').innerText = `Perhatian! Ada dana sebesar ${formatRp(currentAmt)} di target ini. Silakan pilih dompet untuk mengamankan uang tersebut sebelum target dihapus.`;
      document.getElementById('confirm-full-btn').style.background = "var(--red)";
      document.getElementById('full-btn-text').innerText = "Kembalikan & Hapus";
      
      document.getElementById('full-action-modal-overlay').classList.add('active');
      document.getElementById('full-action-modal').classList.add('active');
    });
  } else {
    showCustomConfirm("Yakin ingin menghapus target kosong ini?", async () => {
      await supabaseClient.from('savings_goals').delete().eq('id', id);
      showCustomAlert("Terhapus", "Target berhasil dihapus.", "success");
      initGoals();
    });
  }
}

function closeActionModals() {
  document.getElementById('nominal-modal-overlay').classList.remove('active');
  document.getElementById('nominal-modal').classList.remove('active');
  document.getElementById('full-action-modal-overlay').classList.remove('active');
  document.getElementById('full-action-modal').classList.remove('active');
}

document.getElementById('confirm-nominal-btn').addEventListener('click', async () => {
  const walletId = document.getElementById('nominal_wallet_id').value;
  const amount = parseInt(document.getElementById('nominal_amount').value.replace(/\./g, ''));
  const currentWalletBalance = parseInt(document.getElementById('nominal_wallet_id').getAttribute('data-balance'));

  if (!walletId) { showCustomAlert("Peringatan", "Pilih dompet terlebih dahulu!", "error"); return; }
  if (isNaN(amount) || amount <= 0) { showCustomAlert("Peringatan", "Masukkan nominal yang valid!", "error"); return; }

  let newGoalCurrent, newWalletBalance;
  const goalObj = goals.find(g => g.id === selectedGoalId);
  const goalName = goalObj ? goalObj.name : 'Target Tabungan';

  if (currentAction === 'nabung') {
    const sisaTarget = tempGoalData.targetAmt - tempGoalData.currentAmt;
    if (amount > sisaTarget) {
        showCustomAlert("Peringatan", `Nominal terlalu besar! Maksimal uang yang bisa ditabung adalah Rp ${new Intl.NumberFormat('id-ID').format(sisaTarget)}.`, "error");
        return;
    }
    if (amount > currentWalletBalance) { showCustomAlert("Peringatan", "Saldo dompet tidak mencukupi!", "error"); return; }
    
    newGoalCurrent = tempGoalData.currentAmt + amount;
    newWalletBalance = currentWalletBalance - amount; 
  } else if (currentAction === 'tarik') {
    if (amount > tempGoalData.currentAmt) { showCustomAlert("Peringatan", "Nominal tarik melebihi isi tabungan!", "error"); return; }
    newGoalCurrent = tempGoalData.currentAmt - amount;
    newWalletBalance = currentWalletBalance + amount; 
  }

  const btn = document.getElementById('confirm-nominal-btn');
  const ogText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...'; btn.disabled = true;

  await supabaseClient.from('wallets').update({ balance: newWalletBalance }).eq('id', walletId);
  await supabaseClient.from('savings_goals').update({ current: newGoalCurrent }).eq('id', selectedGoalId);

  // KUNCI UPDATE: type diubah jadi 'transfer'
  const txDate = new Date().toISOString().split('T')[0];
  await supabaseClient.from('transactions').insert([{
    user_id: currentUserId,
    title: currentAction === 'nabung' ? `Nabung: ${goalName}` : `Tarik Tabungan: ${goalName}`,
    amount: amount,
    type: 'transfer', 
    transaction_date: txDate,
    wallet_id: walletId,
    description: 'Sistem Target Tabungan'
  }]);

  btn.innerHTML = ogText; btn.disabled = false; closeActionModals();
  showCustomAlert("Berhasil", "Transaksi tabungan berhasil diproses!", "success");
  initGoals();
});

document.getElementById('confirm-full-btn').addEventListener('click', async () => {
  const walletId = document.getElementById('full_wallet_id').value;
  const currentWalletBalance = parseInt(document.getElementById('full_wallet_id').getAttribute('data-balance'));

  if (!walletId) { showCustomAlert("Peringatan", "Pilih dompet penerima dana terlebih dahulu!", "error"); return; }

  const btn = document.getElementById('confirm-full-btn');
  const ogText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...'; btn.disabled = true;

  const goalObj = goals.find(g => g.id === selectedGoalId);
  const goalName = goalObj ? goalObj.name : 'Target Tabungan';

  const newWalletBalance = currentWalletBalance + tempGoalData.currentAmt;
  await supabaseClient.from('wallets').update({ balance: newWalletBalance }).eq('id', walletId);
  await supabaseClient.from('savings_goals').delete().eq('id', selectedGoalId);

  // KUNCI UPDATE: type diubah jadi 'transfer'
  const txDate = new Date().toISOString().split('T')[0];
  await supabaseClient.from('transactions').insert([{
    user_id: currentUserId,
    title: currentAction === 'cairkan' ? `Cairkan Target: ${goalName}` : `Refund Target: ${goalName}`,
    amount: tempGoalData.currentAmt,
    type: 'transfer',
    transaction_date: txDate,
    wallet_id: walletId,
    description: 'Pencairan sistem Target Tabungan'
  }]);

  btn.innerHTML = ogText; btn.disabled = false; closeActionModals();
  showCustomAlert("Berhasil", "Tabungan berhasil diproses dan target dihapus!", "success");
  initGoals();
});

function showCustomAlert(title, message, type = 'success') {
  document.getElementById('alert-title').innerText = title; document.getElementById('alert-message').innerText = message;
  const iconEl = document.getElementById('alert-icon');
  if(type === 'success') { iconEl.innerHTML = '<i class="fas fa-check-circle"></i>'; iconEl.style.color = 'var(--green)'; } 
  else { iconEl.innerHTML = '<i class="fas fa-times-circle"></i>'; iconEl.style.color = 'var(--red)'; }
  document.getElementById('alert-modal-overlay').classList.add('active'); document.getElementById('alert-modal').classList.add('active');
}
function closeCustomAlert() { document.getElementById('alert-modal-overlay').classList.remove('active'); document.getElementById('alert-modal').classList.remove('active'); }
let confirmCallback = null;
function showCustomConfirm(message, callback) { document.getElementById('confirm-message').innerText = message; confirmCallback = callback; document.getElementById('confirm-modal-overlay').classList.add('active'); document.getElementById('confirm-modal').classList.add('active'); }
function closeCustomConfirm(isConfirmed) { document.getElementById('confirm-modal-overlay').classList.remove('active'); document.getElementById('confirm-modal').classList.remove('active'); if (isConfirmed && confirmCallback) confirmCallback(); }

initGoals();