'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.28)',
        borderRadius: 6,
        padding: '5px 10px',
        cursor: 'pointer',
        fontSize: 15,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        lineHeight: 1,
        transition: 'background 0.15s',
        flexShrink: 0,
        fontFamily: 'inherit',
        letterSpacing: 0,
        textTransform: 'none',
      }}
    >
      {dark ? '☀︎' : '🌙'}
    </button>
  );
}
