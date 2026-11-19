import { redirect } from "next/navigation";
import { auth } from "@/auth";
import HistoryList from "@/components/history-list";
import { listUserConversations } from "@/lib/history";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const conversations = await listUserConversations(session.user.id, { limit: 100 });

  return <HistoryList initialConversations={conversations} />;
}
