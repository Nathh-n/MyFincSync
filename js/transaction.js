// Konfigurasi AI Gemini via Supabase Edge Function
// API key disimpan di server (supabase secrets), tidak terekspos ke client.
// Deploy: cd supabase && supabase functions deploy gemini-proxy --project-ref sxcyygkxjysadsmyhijg

// ==========================================
// STATE GLOBAL & OPTIONS
// ==========================================
const state = { userId: null, type: null };
let walletOptionsHTML = '<option value="">Pilih Dompet</option>';
let categoryOptionsHTML = '<option value="">Pilih Kategori</option>';

async function initTransactionForm() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) { window.location.href = 'login.html'; return; }

  state.userId = user.id;
  state.type = window.location.href.includes('income') ? 'income' : 'expense';

  await loadWallets(user.id);
  await loadCategories(user.id, state.type);

  setupAddItemButton();
  addItemRow(); // baris pertama
  setupFormSubmit();
}

// ==========================================
// LOAD DOMPET & KATEGORI
// ==========================================
async function loadWallets(userId) {
  const { data } = await supabaseClient.from('wallets').select('id, name').eq('user_id', userId);
  walletOptionsHTML = '<option value="">Pilih Dompet</option>';
  if (data) data.forEach(w => { walletOptionsHTML += `<option value="${w.id}">${w.name}</option>`; });
}

async function loadCategories(userId, type) {
  const { data } = await supabaseClient.from('categories').select('id, name').eq('user_id', userId).eq('type', type);
  categoryOptionsHTML = '<option value="">Pilih Kategori</option>';
  if (data) data.forEach(c => { categoryOptionsHTML += `<option value="${c.id}">${c.name}</option>`; });
}

// ==========================================
// MANAJEMEN BARIS MULTIPLE INPUT
// ==========================================
function addItemRow(data) {
  const tpl = document.getElementById('item-template');
  if (!tpl) {
    console.error('[addItemRow] Template #item-template tidak ditemukan. Versi HTML dan JS tidak sinkron (coba hard-refresh / clear cache).');
    return;
  }
  const clone = tpl.content.cloneNode(true);
  const row = clone.querySelector('.item-row');

  row.querySelector('.item-wallet').innerHTML = walletOptionsHTML;
  row.querySelector('.item-category').innerHTML = categoryOptionsHTML;

  if (data) {
    if (data.amount) row.querySelector('.item-amount').value = data.amount;
    if (data.title) row.querySelector('.item-title').value = data.title;
    if (data.wallet) {
      const sel = row.querySelector('.item-wallet');
      const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes(String(data.wallet).toLowerCase()));
      if (opt) sel.value = opt.value;
    }
    if (data.category) {
      const sel = row.querySelector('.item-category');
      const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes(String(data.category).toLowerCase()));
      if (opt) sel.value = opt.value;
    }
  }

  row.querySelector('.item-remove').addEventListener('click', () => { row.remove(); updateRemoveButtons(); });
  document.getElementById('items-container').appendChild(clone);
  updateRemoveButtons();
}

function updateRemoveButtons() {
  const rows = document.querySelectorAll('#items-container .item-row');
  const showRemove = rows.length > 1;
  rows.forEach(r => { r.querySelector('.item-remove').style.display = showRemove ? 'flex' : 'none'; });
}

