'use client';

import { useState } from 'react';
import { AdminTimelineChart } from './charts/AdminTimelineChart';
import type { AdminTimelinePoint } from '@/lib/admin-queries';

const PUSH_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:    { bg: '#f1f5f9', color: '#475569' },
  pending:  { bg: '#fef3c7', color: '#92400e' },
  approved: { bg: '#dcfce7', color: '#166534' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
};

export function TimelineTabClient({ timeline }: { timeline: AdminTimelinePoint[] }) {
  const vendorNames = [...new Set(timeline.map((t) => t.vendorName))].sort();
  const [selected, setSelected] = useState<Set<string>>(new Set(vendorNames));

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        if (next.size > 1) next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const filtered = timeline.filter((t) => selected.has(t.vendorName));
  const allSelected = selected.size === vendorNames.length;

  return (
    <div>
      {vendorNames.length > 1 && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-card-border)',
          borderRadius: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11,
              fontFamily: 'Share Tech, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-body)',
              opacity: 0.7,
            }}>
              Compare Vendors
            </span>
            <button
              onClick={() => setSelected(new Set(vendorNames))}
              style={{ fontSize: 11, padding: '2px 10px', background: 'var(--color-navy-primary)', borderRadius: 4, opacity: allSelected ? 0.5 : 1 }}
              disabled={allSelected}
            >
              All
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {vendorNames.map((name) => {
              const active = selected.has(name);
              return (
                <button
                  key={name}
                  onClick={() => toggle(name)}
                  style={{
                    fontSize: 11,
                    padding: '4px 12px',
                    borderRadius: 20,
                    background: active ? 'var(--color-navy-primary)' : 'transparent',
                    color: active ? 'white' : 'var(--color-text-body)',
                    border: `1px solid ${active ? 'var(--color-navy-primary)' : 'var(--color-card-border)'}`,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: 0,
                    textTransform: 'none',
                    transition: 'all 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-title">
          Load-by-Load Results —{' '}
          {allSelected ? 'All Vendors' : [...selected].join(', ')} (chronological)
        </div>
        <AdminTimelineChart data={filtered} />
      </div>

      <div className="chart-card">
        <div className="chart-title">Load Detail</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Load</th>
                <th>Uploaded</th>
                <th>Batch Status</th>
                <th>Pass</th>
                <th>Fail</th>
                <th>Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const total = t.passes + t.fails;
                const rate = total > 0 ? Math.round((t.passes / total) * 100) : 0;
                const ps = PUSH_STATUS_STYLE[t.pushStatus] ?? PUSH_STATUS_STYLE.draft;
                return (
                  <tr key={i} className={t.fails > 0 ? 'out-of-limit' : ''}>
                    <td>{t.vendorName}</td>
                    <td><strong>{t.loadNumber}</strong></td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{t.uploadedAt?.slice(0, 16)}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        background: ps.bg,
                        color: ps.color,
                      }}>
                        {t.pushStatus}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{t.passes}</td>
                    <td style={{ color: t.fails > 0 ? 'var(--color-danger)' : '#9ca3af', fontWeight: 600 }}>{t.fails}</td>
                    <td>
                      <span className="badge" style={{
                        background: rate >= 90 ? '#dcfce7' : rate >= 70 ? '#fef3c7' : '#fee2e2',
                        color: rate >= 90 ? '#166534' : rate >= 70 ? '#92400e' : '#991b1b',
                      }}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                    No load data for selected vendors.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
