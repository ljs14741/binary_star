"use client";

import { useState } from "react";
import Script from "next/script";
import { Copy, Share2, MessageCircle, Instagram, ImageDown } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useLang, useT } from "./I18nProvider";
import { useToast } from "./Toast";
import { useDialog } from "./Dialog";
import { siteOrigin } from "@/lib/client";
import { formatNumber } from "@/lib/format";

declare global {
    interface Window {
        Kakao?: {
            isInitialized: () => boolean;
            init: (k: string) => void;
            Share: { sendDefault: (o: unknown) => void };
        };
    }
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || "";

export type ShareTarget = { url: string; title: string; text: string; imageUrl?: string; storyImageUrl?: string; description?: string };

export function storyShareTarget(opts: { lang: string; id: number; roomTitle: string; count: number; countries: number; t: (k: never, p?: Record<string, string | number>) => string; excerpt: string }): ShareTarget {
    const tt = opts.t as unknown as (k: string, p?: Record<string, string | number>) => string;
    const origin = siteOrigin();
    const url = `${origin}/${opts.lang}/s/${opts.id}`;
    const text = opts.count > 0 ? tt("share_message", { room: opts.roomTitle, n: formatNumber(opts.count, opts.lang as "ko") }) : tt("share_message_zero", { room: opts.roomTitle });
    return {
        url,
        title: tt("share_title"),
        text,
        imageUrl: `${origin}/${opts.lang}/s/${opts.id}/opengraph-image`,
        storyImageUrl: `${origin}/${opts.lang}/s/${opts.id}/story-image`,
        description: `${tt("og_empathy", { n: opts.count })} · ${tt("og_countries", { n: opts.countries })}`,
    };
}

function Btn({ onClick, children, label, className = "glass text-ink" }: { onClick: () => void; children: React.ReactNode; label: string; className?: string }) {
    return (
        <button onClick={onClick} className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[11px] font-semibold ${className}`}>
            {children}
            {label}
        </button>
    );
}

// 공유창: 카카오톡 · 인스타(세로 이미지) · X · LINE · 스레드 · 링크 복사 · 기기 공유창(폰에서 메시지·인스타 DM 등)
export default function ShareSheet({ open, onClose, target }: { open: boolean; onClose: () => void; target: ShareTarget }) {
    const t = useT();
    const lang = useLang();
    const toast = useToast();
    const { showCopy } = useDialog();
    const [kakaoReady, setKakaoReady] = useState(false);
    const [igBusy, setIgBusy] = useState(false);
    const canNative = typeof navigator !== "undefined" && !!navigator.share;

    const copy = async (silentClose = true) => {
        try {
            await navigator.clipboard.writeText(`${target.text}\n${target.url}`);
            toast(t("copied"));
        } catch {
            showCopy({ title: t("share_copy"), value: target.url });
        }
        if (silentClose) onClose();
    };

    const native = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: target.title, text: target.text, url: target.url });
                onClose();
                return;
            } catch {
                /* 취소 */
            }
        } else copy();
    };

    // 인스타: 세로 이미지를 폰이면 공유창으로(인스타 스토리 선택 가능), PC 면 내려받기 + 링크 복사
    const instagram = async () => {
        if (!target.storyImageUrl || igBusy) return;
        setIgBusy(true);
        try {
            const res = await fetch(target.storyImageUrl);
            const blob = await res.blob();
            const file = new File([blob], "star-story.png", { type: "image/png" });
            try {
                await navigator.clipboard.writeText(target.url);
            } catch {}
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: target.title, text: `${target.text}\n${target.url}` });
                toast(t("share_ig_done"));
            } else {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "star-story.png";
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 5000);
                toast(t("share_ig_saved"));
            }
            onClose();
        } catch {
            toast(t("error_generic"));
        } finally {
            setIgBusy(false);
        }
    };

    const openWin = (u: string) => {
        window.open(u, "_blank", "noopener,noreferrer,width=600,height=640");
        onClose();
    };
    const x = () => openWin(`https://twitter.com/intent/tweet?text=${encodeURIComponent(target.text)}&url=${encodeURIComponent(target.url)}`);
    const line = () => openWin(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(target.url)}&text=${encodeURIComponent(target.text)}`);
    const threads = () => openWin(`https://www.threads.net/intent/post?text=${encodeURIComponent(`${target.text}\n${target.url}`)}`);

    const kakao = () => {
        try {
            if (!window.Kakao) throw new Error("no sdk");
            if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_KEY);
            window.Kakao.Share.sendDefault({
                objectType: "feed",
                content: {
                    title: `${target.title} · ${target.text}`.slice(0, 100),
                    description: target.description ?? "",
                    imageUrl: target.imageUrl ?? "",
                    link: { mobileWebUrl: target.url, webUrl: target.url },
                },
                buttons: [{ title: t("story_empathy"), link: { mobileWebUrl: target.url, webUrl: target.url } }],
            });
            onClose();
        } catch (e) {
            console.warn("[kakao] 공유 실패 (localhost 도메인 미등록이면 정상)", e);
            copy();
        }
    };

    return (
        <>
            {KAKAO_KEY && open && (
                <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" strategy="afterInteractive" onLoad={() => setKakaoReady(true)} onReady={() => setKakaoReady(true)} />
            )}
            <BottomSheet open={open} onClose={onClose} title={t("share")}>
                <p className="mb-4 rounded-2xl bg-card p-3 text-sm leading-relaxed text-muted">
                    {target.text}
                    <br />
                    <span className="break-all text-xs text-dim">{target.url}</span>
                </p>
                <div className="grid grid-cols-4 gap-2">
                    {KAKAO_KEY && (lang === "ko" || kakaoReady) && (
                        <Btn onClick={kakao} label={t("share_kakao")} className="bg-[#FEE500] text-[#191919]">
                            <MessageCircle size={20} />
                        </Btn>
                    )}
                    {target.storyImageUrl && (
                        <Btn onClick={instagram} label={igBusy ? "…" : t("share_instagram")} className="bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
                            <Instagram size={20} />
                        </Btn>
                    )}
                    <Btn onClick={x} label="X">
                        <span className="text-lg font-black leading-5">𝕏</span>
                    </Btn>
                    {(lang === "ja" || lang === "zh-TW") && (
                        <Btn onClick={line} label="LINE" className="bg-[#06C755] text-white">
                            <MessageCircle size={20} />
                        </Btn>
                    )}
                    <Btn onClick={threads} label="Threads">
                        <span className="text-lg font-black leading-5">@</span>
                    </Btn>
                    <Btn onClick={() => copy()} label={t("share_copy")}>
                        <Copy size={20} />
                    </Btn>
                    {canNative && (
                        <Btn onClick={native} label={t("share_native")}>
                            <Share2 size={20} />
                        </Btn>
                    )}
                </div>
                {target.storyImageUrl && (
                    <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-dim">
                        <ImageDown size={13} className="mt-0.5 shrink-0" /> {t("share_ig_hint")}
                    </p>
                )}
            </BottomSheet>
        </>
    );
}
