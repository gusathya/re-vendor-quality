export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("./lib/db/client");
  const { seed } = await import("./lib/seed");
  await seed(getDb());
}
