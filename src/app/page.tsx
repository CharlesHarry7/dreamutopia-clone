"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PromoBar } from "@/components/promo-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type GalleryItem = { id: number | string; url: string; kind?: string; prompt?: string };

const FALLBACK_GALLERY = [
  "/assets/images/g1.webp",
  "/assets/images/g2.webp",
  "/assets/images/g3.webp",
  "/assets/images/g4.webp",
  "/assets/images/g5.webp",
  "/assets/images/g6.webp",
  "/assets/images/g7.webp",
  "/assets/images/g8.webp",
  "/assets/images/g9.webp",
  "/assets/images/g10.webp",
  "/assets/images/b1.webp",
  "/assets/images/b2.webp",
];

export default function HomePage() {
  const { t } = useI18n();
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<{ items?: GalleryItem[] }>("/gallery");
        if (cancelled) return;
        setGallery(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) setGallery([]);
      } finally {
        if (!cancelled) setGalleryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const usingFallbackGallery = !galleryLoading && gallery.length === 0;
  const items = usingFallbackGallery
    ? FALLBACK_GALLERY.map((url, i) => ({ id: i, url }))
    : gallery.slice(0, 12);

  return (
    <>
      <PromoBar />
      <SiteHeader active="home" />
      <main>
        <section className="px-5 pb-10 pt-14 text-center md:pt-16">
          <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 py-1.5 text-[12.5px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            {t("hero.meta", "AI Video Generator • 2 Free Tries • No Signup Required")}
            <span className="text-[var(--text3)]">·</span>
            <span className="font-semibold text-white">
              {t("hero.new", "NEW: Pro Model with Sound")}
            </span>
          </div>

          <h1
            className="animate-fade-up mx-auto mb-4 max-w-4xl text-4xl font-extrabold leading-[1.15] tracking-tight md:text-6xl"
            dangerouslySetInnerHTML={{
              __html: t(
                "hero.title",
                'Turn Any Image Into<br><span class="gradient-text">Stunning AI Video</span>'
              ).replace(/class="gradient"/g, 'class="gradient-text"'),
            }}
          />
          <p className="animate-fade-up-delay mx-auto mb-6 max-w-xl text-[17px] text-muted-foreground">
            {t(
              "hero.sub",
              "Transform your photos into cinematic AI-powered videos in seconds. Choose from multiple premium AI models. Start free — no account needed, no credit card required."
            )}
          </p>

          <div className="animate-fade-up-delay mb-3.5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold">
            <span className="text-[var(--green)]">★</span>
            {t("hero.free", "2 FREE generations for everyone — no login needed")}
          </div>
          <p className="mb-7 text-[13.5px] text-muted-foreground">
            <Button asChild variant="link" className="h-auto px-0 text-[13.5px] font-semibold">
              <Link href="/auth?mode=register">Sign up</Link>
            </Button>{" "}
            to get <b className="text-foreground">10 free credits</b> — unlock more advanced models
            with full controls.
          </p>

          <div className="mb-12 flex w-full max-w-md flex-col justify-center gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="animate-pulse-glow w-full sm:w-auto">
              <Link href="/workspace">{t("hero.cta", "Start Creating Free →")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/#gallery">{t("hero.how", "See examples")}</Link>
            </Button>
          </div>

          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-[var(--border)] shadow-[var(--shadow)]">
            <Image
              src="/assets/images/feature-image-to-video.webp"
              alt="DreamUtopia image to video"
              width={1280}
              height={720}
              className="h-auto w-full object-cover"
              priority
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--bg)]/50 to-transparent" />
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-8 px-5 py-16 md:grid-cols-3">
          {[
            {
              img: "/assets/images/feature-ai-models.webp",
              h: t("feat1.h", "Multiple Premium AI Models"),
              p: t(
                "feat1.p",
                "Choose from Lite, Medium, and Pro tiers — each optimized for different styles, quality levels, and motion types."
              ),
            },
            {
              img: "/assets/images/feature-cinematic.webp",
              h: t("feat2.h", "Ready in Seconds"),
              p: t(
                "feat2.p",
                "Upload an image, describe the motion you want, and get your AI video in seconds. Zero technical skills needed."
              ),
            },
            {
              img: "/assets/images/feature-workspace.webp",
              h: t("feat3.h", "Pro Model with Sound"),
              p: t(
                "feat3.p",
                "Generate AI videos with synchronized audio. The Pro model brings your creations to life with full sound output."
              ),
            },
          ].map((f) => (
            <article key={f.h} className="text-left">
              <div className="mb-4 overflow-hidden rounded-xl border border-[var(--border)]">
                <Image src={f.img} alt="" width={640} height={400} className="h-44 w-full object-cover" />
              </div>
              <h3 className="mb-2 text-lg font-bold">{f.h}</h3>
              <p className="text-sm text-muted-foreground">{f.p}</p>
            </article>
          ))}
          <div className="md:col-span-3 flex justify-center pt-2">
            <Button asChild size="lg">
              <Link href="/workspace">{t("feat.cta", "Try it free →")}</Link>
            </Button>
          </div>
        </section>

        <section id="gallery" className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-9 text-center">
            <h2 className="mb-2 text-3xl font-extrabold">
              {t("gallery.h", "Crafted with DreamUtopia")}
            </h2>
            <p className="text-muted-foreground">
              {t("gallery.p", "A gallery of stunning visuals our creators have made")}
            </p>
            {usingFallbackGallery && (
              <p className="mt-2 text-xs text-muted-foreground" role="status">
                Showing sample visuals — no community publishes yet.
              </p>
            )}
          </div>
          {galleryLoading && (
            <p className="mb-4 text-center text-xs text-muted-foreground" role="status">
              Loading community gallery…
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {galleryLoading
              ? Array.from({ length: 12 }, (_, i) => (
                  <div
                    key={`sk-${i}`}
                    className="aspect-[3/4] animate-pulse rounded-[10px] bg-white/5"
                    aria-hidden
                  />
                ))
              : items.map((item) => {
                  const url = item.url;
                  const prompt = "prompt" in item ? item.prompt || "" : "";
                  const isVideo =
                    ("kind" in item && String(item.kind).toLowerCase() === "video") ||
                    /\.(mp4|webm|mov)(\?|$)/i.test(url);
                  return (
                    <a
                      key={String(item.id)}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="group aspect-[3/4] overflow-hidden rounded-[10px] bg-[var(--bg2)] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={prompt ? `Open gallery item: ${prompt}` : "Open gallery item"}
                    >
                      {isVideo ? (
                        <video
                          src={url}
                          muted
                          playsInline
                          loop
                          autoPlay
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={prompt} className="h-full w-full object-cover" />
                      )}
                    </a>
                  );
                })}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="mb-3 text-3xl font-extrabold">
            {t("why.h", "Why creators choose DreamUtopia")}
          </h2>
          <p className="mb-8 text-muted-foreground">
            {t(
              "why.p",
              "DreamUtopia combines multiple state-of-the-art AI models with an intuitive interface, giving you studio-quality results with zero learning curve."
            )}
          </p>
          <ul className="mb-8 space-y-3 text-left text-sm text-muted-foreground">
            {[
              t("why.l1", "2 free generations per device — no signup or credit card required"),
              t("why.l2", "3 premium AI models optimized for different styles and use cases"),
              t("why.l3", "Fast processing with live progress while your video renders"),
              t("why.l4", "Your content stays private — encrypted transfers and full ownership"),
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-[var(--primary2)]">✓</span>
                {line}
              </li>
            ))}
          </ul>
          <Button asChild size="lg">
            <Link href="/workspace">{t("why.cta", "Open Image‑to‑Video App")}</Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
