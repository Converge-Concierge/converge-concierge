import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { AppLogoMark } from "@/components/AppLogoMark";
import { useAppBranding } from "@/hooks/use-app-branding";
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

export default function TermsPage() {
  const { appName } = useAppBranding();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border/50 bg-white/60 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <AppLogoMark containerClassName="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md" iconClassName="h-5 w-5" imgClassName="h-7 max-w-[130px] object-contain" />
            <span className="font-display text-lg font-bold text-foreground tracking-tight hidden sm:block">
              {appName}
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
            Converge Concierge Platform Terms of Use
          </h1>
          <p className="text-sm text-muted-foreground">Effective Date: March 7, 2026</p>
        </div>

        <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
          <p>
            These Terms of Use ("Terms") govern access to and use of the Converge Concierge platform (the "Platform"), operated by TreaSolution, Inc. d/b/a Converge Events ("Company").
          </p>
          <p>
            By accessing or using the Platform, you agree to these Terms. If you do not agree, you may not use the Platform.
          </p>
        </div>

        <Section title="Governing Law and Venue">
          <p>These Terms shall be governed by the laws of the State of Illinois, without regard to conflict of law principles.</p>
          <p>The exclusive venue and jurisdiction for any dispute arising from these Terms shall be the courts located in DuPage County, Illinois.</p>
        </Section>

        <Section number="1" title="Platform Purpose">
          <p>The Platform facilitates introductions and scheduling of meetings between event attendees, event sponsors, and event participants.</p>
          <p>The Platform is a facilitation tool only.</p>
          <p>Company does not guarantee:</p>
          <Bullets items={["meeting availability", "sponsor participation", "attendee participation", "meeting outcomes", "business results"]} />
          <p>Sponsors may accept or decline meeting requests at their sole discretion.</p>
        </Section>

        <Section number="2" title="Event Operational Control">
          <p>Company maintains exclusive operational control over all events and platform functions.</p>
          <p>Company may at any time:</p>
          <Bullets items={["modify event schedules", "change speakers or programming", "change event format", "change event date or location", "modify meeting scheduling functionality"]} />
          <p>Such changes do not entitle users to refunds or claims.</p>
        </Section>

        <Section number="3" title="Attendee Responsibilities">
          <p>Users agree to:</p>
          <Bullets items={["provide accurate information", "attend scheduled meetings when reasonably possible", "use the Platform only for legitimate business networking"]} />
          <p>Users may not:</p>
          <Bullets items={["scrape or extract platform data", "record sessions or meetings without permission", "distribute event materials", "impersonate other individuals", "disrupt event operations"]} />
          <p>Violation may result in removal from the event or platform without refund.</p>
        </Section>

        <Section number="4" title="Recording and Intellectual Property">
          <p>All content associated with Company events and the Platform is the exclusive property of Company.</p>
          <p>Users may not:</p>
          <Bullets items={["record sessions", "screen capture event materials", "redistribute recordings", "reproduce platform content"]} />
          <p>Company may record events and meetings.</p>
          <p>By participating, users grant Company a perpetual, worldwide, royalty-free license to use their:</p>
          <Bullets items={["name", "likeness", "voice", "company affiliation"]} />
          <p>for promotional, educational, or commercial purposes.</p>
        </Section>

        <Section number="5" title="Sponsor Data Sharing">
          <p>By using the Platform, users consent to Company sharing limited attendee information with sponsors participating in the event.</p>
          <p>This information may include:</p>
          <Bullets items={["name", "job title", "company", "email address", "phone number", "meeting request information"]} />
          <p>Sponsors may contact attendees regarding legitimate business opportunities related to the event.</p>
          <p>Company does not control sponsor communications after introduction.</p>
        </Section>

        <Section number="6" title="Assumption of Risk (Onsite Participation)">
          <p>Participation in any in-person event involves inherent risks.</p>
          <p>Users voluntarily assume all risks related to:</p>
          <Bullets items={["travel", "event attendance", "health or safety risks", "communicable diseases", "interactions with other participants"]} />
          <p>Users release Company and related parties from liability arising from such risks.</p>
        </Section>

        <Section number="7" title="Confidentiality and Data Use">
          <p>Users may receive access to proprietary information including:</p>
          <Bullets items={["sponsor materials", "attendee lists", "event content"]} />
          <p>Such information may not be:</p>
          <Bullets items={["copied", "redistributed", "used for competitive purposes"]} />
          <p>Unauthorized use may result in removal and legal action.</p>
        </Section>

        <Section number="8" title="Non-Circumvention">
          <p>Users may not use the Platform to bypass Company in order to:</p>
          <Bullets items={["commercially exploit introductions made through Company", "misuse attendee or sponsor information", "compete using Company relationships or event structures"]} />
        </Section>

        <Section number="9" title="Limitation of Liability">
          <p>To the fullest extent permitted by law:</p>
          <p>User recovery against Company is limited exclusively to amounts actually recovered and received by Company from applicable insurance policies for the specific claim, and such recovery constitutes the sole and exclusive remedy.</p>
          <p>Company has no obligation to maintain insurance of any type or amount.</p>
          <p>Insurance coverage may be unavailable or denied.</p>
          <p>Company retains exclusive control over insurance tender, defense, cooperation, and settlement.</p>
          <p>Company shall not be liable for:</p>
          <Bullets items={["indirect damages", "consequential damages", "lost profits", "business interruption", "reputational harm"]} />
          <p>No claim may be made against Company's officers, employees, contractors, or affiliates.</p>
        </Section>

        <Section number="10" title="Fallback Liability Cap">
          <p>If a court determines the insurance-only limitation unenforceable, the maximum aggregate liability of Company arising from the Platform shall not exceed $100 USD.</p>
          <p>This limitation applies regardless of the legal theory of liability.</p>
        </Section>

        <Section number="11" title="Indemnification">
          <p>Users agree to defend, indemnify, and hold harmless Company and its affiliates from any claims arising from:</p>
          <Bullets items={["misuse of the Platform", "violation of these Terms", "infringement of third-party rights", "unlawful conduct"]} />
          <p>Company may retain its own legal counsel at the user's expense where indemnification applies.</p>
        </Section>

        <Section number="12" title="Dispute Resolution">
          <p>Before initiating litigation, the parties shall attempt good-faith negotiation.</p>
          <p>Any claim must be filed within one (1) year after the event giving rise to the dispute.</p>
          <p>If Company prevails in any dispute, the claimant shall reimburse Company for reasonable attorneys' fees and legal costs.</p>
        </Section>

        <Section number="13" title="Injunctive Relief">
          <p>Company may seek immediate injunctive relief for:</p>
          <Bullets items={["misuse of confidential information", "intellectual property violations", "unauthorized recordings", "misuse of data", "circumvention of Company relationships"]} />
        </Section>

        <Section number="14" title="No Agency">
          <p>Nothing in these Terms creates:</p>
          <Bullets items={["partnership", "joint venture", "employment relationship", "agency relationship"]} />
          <p>Users may not bind Company to any obligations.</p>
        </Section>

        <Section number="15" title="Modifications">
          <p>Company may modify these Terms at any time by posting updated terms.</p>
          <p>Continued use of the Platform constitutes acceptance of the revised Terms.</p>
        </Section>

        <Section number="16" title="Sponsor Introductions and Business Networking">
          <p>The Platform is designed to facilitate professional networking and business introductions between event attendees and event sponsors.</p>
          <p>By using the Platform or requesting a meeting with a sponsor, users acknowledge and agree that the Company may share Limited Attendee Information with sponsors participating in the event.</p>
          <p>Limited Attendee Information may include:</p>
          <Bullets items={["name", "company", "job title", "email address", "phone number", "meeting activity or request information"]} />
          <p>Such information is shared solely for legitimate business networking purposes associated with the event.</p>
          <p>Sponsors may contact attendees regarding products, services, or partnership opportunities relevant to the event.</p>
          <p>The Company does not control sponsor communications following introductions and shall not be responsible for any subsequent interactions between attendees and sponsors.</p>
        </Section>

        <Section number="17" title="Meeting Introductions">
          <p>The Platform facilitates scheduling requests and introductions between attendees and sponsors.</p>
          <p>The Company does not guarantee:</p>
          <Bullets items={["meeting acceptance", "meeting availability", "meeting attendance", "meeting outcomes", "business opportunities resulting from meetings"]} />
          <p>Sponsors may accept or decline meeting requests at their sole discretion.</p>
          <p>Attendees are responsible for attending meetings they schedule and communicating directly with sponsors regarding scheduling adjustments.</p>
          <p>The Company shall not be responsible for missed meetings, scheduling conflicts, or the results of any meeting facilitated through the Platform.</p>
        </Section>

        <Section number="18" title="Networking Disclaimer">
          <p>Users acknowledge that the Platform facilitates introductions between independent parties.</p>
          <p>The Company does not endorse, verify, or guarantee the products, services, representations, or conduct of any sponsor or attendee.</p>
          <p>Users are solely responsible for evaluating any business opportunities arising from meetings or introductions facilitated through the Platform.</p>
        </Section>

        <Section number="19" title="Non-Circumvention of Company Relationships">
          <p>The Platform facilitates introductions and networking between attendees, sponsors, and other event participants.</p>
          <p>Users acknowledge that the Company invests significant resources in organizing events, developing relationships, and facilitating these introductions.</p>
          <p>Accordingly, users agree not to use the Platform, event participation, attendee lists, sponsor information, or introductions made through the Platform for the purpose of:</p>
          <Bullets items={[
            "organizing or promoting a competing event or conference",
            "replicating or substantially copying the Company's event model",
            "soliciting sponsors or participants for competing events",
            "commercially exploiting introductions made through the Platform in a manner intended to bypass the Company",
          ]} />
          <p>Nothing in this section restricts ordinary professional networking between attendees and sponsors. However, users may not use information obtained through the Platform to compete with or undermine the Company's event business.</p>
          <p>The Company reserves the right to pursue injunctive relief and other remedies for violations of this section.</p>
        </Section>

        <Section number="20" title="Platform Data and Analytics">
          <p>Users acknowledge that the Platform generates operational, networking, and engagement data in connection with event participation.</p>
          <p>All such data, including but not limited to:</p>
          <Bullets items={[
            "meeting activity and scheduling data",
            "sponsor engagement data",
            "attendee interaction data",
            "event usage analytics",
            "aggregated networking insights",
          ]} />
          <p>(collectively, "Platform Data") is owned exclusively by TreaSolution, Inc. d/b/a Converge Events.</p>
          <p>The Company may use Platform Data in aggregated or anonymized form for purposes including:</p>
          <Bullets items={[
            "improving event operations",
            "developing analytics and reporting",
            "providing sponsor engagement insights",
            "evaluating event performance",
            "developing future products or services",
          ]} />
          <p>Platform Data shall not include personal information beyond what is permitted under the Company's Privacy Policy.</p>
          <p>Users obtain no ownership rights in Platform Data and may not copy, extract, scrape, or commercially exploit Platform Data without the Company's prior written consent.</p>
        </Section>

        <Section number="21" title="Automated Access and AI Training Restrictions">
          <p>Users may not access or use the Platform through automated means without the Company's prior written permission.</p>
          <p>Prohibited activities include, but are not limited to:</p>
          <Bullets items={[
            "scraping or harvesting attendee, sponsor, or event information",
            "using bots, crawlers, or automated scripts to extract Platform data",
            "downloading or copying large portions of Platform content",
            "using Platform data to train artificial intelligence, machine learning models, or large language models",
            "building datasets derived from Platform activity or event participation",
            "reproducing sponsor lists, attendee lists, or meeting information outside the Platform",
          ]} />
          <p>The Platform and all related data are proprietary assets of TreaSolution, Inc. d/b/a Converge Events.</p>
          <p>Any automated extraction, AI training, dataset creation, or systematic copying of Platform content without written authorization is strictly prohibited.</p>
          <p>The Company reserves the right to pursue injunctive relief and other remedies for violations of this section.</p>
        </Section>

        <Section number="22" title="Contact">
          <p>
            For questions regarding these Terms, please visit:{" "}
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
