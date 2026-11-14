// 이야기 번역본: 캐시(story_translation) 먼저, 없으면 키 있을 때만 생성
import { prisma } from "./prisma";
import { aiEnabled, aiTranslate } from "./ai";
import type { Lang } from "./i18n/config";
import { isLang } from "./i18n/config";

export type Translation = { body: string; from: Lang; pending: boolean };

export async function getTranslation(storyId: number, to: Lang): Promise<Translation | null> {
    const story = await prisma.story.findUnique({ where: { id: storyId }, select: { body: true, lang: true, status: true } });
    if (!story) return null;
    const from: Lang = isLang(story.lang) ? story.lang : "en";
    if (from === to) return null;
    const cached = await prisma.story_translation.findUnique({ where: { story_id_lang: { story_id: storyId, lang: to } } });
    if (cached) return { body: cached.body, from, pending: false };
    if (!aiEnabled()) return { body: story.body, from, pending: true };
    const translated = await aiTranslate(story.body, from, to);
    if (!translated) return { body: story.body, from, pending: true };
    await prisma.story_translation.upsert({
        where: { story_id_lang: { story_id: storyId, lang: to } },
        create: { story_id: storyId, lang: to, body: translated },
        update: { body: translated },
    });
    return { body: translated, from, pending: false };
}

// 캐시에 있는 것만 (목록 조회용, AI 호출 안 함)
export async function getCachedTranslations(storyIds: number[], to: Lang): Promise<Map<number, string>> {
    if (storyIds.length === 0) return new Map();
    const rows = await prisma.story_translation.findMany({ where: { story_id: { in: storyIds }, lang: to } });
    return new Map(rows.map((r) => [r.story_id, r.body]));
}
