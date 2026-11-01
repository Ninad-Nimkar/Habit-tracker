/**
 * streaks.js - Accurate Streak Calculation Engine
 * Compliant with FR-12, FR-13, FR-14, FR-15 and TC-03, TC-04, TC-05
 */

const Streaks = {
  /**
   * Check if a habit is scheduled on a given Date or ISO date string
   * @param {Object} habit 
   * @param {Date|string} date 
   * @returns {boolean}
   */
  isScheduled(habit, date) {
    const d = typeof date === 'string' ? parseISODate(date) : date;
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const freq = habit.frequency || [0, 1, 2, 3, 4, 5, 6];
    return freq.includes(dayOfWeek);
  },

  /**
   * Calculate current streak for a habit
   * Consecutive scheduled days completed up to today.
   * If today is not completed yet, the streak from yesterday (or last scheduled day) is preserved.
   * If last scheduled day was missed, streak is 0.
   * @param {Object} habit 
   * @param {Array<string>} [habitLogs] - optional array of YYYY-MM-DD
   * @param {Date} [referenceDate] - optional date for testing/evaluation (defaults to now)
   * @returns {number}
   */
  calculateCurrent(habit, habitLogs = null, referenceDate = new Date()) {
    if (!habit) return 0;
    const logs = habitLogs || Storage.getLogs()[habit.id] || [];
    const logSet = new Set(logs);

    const ref = new Date(referenceDate);
    const todayISO = formatDateToISO(ref);
    const startISO = habit.startDate || todayISO;

    let streak = 0;
    let checkDate = new Date(ref);

    const isTodayScheduled = this.isScheduled(habit, checkDate);
    const isTodayCompleted = logSet.has(todayISO);

    // If today is scheduled and completed, start with today and streak = 1
    if (isTodayScheduled && isTodayCompleted) {
      streak = 1;
      // Step to yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (isTodayScheduled && !isTodayCompleted) {
      // Today is scheduled but not yet completed.
      // Move to yesterday to check if streak is alive from yesterday.
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Today is NOT scheduled. Move to yesterday to check previous scheduled days.
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Step backwards day by day until start date or a missed scheduled day
    while (true) {
      const dateISO = formatDateToISO(checkDate);
      if (dateISO < startISO) {
        break; // Reached before habit inception
      }

      const scheduled = this.isScheduled(habit, checkDate);
      if (scheduled) {
        if (logSet.has(dateISO)) {
          streak++;
        } else {
          // Missed scheduled day -> streak broken!
          break;
        }
      }
      // Step back one day
      checkDate.setDate(checkDate.getDate() - 1);

      // Safety guard against infinite loops (max 5 years)
      if (streak > 2000) break;
    }

    return streak;
  },

  /**
   * Calculate longest streak (best all-time) for a habit
   * @param {Object} habit 
   * @param {Array<string>} [habitLogs]
   * @param {Date} [referenceDate]
   * @returns {number}
   */
  calculateLongest(habit, habitLogs = null, referenceDate = new Date()) {
    if (!habit) return 0;
    const logs = habitLogs || Storage.getLogs()[habit.id] || [];
    if (!logs || logs.length === 0) return 0;

    const logSet = new Set(logs);
    const todayISO = formatDateToISO(referenceDate);
    const startISO = habit.startDate || todayISO;

    // Start iterating from start date to today
    let iter = parseISODate(startISO);
    const end = parseISODate(todayISO);

    let currentStreak = 0;
    let maxStreak = 0;

    while (iter <= end) {
      const dateISO = formatDateToISO(iter);
      const isToday = (dateISO === todayISO);
      const scheduled = this.isScheduled(habit, iter);

      if (scheduled) {
        if (logSet.has(dateISO)) {
          currentStreak++;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else {
          // If it's today and not yet completed, don't break previous maxStreak
          if (!isToday) {
            currentStreak = 0;
          }
        }
      }

      // Next day
      iter.setDate(iter.getDate() + 1);
    }

    // Ensure maxStreak is at least as large as the current streak
    const current = this.calculateCurrent(habit, logs, referenceDate);
    return Math.max(maxStreak, current);
  },

  /**
   * Get streak information bundle for a habit
   * @param {Object} habit 
   * @returns {{ current: number, longest: number, completedToday: boolean }}
   */
  getStreakInfo(habit) {
    const logs = Storage.getLogs()[habit.id] || [];
    const todayISO = formatDateToISO();
    const completedToday = logs.includes(todayISO);
    const current = this.calculateCurrent(habit, logs);
    const longest = this.calculateLongest(habit, logs);

    return {
      current,
      longest,
      completedToday
    };
  }
};