function setupAddItemButton() {
  const btn = document.getElementById('add-item-btn');
  if (btn) btn.addEventListener('click', () => addItemRow());
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

// Proses teks ke Gemini dan Autofill Form (MULTIPLE TRANSACTIONS)
async function processWithGemini(text) {

  const isIncomePage = window.location.href.includes('income');
  const typeHint = isIncomePage ? "Pemasukan" : "Pengeluaran";

  const availableCategories = (() => {
    const div = document.createElement('div');
    div.innerHTML = categoryOptionsHTML;
    return Array.from(div.querySelectorAll('option')).filter(o => o.value !== '').map(o => o.text).join(', ');
  })();

  const availableWallets = (() => {
    const div = document.createElement('div');
    div.innerHTML = walletOptionsHTML;
    return Array.from(div.querySelectorAll('option')).filter(o => o.value !== '').map(o => o.text).join(', ');
  })();

  // Dapatkan tanggal hari ini sebagai patokan untuk AI (Format: YYYY-MM-DD)
  const todayStr = new Date().toLocaleDateString('en-CA'); 

  // PROMPT DINAMIS: Instruksi untuk memproses BANYAK transaksi sekaligus
  const promptText = `
    Kamu adalah asisten keuangan pintar. Ekstrak SEMUA transaksi dari teks berikut ke dalam format JSON array.
    Teks Pengguna: "${text}"
    
    Daftar Kategori yang tersedia: [${availableCategories}]
    Daftar Dompet yang tersedia: [${availableWallets}]
    Tanggal Hari Ini: ${todayStr}
    
    Wajib kembalikan JSON dengan struktur ini saja:
    {
      "transactions": [
        {
          "title": "Nama ${typeHint} singkat",
          "amount": angka_nominal_murni,
          "category": "Pilih SATU dari Daftar Kategori di atas. Jika tidak ada, biarkan kosong.",
          "wallet": "Pilih SATU dari Daftar Dompet di atas. Jika tidak tahu, biarkan kosong.",
          "date": "Tanggal transaksi dalam format YYYY-MM-DD. Hitung berdasarkan 'Tanggal Hari Ini' jika pengguna menyebutkan waktu (contoh: 'kemarin' = kurangi 1 hari, 'tadi' = hari ini). Jika pengguna tidak menyebutkan waktu sama sekali, gunakan Tanggal Hari Ini."
        }
      ]
    }
    Sertakan SEMUA transaksi yang disebutkan (jika ada beberapa, buat beberapa objek dalam array).
    Jika nominal tidak ditemukan, isi amount dengan 0. Jika hanya satu transaksi, tetap gunakan array dengan satu elemen.
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

    const transactions = Array.isArray(aiData.transactions) ? aiData.transactions : [aiData];

    // Isi form dengan beberapa baris
    fillFormWithAI(transactions);
    closeVoiceOverlay();

  } catch (error) {
    console.error("Gemini Error:", error);
    alert("Error AI: " + error.message);
    document.getElementById('status-text').style.display = 'none';
    document.getElementById('instruction-text').style.display = 'block';
    document.getElementById('instruction-text').innerHTML = "Gagal memproses. Silakan coba lagi.";
  }
}

// Fungsi untuk memasukkan data ke form dari hasil AI (MULTIPLE BARIS)
function fillFormWithAI(transactions) {
  const items = Array.isArray(transactions) ? transactions : [transactions];
  const container = document.getElementById('items-container');
  if (container) container.innerHTML = '';

  let firstDate = null;
  items.forEach((it, idx) => {
    if (idx === 0 && it && it.date) firstDate = it.date;
    addItemRow(it || {});
  });

  if (firstDate) {
    const dateInput = document.getElementById('transaction_date');
    if (dateInput) dateInput.value = firstDate;
  }
}

// ==========================================
// SUBMIT MULTIPLE TRANSAKSI
// ==========================================
function setupFormSubmit() {
  const form = document.getElementById(state.type === 'income' ? 'income-form' : 'expense-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const transaction_date = document.getElementById('transaction_date').value;
    const description = document.getElementById('description').value;

    // Kumpulkan semua baris yang terisi
    const rows = Array.from(document.querySelectorAll('#items-container .item-row'));
    const items = [];

    for (const row of rows) {
      const title = row.querySelector('.item-title').value.trim();
      const amount = Number(row.querySelector('.item-amount').value.replace(/\./g, ''));
      const wallet_id = row.querySelector('.item-wallet').value;
      const category_id = row.querySelector('.item-category').value;

      if (!title && !amount) continue; // lewati baris kosong

      if (!title || !amount || amount <= 0) {
        alert("Ada baris yang belum lengkap. Isi judul dan nominal yang valid.");
        return;
      }
      if (!wallet_id || !category_id) {
        alert("Pilih dompet dan kategori di setiap baris.");
        return;
      }

      items.push({ title, amount, transaction_date, wallet_id, category_id, description });
    }

    if (!items.length) {
      alert("Belum ada item yang diisi.");
      return;
    }

    // Ambil saldo semua dompet yang terlibat
    const walletIds = [...new Set(items.map(i => i.wallet_id))];
    const { data: walletData } = await supabaseClient.from('wallets').select('id, balance').in('id', walletIds);
    const balanceMap = {};
    (walletData || []).forEach(w => { balanceMap[w.id] = Number(w.balance) || 0; });

    const anyOver = items.some(i => state.type === 'expense' && i.amount > balanceMap[i.wallet_id]);

    const executeBatch = async () => {
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
      btn.disabled = true;

      const insertRows = items.map(i => ({
        user_id: state.userId,
        title: i.title,
        amount: i.amount,
        type: state.type,
        transaction_date: i.transaction_date,
        wallet_id: i.wallet_id,
        category_id: i.category_id,
        description: i.description
      }));

      const { data: txData, error: txError } = await supabaseClient.from('transactions').insert(insertRows).select();
      if (txError) {
        alert("Gagal menyimpan: " + txError.message);
        btn.innerHTML = originalText; btn.disabled = false; return;
      }

      // Hitung perubahan saldo per dompet
      const delta = {};
      items.forEach(i => { delta[i.wallet_id] = (delta[i.wallet_id] || 0) + (state.type === 'income' ? i.amount : -i.amount); });

      // Update saldo tiap dompet
      for (const [wid, d] of Object.entries(delta)) {
        const { error: walletError } = await supabaseClient.from('wallets').update({ balance: balanceMap[wid] + d }).eq('id', wid);
        if (walletError) {
          await supabaseClient.from('transactions').delete().in('id', txData.map(t => t.id));
          alert("Masalah saat memperbarui saldo dompet! Semua transaksi dibatalkan otomatis agar data tetap sinkron. Silakan coba lagi.");
          btn.innerHTML = originalText; btn.disabled = false; return;
        }
      }

      window.location.href = 'dashboard.html';
    };

    if (anyOver) {
      showCustomConfirm(`Ada pengeluaran yang melebihi saldo dompet.<br>Yakin ingin melanjutkan dan membuat saldo menjadi minus (hutang)?`, executeBatch);
    } else {
      executeBatch();
    }
  });
}

// Jalankan Inisialisasi (dengan log error agar kegagalan tidak senyap)
initTransactionForm().catch(e => console.error('[initTransactionForm] Gagal inisialisasi form:', e));
