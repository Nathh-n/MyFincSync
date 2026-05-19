let goals = [];
let selectedGoalId = null;
let currentUserId = null;
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

document.getElementById('goal-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('goal_name').value;
  const targetStr = document.getElementById('goal_target').value.replace(/\./g, '');
  const target = parseInt(targetStr);
  const currentStr = document.getElementById('goal_current').value.replace(/\./g, '');
  let current = parseInt(currentStr) || 0;

  if (current > target) {
    showCustomAlert("Peringatan", "Uang terkumpul tidak boleh lebih dari target nominal!", "error");
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
  btn.disabled = true;

  const { error } = await supabaseClient
    .from('savings_goals')
    .insert([{ user_id: currentUserId, name, target, current }]);

  if (error) {
    showCustomAlert("Gagal", "Gagal membuat target: " + error.message, "error");
  } else {
    e.target.reset();
    document.getElementById('goal_current').value = '0';
    showCustomAlert("Berhasil", "Target tabungan baru berhasil dibuat.", "success");
    await initGoals(); 
  }

  btn.innerHTML = originalText;
  btn.disabled = false;
});

function renderGoals() {
  const container = document.getElementById('goals-container');
  container.innerHTML = '';

  const formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  if (goals.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px; border: 1px dashed var(--border); border-radius: 12px;">Belum ada target tabungan yang dibuat.</p>';
    return;
  }

  goals.forEach(goal => {
    let percentage = (goal.current / goal.target) * 100;
    if (percentage > 100) percentage = 100; 

    const isCompleted = percentage === 100;
    const barColor = isCompleted ? 'var(--green)' : '#0ea5e9'; 
    const statusText = isCompleted ? '<span style="color:var(--green); font-weight:600;"><i class="fas fa-check-circle"></i> Target Tercapai!</span>' : `<span style="color:var(--primary); font-weight:600;">${percentage.toFixed(1)}% Terkumpul</span>`;

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

        <div style="display: flex; gap: 10px;">
          <button onclick="addFund('${goal.id}', ${goal.current}, ${goal.target})" style="flex: 1; padding: 12px; background: var(--green-light); color: var(--green); border: none; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;">
            <i class="fas fa-coins"></i> Nabung
          </button>
          <button onclick="deleteGoal('${goal.id}')" style="padding: 12px 16px; background: var(--red-light); color: var(--red); border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    
    container.innerHTML += html;
  });
}

// =========================
// LOGIKA CUSTOM DROPDOWN DOMPET
// =========================
const customSelectWrapper = document.getElementById('custom-wallet-select');
const customSelectTrigger = document.getElementById('custom-select-trigger');

// Buka/Tutup Dropdown saat diklik
customSelectTrigger.addEventListener('click', function(e) {
  e.stopPropagation(); // Mencegah dropdown langsung tertutup
  customSelectWrapper.classList.toggle('open');
});

// Tutup dropdown jika klik di luar area dropdown
document.addEventListener('click', function(e) {
  if (customSelectWrapper && !customSelectWrapper.contains(e.target)) {
    customSelectWrapper.classList.remove('open');
  }
});

async function loadWalletsForNabung() {
  const { data, error } = await supabaseClient
    .from('wallets')
    .select('id, name, balance')
    .eq('user_id', currentUserId);

  const optionsContainer = document.getElementById('custom-select-options');
  const hiddenInput = document.getElementById('nabung_wallet_id');
  const triggerText = document.getElementById('custom-select-text');

  // Reset tampilan bawaan
  optionsContainer.innerHTML = '';
  hiddenInput.value = '';
  hiddenInput.removeAttribute('data-balance');
  triggerText.innerText = 'Pilih Sumber Dompet';

  if (!error && data) {
    if (data.length === 0) {
      optionsContainer.innerHTML = '<div class="custom-option">Tidak ada dompet tersedia</div>';
      return;
    }

    data.forEach(wallet => {
      const formattedBalance = new Intl.NumberFormat('id-ID').format(wallet.balance);
      const optionEl = document.createElement('div');
      optionEl.className = 'custom-option';
      
      // Isi desain tiap list dompet
      optionEl.innerHTML = `
        <span style="font-weight: 600;">${wallet.name}</span>
        <span style="font-size: 12px; color: var(--text-muted);">Rp ${formattedBalance}</span>
      `;

      // Jika opsi dipilih
      optionEl.addEventListener('click', () => {
        hiddenInput.value = wallet.id;
        hiddenInput.setAttribute('data-balance', wallet.balance);
        triggerText.innerText = wallet.name;
        customSelectWrapper.classList.remove('open');
      });

      optionsContainer.appendChild(optionEl);
    });
  }
}

