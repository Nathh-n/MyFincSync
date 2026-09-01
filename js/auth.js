// ============================
// SISTEM POP-UP KHUSUS AUTH
// ============================
let authRedirectTarget = null;

function showAuthAlert(title, message, type = 'success', redirectUrl = null) {
  authRedirectTarget = redirectUrl;
  
  const titleEl = document.getElementById('auth-alert-title');
  const messageEl = document.getElementById('auth-alert-message');
  const iconEl = document.getElementById('auth-alert-icon');
  
  if(titleEl) titleEl.innerText = title;
  if(messageEl) messageEl.innerText = message;
  
  if(iconEl) {
    if(type === 'success') {
       iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
       iconEl.style.color = 'var(--green)';
    } else {
       iconEl.innerHTML = '<i class="fas fa-times-circle"></i>';
       iconEl.style.color = 'var(--red)';
    }
  }
  
  const overlay = document.getElementById('auth-alert-overlay');
  const modal = document.getElementById('auth-alert-modal');
  
  if(overlay) overlay.classList.add('active');
  if(modal) modal.classList.add('active');
}

function closeAuthAlert() {
  const overlay = document.getElementById('auth-alert-overlay');
  const modal = document.getElementById('auth-alert-modal');
  
  if(overlay) overlay.classList.remove('active');
  if(modal) modal.classList.remove('active');
  
  // Arahkan halaman setelah pop-up ditutup (jika ada url tujuan)
  if (authRedirectTarget) {
    window.location.href = authRedirectTarget;
  }
}

// ============================
// REGISTER
// ============================
const registerForm = document.getElementById('register-form');

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const full_name = document.getElementById('full_name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Validasi Panjang Password dengan Custom Alert
    if (password.length < 6) {
      showAuthAlert('Peringatan', 'Maaf, password harus memiliki minimal 6 karakter!', 'error');
      return;
    }

    // Ubah teks tombol jadi Loading saat ditekan agar UX bagus
    const btnSubmit = registerForm.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btnSubmit.disabled = true;

    // REGISTER USER
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name
        }
      }
    });

    btnSubmit.innerHTML = originalText;
    btnSubmit.disabled = false;

    if (error) {
      showAuthAlert("Gagal", error.message, "error");
      return;
    }

    // Jika Berhasil, tampilkan modal, lalu arahkan ke login.html setelah OK ditekan
    showAuthAlert('Berhasil!', 'Pendaftaran berhasil! Silakan masuk (login) menggunakan akunmu.', 'success', 'login.html');
  });
}

// ============================
// LOGIN
// ============================
const loginForm = document.getElementById('login-form');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Ubah teks tombol jadi Loading saat ditekan agar UX bagus
    const btnSubmit = loginForm.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btnSubmit.disabled = true;

    const email = document.getElementById('login_email').value;
    const password = document.getElementById('login_password').value;

    const rememberMe = document.getElementById('remember-me');
    const persistSession = rememberMe ? rememberMe.checked : true;
    localStorage.setItem('mfs_remember', persistSession ? '1' : '0');

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showAuthAlert("Gagal Login", "Email atau password yang Anda masukkan salah.", "error");
      btnSubmit.innerHTML = originalText;
      btnSubmit.disabled = false;
      return;
    }

    // JIKA BERHASIL LOGIN: Langsung pindah ke dashboard (Tanpa klik OK lagi)
    window.location.href = 'dashboard.html';
  });
}

// ============================
// CHECK SESSION (Otomatis masuk jika centang Remember Me aktif / Session ada)
// ============================
async function checkUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  // Kalau belum login dan buka dashboard
  if (!session && window.location.pathname.includes('dashboard.html')) {
    window.location.href = 'login.html';
  }

  // Kalau sudah login dan buka halaman login/register
  if (session && (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html'))) {
    window.location.href = 'dashboard.html';
  }
}

checkUser();

// ============================
// LOGOUT
// ============================
async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem('mfs_remember');
  window.location.href = 'login.html';
}

// ============================
// LUPA PASSWORD (Send Reset Email)
// ============================
const forgotPasswordForm = document.getElementById('forgot-password-form');

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('forgot_email').value;

    const btn = forgotPasswordForm.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
    btn.disabled = true;

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password.html'
    });

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (error) {
      showAuthAlert("Gagal", "Tidak dapat mengirim email reset. Silakan coba lagi nanti.", "error");
      return;
    }

    // Pesan netral agar aman dari user enumeration
    showAuthAlert("Cek Email Kamu", "Jika email terdaftar, link reset password sudah dikirim. Jangan lupa cek folder spam.", "success");
  });
}

// ============================
// GANTI PASSWORD (dari link email)
// ============================
const resetPasswordForm = document.getElementById('reset-password-form');

if (resetPasswordForm) {
  resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPassword = document.getElementById('new_password').value;
    const confirmPassword = document.getElementById('confirm_password').value;

    if (newPassword.length < 6) {
      showAuthAlert("Peringatan", "Password harus minimal 6 karakter!", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showAuthAlert("Peringatan", "Konfirmasi password tidak cocok!", "error");
      return;
    }

    const btn = resetPasswordForm.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (error) {
      showAuthAlert("Gagal", error.message, "error");
      return;
    }

    showAuthAlert("Berhasil", "Password berhasil diubah. Silakan login dengan password baru.", "success", "login.html");
  });
}