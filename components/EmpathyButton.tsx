"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { api } from "@/lib/client";
import { useT, useLang } from "./I18nProvider";
import { useToast } from "./Toast";
import { formatNumber } from "@/lib/format";

type Props = { storyId: number; count: number; empathized: boolean; mine: boolean; size?: "lg" | "sm"; onChange?: (next: { count: number; empathized: boolean }) => void };

export default function EmpathyButton({ storyId, count, empathized, mine, size = "lg", onChange }: Props) {
    const t = useT();
    const lang = useLang();
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const [burst, setBurst] = useState(0);

    const toggle = async () => {
        if (busy) return;
        if (mine) {
            toast(t("empathy_own"));
            return;
        }
        setBusy(true);
        const optimistic = { count: count + (empathized ? -1 : 1), empathized: !empathized };
        onChange?.(optimistic);
        if (!empathized) {
            setBurst((b) => b + 1);
            try {
                navigator.vibrate?.(14);
            } catch {}
        }
        const r = await api<{ count: number; empathized: boolean }>(`/api/stories/${storyId}/empathy`, { method: "POST" });
        if (r.ok) onChange?.({ count: r.count, empathized: r.empathized });
        else {
            onChange?.({ count, empathized });
            toast(r.error === "own" ? t("empathy_own") : t("error_generic"));
        }
        setBusy(false);
    };

    const lg = size === "lg";
    return (
        <button
            onClick={toggle}
            aria-pressed={empathized}
            className={`relative flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition ${
                lg ? "h-12 min-w-fit flex-1 px-3.5 text-[15px]" : "h-9 px-3 text-sm"
            } ${empathized ? "btn-star" : "glass text-ink hover:bg-card-strong"} ${mine ? "opacity-60" : ""}`}
        >
            <span className="relative">
                <Heart size={lg ? 20 : 16} className={empathized ? "fill-current" : ""} />
                <AnimatePresence>
                    {burst > 0 && (
                        <motion.span
                            key={burst}
                            className="pointer-events-none absolute -inset-3 rounded-full border-2 border-star"
                            initial={{ opacity: 0.9, scale: 0.4 }}
                            animate={{ opacity: 0, scale: 2 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6 }}
                        />
                    )}
                </AnimatePresence>
            </span>
            <span>{empathized ? t("story_empathized") : t("story_empathy")}</span>
            <span className={`relative inline-flex h-[1.2em] min-w-[1.2em] items-center justify-center overflow-hidden leading-none tabular-nums ${empathized ? "" : "text-muted"}`}>
                <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                        key={count}
                        className="inline-block"
                        initial={{ y: empathized ? 14 : -14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: empathized ? -14 : 14, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                    >
                        {formatNumber(count, lang)}
                    </motion.span>
                </AnimatePresence>
            </span>
        </button>
    );
}
