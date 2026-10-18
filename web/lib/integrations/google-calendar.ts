import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { PROVIDERS, getCredentials } from "@/lib/integrations/providers";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";

export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  htmlLink?: string;
  location?: string;
  meetLink?: string;
}

export interface GoogleCalendarAuthResult {
  accessToken: string;
  provider: string;
  account: string | null;
  integrationId: string;
}

/**
 * Retrieves valid Google Calendar credentials for a user, refreshing
 * expired tokens if a refresh_token is present.
 */
export async function getGoogleCalendarAuth(
  userId: string,
): Promise<GoogleCalendarAuthResult | null> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.userId, userId),
        inArray(integrations.provider, [
          "google_calendar",
          "google_meet",
          "google",
          "google_workspace",
        ]),
        eq(integrations.status, "connected"),
      ),
    )
    .limit(1);

  if (!row || !row.metadata) return null;

  const meta = row.metadata as {
    account?: string;
    secret?: string;
    [key: string]: unknown;
  };
  if (!meta.secret) return null;

  let raw: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    [key: string]: unknown;
  };

  try {
    const decrypted = decryptSecret(meta.secret);
    raw = JSON.parse(decrypted);
  } catch (err) {
    console.error("[google-calendar] Failed to decrypt token secret:", err);
    return null;
  }

  if (!raw.access_token) return null;

  return {
    accessToken: raw.access_token,
    provider: row.provider,
    account: meta.account ?? null,
    integrationId: row.id,
  };
}

/**
 * Refreshes the Google OAuth access token using the stored refresh token.
 */
export async function refreshGoogleToken(
  integrationId: string,
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, integrationId))
    .limit(1);

  if (!row?.metadata) return null;
  const meta = row.metadata as {
    secret?: string;
    [key: string]: unknown;
  };
  if (!meta.secret) return null;

  try {
    const raw = JSON.parse(decryptSecret(meta.secret));
    if (!raw.refresh_token) return null;

    const cfg = PROVIDERS.google_calendar;
    const creds = getCredentials(cfg);
    if (!creds) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: raw.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error("[google-calendar] Token refresh failed:", await res.text());
      return null;
    }

    const refreshed = (await res.json()) as { access_token: string };
    raw.access_token = refreshed.access_token;

    const updatedMetadata = {
      ...meta,
      secret: encryptSecret(JSON.stringify(raw)),
    };

    await db
      .update(integrations)
      .set({ metadata: updatedMetadata, updatedAt: new Date() })
      .where(eq(integrations.id, integrationId));

    return refreshed.access_token;
  } catch (err) {
    console.error("[google-calendar] Error during token refresh:", err);
    return null;
  }
}

/**
 * Fetches upcoming Google Calendar events for the user.
 */
export async function fetchGoogleCalendarEvents(
  userId: string,
  maxResults = 15,
): Promise<{
  connected: boolean;
  account?: string | null;
  events: CalendarEventItem[];
  error?: string;
}> {
  const auth = await getGoogleCalendarAuth(userId);
  if (!auth) {
    return { connected: false, events: [] };
  }

  const queryUrl = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  queryUrl.searchParams.set("timeMin", new Date().toISOString());
  queryUrl.searchParams.set("singleEvents", "true");
  queryUrl.searchParams.set("orderBy", "startTime");
  queryUrl.searchParams.set("maxResults", String(maxResults));

  let res = await fetch(queryUrl.toString(), {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    const newAccessToken = await refreshGoogleToken(auth.integrationId);
    if (newAccessToken) {
      res = await fetch(queryUrl.toString(), {
        headers: {
          Authorization: `Bearer ${newAccessToken}`,
          Accept: "application/json",
        },
      });
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    return {
      connected: true,
      account: auth.account,
      events: [],
      error: `Google Calendar API error (${res.status}): ${errorText.slice(0, 100)}`,
    };
  }

  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      htmlLink?: string;
      location?: string;
      hangoutLink?: string;
    }>;
  };

  const events: CalendarEventItem[] = (data.items || []).map((item) => ({
    id: item.id,
    summary: item.summary || "(No title)",
    description: item.description,
    start: item.start?.dateTime || item.start?.date || "",
    end: item.end?.dateTime || item.end?.date || "",
    htmlLink: item.htmlLink,
    location: item.location,
    meetLink: item.hangoutLink,
  }));

  return {
    connected: true,
    account: auth.account,
    events,
  };
}

/**
 * Creates a new event in the user's primary Google Calendar.
 */
export async function createGoogleCalendarEvent(
  userId: string,
  event: {
    title: string;
    notes?: string;
    start: Date;
    end?: Date;
    createMeetLink?: boolean;
  },
): Promise<{ ok: boolean; eventId?: string; meetLink?: string; error?: string }> {
  const auth = await getGoogleCalendarAuth(userId);
  if (!auth) {
    return { ok: false, error: "Google Calendar is not connected" };
  }

  const endDate =
    event.end && event.end > event.start
      ? event.end
      : new Date(event.start.getTime() + 60 * 60 * 1000);

  const payload: Record<string, unknown> = {
    summary: event.title,
    description: event.notes || undefined,
    start: {
      dateTime: event.start.toISOString(),
    },
    end: {
      dateTime: endDate.toISOString(),
    },
  };

  if (event.createMeetLink) {
    payload.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    };
  }

  const queryParams = event.createMeetLink ? "?conferenceDataVersion=1" : "";
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events${queryParams}`;

  let res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    const newAccessToken = await refreshGoogleToken(auth.integrationId);
    if (newAccessToken) {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${newAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Failed to create event (${res.status}): ${errorText.slice(0, 100)}`,
    };
  }

  const created = (await res.json()) as {
    id?: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
    };
  };

  const meetLink =
    created.hangoutLink ||
    created.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video",
    )?.uri;

  return { ok: true, eventId: created.id, meetLink };
}
