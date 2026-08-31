let plans = [];
let currentUserId = null;

async function initPlanner() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUserId = user.id;

  const { data, error } = await supabaseClient
    .from('budget_plans')
    .select('*')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false });

  if (!error && data) {
    plans = data;
    renderPlans();
  }
}

const freqSelect = document.getElementById('plan_frequency');
const customDaysInput = document.getElementById('plan_custom_days');

freqSelect.addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    customDaysInput.classList.remove('hidden');
    customDaysInput.required = true;
  } else {
    customDaysInput.classList.add('hidden');
    customDaysInput.required = false;
    customDaysInput.value = '';
  }
});

document.getElementById('planner-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('plan_name').value;
  const amountStr = document.getElementById('plan_amount').value.replace(/\./g, '');
  const amount = parseInt(amountStr);
  const freq = freqSelect.value;
  const customDaysRaw = parseInt(customDaysInput.value);
  const customDays = (customDaysRaw && customDaysRaw > 0) ? customDaysRaw : null;

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
  btn.disabled = true;

  const { error } = await supabaseClient
    .from('budget_plans')
    .insert([{ 
      user_id: currentUserId, 
      name: name, 
      amount: amount, 
      freq: freq, 
      custom_days: customDays 
    }]);

  if (error) {
    showCustomAlert("Gagal", "Gagal menambah planner: " + error.message, "error");
  } else {
    e.target.reset();
    customDaysInput.classList.add('hidden'); 
    showCustomAlert("Berhasil", "Estimasi pengeluaran berhasil ditambahkan.", "success");
    await initPlanner(); 
  }

  btn.innerHTML = originalText;
  btn.disabled = false;
});

function renderPlans() {
  const planList = document.getElementById('plan-list');
  planList.innerHTML = '';

  let totalMonthlyTarget = 0;

  const formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Math.round(num)); 
  };

  if (plans.length === 0) {
    planList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px;">Belum ada estimasi pengeluaran yang diatur.</p>';
  } else {
    plans.forEach(plan => {
      let monthlyEquivalent = 0;
      let formulaText = "";
      
      const planAmount = parseFloat(plan.amount);

      if (plan.freq === 'daily') {
        monthlyEquivalent = planAmount * 30;
        formulaText = `(Rp ${formatRp(planAmount).replace('Rp','').trim()} x 30 Hari)`;
      } else if (plan.freq === 'monthly') {
        monthlyEquivalent = planAmount;
        formulaText = `Tetap bulanan`;
      } else if (plan.freq === 'custom') {
        if (plan.custom_days && plan.custom_days > 0) {
          monthlyEquivalent = (planAmount / plan.custom_days) * 30;
          formulaText = `(Rp ${formatRp(planAmount).replace('Rp','').trim()} / ${plan.custom_days} Hari) x 30 Hari`;
        } else {
          monthlyEquivalent = planAmount;
          formulaText = `Periode custom belum diatur`;
        }
      }

      totalMonthlyTarget += monthlyEquivalent;

      const html = `
        <div class="transaction-item" style="align-items: flex-start;">
          <div class="transaction-detail">
            <h4>${plan.name}</h4>
            <p>${formulaText}</p>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
            <div class="transaction-amount text-green">
              ${formatRp(monthlyEquivalent)} <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">/bln</span>
            </div>
            <button onclick="deletePlan('${plan.id}')" style="background: var(--red-light); color: var(--red); border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      planList.innerHTML += html;
    });
  }

  const dailyTarget = Math.round(totalMonthlyTarget / 30);
  
  document.getElementById('total-target-monthly').innerText = formatRp(totalMonthlyTarget);
  document.getElementById('total-target-daily').innerText = formatRp(dailyTarget);
}

function deletePlan(id) {
  showCustomConfirm("Yakin ingin menghapus estimasi ini?", async () => {
    const { error } = await supabaseClient
      .from('budget_plans')
      .delete()
      .eq('id', id);

    if (!error) {
      showCustomAlert("Terhapus", "Estimasi berhasil dihapus.", "success");
      initPlanner(); 
    } else {
      showCustomAlert("Gagal", error.message, "error");
    }
  });
}

const carousel = document.getElementById('target-carousel');
const dot1 = document.getElementById('dot-1');
const dot2 = document.getElementById('dot-2');

if (carousel) {
  carousel.addEventListener('scroll', () => {
    const scrollPercentage = carousel.scrollLeft / carousel.clientWidth;
    if (scrollPercentage > 0.5) {
      dot1.classList.remove('active');
      dot2.classList.add('active');
    } else {
      dot1.classList.add('active');
      dot2.classList.remove('active');
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

// INIT
initPlanner();

function formatRupiah(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}