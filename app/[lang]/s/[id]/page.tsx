import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFeed, getPublicStory } from "@/lib/stories";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { getBaseUrl, siteName } from "@/lib/site";
import { getVoterKey } from "@/lib/voter";
import { excerpt } from "@/lib/format";
import StorySwiper from "@/components/StorySwiper";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    const id = parseInt((await params).id, 10);
    const story = Number.isFinite(id) ? await getPublicStory(id, lang) : null;
    if (!story) return { title: t(lang, "nf_title"), robots: { index: false } };
    const title = t(lang, "meta_story_title", { excerpt: excerpt(story.body, 40), site: siteName(lang) });
    const description = t(lang, "meta_story_desc", { n: story.empathyCount, c: story.countryCount, room: story.roomTitle });
    return {
        title: { absolute: title },
        description,
        alternates: alternates(`/s/${id}`, lang),
        openGraph: { title: `${t(lang, "share_title")} · ${excerpt(story.body, 50)}`, description, type: "article", url: `${getBaseUrl()}/${lang}/s/${id}` },
        twitter: { card: "summary_large_image", title, description },
    };
}

export default async function StoryPage({ params }: P) {
    const lang = await requireLang(params);
    const id = parseInt((await params).id, 10);
    if (!Number.isFinite(id)) notFound();
    const voterKey = await getVoterKey();
    const story = await getPublicStory(id, lang, voterKey);
    if (!story) notFound();
    // 공유 링크: 그 이야기 먼저, 이어서 같은 방 이야기
    const feed = await getFeed({ roomSlug: story.roomSlug, lang, voterKey, firstId: id, limit: 6 });
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SocialMediaPosting",
        headline: excerpt(story.body, 80),
        articleBody: story.body,
        inLanguage: story.lang,
        datePublished: story.createdAt,
        url: `${getBaseUrl()}/${lang}/s/${id}`,
        isPartOf: { "@type": "WebSite", name: siteName(lang), url: `${getBaseUrl()}/${lang}` },
        interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: story.empathyCount },
        author: { "@type": "Person", name: "Anonymous" },
    };
    return (
        <div>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <div className="px-4 pt-2">
                <h1 className="text-lg font-semibold text-ink">{story.roomTitle}</h1>
            </div>
            <StorySwiper roomSlug={story.roomSlug} roomTitle={story.roomTitle} firstId={id} initial={feed.stories.length ? feed.stories : [story]} initialHasMore={feed.hasMore} />
        </div>
    );
}
