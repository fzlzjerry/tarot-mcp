import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname } from "path";
import { TarotSession, TarotReading, TarotReadingSummary } from "../shared/types.js";
import { generateId } from "../shared/utils.js";
import { logger } from "../shared/logger.js";

/** JSON shape persisted to the session store file. */
interface SessionStoreFile {
  version: 1;
  sessions: Array<{
    id: string;
    readings: Array<Omit<TarotReadingSummary, "timestamp"> & { timestamp: string }>;
    readingCount: number;
    createdAt: string;
    lastActivity: string;
  }>;
}

/**
 * Manages tarot reading sessions.
 *
 * Sessions live in memory; when a `storePath` is provided (wired from the
 * SESSION_STORE_PATH env var) every mutation is also written through to a
 * JSON file so sessions survive process restarts and redeploys — without it,
 * a restart silently invalidates every sessionId previously handed to
 * clients. Store I/O is best-effort: a missing or corrupt file starts the
 * manager empty, and write failures are logged but never break a reading.
 */
export class TarotSessionManager {
  private static readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly sweep
  private static readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  /** Hard cap so anonymous/public traffic cannot grow memory without bound. */
  private static readonly MAX_SESSIONS = 1000;
  /** Oldest readings are evicted beyond this per-session cap. */
  private static readonly MAX_READINGS_PER_SESSION = 30;

  private sessions: Map<string, TarotSession>;
  private readonly storePath?: string;

  constructor(storePath?: string) {
    this.sessions = new Map();
    this.storePath = storePath || undefined;
    if (this.storePath) {
      this.loadFromStore();
    }
    // Periodically drop sessions idle for >24h; unref so the timer never
    // keeps the process alive (stdio transport must exit when stdin closes).
    setInterval(
      () => this.cleanupOldSessions(),
      TarotSessionManager.CLEANUP_INTERVAL_MS,
    ).unref();
  }

  /**
   * Create a new session
   */
  public createSession(): TarotSession {
    if (this.sessions.size >= TarotSessionManager.MAX_SESSIONS) {
      this.evictOldestSession();
    }

    const sessionId = generateId("session");
    const session: TarotSession = {
      id: sessionId,
      readings: [],
      readingCount: 0,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, session);
    this.saveToStore();
    return session;
  }

  /**
   * Get an existing session. Any successful lookup counts as activity:
   * a session being actively read (e.g. history polling) must neither hit
   * the 24h idle expiry nor rank as the oldest eviction victim.
   */
  public getSession(sessionId: string): TarotSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      this.saveToStore();
    }
    return session;
  }

  /**
   * Add a reading to a session, evicting the oldest reading once the
   * per-session cap is reached. Only a summary is retained — the full
   * interpretation prose is not kept in memory.
   */
  public addReadingToSession(sessionId: string, reading: TarotReading): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.readings.push({
        id: reading.id,
        spreadType: reading.spreadType,
        question: reading.question,
        timestamp: reading.timestamp,
        cards: reading.cards.map((drawnCard) => ({
          name: drawnCard.card.name,
          orientation: drawnCard.orientation,
          position: drawnCard.position,
        })),
      });
      session.readingCount++;
      if (session.readings.length > TarotSessionManager.MAX_READINGS_PER_SESSION) {
        session.readings.shift();
      }
      session.lastActivity = new Date();
      this.saveToStore();
    }
  }

  /**
   * Get all stored reading summaries from a session
   */
  public getSessionReadings(sessionId: string): TarotReadingSummary[] {
    const session = this.getSession(sessionId);
    return session ? session.readings : [];
  }

  /**
   * Total readings ever performed in a session (monotonic; unaffected by
   * eviction of old readings).
   */
  public getSessionReadingCount(sessionId: string): number {
    return this.getSession(sessionId)?.readingCount ?? 0;
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  public cleanupOldSessions(): void {
    const cutoffTime = new Date(
      Date.now() - TarotSessionManager.SESSION_TTL_MS,
    );

    let removed = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoffTime) {
        this.sessions.delete(sessionId);
        removed++;
      }
    }
    if (removed > 0) {
      this.saveToStore();
    }
  }

  /**
   * Evict the session with the oldest activity to make room for a new one.
   */
  private evictOldestSession(): void {
    let oldestId: string | undefined;
    let oldestActivity = Infinity;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity.getTime() < oldestActivity) {
        oldestActivity = session.lastActivity.getTime();
        oldestId = sessionId;
      }
    }
    if (oldestId !== undefined) {
      this.sessions.delete(oldestId);
    }
  }

  /**
   * Get session count (for debugging/monitoring)
   */
  public getSessionCount(): number {
    return this.sessions.size;
  }

  /** Load persisted sessions, skipping expired or malformed entries. */
  private loadFromStore(): void {
    let raw: string;
    try {
      raw = readFileSync(this.storePath!, "utf8");
    } catch {
      return; // no store yet — first boot
    }

    try {
      const parsed = JSON.parse(raw) as SessionStoreFile;
      if (!Array.isArray(parsed.sessions)) {
        throw new Error("sessions is not an array");
      }
      const cutoff = Date.now() - TarotSessionManager.SESSION_TTL_MS;
      for (const stored of parsed.sessions) {
        if (
          typeof stored.id !== "string" ||
          !Array.isArray(stored.readings) ||
          this.sessions.size >= TarotSessionManager.MAX_SESSIONS
        ) {
          continue;
        }
        const lastActivity = new Date(stored.lastActivity);
        if (!(lastActivity.getTime() > cutoff)) {
          continue; // expired or invalid date
        }
        this.sessions.set(stored.id, {
          id: stored.id,
          readings: stored.readings.map((reading) => ({
            ...reading,
            timestamp: new Date(reading.timestamp),
          })),
          readingCount: stored.readingCount ?? stored.readings.length,
          createdAt: new Date(stored.createdAt),
          lastActivity,
        });
      }
      logger.info("session_store_loaded", {
        path: this.storePath,
        sessions: this.sessions.size,
      });
    } catch (error) {
      logger.warn("session_store_load_failed", {
        path: this.storePath,
        error: error instanceof Error ? error.message : String(error),
      });
      this.sessions.clear();
    }
  }

  /** Write-through persistence: atomic tmp+rename, never throws. */
  private saveToStore(): void {
    if (!this.storePath) {
      return;
    }
    try {
      const payload: SessionStoreFile = {
        version: 1,
        sessions: [...this.sessions.values()].map((session) => ({
          id: session.id,
          readings: session.readings.map((reading) => ({
            ...reading,
            timestamp: reading.timestamp.toISOString(),
          })),
          readingCount: session.readingCount,
          createdAt: session.createdAt.toISOString(),
          lastActivity: session.lastActivity.toISOString(),
        })),
      };
      mkdirSync(dirname(this.storePath), { recursive: true });
      const tmpPath = `${this.storePath}.tmp`;
      writeFileSync(tmpPath, JSON.stringify(payload));
      renameSync(tmpPath, this.storePath);
    } catch (error) {
      logger.warn("session_store_save_failed", {
        path: this.storePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
