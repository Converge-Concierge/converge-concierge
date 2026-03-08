import { Link } from "wouter";

export default function PublicFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`w-full border-t border-border/50 bg-white/50 relative z-10 shrink-0 ${className}`}>
      <div className="py-5 px-6 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 text-xs text-muted-foreground">
        <span>&copy; 2026 Converge Events. All rights reserved.</span>
        <span className="hidden sm:inline opacity-30">|</span>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-foreground transition-colors" data-testid="link-terms">
            Terms of Use
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy">
            Privacy Policy
          </Link>
          <a
            href="https://convergeevents.com/contact/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
            data-testid="link-contact"
          >
            Contact
          </a>
          <a
            href="https://ConvergeEvents.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
            data-testid="link-converge-website"
          >
            ConvergeEvents.com
          </a>
        </div>
      </div>
    </footer>
  );
}
