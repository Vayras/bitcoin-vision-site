'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GITHUB } from '@/lib/links';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  return set === 'dark' ? 'dark' : 'light';
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(currentTheme()), []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const flip = () => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('bv-theme', next); } catch { /* private mode */ }
    setTheme(next);
  };

  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={theme ? `Switch to ${next} theme` : 'Switch theme'}>
      {theme === 'dark' ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const LINKS = [['/#demo', 'Demo'], ['/#model', 'Model'], ['/#integrate', 'Integrate'], ['/docs/', 'Docs']];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <nav className="nav" aria-label="Main">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation */}
          <img src={`${BASE}/logo.jpg`} alt="" width={28} height={28} className="brand-logo" />
          bitcoin-vision
        </Link>
        {LINKS.map(([href, label]) => <Link key={href} href={href} className="nav-link nav-links">{label}</Link>)}
        <a href={GITHUB} className="btn-sm btn-sm--line nav-links">GitHub ↗</a>
        <Link href="/#demo" className="btn-sm btn-sm--ink">
          <span className="try-long">Try the demo</span>
          <span className="try-short">Try it</span>
        </Link>
        <ThemeToggle />
        <button type="button" className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" aria-label="Menu">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
          </svg>
        </button>
      </nav>
      <div id="mobile-menu" className={`mobile-menu${open ? ' is-open' : ''}`}>
        {LINKS.map(([href, label]) => <Link key={href} href={href} onClick={close}>{label}</Link>)}
        <a href={GITHUB}>GitHub ↗</a>
      </div>
    </header>
  );
}
