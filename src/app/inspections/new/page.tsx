import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db/client';
import { getActiveSopParameters } from '@/lib/db/sop';
import { submitManualCheck } from './actions';

export default async function NewInspectionPage() {
  const session = await auth();
  if (!session?.user?.vendorId) return <main className="section">Sign in as a vendor user to log a check.</main>;

  const params = getActiveSopParameters(getDb(), session.user.vendorId).filter((p) => p.status === 'parsed');

  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        Log a manual check
      </h1>
      <form action={submitManualCheck}>
        <label>
          Parameter
          <select name="sopParameterId" required>
            {params.map((p) => (
              <option key={p.id} value={p.id}>
                {p.process} — {p.characteristic} ({p.minValue}–{p.maxValue} {p.unit})
              </option>
            ))}
          </select>
        </label>
        <label>
          Value
          <input type="number" step="any" name="value" required />
        </label>
        <button type="submit">Log Check</button>
      </form>
    </main>
  );
}
