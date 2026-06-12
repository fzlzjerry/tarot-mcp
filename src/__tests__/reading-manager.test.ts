import fs from "node:fs";
import { TarotCardManager } from "../tarot/cards/card-manager.js";
import { TarotReadingManager } from "../tarot/readings/reading-manager.js";
import { TarotSessionManager } from "../tarot/readings/session-manager.js";

describe('TarotReadingManager', () => {
  let cardManager: TarotCardManager;
  let sessionManager: TarotSessionManager;
  let readingManager: TarotReadingManager;

  beforeEach(async () => {
    cardManager = await TarotCardManager.create();
    sessionManager = new TarotSessionManager();
    readingManager = new TarotReadingManager(cardManager, sessionManager);
  });

  describe('performReading', () => {
    it('should perform a single card reading successfully', () => {
      const result = readingManager.performReading('single_card', 'What should I focus on today?');

      expect(result).toContain('# Single Card Reading');
      expect(result).toContain('What should I focus on today?');
      expect(result).toContain('### 1. The Message');
      expect(result).toContain('## Interpretation');
    });

    it('should perform a three card reading successfully', () => {
      const result = readingManager.performReading('three_card', 'What about my career?');

      expect(result).toContain('# Three Card Spread Reading');
      expect(result).toContain('What about my career?');
      expect(result).toContain('Past/Situation');
      expect(result).toContain('Present/Action');
      expect(result).toContain('Future/Outcome');
      expect(result).toContain('## Interpretation');
    });

    it('should perform a Celtic Cross reading successfully', () => {
      const result = readingManager.performReading('celtic_cross', 'Complete life guidance');

      expect(result).toContain('# Celtic Cross Reading');
      expect(result).toContain('Complete life guidance');
      expect(result).toContain('Present Situation');
      expect(result).toContain('Challenge/Cross');
      expect(result).toContain('Distant Past/Foundation');
      expect(result).toContain('Possible Outcome');
      expect(result).toContain('## Interpretation');
    });

    it('should return error message for invalid spread type', () => {
      const result = readingManager.performReading('invalid_spread', 'Test question');

      expect(result).toContain('Invalid spread type: invalid_spread');
      expect(result).toContain('Use list_available_spreads');
    });

    it('should include session ID when provided', () => {
      const sessionId = sessionManager.createSession().id;
      const result = readingManager.performReading('single_card', 'Test question', sessionId);

      expect(result).toContain('# Single Card Reading');
      expect(result).toContain('Test question');

      // Verify reading was added to session
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.readings).toHaveLength(1);
      expect(session?.readings[0].question).toBe('Test question');
    });

    it('should generate different readings for the same question', () => {
      const question = 'What should I know?';
      const extractCards = (reading: string): string[] =>
        [...reading.matchAll(/\*\*(.+)\*\* \((upright|reversed)\)/g)].map(
          (match) => `${match[1]}|${match[2]}`,
        );

      // Compare the drawn cards themselves (not the whole text, which always
      // differs via reading/session IDs). Two independent 10-card draws with
      // orientations colliding is astronomically unlikely.
      const cards1 = extractCards(readingManager.performReading('celtic_cross', question));
      const cards2 = extractCards(readingManager.performReading('celtic_cross', question));

      expect(cards1).toHaveLength(10);
      expect(cards2).toHaveLength(10);
      expect(cards1).not.toEqual(cards2);
    });

    it('should handle complex questions with special characters', () => {
      const complexQuestion = 'What about love & relationships? (Is there hope?)';
      const result = readingManager.performReading('three_card', complexQuestion);

      expect(result).toContain('# Three Card Spread Reading');
      expect(result).toContain(complexQuestion);
      expect(result).toContain('## Interpretation');
    });

    it('should work with all available spread types', () => {
      const spreads = [
        'single_card',
        'three_card',
        'celtic_cross',
        'horseshoe',
        'relationship_cross',
        'career_path',
        'decision_making',
        'spiritual_guidance'
      ];

      spreads.forEach(spreadType => {
        const result = readingManager.performReading(spreadType, `Test question for ${spreadType}`);
        expect(result).toContain('Reading');
        expect(result).toContain('## Interpretation');
        expect(result).not.toContain('Invalid spread type');
      });
    });
  });

  describe('listAvailableSpreads', () => {
    it('should list all available spreads', () => {
      const result = readingManager.listAvailableSpreads();

      expect(result).toContain('# Available Tarot Spreads');
      expect(result).toContain('## Single Card');
      expect(result).toContain('## Three Card');
      expect(result).toContain('## Celtic Cross');
      expect(result).toContain('**Positions:**');
      expect(result).toContain('Use the `perform_reading` tool');
    });

    it('should include spread descriptions and position meanings', () => {
      const result = readingManager.listAvailableSpreads();

      expect(result).toContain('cards)');
      expect(result).toContain('Past/Situation');
      expect(result).toContain('Present/Action');
      expect(result).toContain('Future/Outcome');
    });

    it('should be well-formatted markdown', () => {
      const result = readingManager.listAvailableSpreads();

      // Check for proper markdown structure
      expect(result).toMatch(/^# Available Tarot Spreads/);
      expect(result).toMatch(/## \w+/);
      expect(result).toMatch(/\*\*Positions:\*\*/);
      expect(result).toMatch(/\d+\. \*\*/);
    });
  });

  describe('performCustomReading', () => {
    it('should perform a custom spread successfully', () => {
      const spreadName = 'Test Spread';
      const description = 'A test spread for validation';
      const positions = [
        { name: 'Position 1', meaning: 'First meaning' },
        { name: 'Position 2', meaning: 'Second meaning' }
      ];

      const result = readingManager.performCustomReading(
        spreadName,
        description,
        positions,
        'What should I understand?'
      );

      expect(result).toContain('# Test Spread Reading');
      expect(result).toContain('What should I understand?');
      expect(result).toContain('### 1. Position 1');
      expect(result).toContain('*First meaning*');
      expect(result).toContain('### 2. Position 2');
      expect(result).toContain('## Interpretation');
    });

    it('should handle complex custom spreads', () => {
      const positions = [
        { name: 'Core Issue', meaning: 'The heart of the matter' },
        { name: 'Hidden Influence', meaning: 'Subconscious factors at play' },
        { name: 'Action to Take', meaning: 'What you should do' },
        { name: 'Outcome', meaning: 'Likely result of your actions' }
      ];

      const result = readingManager.performCustomReading(
        'Personal Growth Spread',
        'A spread for understanding personal development opportunities',
        positions,
        'How can I grow from this?'
      );

      expect(result).toContain('# Personal Growth Spread Reading');
      expect(result).toContain('Core Issue');
      expect(result).toContain('Hidden Influence');
      expect(result).toContain('Action to Take');
      expect(result).toContain('Outcome');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long questions gracefully', () => {
      const longQuestion = 'A'.repeat(1000);
      const result = readingManager.performReading('single_card', longQuestion);

      expect(result).toContain('# Single Card Reading');
      expect(result).toContain('## Interpretation');
    });

    it('should handle questions with unicode characters', () => {
      const unicodeQuestion = 'What about my future? 🔮✨💫';
      const result = readingManager.performReading('single_card', unicodeQuestion);

      expect(result).toContain('# Single Card Reading');
      expect(result).toContain(unicodeQuestion);
    });

    it('should handle empty questions', () => {
      const result = readingManager.performReading('single_card', '');

      expect(result).toContain('# Single Card Reading');
      expect(result).toContain('## Interpretation');
    });

    it('should handle null/undefined session IDs gracefully', () => {
      const result1 = readingManager.performReading('single_card', 'Test', undefined);
      const result2 = readingManager.performReading('single_card', 'Test', null as any);

      expect(result1).toContain('# Single Card Reading');
      expect(result2).toContain('# Single Card Reading');
    });
  });

  describe('session lifecycle', () => {
    const extractSessionId = (reading: string): string => {
      const match = reading.match(/\*\*Session ID:\*\* (\S+)/);
      expect(match).not.toBeNull();
      return match![1];
    };

    it('starts a new session and reports its ID when none is provided', () => {
      const result = readingManager.performReading('single_card', 'New session?');

      const sessionId = extractSessionId(result);
      expect(sessionManager.getSession(sessionId)).toBeDefined();
      expect(sessionManager.getSessionReadings(sessionId)).toHaveLength(1);
    });

    it('continues an existing session when its ID is passed back', () => {
      const first = readingManager.performReading('single_card', 'First question');
      const sessionId = extractSessionId(first);

      const second = readingManager.performReading('three_card', 'Second question', sessionId);

      expect(second).toContain(`**Session ID:** ${sessionId}`);
      expect(second).toContain('(reading #2 in this session)');
      expect(sessionManager.getSessionReadings(sessionId)).toHaveLength(2);
    });

    it('rejects unknown session IDs instead of silently dropping them', () => {
      const result = readingManager.performReading(
        'single_card',
        'Stale session',
        'session_does_not_exist',
      );

      expect(result).toContain('Error: Session "session_does_not_exist" not found');
    });

    it('threads sessions through custom readings too', () => {
      const result = readingManager.performCustomReading(
        'Focus Spread',
        'A simple test spread',
        [{ name: 'Theme', meaning: 'The core theme' }],
        'What should I focus on?',
      );

      const sessionId = extractSessionId(result);
      expect(sessionManager.getSessionReadings(sessionId)).toHaveLength(1);
    });
  });

  describe('randomness and consistency', () => {
    it('should produce different orientations across multiple readings', () => {
      const orientations = new Set<string>();

      // Perform multiple readings to test randomness
      for (let i = 0; i < 20; i++) {
        const result = readingManager.performReading('single_card', `Test ${i}`);

        if (result.includes('(upright)')) {
          orientations.add('upright');
        }
        if (result.includes('(reversed)')) {
          orientations.add('reversed');
        }
      }

      // Should have both orientations (very high probability)
      expect(orientations.size).toBe(2);
      expect(orientations.has('upright')).toBe(true);
      expect(orientations.has('reversed')).toBe(true);
    });

    it('should draw different cards across multiple readings', () => {
      const cardNames = new Set<string>();

      // Perform multiple single card readings
      for (let i = 0; i < 10; i++) {
        const result = readingManager.performReading('single_card', `Test ${i}`);

        // Extract card name from the result
        const cardMatch = result.match(/\*\*(.+?)\*\* \(/);
        if (cardMatch) {
          cardNames.add(cardMatch[1]);
        }
      }

      // Should have drawn multiple different cards
      expect(cardNames.size).toBeGreaterThan(1);
    });
  });

  describe('interpretation quality', () => {
    it('should provide contextual interpretations based on question type', () => {
      const loveQuestion = 'What about my love life?';
      const careerQuestion = 'How is my career going?';

      const loveReading = readingManager.performReading('single_card', loveQuestion);
      const careerReading = readingManager.performReading('single_card', careerQuestion);

      expect(loveReading).toContain('## Interpretation');
      expect(careerReading).toContain('## Interpretation');

      // Both should be substantial interpretations
      expect(loveReading.length).toBeGreaterThan(200);
      expect(careerReading.length).toBeGreaterThan(200);
    });

    it('should include card meanings in interpretations', () => {
      const result = readingManager.performReading('three_card', 'General guidance');

      expect(result).toContain('## Interpretation');

      // Should have a substantial interpretation
      const interpretationMatch = result.match(/## Interpretation\n\n(.+)/s);
      expect(interpretationMatch).toBeTruthy();

      if (interpretationMatch) {
        const interpretation = interpretationMatch[1];
        expect(interpretation.length).toBeGreaterThan(100);
      }
    });
  });

  describe('contextual interpretation selection', () => {
    it('uses the requested orientation and question category for deterministic readings', () => {
      const fool = cardManager.findCard('The Fool')!;
      const deterministicManager = new TarotReadingManager(cardManager, sessionManager, {
        drawCards: () => [fool],
        drawOrientation: () => 'reversed'
      });

      const result = deterministicManager.performReading(
        'single_card',
        '我的事业下一步怎么走?'
      );

      expect(result).toContain('**The Fool** (reversed)');
      expect(result).toContain(fool.meanings.reversed.career);
      expect(result).not.toContain(fool.meanings.reversed.general);
    });

    it('uses custom spread position meanings when selecting contextual card meanings', () => {
      const lovers = cardManager.findCard('The Lovers')!;
      const deterministicManager = new TarotReadingManager(cardManager, sessionManager, {
        drawCards: () => [lovers],
        drawOrientation: () => 'upright'
      });

      const result = deterministicManager.performCustomReading(
        'Context Spread',
        'A deterministic spread for testing contextual meaning selection',
        [
          {
            name: 'Card 1',
            meaning: 'Love and relationship dynamics'
          }
        ],
        'General guidance'
      );

      expect(result).toContain(lovers.meanings.upright.love);
      expect(result).not.toContain(lovers.meanings.upright.general);
    });

    it('keeps Celtic Cross analysis aligned to the registered spread positions', () => {
      const cardNames = [
        'The Fool',
        'The Magician',
        'The High Priestess',
        'The Empress',
        'The Emperor',
        'The Hierophant',
        'The Lovers',
        'The Chariot',
        'Strength',
        'The Hermit'
      ];
      const cards = cardNames.map((name) => cardManager.findCard(name)!);
      const deterministicManager = new TarotReadingManager(cardManager, sessionManager, {
        drawCards: () => cards,
        drawOrientation: () => 'upright'
      });

      const result = deterministicManager.performReading(
        'celtic_cross',
        'What is the shape of this situation?'
      );

      expect(result).toContain('### 6. Near Future');
      expect(result).toContain(
        '**Near Future Impact:** The Hierophant in your near future will'
      );
      expect(result).not.toContain('The The');
    });
  });
});

describe("spread references", () => {
  it("uses only registered spreads in lunar and seasonal recommendations", () => {
    const spreadsSource = fs.readFileSync(
      "src/tarot/readings/spreads.ts",
      "utf-8",
    );
    const lunarSource = fs.readFileSync(
      "src/tarot/readings/lunar-utils.ts",
      "utf-8",
    );

    const validSpreadTypes = new Set(
      [...spreadsSource.matchAll(/^ {2}([a-z_]+): \{/gm)].map(
        ([, spread]) => spread,
      ),
    );
    const recommendedSpreads = [
      ...lunarSource.matchAll(/recommendedSpreads:\s*\[([^\]]+)\]/g),
    ].flatMap(([, spreads]) =>
      [...spreads.matchAll(/"([^"]+)"/g)].map(([, spread]) => spread),
    );

    expect(validSpreadTypes.size).toBeGreaterThan(0);
    expect(recommendedSpreads.length).toBeGreaterThan(0);

    for (const spread of recommendedSpreads) {
      expect(validSpreadTypes.has(spread)).toBe(true);
    }
  });
});
