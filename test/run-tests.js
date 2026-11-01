/**
 * run-tests.js - Automated Test Runner for Personal Habit Tracker
 * Verifies compliance with IEEE 830 SRS Test Cases (TC-01 through TC-09)
 */

// Mock browser LocalStorage in Node.js
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new LocalStorageMock();
global.window = { location: { search: '', pathname: '/index.html' } };
global.document = {
  documentElement: {
    setAttribute: (k, v) => {},
    getAttribute: (k) => 'light'
  }
};

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScript(relPath) {
  const code = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf-8');
  vm.runInThisContext(code);
}

loadScript('js/storage.js');
loadScript('js/streaks.js');
loadScript('js/habits.js');
loadScript('js/stats.js');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failed++;
  }
}

console.log('--- STARTING PERSONAL HABIT TRACKER TEST SUITE ---');

// Setup: Clear storage
Storage.clearAll();

// TC-01: Add habit with valid name
const h1Result = Habits.create({
  name: 'Read Books Daily',
  description: 'Read 20 pages every night',
  category: 'Study',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  startDate: formatDateToISO()
});
assert(h1Result.success === true && h1Result.habit.name === 'Read Books Daily', 'TC-01: Add habit with valid name');

// TC-02: Add habit with empty name
const h2Result = Habits.create({
  name: '   ',
  category: 'Study',
  frequency: [0, 1, 2, 3, 4, 5, 6]
});
assert(h2Result.success === false && !!h2Result.errors.name, 'TC-02: Add habit with empty name triggers error');

// TC-02b: Duplicate active habit name
const duplicateResult = Habits.create({
  name: 'read books daily',
  frequency: [0, 1, 2, 3, 4, 5, 6]
});
assert(duplicateResult.success === false && duplicateResult.errors.name.includes('already exists'), 'Validation: Duplicate habit name rejected');

// TC-03: Mark habit complete - streak increases by 1
const habit = h1Result.habit;
const todayISO = formatDateToISO();
const initialStreak = Streaks.calculateCurrent(habit);
const checkin1 = Habits.toggleCompletion(habit.id, todayISO);
assert(checkin1.success && checkin1.completed, 'TC-03a: Habit marked complete for today');
const streakAfterCheckin = Streaks.calculateCurrent(habit);
assert(streakAfterCheckin === initialStreak + 1, 'TC-03b: Current streak increased by 1');

// TC-04: Undo completion - streak recalculated
const checkinUndo = Habits.toggleCompletion(habit.id, todayISO);
assert(checkinUndo.success && !checkinUndo.completed, 'TC-04a: Completion undone');
const streakAfterUndo = Streaks.calculateCurrent(habit);
assert(streakAfterUndo === initialStreak, 'TC-04b: Streak successfully recalculated after undo');

// TC-05: Miss a scheduled day, then complete - streak resets to 1, longest retained
const pastHabitResult = Habits.create({
  name: 'Exercise Routine',
  frequency: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-10-01'
});
const hPast = pastHabitResult.habit;
const refDate = new Date('2026-10-20');
// 5 days streak: Oct 10, 11, 12, 13, 14
// Missed: Oct 15, 16, 17, 18, 19
// Completed on refDate: Oct 20
const pastLogs = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-20'];
const curStreak = Streaks.calculateCurrent(hPast, pastLogs, refDate);
const longestStreak = Streaks.calculateLongest(hPast, pastLogs, refDate);
assert(curStreak === 1, 'TC-05a: Current streak reset to 1 after missing scheduled days');
assert(longestStreak === 5, 'TC-05b: Longest historical streak (5 days) is preserved');

// TC-06: Delete habit - habit and history removed
const deleteSuccess = Habits.delete(hPast.id);
const retrievedAfterDelete = Habits.getById(hPast.id);
const logsAfterDelete = Storage.getLogs()[hPast.id];
assert(deleteSuccess && retrievedAfterDelete === null && !logsAfterDelete, 'TC-06: Habit and history removed on delete');

// TC-07: Export then import - data restored identically
const exportPayload = {
  version: '1.0',
  exportedAt: new Date().toISOString(),
  habits: Storage.getHabits(),
  logs: Storage.getLogs(),
  settings: Storage.getSettings()
};
const exportJson = JSON.stringify(exportPayload);

// Wipe storage
Storage.clearAll();
assert(Storage.getHabits().length === 0, 'Storage wiped before import test');

// Import back
const importResult = Storage.importData(exportJson);
assert(importResult.success === true, 'TC-07a: Import backup succeeded');
const restoredHabits = Storage.getHabits();
assert(restoredHabits.length === exportPayload.habits.length && restoredHabits[0].name === 'Read Books Daily', 'TC-07b: Habits restored identically');

// TC-08: Import invalid file - error message, existing data unchanged
const corruptImport = Storage.importData('{ invalid json');
assert(corruptImport.success === false, 'TC-08a: Corrupted JSON rejected');
const missingKeysImport = Storage.importData('{"foo": "bar"}');
assert(missingKeysImport.success === false, 'TC-08b: Invalid JSON structure rejected');
assert(Storage.getHabits().length === 1, 'TC-08c: Existing data unchanged after rejected import');

// TC-09: Toggle dark theme and reload - persists
Storage.saveSettings({ theme: 'dark' });
const loadedSettings = Storage.getSettings();
assert(loadedSettings.theme === 'dark', 'TC-09: Theme persistence verified');

console.log(`\nTEST RESULTS: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) process.exit(1);
