import type { Metadata } from "next";
import { getFeaturedRoom, listRooms } from "@/lib/rooms";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { getBaseUrl, siteName } from "@/lib/site";
import Link from "next/link";
import { FeaturedBanner } from "@/components/RoomList";
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
            {/* 첫 화면: 밤의 언덕 (실시간). 주제 목록은 언덕 위 "주제 한눈에"로 옮김. 아래는 검색 엔진·WebGL 없는 기기용 글자 링크만 */}
            <Hill initialTotal={presence.total} />
            <div id="rooms" className="scroll-mt-14 px-4 pt-5">
                <section className="text-center">
                    <h1 className="text-xl font-semibold leading-snug text-ink">{t(lang, "home_title")}</h1>
                    <p className="mt-1.5 text-sm text-muted">{t(lang, "home_sub")}</p>
                </section>
                {featured && (
                    <div className="mt-4">
                        <FeaturedBanner room={featured} lang={lang} />
                    </div>
                )}
                <p className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[12px] text-dim">
                    {list.map((r) => (
                        <Link key={r.slug} href={`/${lang}/room/${r.slug}`} className="underline-offset-4 hover:text-ink hover:underline">
                            {r.title}
                        </Link>
                    ))}
                </p>
            </div>
        </div>
    );
}
