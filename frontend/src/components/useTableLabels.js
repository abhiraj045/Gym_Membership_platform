import { useEffect } from 'react';

// Copies each column heading onto its cells (data-label) so that, on phones,
// the CSS can show every table row as a small card with "Heading: value" lines.
export default function useTableLabels(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const apply = () => {
      root.querySelectorAll('table').forEach((table) => {
        const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
        table.querySelectorAll('tbody tr').forEach((tr) => {
          [...tr.children].forEach((td, i) => {
            if (td.colSpan > 1 || !heads[i]) { td.removeAttribute('data-label'); return; }
            if (td.getAttribute('data-label') !== heads[i]) td.setAttribute('data-label', heads[i]);
          });
        });
      });
    };

    apply();
    const observer = new MutationObserver(apply); // pages load data after first render
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref]);
}