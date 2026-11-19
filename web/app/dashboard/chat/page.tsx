import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Chat from "@/components/chat";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { conversation } = await searchParams;
  return <Chat initialConversationId={conversation ?? null} />;
}
