import { TarotSession, TarotReading } from "../shared/types.js";
import { getSecureRandomInt } from "../shared/utils.js";

/**
 * Manages tarot reading sessions
 */
export class TarotSessionManager {
  private static readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly sweep
  /** Hard cap so anonymous/public traffic cannot grow memory without bound. */
  private static readonly MAX_SESSIONS = 1000;

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

    const sessionId = this.generateSessionId();
    const session: TarotSession = {
      id: sessionId,
      readings: [],
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
   * Add a reading to a session
   */
  public addReadingToSession(sessionId: string, reading: TarotReading): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.readings.push(reading);
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
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const randomPart = getSecureRandomInt(1000000000).toString(36);
    return `session_${timestamp}_${randomPart}`;
  }

  /**
   * Get session count (for debugging/monitoring)
   */
  public getSessionCount(): number {
    return this.sessions.size;
  }
}
