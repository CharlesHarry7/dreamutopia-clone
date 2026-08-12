import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Free AI Video" };

export default function FreeAiVideoPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="mb-4 text-4xl font-extrabold">Free AI Video</h1>
        <p className="mb-8 text-muted-foreground">
          2 free Lite image-to-video generations per device — no signup. Create an account for 10
          credits.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/workspace">Try free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth?mode=register">Sign up</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
