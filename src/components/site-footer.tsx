import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg2)] px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="mb-2 text-base font-bold">DreamUtopia</div>
          <p className="text-sm text-muted-foreground">
            AI image-to-video generator. Clone of dreamutopia.net — Cursor build.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="mb-1 font-semibold text-foreground">Product</div>
          <Link href="/workspace" className="hover:text-foreground">
            Workspace
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/image-to-video" className="hover:text-foreground">
            Image to Video
          </Link>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="mb-1 font-semibold text-foreground">Account</div>
          <Link href="/auth?mode=login" className="hover:text-foreground">
            Log In
          </Link>
          <Link href="/auth?mode=register" className="hover:text-foreground">
            Sign Up
          </Link>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="mb-1 font-semibold text-foreground">Legal</div>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-5xl text-xs text-muted-foreground/70">
        © {new Date().getFullYear()} DreamUtopia Clone. Not affiliated with dreamutopia.net.
      </p>
    </footer>
  );
}
