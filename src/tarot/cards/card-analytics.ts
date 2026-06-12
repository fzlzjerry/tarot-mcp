import { TarotCard } from "../shared/types.js";

export interface CardAnalytics {
  overview: DatabaseOverview;
  dataQuality: DataQualityReport;
  contentAnalysis: ContentAnalysis;
  recommendations: string[];
}

export interface DatabaseOverview {
  totalCards: number;
  completionRate: number;
  arcanaDistribution: Record<string, number>;
  suitDistribution: Record<string, number>;
  elementDistribution: Record<string, number>;
}

export interface DataQualityReport {
  completeCards: number;
  incompleteCards: string[];
  averageKeywordsPerCard: number;
  averageSymbolsPerCard: number;
  missingFields: Record<string, string[]>;
}

export interface ContentAnalysis {
  mostCommonKeywords: Array<{ keyword: string; count: number; percentage: number }>;
  keywordsByOrientation: {
    upright: Array<{ keyword: string; count: number }>;
    reversed: Array<{ keyword: string; count: number }>;
  };
  thematicAnalysis: Record<string, number>;
  lengthStatistics: {
    averageDescriptionLength: number;
    averageMeaningLength: number;
    longestDescription: { card: string; length: number };
    shortestDescription: { card: string; length: number };
  };
}

/**
 * Analytics and insights for the tarot card database
 */
export class TarotCardAnalytics {
  private cards: readonly TarotCard[];

  constructor(cards: readonly TarotCard[]) {
    this.cards = cards;
  }

  /**
   * Generate comprehensive analytics report
   */
  generateReport(): CardAnalytics {
    const overview = this.getDatabaseOverview();
    const dataQuality = this.getDataQualityReport();
    const contentAnalysis = this.getContentAnalysis();
    return {
      overview,
      dataQuality,
      contentAnalysis,
      recommendations: this.generateRecommendations(overview, dataQuality, contentAnalysis)
    };
  }

  /**
   * Get database overview statistics
   */
  getDatabaseOverview(): DatabaseOverview {
    const arcanaDistribution: Record<string, number> = {};
    const suitDistribution: Record<string, number> = {};
    const elementDistribution: Record<string, number> = {};

    for (const card of this.cards) {
      // Count arcana
      arcanaDistribution[card.arcana] = (arcanaDistribution[card.arcana] || 0) + 1;

      // Count suits
      if (card.suit) {
        suitDistribution[card.suit] = (suitDistribution[card.suit] || 0) + 1;
      }

      // Count elements
      if (card.element) {
        elementDistribution[card.element] = (elementDistribution[card.element] || 0) + 1;
      }
    }

    return {
      totalCards: this.cards.length,
      completionRate: this.calculateCompletionRate(),
      arcanaDistribution,
      suitDistribution,
      elementDistribution
    };
  }

  /**
   * Analyze data quality and completeness
   */
  getDataQualityReport(): DataQualityReport {
    const requiredFields = ['keywords', 'meanings', 'symbolism', 'astrology', 'numerology', 'description'];
    const incompleteCards: string[] = [];
    const missingFields: Record<string, string[]> = {};
    let totalKeywords = 0;
    let totalSymbols = 0;

    for (const card of this.cards) {
      const missing: string[] = [];

      // Check required fields
      for (const field of requiredFields) {
        if (field === 'keywords') {
          if (!card.keywords?.upright?.length || !card.keywords?.reversed?.length) {
            missing.push('keywords');
          } else {
            totalKeywords += card.keywords.upright.length + card.keywords.reversed.length;
          }
        } else if (field === 'meanings') {
          if (!card.meanings?.upright || !card.meanings?.reversed) {
            missing.push('meanings');
          }
        } else if (field === 'symbolism') {
          if (!card.symbolism?.length) {
            missing.push('symbolism');
          } else {
            totalSymbols += card.symbolism.length;
          }
        } else {
          const value = (card as any)[field];
          if (!value || value === '(placeholder)') {
            missing.push(field);
          }
        }
      }

      if (missing.length > 0) {
        incompleteCards.push(card.name || card.id);
        missingFields[card.name || card.id] = missing;
      }
    }

    return {
      completeCards: this.cards.length - incompleteCards.length,
      incompleteCards,
      averageKeywordsPerCard: totalKeywords / this.cards.length,
      averageSymbolsPerCard: totalSymbols / this.cards.length,
      missingFields
    };
  }

