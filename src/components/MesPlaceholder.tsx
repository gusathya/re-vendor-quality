export function MesPlaceholder({ title }: { title: string }) {
  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        {title}
      </h1>
      <div className="card" style={{ maxWidth: 960 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Coming next.</p>
      </div>
    </main>
  );
}
