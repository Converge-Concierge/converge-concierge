import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

export interface AttendeeMe {
  attendee: { id: string; firstName: string; lastName: string; name: string; company: string; title: string; email: string };
  event: { id: string; slug: string; name: string; startDate: string | null; endDate: string | null; location: string | null; registrationUrl: string | null; websiteUrl: string | null; buttonColor: string | null; accentColor: string | null; meetingLocations: Array<{ id: string; name: string; allowedSponsorLevels: string[] }> };
  onboarding: { completedAt: string | null; skippedAt: string | null; isDone: boolean };
}

export function useAttendeeAuth() {
  const [, nav] = useLocation();
  const token = typeof window !== "undefined" ? localStorage.getItem("attendee_token") : null;
  const headers: Record<string, string> = token ? { "x-attendee-token": token } : {};

  const meQuery = useQuery<AttendeeMe>({
    queryKey: ["/api/attendee-portal/me"],
    queryFn: () =>
      fetch("/api/attendee-portal/me", { headers }).then((r) => {
        if (!r.ok) throw new Error("Unauthorized");
        return r.json();
      }),
    retry: false,
    enabled: !!token,
  });

  useEffect(() => {
    if (!token) nav("/");
    if (meQuery.isError) {
      localStorage.removeItem("attendee_token");
      nav("/");
    }
  }, [token, meQuery.isError]);

  function logout() {
    localStorage.removeItem("attendee_token");
    nav("/");
  }

  return { token, headers, meQuery, logout };
}
