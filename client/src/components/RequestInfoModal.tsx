import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, SendHorizonal, CheckCircle2, UserCheck, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useAttendeePrefill } from "@/hooks/use-attendee-prefill";

interface RequestInfoPrefill {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  title?: string;
}

interface RequestInfoModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sponsorId: string;
  sponsorName: string;
  eventId?: string;
  prefill?: RequestInfoPrefill;
}

export function RequestInfoModal({
  open,
  onClose,
  onSuccess,
  sponsorId,
  sponsorName,
  eventId,
  prefill = {},
}: RequestInfoModalProps) {
  const [form, setForm] = useState({
    firstName: prefill.firstName ?? "",
    lastName: prefill.lastName ?? "",
    email: prefill.email ?? "",
    company: prefill.company ?? "",
    title: prefill.title ?? "",
    message: "",
    consentToShareContact: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const { status: prefillStatus, lookup: lookupAttendee } = useAttendeePrefill(eventId);

  function field(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  async function handleEmailBlur() {
    if (!eventId || !form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) return;
    const found = await lookupAttendee(form.email);
    if (found) {
      setForm((f) => ({
        ...f,
        firstName: f.firstName.trim() || found.firstName,
        lastName:  f.lastName.trim()  || found.lastName,
        company:   f.company.trim()   || found.company,
        title:     f.title.trim()     || found.title,
      }));
    }
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Valid email is required";
    if (!form.company.trim()) errs.company = "Company is required";
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.consentToShareContact) errs.consentToShareContact = "You must consent to sharing your contact information";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/information-requests", {
        sponsorId,
        eventId: eventId ?? undefined,
        attendeeFirstName: form.firstName.trim(),
        attendeeLastName: form.lastName.trim(),
        attendeeEmail: form.email.trim(),
        attendeeCompany: form.company.trim(),
        attendeeTitle: form.title.trim(),
        message: form.message.trim() || undefined,
        consentToShareContact: true,
        source: "Public",
      });
      setSuccess(true);
      onSuccess?.();
    } catch {
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setSuccess(false);
    setErrors({});
    setForm({
      firstName: prefill.firstName ?? "",
      lastName: prefill.lastName ?? "",
      email: prefill.email ?? "",
      company: prefill.company ?? "",
      title: prefill.title ?? "",
      message: "",
      consentToShareContact: false,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Request Information</DialogTitle>
          <DialogDescription>
            Send a request to <span className="font-semibold text-foreground">{sponsorName}</span> and they'll follow up with you directly by email.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Request sent!</p>
              <p className="text-sm text-muted-foreground">
                Your information request has been sent. This sponsor will follow up with you by email.
              </p>
            </div>
            <Button onClick={handleClose} className="mt-2" data-testid="button-close-success">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">

            {/* Email first — triggers lookup on blur */}
            <div className="space-y-1">
              <Label htmlFor="req-email">
                Email <span className="text-destructive">*</span>
                {eventId && (
                  <span className="text-muted-foreground font-normal ml-1.5 text-xs">
                    — enter the email you registered with
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="req-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => field("email", e.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder="jane@acmecorp.com"
                  className={cn(errors.email ? "border-destructive" : "", "pr-8")}
                  data-testid="input-req-email"
                />
                {prefillStatus === "loading" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
                )}
                {prefillStatus === "found" && (
                  <UserCheck className="h-3.5 w-3.5 text-green-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
                )}
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {/* Prefill status banner */}
            {prefillStatus === "found" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700" data-testid="banner-prefill-found">
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                We found your registration and prefilled your information.
              </div>
            )}
            {prefillStatus === "not-found" && form.email.trim() && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-border/60 text-xs text-muted-foreground" data-testid="banner-prefill-not-found">
                <Info className="h-3.5 w-3.5 shrink-0" />
                We couldn't find a registration for that email. Please complete the form manually.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="req-firstName">First Name <span className="text-destructive">*</span></Label>
                <Input
                  id="req-firstName"
                  value={form.firstName}
                  onChange={(e) => field("firstName", e.target.value)}
                  placeholder="Jane"
                  className={errors.firstName ? "border-destructive" : ""}
                  data-testid="input-req-firstname"
                />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="req-lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input
                  id="req-lastName"
                  value={form.lastName}
                  onChange={(e) => field("lastName", e.target.value)}
                  placeholder="Smith"
                  className={errors.lastName ? "border-destructive" : ""}
                  data-testid="input-req-lastname"
                />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="req-company">Company <span className="text-destructive">*</span></Label>
                <Input
                  id="req-company"
                  value={form.company}
                  onChange={(e) => field("company", e.target.value)}
                  placeholder="Acme Corp"
                  className={errors.company ? "border-destructive" : ""}
                  data-testid="input-req-company"
                />
                {errors.company && <p className="text-xs text-destructive">{errors.company}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="req-title">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="req-title"
                  value={form.title}
                  onChange={(e) => field("title", e.target.value)}
                  placeholder="Director"
                  className={errors.title ? "border-destructive" : ""}
                  data-testid="input-req-title"
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="req-message">Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="req-message"
                value={form.message}
                onChange={(e) => field("message", e.target.value)}
                placeholder="What would you like to learn more about?"
                rows={3}
                className="resize-none"
                data-testid="input-req-message"
              />
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/60">
              <Checkbox
                id="req-consent"
                checked={form.consentToShareContact}
                onCheckedChange={(v) => field("consentToShareContact", !!v)}
                className={cn(errors.consentToShareContact ? "border-destructive" : "")}
                data-testid="checkbox-req-consent"
              />
              <label htmlFor="req-consent" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                I consent to sharing my contact information with this sponsor so they can follow up with me directly.
              </label>
            </div>
            {errors.consentToShareContact && (
              <p className="text-xs text-destructive -mt-2">{errors.consentToShareContact}</p>
            )}

            {errors.submit && (
              <p className="text-sm text-destructive text-center">{errors.submit}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={submitting}
                data-testid="button-req-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 gap-2"
                disabled={submitting}
                data-testid="button-req-submit"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  <><SendHorizonal className="h-4 w-4" /> Send Request</>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
