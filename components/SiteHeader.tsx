"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LayoutGrid, Sparkles } from "lucide-react";
import { useLang, useT } from "./I18nProvider";
import LangSwitcher from "./LangSwitcher";
import NicknameChip from "./NicknameChip";
import { getOwnerToken, langPath, OWNER_EVENT } from "@/lib/client";
import { siteName, sisterUrl } from "@/lib/site";

function subscribeStorage(cb: () => void) {
    window.addEventListener("storage", cb);
    window.addEventListener(OWNER_EVENT, cb);
    return () => {
        window.removeEventListener("storage", cb);
        window.removeEventListener(OWNER_EVENT, cb);
    };
}

export default function SiteHeader() {
    const lang = useLang();
    const t = useT();
    const pathname = usePathname();
    // localStorage 의 owner 토큰. 서버에선 null, 클라이언트에선 렌더마다 다시 읽음 (글 쓴 직후 바로 뜨게)
    const owner = useSyncExternalStore(subscribeStorage, getOwnerToken, () => null);
    const onMe = pathname?.includes("/me/");

    return (
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 px-4 backdrop-blur-md" style={{ background: "linear-gradient(to bottom, rgba(14,20,48,0.92), rgba(14,20,48,0.6))" }}>
            <div className="flex shrink-0 items-center gap-2">
                <Link href={langPath(lang)} className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold tracking-tight text-ink">
                    <Sparkles size={16} className="text-star" />
                    {siteName(lang)}
                </Link>
                {/* binaryworld 로 가는 길 (누구나). 폰에선 아이콘만 */}
                <a href={sisterUrl("https://binaryworld.kr")} target="_blank" rel="noopener" title={t("bw_home")} aria-label={t("bw_home")} className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-line px-2 text-[11px] text-dim hover:text-ink">
                    <LayoutGrid size={12} />
                    <span className="hidden sm:inline">binaryworld</span>
                </a>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                {owner && !onMe && (
                    <Link href={langPath(lang, `/me/${owner}`)} className="shrink-0 whitespace-nowrap rounded-full border border-star/40 px-2.5 py-1 text-xs text-star-soft">
                        {t("nav_my")}
                    </Link>
                )}
                <NicknameChip />
                <LangSwitcher />
            </div>
        </header>
    );
}
