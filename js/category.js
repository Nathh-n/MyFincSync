// =========================
// ADD CATEGORY (TAMBAH KATEGORI)
// =========================
const categoryForm = document.getElementById('category-form');

if (categoryForm) {
  categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const category_name = document.getElementById('category_name').value;
    const category_type = document.getElementById('category_type').value;

    // GET USER
    const { data: { user } } = await supabaseClient.auth.getUser();

    // Efek loading tombol (UX)
    const btn = categoryForm.querySelector('button[type="submit"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    // INSERT CATEGORY
    const { error } = await supabaseClient
      .from('categories')
      .insert([
        {
          user_id: user.id,
          name: category_name,
          type: category_type
        }
      ]);

    // Kembalikan tombol ke bentuk semula
    btn.innerHTML = originalContent;
    btn.disabled = false;

    if (error) {
      // Gunakan Custom Modal jika gagal
      showCustomAlert('Gagal', error.message, 'error');
      return;
    }

    // Gunakan Custom Modal jika berhasil
    showCustomAlert('Berhasil!', 'Kategori baru berhasil ditambahkan.', 'success');

    categoryForm.reset();
    getCategories();
  });
}

// =========================
// GET CATEGORY
// =========================
async function getCategories() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.log(error.message);
    return;
  }

  renderCategories(data);
}

// =========================
// RENDER CATEGORY
// =========================
function renderCategories(categories) {
  const incomeContainer = document.getElementById('income-category-container');
  const expenseContainer = document.getElementById('expense-category-container');

  if (incomeContainer) incomeContainer.innerHTML = '';
  if (expenseContainer) expenseContainer.innerHTML = '';

  categories.forEach((category) => {
    // Template HTML disesuaikan agar tombol hapus menggunakan ikon X
    const categoryHTML = `
      <div class="category-item">
        <span>${category.name}</span>
        <button onclick="deleteCategory('${category.id}')" title="Hapus Kategori">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    if (category.type === 'income' && incomeContainer) {
      incomeContainer.innerHTML += categoryHTML;
    } else if (category.type === 'expense' && expenseContainer) {
      expenseContainer.innerHTML += categoryHTML;
    }
  });
}

// =========================
// DELETE CATEGORY
// =========================
function deleteCategory(id) {
  // Gunakan Custom Confirm sebelum menghapus
  showCustomConfirm('Yakin ingin menghapus kategori ini?', async () => {
    
    // Blok ini hanya berjalan jika user menekan "Ya, Lanjutkan"
    const { error } = await supabaseClient
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      showCustomAlert('Gagal', error.message, 'error');
      return;
    }

    showCustomAlert('Terhapus', 'Kategori berhasil dihapus.', 'success');
    getCategories();
  });
}

// =========================
// INIT
// =========================
getCategories();