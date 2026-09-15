import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MesPlaceholder } from "@/components/MesPlaceholder";

export default async function PlanningPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <MesPlaceholder title="Planning" />;
}
