"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createSkill, removeSkill, setSkillScope } from "@/app/dashboard/skills/actions";

export interface SkillItem {
  slug: string;
  name: string;
  description: string;
  triggers: string[];
  scope: "personal" | "global" | "builtin";
  updatedAt?: string;
}

interface SkillManagerProps {
  builtin: SkillItem[];
  global: SkillItem[];
  personal: SkillItem[];
  canPublish: boolean;
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function TriggerChips({ triggers }: { triggers: string[] }) {
  if (triggers.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {triggers.map((trigger) => (
        <span
          key={trigger}
          className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400"
        >
          “{trigger}”
        </span>
      ))}
    </div>
  );
}

function SkillCard({
  skill,
  action,
}: {
  skill: SkillItem;
  action?: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{skill.name}</span>
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
              {skill.slug}
            </code>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{skill.description}</p>
          <TriggerChips triggers={skill.triggers} />
          {skill.updatedAt && (
            <p className="mt-2 text-xs text-zinc-600">
              Updated {new Date(skill.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        {action && <div className="flex shrink-0 gap-2">{action}</div>}
      </div>
    </li>
  );
}

export default function SkillManager({
  builtin,
  global,
  personal,
  canPublish,
}: SkillManagerProps) {
  const [scope, setScope] = useState<"personal" | "global">("personal");

  return (
    <div className="space-y-8">
      <form
        action={createSkill}
        className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium">Teach the agent a skill</h2>

          {/* The switch: keep it to yourself, or give it to everyone. */}
          <div
            role="radiogroup"
            aria-label="Who can use this skill"
            className="flex rounded-lg border border-zinc-700 p-0.5 text-sm"
          >
            <button
              type="button"
              role="radio"
              aria-checked={scope === "personal"}
              onClick={() => setScope("personal")}
              className={`rounded-md px-3 py-1.5 ${
                scope === "personal" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Just me
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scope === "global"}
              disabled={!canPublish}
              onClick={() => setScope("global")}
              title={
                canPublish
                  ? "Every user of the app will get this skill"
                  : "Only the instance owner can publish a skill for everybody"
              }
              className={`rounded-md px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${
                scope === "global" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Everyone
            </button>
          </div>
        </div>
        <input type="hidden" name="scope" value={scope} />
        {scope === "global" && (
          <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
            This skill will be available to <strong>every user</strong> of the app. Save it as
            “Just me” if it is personal.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-zinc-400">Name</span>
            <input
              name="name"
              required
              maxLength={80}
              placeholder="Deploy to the server"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-zinc-400">Trigger examples (comma-separated)</span>
            <input
              name="triggers"
              placeholder="deploy, restart the service, roll back"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">
            Use when… (the kind of question that should activate it)
          </span>
          <input
            name="description"
            required
            maxLength={400}
            placeholder="Use when the user asks to deploy, restart or roll back the production services."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Procedure (markdown steps)</span>
          <textarea
            name="procedure"
            required
            rows={6}
            placeholder={"1. Run `bash scripts/preflight.sh`\n2. …"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-mono text-sm"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">
            {scope === "personal"
              ? "Saved for your account only."
              : "Saved for every user of the app."}
          </p>
          <SubmitButton>Save skill</SubmitButton>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">
          Your skills <span className="text-zinc-500">({personal.length})</span>
        </h2>
        {personal.length === 0 ? (
          <p className="text-sm text-zinc-500">You have not taught any personal skills yet.</p>
        ) : (
          <ul className="space-y-3">
            {personal.map((skill) => (
              <SkillCard
                key={skill.slug}
                skill={skill}
                action={
                  <>
                    {canPublish && (
                      <form action={setSkillScope.bind(null, skill.slug, "global")}>
                        <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800">
                          Share with everyone
                        </button>
                      </form>
                    )}
                    <form action={removeSkill.bind(null, "personal", skill.slug)}>
                      <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-800">
                        Delete
                      </button>
                    </form>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">
          Shared with everyone <span className="text-zinc-500">({global.length})</span>
        </h2>
        {global.length === 0 ? (
          <p className="text-sm text-zinc-500">No shared skills yet.</p>
        ) : (
          <ul className="space-y-3">
            {global.map((skill) => (
              <SkillCard
                key={skill.slug}
                skill={skill}
                action={
                  canPublish ? (
                    <>
                      <form action={setSkillScope.bind(null, skill.slug, "personal")}>
                        <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800">
                          Make private
                        </button>
                      </form>
                      <form action={removeSkill.bind(null, "global", skill.slug)}>
                        <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-800">
                          Delete
                        </button>
                      </form>
                    </>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">
          Built-in skills <span className="text-zinc-500">({builtin.length})</span>
        </h2>
        {builtin.length === 0 ? (
          <p className="text-sm text-zinc-500">No built-in skills found.</p>
        ) : (
          <ul className="space-y-3">
            {builtin.map((skill) => (
              <SkillCard key={skill.slug} skill={skill} />
            ))}
          </ul>
        )}
        <p className="text-xs text-zinc-600">
          Built-in skills ship with the agent and are edited in the repository under{" "}
          <code>agent/skills/</code>.
        </p>
      </section>
    </div>
  );
}
