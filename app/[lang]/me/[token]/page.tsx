import type { Metadata } from "next";
import { requireLang } from "@/lib/page";
import { t } from "@/lib/i18n";
import MyPage from "@/components/MyPage";
import Stargazer from "@/components/Stargazer";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ lang: string; token: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
    const lang = await requireLang(params);
    return { title: t(lang, "me_title"), robots: { index: false, follow: false } };
}

export default async function MePage({ params }: P) {
    await requireLang(params);
    const { token } = await params;
    return (
        <>
            <MyPage token={token} />
            <Stargazer caption={false} />
        </>
    );
}
