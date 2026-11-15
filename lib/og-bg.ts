// 공유 이미지 배경: 실제 언덕 장면(public/og/hill.jpg)을 data URL 로. 한 번 읽어 둠
import fs from "fs";
import path from "path";

let cache: string | null | undefined;
export function hillBackground(): string | null {
    if (cache !== undefined) return cache;
    try {
        const buf = fs.readFileSync(path.join(process.cwd(), "public", "og", "hill.jpg"));
        cache = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {
        cache = null;
    }
    return cache;
}
