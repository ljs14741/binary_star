// Claude 연동. ANTHROPIC_API_KEY 없으면 전부 null 돌려주고 호출부는 기본 동작으로 감
import type Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "./i18n/config";

const MODEL = process.env.STAR_AI_MODEL || "claude-haiku-4-5-20251001";

let client: Anthropic | null | undefined;

export function aiEnabled(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}

async function getClient(): Promise<Anthropic | null> {
    if (!aiEnabled()) return null;
    if (client !== undefined) return client;
    const { default: AnthropicSdk } = await import("@anthropic-ai/sdk");
    client = new AnthropicSdk({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 15_000, maxRetries: 1 });
    return client;
}

function textOf(res: Anthropic.Message): string {
    return res.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("")
        .trim();
}

export type AiVerdict = "public" | "private" | "reject";

// 기본 필터 통과 글을 한 번 더 판정. 실패하면 null (호출부에서 공개 처리)
export async function aiModerate(body: string): Promise<{ verdict: AiVerdict; reason: string } | null> {
    const c = await getClient();
    if (!c) return null;
    try {
        const res = await c.messages.create({
            model: MODEL,
            max_tokens: 60,
            system:
                "You moderate anonymous personal stories on a kind, multilingual site (Korean, English, Japanese, Chinese). " +
                "Reply with exactly one line: PUBLIC, PRIVATE, or REJECT, then a space and a short reason. " +
                "REJECT = hate speech, harassment, sexual content involving minors, advertising/spam, doxxing a real person. " +
                "PRIVATE = the writer expresses intent of suicide or self-harm (keep it visible only to the writer). " +
                "PUBLIC = everything else, including sad, angry or profane-but-not-hateful personal writing.",
            messages: [{ role: "user", content: body.slice(0, 4000) }],
        });
        const line = textOf(res).toUpperCase();
        if (line.startsWith("REJECT")) return { verdict: "reject", reason: line.slice(0, 60) };
        if (line.startsWith("PRIVATE")) return { verdict: "private", reason: line.slice(0, 60) };
        return { verdict: "public", reason: line.slice(0, 60) };
    } catch (e) {
        console.warn("[ai] moderate 실패", e);
        return null;
    }
}

const LANG_NAME: Record<Lang, string> = { ko: "Korean", en: "English", ja: "Japanese", "zh-TW": "Traditional Chinese (Taiwan)" };

export async function aiTranslate(body: string, from: Lang, to: Lang): Promise<string | null> {
    const c = await getClient();
    if (!c) return null;
    try {
        const res = await c.messages.create({
            model: MODEL,
            max_tokens: 2500,
            system:
                `Translate the user's anonymous personal story from ${LANG_NAME[from]} to ${LANG_NAME[to]}. ` +
                "Keep the tone, line breaks and emotion. Output only the translation, nothing else.",
            messages: [{ role: "user", content: body }],
        });
        const out = textOf(res);
        return out || null;
    } catch (e) {
        console.warn("[ai] translate 실패", e);
        return null;
    }
}
