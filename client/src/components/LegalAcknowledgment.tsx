import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface LegalAcknowledgmentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}

export default function LegalAcknowledgment({ checked, onChange, id = "agree-terms" }: LegalAcknowledgmentProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="mt-0.5 shrink-0"
        data-testid="checkbox-agree-terms"
      />
      <Label htmlFor={id} className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
        By scheduling a meeting, you agree to the{" "}
        <Link
          href="/terms"
          target="_blank"
          className="text-accent underline-offset-2 hover:underline"
          data-testid="link-terms-inline"
        >
          Terms of Use
        </Link>
        {" "}and{" "}
        <Link
          href="/privacy"
          target="_blank"
          className="text-accent underline-offset-2 hover:underline"
          data-testid="link-privacy-inline"
        >
          Privacy Policy
        </Link>.
      </Label>
    </div>
  );
}
