// 주제 방 12개(별자리 12개, 이번 달 주제 포함) + 테스트 이야기(is_seed, 화면에 "테스트" 표시). 여러 번 돌려도 방은 중복 안 됨
import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { hashOwnerToken, newOwnerToken } from "../lib/crypto";

type RoomSeed = { slug: string; sort: number; featuredUntil?: string; i18n: Record<"ko" | "en" | "ja" | "zh-TW", [string, string]> };

const ROOMS: RoomSeed[] = [
    {
        slug: "to-my-twenties", sort: 1,
        i18n: {
            ko: ["스무 살의 나에게", "그때의 나에게 지금 해 주고 싶은 말"],
            en: ["To my 20-year-old self", "What I'd tell myself back then"],
            ja: ["二十歳の自分へ", "あの頃の自分に今伝えたいこと"],
            "zh-TW": ["給二十歲的自己", "現在想對那時的自己說的話"],
        },
    },
    {
        slug: "first-love", sort: 2,
        i18n: {
            ko: ["첫사랑에게", "끝내 보내지 못한 말"],
            en: ["To my first love", "The words I never sent"],
            ja: ["初恋の人へ", "結局送れなかった言葉"],
            "zh-TW": ["給初戀", "最後沒能送出的那些話"],
        },
    },
    {
        slug: "to-my-ex", sort: 3,
        i18n: {
            ko: ["헤어진 그 사람에게", "지금은 말할 수 있는 것"],
            en: ["To the one I let go", "What I can say now"],
            ja: ["別れたあの人へ", "今なら言えること"],
            "zh-TW": ["給分手的那個人", "現在終於能說出口的話"],
        },
    },
    {
        slug: "to-mom-and-dad", sort: 4,
        i18n: {
            ko: ["엄마·아빠에게", "얼굴 보고는 못 하는 말"],
            en: ["To Mom and Dad", "What I can't say to their face"],
            ja: ["お母さん・お父さんへ", "面と向かっては言えないこと"],
            "zh-TW": ["給爸媽", "當面說不出口的話"],
        },
    },
    {
        slug: "to-me-who-endured", sort: 5,
        i18n: {
            ko: ["그 시절을 버텨낸 나에게", "잘 버텼다고, 한마디"],
            en: ["To the me who made it through", "You held on. One line for that"],
            ja: ["あの頃を耐え抜いた自分へ", "よく耐えたね、と一言"],
            "zh-TW": ["給撐過那段日子的自己", "對自己說一句：你撐過來了"],
        },
    },
    {
        slug: "to-me-in-ten-years", sort: 6,
        i18n: {
            ko: ["10년 뒤의 나에게", "그때 꼭 읽어 보기"],
            en: ["To me in ten years", "Read this when you get there"],
            ja: ["10年後の自分へ", "その時に必ず読み返して"],
            "zh-TW": ["給十年後的自己", "到時候一定要回來讀"],
        },
    },
    // 2026-11-15 추가 주제 4개 (12번째 자리는 사용자 제안 몫으로 비워 둠)
    {
        slug: "to-someone-in-heaven", sort: 7,
        i18n: {
            ko: ["먼저 떠난 너에게", "하늘나라로, 무지개다리 너머로 먼저 간 사람과 아이에게"],
            en: ["To you who left first", "To the people and pets who went ahead of me"],
            ja: ["先に旅立ったきみへ", "天国へ、虹の橋の向こうへ先に行った人とあの子へ"],
            "zh-TW": ["給先走一步的你", "給先去了天上、走過彩虹橋的人和毛孩子"],
        },
    },
    {
        slug: "to-a-friend-i-lost-touch-with", sort: 8,
        i18n: {
            ko: ["멀어진 친구에게", "연락은 끊겼지만 가끔 생각나는 너에게"],
            en: ["To the friend I drifted from", "We lost touch, but I still think of you"],
            ja: ["疎遠になった友へ", "連絡は途切れたけど、時々思い出すきみへ"],
            "zh-TW": ["給漸行漸遠的朋友", "雖然斷了聯絡，還是會想起你"],
        },
    },
    {
        slug: "to-my-child", sort: 9,
        i18n: {
            ko: ["내 아이에게", "언젠가 커서 읽어 줬으면 하는 말"],
            en: ["To my child", "Words I hope you'll read when you're grown"],
            ja: ["わが子へ", "いつか大きくなったら読んでほしいこと"],
            "zh-TW": ["給我的孩子", "希望你長大後有一天會讀到的話"],
        },
    },
    {
        slug: "to-you-beside-me", sort: 10,
        i18n: {
            ko: ["곁에 있는 당신에게", "매일 보면서도 쑥스러워 못 한 말"],
            en: ["To you, right beside me", "What I see you every day and still can't say"],
            ja: ["そばにいるあなたへ", "毎日会っているのに照れて言えないこと"],
            "zh-TW": ["給在身邊的你", "天天見面卻還是害羞說不出口的話"],
        },
    },
    {
        slug: "to-me-this-year", sort: 0, featuredUntil: "2026-12-31T23:59:59+09:00",
        i18n: {
            ko: ["올해의 나에게", "12월, 올해를 지나온 나에게 보내는 말. 마감 날 공감 1위 발표"],
            en: ["To me, this year", "December: a word to the me who made it through this year. #1 announced at closing"],
            ja: ["今年の自分へ", "12月、今年を生き抜いた自分へ。締切日に共感1位を発表"],
            "zh-TW": ["給今年的自己", "十二月，寫給走過這一年的自己。截止日公布共鳴第一名"],
        },
    },
];

