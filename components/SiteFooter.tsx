"use client";

import Link from "next/link";
import { useLang, useT } from "./I18nProvider";
import { langPath } from "@/lib/client";
import { siteName, SISTER_SITES, sisterUrl } from "@/lib/site";

export default function SiteFooter() {
    const lang = useLang();
    const t = useT();
    return (
        <footer className="mt-10 px-5 pb-10 pt-6 text-center text-[11px] leading-relaxed text-dim">
            <nav className="mb-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                <Link href={langPath(lang, "/about")}>{t("nav_about")}</Link>
                <Link href={langPath(lang, "/privacy")}>{t("nav_privacy")}</Link>
                <Link href={langPath(lang, "/terms")}>{t("nav_terms")}</Link>
                <Link href={langPath(lang, "/propose")}>{t("nav_propose")}</Link>
            </nav>
            <p className="mb-2 flex flex-wrap justify-center gap-x-2 gap-y-1">
                <span className="text-dim">{t("footer_sister")}</span>
                {SISTER_SITES.map((s) => (
                    <a key={s.url} href={sisterUrl(s.url)} className="text-muted hover:text-ink" target="_blank" rel="noopener">
                        {s.name}
                    </a>
                ))}
            </p>
            <p>© {new Date().getFullYear()} {siteName(lang)} · binaryworld.kr</p>
        </footer>
    );
}
