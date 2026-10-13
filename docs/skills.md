# Skills — teaching the agent new abilities

A **skill** is a short procedure the agent pulls into context only when a turn
calls for it. eve advertises each skill's *description* to the model and loads
the markdown body on demand (`load_skill`), so a large library costs almost
nothing per turn.

## Where skills live

| Kind | Path | Scope |
| --- | --- | --- |
| Built-in | `agent/skills/*.md` | Everyone; shipped with the repo and compiled by `eve build` |
| Learned, shared | `skills/global/<slug>.md` | Everyone |
| Learned, private | `skills/users/<userId>/<slug>.md` | One user |

Learned skills are ordinary markdown files read at runtime, so the agent picks
up a new one on the next turn — no rebuild. `skills/global/` is committed to
git; `skills/users/` is git-ignored (personal).

Override the location with `EVE_SKILLS_DIR`. Without it, both the agent
(cwd = repo root) and the web app (cwd = `web/`) find `<repo>/skills`
automatically.

## File format

```md
---
name: Deploy to the server
description: Use when the user asks to deploy, restart or roll back the production services.
triggers: deploy, restart the service, roll back
scope: global
createdBy: <userId>
updatedAt: 2026-10-06T12:00:00.000Z
---

1. Run `bash scripts/preflight.sh` and fix anything it reports.
2. `npm run build` at the repo root.
3. `sudo systemctl restart myai-web`, then check `https://tech-ai.tech`.
```

- **description** is the routing hint — write it as the *kind of question* that
  should activate the skill ("Use when …"). This is what links a skill to the
  questions it answers.
- **triggers** are example phrases, appended to the advertised description to
  improve matching.
- **body** is the procedure the model follows.

Re-using a name overwrites the same slug, so editing a skill is the same as
creating it.

## Three ways to create one

1. **In chat** — "Learn this: …". The agent calls `learn_skill` and saves it as
   *personal* unless you explicitly ask for everybody.
2. **Dashboard → Skills** (`/dashboard/skills`) — a form with a **Just me /
   Everyone** switch, plus *Share with everyone* / *Make private* / *Delete*.
3. **By hand** — drop a markdown file in `skills/global/` or
   `skills/users/<userId>/`, or add a built-in one under `agent/skills/`.

## Who may publish for everybody

Only the instance owner (`role: admin`/`owner`, or an email in `OWNER_EMAILS`)
can create `scope: "global"` skills. The web app sends the caller's `role` and
`email` in the agent token, and `learn_skill` re-checks them. Everyone else can
keep unlimited personal skills.

## Agent tools

| Tool | Purpose |
| --- | --- |
| `learn_skill` | Create/update a skill (`scope` = `personal` \| `global`) |
| `list_skills` | List built-in, global and personal skills |
| `forget_skill` | Delete a learned skill by slug |

## How loading works

`agent/skills/learned.ts` is an eve **dynamic skill resolver**. On every
session/turn start it reads the caller's visible skills and advertises each as
`learned_<slug>`. The model then calls `load_skill` only when a request matches,
so the procedure reaches the prompt exactly when it is needed.
