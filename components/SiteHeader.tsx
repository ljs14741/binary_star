"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import { useLang, useT } from "./I18nProvider";
import LangSwitcher from "./LangSwitcher";
import NicknameChip from "./NicknameChip";
import { getOwnerToken, langPath, OWNER_EVENT } from "@/lib/client";
import { siteName } from "@/lib/site";

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
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between px-4 backdrop-blur-md" style={{ background: "linear-gradient(to bottom, rgba(14,20,48,0.92), rgba(14,20,48,0.6))" }}>
            <Link href={langPath(lang)} className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-ink">
                <Sparkles size={16} className="text-star" />
                {siteName(lang)}
            </Link>
            <div className="flex items-center gap-2">
                {owner && !onMe && (
                    <Link href={langPath(lang, `/me/${owner}`)} className="rounded-full border border-star/40 px-2.5 py-1 text-xs text-star-soft">
                        {t("nav_my")}
                    </Link>
                )}
                <NicknameChip />
                <LangSwitcher />
            </div>
        </header>
    );
}
