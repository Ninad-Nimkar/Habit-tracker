/**
 * stats.js - Analytics, Rates, Badges, and Chart Data Generator
 * Compliant with FR-16, FR-17, FR-18, FR-19, FR-20, FR-26
 */

const Stats = {
  /**
   * Get high-level summary metrics for dashboard
   * @returns {Object}
   */
  getDashboardSummary() {
    const habits = Habits.getAll(false); // active habits
    const logs = Storage.getLogs();
    const today = new Date();
    const todayISO = formatDateToISO(today);

    // Filter habits scheduled for today
    const scheduledToday = habits.filter(h => Streaks.isScheduled(h, today));
    const completedToday = scheduledToday.filter(h => (logs[h.id] || []).includes(todayISO));

    const todayPercentage = scheduledToday.length > 0 
      ? Math.round((completedToday.length / scheduledToday.length) * 100) 
      : 0;

    // Calculate total completions across all habits
    let totalCompletions = 0;
    for (const hId in logs) {
      if (Array.isArray(logs[hId])) {
        totalCompletions += logs[hId].length;
      }
    }

    // Best current streak & best all-time streak across all active habits
    let bestCurrentStreak = 0;
    let bestAllTimeStreak = 0;
    let bestHabitName = '';

    habits.forEach(h => {
      const hLogs = logs[h.id] || [];
      const cur = Streaks.calculateCurrent(h, hLogs, today);
      const longest = Streaks.calculateLongest(h, hLogs, today);
      if (cur > bestCurrentStreak) {
        bestCurrentStreak = cur;
      }
      if (longest > bestAllTimeStreak) {
        bestAllTimeStreak = longest;
        bestHabitName = h.name;
      }
    });

    return {
      scheduledTodayCount: scheduledToday.length,
      completedTodayCount: completedToday.length,
      todayPercentage,
      activeHabitsCount: habits.length,
      totalCompletions,
      bestCurrentStreak,
      bestAllTimeStreak,
      bestHabitName
    };
  },

  /**
   * Calculate completion rate for a habit over a period
   * @param {Object} habit 
   * @param {number} daysCount - 7, 30, or null for all-time
   * @returns {{ rate: number, completedCount: number, scheduledCount: number }}
   */
  getHabitRate(habit, daysCount = 7) {
    if (!habit) return { rate: 0, completedCount: 0, scheduledCount: 0 };
    const logs = Storage.getLogs()[habit.id] || [];
    const logSet = new Set(logs);

    const today = new Date();
    const todayISO = formatDateToISO(today);
    const startISO = habit.startDate || todayISO;

    let scheduledCount = 0;
    let completedCount = 0;

    const daysToCheck = daysCount || 365; // default max 1 year for all-time calculation
    const checkDate = new Date(today);

    for (let i = 0; i < daysToCheck; i++) {
      const dateISO = formatDateToISO(checkDate);
      if (dateISO < startISO) {
        // Reached start date of habit
        break;
      }

      if (Streaks.isScheduled(habit, checkDate)) {
        scheduledCount++;
        if (logSet.has(dateISO)) {
          completedCount++;
        }
      }

      checkDate.setDate(checkDate.getDate() - 1);
    }

    const rate = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;
    return {
      rate,
      completedCount,
      scheduledCount
    };
  },

  /**
   * Get completion rate comparison for last 7 days, 30 days, and all-time (FR-17)
   * @param {Object} habit 
   * @returns {Object}
   */
  getHabitPerformance(habit) {
    const rate7 = this.getHabitRate(habit, 7);
    const rate30 = this.getHabitRate(habit, 30);
    const rateAll = this.getHabitRate(habit, null);
    const logs = Storage.getLogs()[habit.id] || [];

    return {
      habit,
      rate7: rate7.rate,
      rate30: rate30.rate,
      rateAll: rateAll.rate,
      totalCompletions: logs.length,
      currentStreak: Streaks.calculateCurrent(habit, logs),
      longestStreak: Streaks.calculateLongest(habit, logs)
    };
  },

  /**
   * Daily completion trends over past N days (for SVG bar/line chart)
   * @param {number} days 
   * @returns {Array<Object>}
   */
  getDailyTrends(days = 14) {
    const habits = Habits.getAll(false);
    const logs = Storage.getLogs();
    const result = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateISO = formatDateToISO(d);
      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      const dayNum = d.getDate();

      // Count scheduled and completed habits for this day
      let scheduledCount = 0;
      let completedCount = 0;

      habits.forEach(h => {
        if (h.startDate && dateISO < h.startDate) return;
        if (Streaks.isScheduled(h, d)) {
          scheduledCount++;
          if ((logs[h.id] || []).includes(dateISO)) {
            completedCount++;
          }
        }
      });

      const percent = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;

      result.push({
        date: dateISO,
        dayName,
        dayNum,
        completedCount,
        scheduledCount,
        percent
      });
    }

    return result;
  },

  /**
   * Calendar month matrix for interactive history view (FR-20)
   * @param {number} year 
   * @param {number} month (0-indexed, 0 = Jan)
   * @returns {Object}
   */
  getMonthCalendar(year, month) {
    const habits = Habits.getAll(false);
    const logs = Storage.getLogs();
    const todayISO = formatDateToISO();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sun

    const weeks = [];
    let currentWeek = [];

    // Fill blank slots for preceding month
    for (let i = 0; i < startingDayOfWeek; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateISO = formatDateToISO(d);
      const isFuture = dateISO > todayISO;
      const isToday = dateISO === todayISO;

      // Count scheduled & completed
      let scheduled = 0;
      let completed = 0;
      const habitDetails = [];

      habits.forEach(h => {
        const isSched = Streaks.isScheduled(h, d);
        const isHabitValidForDate = !h.startDate || dateISO >= h.startDate;
        const isDone = (logs[h.id] || []).includes(dateISO);

        if (isSched && isHabitValidForDate) {
          scheduled++;
          if (isDone) completed++;
        }

        if (isHabitValidForDate) {
          habitDetails.push({
            id: h.id,
            name: h.name,
            scheduled: isSched,
            completed: isDone
          });
        }
      });

      const percent = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;

      currentWeek.push({
        day,
        dateISO,
        isToday,
        isFuture,
        scheduled,
        completed,
        percent,
        habitDetails
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Fill remaining empty days in the last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return {
      year,
      month,
      monthName: firstDay.toLocaleString(undefined, { month: 'long' }),
      weeks
    };
  },

  /**
   * Milestone badges and status (FR-26)
   * @returns {Array<Object>}
   */
  getMilestoneBadges() {
    const summary = this.getDashboardSummary();
    const habits = Habits.getAll(false);
    const logs = Storage.getLogs();

    let maxSingleStreak = 0;
    habits.forEach(h => {
      const s = Streaks.calculateLongest(h, logs[h.id] || []);
      if (s > maxSingleStreak) maxSingleStreak = s;
    });

    const badges = [
      {
        id: 'first_step',
        title: 'First Step',
        desc: 'Log your very first habit completion',
        unlocked: summary.totalCompletions >= 1,
        progress: `${Math.min(summary.totalCompletions, 1)} / 1`
      },
      {
        id: 'streak_3',
        title: 'Ignition (3 Days)',
        desc: 'Maintain a 3-day consecutive streak',
        unlocked: maxSingleStreak >= 3,
        progress: `${Math.min(maxSingleStreak, 3)} / 3 days`
      },
      {
        id: 'streak_7',
        title: 'Week Warrior (7 Days)',
        desc: 'Achieve a full 7-day unbroken streak',
        unlocked: maxSingleStreak >= 7,
        progress: `${Math.min(maxSingleStreak, 7)} / 7 days`
      },
      {
        id: 'streak_21',
        title: 'Habit Formed (21 Days)',
        desc: 'Science-backed 21 days of persistence',
        unlocked: maxSingleStreak >= 21,
        progress: `${Math.min(maxSingleStreak, 21)} / 21 days`
      },
      {
        id: 'streak_30',
        title: 'Monthly Mastery (30 Days)',
        desc: 'Flawless 30 consecutive days',
        unlocked: maxSingleStreak >= 30,
        progress: `${Math.min(maxSingleStreak, 30)} / 30 days`
      },
      {
        id: 'century',
        title: 'Century Club (100 Logs)',
        desc: 'Record 100 total habit check-ins',
        unlocked: summary.totalCompletions >= 100,
        progress: `${Math.min(summary.totalCompletions, 100)} / 100 logs`
      },
      {
        id: 'perfect_day',
        title: 'Flawless Day (100%)',
        desc: 'Complete all scheduled habits today',
        unlocked: summary.scheduledTodayCount > 0 && summary.todayPercentage === 100,
        progress: summary.scheduledTodayCount > 0 ? `${summary.todayPercentage}% today` : '0%'
      }
    ];

    return badges;
  }
};

