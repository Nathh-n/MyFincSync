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

function addFund(id, currentAmt, targetAmt) {
  selectedGoalId = id; 
  tempGoalData = { currentAmt, targetAmt };
  document.getElementById('nabung_amount').value = ''; 
  
  document.getElementById('nabung-modal-overlay').classList.add('active');
  document.getElementById('nabung-modal').classList.add('active');
  
  setTimeout(() => document.getElementById('nabung_amount').focus(), 100); 
}

function closeNabungModal() {
  selectedGoalId = null;
  document.getElementById('nabung-modal-overlay').classList.remove('active');
  document.getElementById('nabung-modal').classList.remove('active');
}

document.getElementById('close-modal-btn').addEventListener('click', closeNabungModal);
document.getElementById('nabung-modal-overlay').addEventListener('click', closeNabungModal);

document.getElementById('confirm-nabung-btn').addEventListener('click', async () => {
  if (!selectedGoalId) return;

  const amountStr = document.getElementById('nabung_amount').value.replace(/\./g, '');
  const amount = parseInt(amountStr);

  if (isNaN(amount) || amount <= 0) {
    showCustomAlert("Peringatan", "Masukkan nominal yang valid!", "error");
    return;
  }

  let newCurrent = tempGoalData.currentAmt + amount;
  if (newCurrent > tempGoalData.targetAmt) newCurrent = tempGoalData.targetAmt;

  const { error } = await supabaseClient
    .from('savings_goals')
    .update({ current: newCurrent })
    .eq('id', selectedGoalId);

  if (!error) {
    showCustomAlert("Berhasil", "Tabungan berhasil ditambahkan!", "success");
    await initGoals(); 
    closeNabungModal(); 
  } else {
    showCustomAlert("Gagal", "Gagal menambah tabungan: " + error.message, "error");
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