import { Link } from "wouter";
import { Hexagon, ArrowLeft } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";

function Section({ number, title, children }: { number?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">
        {number ? `${number}. ${title}` : title}
      </h2>
      <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 pl-1">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border/50 bg-white/60 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Hexagon className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold text-foreground tracking-tight hidden sm:block">
              Converge Concierge
            </span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-home">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-2 pb-4 border-b border-border/50">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Converge Concierge Platform Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Effective Date: March 7, 2026</p>
        </div>

        <div className="text-sm text-muted-foreground leading-relaxed">
          <p>
            TreaSolution, Inc. d/b/a Converge Events ("Company") respects your privacy.
          </p>
          <p className="mt-2">
            This Privacy Policy explains how information is collected and used when you access the Converge Concierge platform.
          </p>
        </div>

        <Section number="1" title="Information We Collect">
          <p>We may collect:</p>
          <p className="font-medium text-foreground">Personal Information</p>
          <Bullets items={["Name", "Email address", "Company name", "Job title", "Phone number", "Meeting scheduling information"]} />
          <p className="font-medium text-foreground">Technical Information</p>
          <Bullets items={["IP address", "browser type", "device information", "usage data"]} />
        </Section>

        <Section number="2" title="How We Use Information">
          <p>We use collected information to:</p>
          <Bullets items={[
            "schedule and manage event meetings",
            "enable sponsor discovery",
            "facilitate networking between attendees and sponsors",
            "provide platform functionality",
            "improve the Platform",
          ]} />
        </Section>

        <Section number="3" title="Information Shared with Sponsors">
          <p>When a meeting is scheduled or requested, limited attendee information may be shared with sponsors including:</p>
          <Bullets items={["name", "company", "title", "email address", "phone number", "meeting request details"]} />
          <p>This information is shared solely for event networking purposes.</p>
        </Section>

        <Section number="4" title="Data Retention">
          <p>We retain user information for as long as necessary to:</p>
          <Bullets items={["operate the Platform", "support event operations", "maintain reporting for sponsors and organizers"]} />
          <p>Information may be retained after events conclude.</p>
        </Section>

        <Section number="5" title="Security">
          <p>Company implements reasonable technical and organizational safeguards to protect data.</p>
          <p>However, no system can guarantee absolute security.</p>
        </Section>

        <Section number="6" title="Third-Party Services">
          <p>The Platform may integrate with third-party services such as:</p>
          <Bullets items={["calendar services", "hosting providers", "analytics tools"]} />
          <p>These services operate under their own privacy policies.</p>
        </Section>

        <Section number="7" title="User Rights">
          <p>Users may request to:</p>
          <Bullets items={["access their information", "correct inaccurate information", "request deletion of their information"]} />
          <p>
            Requests may be submitted through:{" "}
            <a
              href="https://convergeevents.com/contact/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline underline-offset-2"
            >
              https://convergeevents.com/contact/
            </a>
          </p>
        </Section>

        <Section number="8" title="Data Use Restrictions">
          <p>Company does not sell or rent personal information collected through the Platform.</p>
          <p>Company may share limited attendee information with sponsors and partners only as described in this Privacy Policy and as necessary to facilitate legitimate event networking and meeting scheduling.</p>
        </Section>

        <Section number="9" title="Breach Notification">
          <p>In the event of a data breach involving personal information, Company will provide notice within 72 hours where commercially reasonable and legally required.</p>
        </Section>

        <Section number="10" title="Changes to this Policy">
          <p>This Privacy Policy may be updated periodically.</p>
          <p>Continued use of the Platform constitutes acceptance of the updated policy.</p>
        </Section>

        <Section number="11" title="Contact">
          <p>
            Questions regarding this Privacy Policy may be directed to:{" "}
            <a
              href="https://convergeevents.com/contact/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline underline-offset-2"
            >
              https://convergeevents.com/contact/
            </a>
          </p>
        </Section>
      </main>

      <PublicFooter />
    </div>
  );
}
