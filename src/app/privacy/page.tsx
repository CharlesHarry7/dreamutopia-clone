import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Privacy",
  description:
    "How DreamUtopia Clone stores account, session, guest trial, and media data on Cloudflare.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="mb-2 text-3xl font-extrabold">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: August 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">What we store</h2>
            <p>
              Account emails, hashed passwords, credit balances, and generation metadata live in
              Cloudflare D1. Session tokens and guest trial counters live in KV. Uploaded and
              generated media may be stored in R2.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Guest trials</h2>
            <p>
              Anonymous Lite tries use an HttpOnly cookie plus an IP-based counter in KV. Guest jobs
              are not saved to an account history until you sign up.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">PWA / service worker</h2>
            <p>
              If you install the site, a service worker (`/sw.js`) and web manifest may cache static
              assets for offline shell use. Generation still requires the network and provider APIs.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">No sale of data</h2>
            <p>
              We do not sell personal data. Contact the site operator for deletion requests.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          See also{" "}
          <Link href="/terms" className="font-semibold text-[var(--primary2)] hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
