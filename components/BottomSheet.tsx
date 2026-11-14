"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

export default function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div className="fixed inset-0 z-50 bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
                    <motion.div
                        role="dialog"
                        aria-modal
                        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] rounded-t-3xl border-t border-line bg-night px-5 pb-8 pt-4 shadow-2xl"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 380, damping: 36 }}
                    >
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-ink">{title}</h3>
                            <button onClick={onClose} aria-label="close" className="rounded-full p-1 text-muted hover:text-ink">
                                <X size={18} />
                            </button>
                        </div>
                        {children}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
