const test = require('node:test');
const assert = require('node:assert/strict');
const { addMonths, addDays, buildPeriods, isValidDate } = require('../src/utils/dates');

test('addMonths clamps to end of month', () => {
  assert.equal(addMonths('2025-01-31', 1), '2025-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2025-11-15', 3), '2026-02-15');
});
test('addDays crosses month and year', () => {
  assert.equal(addDays('2025-12-31', 1), '2026-01-01');
  assert.equal(addDays('2025-03-01', -1), '2025-02-28');
});
test('isValidDate', () => {
  assert.equal(isValidDate('2025-02-29'), false);
  assert.equal(isValidDate('2024-02-29'), true);
  assert.equal(isValidDate('2025-1-1'), false);
});
test('yearly plan billed yearly = 1 period', () => {
  const { periods, endDate } = buildPeriods('2025-01-01', 12, 12);
  assert.equal(periods.length, 1);
  assert.equal(endDate, '2025-12-31');
  assert.equal(periods[0].due_date, '2025-01-01');
});
test('12-month term billed monthly = 12 periods, no gaps', () => {
  const { periods, endDate } = buildPeriods('2025-01-31', 12, 1);
  assert.equal(periods.length, 12);
  assert.equal(endDate, '2026-01-30');
  for (let i = 1; i < periods.length; i++) {
    assert.equal(addDays(periods[i - 1].period_end, 1), periods[i].period_start);
  }
});
test('last period is cut at term end (10-month term, 6-month billing)', () => {
  const { periods, endDate } = buildPeriods('2025-01-01', 10, 6);
  assert.equal(periods.length, 2);
  assert.equal(periods[1].period_end, endDate);
});
