import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { LANGS } from "@/lib/i18n/config";
import { getBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

function withAlternates(path: string, lastModified?: Date): MetadataRoute.Sitemap {
    const base = getBaseUrl();
    const languages: Record<string, string> = {};
    for (const l of LANGS) languages[l === "zh-TW" ? "zh-Hant" : l] = `${base}/${l}${path}`;
    return LANGS.map((l) => ({ url: `${base}/${l}${path}`, lastModified, alternates: { languages } }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [rooms, stories] = await Promise.all([
        prisma.room.findMany({ where: { status: "open" }, select: { slug: true, created_at: true } }),
        prisma.story.findMany({ where: { status: "public" }, select: { id: true, published_at: true }, orderBy: { published_at: "desc" }, take: 5000 }),
    ]);
    const out: MetadataRoute.Sitemap = [...withAlternates(""), ...withAlternates("/featured"), ...withAlternates("/propose"), ...withAlternates("/guestbook"), ...withAlternates("/about"), ...withAlternates("/privacy"), ...withAlternates("/terms")];
    for (const r of rooms) out.push(...withAlternates(`/room/${r.slug}`, r.created_at), ...withAlternates(`/room/${r.slug}/top`, r.created_at));
    for (const s of stories) out.push(...withAlternates(`/s/${s.id}`, s.published_at ?? undefined));
    return out;
}
