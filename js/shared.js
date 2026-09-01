// ============================
// SHARED UTILITY FUNCTIONS
// ============================

// === ALERT MODAL (global) ===
function showCustomAlert(title, message, type = 'success') {
  const titleEl = document.getElementById('alert-title');
  const messageEl = document.getElementById('alert-message');
  const iconEl = document.getElementById('alert-icon');
  const overlay = document.getElementById('alert-modal-overlay');
  const modal = document.getElementById('alert-modal');
  if (!overlay || !modal) { alert(message); return; }
  if (titleEl) titleEl.innerText = title;
  if (messageEl) messageEl.innerText = message;
  if (iconEl) {
    if (type === 'success') { iconEl.innerHTML = '<i class="fas fa-check-circle"></i>'; iconEl.style.color = 'var(--green)'; }
    else if (type === 'info') { iconEl.innerHTML = '<i class="fas fa-info-circle"></i>'; iconEl.style.color = '#3b82f6'; }
    else { iconEl.innerHTML = '<i class="fas fa-times-circle"></i>'; iconEl.style.color = 'var(--red)'; }
  }
  overlay.classList.add('active');
  modal.classList.add('active');
}

function closeCustomAlert() {
  const overlay = document.getElementById('alert-modal-overlay');
  const modal = document.getElementById('alert-modal');
  if (overlay) overlay.classList.remove('active');
  if (modal) modal.classList.remove('active');
}

// === CONFIRM MODAL (global) ===
let confirmCallback = null;

function showCustomConfirm(message, callback) {
  const overlay = document.getElementById('confirm-modal-overlay');
  const modal = document.getElementById('confirm-modal');
  if (!overlay || !modal) {
    if (confirm(message.replace(/<br>/g, '\n'))) callback();
    return;
  }
  document.getElementById('confirm-message').innerHTML = message;
  confirmCallback = callback;
  overlay.classList.add('active');
  modal.classList.add('active');
}

function closeCustomConfirm(isConfirmed) {
  const overlay = document.getElementById('confirm-modal-overlay');
  const modal = document.getElementById('confirm-modal');
  if (overlay) overlay.classList.remove('active');
  if (modal) modal.classList.remove('active');
  if (isConfirmed && confirmCallback) confirmCallback();
}

// === FORMATTERS ===
function formatRupiah(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatRp(num) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Math.round(num));
}

// === XSS SANITIZATION ===
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// === DATE HELPERS ===
function getFirstDayOfMonth() {
  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = localDate.getTimezoneOffset();
  return new Date(localDate.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
}

// === EMPTY STATE ===
function showEmptyState(container, iconClass, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas ${iconClass}"></i>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

// === GLOBAL LOADING INDICATOR ===
let loadingEl = null;
let loadingCount = 0;

function showGlobalLoading() {
  loadingCount++;
  if (loadingEl) { loadingEl.style.display = 'flex'; return; }
  loadingEl = document.createElement('div');
  loadingEl.id = 'global-loading';
  loadingEl.innerHTML = '<div class="loading-spinner"></div><p>Memuat...</p>';
  document.body.appendChild(loadingEl);
}

function hideGlobalLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0 && loadingEl) loadingEl.style.display = 'none';
}

// === GLOBAL ERROR HANDLER ===
window.addEventListener('error', function(e) {
  console.error('[Global Error]', e.error || e.message);
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('[Unhandled Promise]', e.reason);
});