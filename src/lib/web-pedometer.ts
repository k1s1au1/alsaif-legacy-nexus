/**
 * Web pedometer — counts steps in the browser using the device accelerometer
 * (DeviceMotionEvent). Works on mobile browsers; on iOS it requires a user
 * gesture to request motion permission.
 *
 * Algorithm: low-pass filtered acceleration magnitude + peak detection with
 * an adaptive threshold and a refractory period (min 280ms between steps).
 */

export type PedometerStatus = "unsupported" | "denied" | "running" | "idle";

const STORE_KEY = "web_pedometer_state_v1";

type Stored = { date: string; steps: number };

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

export function readStoredSteps(): number {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Stored;
    return parsed.date === today() ? Math.max(0, Math.round(parsed.steps)) : 0;
  } catch {
    return 0;
  }
}

function writeStoredSteps(steps: number) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ date: today(), steps } satisfies Stored));
  } catch {
    /* ignore */
  }
}

export function isMotionSupported() {
  return typeof window !== "undefined" && typeof (window as any).DeviceMotionEvent !== "undefined";
}

export async function requestMotionPermission(): Promise<boolean> {
  if (!isMotionSupported()) return false;
  const anyEvent = (window as any).DeviceMotionEvent;
  if (typeof anyEvent.requestPermission === "function") {
    try {
      const res = await anyEvent.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export class WebPedometer {
  private steps = 0;
  private filtered = 0;
  private lastStepAt = 0;
  private rising = false;
  private peak = 0;
  private threshold = 1.05; // m/s^2 above gravity-filtered baseline
  private listener: ((e: DeviceMotionEvent) => void) | null = null;
  private sawEvent = false;

  constructor(private onChange: (steps: number) => void) {
    this.steps = readStoredSteps();
  }

  get current() {
    return this.steps;
  }

  get receivingData() {
    return this.sawEvent;
  }

  start() {
    if (this.listener || !isMotionSupported()) return;
    this.listener = (e: DeviceMotionEvent) => this.handle(e);
    window.addEventListener("devicemotion", this.listener, { passive: true } as any);
  }

  stop() {
    if (this.listener) {
      window.removeEventListener("devicemotion", this.listener as any);
      this.listener = null;
    }
    writeStoredSteps(this.steps);
  }

  reset() {
    this.steps = 0;
    writeStoredSteps(0);
    this.onChange(0);
  }

  setSteps(value: number) {
    this.steps = Math.max(0, Math.round(value));
    writeStoredSteps(this.steps);
    this.onChange(this.steps);
  }

  private handle(e: DeviceMotionEvent) {
    const acc = e.accelerationIncludingGravity ?? e.acceleration;
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return;
    this.sawEvent = true;

    const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    // Low-pass filter to estimate the slow-moving baseline (gravity + posture).
    this.filtered = this.filtered === 0 ? magnitude : this.filtered * 0.9 + magnitude * 0.1;
    const delta = magnitude - this.filtered;
    const now = e.timeStamp || Date.now();

    if (delta > this.threshold) {
      this.rising = true;
      if (delta > this.peak) this.peak = delta;
    } else if (this.rising && delta < this.threshold * 0.4) {
      // Peak completed → candidate step.
      this.rising = false;
      this.peak = 0;
      if (now - this.lastStepAt > 280 && now - this.lastStepAt < 20000) {
        this.steps += 1;
        this.lastStepAt = now;
        writeStoredSteps(this.steps);
        this.onChange(this.steps);
      } else if (now - this.lastStepAt >= 20000) {
        // First movement after a long pause — start the cadence window.
        this.lastStepAt = now;
      }
    }
  }
}
