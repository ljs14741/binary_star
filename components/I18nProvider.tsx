"use client";

import { createContext, useCallback, useContext } from "react";
import type { Dict, DictKey } from "@/lib/i18n";
import { fill } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n/config";

type Ctx = { lang: Lang; dict: Dict };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ lang, dict, children }: Ctx & { children: React.ReactNode }) {
    return <I18nContext.Provider value={{ lang, dict }}>{children}</I18nContext.Provider>;
}

export function useLang(): Lang {
    return useContext(I18nContext)?.lang ?? "ko";
}

export function useT() {
    const ctx = useContext(I18nContext);
    const dict = ctx?.dict;
    return useCallback(
        (key: DictKey, params?: Record<string, string | number>) => {
            const v = (dict?.[key] as string | undefined) ?? key;
            return fill(v, params);
        },
        [dict]
    );
}