// 테스트 이야기. 진짜 사연처럼 보이지 않게 전부 "[테스트]" 로 시작
const STORIES: { room: string; lang: string; nick: string | null; body: string; age: string | null; country: string; city: string; lat: number; lng: number; empathies: number; daysAgo: number }[] = [
    { room: "to-my-twenties", lang: "ko", nick: "밤하늘 고양이", body: "[테스트] 출시 전 확인용 이야기 1.\n이 이야기는 긴 글이 '더 보기'로 접히는지 보려고 줄을 여러 개 넣음.\n셋째 줄.\n넷째 줄은 접힌 상태에선 안 보여야 함.\n다섯째 줄.\n여섯째 줄까지 있음.", age: "30s", country: "KR", city: "Seoul", lat: 37.6, lng: 127.0, empathies: 12, daysAgo: 3 },
    { room: "to-my-twenties", lang: "ko", nick: null, body: "[테스트] 별명 없이 올린 이야기 2. 카드에 '익명'으로 보여야 함.", age: "20s", country: "KR", city: "Seoul", lat: 37.6, lng: 127.0, empathies: 7, daysAgo: 2 },
    { room: "to-my-twenties", lang: "ko", nick: "새벽", body: "[테스트] 이야기 3. 나이대 40대, 부산.", age: "40s", country: "KR", city: "Busan", lat: 35.2, lng: 129.1, empathies: 5, daysAgo: 1 },
    { room: "to-my-twenties", lang: "en", nick: "night owl", body: "[TEST] Sample 4 in English. Korean readers only see this when translation is on (API key).", age: "20s", country: "US", city: "New York", lat: 40.7, lng: -74.0, empathies: 3, daysAgo: 0 },
    { room: "to-my-twenties", lang: "ko", nick: null, body: "[테스트] 짧은 한 줄 이야기 5.", age: null, country: "KR", city: "Daejeon", lat: 36.4, lng: 127.4, empathies: 1, daysAgo: 0 },
    { room: "first-love", lang: "ko", nick: "별 하나", body: "[테스트] 첫사랑 방 확인용 이야기 6. 공감 수가 가장 많은 카드라 1위 화면에서 맨 위에 와야 함.", age: "30s", country: "KR", city: "Seoul", lat: 37.6, lng: 127.0, empathies: 20, daysAgo: 5 },
    { room: "first-love", lang: "ja", nick: "よるのねこ", body: "[テスト] 初恋の部屋の確認用 7。日本語カードの表示確認。", age: "20s", country: "JP", city: "Tokyo", lat: 35.7, lng: 139.7, empathies: 2, daysAgo: 1 },
    { room: "to-mom-and-dad", lang: "ko", nick: "둘째딸", body: "[테스트] 엄마·아빠 방 확인용 이야기 8.", age: "40s", country: "KR", city: "Incheon", lat: 37.5, lng: 126.7, empathies: 4, daysAgo: 1 },
    { room: "to-me-who-endured", lang: "ko", nick: null, body: "[테스트] 버텨낸 나 방 확인용 이야기 9.", age: "50s", country: "KR", city: "Daegu", lat: 35.9, lng: 128.6, empathies: 0, daysAgo: 0 },
    { room: "to-me-in-ten-years", lang: "ko", nick: "열일곱", body: "[테스트] 10년 뒤 방 확인용 이야기 10.", age: "10s", country: "KR", city: "Seoul", lat: 37.6, lng: 127.0, empathies: 2, daysAgo: 0 },
    { room: "to-me-this-year", lang: "ko", nick: "올해의 나", body: "[테스트] 이번 달 주제 방 확인용 이야기 11. 마감 뒤 결과 화면에서 1위로 나와야 함.", age: "30s", country: "KR", city: "Seoul", lat: 37.6, lng: 127.0, empathies: 9, daysAgo: 1 },
    { room: "to-me-this-year", lang: "zh-TW", nick: "夜貓", body: "[測試] 本月主題房間確認用 12。繁體中文卡片顯示確認。", age: "60s", country: "TW", city: "Taipei", lat: 25.0, lng: 121.5, empathies: 3, daysAgo: 0 },
];

