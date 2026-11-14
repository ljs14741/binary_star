"use client";

import BottomSheet from "./BottomSheet";
import { useT } from "./I18nProvider";
import { useToast } from "./Toast";
import { api } from "@/lib/client";

const REASONS = ["spam", "abuse", "pii", "other"] as const;

export default function ReportSheet({ storyId, open, onClose, onHidden }: { storyId: number; open: boolean; onClose: () => void; onHidden?: () => void }) {
    const t = useT();
    const toast = useToast();
    const send = async (reason: string) => {
        const r = await api<{ hidden: boolean }>(`/api/stories/${storyId}/report`, { method: "POST", json: { reason } });
        if (r.ok) {
            toast(t("report_done"));
            if (r.hidden) onHidden?.();
        } else toast(r.error === "dup" ? t("report_dup") : t("error_generic"));
        onClose();
    };
    return (
        <BottomSheet open={open} onClose={onClose} title={t("report_title")}>
            <div className="grid gap-2">
                {REASONS.map((r) => (
                    <button key={r} onClick={() => send(r)} className="glass rounded-2xl py-3 text-sm text-ink hover:bg-card-strong">
                        {t(`report_${r}` as "report_spam")}
                    </button>
                ))}
            </div>
        </BottomSheet>
    );
}
