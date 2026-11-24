/** Sons curtos do caixa (gerados na hora, sem arquivos): acerto na leitura e erro. */
const KEY = "pdv-sound";
let ctx: AudioContext | null = null;

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* sem armazenamento: vale so ate fechar */
  }
}

function tone(freq: number, startAt: number, duration: number, volume: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startAt;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function play(notes: [number, number, number][]) {
  if (!isSoundEnabled()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    for (const [freq, at, dur] of notes) tone(freq, at, dur, 0.18);
  } catch {
    /* sem audio: segue sem som */
  }
}

/** Produto lido / adicionado. */
export const beepOk = () => play([[1320, 0, 0.07]]);

/** Produto nao encontrado, sem estoque etc. */
export const beepError = () =>
  play([
    [330, 0, 0.12],
    [220, 0.14, 0.18],
  ]);
