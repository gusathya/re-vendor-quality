import { uploadLoadReport } from './actions';

export default function NewLoadPage() {
  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        Upload Load Report
      </h1>
      <form action={uploadLoadReport}>
        <label>
          Vendor
          <select name="vendorName" defaultValue="Unique Platers">
            <option value="Unique Platers">Unique Platers</option>
          </select>
        </label>
        <label>
          Load report file (.xls)
          <input type="file" name="loadFile" accept=".xls" required />
        </label>
        <button type="submit">Upload &amp; Score</button>
      </form>
    </main>
  );
}
