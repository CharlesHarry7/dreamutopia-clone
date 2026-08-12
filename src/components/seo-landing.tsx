import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

type Cta = { href: string; label: string };

export function SeoLanding({
  title,
  titleAccent,
  lead,
  primary,
  secondary,
}: {
  title: string;
  /** Optional word rendered with gradient after the title. */
  titleAccent?: string;
  lead: string;
  primary: Cta;
  secondary: Cta;
}) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="mb-4 text-4xl font-extrabold">
          {title}
          {titleAccent ? (
            <>
              {" "}
              <span className="gradient-text">{titleAccent}</span>
            </>
          ) : null}
        </h1>
        <p className="mb-8 text-muted-foreground">{lead}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={secondary.href}>{secondary.label}</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
