import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Terms",
  description:
    "Terms for DreamUtopia Clone — demo product, content responsibility, credits, and honest checkout.",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="mb-2 text-3xl font-extrabold">Terms of Service</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: August 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Demo / clone product</h2>
            <p>
              This is a clone / demo for learning and product experimentation. It is not affiliated
              with dreamutopia.net.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Your content</h2>
            <p>
              You are responsible for content you upload and generate. Do not upload unlawful
              material. You retain ownership of your prompts and outputs subject to the AI provider’s
              terms.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Credits & payments</h2>
            <p>
              Credits are consumed per generation. Paid packs only charge when Stripe secrets are
              configured — otherwise checkout returns 503 and the UI will not pretend to charge.
              Provider (KIE) failures are returned honestly; the app does not invent successful
              results.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Availability</h2>
            <p>
              Features depend on Cloudflare bindings and third-party APIs. Service may be unavailable
              or rate-limited without notice.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          See also{" "}
          <Button asChild variant="link" className="h-auto px-0 text-sm font-semibold">
            <Link href="/privacy">Privacy Policy</Link>
          </Button>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
