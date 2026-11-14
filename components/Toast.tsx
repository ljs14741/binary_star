"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ToastCtx = { toast: (msg: string) => void };
const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [msg, setMsg] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const toast = useCallback((m: string) => {
        setMsg(m);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setMsg(null), 2400);
    }, []);
    return (
        <Ctx.Provider value={{ toast }}>
            {children}
            <AnimatePresence>
                {msg && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="pointer-events-none fixed inset-x-0 bottom-8 z-[60] flex justify-center px-4"
                    >
                        <div className="glass rounded-full px-4 py-2 text-sm text-ink shadow-glow">{msg}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Ctx.Provider>
    );
}

export function useToast() {
    return useContext(Ctx).toast;
}
