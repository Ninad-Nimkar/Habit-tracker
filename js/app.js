/**
 * app.js - Application Orchestrator, UI Events, and Page Initializers
 * Compliant with IEEE 830 SRS for Personal Habit Tracker
 */

// Shared UI Helpers
const UI = {
  /**
   * Display a high-contrast toast notification
   * @param {string} message 
   * @param {number} durationMs 
   */
  showToast(message, durationMs = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 200);
    }, durationMs);
  },

  /**
   * Open an accessible modal
   * @param {string} modalId 
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    const firstInput = modal.querySelector('button, input, select, textarea');
    if (firstInput) firstInput.focus();
  },

  /**
   * Close an accessible modal
   * @param {string} modalId 
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  },

  /**
   * Apply theme and color scheme to document element
   */
  applyTheme() {
    const settings = Storage.getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme || 'light');
    document.documentElement.setAttribute('data-scheme', settings.colorScheme || 'monochrome');

    // Update toggle icons if present
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.innerHTML = settings.theme === 'dark' 
        ? '<span aria-hidden="true">&#9788;</span> Light' 
        : '<span aria-hidden="true">&#9790;</span> Dark';
      themeBtn.setAttribute('aria-label', `Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`);
    }
  },

  /**
   * Toggle between light and dark mode
   */
  toggleTheme() {
    const settings = Storage.getSettings();
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    Storage.saveSettings({ theme: newTheme });
    this.applyTheme();
    this.showToast(`Switched to ${newTheme} mode`);
  },

  /**
   * Setup greeting and date banner
   */
  setupStatusBar() {
    const greetingEl = document.getElementById('greeting-text');
    const dateEl = document.getElementById('date-indicator');
    if (!greetingEl && !dateEl) return;

    const settings = Storage.getSettings();
    const now = new Date();
    const hours = now.getHours();
    let timeGreeting = 'Good morning';
    if (hours >= 12 && hours < 17) timeGreeting = 'Good afternoon';
    else if (hours >= 17) timeGreeting = 'Good evening';

    const name = settings.displayName ? `, ${settings.displayName}` : '';
    if (greetingEl) {
      greetingEl.textContent = `${timeGreeting}${name}`;
    }

    if (dateEl) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString(undefined, options);
    }
  },

  /**
   * Highlight active nav item
   */
  highlightActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath || (currentPath === '' && href === 'index.html')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  },

  /**
   * Setup global keyboard shortcuts
   */
  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in form inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach(m => {
          m.classList.remove('open');
        });
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        UI.openModal('shortcuts-modal');
      } else if (e.key.toLowerCase() === 't') {
        UI.toggleTheme();
      } else if (e.key.toLowerCase() === 'n') {
        window.location.href = 'add-habit.html';
      }
    });
  }
};

/* ==========================================================================
   PAGE: DASHBOARD (index.html)
   ========================================================================== */
