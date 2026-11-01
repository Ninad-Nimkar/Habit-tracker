/**
 * habits.js - Habit CRUD and Data Validation
 * Compliant with IEEE 830 SRS for Personal Habit Tracker
 */

const Habits = {
  /**
   * Validate habit data against SRS Section 9 rules
   * @param {Object} data 
   * @param {string|null} currentHabitId - Pass when editing to ignore self for uniqueness check
   * @returns {{ isValid: boolean, errors: Object.<string, string> }}
   */
  validate(data, currentHabitId = null) {
    const errors = {};
    const name = (data.name || '').trim();
    const description = (data.description || '').trim();
    const startDate = (data.startDate || '').trim();
    const frequency = Array.isArray(data.frequency) ? data.frequency : [];

    // Habit Name: Required, 1 to 50 characters, not only whitespace
    if (!name || name.length > 50) {
      errors.name = 'Please enter a habit name (max 50 characters).';
    } else {
      // Must be unique among active habits (case-insensitive)
      const existing = Storage.getHabits();
      const duplicate = existing.find(h => 
        !h.archived && 
        h.id !== currentHabitId && 
        h.name.trim().toLowerCase() === name.toLowerCase()
      );
      if (duplicate) {
        errors.name = 'A habit with this name already exists.';
      }
    }

    // Description: Maximum 200 characters
    if (description.length > 200) {
      errors.description = 'Description is too long.';
    }

    // Start Date: Valid date, not in future beyond today
    if (!startDate) {
      errors.startDate = 'Please choose a valid start date.';
    } else {
      const todayISO = formatDateToISO();
      if (startDate > todayISO) {
        errors.startDate = 'Please choose a valid start date (cannot be in the future).';
      }
    }

    // Frequency: At least one weekday selected
    if (!frequency || frequency.length === 0) {
      errors.frequency = 'Select at least one day.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Get all habits
   * @param {boolean} includeArchived 
   * @returns {Array<Object>}
   */
  getAll(includeArchived = true) {
    const habits = Storage.getHabits();
    if (includeArchived) return habits;
    return habits.filter(h => !h.archived);
  },

  /**
   * Get habit by ID
   * @param {string} id 
   * @returns {Object|null}
   */
  getById(id) {
    const habits = Storage.getHabits();
    return habits.find(h => h.id === id) || null;
  },

  /**
   * Create a new habit
   * @param {Object} habitData 
   * @returns {{ success: boolean, habit?: Object, errors?: Object }}
   */
  create(habitData) {
    const validation = this.validate(habitData);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const newHabit = {
      id: 'h_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: habitData.name.trim(),
      description: (habitData.description || '').trim(),
      category: (habitData.category || 'General').trim(),
      frequency: habitData.frequency && habitData.frequency.length > 0 
        ? habitData.frequency.sort((a, b) => a - b) 
        : [0, 1, 2, 3, 4, 5, 6],
      color: habitData.color || '#111111',
      startDate: habitData.startDate || formatDateToISO(),
      archived: false,
      createdAt: new Date().toISOString()
    };

    const habits = Storage.getHabits();
    habits.unshift(newHabit);
    Storage.saveHabits(habits);

    // Initialize empty logs array for this habit
    const logs = Storage.getLogs();
    if (!logs[newHabit.id]) {
      logs[newHabit.id] = [];
      Storage.saveLogs(logs);
    }

    return { success: true, habit: newHabit };
  },

  /**
   * Update an existing habit
   * @param {string} id 
   * @param {Object} updates 
   * @returns {{ success: boolean, habit?: Object, errors?: Object }}
   */
  update(id, updates) {
    const habits = Storage.getHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) {
      return { success: false, errors: { general: 'Habit not found.' } };
    }

    const current = habits[index];
    const merged = { ...current, ...updates };

    const validation = this.validate(merged, id);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const updatedHabit = {
      ...current,
      name: merged.name.trim(),
      description: (merged.description || '').trim(),
      category: (merged.category || 'General').trim(),
      frequency: merged.frequency ? merged.frequency.sort((a, b) => a - b) : current.frequency,
      color: merged.color || current.color,
      startDate: merged.startDate || current.startDate
    };

    habits[index] = updatedHabit;
    Storage.saveHabits(habits);
    return { success: true, habit: updatedHabit };
  },

  /**
   * Toggle archive state
   * @param {string} id 
   * @returns {Object|null}
   */
  toggleArchive(id) {
    const habits = Storage.getHabits();
    const habit = habits.find(h => h.id === id);
    if (!habit) return null;

    habit.archived = !habit.archived;
    Storage.saveHabits(habits);
    return habit;
  },

  /**
   * Delete habit and all associated logs (FR-04)
   * @param {string} id 
   * @returns {boolean}
   */
  delete(id) {
    const habits = Storage.getHabits();
    const filtered = habits.filter(h => h.id !== id);
    if (filtered.length === habits.length) return false;

    Storage.saveHabits(filtered);

    // Clean up logs
    const logs = Storage.getLogs();
    if (logs[id]) {
      delete logs[id];
      Storage.saveLogs(logs);
    }

    return true;
  },

  /**
   * Toggle completion for a specific date (FR-07, FR-08, FR-09, FR-10)
   * @param {string} habitId 
   * @param {string} dateISO - YYYY-MM-DD
   * @returns {{ success: boolean, completed: boolean, message?: string }}
   */
  toggleCompletion(habitId, dateISO = formatDateToISO()) {
    const todayISO = formatDateToISO();
    // FR-10: Prevent marking completion for future dates
    if (dateISO > todayISO) {
      return { success: false, completed: false, message: 'Cannot mark completion for future dates.' };
    }

    const habit = this.getById(habitId);
    if (!habit) {
      return { success: false, completed: false, message: 'Habit not found.' };
    }

    // Must not be before habit start date
    if (habit.startDate && dateISO < habit.startDate) {
      return { success: false, completed: false, message: `Habit started on ${habit.startDate}. Cannot log before start date.` };
    }

    const logs = Storage.getLogs();
    const habitLogs = logs[habitId] || [];
    const index = habitLogs.indexOf(dateISO);

    let completed = false;
    if (index >= 0) {
      // Already complete -> undo completion (FR-08)
      habitLogs.splice(index, 1);
      completed = false;
    } else {
      // Mark complete (FR-07)
      habitLogs.push(dateISO);
      habitLogs.sort();
      completed = true;
    }

    logs[habitId] = habitLogs;
    Storage.saveLogs(logs);

    return { success: true, completed };
  },

  /**
   * Check if habit is completed on a specific date
   * @param {string} habitId 
   * @param {string} dateISO 
   * @returns {boolean}
   */
  isCompletedOn(habitId, dateISO = formatDateToISO()) {
    const logs = Storage.getLogs();
    const habitLogs = logs[habitId] || [];
    return habitLogs.includes(dateISO);
  },

  /**
   * Get completion history for a habit
   * @param {string} habitId 
   * @returns {Array<string>}
   */
  getHistory(habitId) {
    const logs = Storage.getLogs();
    return logs[habitId] || [];
  }
};

