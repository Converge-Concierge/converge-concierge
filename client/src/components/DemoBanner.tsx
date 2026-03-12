import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";

export default function DemoBanner() {
  const { data } = useQuery<{ env: string; isDemoMode: boolean }>({
    queryKey: ["/api/app-env"],
  });

  if (!data?.isDemoMode) return null;

  return (
    <div
      data-testid="demo-banner"
      className="bg-amber-500 text-amber-950 text-center text-sm font-medium px-4 py-1.5 flex items-center justify-center gap-2 shrink-0"
    >
      <FlaskConical className="h-4 w-4" />
      <span>Demo Environment — emails are suppressed, data may be reset at any time</span>
    </div>
  );
}
