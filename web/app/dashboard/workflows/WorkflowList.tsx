"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteWorkflow, toggleWorkflow, startWorkflowRun, getWorkflowRunStatus } from "./actions";

export interface WorkflowItem {
  id: string;
  name: string;
  description: string | null;
  schedule: string;
  scheduleTime: string | null;
  prompt: string;
  actionType: string;
  emailRecipient: string | null;
  emailSubject: string | null;
  enabled: boolean;
  lastRunAt: Date | null;
  lastStatus: string | null;
  createdAt: Date;
}

export interface WorkflowRunItem {
  id: string;
  workflowId: string;
  status: string;
  output: string | null;
  emailSent: boolean;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

interface WorkflowListProps {
  workflows: WorkflowItem[];
  runs: WorkflowRunItem[];
}

export default function WorkflowList({ workflows, runs }: WorkflowListProps) {
  const router = useRouter();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [activeOutputModal, setActiveOutputModal] = useState<WorkflowRunItem | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  async function handleRunNow(id: string) {
    setRunningId(id);
    setNotification({
      message: "Rutinen kjører i bakgrunnen... AI-agenten arbeider, vennligst vent.",
      type: "info",
    });

    try {
      const { runId } = await startWorkflowRun(id);

      // Poll status every 2.5 seconds
      const pollInterval = setInterval(async () => {
        try {
          const run = await getWorkflowRunStatus(runId);
          if (!run) return;

          if (run.status === "success") {
            clearInterval(pollInterval);
            setRunningId(null);
            setNotification({
              message: `Kjøring fullført! ${run.emailSent ? "E-post ble sendt til innboksen din." : "Resultatet er klart."}`,
              type: "success",
            });
            router.refresh();
          } else if (run.status === "failed") {
            clearInterval(pollInterval);
            setRunningId(null);
            setNotification({
              message: `Kjøring feilet: ${run.error || "Ukjent feil under utførelse."}`,
              type: "error",
            });
            router.refresh();
          }
        } catch {
          // ignore transient poll error
        }
      }, 2500);

      // Safety timeout after 4 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (runningId === id) {
          setRunningId(null);
          router.refresh();
        }
      }, 240000);
    } catch (err: any) {
      setRunningId(null);
      setNotification({
        message: `Kunne ikke starte rutinen: ${err.message}`,
        type: "error",
      });
    }
  }

  if (workflows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-8 text-center text-zinc-500">
        <div className="text-3xl mb-2">⚡</div>
        <p className="text-base font-medium text-zinc-300">Ingen rutiner opprettet ennå</p>
        <p className="text-sm mt-1">
          Klikk på knappen ovenfor for å opprette din første automatiserte AI-arbeidsflyt.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`rounded-xl border p-4 text-sm flex items-center justify-between ${
            notification.type === "success"
              ? "border-emerald-800/80 bg-emerald-950/40 text-emerald-200"
              : notification.type === "info"
              ? "border-blue-800/80 bg-blue-950/40 text-blue-200"
              : "border-red-800/80 bg-red-950/40 text-red-200"
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-75 hover:opacity-100 ml-4 underline"
          >
            Lukk
          </button>
        </div>
      )}

      <div className="space-y-4">
        {workflows.map((wf) => {
          const isRunning = runningId === wf.id;
          const wfRuns = runs.filter((r) => r.workflowId === wf.id);

          return (
            <div
              key={wf.id}
              className={`rounded-xl border transition-all ${
                wf.enabled
                  ? "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  : "border-zinc-900 bg-zinc-950/50 opacity-70"
              }`}
            >
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-semibold text-white">{wf.name}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          wf.enabled
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}
                      >
                        {wf.enabled ? "Aktiv" : "Pauset"}
                      </span>
                      <span className="rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/60 px-2.5 py-0.5 text-xs font-medium">
                        {wf.schedule === "manual" && "Manuell"}
                        {wf.schedule === "hourly" && "Hver time"}
                        {wf.schedule === "daily" && `Daglig kl. ${wf.scheduleTime || "08:00"}`}
                        {wf.schedule === "weekly" && "Ukentlig"}
                      </span>
                    </div>

                    {wf.description && (
                      <p className="mt-1 text-sm text-zinc-400">{wf.description}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-zinc-400">
                      {wf.emailRecipient && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500">📧 E-post:</span>
                          <span className="text-zinc-300 font-mono">{wf.emailRecipient}</span>
                        </div>
                      )}
                      {(wf.actionType === "artifact" || wf.actionType === "both") && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500">📁</span>
                          <span className="text-zinc-300">Lagres i Artifacts</span>
                        </div>
                      )}
                      {wf.lastRunAt && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500">Siste kjøring:</span>
                          <span className="text-zinc-300">
                            {new Date(wf.lastRunAt).toLocaleString("no-NO")}
                          </span>
                          {wf.lastStatus === "success" && (
                            <span className="text-emerald-400 font-medium">(Vellykket)</span>
                          )}
                          {wf.lastStatus === "failed" && (
                            <span className="text-red-400 font-medium">(Feilet)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunNow(wf.id)}
                      disabled={isRunning}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                      title="Kjør rutinen nå"
                    >
                      {isRunning ? (
                        <>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Kjører...
                        </>
                      ) : (
                        <>
                          <span>▶</span> Kjør nå
                        </>
                      )}
                    </button>

                    <form
                      action={async () => {
                        await toggleWorkflow(wf.id, !wf.enabled);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        {wf.enabled ? "Pause" : "Aktiver"}
                      </button>
                    </form>

                    <form
                      action={async () => {
                        if (confirm(`Er du sikker på at du vil slette "${wf.name}"?`)) {
                          await deleteWorkflow(wf.id);
                        }
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-red-400 hover:bg-zinc-800/80 transition-colors"
                      >
                        Slett
                      </button>
                    </form>
                  </div>
                </div>

                {/* Prompt Details */}
                <div className="mt-4 rounded-lg bg-zinc-950/70 p-3 text-xs text-zinc-300 border border-zinc-800/50 font-mono">
                  <span className="text-zinc-500 block text-[11px] uppercase tracking-wider mb-1">
                    Instruksjon:
                  </span>
                  {wf.prompt}
                </div>

                {/* Recent Runs list */}
                {wfRuns.length > 0 && (
                  <div className="mt-4 border-t border-zinc-800/60 pt-3">
                    <span className="text-xs font-medium text-zinc-500 block mb-2">
                      Siste kjørelogg:
                    </span>
                    <div className="space-y-1.5">
                      {wfRuns.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between rounded-lg bg-zinc-950/40 px-3 py-2 text-xs border border-zinc-900"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                r.status === "success"
                                  ? "bg-emerald-500"
                                  : r.status === "failed"
                                  ? "bg-red-500"
                                  : "bg-yellow-500 animate-pulse"
                              }`}
                            />
                            <span className="text-zinc-300">
                              {new Date(r.startedAt).toLocaleString("no-NO")}
                            </span>
                            <span className="text-zinc-500">
                              ({r.status === "success" ? "Vellykket" : r.status === "failed" ? "Feilet" : "Kjører"})
                            </span>
                            {r.emailSent && (
                              <span className="text-emerald-400/90 text-[11px]">· E-post sendt</span>
                            )}
                          </div>
                          {r.output && (
                            <button
                              onClick={() => setActiveOutputModal(r)}
                              className="text-blue-400 hover:underline text-xs"
                            >
                              Se utdata
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Output modal */}
      {activeOutputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div>
                <h3 className="font-semibold text-white">Resultat fra kjøring</h3>
                <p className="text-xs text-zinc-400">
                  {new Date(activeOutputModal.startedAt).toLocaleString("no-NO")} ·{" "}
                  {activeOutputModal.emailSent ? "E-post sendt" : "Kun lagret"}
                </p>
              </div>
              <button
                onClick={() => setActiveOutputModal(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
              {activeOutputModal.output}
            </div>
            {activeOutputModal.error && (
              <div className="border-t border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
                Feil: {activeOutputModal.error}
              </div>
            )}
            <div className="border-t border-zinc-800 p-3 flex justify-end">
              <button
                onClick={() => setActiveOutputModal(null)}
                className="rounded-lg bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
