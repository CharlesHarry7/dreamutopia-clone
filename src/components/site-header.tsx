"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  /** Path when the drawer was opened — auto-hides after navigation without setState-in-effect. */
  const [menuAtPath, setMenuAtPath] = useState(pathname);
  const showMenu = menuOpen && menuAtPath === pathname;
  const menuId = useId();

  useEffect(() => {
    if (!showMenu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onResize() {
      if (window.matchMedia("(min-width: 768px)").matches) setMenuOpen(false);
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [showMenu]);

  const nav = (
    <>
      <NavLink href="/" active={active === "home"} onNavigate={() => setMenuOpen(false)}>
        {t("nav.home", "Home")}
      </NavLink>
      <NavLink href="/pricing" active={active === "pricing"} onNavigate={() => setMenuOpen(false)}>
        {t("nav.pricing", "Pricing")}
      </NavLink>
      <NavLink
        href="/workspace"
        active={active === "workspace"}
        onNavigate={() => setMenuOpen(false)}
      >
        {t("nav.workspace", "Workspace")}
      </NavLink>
      <NavLink href="/#gallery" onNavigate={() => setMenuOpen(false)}>
        {t("nav.gallery", "Gallery")}
      </NavLink>
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(13,13,18,.92)] backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
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

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {nav}
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

          {loading ? (
            <Badge variant="secondary" className="min-w-[4.5rem] justify-center opacity-60">
              …
            </Badge>
          ) : user ? (
            <>
              {/* md+ matches primary nav; below md auth CTAs live in the Menu drawer */}
              <Badge className="hidden md:inline-flex">
                <span className="tabular-nums">{user.credits}</span> credits
                <Button asChild variant="link" className="ml-1.5 h-auto px-0 text-xs opacity-85">
                  <Link href="/pricing">{t("hdr.buy", "Buy Credits")}</Link>
                </Button>
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex"
                onClick={() => void logout()}
              >
                {t("hdr.logout", "Log Out")}
              </Button>
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href="/workspace">{t("nav.workspace", "Workspace")}</Link>
              </Button>
            </>
          ) : (
            <>
              {guestRemaining !== null && (
                <Badge variant="secondary" className="hidden md:inline-flex">
                  {guestRemaining} free left
                </Badge>
              )}
              <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                <Link href="/auth?mode=login">{t("hdr.login", "Log In")}</Link>
              </Button>
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href="/auth?mode=register">{t("hdr.signup", "Sign Up")}</Link>
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="md:hidden"
            aria-expanded={showMenu}
            aria-controls={menuId}
            aria-label={showMenu ? "Close menu" : "Open menu"}
            onClick={() => {
              if (showMenu) {
                setMenuOpen(false);
                return;
              }
              setMenuAtPath(pathname);
              setMenuOpen(true);
            }}
          >
            {showMenu ? "Close" : "Menu"}
          </Button>
        </div>
      </div>

      {showMenu && (
        <div
          id={menuId}
          className="max-h-[min(70vh,28rem)] overflow-y-auto border-t border-[var(--border)] px-4 py-3 md:hidden"
          role="navigation"
          aria-label="Mobile"
        >
          <nav className="flex flex-col gap-1">{nav}</nav>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {user ? (
              <>
                <Badge>
                  <span className="tabular-nums">{user.credits}</span> credits
                </Badge>
                <Button asChild size="sm" variant="outline">
                  <Link href="/pricing" onClick={() => setMenuOpen(false)}>
                    {t("hdr.buy", "Buy Credits")}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                >
                  {t("hdr.logout", "Log Out")}
                </Button>
                <Button asChild size="sm">
                  <Link href="/workspace" onClick={() => setMenuOpen(false)}>
                    {t("nav.workspace", "Workspace")}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                {guestRemaining !== null && (
                  <Badge variant="secondary">{guestRemaining} free left</Badge>
                )}
                <Button asChild size="sm" variant="ghost">
                  <Link href="/auth?mode=login" onClick={() => setMenuOpen(false)}>
                    {t("hdr.login", "Log In")}
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth?mode=register" onClick={() => setMenuOpen(false)}>
                    {t("hdr.signup", "Sign Up")}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
  onNavigate,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "bg-white/5 text-foreground"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
