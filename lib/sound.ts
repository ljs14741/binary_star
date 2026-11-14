"use client";
// 언덕 소리: 파일 없이 WebAudio 로 합성. 효과음만(공감·새 별·별똥별·의식·반짝임). 배경음은 폰 스피커에서 이상하게 들려 뺌
// 브라우저 자동재생 제한 때문에 start() 는 반드시 사용자 입력(터치·클릭·키) 안에서 불러야 함

export type Sfx = "empathy" | "empathyFar" | "born" | "meteor" | "daily" | "twinkle" | "lighthouse";

const PREF_KEY = "star_sound";

export function soundPref(): boolean {
    try {
        return localStorage.getItem(PREF_KEY) !== "off";
    } catch {
        return true;
    }
}
export function setSoundPref(on: boolean) {
    try {
        localStorage.setItem(PREF_KEY, on ? "on" : "off");
    } catch {}
}

// 펜타토닉 (A 단조 느낌): 반짝임에 씀
const PENTA = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

export class Sound {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private running = false;
    private noise: AudioBuffer | null = null;
    private lastSfx = new Map<Sfx, number>();

    get on(): boolean {
        return this.running;
    }

    // 사용자 입력 안에서 호출
    start() {
        if (this.running) return;
        try {
            if (!this.ctx) {
                const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (!AC) return;
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                this.master.gain.value = 0;
                this.master.connect(this.ctx.destination);
                this.noise = this.makeNoise();
            }
            void this.ctx.resume();
            this.running = true;
            const now = this.ctx.currentTime;
            this.master!.gain.cancelScheduledValues(now);
            this.master!.gain.setValueAtTime(this.master!.gain.value, now);
            this.master!.gain.linearRampToValueAtTime(0.8, now + 1.2);
        } catch {
            this.running = false;
        }
    }

    stop() {
        if (!this.running || !this.ctx || !this.master) return;
        this.running = false;
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setValueAtTime(this.master.gain.value, now);
        this.master.gain.linearRampToValueAtTime(0, now + 1.2);
    }

    // 화면 숨길 때 잠깐 멈춤
    setHidden(hidden: boolean) {
        if (!this.ctx || !this.running) return;
        if (hidden) void this.ctx.suspend();
        else void this.ctx.resume();
    }

    private makeNoise(): AudioBuffer {
        const ctx = this.ctx!;
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
            // 갈색 소음 (별똥별 바람 소리에 씀)
            const w = Math.random() * 2 - 1;
            last = (last + 0.02 * w) / 1.02;
            d[i] = last * 3.5;
        }
        return buf;
    }

    private bell(freq: number, at: number, vol: number, panV: number, decay: number, out: AudioNode | null = this.master) {
        const ctx = this.ctx!;
        if (!out) return;
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        const o2 = ctx.createOscillator();
        o2.type = "sine";
        o2.frequency.value = freq * 2.01;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(vol, at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0005, at + decay);
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, panV));
        o.connect(g);
        o2.connect(g2).connect(g);
        g.connect(pan).connect(out);
        o.start(at);
        o2.start(at);
        o.stop(at + decay + 0.1);
        o2.stop(at + decay + 0.1);
    }

    private whoosh(at: number, vol: number, from: number, to: number, dur: number) {
        const ctx = this.ctx!, out = this.master!;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.playbackRate.value = 3;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(from, at);
        bp.frequency.exponentialRampToValueAtTime(to, at + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(vol, at + dur * 0.3);
        g.gain.linearRampToValueAtTime(0, at + dur);
        src.connect(bp).connect(g).connect(out);
        src.start(at);
        src.stop(at + dur + 0.05);
    }

    sfx(name: Sfx) {
        if (!this.running || !this.ctx || !this.master) return;
        const ctx = this.ctx, now = ctx.currentTime;
        // 같은 소리 너무 잦으면 건너뜀
        const minGap = name === "twinkle" ? 1.5 : name === "meteor" ? 1 : 0.12;
        if (now - (this.lastSfx.get(name) ?? -10) < minGap) return;
        this.lastSfx.set(name, now);
        const out = this.master;
        switch (name) {
            case "empathy":
                this.bell(659.25, now, 0.16, 0, 0.9, out);
                this.bell(880, now + 0.11, 0.16, 0.1, 1.3, out);
                break;
            case "empathyFar":
                this.bell(659.25, now, 0.05, (Math.random() - 0.5) * 1.4, 0.8, out);
                this.bell(880, now + 0.11, 0.05, (Math.random() - 0.5) * 1.4, 1.1, out);
                break;
            case "born":
                [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.bell(f, now + i * 0.085, 0.12 - i * 0.012, (i - 2) * 0.2, 1.6, out));
                this.whoosh(now, 0.05, 900, 3500, 0.7);
                break;
            case "meteor":
                this.whoosh(now, 0.06, 3200, 500, 0.6);
                break;
            case "daily":
                this.whoosh(now, 0.12, 400, 4000, 1.6);
                [440, 554.37, 659.25, 880].forEach((f, i) => this.bell(f, now + 1.2 + i * 0.12, 0.14, (i - 1.5) * 0.3, 3.2, out));
                this.bell(1760, now + 1.9, 0.07, 0, 3.5, out);
                break;
            case "twinkle":
                this.bell(PENTA[4 + Math.floor(Math.random() * 4)], now, 0.035, (Math.random() - 0.5) * 0.8, 1.4, out);
                break;
            case "lighthouse":
                this.bell(174.61, now, 0.03, 0.5, 2.5, out);
                break;
        }
    }
}