const DashboardPage = {
  currentFilter: 'all', // 'all', 'pending', 'completed', 'archived'
  currentCategory: 'all',
  currentSort: 'name',  // 'name', 'streak', 'created'
  searchQuery: '',
  habitToDeleteId: null,

  init() {
    this.renderKPIs();
    this.renderSpotlight();
    this.renderMomentumStrip();
    this.setupQuickAdd();
    this.setupControls();
    this.renderHabits();
    this.setupDeleteModal();
  },

  refreshAll() {
    this.renderKPIs();
    this.renderSpotlight();
    this.renderMomentumStrip();
    this.renderHabits();
  },

  renderSpotlight() {
    const el = document.getElementById('focus-spotlight');
    if (!el) return;

    const habits = Habits.getAll(false); // active habits
    const today = new Date();
    const todayISO = formatDateToISO(today);

    // Find pending habits scheduled today
    const pendingScheduled = habits.filter(h => Streaks.isScheduled(h, today) && !Habits.isCompletedOn(h.id, todayISO));
    const allScheduled = habits.filter(h => Streaks.isScheduled(h, today));

    if (allScheduled.length === 0) {
      el.innerHTML = `
        <div class="focus-spotlight-left">
          <span class="focus-icon">&#9675;</span>
          <div>
            <div class="focus-text-title">No habits scheduled for today</div>
            <div class="focus-text-sub">Add a routine below or enjoy a rest day.</div>
          </div>
        </div>
      `;
      return;
    }

    if (pendingScheduled.length === 0) {
      el.innerHTML = `
        <div class="focus-spotlight-left">
          <span class="focus-icon">&#10003;</span>
          <div>
            <div class="focus-text-title">All daily habits completed!</div>
            <div class="focus-text-sub">You've achieved 100% of your scheduled commitments for today.</div>
          </div>
        </div>
        <span class="pill-filter active" style="font-size: 0.75rem; pointer-events: none;">Flawless Day</span>
      `;
      return;
    }

    // Sort pending by highest streak first (protect the longest streak!)
    pendingScheduled.sort((a, b) => Streaks.calculateCurrent(b) - Streaks.calculateCurrent(a));
    const focusHabit = pendingScheduled[0];
    const streak = Streaks.calculateCurrent(focusHabit);

    el.innerHTML = `
      <div class="focus-spotlight-left">
        <span class="focus-icon">&#9889;</span>
        <div>
          <div class="focus-text-title">Focus Next: ${this.escapeHtml(focusHabit.name)}</div>
          <div class="focus-text-sub">
            ${streak > 0 ? `${streak}-day streak on the line! Keep your momentum alive.` : `Scheduled for today in ${this.escapeHtml(focusHabit.category || 'General')}.`}
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-primary btn-sm btn-focus-check">
        &#10003; Check Off
      </button>
    `;

    const checkBtn = el.querySelector('.btn-focus-check');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => {
        Habits.toggleCompletion(focusHabit.id, todayISO);
        UI.showToast(`Completed: ${focusHabit.name}!`);
        this.refreshAll();
      });
    }
  },

  renderMomentumStrip() {
    const el = document.getElementById('momentum-strip');
    if (!el) return;

    const trends = Stats.getDailyTrends(14); // Last 14 days
    let html = `
      <div class="momentum-label">14-Day Activity Momentum</div>
      <div class="momentum-days">
    `;

    trends.forEach(day => {
      let dotClass = 'momentum-dot';
      let title = `${day.date} (${day.dayName}): ${day.completedCount}/${day.scheduledCount} (${day.percent}%)`;
      if (day.scheduledCount > 0) {
        if (day.percent === 100) dotClass += ' done';
        else if (day.percent > 0) dotClass += ' partial';
      } else {
        title += ' (No habits scheduled)';
      }

      html += `
        <div class="momentum-dot-wrap" title="${title}">
          <span class="${dotClass}"></span>
          <span class="momentum-day-text">${day.dayName[0]}</span>
        </div>
      `;
    });

    html += '</div>';
    el.innerHTML = html;
  },

  setupQuickAdd() {
    const form = document.getElementById('quick-add-form');
    const input = document.getElementById('quick-add-input');
    const catSelect = document.getElementById('quick-add-category');

    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return;

        const res = Habits.create({
          name,
          category: catSelect ? catSelect.value : 'General',
          frequency: [0, 1, 2, 3, 4, 5, 6],
          startDate: formatDateToISO()
        });

        if (res.success) {
          input.value = '';
          UI.showToast(`Added habit: ${name}`);
          const catFilter = document.getElementById('category-filter');
          if (catFilter) this.populateCategoryFilter(catFilter);
          this.refreshAll();
        } else {
          UI.showToast(res.errors && res.errors.name ? res.errors.name : 'Could not add habit');
        }
      });
    }

    // Template chips
    document.querySelectorAll('.template-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.dataset.name;
        const category = chip.dataset.cat || 'General';

        const res = Habits.create({
          name,
          category,
          frequency: [0, 1, 2, 3, 4, 5, 6],
          startDate: formatDateToISO()
        });

        if (res.success) {
          UI.showToast(`Added habit: ${name}`);
          const catFilter = document.getElementById('category-filter');
          if (catFilter) this.populateCategoryFilter(catFilter);
          this.refreshAll();
        } else {
          UI.showToast(res.errors && res.errors.name ? res.errors.name : `Habit "${name}" already exists`);
        }
      });
    });
  },

  renderKPIs() {
    const summary = Stats.getDashboardSummary();

    const rateEl = document.getElementById('kpi-rate');
    const rateFillEl = document.getElementById('kpi-rate-fill');
    const scheduledEl = document.getElementById('kpi-scheduled');
    const bestStreakEl = document.getElementById('kpi-best-streak');
    const bestHabitEl = document.getElementById('kpi-best-habit');
    const totalCompletionsEl = document.getElementById('kpi-total-completions');
    const activeHabitsEl = document.getElementById('kpi-active-habits');

    if (rateEl) rateEl.textContent = `${summary.todayPercentage}%`;
    if (rateFillEl) rateFillEl.style.width = `${summary.todayPercentage}%`;
    if (scheduledEl) scheduledEl.textContent = `${summary.completedTodayCount} of ${summary.scheduledTodayCount} habits`;
    if (bestStreakEl) bestStreakEl.textContent = `${summary.bestCurrentStreak}d`;
    if (bestHabitEl) bestHabitEl.textContent = summary.bestHabitName ? `Best: ${summary.bestHabitName}` : 'No active streak yet';
    if (totalCompletionsEl) totalCompletionsEl.textContent = summary.totalCompletions;
    if (activeHabitsEl) activeHabitsEl.textContent = `${summary.activeHabitsCount} active`;
  },

  setupControls() {
    // Filter Pills
    document.querySelectorAll('.pill-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.pill-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderHabits();
      });
    });

    // Search Input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderHabits();
      });
    }

    // Category Filter
    const catSelect = document.getElementById('category-filter');
    if (catSelect) {
      this.populateCategoryFilter(catSelect);
      catSelect.addEventListener('change', (e) => {
        this.currentCategory = e.target.value;
        this.renderHabits();
      });
    }

    // Sort Select
    const sortSelect = document.getElementById('sort-filter');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.renderHabits();
      });
    }

    // View Mode Toggle
    const viewBtn = document.getElementById('view-toggle-btn');
    if (viewBtn) {
      const container = document.getElementById('habits-list');
      const settings = Storage.getSettings();
      let mode = settings.viewMode || 'cards';
      if (container) {
        container.className = `habits-container view-${mode}`;
      }
      viewBtn.textContent = mode === 'cards' ? 'List View' : 'Card View';

      viewBtn.addEventListener('click', () => {
        mode = mode === 'cards' ? 'list' : 'cards';
        if (container) container.className = `habits-container view-${mode}`;
        viewBtn.textContent = mode === 'cards' ? 'List View' : 'Card View';
        Storage.saveSettings({ viewMode: mode });
      });
    }
  },

  populateCategoryFilter(selectEl) {
    const habits = Habits.getAll(true);
    const categories = new Set();
    habits.forEach(h => {
      if (h.category) categories.add(h.category.trim());
    });

    selectEl.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      selectEl.appendChild(opt);
    });
  },

  renderHabits() {
    const container = document.getElementById('habits-list');
    if (!container) return;

    let habits = Habits.getAll(true);
    const today = new Date();
    const todayISO = formatDateToISO(today);

    // Filter by status (FR-21)
    if (this.currentFilter === 'pending') {
      habits = habits.filter(h => !h.archived && Streaks.isScheduled(h, today) && !Habits.isCompletedOn(h.id, todayISO));
    } else if (this.currentFilter === 'completed') {
      habits = habits.filter(h => !h.archived && Habits.isCompletedOn(h.id, todayISO));
    } else if (this.currentFilter === 'archived') {
      habits = habits.filter(h => h.archived);
    } else {
      // 'all' active habits by default
      habits = habits.filter(h => !h.archived);
    }

    // Filter by category (FR-21)
    if (this.currentCategory !== 'all') {
      habits = habits.filter(h => h.category === this.currentCategory);
    }

    // Search by name (FR-22)
    if (this.searchQuery) {
      habits = habits.filter(h => h.name.toLowerCase().includes(this.searchQuery));
    }

    // Sorting (FR-23)
    habits.sort((a, b) => {
      if (this.currentSort === 'streak') {
        const streakA = Streaks.calculateCurrent(a);
        const streakB = Streaks.calculateCurrent(b);
        return streakB - streakA;
      } else if (this.currentSort === 'created') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      } else {
        return a.name.localeCompare(b.name);
      }
    });

    if (habits.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#9744;</div>
          <div class="empty-title">No habits found</div>
          <div class="empty-desc">No habits match your active filters. Create a new habit or adjust your search.</div>
          <a href="add-habit.html" class="btn btn-primary">+ Create New Habit</a>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    habits.forEach(habit => {
      const card = this.createHabitCard(habit, today, todayISO);
      container.appendChild(card);
    });
  },

  createHabitCard(habit, today, todayISO) {
    const isCompletedToday = Habits.isCompletedOn(habit.id, todayISO);
    const isSchedToday = Streaks.isScheduled(habit, today);
    const streakInfo = Streaks.getStreakInfo(habit);

    const cat = (habit.category || 'General').toLowerCase().trim();
    let topicSlug = 'general';
    if (cat.includes('health')) topicSlug = 'health';
    else if (cat.includes('fit') || cat.includes('sport') || cat.includes('walk') || cat.includes('run')) topicSlug = 'fitness';
    else if (cat.includes('study') || cat.includes('learn') || cat.includes('read')) topicSlug = 'study';
    else if (cat.includes('mind') || cat.includes('meditat')) topicSlug = 'mind';
    else if (cat.includes('work') || cat.includes('productiv')) topicSlug = 'work';
    else if (cat.includes('person') || cat.includes('journal') || cat.includes('grow')) topicSlug = 'personal';

    const card = document.createElement('article');
    card.className = `habit-card topic-${topicSlug} ${isCompletedToday ? 'completed-today' : ''}`;
    card.dataset.id = habit.id;
    card.dataset.topic = topicSlug;

    // Build 7-day mini strip
    let weekDotsHtml = '';
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dISO = formatDateToISO(d);
      const isSched = Streaks.isScheduled(habit, d);
      const isDone = Habits.isCompletedOn(habit.id, dISO);
      const dayLetter = d.toLocaleDateString(undefined, { weekday: 'narrow' });

      let dotClass = 'day-dot';
      let title = `${dISO}: `;
      if (!isSched) {
        dotClass += ' not-scheduled';
        title += 'Rest day';
      } else if (isDone) {
        dotClass += ' done';
        title += 'Completed';
      } else {
        dotClass += ' scheduled-missed';
        title += 'Pending / Missed';
      }

      weekDotsHtml += `
        <div class="day-dot-item" title="${title}">
          <span class="day-label">${dayLetter}</span>
          <button type="button" class="${dotClass}" data-habit-id="${habit.id}" data-date="${dISO}" aria-label="${title}">
            ${isDone ? '&#10003;' : ''}
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="habit-card-header">
        <div class="habit-main-col">
          <button type="button" 
                  class="checkin-btn ${isCompletedToday ? 'checked' : ''}" 
                  data-action="toggle-today" 
                  data-id="${habit.id}" 
                  title="${isCompletedToday ? 'Completed today (click to undo)' : 'Mark completed today'}"
                  aria-label="${isCompletedToday ? 'Undo completion for today' : 'Complete habit today'}">
            ${isCompletedToday ? '&#10003;' : ''}
          </button>
          <div class="habit-title-group">
            <div class="habit-badge-row">
              <span class="habit-category-tag">${this.escapeHtml(habit.category || 'General')}</span>
              <span class="streak-badge-inline">&#9889; ${streakInfo.current}d</span>
            </div>
            <h2 class="habit-name">${this.escapeHtml(habit.name)}</h2>
            ${habit.description ? `<p class="habit-description">${this.escapeHtml(habit.description)}</p>` : ''}
          </div>
        </div>
      </div>

      <div class="week-strip">
        ${weekDotsHtml}
      </div>

      <div class="habit-card-footer">
        <div class="streak-badge" title="Current streak / Best streak">
          <span aria-hidden="true">&#9733;</span>
          <span>${streakInfo.current}d streak</span>
          <span class="streak-best-text">(Best: ${streakInfo.longest}d)</span>
        </div>
        <div class="card-actions">
          <a href="add-habit.html?edit=${encodeURIComponent(habit.id)}" class="btn-text-action" title="Edit habit">Edit</a>
          <button type="button" class="btn-text-action" data-action="toggle-archive" data-id="${habit.id}" title="${habit.archived ? 'Restore habit' : 'Archive habit'}">
            ${habit.archived ? 'Restore' : 'Archive'}
          </button>
          <button type="button" class="btn-text-action action-delete" data-action="delete" data-id="${habit.id}" title="Delete habit">
            &times;
          </button>
        </div>
      </div>
    `;

    // Event Listeners on Card
    const checkinBtn = card.querySelector('[data-action="toggle-today"]');
    checkinBtn.addEventListener('click', () => {
      const res = Habits.toggleCompletion(habit.id, todayISO);
      if (res.success) {
        UI.showToast(res.completed ? `Checked off: ${habit.name}` : `Undone: ${habit.name}`);
        this.refreshAll();
      }
    });

    // Mini week dots click (allow quick check/uncheck for past 7 days - FR-09)
    card.querySelectorAll('.day-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const date = dot.dataset.date;
        const res = Habits.toggleCompletion(habit.id, date);
        if (res.success) {
          UI.showToast(res.completed ? `Logged for ${date}` : `Removed log for ${date}`);
          this.refreshAll();
        } else if (res.message) {
          UI.showToast(res.message);
        }
      });
    });

    // Archive button
    const archiveBtn = card.querySelector('[data-action="toggle-archive"]');
    archiveBtn.addEventListener('click', () => {
      const updated = Habits.toggleArchive(habit.id);
      UI.showToast(updated.archived ? `Archived: ${habit.name}` : `Restored: ${habit.name}`);
      this.refreshAll();
    });

    // Delete button
    const deleteBtn = card.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener('click', () => {
      this.habitToDeleteId = habit.id;
      const modalHabitName = document.getElementById('delete-habit-name');
      if (modalHabitName) modalHabitName.textContent = habit.name;
      UI.openModal('delete-modal');
    });

    return card;
  },

  setupDeleteModal() {
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const cancelBtn = document.getElementById('cancel-delete-btn');

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (this.habitToDeleteId) {
          const habit = Habits.getById(this.habitToDeleteId);
          Habits.delete(this.habitToDeleteId);
          UI.showToast(`Deleted habit${habit ? ': ' + habit.name : ''}`);
          this.habitToDeleteId = null;
          UI.closeModal('delete-modal');
          this.refreshAll();
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.habitToDeleteId = null;
        UI.closeModal('delete-modal');
      });
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

