const categoryForm = document.getElementById('category-form');

if (categoryForm) {
  categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category_name = document.getElementById('category_name').value;
    const category_type = document.getElementById('category_type').value;
    const { data: { user } } = await supabaseClient.auth.getUser();

    const btn = categoryForm.querySelector('button[type="submit"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    const { error } = await supabaseClient.from('categories').insert([{ user_id: user.id, name: category_name, type: category_type }]);
    btn.innerHTML = originalContent; btn.disabled = false;

    if (error) { showCustomAlert('Gagal', error.message, 'error'); return; }
    showCustomAlert('Berhasil!', 'Kategori baru ditambahkan.', 'success');
    categoryForm.reset(); getCategories();
  });
}

async function getCategories() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const { data } = await supabaseClient.from('categories').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (data) renderCategories(data);
}

function renderCategories(categories) {
  const incomeContainer = document.getElementById('income-category-container');
  const expenseContainer = document.getElementById('expense-category-container');
  if (incomeContainer) incomeContainer.innerHTML = '';
  if (expenseContainer) expenseContainer.innerHTML = '';

  categories.forEach((category) => {
    const categoryHTML = `
      <div class="category-item">
        <span>${category.name}</span>
        <button onclick="deleteCategory('${category.id}')" title="Hapus Kategori"><i class="fas fa-times"></i></button>
      </div>
    `;
    if (category.type === 'income' && incomeContainer) incomeContainer.innerHTML += categoryHTML;
    else if (category.type === 'expense' && expenseContainer) expenseContainer.innerHTML += categoryHTML;
  });

  if (incomeContainer && incomeContainer.innerHTML === '') {
    incomeContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px; border: 1px dashed var(--border); border-radius: 8px;">Belum ada kategori pemasukan.</p>';
  }
  if (expenseContainer && expenseContainer.innerHTML === '') {
    expenseContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px; border: 1px dashed var(--border); border-radius: 8px;">Belum ada kategori pengeluaran.</p>';
  }
}

function deleteCategory(id) {
  // PERBAIKAN LOGIKA DOMINO
  showCustomConfirm('PERINGATAN!<br>Menghapus kategori ini juga akan <b>MENGHAPUS SEMUA riwayat transaksi</b> yang menggunakan kategori ini.<br>Yakin ingin menghapus?', async () => {
    const { error } = await supabaseClient.from('categories').delete().eq('id', id);
    if (error) { showCustomAlert('Gagal', error.message, 'error'); return; }
    showCustomAlert('Terhapus', 'Kategori dan seluruh riwayatnya telah dihapus.', 'success');
    getCategories();
    loadSummary(); // Refresh dashboard data
    loadRecentTransactions();
  });
}

getCategories();