import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TarotSessionManager } from "../tarot/readings/session-manager.js";
import { TarotReading } from "../tarot/shared/types.js";

describe("session persistence (SESSION_STORE_PATH)", () => {
  let cardManager: TarotCardManager;
  let dir: string;
  let storePath: string;

  beforeAll(async () => {
    cardManager = await TarotCardManager.create();
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tarot-sessions-"));
    storePath = join(dir, "store", "sessions.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function sampleReading(sessionId: string): TarotReading {
    const card = cardManager.getAllCards()[0];
    return {
      id: "reading_test_1",
      spreadType: "single_card",
      question: "Will it persist?",
      cards: [{ card, orientation: "upright", position: "Message" }],
      interpretation: "irrelevant — summaries only",
      timestamp: new Date("2026-07-07T00:00:00.000Z"),
      sessionId,
    };
  }

  it("survives a restart: a new manager on the same path resolves the session", () => {
    const before = new TarotSessionManager(storePath);
    const session = before.createSession();
    before.addReadingToSession(session.id, sampleReading(session.id));

    // Simulates a process restart (fresh manager, same store file).
    const after = new TarotSessionManager(storePath);
    const restored = after.getSession(session.id);

    expect(restored).toBeDefined();
    expect(restored!.readingCount).toBe(1);
    expect(after.getSessionReadings(session.id)).toHaveLength(1);
    expect(after.getSessionReadings(session.id)[0].cards[0].name).toBe(
      cardManager.getAllCards()[0].name,
    );
    // Dates must be revived as Date instances, not ISO strings.
    expect(restored!.lastActivity).toBeInstanceOf(Date);
    expect(after.getSessionReadings(session.id)[0].timestamp).toBeInstanceOf(
      Date,
    );
  });

  it("drops sessions idle for more than 24 hours on load", () => {
    const manager = new TarotSessionManager(storePath);
    const fresh = manager.createSession();
    const stale = manager.createSession();

    const stored = JSON.parse(readFileSync(storePath, "utf8"));
    for (const entry of stored.sessions) {
      if (entry.id === stale.id) {
        entry.lastActivity = new Date(
          Date.now() - 25 * 60 * 60 * 1000,
        ).toISOString();
      }
    }
    writeFileSync(storePath, JSON.stringify(stored));

    const after = new TarotSessionManager(storePath);
    expect(after.getSession(fresh.id)).toBeDefined();
    expect(after.getSession(stale.id)).toBeUndefined();
  });

  it("starts empty on a corrupt store file without throwing", () => {
    const corruptPath = join(dir, "corrupt.json");
    writeFileSync(corruptPath, "not json at all {{{");

    const manager = new TarotSessionManager(corruptPath);
    expect(manager.getSessionCount()).toBe(0);
    // ...and stays usable, including write-through recovery of the file.
    const session = manager.createSession();
    expect(new TarotSessionManager(corruptPath).getSession(session.id)).toBeDefined();
  });

  it("skips malformed entries but keeps valid ones", () => {
    const manager = new TarotSessionManager(storePath);
    const good = manager.createSession();

    const stored = JSON.parse(readFileSync(storePath, "utf8"));
    stored.sessions.push({ id: 42, readings: "nope" });
    writeFileSync(storePath, JSON.stringify(stored));

    const after = new TarotSessionManager(storePath);
    expect(after.getSession(good.id)).toBeDefined();
    expect(after.getSessionCount()).toBe(1);
  });

  it("treats reads as activity so active sessions never rank oldest", () => {
    const manager = new TarotSessionManager();
    const session = manager.createSession();

    // Simulate a session that performed its reading long ago...
    session.lastActivity = new Date(Date.now() - 23 * 60 * 60 * 1000);
    const stale = session.lastActivity.getTime();

    // ...but is still being read: any lookup must refresh the idle clock,
    // protecting it from the 24h expiry and oldest-first cap eviction.
    manager.getSessionReadings(session.id);
    expect(session.lastActivity.getTime()).toBeGreaterThan(stale);

    manager.cleanupOldSessions();
    expect(manager.getSession(session.id)).toBeDefined();
  });

  it("writes nothing when no store path is configured", () => {
    const manager = new TarotSessionManager();
    manager.createSession();
    expect(existsSync(storePath)).toBe(false);
  });
});
