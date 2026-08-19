'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: 'var(--color-navy-primary)',
        color: 'white',
        border: 'none',
        borderRadius: 6,
        padding: '6px 16px',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      Save PDF
    </button>
  );
}
