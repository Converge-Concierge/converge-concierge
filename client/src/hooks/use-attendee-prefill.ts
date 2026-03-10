import { useState, useCallback } from "react";

export type PrefillStatus = "idle" | "loading" | "found" | "not-found" | "error";

export interface PrefillData {
  attendeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
}

export function useAttendeePrefill(eventId: string | undefined) {
  const [status, setStatus] = useState<PrefillStatus>("idle");
  const [data, setData] = useState<PrefillData | null>(null);

  const lookup = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!eventId || !trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      setStatus("idle");
      setData(null);
      return null;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/attendees/prefill-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email: trimmed }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const json = await res.json();
      if (json.found && json.attendee) {
        setStatus("found");
        setData(json.attendee as PrefillData);
        return json.attendee as PrefillData;
      } else {
        setStatus("not-found");
        setData(null);
        return null;
      }
    } catch {
      setStatus("error");
      setData(null);
      return null;
    }
  }, [eventId]);

  const reset = useCallback(() => {
    setStatus("idle");
    setData(null);
  }, []);

  return { status, data, lookup, reset };
}
