'use client';

import { useState } from 'react';
import {
  updateSopParameter, setStationAlias,
  addSopParameter, removeSopParameter, reorderSopParameters,
} from '@/app/sops/[id]/actions';
import type { SopParameter } from '@/lib/db/sop';

const btnSmall: React.CSSProperties = {
  padding: '3px 7px',
  fontSize: 11,
  borderRadius: 4,
  lineHeight: 1,
  fontFamily: 'inherit',
  letterSpacing: 0,
  textTransform: 'none',
  cursor: 'pointer',
  border: 'none',
};

export function SopReviewTable({
  parameters,
  vendorId,
  aliasByGroupKey,
  readOnly = false,
  sopDocumentId,
}: {
  parameters: SopParameter[];
  vendorId: string;
  aliasByGroupKey: Record<string, string>;
  readOnly?: boolean;
  sopDocumentId?: string;
}) {
  const [rows, setRows] = useState(parameters);

  function handleChange(id: string, field: 'minValue' | 'maxValue' | 'unit', value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, [field]: field === 'unit' ? value || null : value === '' ? null : Number(value) }
          : r,
      ),
    );
  }

  function handleProcessChange(id: string, value: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, process: value } : r));
  }

  function handleCharChange(id: string, value: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, characteristic: value || null } : r));
  }

  async function handleSave(row: SopParameter) {
    await updateSopParameter(row.id, row.minValue, row.maxValue, row.unit);
  }

  async function handleAlias(row: SopParameter, loadReportStationName: string) {
    await setStationAlias(vendorId, row.stationGroupKey, loadReportStationName);
  }

  async function handleMoveUp(id: string) {
    const i = rows.findIndex((r) => r.id === id);
    if (i <= 0) return;
    const next = [...rows];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setRows(next);
    await reorderSopParameters(next.map((r) => r.id));
  }

  async function handleMoveDown(id: string) {
    const i = rows.findIndex((r) => r.id === id);
    if (i >= rows.length - 1) return;
    const next = [...rows];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setRows(next);
    await reorderSopParameters(next.map((r) => r.id));
  }

  async function handleDelete(id: string) {
    await removeSopParameter(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleAddRow() {
    if (!sopDocumentId) return;
    const newRow = await addSopParameter(sopDocumentId);
    setRows((prev) => [...prev, newRow]);
  }

  return (
    <div className="table-wrap">
      <table className="sop-review-table">
        <thead>
          <tr>
            <th>Sr.No</th>
            <th>Process</th>
            <th>Characteristic</th>
            <th>Status</th>
            <th>Min</th>
            <th>Max</th>
            <th>Unit</th>
            <th>Raw Control Limit</th>
            {!readOnly && <th>Load-Report Station Name</th>}
            {!readOnly && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className={row.status === 'needs_review' ? 'needs-review' : ''}>
              <td style={{ fontFamily: 'Share Tech, monospace', fontSize: 11, color: '#9ca3af' }}>{row.srNo}</td>
              <td>
                {readOnly ? row.process : (
                  <input
                    value={row.process}
                    onChange={(e) => handleProcessChange(row.id, e.target.value)}
                    onBlur={() => updateSopParameter(row.id, row.minValue, row.maxValue, row.unit)}
                    style={{ minWidth: 120 }}
                  />
                )}
              </td>
              <td>
                {readOnly ? (row.characteristic ?? '—') : (
                  <input
                    value={row.characteristic ?? ''}
                    onChange={(e) => handleCharChange(row.id, e.target.value)}
                    onBlur={() => updateSopParameter(row.id, row.minValue, row.maxValue, row.unit)}
                    style={{ minWidth: 100 }}
                  />
                )}
              </td>
              <td>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{row.status}</span>
              </td>
              {readOnly ? (
                <>
                  <td>{row.minValue ?? '—'}</td>
                  <td>{row.maxValue ?? '—'}</td>
                  <td>{row.unit ?? '—'}</td>
                </>
              ) : (
                <>
                  <td>
                    <input
                      type="number" step="any"
                      value={row.minValue ?? ''}
                      onChange={(e) => handleChange(row.id, 'minValue', e.target.value)}
                      onBlur={() => handleSave(row)}
                      style={{ width: 72 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number" step="any"
                      value={row.maxValue ?? ''}
                      onChange={(e) => handleChange(row.id, 'maxValue', e.target.value)}
                      onBlur={() => handleSave(row)}
                      style={{ width: 72 }}
                    />
                  </td>
                  <td>
                    <input
                      value={row.unit ?? ''}
                      onChange={(e) => handleChange(row.id, 'unit', e.target.value)}
                      onBlur={() => handleSave(row)}
                      style={{ width: 60 }}
                    />
                  </td>
                </>
              )}
              <td style={{ color: '#9ca3af', fontSize: 12 }}>{row.rawControlLimit ?? '—'}</td>
              {!readOnly && (
                <td>
                  <input
                    placeholder="e.g. Hot Water Rinse"
                    defaultValue={aliasByGroupKey[row.stationGroupKey] ?? ''}
                    onBlur={(e) => e.target.value && handleAlias(row, e.target.value)}
                    style={{ minWidth: 130 }}
                  />
                </td>
              )}
              {!readOnly && (
                <td>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button
                      onClick={() => handleMoveUp(row.id)}
                      disabled={i === 0}
                      title="Move up"
                      style={{ ...btnSmall, background: '#6b7280', opacity: i === 0 ? 0.35 : 1 }}
                    >▲</button>
                    <button
                      onClick={() => handleMoveDown(row.id)}
                      disabled={i === rows.length - 1}
                      title="Move down"
                      style={{ ...btnSmall, background: '#6b7280', opacity: i === rows.length - 1 ? 0.35 : 1 }}
                    >▼</button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      title="Delete row"
                      style={{ ...btnSmall, background: 'var(--color-danger)' }}
                    >×</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {!readOnly && sopDocumentId && (
          <tfoot>
            <tr>
              <td colSpan={10} style={{ padding: '10px 14px', borderTop: '2px solid var(--color-card-border)' }}>
                <button
                  onClick={handleAddRow}
                  style={{ ...btnSmall, background: 'var(--color-navy-primary)', padding: '6px 14px', fontSize: 12 }}
                >
                  + Insert Row
                </button>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      {!readOnly && (
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>
          Min/Max/Unit save on blur · Process and Characteristic save on blur · Row order persists immediately
        </p>
      )}
    </div>
  );
}
