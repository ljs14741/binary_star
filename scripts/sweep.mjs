// 전체 훑기 점검 (개발 서버 localhost:3100 필요): node scripts/sweep.mjs → 문제 목록 + .tmp/sweep/*.png. 화면 3종 × 주요 동작, 쓰기 요청은 막음
import { createRequire } from "module"; const require = createRequire(import.meta.url);
import fs from "fs";
const { chromium } = require(process.env.HOME + "/.claude/skills/web-promo-video/tools/node_modules/playwright-core");
const B = "http://localhost:3100";
const OUT = ".tmp/sweep"; // git 밖 fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome", args: ["--use-angle=swiftshader"] });
const issues = [];
const note = (vp, msg) => { issues.push(`[${vp}] ${msg}`); };
const VPS = [["and360", 360, 740, true], ["iph390", 390, 844, true], ["pc1440", 1440, 900, false]];

async function newPage(vp, w, h, mob, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: 1, ...(opts.ctx || {}) });
  if (!opts.fresh) await ctx.addInitScript(() => { try { localStorage.setItem("star_intro_seen2", "1"); localStorage.setItem("star_drag_seen", "1"); } catch {} });
  if (opts.noWebgl) await ctx.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/.test(t)) return null; return o.call(this, t, ...a); }; });
  await ctx.route("**/*", (r) => { const q = r.request(); if (q.method() !== "GET" && !q.url().includes("/_next")) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, error: "blocked_in_test" }) }); return r.continue(); });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => note(vp, "PAGEERR " + e.message.slice(0, 140)));
  p.on("console", (m) => { if (m.type() === "error" && !/blocked_in_test|Failed to load resource|status of 4/.test(m.text())) note(vp, "console " + m.text().slice(0, 140)); });
  return { ctx, p };
}
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const title = (p) => p.evaluate(() => document.querySelector("section.hill-wrap h2")?.textContent || "");
const tap = async (p, mob, x, y) => (mob ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));

