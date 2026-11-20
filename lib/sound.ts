"use client";
// 언덕 소리: 파일 없이 WebAudio 로 합성. 효과음(공감·새 별·별똥별·의식·반짝임) + 겨울엔 오르골 '고요한 밤'
// 예전 낮은 배경음은 폰 스피커에서 이상하게 들려 뺐음. 오르골은 높고 맑은 소리라 폰에서도 괜찮음
// 브라우저 자동재생 제한 때문에 start() 는 반드시 사용자 입력(터치·클릭·키) 안에서 불러야 함

export type Sfx = "empathy" | "empathyFar" | "born" | "meteor" | "daily" | "twinkle" | "lighthouse" | "lantern" | "lanternFar";

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

// 오르골: '고요한 밤'(그루버, 1818, 저작권 없음). [음(C장조 반음, 0 = 도), 8분음표 길이] — 실제 소리는 한 옥타브 위
const SILENT_NIGHT: [number, number][] = [
    [7, 1.5], [9, 0.5], [7, 1], [4, 3],
    [7, 1.5], [9, 0.5], [7, 1], [4, 3],
    [14, 2], [14, 1], [11, 3],
    [12, 2], [12, 1], [7, 3],
    [9, 2], [9, 1], [12, 1.5], [11, 0.5], [9, 1],
    [7, 1.5], [9, 0.5], [7, 1], [4, 3],
    [9, 2], [9, 1], [12, 1.5], [11, 0.5], [9, 1],
    [7, 1.5], [9, 0.5], [7, 1], [4, 3],
    [14, 2], [14, 1], [17, 1.5], [14, 0.5], [11, 1],
    [12, 3], [16, 3],
    [12, 1], [7, 1], [4, 1], [7, 1.5], [5, 0.5], [2, 1],
    [0, 6],
];
// 마디(6/8)마다 낮은 반주 근음 (반음)
const SN_BASS = [0, 0, 7, 0, 5, 0, 5, 0, 7, 0, 0, 0];
const EIGHTH = 0.34; // 8분음표 길이(초)
const SN_REST = 5; // 한 번 끝나고 쉬는 시간(초)
type Note = { at: number; f: number; v: number; d: number };
const SONG: Note[] = (() => {
    const notes: Note[] = [];
    const hz = (semi: number, oct: number) => 261.63 * Math.pow(2, semi / 12 + oct);
    let t = 0;
    for (const [n, len] of SILENT_NIGHT) {
        notes.push({ at: t * EIGHTH, f: hz(n, 1), v: 0.11, d: 1.8 });
        t += len;
    }
    SN_BASS.forEach((b, bar) => {
        notes.push({ at: bar * 6 * EIGHTH, f: hz(b, 0), v: 0.05, d: 2.2 });
        notes.push({ at: (bar * 6 + 3) * EIGHTH, f: hz(b + 7, 0), v: 0.035, d: 1.8 });
    });
    return notes.sort((a, b) => a.at - b.at);
})();
const SONG_LEN = 12 * 6 * EIGHTH + SN_REST;

export class Sound {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private running = false;
    private noise: AudioBuffer | null = null;
    private lastSfx = new Map<Sfx, number>();
    private musicWanted = false;
    private music: { gain: GainNode; timer: ReturnType<typeof setInterval>; t0: number; i: number } | null = null;
    private musicLevel = 0.5; // 0~1. 트리에 가까울수록 큼

    get on(): boolean {
        return this.running;
    }

    // 실제로 소리가 나는 상태인지 (브라우저가 막으면 suspended 로 남음)
    get audible(): boolean {
        return this.running && !!this.ctx && this.ctx.state === "running";
    }

    // 막혀 있으면 다시 깨움. 사용자 입력 안에서 부를 것. 소리가 나는 상태가 되면 true
    async resume(): Promise<boolean> {
        if (!this.ctx) return false;
        try {
            if (this.ctx.state !== "running") await this.ctx.resume();
        } catch {
            /* 무시 */
        }
        return this.ctx.state === "running";
    }

    // 사용자 입력 안에서 호출
    start() {
        if (this.running) {
            void this.resume();
            return;
        }
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
            if (this.musicWanted) this.startMusic();
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
        this.stopMusic();
    }

    // 오르골 배경음을 틀지 (겨울에만 켬). 소리가 켜져 있을 때만 실제로 남
    setMusic(want: boolean) {
        this.musicWanted = want;
        if (want && this.running) this.startMusic();
        if (!want) this.stopMusic();
    }

    // 트리와의 거리(월드)로 오르골 크기. 멀면 작게 깔리고 트리 옆이면 또렷하게
    setMusicNear(dist: number | null) {
        const k = dist == null ? 0.4 : Math.max(0, Math.min(1, 1 - (dist - 1.5) / 8));
        if (Math.abs(k - this.musicLevel) < 0.02) return;
        this.musicLevel = k;
        if (this.music && this.ctx) this.music.gain.gain.setTargetAtTime(this.musicGain(), this.ctx.currentTime, 0.6);
    }

    private musicGain() {
        return 0.35 + 0.65 * this.musicLevel;
    }

    private startMusic() {
        if (this.music || !this.ctx || !this.master) return;
        const ctx = this.ctx;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(this.musicGain(), ctx.currentTime + 3);
        gain.connect(this.master);
        const m = { gain, timer: 0 as unknown as ReturnType<typeof setInterval>, t0: ctx.currentTime + 1.5, i: 0 };
        // 1초 앞까지 미리 예약 (화면 숨기면 ctx 가 멈춰 시간도 멈춤)
        const tick = () => {
            const now = ctx.currentTime;
            for (;;) {
                const n = SONG[m.i % SONG.length];
                const at = m.t0 + Math.floor(m.i / SONG.length) * SONG_LEN + n.at;
                if (at > now + 1) break;
                if (at > now - 0.05) this.bell(n.f, at, n.v, 0, n.d, gain);
                m.i++;
            }
        };
        tick();
        m.timer = setInterval(tick, 250);
        this.music = m;
    }

    private stopMusic() {
        const m = this.music;
        if (!m || !this.ctx) return;
        this.music = null;
        clearInterval(m.timer);
        const now = this.ctx.currentTime;
        m.gain.gain.cancelScheduledValues(now);
        m.gain.gain.setValueAtTime(m.gain.gain.value, now);
        m.gain.gain.linearRampToValueAtTime(0, now + 1.2);
        setTimeout(() => m.gain.disconnect(), 3000);
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
        const ctx = this.ctx!,
            out = this.master!;
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
        const ctx = this.ctx,
            now = ctx.currentTime;
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
            case "lantern": // 풍등 띄우기: 낮은 바람 + 두 음
                this.whoosh(now, 0.05, 300, 1800, 1.4);
                this.bell(523.25, now + 0.3, 0.1, -0.1, 2.2, out);
                this.bell(783.99, now + 0.55, 0.08, 0.1, 2.6, out);
                break;
            case "lanternFar": // 남의 풍등: 멀리서 작게
                this.bell(523.25, now, 0.035, (Math.random() - 0.5) * 1.2, 2.0, out);
                this.bell(783.99, now + 0.25, 0.03, (Math.random() - 0.5) * 1.2, 2.4, out);
                break;
        }
    }
}
