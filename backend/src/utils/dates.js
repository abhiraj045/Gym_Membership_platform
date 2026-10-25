// Dates are handled as 'YYYY-MM-DD' strings to avoid timezone bugs.
const pad = (n) => String(n).padStart(2, '0');
const fmt = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parse(s);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Jan 31 + 1 month = Feb 28/29 (day is clamped to the end of the target month).
function addMonths(s, n) {
  const { y, m, d } = parse(s);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

function addDays(s, n) {
  const { y, m, d } = parse(s);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function today(tz = process.env.APP_TIMEZONE || 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

// Split a membership term into billing periods. Fee is due at the START of each period.
// Offsets are always computed from the original start date so month-end clamping never drifts.
function buildPeriods(start, termMonths, billingMonths) {
  const endDate = addDays(addMonths(start, termMonths), -1);
  const periods = [];
  for (let off = 0; off < termMonths; off += billingMonths) {
    const periodStart = addMonths(start, off);
    const rawEnd = addDays(addMonths(start, off + billingMonths), -1);
    periods.push({
      period_start: periodStart,
      period_end: rawEnd > endDate ? endDate : rawEnd,
      due_date: periodStart,
    });
  }
  return { periods, endDate };
}

module.exports = { isValidDate, addMonths, addDays, today, buildPeriods };
