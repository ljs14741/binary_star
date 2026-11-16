// 기본 검수 (키 없이 항상 동작). 금칙어·개인정보 가림·URL 금지·위험 낱말 감지
import { STORY_MAX_LEN } from "./site";

// 욕설·비하 금칙어. 띄어쓰기·기호 끼워 넣기 우회를 막으려고 공백 제거본에도 검사함
// 조정하려면 여기만 고치면 됨
const BANNED: RegExp[] = [
    // 한국어
    // 시발점·시발역, 씹다·곱씹다, 씨바스 같은 평범한 말은 안 걸리게 뒤를 봄
    /시발(?!점|역|택시|자동차)|씨발|씨팔|시팔|씨바(?!스)|ㅅㅂ|병신|븅신|개새(끼|기|키|퀴)|개색(기|히|끼)|개쉐|좆|지랄|미친놈|미친년|창녀|걸레년|틀딱|한남충|김치녀|맘충|급식충|짱깨|쪽바리|깜둥이|똥꼬충|느금마|니애미|니미럴|엠창|장애새끼|씹(새|쌔|할|년|놈|창|탱|썅|팔|브랄|버러지)/u,
    // 영어
    /\b(f+u+c+k+\w*|sh[i1]t|b[i1]tch(es)?|a+ss+hole|cunt|n[i1]gg(er|a)s?|fag(got)?s?|retard(ed|s)?|wh[o0]re|slut|motherf\w*|chink|gook|kike|spic|tranny)\b/i,
    // 일본어
    /死ね|殺すぞ|クソ野郎|きもい|キモい|ブス(?![ァ-ヶー])|デブ(?![ァ-ヶー])|ガイジ|チョン(?![ァ-ヶー])|土人|売女|ビッチ|カス野郎|低能|池沼/u,
    // 중국어(번체·간체)
    /幹你娘|干你娘|操你媽|操你妈|他媽的|他妈的|媽的|妈的|靠北|智障|腦殘|脑残|賤人|贱人|婊子|妓女|去死|死全家|傻逼|煞筆|畜生(?!道)|廢物(?!利用)|废物(?!利用)|支那(?!そば|竹)|黑鬼|尼哥/u,
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
// 영문 이름은 낱말 안쪽(online·deadline·instantly·admin)에서 안 잡히게 앞뒤가 영문자가 아닐 때만 (뒤에 id 는 허용)
const HANDLE_RE = /(카톡|카카오톡|카카오|(?<![A-Za-z])(?:kakao|instagram|insta|line|telegram|dm)(?:(?![A-Za-z])|(?=id))|인스타|라인|텔레그램|디엠)\s*(아이디|id|:)?\s*[:：]?\s*@?[A-Za-z0-9._]{4,}/gi;

export type ModerationResult = {
    ok: boolean;
    reason?: "empty" | "too_long" | "url" | "banned";
    body: string;
    masked: boolean;
    crisis: boolean;
};

// 도박·성매매 광고 낱말. 평범한 이야기에도 나오는 말(토토, 대출, 카지노, 먹튀, 오피스텔)은 홀로는 안 막고 광고에만 쓰는 꼴만
const SPAM: RegExp[] = [
    /온라인카지노|카지노사이트|바카라|먹튀검증|먹튀사이트|토토사이트|사설토토|슬롯사이트|홀덤사이트|파워볼사이트|조건만남|출장안마|출장마사지|출장샵|오피걸|립카페|성인방송|작업대출|소액결제현금화|상품권현금화|텔레그램문의|텔레문의/u,
    /onlinecasino|casinosite|bettingsite|escortservice/i,
    /オンラインカジノ|カジノサイト/u,
    /線上娛樂城|线上娱乐城|娛樂城|娱乐城|博彩|百家樂|百家乐|外送茶|包養網|包养网/u,
];

function normalizeForBanned(text: string): string {
    // 기호 제거 (시.발, 시*발 같은 우회)
    let n = text.replace(/[.\-_*,!?~`'"·]/gu, "");
    // 한 글자씩 띄운 것만 붙임 (ㅅ ㅂ, 시 발). "필요 시 발급", "개 새로" 같은 평범한 띄어쓰기는 안 붙임
    n = n.replace(/(?<=(?:^|\s)\S)\s+(?=\S(?:\s|$))/gu, "");
    return n;
}

// 한글 사이에 낀 숫자·영문 1~2글자 제거 (씨1발, 병a신). 2024년·10대 같은 숫자는 한글 사이가 아니라 그대로
function stripInfix(n: string): string {
    return n.replace(/(?<=[가-힣ㄱ-ㅎ])[0-9A-Za-z]{1,2}(?=[가-힣ㄱ-ㅎ])/g, "");
}

export function hasBannedWord(text: string): boolean {
    const n = normalizeForBanned(text);
    const forms = [text, n, stripInfix(n)];
    if (BANNED.some((re) => forms.some((f) => re.test(f)))) return true;
    // 광고 낱말은 길어서 띄어쓰기를 다 빼고 봐도 평범한 글이 안 걸림 (토토 사이트 → 토토사이트)
    const flat = n.replace(/\s+/g, "");
    return SPAM.some((re) => re.test(flat) || re.test(stripInfix(flat)));
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
