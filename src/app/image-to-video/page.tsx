import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Image to Video",
  description: "Turn any photo into an AI video with DreamUtopia.",
};

export default function ImageToVideoPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="mb-4 text-4xl font-extrabold">
          Image to <span className="gradient-text">Video</span>
        </h1>
        <p className="mb-8 text-muted-foreground">
          Upload a start frame, describe the motion, and generate with Lite / Medium / Pro models.
          Guests get 2 free Lite tries.
        </p>
        <Button asChild size="lg">
          <Link href="/workspace">Open workspace</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  );
}
