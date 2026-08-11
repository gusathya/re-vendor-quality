'use client';

import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlParameterName = searchParams.get('parameterName') ?? '';
  const [parameterName, setParameterName] = useState(urlParameterName);
  // Track the URL value we last synced from, so external navigation (e.g. browser
  // back/forward) resets the local draft even though the user may have typed since.
  const [syncedParameterName, setSyncedParameterName] = useState(urlParameterName);
  if (urlParameterName !== syncedParameterName) {
    setSyncedParameterName(urlParameterName);
    setParameterName(urlParameterName);
  }

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="filter-bar" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <label>
        Result
        <select value={searchParams.get('result') ?? ''} onChange={(e) => setParam('result', e.target.value)}>
          <option value="">All</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
        </select>
      </label>
      <label>
        Parameter
        <input
          value={parameterName}
          onChange={(e) => setParameterName(e.target.value)}
          onBlur={(e) => setParam('parameterName', e.target.value)}
          placeholder="e.g. Temperature"
        />
      </label>
    </div>
  );
}