/* ==========================================================================
   PAGE: ADD / EDIT HABIT (add-habit.html)
   ========================================================================== */
const AddEditPage = {
  editingId: null,
  selectedDays: [0, 1, 2, 3, 4, 5, 6], // default daily

  init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.editingId = urlParams.get('edit');

    this.setupWeekdayPickers();
    this.setupCharacterCounters();
    this.setupForm();

    if (this.editingId) {
      this.loadHabitForEdit(this.editingId);
    } else {
      // Set default start date to today
      const startInput = document.getElementById('habit-start-date');
      if (startInput) {
        startInput.value = formatDateToISO();
        startInput.max = formatDateToISO(); // prevent future dates
      }
    }
  },

  setupWeekdayPickers() {
    const buttons = document.querySelectorAll('.weekday-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const day = parseInt(btn.dataset.day, 10);
        if (this.selectedDays.includes(day)) {
          if (this.selectedDays.length === 1) {
            UI.showToast('At least one day must be scheduled.');
            return;
          }
          this.selectedDays = this.selectedDays.filter(d => d !== day);
          btn.classList.remove('selected');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          this.selectedDays.push(day);
          this.selectedDays.sort((a, b) => a - b);
          btn.classList.add('selected');
          btn.setAttribute('aria-pressed', 'true');
        }
        this.clearFieldError('frequency');
      });
    });

    // Preset Buttons
    const btnAll = document.getElementById('preset-all');
    const btnWeekdays = document.getElementById('preset-weekdays');
    const btnWeekends = document.getElementById('preset-weekends');

    if (btnAll) {
      btnAll.addEventListener('click', () => {
        this.selectedDays = [0, 1, 2, 3, 4, 5, 6];
        this.syncWeekdayButtons();
      });
    }

    if (btnWeekdays) {
      btnWeekdays.addEventListener('click', () => {
        this.selectedDays = [1, 2, 3, 4, 5];
        this.syncWeekdayButtons();
      });
    }

    if (btnWeekends) {
      btnWeekends.addEventListener('click', () => {
        this.selectedDays = [0, 6];
        this.syncWeekdayButtons();
      });
    }
  },

  syncWeekdayButtons() {
    document.querySelectorAll('.weekday-btn').forEach(btn => {
      const day = parseInt(btn.dataset.day, 10);
      const isSelected = this.selectedDays.includes(day);
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
    this.clearFieldError('frequency');
  },

  setupCharacterCounters() {
    const nameInput = document.getElementById('habit-name');
    const nameCounter = document.getElementById('name-counter');
    if (nameInput && nameCounter) {
      nameInput.addEventListener('input', () => {
        nameCounter.textContent = `${nameInput.value.length} / 50`;
        this.clearFieldError('name');
      });
    }

    const descInput = document.getElementById('habit-desc');
    const descCounter = document.getElementById('desc-counter');
    if (descInput && descCounter) {
      descInput.addEventListener('input', () => {
        descCounter.textContent = `${descInput.value.length} / 200`;
        this.clearFieldError('description');
      });
    }
  },

  loadHabitForEdit(id) {
    const habit = Habits.getById(id);
    if (!habit) {
      UI.showToast('Habit not found');
      window.location.href = 'index.html';
      return;
    }

    const titleEl = document.getElementById('form-page-title');
    const submitBtn = document.getElementById('submit-habit-btn');
    if (titleEl) titleEl.textContent = 'Edit Habit';
    if (submitBtn) submitBtn.textContent = 'Update Habit';

    const nameInput = document.getElementById('habit-name');
    const descInput = document.getElementById('habit-desc');
    const catInput = document.getElementById('habit-category');
    const startInput = document.getElementById('habit-start-date');

    if (nameInput) {
      nameInput.value = habit.name;
      document.getElementById('name-counter').textContent = `${habit.name.length} / 50`;
    }
    if (descInput && habit.description) {
      descInput.value = habit.description;
      document.getElementById('desc-counter').textContent = `${habit.description.length} / 200`;
    }
    if (catInput && habit.category) {
      catInput.value = habit.category;
    }
    if (startInput && habit.startDate) {
      startInput.value = habit.startDate;
      startInput.max = formatDateToISO();
    }

    if (Array.isArray(habit.frequency)) {
      this.selectedDays = [...habit.frequency];
      this.syncWeekdayButtons();
    }
  },

  setupForm() {
    const form = document.getElementById('habit-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('habit-name');
      const descInput = document.getElementById('habit-desc');
      const catInput = document.getElementById('habit-category');
      const startInput = document.getElementById('habit-start-date');

      const habitData = {
        name: nameInput.value,
        description: descInput.value,
        category: catInput.value,
        startDate: startInput.value,
        frequency: this.selectedDays
      };

      if (this.editingId) {
        const res = Habits.update(this.editingId, habitData);
        if (res.success) {
          UI.showToast('Habit successfully updated');
          window.location.href = 'index.html';
        } else {
          this.displayFormErrors(res.errors);
        }
      } else {
        const res = Habits.create(habitData);
        if (res.success) {
          UI.showToast('New habit created!');
          window.location.href = 'index.html';
        } else {
          this.displayFormErrors(res.errors);
        }
      }
    });
  },

  displayFormErrors(errors) {
    // Clear old errors
    document.querySelectorAll('.inline-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('show');
    });
    document.querySelectorAll('.form-input, .form-textarea').forEach(el => {
      el.classList.remove('has-error');
    });

    for (const [field, msg] of Object.entries(errors)) {
      const errEl = document.getElementById(`error-${field}`);
      const inputEl = document.getElementById(`habit-${field}`);
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.add('show');
      }
      if (inputEl) {
        inputEl.classList.add('has-error');
      }
    }
  },

  clearFieldError(field) {
    const errEl = document.getElementById(`error-${field}`);
    const inputEl = document.getElementById(`habit-${field}`);
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.remove('show');
    }
    if (inputEl) {
      inputEl.classList.remove('has-error');
    }
  }
};

