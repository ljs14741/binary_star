// OG 이미지용 글꼴. data/fonts 에 있으면 읽고, 없으면 Google Fonts 에서 TTF 를 받아 메모리에 둠
import fs from "fs";
import path from "path";

type FontDef = { name: string; file: string; family: string };
const FONTS: FontDef[] = [
    { name: "Noto Sans KR", file: "NotoSansKR-Bold.ttf", family: "Noto+Sans+KR" },
    { name: "Noto Sans JP", file: "NotoSansJP-Bold.ttf", family: "Noto+Sans+JP" },
    { name: "Noto Sans TC", file: "NotoSansTC-Bold.ttf", family: "Noto+Sans+TC" },
];

type OgFont = { name: string; data: ArrayBuffer; weight: 700; style: "normal" };
let cache: OgFont[] | null = null;

async function fetchTtf(family: string): Promise<ArrayBuffer | null> {
    try {
        const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@700&display=swap`, { headers: { "User-Agent": "Mozilla/4.0" } }).then((r) => r.text());
        const m = css.match(/https:\/\/[^)]+\.ttf/);
        if (!m) return null;
        return await fetch(m[0]).then((r) => r.arrayBuffer());
    } catch {
        return null;
    }
}

export async function loadOgFonts(primary: "ko" | "en" | "ja" | "zh-TW") {
    if (!cache) {
        const loaded: OgFont[] = [];
        for (const f of FONTS) {
            const p = path.join(process.cwd(), "data/fonts", f.file);
            let data: ArrayBuffer | null = null;
            if (fs.existsSync(p)) {
                const b = fs.readFileSync(p);
                data = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
            } else data = await fetchTtf(f.family);
            if (data) loaded.push({ name: f.name, data, weight: 700, style: "normal" });
        }
        cache = loaded;
    }
    // 읽는 사람 언어 글꼴을 맨 앞에 (한자는 KR/JP/TC 모양이 달라서 우선순위 중요)
    const first = primary === "ja" ? "Noto Sans JP" : primary === "zh-TW" ? "Noto Sans TC" : "Noto Sans KR";
    return [...cache].sort((a, b) => (a.name === first ? -1 : b.name === first ? 1 : 0));
}
