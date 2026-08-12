import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-20 text-center">
        <p className="mb-2 text-sm font-semibold text-[var(--primary2)]">404</p>
        <h1 className="mb-3 text-3xl font-extrabold">Page not found</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          That URL isn’t here. Try the home page or jump into the workspace to create.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/workspace">Workspace</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
