import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdministrationPanel } from "@/components/AdministrationPanel";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="section">
      <h1>
        <span className="accent-bar" />
        Administration
      </h1>
      <AdministrationPanel />
    </main>
  );
}
