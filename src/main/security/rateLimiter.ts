export class SlidingWindowRateLimiter {
  private readonly calls = new Map<string, number[]>();

  constructor(
    private readonly maximumCalls: number,
    private readonly windowMs: number,
  ) {}

  assertAllowed(key: string): void {
    const now = Date.now();
    const recent = (this.calls.get(key) ?? []).filter((timestamp) => now - timestamp < this.windowMs);
    if (recent.length >= this.maximumCalls) {
      throw new Error("Too many requests. Wait a moment and try again.");
    }
    recent.push(now);
    this.calls.set(key, recent);
  }
}
