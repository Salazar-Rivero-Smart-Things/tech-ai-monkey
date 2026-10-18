import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notebooks, integrations } from "@/lib/db/schema";
import { addNotebookItem, toggleNotebookItem, deleteNotebookItem } from "../actions";
import { fetchGoogleCalendarEvents } from "@/lib/integrations/google-calendar";

export default async function GoogleCalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  // Fetch integration statuses for Google Meet and Calendar
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.userId, session.user.id));
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const meetIntegration = byProvider.get("google_meet");
  const calendarIntegration =
    byProvider.get("google_calendar") ||
    byProvider.get("google") ||
    byProvider.get("google_workspace");

  const isMeetConnected =
    meetIntegration?.status === "connected" ||
    calendarIntegration?.status === "connected";

  // Fetch local saved activities / appointments
  const localItems = await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.userId, session.user.id))
    .orderBy(desc(notebooks.createdAt));

  // Fetch Google Calendar live events
  const gcal = await fetchGoogleCalendarEvents(session.user.id);

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header and Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-white">
            <svg
              className="h-7 w-7 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Google Calendar & Google Meet
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Datoer, aktiviteter, avtaler og direkte Google Meet-møterom.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Google Meet Button / Connect Action */}
          {isMeetConnected ? (
            <a
              href="https://meet.google.com/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Nytt Google Meet ↗
            </a>
          ) : (
            <Link
              href="/api/integrations/google/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Koble til Google Meet
            </Link>
          )}

          {/* Google Calendar Connection Status */}
          {gcal.connected ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Kalender: {gcal.account || "Tilkoblet"}
            </div>
          ) : (
            <Link
              href="/api/integrations/google/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Koble til Google Calendar
            </Link>
          )}
        </div>
      </div>

      {/* Information if Google Meet or Calendar not connected */}
      {(!isMeetConnected || !gcal.connected) && (
        <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-4 text-sm text-blue-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-medium text-blue-100">
              {!isMeetConnected && !gcal.connected
                ? "Google Calendar og Google Meet er ikke tilkoblet"
                : !isMeetConnected
                  ? "Google Meet må kobles til for å generere direkte møterom"
                  : "Google Calendar er ikke tilkoblet"}
            </p>
            <p className="text-xs text-blue-300/80 mt-0.5">
              For å opprette avtaler med automatisk genererte Google Meet-lenker må Google-tjenesten kobles til.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {!isMeetConnected && (
              <Link
                href="/api/integrations/google_meet/connect"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                Koble til Meet
              </Link>
            )}
            {!gcal.connected && (
              <Link
                href="/api/integrations/google_calendar/connect"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                Koble til Kalender
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Form: Lag aktivitet (dato og klokkeslett) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Lag aktivitet (dato og klokkeslett)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Opprett en aktivitet, sett tidspunkt og generer Google Meet-avtale.
          </p>
        </div>

        <form action={addNotebookItem} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Aktivitet / Tittel
            </label>
            <input
              name="title"
              required
              placeholder="F.eks. Møte med kunde, tannlege, ukentlig oppsummering..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="remindAt" className="block text-xs font-medium text-zinc-400 mb-1">
                Dato og klokkeslett
              </label>
              <input
                id="remindAt"
                name="remindAt"
                type="datetime-local"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Notater eller agenda (valgfritt)
              </label>
              <input
                name="notes"
                placeholder="F.eks. Tema som skal tas opp, deltakere..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/80">
            <div className="flex flex-wrap items-center gap-4">
              {isMeetConnected ? (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-emerald-300 hover:text-emerald-200">
                  <input
                    type="checkbox"
                    name="createMeet"
                    defaultChecked={true}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-400"
                  />
                  Opprett Google Meet-avtale og møtelenke
                </label>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="text-amber-400">⚠️</span>
                  <span>Google Meet må kobles til for å generere møterom:</span>
                  <Link
                    href="/api/integrations/google_meet/connect"
                    className="underline text-emerald-400 hover:text-emerald-300"
                  >
                    Koble til Meet nå
                  </Link>
                </div>
              )}

              {gcal.connected && (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-300 hover:text-blue-200">
                  <input
                    type="checkbox"
                    name="syncGoogle"
                    defaultChecked={true}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-blue-400"
                  />
                  Synkroniser til Google Kalender
                </label>
              )}
            </div>

            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Lagre aktivitet
            </button>
          </div>
        </form>
      </div>

      {/* Live Google Calendar Events Section */}
      {gcal.connected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Kommende i Google Calendar
            </h2>
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              Åpne Google Calendar ↗
            </a>
          </div>

          {gcal.events.length === 0 ? (
            <p className="text-sm text-zinc-500 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-4">
              Ingen kommende hendelser funnet i din Google Calendar.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {gcal.events.map((event) => {
                const startDate = event.start ? new Date(event.start) : null;
                return (
                  <div
                    key={event.id}
                    className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-medium text-blue-400">
                        {startDate && !isNaN(startDate.getTime())
                          ? startDate.toLocaleString([], {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : event.start}
                      </div>
                      <h3 className="mt-1 font-medium text-white">{event.summary}</h3>
                      {event.description && (
                        <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      {event.location && (
                        <p className="mt-1 text-xs text-zinc-500">📍 {event.location}</p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                      {event.meetLink ? (
                        <a
                          href={event.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Bli med i Meet
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-600">Ingen Meet-lenke</span>
                      )}

                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Detaljer ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lagrede aktiviteter og avtaler */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Lagrede aktiviteter og avtaler
        </h2>

        {localItems.length === 0 ? (
          <p className="text-sm text-zinc-500">Ingen aktiviteter eller avtaler lagret ennå.</p>
        ) : (
          <ul className="space-y-3">
            {localItems.map((item) => {
              // Extract meet link if stored in notes
              const meetMatch = item.notes?.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
              const meetUrl = meetMatch ? meetMatch[0] : null;

              return (
                <li
                  key={item.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    item.done
                      ? "border-zinc-800/60 bg-zinc-900/20 text-zinc-500"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className={item.done ? "line-through text-zinc-500" : "font-medium text-white text-base"}>
                        {item.title}
                      </div>

                      {item.notes && (
                        <div className="text-sm text-zinc-400 whitespace-pre-line">
                          {item.notes}
                        </div>
                      )}

                      {item.remindAt && (
                        <div className="text-xs text-blue-400 flex items-center gap-1.5 pt-1">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Tidspunkt: {item.remindAt.toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                      )}

                      {meetUrl && (
                        <div className="pt-2">
                          <a
                            href={meetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Bli med i Google Meet
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <form action={toggleNotebookItem.bind(null, item.id, !item.done)}>
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 font-medium transition-colors"
                        >
                          {item.done ? "Angre" : "Ferdig"}
                        </button>
                      </form>
                      <form action={deleteNotebookItem.bind(null, item.id)}>
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-800 font-medium transition-colors"
                        >
                          Slett
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
