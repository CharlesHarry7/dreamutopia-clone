import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Photo to Video",
  description:
    "Animate still photos into short AI video clips with DreamUtopia. Start free — 2 Lite tries.",
  openGraph: {
    title: "Photo to Video · DreamUtopia",
    description: "Same pipeline as image-to-video — animate photos into short clips.",
  },
};

export default function PhotoToVideoPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="mb-4 text-4xl font-extrabold">Photo to Video</h1>
        <p className="mb-8 text-muted-foreground">
          Same pipeline as image-to-video — animate still photos into short clips.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/workspace">Start free</Link>
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
