"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronDown, CircleHelp, Coffee, MessageCircleHeart, MoonStar, Smile, PenLine, Share2, Sparkles, Users, Volume2, VolumeX, X } from "lucide-react";
import type { SkyData } from "@/lib/hill";
import type { StoryView } from "@/lib/stories";
import { EMOTES, HILL_CAP, type Gesture, type StarEvent } from "@/lib/realtime/protocol";
import { useLang, useT } from "@/components/I18nProvider";
import BottomSheet from "@/components/BottomSheet";
import StoryCard from "@/components/StoryCard";
import Stargazer from "@/components/Stargazer";
import { api, ensureNickname, getMineIds, langPath, NICK_EVENT, siteOrigin, getNickname } from "@/lib/client";
import { randomNickname } from "@/lib/nickname";
import { formatNumber } from "@/lib/format";
import { HillScene, hasWebGL, WISH_INDEX, type HighlightInfo } from "./HillScene";
import Tour from "./Tour";
import { assignRooms, ZODIAC } from "./constellations";
import { setSoundPref, Sound, soundPref } from "@/lib/sound";
import { useHillSocket } from "./useHillSocket";
import { isSnowSeason } from "./season";
import ShareSheet from "@/components/ShareSheet";
import DonorWall from "@/components/DonorWall";
import CrisisNotice from "@/components/CrisisNotice";
import { WishCompose, WishList, WishView, type WishItem } from "./WishDialogs";
import { SISTER_SITES, siteName, sisterUrl } from "@/lib/site";

type Props = { initialTotal: number };

// 2: 글만 5장이던 안내를 버튼 가리키는 안내로 바꿈 → 예전 안내 본 사람도 한 번 더
const INTRO_KEY = "star_intro_seen2";
const DRAG_KEY = "star_drag_seen"; // 하늘 돌리기 힌트를 봤는지
const EMOTE_LABEL: Partial<Record<Gesture, string>> = { wave: "👋", heart: "💛", pat: "🤗", tear: "🥲", joy: "😊", lookup: "✨" };
const DONATE_URL = "https://qr.kakaopay.com/Ej9JnRsvn"; // game 과 같은 카카오페이 송금 링크

// 소리: 브라우저 자동재생 제한 때문에 첫 터치·클릭·키 입력 뒤에 켬. 끄기 버튼은 브라우저가 기억
function useSound() {
    const [snd] = useState(() => new Sound());
    const pref = useSyncExternalStore(
        () => () => {},
        () => soundPref(),
        () => false,
    );
    const [override, setOverride] = useState<boolean | null>(null);
    const on = override ?? pref;
    const [armed, setArmed] = useState(false);
    // 사용자 입력 안에서 부를 것
    const arm = useCallback(() => {
        if (!on) return;
        snd.start();
        void snd.resume().then((ok) => ok && setArmed(true));
    }, [on, snd]);
    const toggle = useCallback(() => {
        const next = !on;
        setSoundPref(next);
        setOverride(next);
        if (next) {
            snd.start();
            setArmed(true);
        } else snd.stop();
    }, [on, snd]);
    useEffect(() => {
        if (!on) return;
        // 브라우저마다 소리를 허락하는 순간이 다름: 아이폰은 손가락이 닿을 때도 되지만, 안드로이드 크롬은 손을 뗄 때(pointerup·touchend·click)만 됨
        // 그래서 여러 입력에 걸어 두고, 실제로 소리가 나기 시작하면 뗌
        const events = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
        const off = () => events.forEach((ev) => window.removeEventListener(ev, tryArm));
        function tryArm() {
            arm();
            void snd.resume().then((ok) => ok && off());
        }
        events.forEach((ev) => window.addEventListener(ev, tryArm, { passive: true }));
        const vis = () => snd.setHidden(document.visibilityState === "hidden");
        document.addEventListener("visibilitychange", vis);
        return () => {
            off();
            document.removeEventListener("visibilitychange", vis);
        };
    }, [on, arm, snd]);
    useEffect(() => () => snd.stop(), [snd]);
    return { sound: snd, on, armed, arm, toggle };
}

// 밤의 언덕: 별자리(방)를 하나씩 보며 이야기를 읽고, 같은 하늘 아래 같이 앉기
export default function Hill({ initialTotal }: Props) {
    const webgl = useSyncExternalStore(
        () => () => {},
        () => hasWebGL(),
        () => null,
    );
    if (webgl === null) return <section className="hill-wrap" aria-busy />;
    if (!webgl) return <HillFallback total={initialTotal} />;
    return <Hill3D initialTotal={initialTotal} />;
}

