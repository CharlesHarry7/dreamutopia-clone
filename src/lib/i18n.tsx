"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STRINGS, type Locale } from "@/lib/i18n-strings";

const KEY = "du_lang";
const HTML_LANG: Record<Locale, string> = {
  en: "en",
  zh: "zh-CN",
  ja: "ja",
  es: "es",
};

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readLocale(): Locale {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "zh" || v === "ja" || v === "es") return v;
  } catch {
    /* ignore */
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(readLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale] || "en";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const table = STRINGS[locale] || STRINGS.en;
      return table[key] || STRINGS.en[key] || fallback || key;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