// 긴 글 확인용 (하늘의 "이야기 읽기" 시트·카드 "더 보기")
const LONG_KO = `[테스트] 긴 글 확인용. 스무 살의 나에게.

그때 너는 모든 게 늦었다고 생각했지. 친구들은 다 자기 길을 찾은 것 같고, 너만 제자리에서 빙빙 도는 것 같았을 거야. 밤마다 천장을 보면서 "나는 왜 이럴까" 하고 수백 번 물었던 거, 다 기억나.

근데 있잖아. 그 질문을 그렇게 오래 붙들고 있었던 사람이라서 지금의 내가 있어. 남들보다 느렸던 게 아니라, 남들보다 오래 들여다봤던 거야. 그게 나중에 전부 쓸모가 있더라.

하나만 부탁할게. 그 시절의 너를 너무 미워하지 마. 서툴렀지만 진심이었고, 겁이 많았지만 도망치진 않았어. 그거면 충분했어.

10년이 지난 지금, 나는 그때의 너한테 고맙다고 말하고 싶어서 이 글을 써. 잘 버텼다. 정말로.`;
const LONG_KO_2 = `[테스트] 긴 글 2. 엄마·아빠에게.

얼굴 보고는 못 하는 말이라서 여기 적어요. 어릴 때 엄마가 새벽마다 일어나서 도시락 싸 주던 소리, 아빠가 퇴근하고 현관에서 신발 벗으며 내던 한숨 소리. 그때는 아무것도 몰랐는데 요즘은 그 소리들이 자꾸 떠올라요.

저도 이제 일을 하면서 알게 됐어요. 그게 얼마나 무거운 하루였는지. 그런데도 집에 오면 늘 "밥은 먹었니"부터 물어봐 줬잖아요.

고맙다는 말을 한 번도 제대로 못 했네요. 다음에 집에 가면, 꼭 말할게요. 그 전에 여기 먼저 적어 둬요. 사랑해요.`;
STORIES.push(
    { room: "to-my-twenties", lang: "ko", nick: "느린 사람", body: LONG_KO, age: "30s", country: "KR", city: "Seoul", lat: 37.6, lng: 127.0, empathies: 18, daysAgo: 2 },
    { room: "to-mom-and-dad", lang: "ko", nick: null, body: LONG_KO_2, age: "20s", country: "KR", city: "Busan", lat: 35.2, lng: 129.1, empathies: 11, daysAgo: 1 }
);

// 별자리(방마다 별 10개) 확인용 짧은 테스트 글. 공감 수를 다르게 해서 밝기 차이가 보이게
const LINES = ["오늘도 수고했어요", "그때의 너는 충분히 잘하고 있었어", "말하지 못해서 미안했어", "괜찮아, 다시 시작하면 돼", "그 시절이 있어서 지금의 내가 있어", "고마웠다는 말을 못 했네", "울어도 돼. 그래도 괜찮아", "네가 선택한 길을 믿어", "언젠가 웃으면서 이야기할 날이 올 거야", "보고 싶다"];
const ROOM_SLUGS = ["to-my-twenties", "first-love", "to-my-ex", "to-mom-and-dad", "to-me-who-endured", "to-me-in-ten-years", "to-me-this-year"];
for (const room of ROOM_SLUGS) {
    const have = STORIES.filter((s) => s.room === room && s.lang === "ko").length;
    for (let k = have; k < 9; k++) {
        const c = [["KR", "Seoul", 37.6, 127.0], ["KR", "Busan", 35.2, 129.1], ["KR", "Daegu", 35.9, 128.6], ["KR", "Incheon", 37.5, 126.7]][k % 4] as [string, string, number, number];
        STORIES.push({ room, lang: "ko", nick: k % 3 === 0 ? null : ["새벽별", "달무리", "별빛", "구름", "은하수", "밤바람"][k % 6], body: `[테스트] ${LINES[k % LINES.length]}. 별자리 확인용 ${k + 1}.`, age: ["10s", "20s", "30s", "40s", "50s"][k % 5], country: c[0], city: c[1], lat: c[2], lng: c[3], empathies: Math.max(0, 15 - k * 2 + (k % 3)), daysAgo: k % 6 });
    }
}

