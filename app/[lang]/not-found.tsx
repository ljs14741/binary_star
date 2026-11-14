"use client";

import Link from "next/link";
import { useLang, useT } from "@/components/I18nProvider";

export default function NotFound() {
    const t = useT();
    const lang = useLang();
    return (
        <div className="px-6 py-20 text-center">
            <p className="text-4xl">✦</p>
            <h1 className="mt-3 text-xl font-semibold text-ink">{t("nf_title")}</h1>
            <p className="mt-1 text-sm text-muted">{t("nf_body")}</p>
            <Link href={`/${lang}`} className="btn-star mt-6 inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold">
                {t("nf_home")}
            </Link>
        </div>
    );
}
