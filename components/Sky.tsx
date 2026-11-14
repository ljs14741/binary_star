"use client";

import { useEffect, useRef } from "react";

// 밤하늘 배경. 별이 북극성(왼쪽 위 바깥)을 중심으로 아주 천천히 돌고, 가끔 별똥별이 떨어짐. 옅은 은하수 띠
export default function Sky() {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        let raf = 0;
        type Star = { r: number; a: number; d: number; p: number; s: number; warm: boolean };
        let stars: Star[] = [];
        let W = 0, H = 0, pole = { x: 0, y: 0 }, maxR = 0;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const ROT = (Math.PI * 2) / (6 * 60 * 1000); // 6분에 한 바퀴 (실제 하늘보다 빠르지만 눈에 띌 만큼만)
        type Meteor = { x: number; y: number; vx: number; vy: number; life: number; max: number };
        let meteors: Meteor[] = [];
        let nextMeteor = performance.now() + 4000 + Math.random() * 6000;

        const resize = () => {
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            canvas.style.width = W + "px";
            canvas.style.height = H + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            pole = { x: -W * 0.15, y: -H * 0.25 };
            maxR = Math.hypot(W - pole.x, H - pole.y) * 1.05;
            const n = Math.min(320, Math.floor((W * H) / 4200));
            stars = Array.from({ length: n }, () => {
                // 은하수 띠(오른쪽 위 → 왼쪽 아래) 근처에 별을 더 촘촘히
                const onBand = Math.random() < 0.35;
                let x = Math.random() * W, y = Math.random() * H;
                if (onBand) {
                    const tt = Math.random();
                    x = W * (1 - tt) + (Math.random() - 0.5) * W * 0.35;
                    y = H * tt * 0.9 + (Math.random() - 0.5) * H * 0.25;
                }
                return { r: Math.hypot(x - pole.x, y - pole.y), a: Math.atan2(y - pole.y, x - pole.x), d: (onBand ? 0.5 : 0.7) + Math.random() * 0.9, p: Math.random() * Math.PI * 2, s: 0.4 + Math.random() * 0.8, warm: Math.random() < 0.3 };
            });
        };

        const drawMilkyWay = () => {
            const g = ctx.createLinearGradient(W, 0, 0, H);
            g.addColorStop(0.3, "rgba(120,140,220,0)");
            g.addColorStop(0.5, "rgba(140,160,235,0.045)");
            g.addColorStop(0.7, "rgba(120,140,220,0)");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
        };

        const draw = (now: number) => {
            ctx.clearRect(0, 0, W, H);
            drawMilkyWay();
            const rot = reduce ? 0 : now * ROT;
            for (const st of stars) {
                const ang = st.a + rot;
                const x = pole.x + st.r * Math.cos(ang);
                const y = pole.y + st.r * Math.sin(ang);
                if (x < -4 || y < -4 || x > W + 4 || y > H + 4) {
                    // 화면 밖으로 나간 별은 반대쪽에서 다시 (반지름 유지)
                    if (st.r > maxR) st.r = Math.random() * maxR;
                    continue;
                }
                const tw = reduce ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.001 * st.s + st.p));
                ctx.beginPath();
                ctx.fillStyle = st.warm ? `rgba(255, 226, 170, ${tw})` : `rgba(230, 236, 255, ${tw})`;
                ctx.arc(x, y, st.d, 0, Math.PI * 2);
                ctx.fill();
            }
            // 별똥별
            if (!reduce && now > nextMeteor && meteors.length < 2) {
                const fromTop = Math.random() < 0.7;
                const x = fromTop ? W * (0.3 + Math.random() * 0.7) : W + 20;
                const y = fromTop ? -20 : H * Math.random() * 0.4;
                const sp = 9 + Math.random() * 6;
                meteors.push({ x, y, vx: -sp * 0.8, vy: sp * 0.55, life: 0, max: 40 + Math.random() * 25 });
                nextMeteor = now + 7000 + Math.random() * 12000;
            }
            meteors = meteors.filter((m) => m.life < m.max);
            for (const m of meteors) {
                m.x += m.vx;
                m.y += m.vy;
                m.life++;
                const k = 1 - m.life / m.max;
                const len = 90;
                const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * (len / 10), m.y - m.vy * (len / 10));
                grad.addColorStop(0, `rgba(255, 244, 214, ${0.9 * k})`);
                grad.addColorStop(1, "rgba(255, 244, 214, 0)");
                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.6;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(m.x, m.y);
                ctx.lineTo(m.x - m.vx * (len / 10), m.y - m.vy * (len / 10));
                ctx.stroke();
            }
            if (!reduce) raf = requestAnimationFrame(draw);
        };
        resize();
        draw(performance.now());
        window.addEventListener("resize", resize);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, []);
    return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}
