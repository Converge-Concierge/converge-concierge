import { Hexagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppBranding } from "@/hooks/use-app-branding";

interface Props {
  containerClassName?: string;
  iconClassName?: string;
  imgClassName?: string;
}

export function AppLogoMark({
  containerClassName = "flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20",
  iconClassName = "h-6 w-6",
  imgClassName = "h-8 max-w-[160px] object-contain",
}: Props) {
  const { logoUrl, appName } = useAppBranding();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={appName}
        className={cn("object-contain", imgClassName)}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }

  if (!containerClassName) {
    return <Hexagon className={iconClassName} />;
  }

  return (
    <div className={containerClassName}>
      <Hexagon className={iconClassName} />
    </div>
  );
}
