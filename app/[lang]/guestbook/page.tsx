import type { Metadata } from "next";
import { requireLang, alternates } from "@/lib/page";
import { t } from "@/lib/i18n";
import { listGuestbook } from "@/lib/guestbook";
import { getVoterKey } from "@/lib/voter";
import GuestbookBoard from "@/components/GuestbookBoard";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    return { title: t(lang, "guestbook_title"), description: t(lang, "guestbook_sub"), alternates: alternates("/guestbook", lang) };
}

export default async function GuestbookPage({ params }: P) {
    const lang = await requireLang(params);
    const { items, more } = await listGuestbook({ voterKey: await getVoterKey() });
    return (
        <div className="px-4 pb-8 pt-3">
            <h1 className="text-xl font-semibold text-ink">{t(lang, "guestbook_title")}</h1>
            <p className="mb-4 text-sm text-muted">{t(lang, "guestbook_sub")}</p>
            <GuestbookBoard initial={items} initialMore={more} />
        </div>
    );
}
