import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="prose prose-invert mx-auto max-w-3xl px-5 py-14">
        <h1 className="mb-4 text-3xl font-extrabold">Privacy Policy</h1>
        <p className="text-muted-foreground">
          DreamUtopia Clone stores account emails, hashed passwords, credit balances, and generation
          metadata in Cloudflare D1. Session tokens and guest trial counters live in KV. Uploaded
          media may be stored in R2. We do not sell personal data. Contact the site operator for
          deletion requests.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
