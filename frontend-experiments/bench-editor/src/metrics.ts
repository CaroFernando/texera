// Timing helpers. Everything is measured with requestAnimationFrame timestamps,
// so the page (and the browser window) must stay visible while a run is going:
// hidden pages get throttled frames and meaningless numbers.

export const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));

export interface FrameStats {
  fps: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  /** Frames slower than 50ms: visible stutter. */
  longFrames: number;
}

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const round = (x: number) => Math.round(x * 10) / 10;

export function summarize(frameTimes: number[]): FrameStats {
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  return {
    fps: round(1000 / avg),
    avgMs: round(avg),
    p95Ms: round(percentile(frameTimes, 95)),
    maxMs: round(Math.max(...frameTimes)),
    longFrames: frameTimes.filter(t => t > 50).length,
  };
}

/** Calls `step(i)` once per frame for `frames` frames and records each frame's duration. */
export async function runFrames(frames: number, step: (i: number) => void): Promise<FrameStats> {
  const times: number[] = [];
  let prev = await nextFrame();
  for (let i = 0; i < frames; i++) {
    step(i);
    const now = await nextFrame();
    times.push(now - prev);
    prev = now;
  }
  return summarize(times);
}

/**
 * Waits until `count()` (DOM size of the canvas) stops changing for 15 frames and
 * returns the timestamp of the frame where it last changed: the moment rendering finished,
 * whether the library renders synchronously, in React commits or in async batches.
 */
export async function waitStable(count: () => number, timeoutMs: number): Promise<number> {
  const start = performance.now();
  let last = count();
  let lastChange = performance.now();
  let stable = 0;
  while (stable < 15) {
    await nextFrame();
    const c = count();
    if (c !== last) {
      last = c;
      lastChange = performance.now();
      stable = 0;
    } else {
      stable++;
    }
    if (performance.now() - start > timeoutMs) throw new Error(`render did not settle within ${timeoutMs / 1000}s`);
  }
  return lastChange;
}

/** Sum of (longtask - 50ms) while `fn` runs: Chrome's Total Blocking Time, i.e. how long input would be stuck. */
export async function withBlockingTime<T>(fn: () => Promise<T>): Promise<{ result: T; blockingMs: number }> {
  let blocking = 0;
  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver(list => {
      for (const e of list.getEntries()) blocking += Math.max(0, e.duration - 50);
    });
    observer.observe({ type: "longtask", buffered: false });
  } catch {
    observer = undefined; // longtask entries are Chromium-only
  }
  const result = await fn();
  await nextFrame();
  observer?.disconnect();
  return { result, blockingMs: Math.round(blocking) };
}

export interface FrameMemory {
  /** JS heap attributed to this frame (the run iframe only, not the suite page). */
  jsMB: number;
  /**
   * DOM memory (outside the JS heap). Chrome reports it unattributed, i.e. for the whole
   * page including the suite, so runs subtract a baseline taken before the canvas mounts.
   */
  domMB: number;
}

type MemoryBreakdown = {
  bytes: number;
  types: string[];
  attribution: { url?: string }[];
};

/**
 * Memory of this frame, split into JavaScript and DOM, via Chrome's
 * performance.measureUserAgentSpecificMemory(). Needs cross-origin isolation (see
 * vite.config.ts) and returns quickly only with --enable-blink-features=ForceEagerMeasureMemory
 * (set by scripts/run-headless.mjs); otherwise it waits for the browser's next GC.
 * Null where the API is unavailable (other browsers, non-isolated pages).
 */
export async function frameMemory(timeoutMs = 30_000): Promise<FrameMemory | null> {
  const perf = performance as unknown as {
    measureUserAgentSpecificMemory?: () => Promise<{ breakdown: MemoryBreakdown[] }>;
  };
  if (!crossOriginIsolated || !perf.measureUserAgentSpecificMemory) return null;
  (globalThis as unknown as { gc?: () => void }).gc?.();
  const result = await Promise.race([
    perf.measureUserAgentSpecificMemory(),
    new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  if (!result) return null;
  const here = location.href;
  let js = 0;
  let dom = 0;
  for (const entry of result.breakdown) {
    if (entry.types.includes("DOM")) dom += entry.bytes; // attributed or not (Chrome: not)
    else if (entry.types.includes("JavaScript") && entry.attribution.some(a => a.url === here)) js += entry.bytes;
  }
  return { jsMB: Math.round(js / 1e5) / 10, domMB: Math.round(dom / 1e5) / 10 };
}

/**
 * Samples the JS heap every frame, without forcing GC, and reports the peak: a measure
 * of allocation pressure while the user interacts (immutable React state updates
 * allocate new objects per change; JointJS mutates in place).
 */
export function startHeapSampler(): () => number | null {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  if (!mem) return () => null;
  let peak = mem.usedJSHeapSize;
  let running = true;
  const tick = () => {
    if (!running) return;
    peak = Math.max(peak, mem.usedJSHeapSize);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    running = false;
    return Math.round(peak / 1e5) / 10;
  };
}

export function heapMB(): number | null {
  // Collect garbage first when the browser allows it (--js-flags=--expose-gc), otherwise the
  // reading depends on when GC last ran.
  (globalThis as unknown as { gc?: () => void }).gc?.();
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return mem ? Math.round(mem.usedJSHeapSize / 1e5) / 10 : null;
}
