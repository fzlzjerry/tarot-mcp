import { TarotCardManager } from '../card-manager.js';
import { TarotReadingManager } from '../reading-manager.js';
import { TarotSessionManager } from '../session-manager.js';

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
      expect(result).toContain('Card 1:');
      expect(result).toContain('## Interpretation');
    });

    it('should perform a three card reading successfully', () => {
      const result = readingManager.performReading('three_card', 'What about my career?');

      expect(result).toContain('# Three Card Reading');
      expect(result).toContain('What about my career?');
      expect(result).toContain('Past:');
      expect(result).toContain('Present:');
      expect(result).toContain('Future:');
      expect(result).toContain('## Interpretation');
    });

    it('should perform a Celtic Cross reading successfully', () => {
      const result = readingManager.performReading('celtic_cross', 'Complete life guidance');

      expect(result).toContain('# Celtic Cross Reading');
      expect(result).toContain('Complete life guidance');
      expect(result).toContain('Present Situation:');
      expect(result).toContain('Challenge:');
      expect(result).toContain('Distant Past:');
      expect(result).toContain('Possible Outcome:');
      expect(result).toContain('## Interpretation');
    });

    it('should return error message for invalid spread type', () => {
      const result = readingManager.performReading('invalid_spread', 'Test question');

      expect(result).toContain('Invalid spread type: invalid_spread');
      expect(result).toContain('Use list_available_spreads');
    });

    it('should include session ID when provided', () => {
      const sessionId = 'test-session-123';
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
      const reading1 = readingManager.performReading('single_card', question);
      const reading2 = readingManager.performReading('single_card', question);

      // Both should be valid readings
      expect(reading1).toContain('# Single Card Reading');
      expect(reading2).toContain('# Single Card Reading');

      // They should likely be different (due to randomness)
      // Note: There's a small chance they could be the same, but very unlikely
      expect(reading1).not.toBe(reading2);
    });

    it('should handle complex questions with special characters', () => {
      const complexQuestion = 'What about love & relationships? (Is there hope?)';
      const result = readingManager.performReading('three_card', complexQuestion);

      expect(result).toContain('# Three Card Reading');
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
      expect(result).toContain('Past:');
      expect(result).toContain('Present:');
      expect(result).toContain('Future:');
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

  describe('createCustomSpread', () => {
    it('should create a custom spread successfully', () => {
      const spreadName = 'Test Spread';
      const description = 'A test spread for validation';
      const positions = [
        { name: 'Position 1', meaning: 'First meaning' },
        { name: 'Position 2', meaning: 'Second meaning' }
      ];

      const result = readingManager.createCustomSpread(spreadName, description, positions);

      expect(result).toContain('Custom spread "Test Spread" created successfully');
      expect(result).toContain('2 positions');
      expect(result).toContain('Position 1: First meaning');
      expect(result).toContain('Position 2: Second meaning');
    });

    it('should validate spread name', () => {
      const result = readingManager.createCustomSpread('', 'Description', [
        { name: 'Pos', meaning: 'Meaning' }
      ]);

      expect(result).toContain('Spread name cannot be empty');
    });

    it('should validate description', () => {
      const result = readingManager.createCustomSpread('Name', '', [
        { name: 'Pos', meaning: 'Meaning' }
      ]);

      expect(result).toContain('Description cannot be empty');
    });

    it('should validate minimum positions', () => {
      const result = readingManager.createCustomSpread('Name', 'Description', []);

      expect(result).toContain('At least 1 position is required');
    });

    it('should validate maximum positions', () => {
      const tooManyPositions = Array.from({ length: 16 }, (_, i) => ({
        name: `Position ${i + 1}`,
        meaning: `Meaning ${i + 1}`
      }));

      const result = readingManager.createCustomSpread('Name', 'Description', tooManyPositions);

      expect(result).toContain('Maximum 15 positions allowed');
    });

    it('should validate position names', () => {
      const result = readingManager.createCustomSpread('Name', 'Description', [
        { name: '', meaning: 'Valid meaning' }
      ]);

      expect(result).toContain('Position name cannot be empty');
    });

    it('should validate position meanings', () => {
      const result = readingManager.createCustomSpread('Name', 'Description', [
        { name: 'Valid name', meaning: '' }
      ]);

      expect(result).toContain('Position meaning cannot be empty');
    });

    it('should handle complex custom spreads', () => {
      const positions = [
        { name: 'Core Issue', meaning: 'The heart of the matter' },
        { name: 'Hidden Influence', meaning: 'Subconscious factors at play' },
        { name: 'Action to Take', meaning: 'What you should do' },
        { name: 'Outcome', meaning: 'Likely result of your actions' }
      ];

      const result = readingManager.createCustomSpread(
        'Personal Growth Spread',
        'A spread for understanding personal development opportunities',
        positions
      );

      expect(result).toContain('Custom spread "Personal Growth Spread" created successfully');
      expect(result).toContain('4 positions');
      expect(result).toContain('Core Issue: The heart of the matter');
      expect(result).toContain('Hidden Influence: Subconscious factors at play');
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

  describe('randomness and consistency', () => {
    it('should produce different orientations across multiple readings', () => {
      const orientations = new Set<string>();

      // Perform multiple readings to test randomness
      for (let i = 0; i < 20; i++) {
        const result = readingManager.performReading('single_card', `Test ${i}`);

        if (result.includes('(Upright)')) {
          orientations.add('upright');
        }
        if (result.includes('(Reversed)')) {
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
});
