"use client";

import { usePathname, useRouter } from "next/navigation";
import { Globe2 } from "lucide-react";
import { LANGS, LANG_LABEL, isLang, type Lang } from "@/lib/i18n/config";
import { useLang, useT } from "./I18nProvider";

export default function LangSwitcher() {
    const lang = useLang();
    const t = useT();
    const pathname = usePathname() || "/";
    const router = useRouter();

    const switchTo = (next: Lang) => {
        const parts = pathname.split("/");
        if (isLang(parts[1])) parts[1] = next;
        else parts.splice(1, 0, next);
        document.cookie = `star_lang=${next}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
        router.push(parts.join("/") || `/${next}`);
    };

    return (
        <label className="relative flex items-center gap-1 rounded-full border border-line bg-card px-2 py-1 text-xs text-muted">
            <Globe2 size={13} />
            <span className="text-[11px] text-dim">{t("lang_label")}</span>
            <select
                aria-label={t("lang_label")}
                value={lang}
                onChange={(e) => switchTo(e.target.value as Lang)}
                className="appearance-none bg-transparent pr-1 text-xs text-ink outline-none"
            >
                {LANGS.map((l) => (
                    <option key={l} value={l} className="bg-night text-ink">
                        {LANG_LABEL[l]}
                    </option>
                ))}
            </select>
        </label>
    );
}
