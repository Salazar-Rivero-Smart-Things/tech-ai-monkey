import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------------------------------------------------------------------------
// Auth.js core tables (names/columns match @auth/drizzle-adapter's contract)
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),

  // Additional account/profile fields (non-sensitive identity data)
  phone: text("phone"),
  country: text("country"),
  address: text("address"),
  postalCode: text("postalCode"),
  role: text("role").notNull().default("user"),
  // Argon2id hash, only set for email/password accounts.
  passwordHash: text("passwordHash"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_email_idx").on(table.email),
]);

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("account_userId_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "session",
  {
    sessionToken: text("sessionToken").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const auditLogs = pgTable(
  "auditLog",
  {
    id: text("id").primaryKey(),
    userId: text("userId").references(() => users.id, { onDelete: "set null" }),
    actorId: text("actorId"),
    action: text("action").notNull(),
    resource: text("resource").notNull(),
    ip: text("ip"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("audit_userId_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// Billing: subscriptions, prepaid (pay-as-you-go) balance, token ledger.
// The free plan is represented as a subscription row with plan = "free".
// ---------------------------------------------------------------------------

export type PlanId = "free" | "pro" | "ultra" | "bomb";

export const subscriptions = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan").$type<PlanId>().notNull().default("free"),
    status: text("status").notNull().default("active"), // active | canceled | past_due
    // Token allowance for the current period + usage counter.
    tokenAllowance: integer("tokenAllowance").notNull().default(0),
    tokensUsed: integer("tokensUsed").notNull().default(0),
    currentPeriodStart: timestamp("currentPeriodStart", { mode: "date" }).notNull().defaultNow(),
    currentPeriodEnd: timestamp("currentPeriodEnd", { mode: "date" }).notNull(),
    cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
    // For downgrades: the plan to switch to when the current period ends.
    pendingPlanId: text("pendingPlanId").$type<PlanId>(),
    // Free-tier refill bookkeeping (ignored for paid plans).
    freeRefillAt: timestamp("freeRefillAt", { mode: "date" }),
    // Gateway references.
    stripeCustomerId: text("stripeCustomerId"),
    stripeSubscriptionId: text("stripeSubscriptionId"),
    paypalSubscriptionId: text("paypalSubscriptionId"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("subscription_userId_idx").on(table.userId)],
);

export const tokenBalances = pgTable(
  "tokenBalance",
  {
    userId: text("userId")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    // Prepaid pay-as-you-go tokens remaining.
    prepaidTokens: integer("prepaidTokens").notNull().default(0),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
);

export const tokenTransactions = pgTable(
  "tokenTransaction",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // subscription_grant | topup | usage | refund | free_refill | expiry
    tokens: integer("tokens").notNull(), // signed delta
    balanceAfter: integer("balanceAfter"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("tokenTx_userId_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// Product features: artifacts, notebook (reminders), and integrations.
// ---------------------------------------------------------------------------

export const artifacts = pgTable(
  "artifact",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("artifact"), // artifact | workflow | file
    title: text("title").notNull(),
    content: text("content"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("artifact_userId_idx").on(table.userId)],
);

export const notebooks = pgTable(
  "notebook",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    done: boolean("done").notNull().default(false),
    remindAt: timestamp("remindAt", { mode: "date" }),
    doneAt: timestamp("doneAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("notebook_userId_idx").on(table.userId)],
);

export const integrations = pgTable(
  "integration",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // slack | google_workspace | google
    status: text("status").notNull().default("disconnected"), // disconnected | pending | connected
    // Permission answer: "yes" | "yes_this_project" | "no", plus optional note.
    permission: text("permission"),
    permissionNote: text("permissionNote"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("integration_userId_idx").on(table.userId)],
);

export const workflows = pgTable(
  "workflow",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    schedule: text("schedule").notNull().default("manual"), // manual | hourly | daily | weekly
    scheduleTime: text("scheduleTime").default("08:00"), // e.g. "08:00"
    prompt: text("prompt").notNull(),
    actionType: text("actionType").notNull().default("email"), // email | artifact | both
    emailRecipient: text("emailRecipient"),
    emailSubject: text("emailSubject"),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("lastRunAt", { mode: "date" }),
    lastStatus: text("lastStatus"), // success | failed | running
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("workflow_userId_idx").on(table.userId)],
);

export const workflowRuns = pgTable(
  "workflowRun",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflowId")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("running"), // running | success | failed
    output: text("output"),
    emailSent: boolean("emailSent").notNull().default(false),
    error: text("error"),
    startedAt: timestamp("startedAt", { mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completedAt", { mode: "date" }),
  },
  (table) => [
    index("workflowRun_workflowId_idx").on(table.workflowId),
    index("workflowRun_userId_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// CLI access.
//
// cliAuthCode is a short-lived, single-use PKCE code that lets the terminal
// prove it started the browser login (`tech-ai login`). It is created by the
// /cli-login page after the user has authenticated in the browser and is
// exchanged for a cliToken on the loopback callback.
//
// cliToken is the long-lived credential the CLI stores in
// ~/.config/tech-ai/credentials.json. Only the SHA-256 hash is stored.
// ---------------------------------------------------------------------------

export const cliAuthCodes = pgTable(
  "cliAuthCode",
  {
    // SHA-256 hex of the code handed to the CLI (never the code itself).
    codeHash: text("codeHash").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // base64url-encoded SHA-256 of the CLI's PKCE verifier (S256).
    codeChallenge: text("codeChallenge").notNull(),
    redirectPort: integer("redirectPort").notNull(),
    clientName: text("clientName"),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    usedAt: timestamp("usedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("cliAuthCode_userId_idx").on(table.userId)],
);

export const cliTokens = pgTable(
  "cliToken",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("CLI"),
    // SHA-256 hex of the token. The token itself is shown only once.
    tokenHash: text("tokenHash").notNull(),
    // First characters of the token, so the dashboard can identify it.
    prefix: text("prefix").notNull(),
    lastUsedAt: timestamp("lastUsedAt", { mode: "date" }),
    expiresAt: timestamp("expiresAt", { mode: "date" }),
    revokedAt: timestamp("revokedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cliToken_hash_idx").on(table.tokenHash),
    index("cliToken_userId_idx").on(table.userId),
  ],
);
