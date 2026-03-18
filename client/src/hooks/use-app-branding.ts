import { useQuery } from "@tanstack/react-query";

interface AppBranding { appName: string; appLogoUrl: string; }

export function useAppBranding() {
  const { data } = useQuery<AppBranding>({
    queryKey: ["/api/branding-public"],
    staleTime: 5 * 60 * 1000,
  });
  return {
    appName: data?.appName || "Converge Concierge",
    logoUrl: data?.appLogoUrl || null,
  };
}