function Hill3D({ initialTotal }: Props) {
    const t = useT();
    const lang = useLang();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<HillScene | null>(null);
    const { bridge, status, total, daily } = useHillSocket(true);
    const { sound, on: soundOn, armed: soundArmed, arm: armSound, toggle: toggleSound } = useSound();
    const sitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [sky, setSky] = useState<SkyData | null>(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [donateOpen, setDonateOpen] = useState(false);
    const [emoteOpen, setEmoteOpen] = useState(false);
    // 소원 부두
    const [wishOpen, setWishOpen] = useState(false);
    const [wishTapped, setWishTapped] = useState<number | null>(null);
    const [wishCrisis, setWishCrisis] = useState(false);
    const [wishListOpen, setWishListOpen] = useState(false);
    const [topicOpen, setTopicOpen] = useState(false); // 주제 판 (제목·점을 누르면)
    // 글을 쓰고 돌아오면(?born=ID&room=slug) 하늘이 그 별자리로 돌고 내 별이 톡 커짐
    const [born, setBorn] = useState<{ id: number; room: string } | null>(() => {
        if (typeof window === "undefined") return null;
        try {
            const u = new URL(window.location.href);
            const id = Number(u.searchParams.get("born"));
            return id ? { id, room: u.searchParams.get("room") ?? "" } : null;
        } catch {
            return null;
        }
    });
    const [wishes, setWishes] = useState<{ count: number; items: WishItem[] }>({ count: 0, items: [] });
    const loadWishes = useCallback(() => {
        void api<{ count: number; items: WishItem[] }>("/api/wishes").then((r) => {
            if (r.ok) setWishes({ count: r.count, items: r.items });
        });
    }, []);
    useEffect(() => {
        loadWishes();
        const iv = setInterval(loadWishes, 60_000);
        return () => clearInterval(iv);
    }, [loadWishes]);
    // 헤더·글쓰기에서 별명을 바꾸면 언덕 이름표도 바로 바뀜
    useEffect(() => {
        const send = () => bridge.send({ t: "name", n: getNickname() || null });
        window.addEventListener(NICK_EVENT, send);
        return () => window.removeEventListener(NICK_EVENT, send);
    }, [bridge]);
    const [index, setIndex] = useState(0);
    const [highlight, setHighlight] = useState<HighlightInfo>(null);
    const [story, setStory] = useState<StoryView | null>(null);
    const [storyOpen, setStoryOpen] = useState(false);
    const [dailyStory, setDailyStory] = useState<{ story: StoryView; final: boolean } | null>(null);
    // 처음 온 사람에겐 환영 한 장 + 버튼 안내 (브라우저가 기억)
    const needsIntro = useSyncExternalStore(
        () => () => {},
        () => {
            try {
                return !localStorage.getItem(INTRO_KEY);
            } catch {
                return true;
            }
        },
        () => false,
    );
    // 처음엔 하늘을 돌릴 수 있는지 모르니 안내 뒤 "끌어서 돌려 보세요" 힌트 (한 번 끌거나 14초 지나면 끝)
    const needsDragHint = useSyncExternalStore(
        () => () => {},
        () => {
            try {
                return !localStorage.getItem(DRAG_KEY);
            } catch {
                return false;
            }
        },
        () => false,
    );
    const [dragDone, setDragDone] = useState(false);
    const markDrag = useCallback(() => {
        setDragDone(true);
        try {
            localStorage.setItem(DRAG_KEY, "1");
        } catch {}
    }, []);
    const [introDone, setIntroDoneRaw] = useState(false);
    const setIntroDone = (v: boolean) => {
        setIntroDoneRaw(v);
        if (v) setTimeout(() => setIntroDoneRaw(false), 6000);
    };
    // 첫 장(환영) 뒤에 실제 버튼을 가리키는 안내. ? 창에서 다시 볼 수 있음
    const [tourOn, setTourOn] = useState(false);
    const intro: number | null = needsIntro && !introDone && !tourOn ? 0 : null;
    const dragHint = needsDragHint && !dragDone && intro === null && !tourOn;
    useEffect(() => {
        if (!dragHint) return;
        const tm = setTimeout(markDrag, 14000);
        return () => clearTimeout(tm);
    }, [dragHint, markDrag]);
    const cardRef = useRef<HTMLButtonElement | null>(null); // 가운데 이야기 카드 (부두 이름표가 겹치면 숨기려고)
    const [toastLine, setToastLine] = useState<string | null>(null);
    const seenDaily = useRef<number>(0);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flash = useCallback((line: string) => {
        setToastLine(line);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setToastLine(null), 2600);
    }, []);
    const shownTotal = status === "open" ? total : initialTotal;
    // 빌어 주기: 바로 채워 보여 주고(풍등도 환해짐) 서버에 보냄. 실패하면 되돌림
    const cheerWish = useCallback(
        async (id: number) => {
            const before = wishes.items.find((w) => w.id === id);
            if (!before || before.cheered || before.mine) return;
            setWishes((s) => ({ ...s, items: s.items.map((w) => (w.id === id ? { ...w, cheers: w.cheers + 1, cheered: true } : w)) }));
            sceneRef.current?.flareWish(id);
            try {
                navigator.vibrate?.(14);
            } catch {}
            flash(t("wish_cheered"));
            const r = await api<{ cheers: number }>(`/api/wishes/${id}/cheer`, { method: "POST" });
            if (r.ok) setWishes((s) => ({ ...s, items: s.items.map((w) => (w.id === id ? { ...w, cheers: r.cheers, cheered: true } : w)) }));
            else if (r.error !== "dup") setWishes((s) => ({ ...s, items: s.items.map((w) => (w.id === id ? { ...w, cheers: before.cheers, cheered: false } : w)) }));
        },
        [wishes.items, flash, t],
    );
    // 오늘 밤 소원들을 하늘 풍등으로
    useEffect(() => {
        sceneRef.current?.setSkyWishes(wishes.items);
    }, [wishes, sky]);
    // 혼자거나 둘뿐이면 불 둘레에 그림자 요정을 앉혀 덜 쓸쓸하게
    useEffect(() => {
        sceneRef.current?.setGhosts(shownTotal <= 1 ? 3 : shownTotal === 2 ? 2 : shownTotal === 3 ? 1 : 0);
    }, [shownTotal, sky]);

    const openStory = useCallback(
        async (id: number) => {
            const r = await api<{ story: StoryView }>(`/api/stories/${id}/view?lang=${lang}`);
            if (r.ok && r.story) {
                setStory(r.story);
                setStoryOpen(true);
            }
        },
        [lang],
    );

    const storyScrollRef = useRef<HTMLDivElement>(null);
    const nextStory = () => {
        const sc = sceneRef.current;
        const next = story && sc ? sc.nextStarId(story.id) : null;
        if (next == null || !sc) return;
        sc.highlightById(next);
        void openStory(next).then(() => storyScrollRef.current?.scrollTo({ top: 0 }));
    };

    const startTour = () => {
        window.scrollTo({ top: 0 });
        setTourOn(true);
    };
    const tourSteps = useMemo(
        () => (["nick", "topic", "emote", "wish", "write"] as const).map((k) => ({ target: k, text: t(`tour_${k}`) })),
        [t],
    );

    const closeIntro = () => {
        setIntroDone(true);
        try {
            localStorage.setItem(INTRO_KEY, "1");
        } catch {}
    };
    const endTour = () => {
        setTourOn(false);
        closeIntro();
    };

    // 장면 + 소켓 다리
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let scene: HillScene;
        try {
            scene = new HillScene(canvas, {
                lang,
                emptyLabel: t("hill_empty_zodiac"),
                reduceMotion: reduce,
                onStarTap: (id) => void openStory(id),
                onGroundTap: (x, z) => {
                    bridge.send({ t: "move", x, z });
                    if (sitTimer.current) clearTimeout(sitTimer.current);
                    sitTimer.current = setTimeout(() => bridge.send({ t: "pose", p: "sit" }), 900);
                },
                // 방향키 걷기: 걷는 동안 150ms 마다 위치, 멈추면 잠깐 뒤 앉기
                onWalk: (x, z, moving) => {
                    bridge.send({ t: "move", x, z });
                    if (sitTimer.current) clearTimeout(sitTimer.current);
                    if (!moving) sitTimer.current = setTimeout(() => bridge.send({ t: "pose", p: "sit" }), 500);
                },
                onIndexChange: (i) => setIndex(i),
                onHighlight: (h) => setHighlight(h),
                onSfx: (name) => sound.sfx(name),
                onGesture: (g) => bridge.send({ t: "gesture", g }),
                onGift: (to) => bridge.send({ t: "gift", to }),
                wishLabel: t("wish_label"),
                wishSkyLabel: t("wish_sky_title"),
                onWishGo: () => flash(t("wish_going")),
                onLookDrag: markDrag,
                getCardRect: () => cardRef.current?.getBoundingClientRect() ?? null,
                onWishArrive: () => setWishOpen(true),
                onWishTap: (id) => setWishTapped(id),
                onTreeTap: () => {
                    sound.sfx("twinkle");
                    bridge.send({ t: "tree" });
                },
            });
        } catch (e) {
            console.warn("[hill] 3D 실패", e);
            return;
        }
        sceneRef.current = scene;
        if (process.env.NODE_ENV !== "production") (window as unknown as { __hill?: HillScene }).__hill = scene;
        bridge.use({
            onHello: (you, members) => {
                scene.setMe(you.id);
                scene.syncMembers(you, members);
                // 내 별명을 언덕에 알림 (처음이면 여기서 자동으로 정해짐)
                bridge.send({ t: "name", n: ensureNickname(() => randomNickname(lang)) || null });
            },
            onTick: (m, j, l) => scene.applyTick(m, j, l),
            // 내 몸짓·마음은 누를 때 이미 보여 줬으니 서버에서 돌아온 건 건너뜀
            onGesture: (id, g) => {
                if (id !== bridge.meId) scene.gesture(id, g);
            },
            onGift: (from, to) => {
                if (from !== bridge.meId) scene.gift(from, to);
            },
            onLantern: (id) => {
                if (id !== bridge.meId) {
                    scene.launchLantern(id);
                    sound.sfx("lanternFar");
                }
            },
            onTree: (id) => {
                if (id !== bridge.meId) scene.flareTree();
            },
            onName: (id, n) => scene.setName(id, n),
            onStar: (e: StarEvent) => {
                scene.starEvent(e);
                const mine = e.from != null && e.from === bridge.meId;
                if (e.kind === "glow") sound.sfx(mine ? "empathy" : "empathyFar");
                if (e.kind === "born") sound.sfx("born");
                if (e.from == null || mine) return;
                if (e.kind === "born") flash(t("hill_new_star"));
            },
        });
        if (bridge.meId != null) {
            const you = bridge.members.get(bridge.meId);
            if (you) {
                scene.setMe(you.id);
                scene.syncMembers(
                    you,
                    [...bridge.members.values()].filter((m) => m.id !== you.id),
                );
            }
        }
        // 겨울엔 오르골. 내 요정이 트리에 가까울수록 크게
        const winter = isSnowSeason();
        sound.setMusic(winter);
        const musicTimer = winter ? setInterval(() => sound.setMusicNear(scene.treeDistance()), 500) : null;
        return () => {
            if (musicTimer) clearInterval(musicTimer);
            sound.setMusic(false);
            bridge.clear();
            scene.dispose();
            sceneRef.current = null;
            if (sitTimer.current) clearTimeout(sitTimer.current);
        };
    }, [bridge, openStory, flash, t, sound, lang, markDrag]);

    useEffect(() => {
        if (!born || !sky) return;
        let tries = 0;
        let tm: ReturnType<typeof setTimeout>;
        const tryIt = () => {
            const scene = sceneRef.current;
            if (!scene) {
                if (tries++ < 20) tm = setTimeout(tryIt, 300);
                return;
            }
            // 하늘에 아직 없으면(윗별 10개에 못 들어감) 그 별자리로만 돎
            if (!scene.celebrateStar(born.id)) {
                const zi = assignRooms(sky.rooms.map((r) => r.slug)).get(born.room);
                if (zi != null) scene.goTo(zi);
            }
            sound.sfx("born");
            flash(t("hill_my_star_born"));
            setBorn(null);
            try {
                const u = new URL(window.location.href);
                u.searchParams.delete("born");
                u.searchParams.delete("room");
                history.replaceState(null, "", u.toString());
            } catch {}
        };
        tm = setTimeout(tryIt, 700); // 하늘 자료가 장면에 들어간 뒤
        return () => clearTimeout(tm);
    }, [born, sky, flash, t, sound]);

    // 하늘(별자리) 불러오기
    useEffect(() => {
        let alive = true;
        const load = async () => {
            const r = await api<SkyData>(`/api/hill/stars?lang=${lang}`);
            if (alive && r.ok) {
                setSky(r);
                sceneRef.current?.setSky(r, getMineIds());
            }
        };
        void load();
        const iv = setInterval(load, 90_000);
        return () => {
            alive = false;
            clearInterval(iv);
        };
    }, [lang]);

    // 의식
    useEffect(() => {
        if (!daily || daily.at === seenDaily.current) return;
        seenDaily.current = daily.at;
        let alive = true;
        (async () => {
            const [r] = await Promise.all([api<{ story: StoryView }>(`/api/stories/${daily.storyId}/view?lang=${lang}`), sceneRef.current?.playDaily() ?? Promise.resolve()]);
            if (alive && r.ok && r.story) setDailyStory({ story: r.story, final: !!daily.final });
        })();
        return () => {
            alive = false;
        };
    }, [daily, lang]);

    useEffect(() => {
        if (!dailyStory) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDailyStory(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [dailyStory]);

    const rooms = sky?.rooms ?? [];
    // 황도 12궁 자리마다 붙은 방 (없으면 null)
    const assign = assignRooms(rooms.map((r) => r.slug));
    const slots = ZODIAC.map((z, i) => ({ zodiac: z, room: rooms.find((r) => assign.get(r.slug) === i) ?? null }));
    const slot = slots[index];
    const room = slot?.room ?? null;
    const isWish = index === WISH_INDEX; // 13번째 칸: 달과 풍등이 있는 소원 하늘
    const go = (d: number) => sceneRef.current?.goToRoom(d);

    return (
        <section className="hill-wrap" aria-label={t("hill_title")}>
            <canvas ref={canvasRef} className="hill-canvas" />

            {/* 위: 주제(방) 이름 · 넘기기 · 같이 보는 사람. 별자리 이름은 하늘 이름표에만 작게
                페이지를 조금 내려도 헤더 밑에 붙어 따라옴 (높이 0 sticky 틀). 언덕 40% 넘게 내리면 같이 올라감 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[40%]">
            <div className="sticky top-14 z-10 h-0">
            <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1 px-3">
                <div className="pointer-events-auto flex w-full max-w-[480px] items-center justify-between">
                    <button onClick={() => go(-1)} aria-label={t("hill_prev")} className="glass rounded-full p-2 text-muted active:scale-95" disabled={rooms.length < 2}>
                        <ChevronLeft size={18} />
                    </button>
                    {/* 제목을 누르면 주제 판: 12칸을 한눈에 보고 바로 넘어감 */}
                    <button data-tour="topic" onClick={() => setTopicOpen(true)} aria-label={t("topics_title")} className="flex min-w-0 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-center active:scale-[0.98]">
                        <AnimatePresence mode="wait">
                            <motion.h2
                                key={sky && (slot || isWish) ? index : "none"}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.25 }}
                                className={`truncate text-lg leading-tight drop-shadow ${room || isWish || !sky ? "font-semibold text-ink" : "font-medium text-muted"}`}
                            >
                                {sky && isWish ? `🌙 ${t("wish_sky_title")}` : sky && slot ? (room ? room.title : t("hill_empty_zodiac")) : t("hill_title")}
                            </motion.h2>
                        </AnimatePresence>
                        <ChevronDown size={15} className="shrink-0 text-star-soft" />
                    </button>
                    <button onClick={() => go(1)} aria-label={t("hill_next")} className="glass rounded-full p-2 text-muted active:scale-95" disabled={rooms.length < 2}>
                        <ChevronRight size={18} />
                    </button>
                </div>
                {/* 12칸 띠(점): 지금 보는 자리·주제 있는 자리 표시. 점이 작아 누르면 주제 판이 열림 */}
                <button onClick={() => setTopicOpen(true)} aria-label={t("topics_title")} className="pointer-events-auto flex items-center px-2 py-1">
                    {slots.map((s, i) => (
                        <span key={s.zodiac.name} className="flex h-4 w-5 items-center justify-center">
                            <span
                                className={`block rounded-full transition-all ${i === index ? "h-2.5 w-2.5 bg-star shadow-[0_0_6px_rgba(255,216,107,0.8)]" : s.room ? "h-1.5 w-1.5 bg-ink/80" : "h-1.5 w-1.5 bg-white/25"}`}
                            />
                        </span>
                    ))}
                    {/* 소원 하늘 칸 */}
                    <span className={`flex h-4 w-5 items-center justify-center text-[11px] leading-none transition-opacity ${isWish ? "opacity-100 drop-shadow-[0_0_6px_rgba(255,216,107,0.8)]" : "opacity-50"}`}>🌙</span>
                </button>
                {/* 한 줄: 지금 접속 인원/정원 */}
                <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-[11px] text-muted">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${status === "open" ? "bg-star" : "bg-dim"}`} />
                    <Users size={11} className="text-star-soft" />
                    <span className="text-ink">{t("hill_online", { n: formatNumber(Math.max(1, shownTotal), lang), cap: formatNumber(HILL_CAP, lang) })}</span>
                </p>
                {introDone && <p className="text-[11px] text-dim">{t("hill_drag_hint")}</p>}
                <AnimatePresence>
                    {toastLine && (
                        <motion.p key={toastLine} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-full bg-star/15 px-3 py-1 text-[12px] text-star-soft">
                            {toastLine}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>

            {/* 오른쪽 위: 소리 */}
            <div className="pointer-events-none absolute right-3 top-[7.5rem] flex flex-col items-end gap-1">
                <div className="relative">
                    <button onClick={toggleSound} aria-label={soundOn ? t("hill_sound_off") : t("hill_sound_on")} aria-pressed={soundOn} className="glass pointer-events-auto rounded-full p-2 text-muted active:scale-95">
                        {soundOn ? <Volume2 size={16} className={soundArmed ? "text-star-soft" : ""} /> : <VolumeX size={16} />}
                    </button>
                    {/* 버튼 왼쪽에 띄움: 첫 터치에 사라질 때 아래 버튼들이 밀려 올라가 터치가 빗나가지 않게 */}
                    {soundOn && !soundArmed && intro === null && (
                        <p className="absolute right-full top-1/2 mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-full bg-night/60 px-2 py-0.5 text-[10px] text-dim">{t("hill_sound_hint")}</p>
                    )}
                </div>
                {/* 감정 표현: 누르면 왼쪽으로 6개가 펼쳐짐 */}
                <div className="relative">
                    <button
                        onClick={() => setEmoteOpen((v) => !v)}
                        data-tour="emote"
                        aria-label={t("emote_title")}
                        title={t("emote_title")}
                        aria-expanded={emoteOpen}
                        className={`glass pointer-events-auto rounded-full p-2 active:scale-95 ${emoteOpen ? "text-star-soft" : "text-muted"}`}
                        disabled={status !== "open"}
                    >
                        <Smile size={16} />
                    </button>
                    <AnimatePresence>
                        {emoteOpen && (
                            <motion.div
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 8 }}
                                className="glass pointer-events-auto absolute right-full top-1/2 mr-2 flex -translate-y-1/2 gap-0.5 rounded-full px-1.5 py-1"
                            >
                                {EMOTES.map((g) => (
                                    <button
                                        key={g}
                                        onClick={() => {
                                            sceneRef.current?.emote(g);
                                            setEmoteOpen(false);
                                        }}
                                        aria-label={t(`emote_${g}` as "emote_wave")}
                                        title={t(`emote_${g}` as "emote_wave")}
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] active:scale-90 hover:bg-white/10"
                                    >
                                        {EMOTE_LABEL[g]}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                {/* 소원 부두: 누르면 내 요정이 부두로 걸어가 달을 보고 소원 창이 열림 */}
                <button
                    data-tour="wish"
                    onClick={() => (sceneRef.current ? sceneRef.current.goWish() : setWishOpen(true))}
                    aria-label={t("wish_button")}
                    title={t("wish_button")}
                    className="glass pointer-events-auto rounded-full p-2 text-muted active:scale-95"
                >
                    <MoonStar size={16} />
                </button>
                {/* 친구 부르기: 사이트 첫 화면 링크 공유 */}
                <button onClick={() => setShareOpen(true)} aria-label={t("hill_share")} title={t("hill_share")} className="glass pointer-events-auto rounded-full p-2 text-muted active:scale-95">
                    <Share2 size={16} />
                </button>
                {/* 사용법: 언제든 다시 볼 수 있게 */}
                <button onClick={() => setHelpOpen(true)} aria-label={t("help_title")} title={t("help_title")} className="glass pointer-events-auto rounded-full p-2 text-muted active:scale-95">
                    <CircleHelp size={16} />
                </button>
                {/* 후원: 카카오페이라 한국어 화면에만 (해외용 링크 생기면 다른 언어도) */}
                {lang === "ko" && (
                    <button onClick={() => setDonateOpen(true)} aria-label={t("donate_title")} title={t("donate_title")} className="glass pointer-events-auto rounded-full p-2 text-muted active:scale-95">
                        <Coffee size={16} />
                    </button>
                )}
            </div>
            </div>
            </div>
            <BottomSheet open={donateOpen} onClose={() => setDonateOpen(false)} title={t("donate_title")}>
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink/90">{t("donate_body")}</p>
                <p className="mt-1 text-[14px] font-semibold text-star-soft">{t("donate_chicken")}</p>
                <p className="mt-1 text-[12px] text-dim">{t("donate_free")}</p>
                {donateOpen && <DonorWall />}
                <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="btn-star mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold">
                    <Coffee size={16} /> {t("donate_pay")}
                </a>
                {/* PC 에선 폰으로 찍을 QR */}
                <div className="mt-4 hidden flex-col items-center gap-1.5 md:flex">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/donate-qr.png" alt={t("donate_qr")} width={160} height={160} className="rounded-xl bg-white p-2" />
                    <p className="text-[11px] text-dim">{t("donate_qr")}</p>
                </div>
            </BottomSheet>
            <WishCompose
                open={wishOpen}
                count={wishes.count}
                onClose={() => setWishOpen(false)}
                onOpenList={() => {
                    setWishOpen(false);
                    setWishListOpen(true);
                }}
                onSent={(crisis) => {
                    setWishOpen(false);
                    if (bridge.meId != null) sceneRef.current?.launchLantern(bridge.meId);
                    sound.sfx("lantern");
                    bridge.send({ t: "lantern" });
                    flash(t("wish_sent"));
                    if (crisis) setWishCrisis(true);
                    setTimeout(loadWishes, 1500);
                }}
            />
            <WishView
                wish={wishes.items.find((w) => w.id === wishTapped) ?? null}
                onClose={() => setWishTapped(null)}
                onCheer={cheerWish}
                onOpenList={() => {
                    setWishTapped(null);
                    setWishListOpen(true);
                }}
                onNext={
                    wishes.items.length > 1
                        ? () => {
                              const k = wishes.items.findIndex((w) => w.id === wishTapped);
                              setWishTapped(wishes.items[(k + 1) % wishes.items.length].id);
                          }
                        : undefined
                }
            />
            <WishList open={wishListOpen} items={wishes.items} onClose={() => setWishListOpen(false)} onCheer={cheerWish} />
            {/* 주제 판: 12칸 한눈에. 누르면 하늘이 그 별자리로 돎 */}
            <BottomSheet open={topicOpen} onClose={() => setTopicOpen(false)} title={t("topics_title")}>
                <ul className="grid max-h-[62vh] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
                    {slots.map((s, i) => {
                        const now = i === index;
                        if (!s.room)
                            return (
                                <li key={s.zodiac.name}>
                                    <Link
                                        href={langPath(lang, "/propose")}
                                        onClick={() => setTopicOpen(false)}
                                        className={`flex h-full flex-col justify-between rounded-2xl border border-dashed px-3 py-2.5 text-left ${now ? "border-star/60 bg-star/10" : "border-line/80"}`}
                                    >
                                        <span className="text-[14px] font-medium text-star-soft">+ {t("hill_propose")}</span>
                                        <span className="mt-1.5 text-[11px] text-dim">
                                            {s.zodiac.names[lang]} · {t("hill_empty_zodiac")}
                                        </span>
                                    </Link>
                                </li>
                            );
                        return (
                            <li key={s.zodiac.name} className="relative">
                                {/* 바로 글쓰기 */}
                                <Link
                                    href={langPath(lang, `/room/${s.room.slug}/write`)}
                                    aria-label={`${s.room.title} · ${t("hill_write")}`}
                                    title={t("hill_write")}
                                    className="absolute right-1.5 top-1.5 z-10 rounded-full p-1.5 text-star-soft hover:bg-star/15 active:scale-95"
                                >
                                    <PenLine size={14} />
                                </Link>
                                <button
                                    onClick={() => {
                                        setTopicOpen(false);
                                        sceneRef.current?.goTo(i);
                                    }}
                                    aria-current={now ? "true" : undefined}
                                    className={`glass flex h-full w-full flex-col justify-between rounded-2xl px-3 py-2.5 text-left active:scale-[0.98] ${now ? "!border-star/60 !bg-star/15" : ""}`}
                                >
                                    <span className={`break-keep pr-6 text-[14px] font-semibold leading-snug ${now ? "text-star" : "text-ink"}`}>{s.room.title}</span>
                                    <span className="mt-1.5 text-[11px] text-dim">
                                        {s.zodiac.names[lang]} · {t("topics_count", { n: formatNumber(s.room.count, lang) })}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </BottomSheet>
            <BottomSheet open={wishCrisis} onClose={() => setWishCrisis(false)} title={t("wish_title")}>
                <CrisisNotice />
            </BottomSheet>
            <BottomSheet open={helpOpen} onClose={() => setHelpOpen(false)} title={t("help_title")}>
                <ul className="space-y-2.5 text-[14px] leading-relaxed text-ink/90">
                    {(["help_1", "help_2", "help_3", "help_4", "help_5", "help_6", "help_7"] as const).map((k) => (
                        <li key={k} className="flex gap-2">
                            <Sparkles size={14} className="mt-1 shrink-0 text-star" />
                            <span>{t(k)}</span>
                        </li>
                    ))}
                </ul>
                <div className="mt-5 flex gap-2">
                    <button
                        onClick={() => {
                            setHelpOpen(false);
                            startTour();
                        }}
                        className="glass h-11 flex-1 rounded-full text-sm text-ink"
                    >
                        {t("help_tour")}
                    </button>
                    <button onClick={() => setHelpOpen(false)} className="btn-star h-11 flex-1 rounded-full text-sm font-semibold">
                        {t("help_ok")}
                    </button>
                </div>
                {/* 방명록: 의견 듣기 */}
                <Link href={langPath(lang, "/guestbook")} className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-line text-sm text-ink hover:bg-card-strong">
                    <MessageCircleHeart size={15} className="text-star-soft" /> {t("nav_guestbook")}
                </Link>
                {/* binaryworld 의 다른 놀거리 */}
                <p className="mt-5 text-[12px] text-dim">{t("help_more")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {SISTER_SITES.map((s) => (
                        <a key={s.name} href={sisterUrl(s.url)} target="_blank" rel="noopener" className="rounded-full border border-line px-3 py-1 text-[12px] text-muted hover:text-ink">
                            {s.name}
                        </a>
                    ))}
                </div>
            </BottomSheet>
            <ShareSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                target={{ url: `${siteOrigin()}/${lang}`, title: siteName(lang), text: t("hill_share_message"), imageUrl: `${siteOrigin()}/${lang}/opengraph-image`, description: t("site_tagline") }}
            />

            {/* 지금 밝아진 별의 첫 문장 (빈 별자리면 안내). 세로(폰)에선 수평선 바로 위(이름표 대신) 라 요정을 안 가림, 가로(PC)는 가운데 */}
            <div className="pointer-events-none absolute inset-x-0 flex justify-center px-5 portrait:top-[var(--hill-horizon,66%)] portrait:-translate-y-[calc(100%+36px)] landscape:top-[54%]">
                <AnimatePresence mode="wait">
                    {sky && isWish && (
                        <motion.div
                            key="wishsky"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.45 }}
                            className="glass pointer-events-auto max-w-[400px] rounded-2xl px-4 py-3 text-center"
                        >
                            <p className="text-[14px] leading-relaxed text-ink">{wishes.count > 0 ? t("wish_count", { n: formatNumber(wishes.count, lang) }) : t("wish_empty")}</p>
                            <div className="mt-2 flex justify-center gap-2">
                                {wishes.count > 0 && (
                                    <button onClick={() => setWishListOpen(true)} className="rounded-full border border-line px-3 py-1 text-[12px] text-ink hover:bg-card-strong">
                                        {t("wish_all")}
                                    </button>
                                )}
                                <button onClick={() => (sceneRef.current ? sceneRef.current.goWish() : setWishOpen(true))} className="btn-star rounded-full px-3 py-1 text-[12px] font-semibold">
                                    🏮 {t("wish_button")}
                                </button>
                            </div>
                        </motion.div>
                    )}
                    {slot && !room && !highlight && (
                        <motion.div
                            key={`nozodiac-${index}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.45 }}
                            className="glass pointer-events-auto max-w-[400px] rounded-2xl px-4 py-3 text-center"
                        >
                            <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{t("hill_empty")}</p>
                            <Link href={langPath(lang, "/propose")} className="mt-2 inline-block text-[12px] text-star-soft underline-offset-4 hover:underline">
                                {t("hill_propose")} →
                            </Link>
                        </motion.div>
                    )}
                    {room && room.stars.length === 0 && !highlight && (
                        <motion.div
                            key={`empty-${room.slug}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.45 }}
                            className="glass pointer-events-auto max-w-[400px] rounded-2xl px-4 py-3 text-center"
                        >
                            <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{t("hill_empty_room")}</p>
                        </motion.div>
                    )}
                    {highlight && highlight.roomIndex === index && highlight.star.line && (
                        <motion.button
                            ref={cardRef}
                            key={highlight.star.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.45 }}
                            onClick={() => void openStory(highlight.star.id)}
                            className="glass pointer-events-auto max-w-[440px] rounded-2xl px-4 py-3 text-left shadow-glow"
                        >
                            <p className="story-body !text-[15px] !leading-relaxed text-ink">“{highlight.star.line}”</p>
                            <p className="mt-1.5 text-[11px] text-muted">
                                {highlight.star.nick ? `${highlight.star.nick} · ` : ""}
                                {t("hill_star_tip", { n: formatNumber(highlight.star.c, lang) })} · <span className="text-star-soft">{t("hill_open")}</span>
                            </p>
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* 아래: 나도 한마디 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1.5 px-4 pb-2.5 landscape:gap-2 landscape:pb-4">
                <Link
                    data-tour="write"
                    href={langPath(lang, room ? `/room/${room.slug}/write` : rooms[0] ? `/room/${rooms[0].slug}/write` : "")}
                    className="btn-star pointer-events-auto flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold"
                >
                    <PenLine size={15} /> {t("hill_write")}
                </Link>
            </div>

            {/* 하늘 돌리기 힌트 (처음 한 번) */}
            <AnimatePresence>
                {dragHint && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-[42%] z-20 flex justify-center">
                        <motion.span animate={{ x: [-8, 8, -8] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="glass rounded-full px-4 py-2 text-[13px] text-ink/90">
                            {t("hint_drag")}
                        </motion.span>
                    </motion.div>
                )}
            </AnimatePresence>

            {tourOn && (
                <Tour
                    steps={tourSteps}
                    labels={{ next: t("intro_next"), done: t("intro_start"), skip: t("intro_skip") }}
                    onDone={endTour}
                />
            )}

            {/* 처음 온 사람 안내 */}
            <AnimatePresence>
                {intro !== null && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex items-center justify-center bg-night/70 p-6 backdrop-blur-sm">
                        <motion.div key={intro} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[400px] text-center">
                            <Sparkles size={28} className="mx-auto mb-4 text-star" />
                            <p className="whitespace-pre-line break-keep text-lg font-semibold leading-relaxed text-ink">{t(`intro_${intro + 1}` as "intro_1")}</p>
                            <div className="mt-6 flex items-center justify-center gap-1.5">

                            </div>
                            <button
                                onClick={() => {
                                    armSound();
                                    startTour();
                                }}
                                className="btn-star mt-6 rounded-full px-6 py-2.5 text-sm font-semibold"
                            >
                                {t("intro_next")}
                            </button>
                            <button onClick={closeIntro} className="mt-3 block w-full text-xs text-dim">
                                {t("intro_skip")}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 별을 눌러 연 이야기 */}
            {/* 제목 자리에 주제 이름 (카드 안 주제 표시는 뺌. 보이는 게 많아 헷갈려서) */}
            <BottomSheet open={storyOpen} onClose={() => setStoryOpen(false)} title={story?.roomTitle || t("hill_story_title")}>
                {story && (
                    <div ref={storyScrollRef} className="max-h-[70dvh] overflow-y-auto">
                        <StoryCard key={story.id} story={story} compact onHidden={() => setStoryOpen(false)} />
                        {/* 주제 방 페이지처럼 이어 읽기. 하늘에서도 그 별이 반짝임 */}
                        <button onClick={nextStory} className="mt-3 h-11 w-full rounded-full border border-line text-sm text-ink hover:bg-card-strong active:scale-[0.99]">
                            {t("story_next")} →
                        </button>
                    </div>
                )}
            </BottomSheet>

            {/* 의식 */}
            <AnimatePresence>
                {dailyStory && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
                        <motion.div initial={{ y: 40, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20 }} className="relative w-full max-w-[480px] rounded-3xl border border-star/30 bg-night p-5 shadow-glow">
                            <button onClick={() => setDailyStory(null)} aria-label="close" className="absolute right-3 top-3 rounded-full p-1 text-muted hover:text-ink">
                                <X size={18} />
                            </button>
                            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-star">
                                <Sparkles size={12} /> {dailyStory.final ? t("final_title") : t("daily_title")}
                            </p>
                            <p className="mb-3 text-xs text-muted">{dailyStory.final ? t("final_sub") : t("daily_sub")}</p>
                            <div className="max-h-[60dvh] overflow-y-auto">
                                <StoryCard story={dailyStory.story} compact showRoom />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}

// WebGL 없는 기기: 밤하늘(배경) + 인원수 + 캐릭터
function HillFallback({ total }: { total: number }) {
    const t = useT();
    const lang = useLang();
    return (
        <section className="hill-wrap flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-muted">{t("hill_no_webgl")}</p>
            {total > 1 && <p className="text-lg font-semibold text-ink">{t("hill_watching", { n: formatNumber(total, lang) })}</p>}
            <Stargazer caption={false} />
            <Link href={langPath(lang, "#rooms")} className="text-sm text-star-soft">
                {t("topics_title")}
            </Link>
        </section>
    );
}
