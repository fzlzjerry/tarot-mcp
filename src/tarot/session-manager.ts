import { TarotSession, TarotReading } from "./types.js";
import { getSecureRandom } from "./utils.js";

/**
 * Manages tarot reading sessions
 */
export class TarotSessionManager {
  private sessions: Map<string, TarotSession>;

  constructor() {
    this.sessions = new Map();
  }

  /**
   * Create a new session
   */
  public createSession(): TarotSession {
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
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const randomPart = Math.floor(getSecureRandom() * 1000000000).toString(36);
    return `session_${timestamp}_${randomPart}`;
  }

  /**
   * Get session count (for debugging/monitoring)
   */
  public getSessionCount(): number {
    return this.sessions.size;
  }
}