// 공감을 보내는 가상의 도시들 (지구본 불빛 확인용)
const CITIES = [
    ["KR", "Seoul", 37.6, 127.0], ["KR", "Busan", 35.2, 129.1], ["JP", "Tokyo", 35.7, 139.7], ["JP", "Osaka", 34.7, 135.5],
    ["TW", "Taipei", 25.0, 121.5], ["US", "New York", 40.7, -74.0], ["US", "Los Angeles", 34.1, -118.2], ["GB", "London", 51.5, -0.1],
    ["FR", "Paris", 48.9, 2.4], ["DE", "Berlin", 52.5, 13.4], ["BR", "São Paulo", -23.6, -46.6], ["AU", "Sydney", -33.9, 151.2],
    ["IN", "Mumbai", 19.1, 72.9], ["SG", "Singapore", 1.3, 103.8], ["CA", "Toronto", 43.7, -79.4], ["MX", "Mexico City", 19.4, -99.1],
] as const;

async function main() {
    for (const r of ROOMS) {
        const room = await prisma.room.upsert({
            where: { slug: r.slug },
            create: { slug: r.slug, sort_order: r.sort, featured_until: r.featuredUntil ? new Date(r.featuredUntil) : null },
            update: { sort_order: r.sort, featured_until: r.featuredUntil ? new Date(r.featuredUntil) : null },
        });
        for (const [lang, [title, description]] of Object.entries(r.i18n)) {
            await prisma.room_i18n.upsert({
                where: { room_id_lang: { room_id: room.id, lang } },
                create: { room_id: room.id, lang, title, description },
                update: { title, description },
            });
        }
    }
    console.log(`[seed] 방 ${ROOMS.length}개 준비`);

    if (process.argv.includes("--rooms-only")) return;

    const existing = await prisma.story.count({ where: { is_seed: true } });
    if (existing > 0) {
        console.log(`[seed] 테스트 이야기 ${existing}개 이미 있음 → 건너뜀 (지우려면 npm run db:clear-seed)`);
        return;
    }

    // 테스트 이야기 전부를 한 owner 토큰으로 묶어서 /me 화면·지구본을 바로 볼 수 있게 함
    const ownerToken = newOwnerToken();
    const ownerHash = hashOwnerToken(ownerToken);
    const rooms = new Map((await prisma.room.findMany()).map((r) => [r.slug, r.id]));
    let n = 0;
    for (const s of STORIES) {
        const created = new Date(Date.now() - s.daysAgo * 86_400_000 - 3600_000);
        const story = await prisma.story.create({
            data: {
                room_id: rooms.get(s.room)!,
                body: s.body,
                nickname: s.nick,
                lang: s.lang,
                age_group: s.age,
                country: s.country,
                city: s.city,
                status: "public",
                empathy_count: s.empathies,
                owner_token_hash: ownerHash,
                voter_key: "seed:owner",
                is_seed: true,
                created_at: created,
                published_at: created,
            },
        });
        for (let i = 0; i < s.empathies; i++) {
            const c = CITIES[(i * 7 + story.id) % CITIES.length];
            // 절반은 최근 24시간 안에 (오르는 중 표시 확인)
            const when = i % 2 === 0 ? new Date(Date.now() - (i + 1) * 600_000) : new Date(created.getTime() + i * 3600_000);
            await prisma.empathy.create({ data: { story_id: story.id, voter_key: `seed:voter:${i}`, country: c[0], city: c[1], lat: c[2], lng: c[3], created_at: when } });
        }
        n++;
    }
    const tokenFile = path.join(process.cwd(), "data/seed-owner-token.txt");
    fs.writeFileSync(tokenFile, ownerToken + "\n");
    console.log(`[seed] 테스트 이야기 ${n}개 생성`);
    console.log(`[seed] 테스트 이야기 주인 화면: http://localhost:3100/ko/me/${ownerToken}`);
    console.log(`[seed] (토큰은 ${tokenFile} 에도 저장)`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
