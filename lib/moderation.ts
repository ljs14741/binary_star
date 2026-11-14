// 기본 검수 (키 없이 항상 동작). 금칙어·개인정보 가림·URL 금지·위험 낱말 감지
import { STORY_MAX_LEN } from "./site";

// 욕설·비하 금칙어. 띄어쓰기·기호 끼워 넣기 우회를 막으려고 공백 제거본에도 검사함
// 조정하려면 여기만 고치면 됨
const BANNED: RegExp[] = [
    // 한국어
    /시발|씨발|씨팔|시팔|씨바|ㅅㅂ|병신|븅신|개새끼|개새|좆|지랄|미친놈|미친년|창녀|걸레년|틀딱|한남충|김치녀|맘충|급식충|짱깨|쪽바리|깜둥이|똥꼬충|느금마|니애미|니미럴|엠창|장애새끼|씹/u,
    // 영어
    /\b(f+u+c+k+\w*|sh[i1]t|b[i1]tch(es)?|a+ss+hole|cunt|n[i1]gg(er|a)s?|fag(got)?s?|retard(ed|s)?|wh[o0]re|slut|motherf\w*|chink|gook|kike|spic|tranny)\b/i,
    // 일본어
    /死ね|殺すぞ|クソ野郎|きもい|キモい|ブス|デブ|ガイジ|チョン|土人|売女|ビッチ|カス野郎|低能|池沼/u,
    // 중국어(번체·간체)
    /幹你娘|干你娘|操你媽|操你妈|他媽的|他妈的|媽的|妈的|靠北|智障|腦殘|脑残|賤人|贱人|婊子|妓女|去死|死全家|傻逼|煞筆|畜生|廢物|废物|支那|黑鬼|尼哥/u,
];

// 죽음·자해 의도 낱말. 걸리면 공개 안 하고 본인에게만 + 상담 안내
// "돌아가셨다", "죽을 만큼" 같은 일상 표현은 안 걸리게 의도 표현 위주
const CRISIS: RegExp[] = [
    /자살|죽고\s*싶|죽을래|죽어\s*버리고\s*싶|죽어버릴|자해|손목을?\s*(긋|그어)|목숨을?\s*끊|세상을?\s*떠나고\s*싶|사라지고\s*싶|뛰어\s*내리|유서를?\s*쓰|살기\s*싫|살고\s*싶지\s*않/u,
    /\b(suicid\w*|kill(ing)?\s+myself|end(ing)?\s+my\s+life|want(ed)?\s+to\s+die|wanna\s+die|self[\s-]?harm\w*|cut(ting)?\s+myself|overdos\w*|don'?t\s+want\s+to\s+live|not\s+worth\s+living)\b/i,
    /自殺|死にたい|消えたい|自傷|リストカット|リスカ|飛び降り|遺書|首を吊|生きたくない|生きるのが(つらい|辛い)/u,
    /自殺|自杀|想死|不想活|自殘|自残|割腕|跳樓|跳楼|遺書|遗书|結束生命|结束生命|想消失/u,
];

const URL_RE = /https?:\/\/|www\.|\b[\w-]+\.(com|net|org|kr|co|io|me|jp|tw|cn|ly|gg|app|info|xyz|shop)\b/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 숫자 덩어리 후보(전화·주민번호·계좌). 숫자 9~15개면 가림
const NUMBER_BLOCK_RE = /\+?[\d][\d()\-\s.]{7,24}\d/g;
// 카톡·인스타 아이디 유도 ("카톡 abc123", "insta: @xxx")
const HANDLE_RE = /(카톡|카카오톡|카카오|kakao|insta|instagram|인스타|line|라인|telegram|텔레그램|디엠|dm)\s*(아이디|id|:)?\s*[:：]?\s*@?[A-Za-z0-9._]{4,}/gi;

export type ModerationResult = {
    ok: boolean;
    reason?: "empty" | "too_long" | "url" | "banned";
    body: string;
    masked: boolean;
    crisis: boolean;
};

function normalizeForBanned(text: string): string {
    // 공백·기호 제거본 (ㅅ ㅂ, 시.발 같은 우회)
    return text.replace(/[\s.\-_*,!?~`'"·]/gu, "");
}

export function hasBannedWord(text: string): boolean {
    const n = normalizeForBanned(text);
    return BANNED.some((re) => re.test(text) || re.test(n));
}

export function hasCrisisWord(text: string): boolean {
    const n = text.replace(/\s+/g, " ");
    return CRISIS.some((re) => re.test(n));
}

export function hasUrl(text: string): boolean {
    return URL_RE.test(text);
}

export function maskPii(text: string): { body: string; masked: boolean } {
    let masked = false;
    let out = text.replace(EMAIL_RE, () => {
        masked = true;
        return "***@***";
    });
    out = out.replace(NUMBER_BLOCK_RE, (m) => {
        const digits = m.replace(/\D/g, "").length;
        if (digits < 9 || digits > 15) return m;
        masked = true;
        return "***-****-****";
    });
    out = out.replace(HANDLE_RE, (m, platform) => {
        masked = true;
        return `${platform} ***`;
    });
    return { body: out, masked };
}

export function moderate(raw: string, maxLen = STORY_MAX_LEN): ModerationResult {
    const body = raw.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
    if (!body) return { ok: false, reason: "empty", body, masked: false, crisis: false };
    if (body.length > maxLen) return { ok: false, reason: "too_long", body, masked: false, crisis: false };
    // 이메일·전화 같은 개인정보는 먼저 가리고, 그 다음에 링크 검사 (이메일 도메인이 링크로 잡히지 않게)
    const { body: cleaned, masked } = maskPii(body);
    if (hasUrl(cleaned)) return { ok: false, reason: "url", body, masked: false, crisis: false };
    if (hasBannedWord(cleaned)) return { ok: false, reason: "banned", body, masked: false, crisis: false };
    return { ok: true, body: cleaned, masked, crisis: hasCrisisWord(cleaned) };
}
