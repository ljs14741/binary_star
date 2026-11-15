// 공유 이미지 배경(public/og/hill.jpg) 다시 찍기: 개발 서버(localhost:3100) 띄운 뒤 node scripts/capture-og-bg.mjs public/og/hill.jpg
// playwright-core·chromium 경로는 docs/START.md "확인 방법" 참고
import { chromium } from "/home/binary/.claude/skills/web-promo-video/tools/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 1200, height: 686 }, deviceScaleFactor: 1, locale: "ko-KR" });
await ctx.addInitScript(() => { try { localStorage.setItem("star_intro_seen", "1"); localStorage.setItem("star_nickname", ""); localStorage.setItem("star_nickname_v2", "1"); } catch {} });
const p = await ctx.newPage();
await p.goto("http://localhost:3100/ko", { waitUntil: "load", timeout: 90000 });
await p.waitForTimeout(6000);
// 장면만 남기고 화면 글자·버튼은 숨김, 내 요정·이름표·별자리 이름표도 숨김
await p.addStyleTag({ content: `header, footer, button, a, p, h1, h2, nav, [role=dialog], .glass { visibility: hidden !important; } nextjs-portal { display:none !important; }` });
await p.evaluate(() => { const h = window.__hill; for (const p of h.people.values()) p.group.visible = false; for (const c of h.constellations) { c.label.visible = false; c.sub.visible = false; } h.setSkyWishes([]); h.setGhosts(4); setInterval(() => { for (const g of h.ghosts) { g.s.material.opacity = 1; g.s.material.color.set(0xffffff); } }, 50); });
await p.waitForTimeout(3500);
await p.screenshot({ path: process.argv[2], type: "jpeg", quality: 88, clip: { x: 0, y: 56, width: 1200, height: 630 } });
await b.close();
