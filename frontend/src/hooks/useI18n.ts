import {createContext, useContext, useEffect, useState, useCallback, type ReactNode} from "react";
import {api} from "../api/client";
import React from "react";
import deCatalog from "../data/i18n/de.json";

type I18nStrings = Record<string, unknown>;

const DEFAULT_LANG = "de";

// Bundled i18n catalogs (pattern 05): generated from backend/config/i18n/*.yaml
// by `make sync-i18n`. The default language is imported eagerly for an instant
// first paint; the other languages are lazy chunks loaded on a language switch,
// so the frontend needs no backend roundtrip for translations.
const catalogLoaders = import.meta.glob<{default: I18nStrings}>("../data/i18n/*.json");

async function loadCatalog(lang: string): Promise<I18nStrings> {
    if (lang === DEFAULT_LANG) return deCatalog as I18nStrings;
    const loader = catalogLoaders[`../data/i18n/${lang}.json`];
    if (!loader) return deCatalog as I18nStrings;
    const module = await loader();
    return module.default;
}

interface I18nContextValue {
    t: (key: string, fallback?: string) => string;
    lang: string;
    setLang: (lang: string) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// Module-level cache to avoid reloading on remount. Seeded with the eager
// default so the very first render already has strings.
let cachedLang = DEFAULT_LANG;
let cachedStrings: I18nStrings = deCatalog as I18nStrings;

/**
 * Non-hook translation accessor for module-level code (e.g. utils/notify,
 * utils/friendlyError) that cannot call the `useI18n` hook. Resolves against
 * the catalog the provider has loaded; falls back to `fallback` or the key.
 */
export function translate(key: string, fallback?: string): string {
    const parts = key.split(".");
    let current: unknown = cachedStrings;
    for (const part of parts) {
        if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[part];
        } else {
            return fallback ?? key;
        }
    }
    return typeof current === "string" ? current : (fallback ?? key);
}

export function I18nProvider({children}: {children: ReactNode}) {
    const [strings, setStrings] = useState<I18nStrings>(cachedStrings);
    const [lang, setLangState] = useState(cachedLang || "de");

    // Resolve the preferred language from app settings on mount (best-effort;
    // falls back to the default when the backend is unavailable).
    useEffect(() => {
        api.settings.getApp().then((config) => {
            const appLang = ((config.app as Record<string, unknown>)?.default_language as string) || DEFAULT_LANG;
            setLangState(appLang);
        }).catch(() => {});
    }, []);

    // Load the bundled catalog when the language changes.
    useEffect(() => {
        let cancelled = false;
        if (lang === cachedLang && Object.keys(cachedStrings).length > 0) {
            setStrings(cachedStrings);
            return;
        }
        loadCatalog(lang).then((data) => {
            if (cancelled) return;
            cachedLang = lang;
            cachedStrings = data;
            setStrings(data);
        });
        return () => {
            cancelled = true;
        };
    }, [lang]);

    const setLang = useCallback((newLang: string) => {
        setLangState(newLang);
    }, []);

    const t = useCallback((key: string, fallback?: string): string => {
        const parts = key.split(".");
        let current: unknown = strings;
        for (const part of parts) {
            if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
                current = (current as Record<string, unknown>)[part];
            } else {
                return fallback || key;
            }
        }
        return typeof current === "string" ? current : (fallback || key);
    }, [strings]);

    const value: I18nContextValue = {t, lang, setLang};

    return React.createElement(I18nContext.Provider, {value}, children);
}

/**
 * Hook to access i18n translations.
 * Returns {t, lang, setLang} - setLang triggers live language switch.
 */
export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        // Fallback for components rendered outside provider (e.g. tests)
        return {
            t: (key: string, fallback?: string) => fallback || key,
            lang: "de",
            setLang: () => {},
        };
    }
    return ctx;
}
