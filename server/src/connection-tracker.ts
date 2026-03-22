// ── Per-IP connection tracking for rate limiting ──

/** Tracks active WebSocket connections per IP address */
export class ConnectionTracker {
  private counts = new Map<string, number>();
  private maxPerIp: number;

  constructor(maxPerIp: number) {
    this.maxPerIp = maxPerIp;
  }

  /** Check if IP can accept a new connection */
  canConnect(ip: string): boolean {
    const count = this.counts.get(ip) ?? 0;
    return count < this.maxPerIp;
  }

  /** Register a new connection from IP */
  add(ip: string): void {
    const count = this.counts.get(ip) ?? 0;
    this.counts.set(ip, count + 1);
  }

  /** Unregister a connection from IP */
  remove(ip: string): void {
    const count = this.counts.get(ip) ?? 0;
    if (count <= 1) {
      this.counts.delete(ip);
    } else {
      this.counts.set(ip, count - 1);
    }
  }

  /** Get current connection count for an IP */
  getCount(ip: string): number {
    return this.counts.get(ip) ?? 0;
  }

  /** Get total active connections */
  get totalConnections(): number {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }
}