/* ==========================================================================
   PAGE: PROGRESS & ANALYTICS (progress.html)
   ========================================================================== */
const ProgressPage = {
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedCalDate: null,

  init() {
    this.renderKPIs();
    this.renderTrendChart();
    this.renderCalendar();
    this.renderPerformanceTable();
    this.renderBadges();
    this.setupCalendarModal();
  },

  renderKPIs() {
    const summary = Stats.getDashboardSummary();
    const todayPct = document.getElementById('prog-today-pct');
    const bestStreak = document.getElementById('prog-best-streak');
    const totalCompletions = document.getElementById('prog-total-completions');
    const activeHabits = document.getElementById('prog-active-habits');

    if (todayPct) todayPct.textContent = `${summary.todayPercentage}%`;
    if (bestStreak) bestStreak.textContent = `${summary.bestCurrentStreak}d`;
    if (totalCompletions) totalCompletions.textContent = summary.totalCompletions;
    if (activeHabits) activeHabits.textContent = summary.activeHabitsCount;
  },

  renderTrendChart() {
    const container = document.getElementById('trend-chart-container');
    if (!container) return;

    const trends = Stats.getDailyTrends(14);
    const height = 180;
    const width = 640;
    const padX = 40;
    const padY = 25;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;
    const barWidth = Math.floor(chartW / trends.length) - 8;

    let barsSvg = '';
    let labelsSvg = '';

    trends.forEach((t, i) => {
      const x = padX + i * (chartW / trends.length) + 4;
      const pct = t.percent;
      const bHeight = Math.max(4, Math.round((pct / 100) * chartH));
      const y = height - padY - bHeight;

      barsSvg += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${bHeight}" fill="currentColor" rx="2">
          <title>${t.date}: ${t.completedCount}/${t.scheduledCount} (${pct}%)</title>
        </rect>
      `;

      labelsSvg += `
        <text x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">
          ${t.dayName}
        </text>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; max-height: 220px; color: var(--fg-primary);">
        <!-- Base Axis Line -->
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="currentColor" stroke-width="1.5" />
        <!-- Top Reference 100% Line -->
        <line x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}" stroke="currentColor" stroke-dasharray="3,3" opacity="0.3" stroke-width="1" />
        <text x="${padX - 8}" y="${padY + 4}" text-anchor="end" font-size="10" fill="currentColor" opacity="0.7">100%</text>
        <text x="${padX - 8}" y="${height - padY}" text-anchor="end" font-size="10" fill="currentColor" opacity="0.7">0%</text>
        ${barsSvg}
        ${labelsSvg}
      </svg>
    `;
  },

  renderCalendar() {
    const calData = Stats.getMonthCalendar(this.calYear, this.calMonth);
    const titleEl = document.getElementById('cal-month-title');
    const gridEl = document.getElementById('calendar-days-grid');
    if (!gridEl) return;

    if (titleEl) {
      titleEl.textContent = `${calData.monthName} ${calData.year}`;
    }

    gridEl.innerHTML = '';
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
      const headerCell = document.createElement('div');
      headerCell.className = 'cal-header-cell';
      headerCell.textContent = day;
      gridEl.appendChild(headerCell);
    });

    calData.weeks.forEach(week => {
      week.forEach(dayObj => {
        const cell = document.createElement('div');
        if (!dayObj) {
          cell.className = 'cal-day-cell empty';
          gridEl.appendChild(cell);
          return;
        }

        cell.className = `cal-day-cell ${dayObj.isToday ? 'today' : ''} ${dayObj.isFuture ? 'future' : ''}`;
        cell.dataset.date = dayObj.dateISO;

        let badgeHtml = '';
        if (dayObj.scheduled > 0) {
          badgeHtml = `<span class="cal-completion-pill">${dayObj.completed}/${dayObj.scheduled}</span>`;
        }

        cell.innerHTML = `
          <span style="font-weight: 700;">${dayObj.day}</span>
          ${badgeHtml}
        `;

        if (!dayObj.isFuture) {
          cell.addEventListener('click', () => {
            this.openDayModal(dayObj);
          });
        }

        gridEl.appendChild(cell);
      });
    });

    // Calendar month nav buttons
    const prevBtn = document.getElementById('cal-prev-btn');
    const nextBtn = document.getElementById('cal-next-btn');

    if (prevBtn && !prevBtn.dataset.bound) {
      prevBtn.dataset.bound = 'true';
      prevBtn.addEventListener('click', () => {
        this.calMonth--;
        if (this.calMonth < 0) {
          this.calMonth = 11;
          this.calYear--;
        }
        this.renderCalendar();
      });
    }

    if (nextBtn && !nextBtn.dataset.bound) {
      nextBtn.dataset.bound = 'true';
      nextBtn.addEventListener('click', () => {
        this.calMonth++;
        if (this.calMonth > 11) {
          this.calMonth = 0;
          this.calYear++;
        }
        this.renderCalendar();
      });
    }
  },

  openDayModal(dayObj) {
    this.selectedCalDate = dayObj.dateISO;
    const modalTitle = document.getElementById('day-modal-date');
    const listEl = document.getElementById('day-habits-list');
    if (modalTitle) modalTitle.textContent = `Habits for ${dayObj.dateISO}`;

    if (!listEl) return;
    listEl.innerHTML = '';

    if (!dayObj.habitDetails || dayObj.habitDetails.length === 0) {
      listEl.innerHTML = '<p style="color: var(--fg-secondary);">No habits were active on this date.</p>';
      UI.openModal('day-modal');
      return;
    }

    dayObj.habitDetails.forEach(h => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '0.75rem 0';
      row.style.borderBottom = '1px solid var(--border-subtle)';

      row.innerHTML = `
        <div>
          <strong style="display: block;">${this.escapeHtml(h.name)}</strong>
          <small style="color: var(--fg-secondary);">${h.scheduled ? 'Scheduled Day' : 'Rest Day'}</small>
        </div>
        <button type="button" class="btn btn-sm ${h.completed ? 'btn-primary' : ''}" data-habit-id="${h.id}">
          ${h.completed ? '&#10003; Done' : 'Mark Done'}
        </button>
      `;

      const btn = row.querySelector('button');
      btn.addEventListener('click', () => {
        const res = Habits.toggleCompletion(h.id, dayObj.dateISO);
        if (res.success) {
          UI.showToast(res.completed ? `Marked done for ${dayObj.dateISO}` : `Undone for ${dayObj.dateISO}`);
          // Refresh state
          this.renderKPIs();
          this.renderCalendar();
          this.renderTrendChart();
          this.renderPerformanceTable();
          UI.closeModal('day-modal');
        } else if (res.message) {
          UI.showToast(res.message);
        }
      });

      listEl.appendChild(row);
    });

    UI.openModal('day-modal');
  },

  setupCalendarModal() {
    const closeBtn = document.getElementById('close-day-modal-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        UI.closeModal('day-modal');
      });
    }
  },

  renderPerformanceTable() {
    const tbody = document.getElementById('performance-table-body');
    if (!tbody) return;

    const habits = Habits.getAll(false);
    if (habits.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">No active habits found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    habits.forEach(h => {
      const perf = Stats.getHabitPerformance(h);
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-subtle)';

      tr.innerHTML = `
        <td style="padding: 0.85rem 0.5rem; font-weight: 700;">${this.escapeHtml(h.name)}</td>
        <td style="padding: 0.85rem 0.5rem;"><span class="habit-category-tag">${this.escapeHtml(h.category || 'General')}</span></td>
        <td style="padding: 0.85rem 0.5rem; font-variant-numeric: tabular-nums;">${perf.rate7}%</td>
        <td style="padding: 0.85rem 0.5rem; font-variant-numeric: tabular-nums;">${perf.rate30}%</td>
        <td style="padding: 0.85rem 0.5rem; font-variant-numeric: tabular-nums;">${perf.rateAll}%</td>
        <td style="padding: 0.85rem 0.5rem; font-variant-numeric: tabular-nums;"><strong>${perf.currentStreak}d</strong> (Max: ${perf.longestStreak}d)</td>
      `;
      tbody.appendChild(tr);
    });
  },

  renderBadges() {
    const container = document.getElementById('badges-grid');
    if (!container) return;

    const badges = Stats.getMilestoneBadges();
    container.innerHTML = '';

    badges.forEach(b => {
      const card = document.createElement('div');
      card.className = `badge-card ${b.unlocked ? '' : 'locked'}`;

      card.innerHTML = `
        <div class="badge-icon-box" aria-hidden="true">
          ${b.unlocked ? '&#9733;' : '&#9744;'}
        </div>
        <div>
          <strong style="display: block; font-size: 0.95rem;">${b.title}</strong>
          <p style="font-size: 0.8rem; color: var(--fg-secondary); margin: 0.2rem 0;">${b.desc}</p>
          <span style="font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums;">
            ${b.unlocked ? '&#10003; Achieved' : b.progress}
          </span>
        </div>
      `;
      container.appendChild(card);
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

/* ==========================================================================
   PAGE: SETTINGS (settings.html)
   ========================================================================== */
const SettingsPage = {
  init() {
    this.loadSettings();
    this.setupListeners();
    this.updateStorageMeter();
  },

  loadSettings() {
    const settings = Storage.getSettings();

    // Theme Radios
    const themeInputs = document.querySelectorAll('input[name="theme-choice"]');
    themeInputs.forEach(input => {
      if (input.value === settings.theme) input.checked = true;
    });

    // Color Scheme Radios
    const schemeInputs = document.querySelectorAll('input[name="scheme-choice"]');
    schemeInputs.forEach(input => {
      if (input.value === (settings.colorScheme || 'monochrome')) input.checked = true;
    });

    // Display Name
    const nameInput = document.getElementById('settings-display-name');
    if (nameInput) {
      nameInput.value = settings.displayName || '';
    }
  },

  setupListeners() {
    // Theme Choice Change
    document.querySelectorAll('input[name="theme-choice"]').forEach(input => {
      input.addEventListener('change', (e) => {
        Storage.saveSettings({ theme: e.target.value });
        UI.applyTheme();
        UI.showToast(`Theme updated to ${e.target.value}`);
      });
    });

    // Scheme Choice Change
    document.querySelectorAll('input[name="scheme-choice"]').forEach(input => {
      input.addEventListener('change', (e) => {
        Storage.saveSettings({ colorScheme: e.target.value });
        UI.applyTheme();
        UI.showToast(`Palette updated to ${e.target.value}`);
      });
    });

    // Display Name Save
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('settings-display-name');
        const displayName = nameInput ? nameInput.value.trim() : '';
        Storage.saveSettings({ displayName });
        UI.setupStatusBar();
        UI.showToast('Profile greeting updated!');
      });
    }

    // Export Data (FR-29)
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        Storage.exportData();
        UI.showToast('JSON backup downloaded');
      });
    }

    // Import Data (FR-30)
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target.result;
          if (confirm('Importing this file will overwrite existing habits and logs. Do you want to proceed?')) {
            const res = Storage.importData(content);
            if (res.success) {
              UI.showToast(`Restored ${res.stats.habitsCount} habits & ${res.stats.logsCount} logs!`);
              setTimeout(() => window.location.href = 'index.html', 1000);
            } else {
              UI.showToast(`Import failed: ${res.message}`);
            }
          }
          fileInput.value = ''; // reset
        };
        reader.readAsText(file);
      });
    }

    // Reset All Data (FR-31)
    const resetBtn = document.getElementById('reset-all-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('CAUTION: Are you sure you want to delete all habits and logs? This action cannot be undone.')) {
          Storage.clearAll();
          UI.showToast('All habit tracking data cleared.');
          setTimeout(() => window.location.href = 'index.html', 800);
        }
      });
    }

    // Load Demo Starter Habits
    const seedBtn = document.getElementById('seed-demo-btn');
    if (seedBtn) {
      seedBtn.addEventListener('click', () => {
        Storage.clearAll();
        Storage.seedInitialDataIfEmpty();
        UI.showToast('Sample habits and logs loaded!');
        setTimeout(() => window.location.href = 'index.html', 800);
      });
    }
  },

  updateStorageMeter() {
    const meterEl = document.getElementById('storage-usage-meter');
    if (!meterEl) return;
    const bytes = Storage.getStorageUsage();
    const kb = (bytes / 1024).toFixed(2);
    meterEl.textContent = `${kb} KB of ~5,000 KB (LocalStorage)`;
  }
};

/* ==========================================================================
   GLOBAL APP BOOTSTRAP
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme & scheme immediately
  UI.applyTheme();
  UI.setupStatusBar();
  UI.highlightActiveNav();
  UI.setupShortcuts();

  // Bind global theme toggle button in header
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => UI.toggleTheme());
  }

  // Detect and initialize active page
  const path = window.location.pathname.toLowerCase();
  if (path.includes('add-habit.html')) {
    AddEditPage.init();
  } else if (path.includes('progress.html')) {
    ProgressPage.init();
  } else if (path.includes('settings.html')) {
    SettingsPage.init();
  } else {
    // Default to Dashboard
    DashboardPage.init();
  }
});
