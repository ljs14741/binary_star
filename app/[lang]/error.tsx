"use client";
// 페이지 안에서 터진 오류를 Next 기본 화면 대신 테마 화면으로 보여 줌. [lang] 레이아웃 안이라 번역 훅 사용 가능
import { useEffect } from "react";
import Link from "next/link";
import { useLang, useT } from "@/components/I18nProvider";
import { langPath } from "@/lib/client";

export default function LangError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const t = useT();
    const lang = useLang();
    useEffect(() => {
        console.error("[page error]", error);
    }, [error]);
    return (
        <div className="phone px-6 py-20 text-center">
            <p className="text-4xl">✦</p>
            <h1 className="mt-3 text-xl font-semibold text-ink">{t("error_title")}</h1>
            <p className="mt-2 text-sm text-muted">{t("error_sub")}</p>
            <div className="mt-6 flex justify-center gap-3">
                <button onClick={reset} className="btn-star inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold">
                    {t("error_retry")}
                </button>
                <Link href={langPath(lang, "/")} className="glass inline-flex h-11 items-center rounded-full px-6 text-sm text-ink">
                    {t("error_home")}
                </Link>
            </div>
        </div>
    );
}