for (const [vp, w, h, mob] of VPS) {
  // 1. 첫 화면 + 13칸 넘기기
  const { ctx, p } = await newPage(vp, w, h, mob);
  await p.goto(B + "/ko", { waitUntil: "load" }); await p.waitForTimeout(6000);
  if (await overflow(p) > 1) note(vp, "첫 화면 가로 넘침 " + (await overflow(p)));
  await p.screenshot({ path: `${OUT}/${vp}_01_home.png` });
  const seen = [];
  for (let i = 0; i < 13; i++) { await p.getByRole("button", { name: "다음 별자리" }).click(); await p.waitForTimeout(1300); seen.push(await title(p)); }
  if (new Set(seen).size < 11) note(vp, "› 13번 넘김에 제목 종류가 적음: " + seen.join("|"));
  if (!seen.some((s) => s.includes("소원 하늘"))) note(vp, "› 로 소원 하늘에 안 들름");
  // 2. 주제 판에서 칸 고르기
  await p.getByRole("button", { name: "주제 한눈에" }).first().click(); await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${vp}_02_board.png` });
  const items = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] a, [role="dialog"] button')].map((e) => e.textContent.trim()).filter((t) => t.length > 1).slice(0, 40));
  const pick = items.find((t) => t.includes("첫사랑에게"));
  if (pick) { await p.locator('[role="dialog"]').getByText("첫사랑에게").first().click(); await p.waitForTimeout(1800); const tt = await title(p); if (!tt.includes("첫사랑")) note(vp, "주제 판에서 첫사랑에게 골랐는데 제목 " + tt); }
  else note(vp, "주제 판에 첫사랑에게 없음");
  // 3. 하늘 빈 곳 누르기 (여러 군데) → 소원 하늘에서 제자리인지
  await p.evaluate(() => window.__hill.goTo(12)); await p.waitForTimeout(2200);
  const r = await p.evaluate(() => { const c = document.querySelector("section.hill-wrap canvas").getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
  for (const [fx, fy] of [[0.5, 0.25], [0.44, 0.3], [0.56, 0.35]]) // 풍등이 퍼진 소원 하늘 안쪽 (PC 에선 0.65 부터는 옆 별자리 칸) {
    await tap(p, mob, r.x + r.w * fx, r.y + r.h * fy); await p.waitForTimeout(1300);
    const open = await p.locator('[role="dialog"]').count();
    if (open) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
    const tt = await title(p); if (!tt.includes("소원 하늘")) { note(vp, `소원 하늘 빈 곳(${fx},${fy}) 눌렀더니 ${tt}`); await p.evaluate(() => window.__hill.goTo(12)); await p.waitForTimeout(1800); }
  }
  // 4. 풍등 누르기 → 소원 창
  const lan = await p.evaluate(() => { const h = window.__hill; const rr = h.canvas.getBoundingClientRect(); for (const s of h.skyWishes) { const v = s.s.position.clone().add(h.sky.position).project(h.camera); if (v.z < 1 && Math.abs(v.x) < 0.8 && Math.abs(v.y) < 0.8) return { x: rr.left + (v.x + 1) / 2 * rr.width, y: rr.top + (1 - v.y) / 2 * rr.height }; } return null; });
  if (lan) { await tap(p, mob, lan.x, lan.y); await p.waitForTimeout(1200); const txt = await p.evaluate(() => document.querySelector('[role="dialog"]')?.textContent || ""); if (!txt.includes("소원")) note(vp, "풍등 눌렀는데 소원 창 안 뜸"); await p.screenshot({ path: `${OUT}/${vp}_03_wish.png` }); await p.keyboard.press("Escape"); await p.waitForTimeout(500); }
  else note(vp, "화면에 누를 풍등이 없음");
  // 5. 정면 + 트리 누르기 + 별명 창 + 감정 표현 + ? 창
  await p.evaluate(() => window.__hill.goTo(0)); await p.waitForTimeout(2000);
  const tree = await p.evaluate(() => { const h = window.__hill; const v = h.tree.hitPoints()[1].clone().project(h.camera); const rr = h.canvas.getBoundingClientRect(); return { x: rr.left + (v.x + 1) / 2 * rr.width, y: rr.top + (1 - v.y) / 2 * rr.height, in: Math.abs(v.x) < 0.95 && v.z < 1 }; });
  if (tree.in) { await tap(p, mob, tree.x, tree.y); await p.waitForTimeout(500); { const tt = await title(p); if (!tt.includes("스무")) note(vp, "트리 눌렀더니 제목이 바뀜 " + tt); } }
  await p.locator('[data-tour="nick"]').click(); await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${vp}_04_nick.png` });
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  await p.locator('[data-tour="emote"]').click(); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${vp}_05_emote.png` });
  await p.locator('[data-tour="emote"]').click(); await p.waitForTimeout(300);
  await p.getByRole("button", { name: "이용 방법" }).click(); await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${vp}_06_help.png` });
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await ctx.close();

  // 6. 처음 온 사람 안내 (새 브라우저)
  { const { ctx, p } = await newPage(vp, w, h, mob, { fresh: true }); await p.goto(B + "/ko", { waitUntil: "load" }); await p.waitForTimeout(5000);
    await p.getByRole("button", { name: "다음", exact: true }).click(); await p.waitForTimeout(900);
    for (let i = 0; i < 5; i++) { const box = await p.locator('body > [role="dialog"] .btn-star').boundingBox().catch(() => null); if (!box) { note(vp, `안내 ${i + 1}단계 말풍선 없음`); break; } if (box.x < 0 || box.x + box.width > w + 1 || box.y < 0 || box.y + box.height > h + 1) note(vp, `안내 ${i + 1}단계 버튼이 화면 밖`); if (i === 2) await p.screenshot({ path: `${OUT}/${vp}_07_tour.png` }); await p.locator('body > [role="dialog"] .btn-star').click(); await p.waitForTimeout(700); }
    await ctx.close(); }

  // 7. 페이지들 + 언어
  { const { ctx, p } = await newPage(vp, w, h, mob);
    for (const path of ["/ko/room/first-love", "/ko/s/2232", "/ko/room/to-my-twenties/write", "/ko/guestbook", "/ko/about", "/ko/propose", "/ko/privacy", "/ko/nope", "/en", "/ja", "/zh-TW", "/en/room/first-love", "/ja/guestbook"]) {
      const res = await p.goto(B + path, { waitUntil: "load" }).catch((e) => null); await p.waitForTimeout(path.length < 7 ? 5000 : 1500);
      const st = res ? res.status() : "ERR"; if (st !== 200 && !path.includes("nope")) note(vp, `${path} 응답 ${st}`);
      const of = await overflow(p); if (of > 1) note(vp, `${path} 가로 넘침 ${of}px`);
      // 버튼 글자 두 줄 꺾임(한 글자씩 세로)
      const wrapped = await p.evaluate(() => [...document.querySelectorAll("button, a")].filter((e) => { const r = e.getBoundingClientRect(); const t = e.textContent.trim(); return r.width > 0 && t.length >= 2 && t.length <= 8 && r.height > 40 && r.width < 28; }).map((e) => e.textContent.trim()).slice(0, 3));
      if (wrapped.length) note(vp, `${path} 글자가 세로로 꺾인 버튼: ${wrapped.join(",")}`);
      await p.screenshot({ path: `${OUT}/${vp}_p${path.replace(/\//g, "_")}.png` });
    }
    await ctx.close(); }

  // 8. 3D 안 되는 기기
  { const { ctx, p } = await newPage(vp, w, h, mob, { noWebgl: true }); await p.goto(B + "/ko", { waitUntil: "load" }); await p.waitForTimeout(3000);
    await p.screenshot({ path: `${OUT}/${vp}_08_nowebgl.png` });
    if (await overflow(p) > 1) note(vp, "WebGL 없을 때 가로 넘침");
    await ctx.close(); }
  console.log("done", vp);
}
// 9. 폰 가로 화면
{ const { ctx, p } = await newPage("land", 844, 390, true); await p.goto(B + "/ko", { waitUntil: "load" }); await p.waitForTimeout(6000); await p.screenshot({ path: `${OUT}/land_home.png` }); if (await overflow(p) > 1) note("land", "가로 넘침"); await ctx.close(); }
await b.close();
fs.writeFileSync(`${OUT}/issues.txt`, issues.join("\n"));
console.log("ISSUES", issues.length); console.log(issues.join("\n"));
