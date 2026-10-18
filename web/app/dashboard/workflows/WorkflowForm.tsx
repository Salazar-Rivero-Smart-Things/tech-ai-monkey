"use client";

import { useState } from "react";
import { createWorkflow } from "./actions";

interface WorkflowFormProps {
  userEmail?: string;
}

const TEMPLATES = [
  {
    name: "Daglig teknologi- og AI-briefing",
    description: "Søker etter de ferskeste nyhetene innen AI og sender en oppsummering.",
    schedule: "daily",
    scheduleTime: "08:00",
    actionType: "email",
    emailSubject: "Dagens AI- og teknologibriefing",
    prompt:
      "Søk på nettet etter de tre viktigste nyhetene og gjennombruddene innen kunstig intelligens og teknologi de siste 24 timene. Lag en lettlest oppsummering med punktliste og lenker til kildene.",
  },
  {
    name: "Bok-repetisjon og daglig læringsquiz",
    description: "Går igjennom notater og bøker i bokhyllen og tester forståelsen din.",
    schedule: "daily",
    scheduleTime: "18:00",
    actionType: "email",
    emailSubject: "Dagens bokrepetisjon og spørsmål",
    prompt:
      "Undersøk bøkene og studienotatene i /workspace/books. Trekk ut et sentralt konsept og formuler 2 engasjerende refleksjonsspørsmål for å hjelpe meg å huske stoffet.",
  },
  {
    name: "Ukentlig markedsoppdatering",
    description: "Genererer en ukentlig oversikt over markedstrender og sender til innboksen.",
    schedule: "weekly",
    scheduleTime: "09:00",
    actionType: "both",
    emailSubject: "Ukentlig markedsoppdatering fra Tech AI",
    prompt:
      "Utfør et dypdykk på nettet om de største globale markedstrendene den siste uken. Sammenfatt de viktigste driverne og hva man bør følge med på den kommende uken.",
  },
];

export default function WorkflowForm({ userEmail }: WorkflowFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("daily");
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [actionType, setActionType] = useState("email");
  const [emailRecipient, setEmailRecipient] = useState(userEmail || "");
  const [emailSubject, setEmailSubject] = useState("");
  const [prompt, setPrompt] = useState("");

  function applyTemplate(t: (typeof TEMPLATES)[0]) {
    setName(t.name);
    setDescription(t.description);
    setSchedule(t.schedule);
    setScheduleTime(t.scheduleTime);
    setActionType(t.actionType);
    setEmailSubject(t.emailSubject);
    setPrompt(t.prompt);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">Opprett ny automatisert rutine</h2>
          <p className="text-sm text-zinc-400">
            Få AI-agenten til å kjøre oppgaver automatisk og sende deg oppdateringer på e-post.
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          {open ? "Lukk skjema" : "+ Ny Workflow"}
        </button>
      </div>

      {open && (
        <div className="mt-6 border-t border-zinc-800 pt-5 space-y-6">
          <div>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Hurtigmaler (klikk for å fylle ut):
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <form
            action={async (formData) => {
              setLoading(true);
              try {
                await createWorkflow(formData);
                setOpen(false);
                setName("");
                setDescription("");
                setPrompt("");
                setEmailSubject("");
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Navn på rutinen *
                </label>
                <input
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="f.eks. Morgen-briefing"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Kort beskrivelse
                </label>
                <input
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Valgfri forklaring på hva rutinen gjør"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Frekvens / Tidsplan
                </label>
                <select
                  name="schedule"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="manual">Kun manuell ("Kjør nå")</option>
                  <option value="hourly">Hver time</option>
                  <option value="daily">Daglig</option>
                  <option value="weekly">Ukentlig</option>
                </select>
              </div>

              {schedule === "daily" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Klokkeslett (f.eks. 08:00)
                  </label>
                  <input
                    name="scheduleTime"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Instruksjon til AI-agenten (Prompt) *
              </label>
              <textarea
                name="prompt"
                required
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Beskriv nøyaktig hva agenten skal undersøke, analysere eller skrive..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Hva skal skje med resultatet?
                </label>
                <select
                  name="actionType"
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="email">Send på e-post</option>
                  <option value="artifact">Lagre som Artifact i dashbord</option>
                  <option value="both">Både e-post og Artifact</option>
                </select>
              </div>

              {(actionType === "email" || actionType === "both") && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Mottaker e-post
                    </label>
                    <input
                      name="emailRecipient"
                      type="email"
                      required
                      value={emailRecipient}
                      onChange={(e) => setEmailRecipient(e.target.value)}
                      placeholder="din@epost.no"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      E-postemne (Subject)
                    </label>
                    <input
                      name="emailSubject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="f.eks. Dagens rapport fra Tech AI"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {loading ? "Lagrer..." : "Opprett workflow"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
