import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="prose prose-invert mx-auto max-w-3xl px-5 py-14">
        <h1 className="mb-4 text-3xl font-extrabold">Terms of Service</h1>
        <p className="text-muted-foreground">
          This is a clone / demo product for learning and product experimentation. You are
          responsible for content you generate. Do not upload unlawful material. Credits are
          consumed per generation. Paid packs only charge when Stripe secrets are configured —
          otherwise checkout returns 503 and the UI will not pretend to charge.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
