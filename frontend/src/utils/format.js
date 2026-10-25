// Display-only formatting. All money arithmetic happens on the server in exact decimals.
export const money = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(v || 0));
export const label = (s) => String(s || '').replace(/_/g, ' ');
