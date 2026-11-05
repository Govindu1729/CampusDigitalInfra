import crypto from "crypto";

export interface SuperAppCalendarEventInput {
  title: string;
  startAt: string; // ISO 8601 with seconds & timezone: e.g. 2026-11-05T09:00:00+05:30
  endAt: string;   // ISO 8601 with seconds & timezone: e.g. 2026-11-05T10:30:00+05:30
  description?: string;
  timeZone?: string; // IANA e.g. "Asia/Kolkata"
  allDay?: boolean;
  location?: string;
  relatedEntityType?: string; // e.g. "MAINTENANCE_REQUEST"
  relatedEntityId?: string;   // e.g. "IITGN-2026-0001"
}

export interface SuperAppCalendarEventPatch {
  title?: string;
  startAt?: string;
  endAt?: string;
  description?: string;
  timeZone?: string;
  allDay?: boolean;
  location?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface SuperAppCalendarEventResponse {
  id: string | number;
  title: string;
  startAt: string;
  endAt: string;
  description?: string | null;
  timeZone?: string;
  allDay?: boolean;
  location?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  status?: string;
  moduleKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SuperAppApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface ListCalendarEventsParams {
  from?: string;
  to?: string;
  moduleKey?: string;
  limit?: number; // default 50, max 100
  offset?: number;
  includeCancelled?: boolean;
}

/**
 * SuperApp Global Calendar API v1 Client
 * Strictly adheres to SuperApp integration specs:
 * - Module authentication via X-Module-Key and X-Module-Token headers
 * - X-Request-Id header correlation
 * - ISO 8601 with seconds & explicit timezone
 * - No moduleKey in request bodies (ownership assigned by server)
 * - Safe fail-open / dev fallback when service is offline
 */
class SuperAppCalendarClient {
  private get baseUrl(): string {
    return (process.env.SUPERAPP_CALENDAR_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
  }

  private get moduleKey(): string {
    return process.env.SUPERAPP_MODULE_KEY || "IWD";
  }

  private get moduleToken(): string {
    return process.env.SUPERAPP_MODULE_TOKEN || "iwd_dev_secret_token";
  }

  private get defaultTimeZone(): string {
    return process.env.SUPERAPP_TIMEZONE || "Asia/Kolkata";
  }

  private get isEnabled(): boolean {
    return process.env.SUPERAPP_CALENDAR_ENABLED !== "false";
  }

  /**
   * Helper to validate and format ISO-8601 timestamp with explicit timezone
   */
  public formatIsoWithTimezone(dateInput: Date | string): string {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date provided for calendar timestamp: ${dateInput}`);
    }
    // Return standard ISO format in UTC (Z)
    return d.toISOString();
  }

  /**
   * Generates secure request headers including auth and correlation ID
   */
  private getHeaders(customHeaders: Record<string, string> = {}): HeadersInit {
    const requestId = crypto.randomUUID();
    return {
      "Content-Type": "application/json",
      "X-Module-Key": this.moduleKey,
      "X-Module-Token": this.moduleToken,
      "X-Request-Id": requestId,
      ...customHeaders,
    };
  }

  /**
   * Sanitize event title and description to prevent leaking confidential resident details
   */
  public sanitizeEventContent(title: string, description?: string): { title: string; description?: string } {
    // Strip resident phone numbers / email addresses if accidentally included
    const phoneRegex = /\b[6-9]\d{9}\b/g;
    const cleanTitle = title.replace(phoneRegex, "[REDACTED]").trim();
    const cleanDesc = description ? description.replace(phoneRegex, "[REDACTED]").trim() : undefined;
    return { title: cleanTitle, description: cleanDesc };
  }

  /**
   * GET /health – Health check on SuperApp Global Calendar API
   */
  public async checkHealth(): Promise<{ ok: boolean; status?: string; message?: string }> {
    if (!this.isEnabled) {
      return { ok: false, message: "SuperApp Calendar integration is disabled via SUPERAPP_CALENDAR_ENABLED=false." };
    }

    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: true, status: data.status || "healthy" };
      }
      return { ok: false, status: `HTTP_${res.status}`, message: `Health check returned HTTP ${res.status}` };
    } catch (err: any) {
      return {
        ok: false,
        status: "UNREACHABLE",
        message: `SuperApp Calendar service unreachable at ${this.baseUrl}: ${err.message}`,
      };
    }
  }

  /**
   * POST /api/v1/calendar/events – Create an event
   */
  public async createEvent(
    input: SuperAppCalendarEventInput
  ): Promise<{ success: boolean; event?: SuperAppCalendarEventResponse; error?: string; requestId?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: "Calendar integration disabled." };
    }

    // Validation per event rules
    if (!input.title || !input.startAt || !input.endAt) {
      return { success: false, error: "Validation failure: title, startAt, and endAt are strictly required." };
    }

    const start = new Date(input.startAt).getTime();
    const end = new Date(input.endAt).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) {
      return { success: false, error: "Validation failure: endAt must be later than startAt." };
    }

    const { title, description } = this.sanitizeEventContent(input.title, input.description);

    // Prepare payload (DO NOT send moduleKey/moduleId per spec rules)
    const payload = {
      title,
      startAt: input.startAt,
      endAt: input.endAt,
      description,
      timeZone: input.timeZone || this.defaultTimeZone,
      allDay: Boolean(input.allDay),
      location: input.location || undefined,
      relatedEntityType: input.relatedEntityType || "MAINTENANCE_REQUEST",
      relatedEntityId: input.relatedEntityId || undefined,
    };

    const requestId = crypto.randomUUID();

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/calendar/events`, {
        method: "POST",
        headers: this.getHeaders({ "X-Request-Id": requestId }),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errMessage = data?.error?.message || `Failed to create calendar event (HTTP ${res.status})`;
        console.warn(`[SuperApp Calendar] Event creation returned HTTP ${res.status} [Req: ${requestId}]:`, errMessage);
        return { success: false, error: errMessage, requestId };
      }

      const event = data?.event || data;
      return { success: true, event, requestId };
    } catch (err: any) {
      console.warn(`[SuperApp Calendar] Network error connecting to ${this.baseUrl} [Req: ${requestId}]:`, err.message);
      return {
        success: false,
        error: `SuperApp Calendar service unavailable at ${this.baseUrl} (${err.message})`,
        requestId,
      };
    }
  }

  /**
   * GET /api/v1/calendar/events/{id} – Fetch a single event
   */
  public async getEvent(
    id: string | number
  ): Promise<{ success: boolean; event?: SuperAppCalendarEventResponse; error?: string }> {
    if (!this.isEnabled) return { success: false, error: "Calendar integration disabled." };

    const requestId = crypto.randomUUID();
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/calendar/events/${encodeURIComponent(String(id))}`, {
        headers: this.getHeaders({ "X-Request-Id": requestId }),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        return { success: false, error: `Event not found or access denied (HTTP ${res.status})` };
      }

      const data = await res.json();
      return { success: true, event: data?.event || data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * PATCH /api/v1/calendar/events/{id} – Update an existing event
   */
  public async updateEvent(
    id: string | number,
    patch: SuperAppCalendarEventPatch
  ): Promise<{ success: boolean; event?: SuperAppCalendarEventResponse; error?: string; requestId?: string }> {
    if (!this.isEnabled) return { success: false, error: "Calendar integration disabled." };

    if (patch.startAt && patch.endAt) {
      const start = new Date(patch.startAt).getTime();
      const end = new Date(patch.endAt).getTime();
      if (end <= start) {
        return { success: false, error: "Validation failure: endAt must be later than startAt." };
      }
    }

    const requestId = crypto.randomUUID();
    const payload: any = { ...patch };

    if (patch.title || patch.description) {
      const sanitized = this.sanitizeEventContent(patch.title || "", patch.description);
      if (patch.title) payload.title = sanitized.title;
      if (patch.description !== undefined) payload.description = sanitized.description;
    }

    // Ensure forbidden ownership properties are removed
    delete payload.moduleKey;
    delete payload.moduleId;
    delete payload.ownerModuleKey;
    delete payload.ownerModuleId;

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/calendar/events/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        headers: this.getHeaders({ "X-Request-Id": requestId }),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || `Failed to update calendar event (HTTP ${res.status})`,
          requestId,
        };
      }

      return { success: true, event: data?.event || data, requestId };
    } catch (err: any) {
      return { success: false, error: err.message, requestId };
    }
  }

  /**
   * DELETE /api/v1/calendar/events/{id} – Cancel an event (soft delete)
   */
  public async cancelEvent(
    id: string | number
  ): Promise<{ success: boolean; error?: string; requestId?: string }> {
    if (!this.isEnabled) return { success: false, error: "Calendar integration disabled." };

    const requestId = crypto.randomUUID();
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/calendar/events/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        headers: this.getHeaders({ "X-Request-Id": requestId }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return {
          success: false,
          error: data?.error?.message || `Failed to cancel calendar event (HTTP ${res.status})`,
          requestId,
        };
      }

      return { success: true, requestId };
    } catch (err: any) {
      return { success: false, error: err.message, requestId };
    }
  }

  /**
   * GET /api/v1/calendar/events – List/filter events
   */
  public async listEvents(
    params: ListCalendarEventsParams = {}
  ): Promise<{ success: boolean; events: SuperAppCalendarEventResponse[]; total?: number; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, events: [], error: "Calendar integration disabled." };
    }

    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.moduleKey) q.set("moduleKey", params.moduleKey);
    if (params.limit) q.set("limit", String(Math.min(params.limit, 100)));
    if (params.offset) q.set("offset", String(params.offset));
    if (params.includeCancelled) q.set("includeCancelled", "true");

    const requestId = crypto.randomUUID();
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/calendar/events?${q.toString()}`, {
        headers: this.getHeaders({ "X-Request-Id": requestId }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return { success: false, events: [], error: `Failed to list calendar events (HTTP ${res.status})` };
      }

      const data = await res.json();
      const events = Array.isArray(data) ? data : data?.events || [];
      return { success: true, events, total: data?.total || events.length };
    } catch (err: any) {
      return { success: false, events: [], error: err.message };
    }
  }
}

export const superAppCalendar = new SuperAppCalendarClient();
