"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Locale } from "@/lib/i18n-strings";

export function SiteHeader({ active }: { active?: string }) {
  const { t, locale, setLocale } = useI18n();
  const { user, guestRemaining, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--border)] bg-[rgba(13,13,18,.92)] px-4 py-3 backdrop-blur-md md:px-6">
      <Link href="/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
        <Image
          src="/assets/images/logo.webp"
          alt="DreamUtopia"
          width={28}
          height={28}
          className="rounded-[7px]"
        />
        DreamUtopia
      </Link>

      <nav className="hidden items-center gap-1 md:flex">
        <NavLink href="/" active={active === "home"}>
          {t("nav.home", "Home")}
        </NavLink>
        <NavLink href="/pricing" active={active === "pricing"}>
          {t("nav.pricing", "Pricing")}
        </NavLink>
        <NavLink href="/workspace" active={active === "workspace"}>
          {t("nav.workspace", "Workspace")}
        </NavLink>
        <NavLink href="/#gallery">{t("nav.gallery", "Gallery")}</NavLink>
      </nav>

      <div className="flex items-center gap-2">
        <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
          <SelectTrigger className="w-[88px]" aria-label="Language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">EN</SelectItem>
            <SelectItem value="zh">中文</SelectItem>
            <SelectItem value="ja">日本語</SelectItem>
            <SelectItem value="es">ES</SelectItem>
          </SelectContent>
        </Select>

        {!loading && user ? (
          <>
            <Badge>
              <span className="tabular-nums">{user.credits}</span> credits
              <Link href="/pricing" className="ml-1.5 opacity-85 hover:underline">
                {t("hdr.buy", "Buy Credits")}
              </Link>
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              {t("hdr.logout", "Log Out")}
            </Button>
            <Button asChild size="sm">
              <Link href="/workspace">{t("nav.workspace", "Workspace")}</Link>
            </Button>
          </>
        ) : (
          <>
            {guestRemaining !== null && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {guestRemaining} free left
              </Badge>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth?mode=login">{t("hdr.login", "Log In")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth?mode=register">{t("hdr.signup", "Sign Up")}</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-white/5 text-foreground"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
