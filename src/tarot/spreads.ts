import { TarotSpread } from "./types.js";

/**
 * Tarot spread definitions
 */
export const TAROT_SPREADS: Record<string, TarotSpread> = {
  single_card: {
    name: "Single Card",
    description: "A simple one-card draw for quick insight or daily guidance",
    cardCount: 1,
    positions: [
      {
        name: "The Message",
        meaning: "The main insight, guidance, or energy for your question"
      }
    ]
  },

  three_card: {
    name: "Three Card Spread",
    description: "A versatile three-card spread that can represent past/present/future, situation/action/outcome, or mind/body/spirit",
    cardCount: 3,
    positions: [
      {
        name: "Past/Situation",
        meaning: "What has led to this situation or the foundation of the matter"
      },
      {
        name: "Present/Action",
        meaning: "The current state or what action should be taken"
      },
      {
        name: "Future/Outcome",
        meaning: "The likely outcome or future development"
      }
    ]
  },

  celtic_cross: {
    name: "Celtic Cross",
    description: "The most famous tarot spread, providing comprehensive insight into a situation with 10 cards",
    cardCount: 10,
    positions: [
      {
        name: "Present Situation",
        meaning: "The heart of the matter, your current situation or state of mind"
      },
      {
        name: "Challenge/Cross",
        meaning: "The challenge you face or what crosses you in this situation"
      },
      {
        name: "Distant Past/Foundation",
        meaning: "The foundation of the situation, distant past influences"
      },
      {
        name: "Recent Past",
        meaning: "Recent events or influences that are now passing away"
      },
      {
        name: "Possible Outcome",
        meaning: "One possible outcome if things continue as they are"
      },
      {
        name: "Near Future",
        meaning: "What is approaching in the immediate future"
      },
      {
        name: "Your Approach",
        meaning: "Your approach to the situation, how you see yourself"
      },
      {
        name: "External Influences",
        meaning: "How others see you or external influences affecting the situation"
      },
      {
        name: "Hopes and Fears",
        meaning: "Your inner feelings, hopes, and fears about the situation"
      },
      {
        name: "Final Outcome",
        meaning: "The final outcome, the culmination of all influences"
      }
    ]
  },

  horseshoe: {
    name: "Horseshoe Spread",
    description: "A 7-card spread that provides guidance on a specific situation, showing past influences, present circumstances, and future possibilities",
    cardCount: 7,
    positions: [
      {
        name: "Past Influences",
        meaning: "Past events and influences that have led to the current situation"
      },
      {
        name: "Present Situation",
        meaning: "Your current circumstances and state of mind"
      },
      {
        name: "Hidden Influences",
        meaning: "Hidden factors or subconscious influences affecting the situation"
      },
      {
        name: "Obstacles",
        meaning: "Challenges or obstacles you may face"
      },
      {
        name: "External Influences",
        meaning: "Outside influences, other people's attitudes, or environmental factors"
      },
      {
        name: "Advice",
        meaning: "What you should do or the best approach to take"
      },
      {
        name: "Likely Outcome",
        meaning: "The most probable outcome if you follow the advice given"
      }
    ]
  },

  relationship_cross: {
    name: "Relationship Cross",
    description: "A 7-card spread specifically designed for examining relationships, whether romantic, friendship, or family",
    cardCount: 7,
    positions: [
      {
        name: "You",
        meaning: "Your role, feelings, and contribution to the relationship"
      },
      {
        name: "Your Partner",
        meaning: "Their role, feelings, and contribution to the relationship"
      },
      {
        name: "The Relationship",
        meaning: "The current state and dynamic of the relationship itself"
      },
      {
        name: "What Unites You",
        meaning: "Common ground, shared values, and what brings you together"
      },
      {
        name: "What Divides You",
        meaning: "Differences, conflicts, and what creates tension"
      },
      {
        name: "Advice",
        meaning: "Guidance for improving and nurturing the relationship"
      },
      {
        name: "Future Potential",
        meaning: "Where the relationship is heading and its potential outcome"
      }
    ]
  },

  career_path: {
    name: "Career Path Spread",
    description: "A 6-card spread for career guidance, exploring your professional journey and opportunities",
    cardCount: 6,
    positions: [
      {
        name: "Current Career Situation",
        meaning: "Your present professional circumstances and feelings about work"
      },
      {
        name: "Your Skills and Talents",
        meaning: "Your natural abilities and developed skills that serve your career"
      },
      {
        name: "Career Challenges",
        meaning: "Obstacles or difficulties you face in your professional life"
      },
      {
        name: "Hidden Opportunities",
        meaning: "Unseen possibilities or potential career paths to explore"
      },
      {
        name: "Action to Take",
        meaning: "Specific steps or approaches to advance your career"
      },
      {
        name: "Career Outcome",
        meaning: "The likely result of following the guidance provided"
      }
    ]
  },

  decision_making: {
    name: "Decision Making Spread",
    description: "A 5-card spread to help you make important decisions by examining all aspects of your choices",
    cardCount: 5,
    positions: [
      {
        name: "The Situation",
        meaning: "The current circumstances requiring a decision"
      },
      {
        name: "Option A",
        meaning: "The first choice and its potential consequences"
      },
      {
        name: "Option B",
        meaning: "The second choice and its potential consequences"
      },
      {
        name: "What You Need to Know",
        meaning: "Hidden factors or important information to consider"
      },
      {
        name: "Recommended Path",
        meaning: "The best course of action based on all factors"
      }
    ]
  },

  spiritual_guidance: {
    name: "Spiritual Guidance Spread",
    description: "A 6-card spread for spiritual development and connecting with your higher self",
    cardCount: 6,
    positions: [
      {
        name: "Your Spiritual State",
        meaning: "Your current spiritual condition and level of awareness"
      },
      {
        name: "Spiritual Lessons",
        meaning: "What the universe is trying to teach you right now"
      },
      {
        name: "Blocks to Growth",
        meaning: "What is hindering your spiritual development"
      },
      {
        name: "Spiritual Gifts",
        meaning: "Your natural spiritual abilities and intuitive talents"
      },
      {
        name: "Guidance from Above",
        meaning: "Messages from your higher self or spiritual guides"
      },
      {
        name: "Next Steps",
        meaning: "How to advance on your spiritual journey"
      }
    ]
  },

  year_ahead: {
    name: "Year Ahead Spread",
    description: "A 13-card spread providing insights for the coming year, with one card for each month plus an overall theme",
    cardCount: 13,
    positions: [
      {
        name: "Overall Theme",
        meaning: "The main theme and energy for the entire year"
      },
      {
        name: "January",
        meaning: "What to expect and focus on in January"
      },
      {
        name: "February",
        meaning: "What to expect and focus on in February"
      },
      {
        name: "March",
        meaning: "What to expect and focus on in March"
      },
      {
        name: "April",
        meaning: "What to expect and focus on in April"
      },
      {
        name: "May",
        meaning: "What to expect and focus on in May"
      },
      {
        name: "June",
        meaning: "What to expect and focus on in June"
      },
      {
        name: "July",
        meaning: "What to expect and focus on in July"
      },
      {
        name: "August",
        meaning: "What to expect and focus on in August"
      },
      {
        name: "September",
        meaning: "What to expect and focus on in September"
      },
      {
        name: "October",
        meaning: "What to expect and focus on in October"
      },
      {
        name: "November",
        meaning: "What to expect and focus on in November"
      },
      {
        name: "December",
        meaning: "What to expect and focus on in December"
      }
    ]
  },

  chakra_alignment: {
    name: "Chakra Alignment Spread",
    description: "A 7-card spread examining the energy centers of your body for healing and balance",
    cardCount: 7,
    positions: [
      {
        name: "Root Chakra",
        meaning: "Your foundation, security, and connection to the physical world"
      },
      {
        name: "Sacral Chakra",
        meaning: "Your creativity, sexuality, and emotional expression"
      },
      {
        name: "Solar Plexus Chakra",
        meaning: "Your personal power, confidence, and sense of self"
      },
      {
        name: "Heart Chakra",
        meaning: "Your capacity for love, compassion, and connection"
      },
      {
        name: "Throat Chakra",
        meaning: "Your communication, truth, and authentic expression"
      },
      {
        name: "Third Eye Chakra",
        meaning: "Your intuition, wisdom, and spiritual insight"
      },
      {
        name: "Crown Chakra",
        meaning: "Your connection to the divine and higher consciousness"
      }
    ]
  },

  shadow_work: {
    name: "Shadow Work Spread",
    description: "A 5-card spread for exploring and integrating your shadow self for personal growth",
    cardCount: 5,
    positions: [
      {
        name: "Your Shadow",
        meaning: "The hidden or repressed aspects of yourself"
      },
      {
        name: "How It Manifests",
        meaning: "How your shadow shows up in your life and relationships"
      },
      {
        name: "The Gift Within",
        meaning: "The positive potential hidden within your shadow"
      },
      {
        name: "Integration Process",
        meaning: "How to acknowledge and integrate this aspect of yourself"
      },
      {
        name: "Transformation",
        meaning: "The growth and healing that comes from shadow work"
      }
    ]
  },

  venus_love: {
    name: "Venus Love Spread",
    description: "A 7-card spread exploring love, relationships, self-worth, and romantic potential through the energy of Venus",
    cardCount: 7,
    positions: [
      {
        name: "Your Current Relationship Energy",
        meaning: "Your present state in love and relationships"
      },
      {
        name: "Self-Love and Self-Worth",
        meaning: "How you value and care for yourself"
      },
      {
        name: "What Attracts Love to You",
        meaning: "Your magnetic qualities and what draws love into your life"
      },
      {
        name: "Blocks to Receiving Love",
        meaning: "What prevents you from fully receiving and accepting love"
      },
      {
        name: "How to Enhance Relationships",
        meaning: "Actions to improve your current or future relationships"
      },
      {
        name: "Hidden Desires of the Heart",
        meaning: "Your deepest romantic and emotional needs"
      },
      {
        name: "Future Potential in Love",
        meaning: "What the future holds for your romantic life"
      }
    ]
  },

  tree_of_life: {
    name: "Tree of Life Spread",
    description: "A 10-card spread based on the Kabbalistic Tree of Life, providing deep spiritual insights and life guidance",
    cardCount: 10,
    positions: [
      {
        name: "Kether (Crown)",
        meaning: "Divine will, highest purpose, and spiritual connection"
      },
      {
        name: "Chokmah (Wisdom)",
        meaning: "Creative force, inspiration, and dynamic energy"
      },
      {
        name: "Binah (Understanding)",
        meaning: "Form, structure, and receptive wisdom"
      },
      {
        name: "Chesed (Mercy)",
        meaning: "Love, compassion, and expansion"
      },
      {
        name: "Geburah (Severity)",
        meaning: "Strength, discipline, and necessary boundaries"
      },
      {
        name: "Tiphareth (Beauty)",
        meaning: "Balance, harmony, and integration of opposites"
      },
      {
        name: "Netzach (Victory)",
        meaning: "Emotions, desires, and artistic expression"
      },
      {
        name: "Hod (Splendor)",
        meaning: "Intellect, communication, and analytical thinking"
      },
      {
        name: "Yesod (Foundation)",
        meaning: "Subconscious, dreams, and psychic impressions"
      },
      {
        name: "Malkuth (Kingdom)",
        meaning: "Physical manifestation and material world results"
      }
    ]
  },

  astrological_houses: {
    name: "Astrological Houses Spread",
    description: "A 12-card spread representing the twelve astrological houses, providing comprehensive life insights",
    cardCount: 12,
    positions: [
      {
        name: "1st House - Self and Identity",
        meaning: "Your personality, appearance, and how others see you"
      },
      {
        name: "2nd House - Values and Resources",
        meaning: "Money, possessions, self-worth, and personal values"
      },
      {
        name: "3rd House - Communication",
        meaning: "Communication, learning, siblings, and short journeys"
      },
      {
        name: "4th House - Home and Family",
        meaning: "Home, family, roots, and emotional foundation"
      },
      {
        name: "5th House - Creativity and Romance",
        meaning: "Creativity, children, romance, and self-expression"
      },
      {
        name: "6th House - Work and Health",
        meaning: "Daily work, health, service, and routine"
      },
      {
        name: "7th House - Partnerships",
        meaning: "Marriage, business partnerships, and open enemies"
      },
      {
        name: "8th House - Transformation",
        meaning: "Shared resources, transformation, and hidden matters"
      },
      {
        name: "9th House - Philosophy",
        meaning: "Higher learning, philosophy, travel, and spirituality"
      },
      {
        name: "10th House - Career and Reputation",
        meaning: "Career, reputation, public image, and life direction"
      },
      {
        name: "11th House - Friends and Aspirations",
        meaning: "Friends, groups, hopes, and future aspirations"
      },
      {
        name: "12th House - Spirituality and Hidden",
        meaning: "Spirituality, hidden enemies, and subconscious patterns"
      }
    ]
  },

  mandala: {
    name: "Mandala Spread",
    description: "A 9-card circular spread representing wholeness and the journey to self-discovery",
    cardCount: 9,
    positions: [
      {
        name: "Center - Core Self",
        meaning: "Your essential nature and current spiritual center"
      },
      {
        name: "North - Spiritual Guidance",
        meaning: "Divine guidance and higher wisdom available to you"
      },
      {
        name: "Northeast - Mental Clarity",
        meaning: "Thoughts, ideas, and mental processes that need attention"
      },
      {
        name: "East - New Beginnings",
        meaning: "Fresh starts and opportunities on the horizon"
      },
      {
        name: "Southeast - Relationships",
        meaning: "Your connections with others and social dynamics"
      },
      {
        name: "South - Passion and Creativity",
        meaning: "Your creative fire and what energizes you"
      },
      {
        name: "Southwest - Healing and Release",
        meaning: "What needs to be healed or released from your life"
      },
      {
        name: "West - Intuition and Emotions",
        meaning: "Your emotional landscape and intuitive insights"
      },
      {
        name: "Northwest - Wisdom and Knowledge",
        meaning: "Lessons learned and wisdom gained from experience"
      }
    ]
  },

  pentagram: {
    name: "Pentagram Spread",
    description: "A 5-card spread based on the five elements, exploring balance and spiritual harmony",
    cardCount: 5,
    positions: [
      {
        name: "Spirit (Top)",
        meaning: "Divine guidance and your highest spiritual purpose"
      },
      {
        name: "Air (Upper Right)",
        meaning: "Thoughts, communication, and intellectual matters"
      },
      {
        name: "Fire (Lower Right)",
        meaning: "Passion, action, and creative energy"
      },
      {
        name: "Earth (Lower Left)",
        meaning: "Material world, stability, and practical concerns"
      },
      {
        name: "Water (Upper Left)",
        meaning: "Emotions, intuition, and subconscious influences"
      }
    ]
  },

  mirror_of_truth: {
    name: "Mirror of Truth",
    description: "A 4-card spread designed to clarify relationship confusion through four beams of light: illuminating your perspective, exploring their intentions, revealing objective truth, and guiding future direction",
    cardCount: 4,
    positions: [
      {
        name: "First Light: Illuminate Yourself",
        meaning: "Your perspective - how your emotions, inner filters, anxieties, fears, or expectations influence your understanding of the situation"
      },
      {
        name: "Second Light: Explore Their Heart",
        meaning: "Their intentions - looking beyond surface behavior to explore their true motivations, thoughts, and inner state"
      },
      {
        name: "Third Light: Restore Original Truth",
        meaning: "Objective facts - stripping away emotions and subjective judgments to present the most neutral and authentic picture of what happened"
      },
      {
        name: "Fourth Light: Guide Future Direction",
        meaning: "Influence and guidance - based on understanding the truth, pointing you toward the direction to move forward and actions to take"
      }
    ]
  },

  daily_guidance: {
    name: "Daily Guidance",
    description: "A simple one-card draw for daily insight, guidance, and energy focus",
    cardCount: 1,
    positions: [
      {
        name: "Today's Guidance",
        meaning: "The energy, lesson, or guidance you need for today"
      }
    ]
  },

  yes_no: {
    name: "Yes/No Spread",
    description: "A 3-card spread for binary questions, providing clear guidance on yes/no decisions",
    cardCount: 3,
    positions: [
      {
        name: "The Situation",
        meaning: "The current circumstances surrounding your question"
      },
      {
        name: "Influences",
        meaning: "Hidden factors and influences affecting the outcome"
      },
      {
        name: "Answer",
        meaning: "The guidance and likely answer to your yes/no question"
      }
    ]
  },

  weekly_forecast: {
    name: "Weekly Forecast",
    description: "A 7-card spread providing guidance for each day of the upcoming week",
    cardCount: 7,
    positions: [
      {
        name: "Monday",
        meaning: "Energy and focus for Monday - new beginnings and fresh starts"
      },
      {
        name: "Tuesday",
        meaning: "Energy and focus for Tuesday - action and determination"
      },
      {
        name: "Wednesday",
        meaning: "Energy and focus for Wednesday - communication and adaptability"
      },
      {
        name: "Thursday",
        meaning: "Energy and focus for Thursday - expansion and growth"
      },
      {
        name: "Friday",
        meaning: "Energy and focus for Friday - love, creativity, and relationships"
      },
      {
        name: "Saturday",
        meaning: "Energy and focus for Saturday - responsibility and structure"
      },
      {
        name: "Sunday",
        meaning: "Energy and focus for Sunday - rest, reflection, and spiritual connection"
      }
    ]
  },

  new_moon_intentions: {
    name: "New Moon Intentions",
    description: "A 5-card spread for setting intentions and manifesting new beginnings during the new moon",
    cardCount: 5,
    positions: [
      {
        name: "Current Energy",
        meaning: "Your current spiritual and emotional state as you enter this new cycle"
      },
      {
        name: "What to Release",
        meaning: "Old patterns, beliefs, or situations you need to let go of"
      },
      {
        name: "Intention to Set",
        meaning: "The primary intention or goal to focus on during this lunar cycle"
      },
      {
        name: "How to Manifest",
        meaning: "Practical steps and energy to put into manifesting your intention"
      },
      {
        name: "Potential Outcome",
        meaning: "What you can expect to achieve by the full moon if you follow this guidance"
      }
    ]
  },

  full_moon_release: {
    name: "Full Moon Release",
    description: "A 5-card spread for releasing what no longer serves and harvesting the fruits of your efforts",
    cardCount: 5,
    positions: [
      {
        name: "What Has Manifested",
        meaning: "What you have successfully created or achieved during this lunar cycle"
      },
      {
        name: "What to Release",
        meaning: "Emotions, patterns, or situations that need to be released under the full moon"
      },
      {
        name: "Hidden Blessings",
        meaning: "Unexpected gifts or lessons that have emerged during this cycle"
      },
      {
        name: "How to Release",
        meaning: "The best way to let go and release what no longer serves you"
      },
      {
        name: "Moving Forward",
        meaning: "How to carry the wisdom and energy forward into the next cycle"
      }
    ]
  },

  elemental_balance: {
    name: "Elemental Balance",
    description: "A 4-card spread examining your connection to the four elements for balance and harmony",
    cardCount: 4,
    positions: [
      {
        name: "Fire - Passion and Action",
        meaning: "Your creative energy, passion, and ability to take action"
      },
      {
        name: "Water - Emotions and Intuition",
        meaning: "Your emotional state, intuitive abilities, and flow with life"
      },
      {
        name: "Air - Thoughts and Communication",
        meaning: "Your mental clarity, communication skills, and intellectual pursuits"
      },
      {
        name: "Earth - Stability and Manifestation",
        meaning: "Your grounding, practical matters, and ability to manifest in the physical world"
      }
    ]
  },

  past_life_karma: {
    name: "Past Life Karma",
    description: "A 6-card spread exploring karmic patterns and past life influences on your current situation",
    cardCount: 6,
    positions: [
      {
        name: "Past Life Influence",
        meaning: "The most relevant past life pattern affecting your current situation"
      },
      {
        name: "Karmic Lesson",
        meaning: "The lesson your soul is working to learn in this lifetime"
      },
      {
        name: "Karmic Debt",
        meaning: "What you need to balance or resolve from past actions"
      },
      {
        name: "Soul Gifts",
        meaning: "Talents and wisdom you've brought forward from previous lifetimes"
      },
      {
        name: "Current Challenge",
        meaning: "How these karmic patterns are manifesting in your present life"
      },
      {
        name: "Path to Resolution",
        meaning: "How to heal and transcend these karmic patterns"
      }
    ]
  },

  compatibility: {
    name: "Compatibility Spread",
    description: "An 8-card spread for examining compatibility between two people in any type of relationship",
    cardCount: 8,
    positions: [
      {
        name: "Person A - Core Nature",
        meaning: "The essential nature and energy of the first person"
      },
      {
        name: "Person B - Core Nature",
        meaning: "The essential nature and energy of the second person"
      },
      {
        name: "What Attracts You",
        meaning: "What draws these two people together"
      },
      {
        name: "Potential Challenges",
        meaning: "Areas of conflict or difficulty in the relationship"
      },
      {
        name: "Communication Style",
        meaning: "How these two people communicate and understand each other"
      },
      {
        name: "Shared Goals",
        meaning: "Common ground and shared aspirations"
      },
      {
        name: "Growth Potential",
        meaning: "How this relationship can help both people grow and evolve"
      },
      {
        name: "Long-term Potential",
        meaning: "The likely future and sustainability of this connection"
      }
    ]
  }
};

/**
 * Get all available spreads
 */
export function getAllSpreads(): TarotSpread[] {
  return Object.values(TAROT_SPREADS);
}

/**
 * Get a specific spread by name
 */
export function getSpread(name: string): TarotSpread | undefined {
  return TAROT_SPREADS[name];
}

/**
 * Validate if a spread type is supported
 */
export function isValidSpreadType(spreadType: string): boolean {
  return spreadType in TAROT_SPREADS;
}
