// Konfigurasi AI Gemini via Supabase Edge Function
// API key disimpan di server (supabase secrets), tidak terekspos ke client.
// Deploy: cd supabase && supabase functions deploy gemini-proxy --project-ref sxcyygkxjysadsmyhijg

async function initTransactionForm() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const isIncome = window.location.href.includes('income');
  const transactionType = isIncome ? 'income' : 'expense';

  await loadWallets(user.id);
  await loadCategories(user.id, transactionType);
  
  setupFormSubmit(user.id, transactionType);
}

// ==========================================
// FITUR VOICE TO TEXT & GEMINI AI
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'id-ID'; 
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = function() {
    document.getElementById('mic-btn-large').classList.add('recording');
    document.getElementById('instruction-text').innerHTML = "Mendengarkan...<br><span style='font-size:12px; font-weight:normal; color:#64748b;'>Silakan bicara sekarang</span>";
  };

  recognition.onresult = async function(event) {
    const transcript = event.results[0][0].transcript;
    document.getElementById('mic-btn-large').classList.remove('recording');
    document.getElementById('instruction-text').style.display = 'none';
    
    const statusText = document.getElementById('status-text');
    statusText.style.display = 'block';
    statusText.innerHTML = `Terdengar: <i>"${escapeHTML(transcript)}"</i><br><br>AI Sedang Memproses... <i class="fas fa-spinner fa-spin"></i>`;
    
    await processWithGemini(transcript);
  };

  recognition.onerror = function(event) {
    console.error("Speech Recognition Error:", event.error);
    
    let errorMsg = "Gagal mendengar suaramu.";
    if (event.error === 'not-allowed') {
      errorMsg = "Akses mikrofon diblokir! Izinkan di pengaturan browser.";
    } else if (event.error === 'network') {
      errorMsg = "Perlu koneksi internet untuk merekam suara.";
    } else if (event.error === 'no-speech') {
      errorMsg = "Tidak ada suara yang terdengar.";
    }

    document.getElementById('mic-btn-large').classList.remove('recording');
    document.getElementById('instruction-text').style.display = 'block';
    document.getElementById('status-text').style.display = 'none';
    document.getElementById('instruction-text').innerHTML = `${errorMsg}<br><span style='font-size:12px; font-weight:normal; color:#ef4444;'>Silakan coba lagi.</span>`;
  };
} else {
  alert("Maaf, browser Anda tidak mendukung fitur Voice Recognition. Silakan gunakan Google Chrome.");
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// Kontrol Overlay UI
function openVoiceOverlay() {
  document.getElementById('voice-overlay').style.display = 'flex';
  document.getElementById('instruction-text').style.display = 'block';
  const isIncomePage = window.location.href.includes('income');
  document.getElementById('instruction-text').innerHTML = isIncomePage ? "Berbicara untuk mencatat pemasukan" : "Berbicara untuk mencatat pengeluaran";
  document.getElementById('status-text').style.display = 'none';
}

function closeVoiceOverlay() {
  document.getElementById('voice-overlay').style.display = 'none';
  if (recognition) recognition.stop();
  document.getElementById('mic-btn-large').classList.remove('recording');
}

function startRecording() {
  if (recognition) recognition.start();
}

// Proses teks ke Gemini dan Autofill Form
// Proses teks ke Gemini dan Autofill Form
// Proses teks ke Gemini dan Autofill Form
async function processWithGemini(text) {

  const isIncomePage = window.location.href.includes('income');
  const typeHint = isIncomePage ? "Pemasukan" : "Pengeluaran";

  const categorySelect = document.getElementById('category_id');
  const availableCategories = Array.from(categorySelect.options)
    .filter(opt => opt.value !== "")
    .map(opt => opt.text)
    .join(", ");

  const walletSelect = document.getElementById('wallet_id');
  const availableWallets = Array.from(walletSelect.options)
    .filter(opt => opt.value !== "")
    .map(opt => opt.text)
    .join(", ");

  // Dapatkan tanggal hari ini sebagai patokan untuk AI (Format: YYYY-MM-DD)
  const todayStr = new Date().toLocaleDateString('en-CA'); 

  // PROMPT DINAMIS: Tambahkan instruksi untuk memproses waktu/tanggal
  const promptText = `
    Kamu adalah asisten keuangan pintar. Ekstrak informasi dari teks berikut ke dalam format JSON.
    Teks Pengguna: "${text}"
    
    Daftar Kategori yang tersedia: [${availableCategories}]
    Daftar Dompet yang tersedia: [${availableWallets}]
    Tanggal Hari Ini: ${todayStr}
    
    Wajib kembalikan JSON dengan struktur ini saja:
    {
      "title": "Nama ${typeHint} singkat",
      "amount": angka_nominal_murni,
      "category": "Pilih SATU dari Daftar Kategori di atas. Jika tidak ada, biarkan kosong.",
      "wallet": "Pilih SATU dari Daftar Dompet di atas. Jika tidak tahu, biarkan kosong.",
      "date": "Tanggal transaksi dalam format YYYY-MM-DD. Hitung berdasarkan 'Tanggal Hari Ini' jika pengguna menyebutkan waktu (contoh: 'kemarin' = kurangi 1 hari, lalu kalau pengguna bilang 'tadi' itu artinya hari ini). Jika pengguna tidak menyebutkan waktu sama sekali, gunakan Tanggal Hari Ini."
    }
    Jika nominal tidak ditemukan, isi amount dengan 0.
    JANGAN BERIKAN TEKS LAIN SELAIN JSON.
  `;

  try {
    const response = await supabaseClient.functions.invoke('gemini-proxy', {
      body: { text: promptText }
    });

    if (response.error) {
      throw new Error(response.error.message || "Fitur AI belum aktif. Deploy Edge Function 'gemini-proxy'.");
    }

    const data = response.data;
    let aiResponseText = data.candidates[0].content.parts[0].text;
    
    const jsonString = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiData = JSON.parse(jsonString);

    // Langsung isi form
    fillFormWithAI(aiData);
    closeVoiceOverlay();

  } catch (error) {
    console.error("Gemini Error:", error);
    alert("Error AI: " + error.message);
    document.getElementById('status-text').style.display = 'none';
    document.getElementById('instruction-text').style.display = 'block';
    document.getElementById('instruction-text').innerHTML = "Gagal memproses. Silakan coba lagi.";
  }
}

// Fungsi untuk memasukkan data ke form dari hasil AI
function fillFormWithAI(aiData) {
  if (aiData.amount) {
    const amountInput = document.getElementById('amount');
    amountInput.value = aiData.amount;
    formatRupiah(amountInput); 
  }
  
  if (aiData.title) {
    document.getElementById('title').value = aiData.title;
  }

  // ISI TANGGAL SECARA OTOMATIS
  if (aiData.date) {
    document.getElementById('transaction_date').value = aiData.date;
  }

  if (aiData.wallet) {
    const walletSelect = document.getElementById('wallet_id');
    const options = Array.from(walletSelect.options);
    const matchedOption = options.find(opt => opt.text.toLowerCase().includes(aiData.wallet.toLowerCase()));
    if (matchedOption) walletSelect.value = matchedOption.value;
  }

  if (aiData.category) {
    const catSelect = document.getElementById('category_id');
    const options = Array.from(catSelect.options);
    const matchedOption = options.find(opt => opt.text.toLowerCase().includes(aiData.category.toLowerCase()));
    if (matchedOption) catSelect.value = matchedOption.value;
  }
}
// ==========================================
// FUNGSI STANDAR TRANSAKSI & SUPABASE
// ==========================================
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

    if (!amount || amount <= 0) {
      alert("Masukkan nominal yang valid!"); return;
    }
    const transaction_date = document.getElementById('transaction_date').value;
    const wallet_id = document.getElementById('wallet_id').value;
    const category_id = document.getElementById('category_id').value;
    const description = document.getElementById('description').value;

    const { data: walletData } = await supabaseClient.from('wallets').select('balance').eq('id', wallet_id).single();
    let currentBalance = walletData ? parseInt(walletData.balance) || 0 : 0;

    const executeTransaction = async () => {
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
      btn.disabled = true;

      const { data: txData, error: txError } = await supabaseClient.from('transactions').insert([{
        user_id: userId, title, amount, type: transactionType, transaction_date, wallet_id, category_id, description
      }]).select();

      if (txError) {
        alert("Gagal menyimpan: " + txError.message);
        btn.innerHTML = originalText; btn.disabled = false; return;
      }

      let newBalance = transactionType === 'income' ? currentBalance + amount : currentBalance - amount;
      const { error: walletError } = await supabaseClient.from('wallets').update({ balance: newBalance }).eq('id', wallet_id);

      if (walletError) {
        await supabaseClient.from('transactions').delete().eq('id', txData[0].id);
        alert("Koneksi bermasalah saat memproses saldo dompet! Transaksi dibatalkan otomatis agar data tetap sinkron. Silakan coba lagi.");
        btn.innerHTML = originalText; btn.disabled = false; return;
      }

      window.location.href = 'dashboard.html';
    };

    if (transactionType === 'expense' && amount > currentBalance) {
      showCustomConfirm(`Saldo dompet saat ini hanya Rp ${new Intl.NumberFormat('id-ID').format(currentBalance)}.<br>Yakin ingin mencatat pengeluaran ini dan membuat saldo menjadi minus (hutang)?`, executeTransaction);
    } else {
      executeTransaction();
    }
  });
}

// Modal Konfirmasi Kustom
let confirmCallback = null;
function showCustomConfirm(message, callback) {
  const modalOverlay = document.getElementById('confirm-modal-overlay');
  if(!modalOverlay) {
    if(confirm(message.replace(/<br>/g, "\n"))) callback(); 
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

// Jalankan Inisialisasi
initTransactionForm();