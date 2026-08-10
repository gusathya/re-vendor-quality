import { uploadSop } from './actions';

export default function NewSopPage() {
  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        Feed SOP
      </h1>
      <form action={uploadSop}>
        <label>
          Vendor
          <select name="vendorName" defaultValue="Unique Platers">
            <option value="Unique Platers">Unique Platers</option>
          </select>
        </label>
        <label>
          SOP file (.xlsx)
          <input type="file" name="sopFile" accept=".xlsx" required />
        </label>
        <button type="submit">Parse SOP</button>
      </form>
    </main>
  );
}
