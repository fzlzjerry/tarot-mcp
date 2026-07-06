import { TarotSession, TarotReading } from "../shared/types.js";
import { generateId } from "../shared/utils.js";

/**
 * Manages tarot reading sessions
 */
export class TarotSessionManager {
  private static readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly sweep
  /** Hard cap so anonymous/public traffic cannot grow memory without bound. */
  private static readonly MAX_SESSIONS = 1000;
  /** Oldest readings are evicted beyond this per-session cap. */
  private static readonly MAX_READINGS_PER_SESSION = 30;

  private sessions: Map<string, TarotSession>;

  constructor() {
    this.sessions = new Map();
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
    return session;
  }

  /**
   * Get an existing session
   */
  public getSession(sessionId: string): TarotSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Add a reading to a session, evicting the oldest reading once the
   * per-session cap is reached.
   */
  public addReadingToSession(sessionId: string, reading: TarotReading): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.readings.push(reading);
      session.readingCount++;
      if (session.readings.length > TarotSessionManager.MAX_READINGS_PER_SESSION) {
        session.readings.shift();
      }
      session.lastActivity = new Date();
    }
  }

  /**
   * Get all readings from a session
   */
  public getSessionReadings(sessionId: string): TarotReading[] {
    const session = this.sessions.get(sessionId);
    return session ? session.readings : [];
  }

  /**
   * Total readings ever performed in a session (monotonic; unaffected by
   * eviction of old readings).
   */
  public getSessionReadingCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.readingCount ?? 0;
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  public cleanupOldSessions(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoffTime) {
        this.sessions.delete(sessionId);
      }
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
}
