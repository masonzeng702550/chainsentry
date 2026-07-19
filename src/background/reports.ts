import type { ScamReport } from '@/shared/messages';
import { getSettings } from './storage';
import { markScamAddress } from './entities';

const QUEUE_KEY = 'reportQueue';
const MAX_QUEUE = 500;

async function readQueue(): Promise<ScamReport[]> {
  const { [QUEUE_KEY]: q } = await chrome.storage.local.get(QUEUE_KEY);
  return (q as ScamReport[]) ?? [];
}

async function writeQueue(q: ScamReport[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: q.slice(-MAX_QUEUE) });
}

/**
 * Record a user scam report. Applies it locally immediately (so the reporter is
 * protected right away), queues it, and best-effort POSTs to a configured endpoint.
 * With no endpoint configured it stays a local-only signal.
 */
export async function submitReport(report: ScamReport): Promise<{ queued: number; sent: boolean }> {
  if (report.kind === 'address' && report.chain && report.address) {
    markScamAddress(report.chain, report.address);
  }

  const queue = await readQueue();
  queue.push(report);
  await writeQueue(queue);

  const { reportEndpoint } = await getSettings();
  let sent = false;
  if (reportEndpoint) {
    try {
      const res = await fetch(reportEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(report),
        signal: AbortSignal.timeout(10_000),
      });
      sent = res.ok;
    } catch {
      sent = false; // stays queued for a later flush
    }
  }
  return { queued: queue.length, sent };
}

/** Retry sending any queued reports (called on alarm). */
export async function flushReports(): Promise<void> {
  const { reportEndpoint } = await getSettings();
  if (!reportEndpoint) return;
  const queue = await readQueue();
  if (!queue.length) return;
  const remaining: ScamReport[] = [];
  for (const rep of queue) {
    try {
      const res = await fetch(reportEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(rep),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) remaining.push(rep);
    } catch {
      remaining.push(rep);
    }
  }
  await writeQueue(remaining);
}
