'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="filter-bar" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <label>
        Result
        <select defaultValue={searchParams.get('result') ?? ''} onChange={(e) => setParam('result', e.target.value)}>
          <option value="">All</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
        </select>
      </label>
      <label>
        Parameter
        <input
          defaultValue={searchParams.get('parameterName') ?? ''}
          onBlur={(e) => setParam('parameterName', e.target.value)}
          placeholder="e.g. Temperature"
        />
      </label>
    </div>
  );
}
