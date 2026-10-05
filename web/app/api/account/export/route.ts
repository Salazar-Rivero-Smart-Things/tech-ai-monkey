import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exportUserData } from "@/lib/account";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/export
 * Machine-readable export of everything we store for the signed-in user
 * (GDPR Art. 15 "right of access"). Secrets and password hashes are excluded.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const data = await exportUserData(session.user.id);
  if (!data) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="tech-ai-monkey-export-${Date.now()}.json"`,
      "cache-control": "no-store",
    },
  });
}