async function addFund(id, currentAmt, targetAmt) {
  selectedGoalId = id; 
  tempGoalData = { currentAmt, targetAmt };
  document.getElementById('nabung_amount').value = ''; 
  
  await loadWalletsForNabung();
  
  document.getElementById('nabung-modal-overlay').classList.add('active');
  document.getElementById('nabung-modal').classList.add('active');
}

function closeNabungModal() {
  selectedGoalId = null;
  document.getElementById('nabung-modal-overlay').classList.remove('active');
  document.getElementById('nabung-modal').classList.remove('active');
  customSelectWrapper.classList.remove('open'); // Tutup juga dropdown jika terbuka
}

document.getElementById('close-modal-btn').addEventListener('click', closeNabungModal);
document.getElementById('nabung-modal-overlay').addEventListener('click', closeNabungModal);

document.getElementById('confirm-nabung-btn').addEventListener('click', async () => {
  if (!selectedGoalId) return;

  const hiddenInput = document.getElementById('nabung_wallet_id');
  const selectedWalletId = hiddenInput.value;
  
  if (!selectedWalletId) {
    showCustomAlert("Peringatan", "Pilih dompet sumber uang terlebih dahulu!", "error");
    return;
  }

  const amountStr = document.getElementById('nabung_amount').value.replace(/\./g, '');
  const amount = parseInt(amountStr);

  if (isNaN(amount) || amount <= 0) {
    showCustomAlert("Peringatan", "Masukkan nominal yang valid!", "error");
    return;
  }

  // Cek saldo dengan mengambil atribut yang kita simpan saat milih
  const currentWalletBalance = parseInt(hiddenInput.getAttribute('data-balance'));

  if (amount > currentWalletBalance) {
    showCustomAlert("Peringatan", "Saldo dompet tidak mencukupi untuk ditabung!", "error");
    return;
  }

  let newCurrent = tempGoalData.currentAmt + amount;
  if (newCurrent > tempGoalData.targetAmt) newCurrent = tempGoalData.targetAmt;

  const btn = document.getElementById('confirm-nabung-btn');
  const originalBtnText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  btn.disabled = true;

  // Potong Saldo Dompet
  const newWalletBalance = currentWalletBalance - amount;
  const { error: walletError } = await supabaseClient
    .from('wallets')
    .update({ balance: newWalletBalance })
    .eq('id', selectedWalletId);

  if (walletError) {
    showCustomAlert("Gagal", "Sistem gagal memotong saldo dompet: " + walletError.message, "error");
    btn.innerHTML = originalBtnText;
    btn.disabled = false;
    return;
  }

  // Tambah Saldo Tabungan
  const { error: goalError } = await supabaseClient
    .from('savings_goals')
    .update({ current: newCurrent })
    .eq('id', selectedGoalId);

  btn.innerHTML = originalBtnText;
  btn.disabled = false;

  if (!goalError) {
    showCustomAlert("Berhasil", "Tabungan ditambahkan dan uang telah dipotong dari dompetmu!", "success");
    await initGoals(); 
    closeNabungModal(); 
  } else {
    showCustomAlert("Gagal", "Gagal menambah tabungan: " + goalError.message, "error");
  }
});

function deleteGoal(id) {
  showCustomConfirm("Yakin ingin menghapus target ini?", async () => {
    const { error } = await supabaseClient
      .from('savings_goals')
      .delete()
      .eq('id', id);

    if (!error) {
      showCustomAlert("Terhapus", "Target berhasil dihapus.", "success");
      initGoals(); 
    } else {
      showCustomAlert("Gagal", error.message, "error");
    }
  });
}

// =========================
// SISTEM POP-UP GLOBAL
// =========================
function showCustomAlert(title, message, type = 'success') {
  document.getElementById('alert-title').innerText = title;
  document.getElementById('alert-message').innerText = message;
  const iconEl = document.getElementById('alert-icon');
  
  if(type === 'success') {
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

initGoals();

function formatRupiah(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}