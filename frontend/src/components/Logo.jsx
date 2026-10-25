import { useAuth } from '../auth.jsx';

// Barbell with a heartbeat line through it. The name comes from the backend (GYM_NAME env var).
export function LogoMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#ff6a2b" />
      <g fill="#fff">
        <rect x="6" y="17" width="5" height="14" rx="2" />
        <rect x="11" y="13" width="5" height="22" rx="2" />
        <rect x="32" y="13" width="5" height="22" rx="2" />
        <rect x="37" y="17" width="5" height="14" rx="2" />
      </g>
      <path d="M16 24h5l2-6 3 12 2-6h4" fill="none" stroke="#0e2233" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ light = true }) {
  const { gymName } = useAuth();
  const [first, ...rest] = gymName.split(' ');
  return (
    <div className="logo">
      <LogoMark />
      <div className="logo-text" style={{ color: light ? '#fff' : 'var(--ink)' }}>
        <span className="logo-name">{first}</span>
        <span className="logo-sub">{rest.join(' ') || 'Gym'}</span>
      </div>
    </div>
  );
}
