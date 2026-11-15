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

    // 아이콘 하나만 보이고, 그 위에 투명한 select 를 겹쳐서 누르면 기기 기본 언어 목록이 뜸
    return (
        <label title={t("lang_label")} className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-muted hover:text-ink">
            <Globe2 size={16} />
            <select
                aria-label={t("lang_label")}
                value={lang}
                onChange={(e) => switchTo(e.target.value as Lang)}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
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
