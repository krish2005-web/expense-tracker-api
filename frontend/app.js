(() => {
  'use strict';

  const API_BASE = window.location.origin;
  const TOKEN_KEY = 'moneta_access_token';
  const USER_KEY = 'moneta_user';
  const state = {
    token: sessionStorage.getItem(TOKEN_KEY),
    user: safeParse(sessionStorage.getItem(USER_KEY)),
    mode: 'login',
    page: 1,
    pageSize: 5,
    totalCount: 0,
    summary: null,
    expenses: [],
    editId: null,
    categories: [],
    loading: false,
  };

  const $ = (id) => document.getElementById(id);
  const authView = $('authView');
  const appView = $('appView');
  const authForm = $('authForm');
  const authError = $('authError');
  const expenseModal = $('expenseModal');
  const expenseForm = $('expenseForm');
  const expenseFormError = $('expenseFormError');
  const rows = $('expenseRows');

  function safeParse(value) {
    try { return value ? JSON.parse(value) : null; } catch { return null; }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function money(value) {
    const number = Number(value ?? 0);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0);
  }

  function displayDate(value, options = {}) {
    if (!value) return '—';
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: options.year ? 'numeric' : undefined }).format(date);
  }

  function todayIso() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function notify(title, message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast${isError ? ' error' : ''}`;
    toast.innerHTML = `<span class="toast-icon">${isError ? '!' : '✓'}</span><div><strong>${esc(title)}</strong><p>${esc(message)}</p></div>`;
    $('toastRegion').appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      window.setTimeout(() => toast.remove(), 220);
    }, 3800);
  }

  function errorMessage(payload, fallback = 'Something went wrong. Please try again.') {
    if (typeof payload?.detail === 'string') return payload.detail;
    if (Array.isArray(payload?.detail)) return payload.detail.map((item) => `${(item.loc || []).slice(-1)[0] || 'Field'}: ${item.msg}`).join(' · ');
    return fallback;
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (state.token) headers.set('Authorization', `Bearer ${state.token}`);

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (error) {
      throw new Error('Could not reach the API. Make sure the FastAPI server is running and open this page from http://127.0.0.1:8000.');
    }
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { detail: text }; }
    }
    if (!response.ok) {
      if (response.status === 401 && state.token && !path.startsWith('/auth/')) {
        clearSession();
        showAuth();
      }
      throw new Error(errorMessage(data, `Request failed (${response.status}).`));
    }
    return data;
  }

  function setAuthMode(mode) {
    state.mode = mode;
    const registering = mode === 'register';
    $('showLogin').classList.toggle('active', !registering);
    $('showRegister').classList.toggle('active', registering);
    $('showLogin').setAttribute('aria-selected', String(!registering));
    $('showRegister').setAttribute('aria-selected', String(registering));
    $('nameField').hidden = !registering;
    $('fullName').required = registering;
    $('password').autocomplete = registering ? 'new-password' : 'current-password';
    $('authKicker').textContent = registering ? 'A FRESH START' : 'WELCOME BACK';
    $('authTitle').textContent = registering ? 'Let’s make it count.' : 'Good to see you.';
    $('authSubtitle').textContent = registering ? 'Create an account and get your spending in focus.' : 'Sign in to pick up where you left off.';
    $('authSubmit').querySelector('span').textContent = registering ? 'Create my account' : 'Sign in to Moneta';
    $('togglePassword').setAttribute('aria-label', 'Show password');
    $('password').type = 'password';
    authError.hidden = true;
  }

  async function handleAuth(event) {
    event.preventDefault();
    authError.hidden = true;
    const submit = $('authSubmit');
    const original = submit.innerHTML;
    submit.disabled = true;
    submit.innerHTML = '<span>Please wait…</span>';
    const email = $('email').value.trim();
    const password = $('password').value;
    try {
      if (state.mode === 'register') {
        const name = $('fullName').value.trim();
        await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      }
      const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      state.token = login.access_token;
      sessionStorage.setItem(TOKEN_KEY, state.token);
      // This API does not expose /auth/me; use the registration name or email prefix for the dashboard greeting.
      state.user = { name: state.mode === 'register' ? $('fullName').value.trim() : email.split('@')[0], email };
      sessionStorage.setItem(USER_KEY, JSON.stringify(state.user));
      showApp();
      await refreshDashboard();
      notify(state.mode === 'register' ? 'Account created' : 'Welcome back', 'Your money dashboard is ready.');
    
} catch (error) {
  const message = error.message.toLowerCase();

  authError.textContent = message.includes('already registered')
    ? 'This email is already registered. Please sign in instead.'
    : error.message;

  authError.hidden = false;
} finally {
  submit.disabled = false;
  submit.innerHTML = original;
}
  }

  function clearSession() {
    state.token = null;
    state.user = null;
    state.summary = null;
    state.expenses = [];
    state.categories = [];
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  function showAuth() {
    authView.hidden = false;
    appView.hidden = true;
  }

  function showApp() {
    authView.hidden = true;
    appView.hidden = false;
    const name = state.user?.name || state.user?.full_name || (state.user?.email || 'Your account').split('@')[0];
    const email = state.user?.email || '';
    const firstName = name.trim().split(/\s+/)[0] || 'there';
    $('sidebarUserName').textContent = name;
    $('sidebarUserEmail').textContent = email;
    $('sidebarAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'M';
    $('greetingTitle').textContent = `${greeting()}, ${firstName}.`;
    $('todayLabel').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  async function refreshDashboard() {
    if (!state.token) return showAuth();
    state.loading = true;
    rows.innerHTML = '<tr><td colspan="5"><div class="loading-row"><span class="loader"></span> Loading your transactions…</div></td></tr>';
    try {
      const [summary, expenses] = await Promise.all([
        api('/expenses/summary'),
        fetchExpenses(),
      ]);
      state.summary = summary;
      state.expenses = expenses;
      state.categories = (summary.category_summary || []).map((item) => item.category).sort((a, b) => a.localeCompare(b));
      updateSummary(summary);
      renderCategoryOptions();
      renderExpenses(expenses);
      renderCategories(summary);
    } catch (error) {
      rows.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">!</div><strong>Couldn’t load your data</strong><p>${esc(error.message)}</p><button class="btn btn-quiet" id="retryLoad">Try again</button></div></td></tr>`;
      const retry = $('retryLoad');
      if (retry) retry.addEventListener('click', refreshDashboard);
      if (error.message.toLowerCase().includes('token') || error.message.toLowerCase().includes('credential') || error.message.toLowerCase().includes('unauthorized')) {
        clearSession();
        showAuth();
      }
    } finally {
      state.loading = false;
    }
  }

  async function fetchExpenses() {
    const params = new URLSearchParams({ page: String(state.page), limit: String(state.pageSize) });
    const category = $('filterCategory').value.trim();
    const start = $('filterStart').value;
    const end = $('filterEnd').value;
    if (category) params.set('category', category);
    if (start) params.set('start_date', start);
    if (end) params.set('end_date', end);
    const result = await api(`/expenses/?${params.toString()}`);
    state.totalCount = result.length;
    return result;
  }

  function updateSummary(summary) {
    $('totalSpent').textContent = money(summary.total_spent);
    $('expenseCount').textContent = String(summary.expense_count ?? 0);
    $('categoryCount').textContent = String((summary.category_summary || []).length);
    $('categoryTotal').textContent = money(summary.total_spent);
  }

  function categoryStyle(category) {
    const key = String(category || '').toLowerCase();
    if (/food|grocery|restaurant|dining/.test(key)) return { css: 'symbol-food', color: '#e9a05a', symbol: '✳' };
    if (/travel|transport|fuel|cab/.test(key)) return { css: 'symbol-travel', color: '#63acd5', symbol: '↗' };
    if (/shop|cloth|fashion|electronic/.test(key)) return { css: 'symbol-shop', color: '#9383e9', symbol: '◇' };
    if (/bill|rent|utilit|electric|internet/.test(key)) return { css: 'symbol-bill', color: '#d97e86', symbol: '▤' };
    if (/health|medical|fitness|pharma/.test(key)) return { css: 'symbol-health', color: '#58b895', symbol: '✚' };
    if (/education|book|course/.test(key)) return { css: 'symbol-travel', color: '#5da4ce', symbol: '⌑' };
    return { css: 'symbol-other', color: '#9aa9b9', symbol: '•' };
  }

  function renderExpenses(expenses) {
    rows.innerHTML = '';
    if (!expenses.length) {
      const activeFilter = $('filterCategory').value || $('filterStart').value || $('filterEnd').value;
      rows.innerHTML = `<tr><td colspan="5" class="empty-cell"><div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24"><path d="M5 7h14M7 4h10M7 7v13h10V7M10 11v5M14 11v5"/></svg></div><strong>${activeFilter ? 'No matching expenses' : 'Your story starts here'}</strong><p>${activeFilter ? 'Try changing or clearing your filters.' : 'Add your first expense and start getting a clearer view of your spending.'}</p><button class="btn btn-primary" id="emptyAddBtn">+ Add an expense</button></div></td></tr>`;
      $('emptyAddBtn')?.addEventListener('click', () => openExpenseModal());
      $('resultsLabel').textContent = activeFilter ? 'No matching results' : 'No transactions yet';
      $('prevPage').disabled = state.page <= 1;
      $('nextPage').disabled = true;
      $('pageLabel').textContent = String(state.page);
      return;
    }

    expenses.forEach((expense) => {
      const style = categoryStyle(expense.category);
      const description = expense.description || `Added ${displayDate(expense.created_at || expense.expense_date)}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="expense-name-cell"><div class="expense-symbol ${style.css}">${style.symbol}</div><div><strong title="${esc(expense.title)}">${esc(expense.title)}</strong><span title="${esc(description)}">${esc(description)}</span></div></div></td>
        <td><span class="category-pill">${esc(expense.category)}</span></td>
        <td>${esc(displayDate(expense.expense_date))}</td>
        <td class="amount-cell">${esc(money(expense.amount))}</td>
        <td><div class="row-actions"><button class="row-action" data-edit="${Number(expense.id)}" title="Edit expense" aria-label="Edit ${esc(expense.title)}"><svg viewBox="0 0 24 24"><path d="m14 6 4 4M4 20l4.5-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z"/></svg></button><button class="row-action delete" data-delete="${Number(expense.id)}" title="Delete expense" aria-label="Delete ${esc(expense.title)}"><svg viewBox="0 0 24 24"><path d="M4.5 7h15M9 7V4.5h6V7M7 7l1 13h8l1-13M10 10.5v6M14 10.5v6"/></svg></button></div></td>`;
      rows.appendChild(tr);
    });
    $('resultsLabel').textContent = `Showing ${expenses.length} expense${expenses.length === 1 ? '' : 's'} · page ${state.page}`;
    $('pageLabel').textContent = String(state.page);
    $('prevPage').disabled = state.page <= 1;
    // This endpoint returns a list without total count; a full page suggests another page may exist.
    $('nextPage').disabled = expenses.length < state.pageSize;
  }

  function renderCategories(summary) {
    const wrap = $('categoryBreakdown');
    const list = [...(summary.category_summary || [])].sort((a, b) => Number(b.total_spent) - Number(a.total_spent));
    if (!list.length) {
      wrap.innerHTML = '<div class="category-empty"><span class="empty-ring">◎</span><strong>Your insights will live here</strong><span>Add expenses to see your breakdown.</span></div>';
      return;
    }
    const max = Math.max(1, ...list.map((item) => Number(item.total_spent)));
    const palette = ['#8fc956', '#9588e6', '#67b4d6', '#e7a05f', '#da818c', '#5bb89c', '#8da2b8'];
    wrap.innerHTML = list.slice(0, 6).map((item, index) => {
      const style = categoryStyle(item.category);
      const percentage = Number(summary.total_spent) > 0 ? (Number(item.total_spent) / Number(summary.total_spent)) * 100 : 0;
      return `<div class="category-row"><div class="category-row-top"><div class="category-row-label"><span class="category-dot" style="background:${palette[index % palette.length]}"></span><strong>${esc(item.category)}</strong></div><span class="category-row-value">${esc(money(item.total_spent))}</span></div><div class="category-track"><div class="category-fill" style="width:${Math.max(0, Math.min(100, percentage))}%;background:${palette[index % palette.length]}"></div></div><div class="category-meta">${Number(item.expense_count || 0)} transaction${Number(item.expense_count || 0) === 1 ? '' : 's'} · ${Math.round(percentage)}% of total</div></div>`;
    }).join('');
  }

  function renderCategoryOptions() {
    const datalist = $('categoryOptions');
    datalist.innerHTML = '';
    [...new Set([...state.categories, 'Food', 'Travel', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Education', 'Other'])]
      .sort((a, b) => a.localeCompare(b))
      .forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        datalist.appendChild(option);
      });
  }

  async function applyFilters(resetPage = true) {
    if (resetPage) state.page = 1;
    if ($('filterStart').value && $('filterEnd').value && $('filterStart').value > $('filterEnd').value) {
      notify('Check the dates', 'The start date must be on or before the end date.', true);
      return;
    }
    rows.innerHTML = '<tr><td colspan="5"><div class="loading-row"><span class="loader"></span> Updating transactions…</div></td></tr>';
    try {
      const expenses = await fetchExpenses();
      state.expenses = expenses;
      renderExpenses(expenses);
    } catch (error) {
      notify('Couldn’t filter expenses', error.message, true);
    }
  }

  function openExpenseModal(expense = null) {
    state.editId = expense ? Number(expense.id) : null;
    $('modalTitle').textContent = expense ? 'Edit expense' : 'Add an expense';
    $('saveExpenseBtn').querySelector('span').textContent = expense ? 'Save changes' : 'Save expense';
    $('expenseTitle').value = expense?.title || '';
    $('expenseAmount').value = expense?.amount ?? '';
    $('expenseCategory').value = expense?.category || '';
    $('expenseDate').value = expense?.expense_date?.slice(0, 10) || todayIso();
    $('expenseDescription').value = expense?.description || '';
    expenseFormError.hidden = true;
    expenseModal.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => $('expenseTitle').focus(), 40);
  }

  function closeExpenseModal() {
    expenseModal.hidden = true;
    document.body.style.overflow = '';
    state.editId = null;
  }

  async function saveExpense(event) {
    event.preventDefault();
    expenseFormError.hidden = true;
    const amount = $('expenseAmount').value;
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      expenseFormError.textContent = 'Enter an amount greater than zero with at most two decimal places.';
      expenseFormError.hidden = false;
      return;
    }
    const body = {
      title: $('expenseTitle').value.trim(),
      category: $('expenseCategory').value.trim(),
      amount,
      description: $('expenseDescription').value.trim() || null,
      expense_date: $('expenseDate').value,
    };
    if (!body.title || !body.category || !body.expense_date) {
      expenseFormError.textContent = 'Please complete the title, category, amount and date.';
      expenseFormError.hidden = false;
      return;
    }
    const button = $('saveExpenseBtn');
    const previous = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span>Saving…</span>';
    try {
      if (state.editId) {
        await api(`/expenses/${state.editId}`, { method: 'PATCH', body: JSON.stringify(body) });
        notify('Expense updated', 'Your changes have been saved.');
      } else {
        await api('/expenses/', { method: 'POST', body: JSON.stringify(body) });
        notify('Expense added', 'Your new transaction is in the books.');
      }
      closeExpenseModal();
      state.page = 1;
      await refreshDashboard();
    } catch (error) {
      expenseFormError.textContent = error.message;
      expenseFormError.hidden = false;
    } finally {
      button.disabled = false;
      button.innerHTML = previous;
    }
  }

  async function deleteExpense(id) {
    const item = state.expenses.find((expense) => Number(expense.id) === Number(id));
    const label = item?.title || 'this expense';
    if (!window.confirm(`Delete “${label}”? This action cannot be undone.`)) return;
    try {
      await api(`/expenses/${id}`, { method: 'DELETE' });
      notify('Expense deleted', 'The transaction has been removed.');
      if (state.page > 1 && state.expenses.length === 1) state.page -= 1;
      await refreshDashboard();
    } catch (error) {
      notify('Couldn’t delete expense', error.message, true);
    }
  }

  function signOut() {
    clearSession();
    closeExpenseModal();
    $('password').value = '';
    $('email').value = '';
    setAuthMode('login');
    showAuth();
    notify('Signed out', 'Your session has ended on this device.');
  }

  function bindEvents() {
    $('year').textContent = String(new Date().getFullYear());
    $('showLogin').addEventListener('click', () => setAuthMode('login'));
    $('showRegister').addEventListener('click', () => setAuthMode('register'));
    $('togglePassword').addEventListener('click', () => {
      const field = $('password');
      field.type = field.type === 'password' ? 'text' : 'password';
      $('togglePassword').setAttribute('aria-label', field.type === 'password' ? 'Show password' : 'Hide password');
    });
    authForm.addEventListener('submit', handleAuth);
    $('logoutBtn').addEventListener('click', signOut);
    $('topAddBtn').addEventListener('click', () => openExpenseModal());
    $('closeModal').addEventListener('click', closeExpenseModal);
    $('cancelModal').addEventListener('click', closeExpenseModal);
    expenseModal.addEventListener('click', (event) => { if (event.target === expenseModal) closeExpenseModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !expenseModal.hidden) closeExpenseModal(); });
    expenseForm.addEventListener('submit', saveExpense);
    $('applyFilters').addEventListener('click', () => applyFilters(true));
    $('clearFilters').addEventListener('click', () => {
      $('filterCategory').value = '';
      $('filterStart').value = '';
      $('filterEnd').value = '';
      applyFilters(true);
    });
    $('filterCategory').addEventListener('keydown', (event) => { if (event.key === 'Enter') applyFilters(true); });
    $('filterEnd').addEventListener('keydown', (event) => { if (event.key === 'Enter') applyFilters(true); });
    $('prevPage').addEventListener('click', () => { if (state.page > 1) { state.page -= 1; applyFilters(false); } });
    $('nextPage').addEventListener('click', () => { state.page += 1; applyFilters(false); });
    $('viewAllBtn').addEventListener('click', () => { $('filterCategory').focus(); $('transactions').scrollIntoView({ behavior: 'smooth' }); });
    const navItems = Array.from($('sidebar').querySelectorAll('.nav-item'));
    navItems.forEach((item) => item.addEventListener('click', async () => {
      // Keep the active state on the sidebar buttons themselves.
      navItems.forEach((nav) => nav.classList.toggle('active', nav === item));
      $('breadcrumbTitle').textContent = item.textContent.trim();
      $('sidebar').classList.remove('open');

      const target = document.getElementById(item.dataset.scroll);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Refresh category totals when the user opens Spending insights.
      // This makes the view show the latest saved expense data instead of stale UI state.
      if (item.dataset.scroll === 'insights' && state.token) {
        try {
          const summary = await api('/expenses/summary');
          state.summary = summary;
          state.categories = (summary.category_summary || [])
            .map((entry) => entry.category)
            .sort((a, b) => a.localeCompare(b));
          updateSummary(summary);
          renderCategories(summary);
          renderCategoryOptions();
        } catch (error) {
          notify('Couldn’t load spending insights', error.message, true);
        }
      }
    }));
    $('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    rows.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-edit]');
      const remove = event.target.closest('[data-delete]');
      if (edit) {
        const expense = state.expenses.find((item) => Number(item.id) === Number(edit.dataset.edit));
        if (expense) openExpenseModal(expense);
      } else if (remove) deleteExpense(remove.dataset.delete);
    });
  }

  bindEvents();
  setAuthMode('login');
  if (state.token) {
    showApp();
    refreshDashboard();
  } else {
    showAuth();
  }
})();
