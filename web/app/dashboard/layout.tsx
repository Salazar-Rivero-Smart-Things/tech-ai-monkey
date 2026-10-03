import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar role={session.user.role} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
