"use client";

import { motion } from "framer-motion";
import { useT } from "./I18nProvider";

// 언덕 위에 무릎을 안고 앉아 밤하늘을 올려다보는 작은 실루엣. 숨 쉬듯 아주 조금 움직임
export default function Stargazer({ caption = true }: { caption?: boolean }) {
    const t = useT();
    return (
        <div className="relative mx-auto mt-6 w-full max-w-[480px] select-none" aria-hidden>
            {caption && <p className="mb-1 text-center text-xs text-muted">{t("character_line")}</p>}
            <svg viewBox="0 0 480 150" className="block w-full" fill="none">
                <defs>
                    <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#111a3e" />
                        <stop offset="1" stopColor="#070b1d" />
                    </linearGradient>
                    <radialGradient id="moon" cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0" stopColor="#fff2c4" stopOpacity="0.9" />
                        <stop offset="0.55" stopColor="#ffe9a6" stopOpacity="0.25" />
                        <stop offset="1" stopColor="#ffe9a6" stopOpacity="0" />
                    </radialGradient>
                </defs>
                {/* 달빛 */}
                <circle cx="392" cy="34" r="30" fill="url(#moon)" />
                <circle cx="392" cy="34" r="7" fill="#fff4cf" />
                {/* 먼 언덕 */}
                <path d="M0 118 C 90 92, 150 100, 220 104 C 300 110, 360 86, 480 100 L480 150 L0 150 Z" fill="#0c1230" opacity="0.9" />
                {/* 앞 언덕 */}
                <path d="M0 132 C 80 110, 160 114, 240 122 C 320 130, 400 118, 480 126 L480 150 L0 150 Z" fill="url(#hill)" />
                {/* 사람: 무릎 안고 앉아 고개 든 실루엣 */}
                <motion.g
                    style={{ originX: "240px", originY: "122px" }}
                    animate={{ scaleY: [1, 1.015, 1], y: [0, -0.6, 0] }}
                    transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                >
                    {/* 몸통+다리 */}
                    <path d="M226 122 C 224 108, 230 98, 240 96 C 250 97, 254 104, 256 112 L 260 122 Z" fill="#05081a" />
                    {/* 무릎 */}
                    <path d="M246 106 C 254 102, 262 106, 262 114 L 258 122 L 248 122 Z" fill="#05081a" />
                    {/* 팔 (무릎 감싸기) */}
                    <path d="M236 108 C 242 112, 252 112, 258 110" stroke="#05081a" strokeWidth="4" strokeLinecap="round" />
                    {/* 머리: 살짝 뒤로 젖혀 하늘 보기 */}
                    <ellipse cx="236" cy="89" rx="7.2" ry="7.6" fill="#05081a" transform="rotate(-18 236 89)" />
                    <path d="M231 94 C 233 97, 238 98, 241 95" stroke="#05081a" strokeWidth="3" strokeLinecap="round" />
                </motion.g>
                {/* 풀 몇 가닥 */}
                <path d="M200 124 q 2 -8 4 0 M300 126 q 2 -7 4 0 M150 121 q 2 -6 4 0 M340 122 q 2 -7 4 0" stroke="#0a1030" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        </div>
    );
}
