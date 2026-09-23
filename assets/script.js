/**
 * ====================================================================
 * LOGIKA APLIKASI WEB MULTI-FITUR (STUDI KASUS PABWE)
 *
 * Pemisahan Tanggung Jawab:
 *  1. Tab & Navigasi: Query String URL (?tab=expense|bookmark|quiz)
 *  2. Catatan Keuangan: CRUD DOM, Filter/Sort, Ringkasan, LocalStorage
 *  3. Bookmark Manager: CRUD DOM, Validasi URL, Cari/Sort, LocalStorage
 *  4. Kuis Interaktif: Array of Object, State, Skor & Rekor LocalStorage
 * ====================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ==================================================================
   * 1. INTEGRASI TAB BERBASIS QUERY URL (?tab=...)
   * Sesuai kriteria: Tab dipulihkan lewat query URL, bukan localStorage.
   * ================================================================== */
  const VALID_TABS = ['expense', 'bookmark', 'quiz'];
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  function getActiveTabFromURL() {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    return VALID_TABS.includes(tabParam) ? tabParam : 'expense';
  }

  function renderActiveTab(tabKey, updateURL = true) {
    const targetPanelId = `panel-${tabKey}`;

    // Aktifkan panel target, sembunyikan sisanya
    tabPanels.forEach(panel => {
      if (panel.id === targetPanelId) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // Update style tombol tab aktif
    tabButtons.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabKey;
      if (isTarget) {
        btn.classList.add('bg-white', 'text-indigo-600', 'shadow-xs');
        btn.classList.remove('text-slate-600');
      } else {
        btn.classList.remove('bg-white', 'text-indigo-600', 'shadow-xs');
        btn.classList.add('text-slate-600');
      }
    });

    // Perbarui query URL tanpa me-reload halaman
    if (updateURL) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabKey);
      window.history.replaceState({ tab: tabKey }, '', url);
    }
  }

  // Listener tombol tab navigasi
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-tab');
      renderActiveTab(tabKey, true);
    });
  });

  // Dukungan navigasi back/forward browser
  window.addEventListener('popstate', () => {
    renderActiveTab(getActiveTabFromURL(), false);
  });

  // Jalankan saat load awal sesuai query URL
  renderActiveTab(getActiveTabFromURL(), false);


  /* ==================================================================
   * 2. MODAL KONFIRMASI HAPUS (Mencegah window.confirm)
   * ================================================================== */
  const deleteModal = document.getElementById('modal-confirm-delete');
  const deleteModalTitle = document.getElementById('delete-modal-title');
  const deleteModalDesc = document.getElementById('delete-modal-desc');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnProceedDelete = document.getElementById('btn-proceed-delete');
  let confirmCallback = null;

  function showDeleteModal(title, message, onConfirm) {
    deleteModalTitle.textContent = title;
    deleteModalDesc.textContent = message;
    confirmCallback = onConfirm;
    deleteModal.classList.remove('hidden');
  }

  btnCancelDelete.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    confirmCallback = null;
  });

  btnProceedDelete.addEventListener('click', () => {
    if (typeof confirmCallback === 'function') {
      confirmCallback();
    }
    deleteModal.classList.add('hidden');
    confirmCallback = null;
  });


  /* ==================================================================
   * 3. FITUR: CATATAN PENGELUARAN HARIAN (EXPENSE TRACKER)
   * Key Storage: pabwe_expense_records
   * ================================================================== */
  const EXPENSE_STORAGE_KEY = 'pabwe_expense_records';
  let expenses = JSON.parse(localStorage.getItem(EXPENSE_STORAGE_KEY)) || [
    {
      id: 'exp-101',
      title: 'Honor Asisten Laboratorium',
      type: 'pemasukan',
      amount: 1200000,
      category: 'Gaji / Honor',
      date: '2025-02-01'
    },
    {
      id: 'exp-102',
      title: 'Membeli Buku Pemrograman Web',
      type: 'pengeluaran',
      amount: 150000,
      category: 'Pendidikan',
      date: '2025-02-03'
    }
  ];

  // DOM Expense
  const formAddExpense = document.getElementById('form-add-expense');
  const expenseTitleInput = document.getElementById('expense-title');
  const expenseTypeInput = document.getElementById('expense-type');
  const expenseAmountInput = document.getElementById('expense-amount');
  const expenseCatInput = document.getElementById('expense-category');
  const expenseDateInput = document.getElementById('expense-date');
  const expenseFormError = document.getElementById('expense-form-error');

  const expenseSearchInput = document.getElementById('expense-search');
  const expenseFilterType = document.getElementById('expense-filter-type');
  const expenseSortSelect = document.getElementById('expense-sort');
  const expenseListContainer = document.getElementById('expense-list-container');
  const expenseEmptyState = document.getElementById('expense-empty-state');

  const statIncomeEl = document.getElementById('stat-income');
  const statExpenseEl = document.getElementById('stat-expense');
  const statBalanceEl = document.getElementById('stat-balance');

  // DOM Modal Edit Expense
  const modalEditExpense = document.getElementById('modal-edit-expense');
  const formEditExpense = document.getElementById('form-edit-expense');
  const editExpenseId = document.getElementById('edit-expense-id');
  const editExpenseTitle = document.getElementById('edit-expense-title');
  const editExpenseType = document.getElementById('edit-expense-type');
  const editExpenseAmount = document.getElementById('edit-expense-amount');
  const editExpenseCategory = document.getElementById('edit-expense-category');
  const editExpenseDate = document.getElementById('edit-expense-date');
  const btnCloseEditExpense = document.getElementById('btn-close-edit-expense');
  const btnCancelEditExpense = document.getElementById('btn-cancel-edit-expense');

  // Helper Rupiah & Tanggal
  function formatIDR(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(amount);
  }

  function formatDateID(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (expenseDateInput) {
    expenseDateInput.value = new Date().toISOString().split('T')[0];
  }

  function saveExpenseData() {
    localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
  }

  function updateExpenseCalculations() {
    let incomeTotal = 0;
    let expenseTotal = 0;

    expenses.forEach(item => {
      const val = Number(item.amount) || 0;
      if (item.type === 'pemasukan') {
        incomeTotal += val;
      } else {
        expenseTotal += val;
      }
    });

    const balance = incomeTotal - expenseTotal;

    statIncomeEl.textContent = formatIDR(incomeTotal);
    statExpenseEl.textContent = formatIDR(expenseTotal);
    statBalanceEl.textContent = formatIDR(balance);

    if (balance < 0) {
      statBalanceEl.className = 'text-2xl font-bold text-rose-600 mt-1';
    } else {
      statBalanceEl.className = 'text-2xl font-bold text-slate-900 mt-1';
    }
  }

  function renderExpenses() {
    const keyword = expenseSearchInput.value.trim().toLowerCase();
    const typeFilter = expenseFilterType.value;
    const sortVal = expenseSortSelect.value;

    let filtered = expenses.filter(item => {
      const matchKeyword = item.title.toLowerCase().includes(keyword) || item.category.toLowerCase().includes(keyword);
      const matchType = typeFilter === 'all' || item.type === typeFilter;
      return matchKeyword && matchType;
    });

    // Sorting array
    filtered.sort((a, b) => {
      if (sortVal === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sortVal === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sortVal === 'amount-desc') return b.amount - a.amount;
      if (sortVal === 'amount-asc') return a.amount - b.amount;
      return 0;
    });

    expenseListContainer.innerHTML = '';

    if (filtered.length === 0) {
      expenseEmptyState.classList.remove('hidden');
    } else {
      expenseEmptyState.classList.add('hidden');

      filtered.forEach(item => {
        const isIncome = item.type === 'pemasukan';
        const itemRow = document.createElement('div');
        itemRow.className = 'p-4 flex items-center justify-between hover:bg-slate-50 transition';
        itemRow.innerHTML = `
          <div class="flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}">
              <i class="ti ${isIncome ? 'ti-arrow-down-left' : 'ti-arrow-up-right'}"></i>
            </div>
            <div>
              <p class="text-sm font-bold text-slate-800">${escapeString(item.title)}</p>
              <div class="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                <span class="inline-block px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">${escapeString(item.category)}</span>
                <span>&bull;</span>
                <span>${formatDateID(item.date)}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-sm font-bold ${isIncome ? 'text-emerald-600' : 'text-slate-800'}">
              ${isIncome ? '+' : '-'} ${formatIDR(item.amount)}
            </span>
            <div class="flex items-center gap-1">
              <button data-id="${item.id}" class="btn-edit-expense p-1.5 text-slate-400 hover:text-indigo-600 transition" title="Ubah Transaksi">
                <i class="ti ti-edit text-base"></i>
              </button>
              <button data-id="${item.id}" class="btn-del-expense p-1.5 text-slate-400 hover:text-rose-600 transition" title="Hapus Transaksi">
                <i class="ti ti-trash text-base"></i>
              </button>
            </div>
          </div>
        `;
        expenseListContainer.appendChild(itemRow);
      });
    }

    updateExpenseCalculations();
    attachExpenseEvents();
  }

  function attachExpenseEvents() {
    document.querySelectorAll('.btn-edit-expense').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const target = expenses.find(x => x.id === id);
        if (!target) return;

        editExpenseId.value = target.id;
        editExpenseTitle.value = target.title;
        editExpenseType.value = target.type;
        editExpenseAmount.value = target.amount;
        editExpenseCategory.value = target.category;
        editExpenseDate.value = target.date;

        modalEditExpense.classList.remove('hidden');
      };
    });

    document.querySelectorAll('.btn-del-expense').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        showDeleteModal('Hapus Catatan Transaksi?', 'Data pengeluaran/pemasukan ini akan dihapus secara permanen.', () => {
          expenses = expenses.filter(x => x.id !== id);
          saveExpenseData();
          renderExpenses();
        });
      };
    });
  }

  // Submit Tambah Transaksi
  formAddExpense.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = expenseTitleInput.value.trim();
    const type = expenseTypeInput.value;
    const amount = Number(expenseAmountInput.value);
    const category = expenseCatInput.value;
    const date = expenseDateInput.value;

    if (!title) {
      showErrorNotice(expenseFormError, 'Keterangan transaksi tidak boleh kosong.');
      return;
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      showErrorNotice(expenseFormError, 'Nominal harus angka valid dan lebih dari 0.');
      return;
    }
    if (!date) {
      showErrorNotice(expenseFormError, 'Tanggal transaksi harus ditentukan.');
      return;
    }

    expenseFormError.classList.add('hidden');

    const newRecord = {
      id: 'exp-' + Date.now(),
      title,
      type,
      amount,
      category,
      date
    };

    expenses.unshift(newRecord);
    saveExpenseData();
    renderExpenses();

    // Reset Form
    expenseTitleInput.value = '';
    expenseAmountInput.value = '';
    expenseDateInput.value = new Date().toISOString().split('T')[0];
  });

  // Form Edit Transaksi
  btnCloseEditExpense.addEventListener('click', () => modalEditExpense.classList.add('hidden'));
  btnCancelEditExpense.addEventListener('click', () => modalEditExpense.classList.add('hidden'));

  formEditExpense.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = editExpenseId.value;
    const title = editExpenseTitle.value.trim();
    const type = editExpenseType.value;
    const amount = Number(editExpenseAmount.value);
    const category = editExpenseCategory.value;
    const date = editExpenseDate.value;

    if (!title || amount <= 0 || !date) return;

    expenses = expenses.map(item => {
      if (item.id === id) {
        return { ...item, title, type, amount, category, date };
      }
      return item;
    });

    saveExpenseData();
    renderExpenses();
    modalEditExpense.classList.add('hidden');
  });

  expenseSearchInput.addEventListener('input', renderExpenses);
  expenseFilterType.addEventListener('change', renderExpenses);
  expenseSortSelect.addEventListener('change', renderExpenses);


  /* ==================================================================
   * 4. FITUR: BOOKMARK / LINK MANAGER
   * Key Storage: pabwe_bookmark_vault (Terpisah)
   * ================================================================== */
  const BM_STORAGE_KEY = 'pabwe_bookmark_vault';
  let bookmarks = JSON.parse(localStorage.getItem(BM_STORAGE_KEY)) || [
    {
      id: 'bm-101',
      title: 'MDN Web Docs (JavaScript Guide)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      category: 'Dokumentasi',
      notes: 'Dokumentasi standar sintaks JS dan Web API.'
    },
    {
      id: 'bm-102',
      title: 'Tailwind CSS Documentation',
      url: 'https://tailwindcss.com/docs',
      category: 'Framework',
      notes: 'Cheat sheet utilitas CSS responsif.'
    }
  ];

  // DOM Bookmark
  const formAddBm = document.getElementById('form-add-bookmark');
  const bmTitleInput = document.getElementById('bm-title');
  const bmUrlInput = document.getElementById('bm-url');
  const bmCategoryInput = document.getElementById('bm-category');
  const bmNotesInput = document.getElementById('bm-notes');
  const bmFormError = document.getElementById('bm-form-error');

  const bmSearchInput = document.getElementById('bm-search');
  const bmSortSelect = document.getElementById('bm-sort');
  const bmCardsContainer = document.getElementById('bm-cards-container');
  const bmEmptyState = document.getElementById('bm-empty-state');

  // DOM Modal Edit Bookmark
  const modalEditBm = document.getElementById('modal-edit-bm');
  const formEditBm = document.getElementById('form-edit-bm');
  const editBmId = document.getElementById('edit-bm-id');
  const editBmTitle = document.getElementById('edit-bm-title');
  const editBmUrl = document.getElementById('edit-bm-url');
  const editBmCategory = document.getElementById('edit-bm-category');
  const editBmNotes = document.getElementById('edit-bm-notes');
  const btnCloseEditBm = document.getElementById('btn-close-edit-bm');
  const btnCancelEditBm = document.getElementById('btn-cancel-edit-bm');

  function saveBookmarkData() {
    localStorage.setItem(BM_STORAGE_KEY, JSON.stringify(bookmarks));
  }

  // Validasi URL: wajib diawali http:// atau https://
  function checkValidUrl(str) {
    const urlPattern = /^(https?:\/\/).+/i;
    return urlPattern.test(str);
  }

  function renderBookmarks() {
    const keyword = bmSearchInput.value.trim().toLowerCase();
    const sortVal = bmSortSelect.value;

    let filtered = bookmarks.filter(b => {
      return (
        b.title.toLowerCase().includes(keyword) ||
        b.url.toLowerCase().includes(keyword) ||
        b.category.toLowerCase().includes(keyword)
      );
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortVal === 'alpha-asc') return a.title.localeCompare(b.title);
      if (sortVal === 'alpha-desc') return b.title.localeCompare(a.title);
      return 0; // newest
    });

    bmCardsContainer.innerHTML = '';

    if (filtered.length === 0) {
      bmEmptyState.classList.remove('hidden');
    } else {
      bmEmptyState.classList.add('hidden');

      filtered.forEach(bm => {
        const card = document.createElement('div');
        card.className = 'bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col justify-between';
        card.innerHTML = `
          <div class="space-y-2">
            <div class="flex items-start justify-between gap-2">
              <span class="inline-block px-2.5 py-0.5 text-[11px] font-bold rounded bg-indigo-50 text-indigo-700 tracking-wide uppercase">
                ${escapeString(bm.category)}
              </span>
              <div class="flex items-center gap-1">
                <button data-id="${bm.id}" class="btn-edit-bm p-1.5 text-slate-400 hover:text-indigo-600 transition" title="Ubah Bookmark">
                  <i class="ti ti-edit text-base"></i>
                </button>
                <button data-id="${bm.id}" class="btn-del-bm p-1.5 text-slate-400 hover:text-rose-600 transition" title="Hapus Bookmark">
                  <i class="ti ti-trash text-base"></i>
                </button>
              </div>
            </div>

            <h4 class="text-sm font-bold text-slate-900 line-clamp-1">${escapeString(bm.title)}</h4>

            <a href="${escapeString(bm.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline font-medium break-all">
              <i class="ti ti-external-link text-xs"></i>
              <span class="line-clamp-1">${escapeString(bm.url)}</span>
            </a>

            ${bm.notes ? `<p class="text-xs text-slate-500 pt-1 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">${escapeString(bm.notes)}</p>` : ''}
          </div>
        `;
        bmCardsContainer.appendChild(card);
      });
    }

    attachBookmarkEvents();
  }

  function attachBookmarkEvents() {
    document.querySelectorAll('.btn-edit-bm').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const target = bookmarks.find(b => b.id === id);
        if (!target) return;

        editBmId.value = target.id;
        editBmTitle.value = target.title;
        editBmUrl.value = target.url;
        editBmCategory.value = target.category;
        editBmNotes.value = target.notes || '';

        modalEditBm.classList.remove('hidden');
      };
    });

    document.querySelectorAll('.btn-del-bm').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        showDeleteModal('Hapus Bookmark Ini?', 'Tautan yang Anda simpan akan dihapus secara permanen.', () => {
          bookmarks = bookmarks.filter(b => b.id !== id);
          saveBookmarkData();
          renderBookmarks();
        });
      };
    });
  }

  // Tambah Bookmark
  formAddBm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = bmTitleInput.value.trim();
    const url = bmUrlInput.value.trim();
    const category = bmCategoryInput.value.trim();
    const notes = bmNotesInput.value.trim();

    if (!title) {
      showErrorNotice(bmFormError, 'Nama / judul tautan wajib diisi.');
      return;
    }
    if (!url || !checkValidUrl(url)) {
      showErrorNotice(bmFormError, 'URL tidak valid! Wajib diawali dengan http:// atau https://');
      return;
    }
    if (!category) {
      showErrorNotice(bmFormError, 'Kategori / tag wajib dicantumkan.');
      return;
    }

    bmFormError.classList.add('hidden');

    const newBm = {
      id: 'bm-' + Date.now(),
      title,
      url,
      category,
      notes
    };

    bookmarks.unshift(newBm);
    saveBookmarkData();
    renderBookmarks();

    formAddBm.reset();
  });

  // Form Edit Bookmark
  btnCloseEditBm.addEventListener('click', () => modalEditBm.classList.add('hidden'));
  btnCancelEditBm.addEventListener('click', () => modalEditBm.classList.add('hidden'));

  formEditBm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = editBmId.value;
    const title = editBmTitle.value.trim();
    const url = editBmUrl.value.trim();
    const category = editBmCategory.value.trim();
    const notes = editBmNotes.value.trim();

    if (!title || !checkValidUrl(url) || !category) return;

    bookmarks = bookmarks.map(b => {
      if (b.id === id) {
        return { ...b, title, url, category, notes };
      }
      return b;
    });

    saveBookmarkData();
    renderBookmarks();
    modalEditBm.classList.add('hidden');
  });

  bmSearchInput.addEventListener('input', renderBookmarks);
  bmSortSelect.addEventListener('change', renderBookmarks);


  /* ==================================================================
   * 5. FITUR: KUIS INTERAKTIF
   * Key Storage: pabwe_quiz_highscore (Terpisah)
   * ================================================================== */
  const QUIZ_STORAGE_KEY = 'pabwe_quiz_highscore';

  // Bank Soal: Array of Objects (5 Soal, 4 Opsi Jawaban)
  const quizBank = [
    {
      question: 'Atribut HTML mana yang wajib ditambahkan ketika menggunakan target="_blank" untuk mencegah celah keamanan reverse tabnabbing?',
      options: [
        'rel="noopener noreferrer"',
        'credential="secure"',
        'security="sandbox"',
        'integrity="strict"'
      ],
      correct: 0
    },
    {
      question: 'Method JavaScript apa yang paling tepat digunakan untuk memilih elemen DOM tunggal pertama sesuai selector CSS?',
      options: [
        'document.querySelectorAll()',
        'document.querySelector()',
        'document.getElement()',
        'document.findByClass()'
      ],
      correct: 1
    },
    {
      question: 'Manakah method bawaan untuk mengubah serial string JSON kembali menjadi struktur Object JavaScript?',
      options: [
        'JSON.stringify()',
        'JSON.serialize()',
        'JSON.parse()',
        'Object.fromJSON()'
      ],
      correct: 2
    },
    {
      question: 'Untuk memperbarui query URL tanpa memicu reload halaman pada browser, method Web History API apa yang tepat?',
      options: [
        'window.location.reload()',
        'history.replaceState() / history.pushState()',
        'document.setURLQuery()',
        'navigator.sendQuery()'
      ],
      correct: 1
    },
    {
      question: 'Manakah pernyataan yang BENAR mengenai penyimpanan browser localStorage?',
      options: [
        'Data otomatis terhapus saat tab atau browser ditutup',
        'Data hanya dapat diakses melalui server-side script',
        'Data tersimpan permanen di client hingga dihapus via script / bersihkan cache',
        'Kapasitas penyimpanan hanya terbatas hingga 4 Kilobyte'
      ],
      correct: 2
    }
  ];

  // State Kuis
  let activeQuestionIdx = 0;
  let currentScore = 0;
  let isAnswerLocked = false;

  // DOM Kuis
  const screenStart = document.getElementById('quiz-screen-start');
  const screenPlay = document.getElementById('quiz-screen-play');
  const screenResult = document.getElementById('quiz-screen-result');

  const btnQuizStart = document.getElementById('btn-quiz-start');
  const btnQuizNext = document.getElementById('btn-quiz-next');
  const btnQuizRestart = document.getElementById('btn-quiz-restart');

  const statHighScoreEl = document.getElementById('quiz-stat-highscore');
  const quizIndicator = document.getElementById('quiz-indicator');
  const quizCurrentScoreEl = document.getElementById('quiz-current-score');
  const quizProgressBar = document.getElementById('quiz-progress-bar');
  const quizQuestionText = document.getElementById('quiz-question-text');
  const quizOptionsContainer = document.getElementById('quiz-options-container');

  const quizFeedbackBox = document.getElementById('quiz-feedback-box');
  const quizFeedbackIcon = document.getElementById('quiz-feedback-icon');
  const quizFeedbackMsg = document.getElementById('quiz-feedback-msg');

  const quizResultIconContainer = document.getElementById('quiz-result-icon-container');
  const quizResultScore = document.getElementById('quiz-result-score');
  const quizResultTotal = document.getElementById('quiz-result-total');
  const quizResultEvaluation = document.getElementById('quiz-result-evaluation');
  const quizNewHighscoreBadge = document.getElementById('quiz-new-highscore-badge');

  function getSavedHighScore() {
    return parseInt(localStorage.getItem(QUIZ_STORAGE_KEY) || '0', 10);
  }

  function displayHighScore() {
    statHighScoreEl.textContent = `${getSavedHighScore()} / ${quizBank.length}`;
  }

  function startQuizProcess() {
    activeQuestionIdx = 0;
    currentScore = 0;
    isAnswerLocked = false;

    screenStart.classList.add('hidden');
    screenResult.classList.add('hidden');
    screenPlay.classList.remove('hidden');

    renderQuestion();
  }

  function renderQuestion() {
    isAnswerLocked = false;
    const qData = quizBank[activeQuestionIdx];

    quizIndicator.textContent = `Soal ${activeQuestionIdx + 1} dari ${quizBank.length}`;
    quizCurrentScoreEl.textContent = `Poin: ${currentScore}`;
    quizProgressBar.style.width = `${((activeQuestionIdx + 1) / quizBank.length) * 100}%`;
    quizQuestionText.textContent = qData.question;

    quizFeedbackBox.classList.add('hidden');
    btnQuizNext.classList.add('hidden');
    quizOptionsContainer.innerHTML = '';

    qData.options.forEach((optText, idx) => {
      const optButton = document.createElement('button');
      optButton.type = 'button';
      optButton.className = 'quiz-opt-btn w-full p-4 rounded-xl border border-slate-200 text-left text-xs sm:text-sm font-semibold hover:border-indigo-400 hover:bg-indigo-50/30 transition flex items-center justify-between text-slate-700';
      optButton.innerHTML = `
        <span class="flex items-center gap-3">
          <span class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-xs">${String.fromCharCode(65 + idx)}</span>
          <span>${escapeString(optText)}</span>
        </span>
        <i class="ti ti-circle text-slate-300 text-base check-icon"></i>
      `;

      optButton.addEventListener('click', () => chooseOption(idx, optButton));
      quizOptionsContainer.appendChild(optButton);
    });
  }

  function chooseOption(selectedIdx, clickedButton) {
    if (isAnswerLocked) return;
    isAnswerLocked = true;

    const qData = quizBank[activeQuestionIdx];
    const isCorrect = selectedIdx === qData.correct;
    const allButtons = quizOptionsContainer.querySelectorAll('.quiz-opt-btn');

    allButtons.forEach(btn => btn.classList.add('pointer-events-none'));

    if (isCorrect) {
      currentScore++;
      clickedButton.classList.remove('border-slate-200');
      clickedButton.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-900');
      clickedButton.querySelector('.check-icon').className = 'ti ti-circle-check-filled text-emerald-600 text-lg';

      quizFeedbackBox.className = 'p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-3 bg-emerald-50 text-emerald-800 border border-emerald-200';
      quizFeedbackIcon.className = 'ti ti-circle-check text-emerald-600 text-xl';
      quizFeedbackMsg.textContent = 'Jawaban tepat sekali!';
    } else {
      clickedButton.classList.remove('border-slate-200');
      clickedButton.classList.add('border-rose-500', 'bg-rose-50', 'text-rose-900');
      clickedButton.querySelector('.check-icon').className = 'ti ti-circle-x-filled text-rose-600 text-lg';

      const correctBtn = allButtons[qData.correct];
      correctBtn.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-900');
      correctBtn.querySelector('.check-icon').className = 'ti ti-circle-check-filled text-emerald-600 text-lg';

      quizFeedbackBox.className = 'p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-3 bg-rose-50 text-rose-800 border border-rose-200';
      quizFeedbackIcon.className = 'ti ti-circle-x text-rose-600 text-xl';
      quizFeedbackMsg.textContent = `Kurang tepat. Jawaban benar: "${qData.options[qData.correct]}".`;
    }

    quizFeedbackBox.classList.remove('hidden');
    quizCurrentScoreEl.textContent = `Poin: ${currentScore}`;
    btnQuizNext.classList.remove('hidden');
    btnQuizNext.classList.add('inline-flex');
  }

  btnQuizNext.addEventListener('click', () => {
    activeQuestionIdx++;
    if (activeQuestionIdx < quizBank.length) {
      renderQuestion();
    } else {
      finishQuiz();
    }
  });

  function finishQuiz() {
    screenPlay.classList.add('hidden');
    screenResult.classList.remove('hidden');

    const totalQuestions = quizBank.length;
    quizResultScore.textContent = currentScore;
    quizResultTotal.textContent = totalQuestions;

    const oldRecord = getSavedHighScore();
    let isNewRecord = false;

    if (currentScore > oldRecord) {
      localStorage.setItem(QUIZ_STORAGE_KEY, currentScore.toString());
      isNewRecord = true;
      displayHighScore();
    }

    if (isNewRecord && currentScore > 0) {
      quizNewHighscoreBadge.classList.remove('hidden');
    } else {
      quizNewHighscoreBadge.classList.add('hidden');
    }

    if (currentScore === totalQuestions) {
      quizResultIconContainer.className = 'w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto text-4xl';
      quizResultIconContainer.innerHTML = '<i class="ti ti-trophy"></i>';
      quizResultEvaluation.textContent = 'Luar biasa sempurna! Penguasaan materi Anda sangat baik.';
    } else if (currentScore >= 3) {
      quizResultIconContainer.className = 'w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto text-4xl';
      quizResultIconContainer.innerHTML = '<i class="ti ti-thumb-up"></i>';
      quizResultEvaluation.textContent = 'Hasil cukup bagus! Tinjau kembali konsep untuk nilai optimal.';
    } else {
      quizResultIconContainer.className = 'w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto text-4xl';
      quizResultIconContainer.innerHTML = '<i class="ti ti-notes"></i>';
      quizResultEvaluation.textContent = 'Perlu ditingkatkan lagi. Pelajari materi DOM & Web API.';
    }
  }

  btnQuizStart.addEventListener('click', startQuizProcess);
  btnQuizRestart.addEventListener('click', startQuizProcess);


  /* ==================================================================
   * 6. FUNGSI PEMBANTU (HELPERS)
   * ================================================================== */
  function showErrorNotice(elem, msg) {
    elem.textContent = msg;
    elem.classList.remove('hidden');
  }

  function escapeString(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  /* ==================================================================
   * INISIALISASI DATA AWAL
   * ================================================================== */
  renderExpenses();
  renderBookmarks();
  displayHighScore();
});