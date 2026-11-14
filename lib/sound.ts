"use client";
// 언덕 소리: 파일 없이 WebAudio 로 합성. 배경(잔잔한 화음·파도·모닥불·가끔 울리는 종) + 효과음(공감·새 별·별똥별·의식)
// 브라우저 자동재생 제한 때문에 start() 는 반드시 사용자 입력(터치·클릭·키) 안에서 불러야 함

export type Sfx = "empathy" | "empathyFar" | "born" | "meteor" | "daily" | "select" | "twinkle" | "lighthouse";

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

// 펜타토닉 (A 단조 느낌): 종소리·반짝임에 씀
const PENTA = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
// 배경 화음 진행 (Am → F → C → G), 낮게
const CHORDS: number[][] = [
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [196, 261.63, 329.63],
    [196, 246.94, 293.66],
];

export class Sound {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private bgm: GainNode | null = null;
    private running = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private nextChord = 0;
    private chordIdx = 0;
    private nextBell = 0;
    private nextCrackle = 0;
    private crackleGain: GainNode | null = null;
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
            this.master!.gain.linearRampToValueAtTime(0.8, now + 2.5);
            this.startBgm();
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
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        const bgm = this.bgm;
        this.bgm = null;
        setTimeout(() => {
            try {
                bgm?.disconnect();
            } catch {}
        }, 1500);
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
            // 갈색 소음 (낮은 쪽이 많아 파도 같음)
            const w = Math.random() * 2 - 1;
            last = (last + 0.02 * w) / 1.02;
            d[i] = last * 3.5;
        }
        return buf;
    }

    private startBgm() {
        const ctx = this.ctx!;
        const bgm = ctx.createGain();
        bgm.gain.value = 1;
        bgm.connect(this.master!);
        this.bgm = bgm;

        // 파도: 갈색 소음 → 저역 통과 → 아주 느린 LFO 로 밀려오고 물러남
        const waves = ctx.createBufferSource();
        waves.buffer = this.noise;
        waves.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 420;
        const wg = ctx.createGain();
        wg.gain.value = 0.16;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.09;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 0.1;
        lfo.connect(lfoG).connect(wg.gain);
        waves.connect(lp).connect(wg).connect(bgm);
        waves.start();
        lfo.start();

        // 모닥불: 백색 소음 → 고역 통과 → 짧은 터짐을 무작위로
        const fire = ctx.createBufferSource();
        fire.buffer = this.noise;
        fire.loop = true;
        fire.playbackRate.value = 2.5;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 1800;
        const cg = ctx.createGain();
        cg.gain.value = 0;
        const pan = ctx.createStereoPanner();
        pan.pan.value = -0.25;
        fire.connect(hp).connect(cg).connect(pan).connect(bgm);
        fire.start();
        this.crackleGain = cg;

        this.nextChord = ctx.currentTime + 0.3;
        this.nextBell = ctx.currentTime + 4;
        this.nextCrackle = ctx.currentTime + 0.5;
        this.schedule();
    }

    // 1초 앞을 미리 예약하는 스케줄러
    private schedule = () => {
        if (!this.running || !this.ctx || !this.bgm) return;
        const ctx = this.ctx;
        const until = ctx.currentTime + 1.2;
        while (this.nextChord < until) {
            this.playChord(CHORDS[this.chordIdx % CHORDS.length], this.nextChord, 9);
            this.chordIdx++;
            this.nextChord += 8;
        }
        while (this.nextBell < until) {
            const f = PENTA[Math.floor(Math.random() * PENTA.length)];
            this.bell(f, this.nextBell, 0.05 + Math.random() * 0.04, (Math.random() - 0.5) * 1.2, 2.2);
            this.nextBell += 3.5 + Math.random() * 6;
        }
        while (this.nextCrackle < until && this.crackleGain) {
            const g = this.crackleGain.gain;
            const a = 0.05 + Math.random() * 0.2;
            const d = 0.01 + Math.random() * 0.05;
            g.setValueAtTime(0, this.nextCrackle);
            g.linearRampToValueAtTime(a, this.nextCrackle + 0.004);
            g.exponentialRampToValueAtTime(0.0005, this.nextCrackle + d);
            this.nextCrackle += 0.06 + Math.random() * 0.35;
        }
        this.timer = setTimeout(this.schedule, 500);
    };

    private playChord(freqs: number[], at: number, dur: number) {
        const ctx = this.ctx!, out = this.bgm!;
        for (const f of freqs) {
            for (const det of [-3, 3]) {
                const o = ctx.createOscillator();
                o.type = "triangle";
                o.frequency.value = f;
                o.detune.value = det;
                const lp = ctx.createBiquadFilter();
                lp.type = "lowpass";
                lp.frequency.value = 520;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, at);
                g.gain.linearRampToValueAtTime(0.028, at + 2.8);
                g.gain.setValueAtTime(0.028, at + dur - 3.2);
                g.gain.linearRampToValueAtTime(0, at + dur);
                o.connect(lp).connect(g).connect(out);
                o.start(at);
                o.stop(at + dur + 0.1);
            }
        }
    }

    private bell(freq: number, at: number, vol: number, panV: number, decay: number, out: AudioNode | null = this.bgm) {
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
            case "select":
                this.bell(1174.66, now, 0.05, 0, 0.35, out);
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
