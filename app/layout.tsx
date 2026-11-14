import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { HTML_LANG, isLang, type Lang } from "@/lib/i18n/config";
import Sky from "@/components/Sky";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import AdSenseAuto from "@/components/AdSlot";

export const metadata: Metadata = {
    title: "별말씀",
    description: "모르는 사람의 이야기에 공감하고, 내 이야기도 남겨요",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const h = await headers();
    const l = h.get("x-star-lang");
    const lang: Lang = isLang(l) ? l : "ko";
    return (
        <html lang={HTML_LANG[lang]} suppressHydrationWarning>
            <body className="antialiased">
                <Sky />
                <GoogleAnalytics />
                <AdSenseAuto />
                {children}
            </body>
        </html>
    );
}
