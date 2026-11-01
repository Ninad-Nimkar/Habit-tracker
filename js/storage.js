/**
 * storage.js - LocalStorage Persistence & Data Management
 * Compliant with IEEE 830 SRS for Personal Habit Tracker
 */

const STORAGE_KEYS = {
  HABITS: 'pht_habits',
  LOGS: 'pht_logs',
  SETTINGS: 'pht_settings'
};

const DEFAULT_SETTINGS = {
  theme: 'light',
  displayName: '',
  colorScheme: 'monochrome', // 'monochrome' (strict B&W), 'emerald', 'ochre'
  viewMode: 'cards' // 'cards' | 'list'
};

/**
 * Format Date object to local YYYY-MM-DD string
 * @param {Date} date 
 * @returns {string}
 */
function formatDateToISO(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD string into a local Date object (at midnight)
 * @param {string} dateString 
 * @returns {Date}
 */
function parseISODate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Safe LocalStorage abstraction
 */
const Storage = {
  /**
   * Check if LocalStorage is available and working
   */
  isAvailable() {
    try {
      const test = '__pht_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Get all habits
   * @returns {Array<Object>}
   */
  getHabits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HABITS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Error reading habits from LocalStorage:', err);
      return [];
    }
  },

  /**
   * Save all habits
   * @param {Array<Object>} habits 
   */
  saveHabits(habits) {
    try {
      localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
      return true;
    } catch (err) {
      console.error('Error saving habits:', err);
      return false;
    }
  },

  /**
   * Get all completion logs
   * @returns {Object.<string, Array<string>>}
   */
  getLogs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (err) {
      console.error('Error reading logs from LocalStorage:', err);
      return {};
    }
  },

  /**
   * Save all completion logs
   * @param {Object} logs 
   */
  saveLogs(logs) {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      return true;
    } catch (err) {
      console.error('Error saving logs:', err);
      return false;
    }
  },

  /**
   * Get settings
   * @returns {Object}
   */
  getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (err) {
      console.error('Error reading settings from LocalStorage:', err);
      return { ...DEFAULT_SETTINGS };
    }
  },

  /**
   * Save settings
   * @param {Object} settings 
   */
  saveSettings(settings) {
    try {
      const merged = { ...this.getSettings(), ...settings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      return true;
    } catch (err) {
      console.error('Error saving settings:', err);
      return false;
    }
  },

  /**
   * Export all data as a JSON file
   */
  exportData() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      habits: this.getHabits(),
      logs: this.getLogs(),
      settings: this.getSettings()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = formatDateToISO();
    a.href = url;
    a.download = `personal-habit-tracker-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Validate and import JSON data
   * @param {string} jsonString 
   * @returns {{ success: boolean, message: string, stats?: Object }}
   */
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Invalid JSON file structure.' };
      }

      // Check for expected structure
      const hasHabits = Array.isArray(data.habits);
      const hasLogs = data.logs && typeof data.logs === 'object' && !Array.isArray(data.logs);

      if (!hasHabits && !hasLogs) {
        return { success: false, message: 'Invalid file: Missing required habits or logs data.' };
      }

      // Validate each habit
      const validatedHabits = (data.habits || []).filter(h => {
        return h && typeof h === 'object' && typeof h.id === 'string' && typeof h.name === 'string';
      });

      // Validate logs
      const validatedLogs = {};
      if (hasLogs) {
        for (const [habitId, dates] of Object.entries(data.logs)) {
          if (Array.isArray(dates)) {
            validatedLogs[habitId] = dates.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
          }
        }
      }

      this.saveHabits(validatedHabits);
      this.saveLogs(validatedLogs);

      if (data.settings && typeof data.settings === 'object') {
        this.saveSettings(data.settings);
      }

      return {
        success: true,
        message: 'Data successfully restored.',
        stats: {
          habitsCount: validatedHabits.length,
          logsCount: Object.values(validatedLogs).reduce((acc, cur) => acc + cur.length, 0)
        }
      };
    } catch (err) {
      return { success: false, message: `Parse error: ${err.message}` };
    }
  },

  /**
   * Reset all data after confirmation
   */
  clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEYS.HABITS);
      localStorage.removeItem(STORAGE_KEYS.LOGS);
      // Keep theme preference if desired, or reset everything
      const settings = this.getSettings();
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      // Re-save just the theme
      this.saveSettings({ theme: settings.theme });
      return true;
    } catch (err) {
      console.error('Error clearing data:', err);
      return false;
    }
  },

  /**
   * Estimate current storage usage in bytes
   */
  getStorageUsage() {
    let total = 0;
    try {
      for (const key of Object.values(STORAGE_KEYS)) {
        const item = localStorage.getItem(key);
        if (item) total += item.length * 2; // UTF-16 characters = 2 bytes
      }
    } catch (e) {}
    return total;
  },

  /**
   * Seed starter habits if empty
   */
  seedInitialDataIfEmpty() {
    const habits = this.getHabits();
    if (habits.length > 0) return false;

    const today = new Date();
    const dStr = (offsetDays) => {
      const d = new Date(today);
      d.setDate(d.getDate() - offsetDays);
      return formatDateToISO(d);
    };

    const starterHabits = [
      {
        id: 'h_' + (Date.now() - 3000),
        name: 'Drink 2L Water Daily',
        description: 'Stay hydrated with a glass every couple hours',
        category: 'Health',
        frequency: [0, 1, 2, 3, 4, 5, 6],
        color: '#111111',
        startDate: dStr(14),
        archived: false,
        createdAt: new Date(Date.now() - 14 * 86400000).toISOString()
      },
      {
        id: 'h_' + (Date.now() - 2000),
        name: 'Morning Reading (20 min)',
        description: 'Read non-fiction, philosophy, or engineering articles',
        category: 'Study',
        frequency: [1, 2, 3, 4, 5], // Weekdays
        color: '#111111',
        startDate: dStr(10),
        archived: false,
        createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
      },
      {
        id: 'h_' + (Date.now() - 1000),
        name: 'Walk 10,000 Steps / Cardio',
        description: 'Outdoor walk or gym session before sunset',
        category: 'Fitness',
        frequency: [0, 1, 2, 3, 4, 5, 6],
        color: '#111111',
        startDate: dStr(7),
        archived: false,
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
      }
    ];

    // Seed some completions for realistic demonstration
    const starterLogs = {
      [starterHabits[0].id]: [dStr(6), dStr(5), dStr(4), dStr(3), dStr(2), dStr(1), dStr(0)],
      [starterHabits[1].id]: [dStr(4), dStr(3), dStr(2), dStr(1)],
      [starterHabits[2].id]: [dStr(5), dStr(4), dStr(3), dStr(1), dStr(0)]
    };

    this.saveHabits(starterHabits);
    this.saveLogs(starterLogs);
    return true;
  }
};

// Auto-seed if first run
if (Storage.isAvailable()) {
  Storage.seedInitialDataIfEmpty();
}

