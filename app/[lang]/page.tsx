import type { Metadata } from "next";
import { getFeaturedRoom, listRooms } from "@/lib/rooms";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { getBaseUrl, siteName } from "@/lib/site";
import RoomList, { FeaturedBanner } from "@/components/RoomList";
import Hill from "@/components/hill/Hill";
import { getPresence } from "@/lib/hill";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const lang = await requireLang(params);
    return {
        title: { absolute: t(lang, "meta_home_title", { site: siteName(lang) }) },
        description: t(lang, "meta_home_desc"),
        alternates: alternates("", lang),
    };
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
    const lang = await requireLang(params);
    const [rooms, featured, presence] = await Promise.all([listRooms(lang), getFeaturedRoom(lang), getPresence()]);
    const list = rooms.filter((r) => r.id !== featured?.id);
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName(lang),
        url: `${getBaseUrl()}/${lang}`,
        inLanguage: lang,
        description: t(lang, "meta_home_desc"),
    };
    return (
        <div className="pb-6">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            {/* 첫 화면: 밤의 언덕 (실시간). 아래는 방 목록 (검색 엔진·느린 기기용 글자) */}
            <Hill initialTotal={presence.total} />
            <div id="rooms" className="scroll-mt-14 px-4 pt-3">
            <section className="mb-5 pt-4 text-center">
                <h1 className="text-2xl font-semibold leading-snug text-ink">{t(lang, "home_title")}</h1>
                <p className="mt-2 text-sm text-muted">{t(lang, "home_sub")}</p>
            </section>
            {featured && (
                <div className="mb-4">
                    <FeaturedBanner room={featured} lang={lang} />
                </div>
            )}
            <RoomList rooms={list} lang={lang} />
            </div>
        </div>
    );
}