  /**
   * Analyze card content and themes
   */
  getContentAnalysis(): ContentAnalysis {
    const keywordCounts: Record<string, number> = {};
    const uprightKeywords: Record<string, number> = {};
    const reversedKeywords: Record<string, number> = {};
    const themes: Record<string, number> = {};
    
    let totalDescriptionLength = 0;
    let totalMeaningLength = 0;
    let longestDesc = { card: '', length: 0 };
    let shortestDesc = { card: '', length: Infinity };

    for (const card of this.cards) {
      // Count keywords
      for (const keyword of card.keywords.upright) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
        uprightKeywords[keyword] = (uprightKeywords[keyword] || 0) + 1;
      }

      for (const keyword of card.keywords.reversed) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
        reversedKeywords[keyword] = (reversedKeywords[keyword] || 0) + 1;
      }

      // Analyze themes
      this.analyzeThemes(card, themes);

      // Length statistics
      const descLength = card.description.length;
      totalDescriptionLength += descLength;

      if (descLength > longestDesc.length) {
        longestDesc = { card: card.name, length: descLength };
      }
      if (descLength < shortestDesc.length) {
        shortestDesc = { card: card.name, length: descLength };
      }

      // Calculate average meaning length
      const meanings = Object.values(card.meanings.upright);
      const avgMeaningLength = meanings.reduce((sum, meaning) => sum + meaning.length, 0) / meanings.length;
      totalMeaningLength += avgMeaningLength;
    }

    const totalKeywords = Object.values(keywordCounts).reduce((sum, count) => sum + count, 0);

    return {
      mostCommonKeywords: Object.entries(keywordCounts)
        .map(([keyword, count]) => ({
          keyword,
          count,
          percentage: (count / totalKeywords) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),

      keywordsByOrientation: {
        upright: Object.entries(uprightKeywords)
          .map(([keyword, count]) => ({ keyword, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        reversed: Object.entries(reversedKeywords)
          .map(([keyword, count]) => ({ keyword, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      },

      thematicAnalysis: themes,

      lengthStatistics: {
        averageDescriptionLength: totalDescriptionLength / this.cards.length,
        averageMeaningLength: totalMeaningLength / this.cards.length,
        longestDescription: longestDesc,
        shortestDescription: shortestDesc.length === Infinity ? { card: 'None', length: 0 } : shortestDesc
      }
    };
  }

  /**
   * Generate recommendations for database improvement
   */
  generateRecommendations(
    overview: DatabaseOverview = this.getDatabaseOverview(),
    qualityReport: DataQualityReport = this.getDataQualityReport(),
    contentAnalysis: ContentAnalysis = this.getContentAnalysis()
  ): string[] {
    const recommendations: string[] = [];

    // Data quality recommendations
    if (qualityReport.incompleteCards.length > 0) {
      recommendations.push(`Complete data for ${qualityReport.incompleteCards.length} incomplete cards`);
    }

    if (qualityReport.averageKeywordsPerCard < 8) {
      recommendations.push('Consider adding more keywords per card for better searchability');
    }

    if (qualityReport.averageSymbolsPerCard < 4) {
      recommendations.push('Add more symbolic interpretations to enhance card meanings');
    }

    // Content recommendations
    if (contentAnalysis.lengthStatistics.averageDescriptionLength < 100) {
      recommendations.push('Consider expanding card descriptions for more detailed imagery');
    }

    // Balance recommendations
    if (overview.completionRate < 100) {
      recommendations.push(`Database is ${overview.completionRate.toFixed(1)}% complete - finish remaining cards`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Database is in excellent condition - no improvements needed!');
    }

    return recommendations;
  }

  private calculateCompletionRate(): number {
    const expectedTotal = 78; // Standard tarot deck
    return (this.cards.length / expectedTotal) * 100;
  }

  private analyzeThemes(card: TarotCard, themes: Record<string, number>): void {
    const themeKeywords = {
      'love': ['love', 'romance', 'relationship', 'partnership', 'marriage', 'attraction'],
      'career': ['career', 'work', 'job', 'profession', 'business', 'success'],
      'money': ['money', 'wealth', 'financial', 'prosperity', 'abundance', 'material'],
      'health': ['health', 'healing', 'wellness', 'recovery', 'vitality', 'energy'],
      'spirituality': ['spiritual', 'divine', 'sacred', 'enlightenment', 'wisdom', 'intuition'],
      'conflict': ['conflict', 'struggle', 'challenge', 'difficulty', 'opposition', 'tension'],
      'growth': ['growth', 'development', 'progress', 'advancement', 'evolution', 'learning'],
      'creativity': ['creativity', 'artistic', 'inspiration', 'imagination', 'expression', 'innovation']
    };

    const allText = [
      ...card.keywords.upright,
      ...card.keywords.reversed,
      card.description,
      ...Object.values(card.meanings.upright),
      ...Object.values(card.meanings.reversed)
    ].join(' ').toLowerCase();

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      for (const keyword of keywords) {
        if (allText.includes(keyword)) {
          themes[theme] = (themes[theme] || 0) + 1;
          break; // Count each theme only once per card
        }
      }
    }
  }
}
