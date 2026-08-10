'use client';

import { useState } from 'react';
import { updateSopParameter, setStationAlias } from '@/app/sops/[id]/actions';
import type { SopParameter } from '@/lib/db/sop';

export function SopReviewTable({
  parameters,
  vendorId,
  aliasByGroupKey,
}: {
  parameters: SopParameter[];
  vendorId: string;
  aliasByGroupKey: Record<string, string>;
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

  async function handleSave(row: SopParameter) {
    await updateSopParameter(row.id, row.minValue, row.maxValue, row.unit);
  }

  async function handleAlias(row: SopParameter, loadReportStationName: string) {
    await setStationAlias(vendorId, row.stationGroupKey, loadReportStationName);
  }

  return (
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
          <th>
            Load-Report Station Name
            <br />
            <small>
              Note: if a load-report station name repeats at multiple physical stations (e.g. rinse steps), only
              one SOP row can be aliased to it for now.
            </small>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={row.status === 'needs_review' ? 'needs-review' : ''}>
            <td>{row.srNo}</td>
            <td>{row.process}</td>
            <td>{row.characteristic}</td>
            <td>{row.status}</td>
            <td>
              <input
                value={row.minValue ?? ''}
                onChange={(e) => handleChange(row.id, 'minValue', e.target.value)}
                onBlur={() => handleSave(row)}
              />
            </td>
            <td>
              <input
                value={row.maxValue ?? ''}
                onChange={(e) => handleChange(row.id, 'maxValue', e.target.value)}
                onBlur={() => handleSave(row)}
              />
            </td>
            <td>
              <input
                value={row.unit ?? ''}
                onChange={(e) => handleChange(row.id, 'unit', e.target.value)}
                onBlur={() => handleSave(row)}
              />
            </td>
            <td>{row.rawControlLimit}</td>
            <td>
              <input
                placeholder="e.g. Hot Water Rinse"
                defaultValue={aliasByGroupKey[row.stationGroupKey] ?? ''}
                onBlur={(e) => e.target.value && handleAlias(row, e.target.value)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
