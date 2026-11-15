"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronDown, CircleHelp, Coffee, Smile, PenLine, Share2, Sparkles, Users, Volume2, VolumeX, X } from "lucide-react";
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
import { HillScene, hasWebGL, type HighlightInfo } from "./HillScene";
import { assignRooms, ZODIAC } from "./constellations";
import { setSoundPref, Sound, soundPref } from "@/lib/sound";
import { useHillSocket } from "./useHillSocket";
import ShareSheet from "@/components/ShareSheet";
import { siteName } from "@/lib/site";

type Props = { initialTotal: number };

const INTRO_KEY = "star_intro_seen";
const EMOTE_LABEL: Partial<Record<Gesture, string>> = { wave: "👋", heart: "💛", pat: "🤗", tear: "🥲", joy: "😊", lookup: "✨" };
const DONATE_URL = "https://qr.kakaopay.com/Ej9JnRsvn"; // game 과 같은 카카오페이 송금 링크

// 소리: 브라우저 자동재생 제한 때문에 첫 터치·클릭·키 입력 뒤에 켬. 끄기 버튼은 브라우저가 기억
function useSound() {
    const [snd] = useState(() => new Sound());
    const pref = useSyncExternalStore(
        () => () => {},
        () => soundPref(),
        () => false
    );
    const [override, setOverride] = useState<boolean | null>(null);
    const on = override ?? pref;
    const [armed, setArmed] = useState(false);
    // 사용자 입력 안에서 부를 것
    const arm = useCallback(() => {
        if (!on) return;
        snd.start();
        setArmed(true);
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
        const once = () => arm();
        window.addEventListener("pointerdown", once, { once: true });
        window.addEventListener("keydown", once, { once: true });
        const vis = () => snd.setHidden(document.visibilityState === "hidden");
        document.addEventListener("visibilitychange", vis);
        return () => {
            window.removeEventListener("pointerdown", once);
            window.removeEventListener("keydown", once);
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
        () => null
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
    // 처음 온 사람에겐 안내 3장 (브라우저가 기억)
    const needsIntro = useSyncExternalStore(
        () => () => {},
        () => {
            try {
                return !localStorage.getItem(INTRO_KEY);
            } catch {
                return true;
            }
        },
        () => false
    );
    const [introStep, setIntroStep] = useState(0);
    const [introDone, setIntroDoneRaw] = useState(false);
    const setIntroDone = (v: boolean) => {
        setIntroDoneRaw(v);
        if (v) setTimeout(() => setIntroDoneRaw(false), 6000);
    };
    const intro: number | null = needsIntro && !introDone ? introStep : null;
    const [toastLine, setToastLine] = useState<string | null>(null);
    const seenDaily = useRef<number>(0);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flash = useCallback((line: string) => {
        setToastLine(line);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setToastLine(null), 2600);
    }, []);
    const shownTotal = status === "open" ? total : initialTotal;

    const openStory = useCallback(
        async (id: number) => {
            const r = await api<{ story: StoryView }>(`/api/stories/${id}/view?lang=${lang}`);
            if (r.ok && r.story) {
                setStory(r.story);
                setStoryOpen(true);
            }
        },
        [lang]
    );

    const closeIntro = () => {
        setIntroDone(true);
        try {
            localStorage.setItem(INTRO_KEY, "1");
        } catch {}
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
                scene.syncMembers(you, [...bridge.members.values()].filter((m) => m.id !== you.id));
            }
        }
        return () => {
            bridge.clear();
            scene.dispose();
            sceneRef.current = null;
            if (sitTimer.current) clearTimeout(sitTimer.current);
        };
    }, [bridge, openStory, flash, t, sound, lang]);

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
    const go = (d: number) => sceneRef.current?.goToRoom(d);

    return (
        <section className="hill-wrap" aria-label={t("hill_title")}>
            <canvas ref={canvasRef} className="hill-canvas" />

            {/* 위: 주제(방) 이름 · 넘기기 · 같이 보는 사람. 별자리 이름은 하늘 이름표에만 작게 */}
            <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1 px-3">
                <div className="pointer-events-auto flex w-full max-w-[480px] items-center justify-between">
                    <button onClick={() => go(-1)} aria-label={t("hill_prev")} className="glass rounded-full p-2 text-muted active:scale-95" disabled={rooms.length < 2}>
                        <ChevronLeft size={18} />
                    </button>
                    <div className="min-w-0 text-center">
                        <AnimatePresence mode="wait">
                            <motion.h2 key={slot ? index : "none"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className={`truncate text-lg leading-tight drop-shadow ${room ? "font-semibold text-ink" : "font-medium text-muted"}`}>
                                {slot ? (room ? room.title : t("hill_empty_zodiac")) : t("hill_title")}
                            </motion.h2>
                        </AnimatePresence>
                    </div>
                    <button onClick={() => go(1)} aria-label={t("hill_next")} className="glass rounded-full p-2 text-muted active:scale-95" disabled={rooms.length < 2}>
                        <ChevronRight size={18} />
                    </button>
                </div>
                {/* 12칸 띠(점): 지금 보는 자리·주제 있는 자리 표시. 기호 대신 점이라 별자리는 보조로만 */}
                <div className="flex items-center">
                    {slots.map((s, i) => (
                        <button
                            key={s.zodiac.name}
                            aria-label={`${s.room ? `${s.room.title} · ` : ""}${s.zodiac.names[lang]}`}
                            onClick={() => sceneRef.current?.goTo(i)}
                            className="pointer-events-auto flex h-5 w-5 items-center justify-center"
                        >
                            <span className={`block rounded-full transition-all ${i === index ? "h-2.5 w-2.5 bg-star shadow-[0_0_6px_rgba(255,216,107,0.8)]" : s.room ? "h-1.5 w-1.5 bg-ink/80" : "h-1.5 w-1.5 bg-white/25"}`} />
                        </button>
                    ))}
                </div>
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
                    {soundOn && !soundArmed && intro === null && <p className="absolute right-full top-1/2 mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-full bg-night/60 px-2 py-0.5 text-[10px] text-dim">{t("hill_sound_hint")}</p>}
                </div>
                {/* 감정 표현: 누르면 왼쪽으로 6개가 펼쳐짐 */}
                <div className="relative">
                    <button onClick={() => setEmoteOpen((v) => !v)} aria-label={t("emote_title")} title={t("emote_title")} aria-expanded={emoteOpen} className={`glass pointer-events-auto rounded-full p-2 active:scale-95 ${emoteOpen ? "text-star-soft" : "text-muted"}`} disabled={status !== "open"}>
                        <Smile size={16} />
                    </button>
                    <AnimatePresence>
                        {emoteOpen && (
                            <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="glass pointer-events-auto absolute right-full top-1/2 mr-2 flex -translate-y-1/2 gap-0.5 rounded-full px-1.5 py-1">
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
            <BottomSheet open={donateOpen} onClose={() => setDonateOpen(false)} title={t("donate_title")}>
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink/90">{t("donate_body")}</p>
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
            <BottomSheet open={helpOpen} onClose={() => setHelpOpen(false)} title={t("help_title")}>
                <ul className="space-y-2.5 text-[14px] leading-relaxed text-ink/90">
                    {(["help_1", "help_2", "help_3", "help_4", "help_5", "help_6"] as const).map((k) => (
                        <li key={k} className="flex gap-2">
                            <Sparkles size={14} className="mt-1 shrink-0 text-star" />
                            <span>{t(k)}</span>
                        </li>
                    ))}
                </ul>
                <button onClick={() => setHelpOpen(false)} className="btn-star mt-5 h-11 w-full rounded-full text-sm font-semibold">
                    {t("help_ok")}
                </button>
            </BottomSheet>
            <ShareSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                target={{ url: `${siteOrigin()}/${lang}`, title: siteName(lang), text: t("hill_share_message"), imageUrl: `${siteOrigin()}/${lang}/opengraph-image`, description: t("site_tagline") }}
            />

            {/* 지금 밝아진 별의 첫 문장 (빈 별자리면 안내). 세로(폰)에선 수평선 바로 위(이름표 대신) 라 요정을 안 가림, 가로(PC)는 가운데 */}
            <div className="pointer-events-none absolute inset-x-0 flex justify-center px-5 portrait:top-[var(--hill-horizon,66%)] portrait:-translate-y-[calc(100%+8px)] landscape:top-[60%]">
                <AnimatePresence mode="wait">
                    {slot && !room && !highlight && (
                        <motion.div key={`nozodiac-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.45 }} className="glass pointer-events-auto max-w-[400px] rounded-2xl px-4 py-3 text-center">
                            <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{t("hill_empty")}</p>
                            <Link href={langPath(lang, "/propose")} className="mt-2 inline-block text-[12px] text-star-soft underline-offset-4 hover:underline">
                                {t("hill_propose")} →
                            </Link>
                        </motion.div>
                    )}
                    {room && room.stars.length === 0 && !highlight && (
                        <motion.div key={`empty-${room.slug}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.45 }} className="glass pointer-events-auto max-w-[400px] rounded-2xl px-4 py-3 text-center">
                            <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{t("hill_empty_room")}</p>
                        </motion.div>
                    )}
                    {highlight && highlight.roomIndex === index && highlight.star.line && (
                        <motion.button
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-4">
                <Link href={langPath(lang, room ? `/room/${room.slug}/write` : rooms[0] ? `/room/${rooms[0].slug}/write` : "")} className="btn-star pointer-events-auto flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold">
                    <PenLine size={15} /> {t("hill_write")}
                </Link>
                {/* 세로(폰)에선 글쓰기 버튼만 (아래 안내는 숨김) */}
                <a href="#rooms" className="pointer-events-auto hidden items-center gap-1 text-[12px] text-dim landscape:flex">
                    {t("hill_scroll")} <ChevronDown size={14} className="animate-bounce" />
                </a>
            </div>

            {/* 처음 온 사람 안내 */}
            <AnimatePresence>
                {intro !== null && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex items-center justify-center bg-night/70 p-6 backdrop-blur-sm">
                        <motion.div key={intro} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[400px] text-center">
                            <Sparkles size={28} className="mx-auto mb-4 text-star" />
                            <p className="whitespace-pre-line text-lg font-semibold leading-relaxed text-ink">{t(`intro_${intro + 1}` as "intro_1")}</p>
                            <div className="mt-6 flex items-center justify-center gap-1.5">
                                {[0, 1, 2].map((i) => (
                                    <span key={i} className={`h-1.5 rounded-full ${i === intro ? "w-5 bg-star" : "w-1.5 bg-white/35"}`} />
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    armSound();
                                    if (intro < 2) setIntroStep(intro + 1);
                                    else closeIntro();
                                }}
                                className="btn-star mt-6 rounded-full px-6 py-2.5 text-sm font-semibold"
                            >
                                {intro < 2 ? t("intro_next") : t("intro_start")}
                            </button>
                            {intro < 2 && (
                                <button onClick={closeIntro} className="mt-3 block w-full text-xs text-dim">
                                    {t("intro_skip")}
                                </button>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 별을 눌러 연 이야기 */}
            <BottomSheet open={storyOpen} onClose={() => setStoryOpen(false)} title={t("hill_story_title")}>
                {story && (
                    <div className="max-h-[70dvh] overflow-y-auto">
                        <StoryCard story={story} compact showRoom onHidden={() => setStoryOpen(false)} />
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
                {t("hill_scroll")}
            </Link>
        </section>
    );
}
