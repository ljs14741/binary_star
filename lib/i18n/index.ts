import { ko } from "@/messages/ko";
import { en } from "@/messages/en";
import { ja } from "@/messages/ja";
import { zhTW } from "@/messages/zh-TW";
import type { Lang } from "./config";

export type Dict = typeof ko;
export type DictKey = keyof Dict;

const DICTS: Record<Lang, Dict> = { ko, en, ja, "zh-TW": zhTW };

export function getDict(lang: Lang): Dict {
    return DICTS[lang] ?? ko;
}

// {name} 자리 채우기
export function fill(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export function t(lang: Lang, key: DictKey, params?: Record<string, string | number>): string {
    const d = getDict(lang);
    const v = d[key] ?? ko[key] ?? key;
    return fill(v as string, params);
}

export * from "./config";
