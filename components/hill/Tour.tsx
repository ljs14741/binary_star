"use client";
// 기능 안내: 실제 버튼을 차례로 밝혀 가리키고 옆에 말풍선. 대상은 data-tour="이름" 이 붙은 요소
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export type TourStep = { target: string; text: string };
type Rect = { x: number; y: number; w: number; h: number };

const PAD = 6; // 밝힌 동그라미 여백
const BUBBLE_W = 272;

function measure(target: string): Rect | null {
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

type Props = {
    steps: TourStep[];
    labels: { next: string; done: string; skip: string };
    onDone: () => void;
};

export default function Tour({ steps, labels, onDone }: Props) {
    const [step, setStep] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [vw, setVw] = useState(0);
    const [vh, setVh] = useState(0);
    const cur = steps[step];

    // 버튼이 움직이거나(애니메이션·화면 회전) 늦게 나타나도 따라가게 짧게 다시 잼. 대상이 없으면 그 장은 건너뜀
    useEffect(() => {
        if (!cur) return;
        let misses = 0;
        const tick = () => {
            const r = measure(cur.target);
            setVw(window.innerWidth);
            setVh(window.innerHeight);
            if (r) {
                misses = 0;
                setRect((p) => (p && Math.abs(p.x - r.x) < 0.5 && Math.abs(p.y - r.y) < 0.5 && p.w === r.w && p.h === r.h ? p : r));
            } else if (++misses > 4) {
                setStep((s) => s + 1);
            }
        };
        const raf = requestAnimationFrame(tick);
        const iv = setInterval(tick, 250);
        return () => {
            cancelAnimationFrame(raf);
            clearInterval(iv);
        };
    }, [cur]);

    useEffect(() => {
        if (step >= steps.length) onDone();
    }, [step, steps.length, onDone]);

    if (!cur || typeof document === "undefined") return null;
    const last = step === steps.length - 1;
    const next = () => setStep((s) => s + 1);

    // 말풍선: 대상이 화면 위쪽이면 아래에, 아래쪽이면 위에
    const below = rect ? rect.y + rect.h / 2 < vh * 0.55 : true;
    const cx = rect ? rect.x + rect.w / 2 : vw / 2;
    const left = Math.min(Math.max(12, cx - BUBBLE_W / 2), Math.max(12, vw - BUBBLE_W - 12));
    const arrowLeft = Math.min(Math.max(18, cx - left), BUBBLE_W - 18);
    const bubbleStyle: React.CSSProperties = below ? { left, top: (rect ? rect.y + rect.h : vh / 2) + 14 } : { left, bottom: vh - (rect ? rect.y : vh / 2) + 14 };

    return createPortal(
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" onClick={next}>
            {/* 밝힌 자리 바깥은 어둡게 (큰 그림자로) */}
            {rect && (
                <motion.div
                    className="pointer-events-none fixed rounded-full"
                    initial={false}
                    animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                    style={{ boxShadow: "0 0 0 9999px rgba(4,7,22,0.74), 0 0 0 2px rgba(255,216,107,0.95), 0 0 18px 4px rgba(255,216,107,0.45)" }}
                />
            )}
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, y: below ? -6 : 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed rounded-2xl border border-star/40 bg-night px-4 py-3 shadow-glow"
                    style={{ ...bubbleStyle, width: BUBBLE_W }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 꼬리 */}
                    <span
                        className={`absolute h-3 w-3 rotate-45 border-star/40 bg-night ${below ? "-top-1.5 border-l border-t" : "-bottom-1.5 border-b border-r"}`}
                        style={{ left: arrowLeft - 6 }}
                    />
                    <p className="whitespace-pre-line break-keep text-[15px] font-medium leading-relaxed text-ink">{cur.text}</p>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="flex gap-1">
                            {steps.map((_, i) => (
                                <span key={i} className={`h-1.5 rounded-full ${i === step ? "w-4 bg-star" : "w-1.5 bg-white/30"}`} />
                            ))}
                        </span>
                        {!last && (
                            <button onClick={onDone} className="ml-auto text-xs text-dim">
                                {labels.skip}
                            </button>
                        )}
                        <button onClick={next} className={`btn-star rounded-full px-4 py-1.5 text-[13px] font-semibold ${last ? "ml-auto" : ""}`}>
                            {last ? labels.done : labels.next}
                        </button>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>,
        document.body,
    );
}
