/**
 * محرك مؤثرات صوتية خفيف لميدان الألعاب.
 * كل الأصوات مولّدة عبر Web Audio بدون أي ملفات صوتية، فلا تأخير ولا تحميل.
 */

export type GameSfx =
  | "turn"
  | "move"
  | "deal"
  | "flip"
  | "play"
  | "shuffle"
  | "draw"
  | "win"
  | "lose"
  | "error"
  | "coin"
  | "tick";

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone(
  ctx: AudioContext,
  options: {
    from: number;
    to?: number;
    at?: number;
    duration?: number;
    type?: OscillatorType;
    gain?: number;
  },
) {
  const { from, to = from, at = 0, duration = 0.15, type = "sine", gain = 0.07 } = options;
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** ضجيج قصير لمحاكاة انزلاق الورق على الطاولة */
function swish(ctx: AudioContext, at = 0, duration = 0.16, gain = 0.09, highpass = 1400) {
  const start = ctx.currentTime + at;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    const fade = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * fade * fade;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

export function playGameSfx(kind: GameSfx) {
  try {
    const ctx = audio();
    if (!ctx) return;
    switch (kind) {
      case "turn":
        tone(ctx, { from: 520, to: 780, duration: 0.16, type: "sine", gain: 0.075 });
        tone(ctx, { from: 780, to: 1040, at: 0.1, duration: 0.14, type: "sine", gain: 0.045 });
        break;
      case "move":
        tone(ctx, { from: 360, to: 480, duration: 0.14, type: "triangle", gain: 0.06 });
        break;
      case "deal":
        swish(ctx, 0, 0.13, 0.075, 1800);
        tone(ctx, { from: 240, to: 180, duration: 0.08, type: "triangle", gain: 0.035 });
        break;
      case "flip":
        swish(ctx, 0, 0.1, 0.06, 2400);
        break;
      case "play":
        swish(ctx, 0, 0.12, 0.07, 1600);
        tone(ctx, { from: 620, to: 420, duration: 0.12, type: "triangle", gain: 0.05 });
        break;
      case "shuffle":
        for (let i = 0; i < 5; i += 1) swish(ctx, i * 0.075, 0.08, 0.055, 2000);
        break;
      case "draw":
        swish(ctx, 0, 0.15, 0.07, 1200);
        tone(ctx, { from: 300, to: 520, duration: 0.14, type: "sine", gain: 0.04 });
        break;
      case "win":
        [523, 659, 784, 1046].forEach((freq, index) =>
          tone(ctx, { from: freq, at: index * 0.11, duration: 0.32, type: "sine", gain: 0.085 }),
        );
        break;
      case "lose":
        tone(ctx, { from: 420, to: 190, duration: 0.5, type: "sawtooth", gain: 0.06 });
        break;
      case "error":
        tone(ctx, { from: 220, to: 150, duration: 0.22, type: "square", gain: 0.05 });
        break;
      case "coin":
        tone(ctx, { from: 1180, duration: 0.09, type: "square", gain: 0.045 });
        tone(ctx, { from: 1560, at: 0.07, duration: 0.14, type: "square", gain: 0.04 });
        break;
      case "tick":
        tone(ctx, { from: 900, duration: 0.045, type: "square", gain: 0.03 });
        break;
    }
  } catch {
    // الصوت إضافي دائمًا ولا يجوز أن يعطل اللعب.
  }
}
