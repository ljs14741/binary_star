"use client";

import { HeartHandshake } from "lucide-react";
import { useLang, useT } from "./I18nProvider";

// 위험 낱말 감지 시 본인에게만 보이는 상담 안내
export default function CrisisNotice() {
    const t = useT();
    const lang = useLang();
    const order = lang === "ja" ? ["crisis_jp", "crisis_kr", "crisis_tw", "crisis_us"] : lang === "zh-TW" ? ["crisis_tw", "crisis_kr", "crisis_jp", "crisis_us"] : lang === "en" ? ["crisis_us", "crisis_kr", "crisis_jp", "crisis_tw"] : ["crisis_kr", "crisis_jp", "crisis_tw", "crisis_us"];
    return (
        <div className="rounded-2xl border border-rose/40 bg-rose/10 p-4 text-sm leading-relaxed text-ink">
            <div className="mb-1 flex items-center gap-2 font-semibold text-rose">
                <HeartHandshake size={18} /> {t("crisis_title")}
            </div>
            <p className="text-muted">{t("crisis_body")}</p>
            <ul className="mt-2 grid gap-1 text-[13px]">
                {order.map((k, i) => (
                    <li key={k} className={i === 0 ? "font-semibold text-ink" : ""}>
                        {t(k as "crisis_kr")}
                    </li>
                ))}
            </ul>
        </div>
    );
}
