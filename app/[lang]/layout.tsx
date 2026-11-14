import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLang, LANGS, type Lang } from "@/lib/i18n/config";
import { getDict, t } from "@/lib/i18n";
import { getBaseUrl, siteName } from "@/lib/site";
import { I18nProvider } from "@/components/I18nProvider";
import { ToastProvider } from "@/components/Toast";
import { DialogProvider } from "@/components/Dialog";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export function generateStaticParams() {
    return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang: l } = await params;
    const lang: Lang = isLang(l) ? l : "ko";
    const base = getBaseUrl();
    return {
        metadataBase: new URL(base),
        title: { default: t(lang, "meta_home_title", { site: siteName(lang) }), template: `%s – ${siteName(lang)}` },
        description: t(lang, "meta_home_desc"),
        applicationName: siteName(lang),
        openGraph: { siteName: siteName(lang), type: "website", locale: lang.replace("-", "_") },
        twitter: { card: "summary_large_image" },
        robots: { index: true, follow: true },
    };
}

// 글꼴 없는 기기(특히 PC)에서 일본어·중국어가 깨지지 않게 언어별 Noto Sans 만 가볍게 연결
const FONT_CSS: Record<Lang, string> = {
    ko: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap",
    en: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap",
    ja: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap",
    "zh-TW": "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;600;700&display=swap",
};

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    if (!isLang(lang)) notFound();
    const dict = getDict(lang);
    return (
        <I18nProvider lang={lang} dict={dict}>
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={FONT_CSS[lang]} />
            <ToastProvider>
                <DialogProvider>
                    <div className="phone relative flex min-h-dvh flex-col">
                        <SiteHeader />
                        <main className="flex-1">{children}</main>
                        <SiteFooter />
                    </div>
                </DialogProvider>
            </ToastProvider>
        </I18nProvider>
    );
}
