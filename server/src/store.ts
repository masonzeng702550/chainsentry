import type { StoredReport } from './types';

/**
 * Storage abstraction so the same app logic runs on an in-memory store (tests /
 * local dev) or a durable backend (Cloudflare KV/D1, Postgres, ...) in production.
 */
export interface Store {
  addReport(report: StoredReport): Promise<void>;
  allReports(): Promise<StoredReport[]>;
  reportsByReporter(reporterId: string): Promise<StoredReport[]>;
  /** True if this reporter already flagged this target (idempotent re-reports). */
  hasReported(reporterId: string, target: string): Promise<boolean>;
}

export class MemoryStore implements Store {
  private reports: StoredReport[] = [];
  private seen = new Set<string>();

  async addReport(report: StoredReport): Promise<void> {
    const key = `${report.reporterId}|${report.target}`;
    if (this.seen.has(key)) return; // dedupe: one vote per reporter per target
    this.seen.add(key);
    this.reports.push(report);
  }

  async allReports(): Promise<StoredReport[]> {
    return this.reports;
  }

  async reportsByReporter(reporterId: string): Promise<StoredReport[]> {
    return this.reports.filter((r) => r.reporterId === reporterId);
  }

  async hasReported(reporterId: string, target: string): Promise<boolean> {
    return this.seen.has(`${reporterId}|${target}`);
  }

  /** Test helper. */
  size(): number {
    return this.reports.length;
  }
}
