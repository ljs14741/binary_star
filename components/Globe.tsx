"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minus, Plus, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { MultiPolygon, Polygon, Position } from "geojson";
import landTopo from "world-atlas/land-110m.json";
import countriesTopo from "world-atlas/countries-110m.json";
import { useT } from "./I18nProvider";
import type { CityLight } from "@/lib/stories";

// 밤의 지구본. 땅은 점으로, 공감 온 도시는 빛으로. 지도 데이터는 world-atlas 파일 (외부 호출 없음)
const R = 1;
// 카메라 거리 범위 (가까이 1.4 = 나라 하나가 화면에 꽉 참, 멀리 5.2 = 지구 전체)
const MIN_DIST = 1.4;
const MAX_DIST = 5.2;

function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((lng + 180) * Math.PI) / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function pointInRing(x: number, y: number, ring: Position[]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

// 땅 점 좌표 계산 (한 번만, 모듈 캐시)
let landPointsCache: Float32Array | null = null;
function landPoints(): Float32Array {
    if (landPointsCache) return landPointsCache;
    const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>;
    const fc = feature(topo, topo.objects.land) as unknown as { type: string; features?: { geometry: Polygon | MultiPolygon }[]; geometry?: Polygon | MultiPolygon };
    const polys: { ring: Position[]; holes: Position[][]; bbox: [number, number, number, number] }[] = [];
    const push = (p: Polygon) => {
        const ring = p.coordinates[0];
        let minX = 180, minY = 90, maxX = -180, maxY = -90;
        for (const [x, y] of ring) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        polys.push({ ring, holes: p.coordinates.slice(1), bbox: [minX, minY, maxX, maxY] });
    };
    const geoms = fc.type === "FeatureCollection" ? (fc.features ?? []).map((f) => f.geometry) : [fc.geometry];
    for (const g of geoms) {
        if (!g) continue;
        if (g.type === "Polygon") push(g as Polygon);
        else if (g.type === "MultiPolygon") for (const c of (g as MultiPolygon).coordinates) push({ type: "Polygon", coordinates: c });
    }
    const pts: number[] = [];
    const step = 1.1;
    for (let lat = -58; lat <= 84; lat += step) {
        const lngStep = step / Math.max(Math.cos((lat * Math.PI) / 180), 0.15);
        for (let lng = -180; lng < 180; lng += lngStep) {
            let hit = false;
            for (const p of polys) {
                if (lng < p.bbox[0] || lng > p.bbox[2] || lat < p.bbox[1] || lat > p.bbox[3]) continue;
                if (pointInRing(lng, lat, p.ring) && !p.holes.some((h) => pointInRing(lng, lat, h))) {
                    hit = true;
                    break;
                }
            }
            if (hit) {
                const v = latLngToVec3(lat, lng, R * 1.002);
                pts.push(v.x, v.y, v.z);
            }
        }
    }
    landPointsCache = new Float32Array(pts);
    return landPointsCache;
}

// 국경선 + 해안선 (옅은 선). 한 번만 계산
let borderCache: Float32Array | null = null;
function borderSegments(): Float32Array {
    if (borderCache) return borderCache;
    const topo = countriesTopo as unknown as Topology<{ countries: GeometryCollection }>;
    const lines = mesh(topo, topo.objects.countries) as unknown as { coordinates: Position[][] };
    const pts: number[] = [];
    for (const line of lines.coordinates) {
        for (let i = 1; i < line.length; i++) {
            const a = latLngToVec3(line[i - 1][1], line[i - 1][0], R * 1.003);
            const b = latLngToVec3(line[i][1], line[i][0], R * 1.003);
            pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
    }
    borderCache = new Float32Array(pts);
    return borderCache;
}

// 얇은 고리 (물결용)
function ringTexture(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.strokeStyle = "rgba(255,255,255,1)";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(64, 64, 56, 0, Math.PI * 2);
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function glowTexture(): THREE.Texture {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(255,255,255,0.85)");
    g.addColorStop(0.45, "rgba(255,255,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// 캔버스 + 확대·축소 버튼. large 면 휠로도 확대 (작은 지구본은 페이지 스크롤을 막지 않게 ctrl+휠·손가락 벌리기만)
function GlobeCanvas({ lights, large, className, onExpand }: { lights: CityLight[]; large: boolean; className: string; onExpand?: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const zoomRef = useRef<((f: number) => void) | null>(null);
    const t = useT();

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        el.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
        camera.position.set(0, 0.35, 4.1);

        // 지구 본체
        const globe = new THREE.Mesh(
            new THREE.SphereGeometry(R, 64, 64),
            new THREE.MeshPhongMaterial({ color: 0x14204f, emissive: 0x080e2a, specular: 0x1a2a66, shininess: 8, transparent: true, opacity: 0.98 })
        );
        scene.add(globe);

        // 대기 번짐 (뒷면 프레넬)
        const atmo = new THREE.Mesh(
            new THREE.SphereGeometry(R * 1.09, 64, 64),
            new THREE.ShaderMaterial({
                side: THREE.FrontSide,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: { c: { value: new THREE.Color(0x6f8cff) } },
                vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = (modelViewMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * vec4(vP,1.0);} `,
                fragmentShader: `uniform vec3 c; varying vec3 vN; varying vec3 vP; void main(){ float d = clamp(dot(vN, normalize(-vP)), 0.0, 1.0); float f = pow(1.0 - d, 5.0) * 1.0; gl_FragColor = vec4(c, clamp(f, 0.0, 1.0) * 0.42); }`,
            })
        );
        scene.add(atmo);

        // 땅 점
        const landGeo = new THREE.BufferGeometry();
        landGeo.setAttribute("position", new THREE.BufferAttribute(landPoints(), 3));
        const land = new THREE.Points(landGeo, new THREE.PointsMaterial({ color: 0x8292d6, size: 0.013, sizeAttenuation: true, transparent: true, opacity: 0.95 }));
        scene.add(land);

        // 국경·해안선
        const borderGeo = new THREE.BufferGeometry();
        borderGeo.setAttribute("position", new THREE.BufferAttribute(borderSegments(), 3));
        scene.add(new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({ color: 0x9aa8e8, transparent: true, opacity: 0.28 })));

        // 나라 불빛 (많이 올수록 크게) + 바깥으로 퍼지는 물결 두 겹
        const tex = glowTexture();
        const ringTex = ringTexture();
        const maxCount = Math.max(1, ...lights.map((l) => l.count));
        const sprites: { s: THREE.Sprite; base: number; phase: number }[] = [];
        const ripples: { s: THREE.Sprite; base: number; phase: number }[] = [];
        const group = new THREE.Group();
        for (const l of lights) {
            const color = l.mine ? 0xff9bb3 : 0xffd86b;
            const base = 0.1 + 0.16 * (Math.log2(l.count + 1) / Math.log2(maxCount + 1));
            for (let k = 0; k < 2; k++) {
                const r = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
                r.position.copy(latLngToVec3(l.lat, l.lng, R * 1.008));
                group.add(r);
                ripples.push({ s: r, base, phase: k * 0.5 + Math.random() * 0.3 });
            }
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
            s.position.copy(latLngToVec3(l.lat, l.lng, R * 1.01));
            s.scale.setScalar(base);
            group.add(s);
            // 중심 점
            const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
            core.position.copy(latLngToVec3(l.lat, l.lng, R * 1.012));
            core.scale.setScalar(base * 0.28);
            group.add(core);
            sprites.push({ s, base, phase: Math.random() * Math.PI * 2 });
        }
        scene.add(group);

        // 배경 별
        const starN = 420;
        const starPos = new Float32Array(starN * 3);
        for (let i = 0; i < starN; i++) {
            const v = new THREE.Vector3().randomDirection().multiplyScalar(18 + Math.random() * 10);
            starPos.set([v.x, v.y, v.z], i * 3);
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
        scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff1c8, size: 0.08, transparent: true, opacity: 0.7 })));

        scene.add(new THREE.AmbientLight(0x8090c0, 1.1));
        const sun = new THREE.DirectionalLight(0xaabbff, 0.9);
        sun.position.set(-3, 2, 4);
        scene.add(sun);

        // 불빛들의 가운데가 정면에 오게 돌리고, 불빛이 한 지역에 모여 있으면 그만큼 가까이. 다만 주변 나라는 보이게 (너무 바짝 붙지 않게)
        let dist = 4.1;
        if (lights.length) {
            const sum = new THREE.Vector3();
            for (const l of lights) sum.add(latLngToVec3(l.lat, l.lng, 1));
            const center = sum.lengthSq() > 1e-6 ? sum.normalize() : latLngToVec3(lights[0].lat, lights[0].lng, 1);
            let spread = 0;
            for (const l of lights) spread = Math.max(spread, center.angleTo(latLngToVec3(l.lat, l.lng, 1)));
            // 퍼진 각도(라디안) → 카메라 거리. 한 나라 안이면 2.4, 1.2 이상이면 4.2. 크게 보기에선 조금 더 가까이
            dist = large ? THREE.MathUtils.clamp(2.0 + (spread / 1.2) * 1.6, 2.0, 3.6) : THREE.MathUtils.clamp(2.4 + (spread / 1.2) * 1.8, 2.4, 4.2);
            camera.position.copy(center.multiplyScalar(dist));
        }
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = true;
        controls.zoomSpeed = 0.7;
        controls.minDistance = MIN_DIST;
        controls.maxDistance = MAX_DIST;
        controls.enablePan = false;
        controls.rotateSpeed = 0.55;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
        controls.autoRotate = !reduce && dist > 3;
        controls.autoRotateSpeed = 0.5;
        let resumeAt = 0;
        // 버튼으로 누른 목표 거리 (프레임마다 부드럽게 다가감)
        let targetDist: number | null = null;
        const onStart = () => {
            controls.autoRotate = false;
            resumeAt = Infinity;
            targetDist = null;
        };
        const onEnd = () => {
            resumeAt = performance.now() + 4000;
        };
        controls.addEventListener("start", onStart);
        controls.addEventListener("end", onEnd);
        zoomRef.current = (f) => {
            const cur = targetDist ?? camera.position.length();
            targetDist = THREE.MathUtils.clamp(cur * f, MIN_DIST, MAX_DIST);
            controls.autoRotate = false;
            resumeAt = performance.now() + 4000;
        };
        // 작은 지구본 위에서 그냥 휠은 페이지 스크롤로 (ctrl/⌘+휠만 확대). 캔버스보다 먼저 받아서 OrbitControls 에 안 넘김
        const onWheel = (e: WheelEvent) => {
            if (!large && !e.ctrlKey && !e.metaKey) e.stopPropagation();
        };
        el.addEventListener("wheel", onWheel, { capture: true, passive: true });

        const resize = () => {
            // 크게 보기는 남는 공간 전체를 씀 (정사각형 틀에 잘리지 않게)
            const w = el.clientWidth;
            const h = large ? Math.max(1, el.clientHeight) : w;
            renderer.setSize(w, h, false);
            renderer.domElement.style.width = w + "px";
            renderer.domElement.style.height = h + "px";
            camera.aspect = w / h;
            // 세로로 긴 화면에선 지구가 좌우로 잘리지 않게 시야를 넓힘
            camera.fov = w < h ? (2 * Math.atan(Math.tan((38 * Math.PI) / 360) / (w / h)) * 180) / Math.PI : 38;
            camera.updateProjectionMatrix();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(el);

        let raf = 0;
        const tick = (now: number) => {
            if (targetDist != null) {
                const cur = camera.position.length();
                const next = cur + (targetDist - cur) * 0.14;
                camera.position.setLength(next);
                if (Math.abs(targetDist - next) < 0.003) targetDist = null;
            }
            // 멀리서 가만히 두면 천천히 돌고, 가까이 당겨 보는 중엔 안 돎
            if (!reduce && resumeAt !== Infinity && now > resumeAt) {
                controls.autoRotate = camera.position.length() > 3;
                resumeAt = Infinity;
            }
            for (const sp of sprites) {
                const k = reduce ? 1 : 1 + 0.18 * Math.sin(now * 0.0016 + sp.phase);
                sp.s.scale.setScalar(sp.base * k);
            }
            // 물결: 0→1 동안 커지며 옅어짐 (모션 줄임이면 안 보임)
            for (const rp of ripples) {
                const t = reduce ? 1 : (now * 0.00035 + rp.phase) % 1;
                rp.s.scale.setScalar(rp.base * (0.5 + 2.6 * t));
                (rp.s.material as THREE.SpriteMaterial).opacity = reduce ? 0 : 0.55 * (1 - t) * (1 - t);
            }
            controls.update();
            renderer.render(scene, camera);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            zoomRef.current = null;
            el.removeEventListener("wheel", onWheel, { capture: true });
            controls.removeEventListener("start", onStart);
            controls.removeEventListener("end", onEnd);
            controls.dispose();
            renderer.dispose();
            scene.traverse((o) => {
                const m = o as THREE.Mesh;
                if (m.geometry) m.geometry.dispose();
                const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
                if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
                else mat?.dispose();
            });
            tex.dispose();
            ringTex.dispose();
            if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
        };
    }, [lights, large]);

    const btn = "glass flex h-9 w-9 items-center justify-center rounded-full text-ink/90 hover:text-ink active:scale-95";
    return (
        <div className={`relative mx-auto w-full ${large ? "h-full" : "aspect-square"} ${className}`}>
            <div ref={ref} className="h-full w-full touch-none select-none" aria-label="globe" />
            {onExpand && (
                <button type="button" onClick={onExpand} aria-label={t("globe_expand")} title={t("globe_expand")} className={`absolute right-1 top-1 ${btn}`}>
                    <Maximize2 size={16} />
                </button>
            )}
            <div className={`absolute flex flex-col gap-1.5 ${large ? "bottom-3 right-3" : "bottom-1 right-1"}`}>
                <button type="button" onClick={() => zoomRef.current?.(0.72)} aria-label={t("globe_zoom_in")} title={t("globe_zoom_in")} className={btn}>
                    <Plus size={16} />
                </button>
                <button type="button" onClick={() => zoomRef.current?.(1 / 0.72)} aria-label={t("globe_zoom_out")} title={t("globe_zoom_out")} className={btn}>
                    <Minus size={16} />
                </button>
            </div>
        </div>
    );
}

function Legend({ t }: { t: ReturnType<typeof useT> }) {
    return (
        <p className="mt-1 flex items-center justify-center gap-2 text-[11px] text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-star shadow-[0_0_8px_#ffd86b]" />
            <span className="inline-block h-2 w-2 rounded-full bg-rose shadow-[0_0_8px_#ff9bb3]" />
            {t("globe_legend")}
        </p>
    );
}

// 밤의 지구본 + "크게 보기" (화면 가득한 지구본. 끌어 돌리기·손가락 벌리기·휠·버튼으로 확대)
export default function Globe({ lights }: { lights: CityLight[] }) {
    const t = useT();
    const [big, setBig] = useState(false);

    useEffect(() => {
        if (!big) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBig(false);
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [big]);

    return (
        <div>
            <GlobeCanvas lights={lights} large={false} className="max-w-[360px]" onExpand={() => setBig(true)} />
            {lights.length > 0 && <Legend t={t} />}
            <AnimatePresence>
                {big && (
                    <motion.div
                        role="dialog"
                        aria-modal
                        aria-label={t("globe_expand")}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex flex-col bg-night/95 backdrop-blur-sm"
                    >
                        <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
                            <h3 className="text-base font-semibold text-ink">{t("globe_expand")}</h3>
                            <button type="button" onClick={() => setBig(false)} aria-label={t("close")} className="glass flex h-10 w-10 items-center justify-center rounded-full text-ink">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1">
                            <GlobeCanvas lights={lights} large className="" />
                        </div>
                        <div className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
                            {lights.length > 0 && <Legend t={t} />}
                            <p className="mt-1 text-center text-[11px] text-dim">{t("globe_large_hint")}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
