import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  sensitiveData,
  auditLogs,
  subscriptions,
  tokenBalances,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/security/password";
import { encryptSsn } from "@/lib/security/crypto";
import { PLANS } from "@/lib/billing/plans";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const postalCode = typeof body.postalCode === "string" ? body.postalCode.trim() : "";
  const ssn = typeof body.ssn === "string" ? body.ssn.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (ssn && ssn.replace(/\D/g, "").length < 6) {
    return NextResponse.json(
      { error: "Social security number looks invalid." },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const now = new Date();
  const free = PLANS.free;

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      name,
      email,
      phone: phone || null,
      country: country || null,
      address: address || null,
      postalCode: postalCode || null,
      passwordHash,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(subscriptions).values({
      id: randomUUID(),
      userId: id,
      plan: "free",
      status: "active",
      tokenAllowance: free.tokens,
      tokensUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + free.periodDays * 86_400_000),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(tokenBalances).values({
      userId: id,
      prepaidTokens: 0,
      updatedAt: now,
    });

    if (ssn) {
      await tx.insert(sensitiveData).values({
        userId: id,
        ssnEncrypted: encryptSsn(ssn),
        updatedAt: now,
      });
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      userId: id,
      actorId: id,
      action: ssn ? "user.signup.with_ssn" : "user.signup",
      resource: "user",
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      metadata: { country: country || null },
      createdAt: now,
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
