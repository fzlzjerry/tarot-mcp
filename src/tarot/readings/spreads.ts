import type { SpreadType, TarotSpread } from "../shared/types.js";

/**
 * Tarot spread definitions. `satisfies` keeps the keys in compile-time sync
 * with SPREAD_TYPES: a spread added or renamed here without updating the
 * canonical list (or vice versa) fails the build.
 *
 * Every position carries a stable id and an explicit role, so interpretation
 * never has to guess a role from the position's wording. `links` name the
 * position pairs that are read against each other in that layout.
 */
export const TAROT_SPREADS = {
  single_card: {
    name: "Single Card",
    description: "A simple one-card draw for quick insight or daily guidance",
    cardCount: 1,
    positions: [
      {
        id: "message",
        name: "The Message",
        meaning: "The main insight, guidance, or energy for your question",
        role: "message",
      },
    ],
  },

  three_card: {
    name: "Three Card Spread",
    description:
      "A versatile three-card spread that can represent past/present/future, situation/action/outcome, or mind/body/spirit",
    cardCount: 3,
    positions: [
      {
        id: "past_situation",
        name: "Past/Situation",
        meaning:
          "What has led to this situation or the foundation of the matter",
        role: "foundation",
      },
      {
        id: "present_action",
        name: "Present/Action",
        meaning: "The current state or what action should be taken",
        role: "present",
      },
      {
        id: "future_outcome",
        name: "Future/Outcome",
        meaning: "The likely outcome or future development",
        role: "outcome",
      },
    ],
    links: [
      { from: "past_situation", to: "present_action", kind: "leads_to" },
      { from: "present_action", to: "future_outcome", kind: "leads_to" },
    ],
  },

  celtic_cross: {
    name: "Celtic Cross",
    description:
      "The most famous tarot spread, providing comprehensive insight into a situation with 10 cards",
    cardCount: 10,
    positions: [
      {
        id: "present",
        name: "Present Situation",
        meaning:
          "The heart of the matter, your current situation or state of mind",
        role: "present",
      },
      {
        id: "challenge",
        name: "Challenge/Cross",
        meaning: "The challenge you face or what crosses you in this situation",
        role: "challenge",
      },
      {
        id: "foundation",
        name: "Distant Past/Foundation",
        meaning: "The foundation of the situation, distant past influences",
        role: "foundation",
      },
      {
        id: "recent_past",
        name: "Recent Past",
        meaning: "Recent events or influences that are now passing away",
        role: "foundation",
      },
      {
        id: "possible_outcome",
        name: "Possible Outcome",
        meaning: "One possible outcome if things continue as they are",
        role: "outcome",
      },
      {
        id: "near_future",
        name: "Near Future",
        meaning: "What is approaching in the immediate future",
        role: "outcome",
      },
      {
        id: "approach",
        name: "Your Approach",
        meaning: "Your approach to the situation, how you see yourself",
        role: "self",
      },
      {
        id: "external",
        name: "External Influences",
        meaning:
          "How others see you or external influences affecting the situation",
        role: "external",
      },
      {
        id: "hopes_fears",
        name: "Hopes and Fears",
        meaning: "Your inner feelings, hopes, and fears about the situation",
        role: "hopes_fears",
      },
      {
        id: "final_outcome",
        name: "Final Outcome",
        meaning: "The final outcome, the culmination of all influences",
        role: "outcome",
      },
    ],
    links: [
      { from: "challenge", to: "present", kind: "crosses" },
      { from: "foundation", to: "present", kind: "underlies" },
      { from: "recent_past", to: "near_future", kind: "leads_to" },
      { from: "approach", to: "external", kind: "tension" },
      { from: "hopes_fears", to: "final_outcome", kind: "tension" },
      { from: "possible_outcome", to: "final_outcome", kind: "mirrors" },
    ],
  },

  horseshoe: {
    name: "Horseshoe Spread",
    description:
      "A 7-card spread that provides guidance on a specific situation, showing past influences, present circumstances, and future possibilities",
    cardCount: 7,
    positions: [
      {
        id: "past_influences",
        name: "Past Influences",
        meaning:
          "Past events and influences that have led to the current situation",
        role: "foundation",
      },
      {
        id: "present",
        name: "Present Situation",
        meaning: "Your current circumstances and state of mind",
        role: "present",
      },
      {
        id: "hidden_influences",
        name: "Hidden Influences",
        meaning:
          "Hidden factors or subconscious influences affecting the situation",
        role: "hidden",
      },
      {
        id: "obstacles",
        name: "Obstacles",
        meaning: "Challenges or obstacles you may face",
        role: "challenge",
      },
      {
        id: "external_influences",
        name: "External Influences",
        meaning:
          "Outside influences, other people's attitudes, or environmental factors",
        role: "external",
      },
      {
        id: "advice",
        name: "Advice",
        meaning: "What you should do or the best approach to take",
        role: "advice",
      },
      {
        id: "likely_outcome",
        name: "Likely Outcome",
        meaning: "The most probable outcome if you follow the advice given",
        role: "outcome",
      },
    ],
    links: [
      { from: "obstacles", to: "present", kind: "crosses" },
      { from: "hidden_influences", to: "present", kind: "underlies" },
      { from: "advice", to: "obstacles", kind: "answers" },
      { from: "past_influences", to: "present", kind: "leads_to" },
      { from: "advice", to: "likely_outcome", kind: "leads_to" },
    ],
  },

  relationship_cross: {
    name: "Relationship Cross",
    description:
      "A 7-card spread specifically designed for examining relationships, whether romantic, friendship, or family",
    cardCount: 7,
    positions: [
      {
        id: "you",
        name: "You",
        meaning: "Your role, feelings, and contribution to the relationship",
        role: "self",
      },
      {
        id: "partner",
        name: "Your Partner",
        meaning: "Their role, feelings, and contribution to the relationship",
        role: "other",
      },
      {
        id: "relationship",
        name: "The Relationship",
        meaning: "The current state and dynamic of the relationship itself",
        role: "present",
      },
      {
        id: "unites",
        name: "What Unites You",
        meaning: "Common ground, shared values, and what brings you together",
        role: "resource",
      },
      {
        id: "divides",
        name: "What Divides You",
        meaning: "Differences, conflicts, and what creates tension",
        role: "challenge",
      },
      {
        id: "advice",
        name: "Advice",
        meaning: "Guidance for improving and nurturing the relationship",
        role: "advice",
      },
      {
        id: "future_potential",
        name: "Future Potential",
        meaning: "Where the relationship is heading and its potential outcome",
        role: "outcome",
      },
    ],
    links: [
      { from: "you", to: "partner", kind: "mirrors" },
      { from: "unites", to: "divides", kind: "tension" },
      { from: "advice", to: "divides", kind: "answers" },
      { from: "relationship", to: "future_potential", kind: "leads_to" },
    ],
  },

  career_path: {
    name: "Career Path Spread",
    description:
      "A 6-card spread for career guidance, exploring your professional journey and opportunities",
    cardCount: 6,
    positions: [
      {
        id: "current_situation",
        name: "Current Career Situation",
        meaning:
          "Your present professional circumstances and feelings about work",
        role: "present",
      },
      {
        id: "skills",
        name: "Your Skills and Talents",
        meaning:
          "Your natural abilities and developed skills that serve your career",
        role: "resource",
      },
      {
        id: "challenges",
        name: "Career Challenges",
        meaning: "Obstacles or difficulties you face in your professional life",
        role: "challenge",
      },
      {
        id: "hidden_opportunities",
        name: "Hidden Opportunities",
        meaning: "Unseen possibilities or potential career paths to explore",
        role: "hidden",
      },
      {
        id: "action",
        name: "Action to Take",
        meaning: "Specific steps or approaches to advance your career",
        role: "action",
      },
      {
        id: "outcome",
        name: "Career Outcome",
        meaning: "The likely result of following the guidance provided",
        role: "outcome",
      },
    ],
    links: [
      { from: "challenges", to: "current_situation", kind: "crosses" },
      { from: "skills", to: "challenges", kind: "answers" },
      {
        from: "hidden_opportunities",
        to: "current_situation",
        kind: "underlies",
      },
      { from: "action", to: "outcome", kind: "leads_to" },
    ],
  },

  decision_making: {
    name: "Decision Making Spread",
    description:
      "A 5-card spread to help you make important decisions by examining all aspects of your choices",
    cardCount: 5,
    positions: [
      {
        id: "situation",
        name: "The Situation",
        meaning: "The current circumstances requiring a decision",
        role: "present",
      },
      {
        id: "option_a",
        name: "Option A",
        meaning: "The first choice and its potential consequences",
        role: "outcome",
      },
      {
        id: "option_b",
        name: "Option B",
        meaning: "The second choice and its potential consequences",
        role: "outcome",
      },
      {
        id: "need_to_know",
        name: "What You Need to Know",
        meaning: "Hidden factors or important information to consider",
        role: "hidden",
      },
      {
        id: "recommended_path",
        name: "Recommended Path",
        meaning: "The best course of action based on all factors",
        role: "advice",
      },
    ],
    links: [
      { from: "option_a", to: "option_b", kind: "mirrors" },
      { from: "need_to_know", to: "situation", kind: "underlies" },
      { from: "recommended_path", to: "situation", kind: "answers" },
    ],
  },

  spiritual_guidance: {
    name: "Spiritual Guidance Spread",
    description:
      "A 6-card spread for spiritual development and connecting with your higher self",
    cardCount: 6,
    positions: [
      {
        id: "spiritual_state",
        name: "Your Spiritual State",
        meaning: "Your current spiritual condition and level of awareness",
        role: "present",
      },
      {
        id: "lessons",
        name: "Spiritual Lessons",
        meaning: "What the universe is trying to teach you right now",
        role: "message",
      },
      {
        id: "blocks",
        name: "Blocks to Growth",
        meaning: "What is hindering your spiritual development",
        role: "challenge",
      },
      {
        id: "gifts",
        name: "Spiritual Gifts",
        meaning: "Your natural spiritual abilities and intuitive talents",
        role: "resource",
      },
      {
        id: "guidance",
        name: "Guidance from Above",
        meaning: "Messages from your higher self or spiritual guides",
        role: "advice",
      },
      {
        id: "next_steps",
        name: "Next Steps",
        meaning: "How to advance on your spiritual journey",
        role: "action",
      },
    ],
    links: [
      { from: "blocks", to: "spiritual_state", kind: "crosses" },
      { from: "gifts", to: "blocks", kind: "answers" },
      { from: "guidance", to: "next_steps", kind: "leads_to" },
    ],
  },

  year_ahead: {
    name: "Year Ahead Spread",
    description:
      "A 13-card spread providing insights for the coming year, with one card for each month plus an overall theme",
    cardCount: 13,
    positions: [
      {
        id: "theme",
        name: "Overall Theme",
        meaning: "The main theme and energy for the entire year",
        role: "message",
      },
      {
        id: "january",
        name: "January",
        meaning: "What to expect and focus on in January",
        role: "general",
      },
      {
        id: "february",
        name: "February",
        meaning: "What to expect and focus on in February",
        role: "general",
      },
      {
        id: "march",
        name: "March",
        meaning: "What to expect and focus on in March",
        role: "general",
      },
      {
        id: "april",
        name: "April",
        meaning: "What to expect and focus on in April",
        role: "general",
      },
      {
        id: "may",
        name: "May",
        meaning: "What to expect and focus on in May",
        role: "general",
      },
      {
        id: "june",
        name: "June",
        meaning: "What to expect and focus on in June",
        role: "general",
      },
      {
        id: "july",
        name: "July",
        meaning: "What to expect and focus on in July",
        role: "general",
      },
      {
        id: "august",
        name: "August",
        meaning: "What to expect and focus on in August",
        role: "general",
      },
      {
        id: "september",
        name: "September",
        meaning: "What to expect and focus on in September",
        role: "general",
      },
      {
        id: "october",
        name: "October",
        meaning: "What to expect and focus on in October",
        role: "general",
      },
      {
        id: "november",
        name: "November",
        meaning: "What to expect and focus on in November",
        role: "general",
      },
      {
        id: "december",
        name: "December",
        meaning: "What to expect and focus on in December",
        role: "general",
      },
    ],
    links: [
      { from: "january", to: "february", kind: "leads_to" },
      { from: "february", to: "march", kind: "leads_to" },
      { from: "march", to: "april", kind: "leads_to" },
      { from: "april", to: "may", kind: "leads_to" },
      { from: "may", to: "june", kind: "leads_to" },
      { from: "june", to: "july", kind: "leads_to" },
      { from: "july", to: "august", kind: "leads_to" },
      { from: "august", to: "september", kind: "leads_to" },
      { from: "september", to: "october", kind: "leads_to" },
      { from: "october", to: "november", kind: "leads_to" },
      { from: "november", to: "december", kind: "leads_to" },
    ],
  },

  chakra_alignment: {
    name: "Chakra Alignment Spread",
    description:
      "A 7-card spread examining the energy centers of your body for healing and balance",
    cardCount: 7,
    positions: [
      {
        id: "root",
        name: "Root Chakra",
        meaning:
          "Your foundation, security, and connection to the physical world",
        role: "general",
      },
      {
        id: "sacral",
        name: "Sacral Chakra",
        meaning: "Your creativity, sexuality, and emotional expression",
        role: "general",
      },
      {
        id: "solar_plexus",
        name: "Solar Plexus Chakra",
        meaning: "Your personal power, confidence, and sense of self",
        role: "general",
      },
      {
        id: "heart",
        name: "Heart Chakra",
        meaning: "Your capacity for love, compassion, and connection",
        role: "general",
      },
      {
        id: "throat",
        name: "Throat Chakra",
        meaning: "Your communication, truth, and authentic expression",
        role: "general",
      },
      {
        id: "third_eye",
        name: "Third Eye Chakra",
        meaning: "Your intuition, wisdom, and spiritual insight",
        role: "general",
      },
      {
        id: "crown",
        name: "Crown Chakra",
        meaning: "Your connection to the divine and higher consciousness",
        role: "general",
      },
    ],
    links: [
      { from: "root", to: "crown", kind: "mirrors" },
      { from: "sacral", to: "third_eye", kind: "mirrors" },
      { from: "solar_plexus", to: "throat", kind: "mirrors" },
    ],
  },

  shadow_work: {
    name: "Shadow Work Spread",
    description:
      "A 5-card spread for exploring and integrating your shadow self for personal growth",
    cardCount: 5,
    positions: [
      {
        id: "shadow",
        name: "Your Shadow",
        meaning: "The hidden or repressed aspects of yourself",
        role: "hidden",
      },
      {
        id: "manifestation",
        name: "How It Manifests",
        meaning: "How your shadow shows up in your life and relationships",
        role: "present",
      },
      {
        id: "gift",
        name: "The Gift Within",
        meaning: "The positive potential hidden within your shadow",
        role: "resource",
      },
      {
        id: "integration",
        name: "Integration Process",
        meaning: "How to acknowledge and integrate this aspect of yourself",
        role: "action",
      },
      {
        id: "transformation",
        name: "Transformation",
        meaning: "The growth and healing that comes from shadow work",
        role: "outcome",
      },
    ],
    links: [
      { from: "shadow", to: "manifestation", kind: "underlies" },
      { from: "gift", to: "shadow", kind: "answers" },
      { from: "integration", to: "transformation", kind: "leads_to" },
    ],
  },

  venus_love: {
    name: "Venus Love Spread",
    description:
      "A 7-card spread exploring love, relationships, self-worth, and romantic potential through the energy of Venus",
    cardCount: 7,
    positions: [
      {
        id: "current_energy",
        name: "Your Current Relationship Energy",
        meaning: "Your present state in love and relationships",
        role: "present",
      },
      {
        id: "self_love",
        name: "Self-Love and Self-Worth",
        meaning: "How you value and care for yourself",
        role: "self",
      },
      {
        id: "attracts",
        name: "What Attracts Love to You",
        meaning: "Your magnetic qualities and what draws love into your life",
        role: "resource",
      },
      {
        id: "blocks",
        name: "Blocks to Receiving Love",
        meaning: "What prevents you from fully receiving and accepting love",
        role: "challenge",
      },
      {
        id: "enhance",
        name: "How to Enhance Relationships",
        meaning: "Actions to improve your current or future relationships",
        role: "action",
      },
      {
        id: "hidden_desires",
        name: "Hidden Desires of the Heart",
        meaning: "Your deepest romantic and emotional needs",
        role: "hidden",
      },
      {
        id: "future_potential",
        name: "Future Potential in Love",
        meaning: "What the future holds for your romantic life",
        role: "outcome",
      },
    ],
    links: [
      { from: "blocks", to: "current_energy", kind: "crosses" },
      { from: "attracts", to: "blocks", kind: "answers" },
      { from: "hidden_desires", to: "current_energy", kind: "underlies" },
      { from: "enhance", to: "future_potential", kind: "leads_to" },
    ],
  },

  tree_of_life: {
    name: "Tree of Life Spread",
    description:
      "A 10-card spread based on the Kabbalistic Tree of Life, providing deep spiritual insights and life guidance",
    cardCount: 10,
    positions: [
      {
        id: "kether",
        name: "Kether (Crown)",
        meaning: "Divine will, highest purpose, and spiritual connection",
        role: "general",
      },
      {
        id: "chokmah",
        name: "Chokmah (Wisdom)",
        meaning: "Creative force, inspiration, and dynamic energy",
        role: "general",
      },
      {
        id: "binah",
        name: "Binah (Understanding)",
        meaning: "Form, structure, and receptive wisdom",
        role: "general",
      },
      {
        id: "chesed",
        name: "Chesed (Mercy)",
        meaning: "Love, compassion, and expansion",
        role: "general",
      },
      {
        id: "geburah",
        name: "Geburah (Severity)",
        meaning: "Strength, discipline, and necessary boundaries",
        role: "general",
      },
      {
        id: "tiphareth",
        name: "Tiphareth (Beauty)",
        meaning: "Balance, harmony, and integration of opposites",
        role: "general",
      },
      {
        id: "netzach",
        name: "Netzach (Victory)",
        meaning: "Emotions, desires, and artistic expression",
        role: "general",
      },
      {
        id: "hod",
        name: "Hod (Splendor)",
        meaning: "Intellect, communication, and analytical thinking",
        role: "general",
      },
      {
        id: "yesod",
        name: "Yesod (Foundation)",
        meaning: "Subconscious, dreams, and psychic impressions",
        role: "hidden",
      },
      {
        id: "malkuth",
        name: "Malkuth (Kingdom)",
        meaning: "Physical manifestation and material world results",
        role: "outcome",
      },
    ],
    links: [
      { from: "chokmah", to: "binah", kind: "mirrors" },
      { from: "chesed", to: "geburah", kind: "mirrors" },
      { from: "netzach", to: "hod", kind: "mirrors" },
      { from: "yesod", to: "malkuth", kind: "underlies" },
      { from: "kether", to: "malkuth", kind: "leads_to" },
    ],
  },

  astrological_houses: {
    name: "Astrological Houses Spread",
    description:
      "A 12-card spread representing the twelve astrological houses, providing comprehensive life insights",
    cardCount: 12,
    positions: [
      {
        id: "house_1",
        name: "1st House - Self and Identity",
        meaning: "Your personality, appearance, and how others see you",
        role: "self",
      },
      {
        id: "house_2",
        name: "2nd House - Values and Resources",
        meaning: "Money, possessions, self-worth, and personal values",
        role: "general",
      },
      {
        id: "house_3",
        name: "3rd House - Communication",
        meaning: "Communication, learning, siblings, and short journeys",
        role: "general",
      },
      {
        id: "house_4",
        name: "4th House - Home and Family",
        meaning: "Home, family, roots, and emotional foundation",
        role: "general",
      },
      {
        id: "house_5",
        name: "5th House - Creativity and Romance",
        meaning: "Creativity, children, romance, and self-expression",
        role: "general",
      },
      {
        id: "house_6",
        name: "6th House - Work and Health",
        meaning: "Daily work, health, service, and routine",
        role: "general",
      },
      {
        id: "house_7",
        name: "7th House - Partnerships",
        meaning: "Marriage, business partnerships, and open enemies",
        role: "general",
      },
      {
        id: "house_8",
        name: "8th House - Transformation",
        meaning: "Shared resources, transformation, and hidden matters",
        role: "general",
      },
      {
        id: "house_9",
        name: "9th House - Philosophy",
        meaning: "Higher learning, philosophy, travel, and spirituality",
        role: "general",
      },
      {
        id: "house_10",
        name: "10th House - Career and Reputation",
        meaning: "Career, reputation, public image, and life direction",
        role: "general",
      },
      {
        id: "house_11",
        name: "11th House - Friends and Aspirations",
        meaning: "Friends, groups, hopes, and future aspirations",
        role: "general",
      },
      {
        id: "house_12",
        name: "12th House - Spirituality and Hidden",
        meaning: "Spirituality, hidden enemies, and subconscious patterns",
        role: "hidden",
      },
    ],
    links: [
      { from: "house_1", to: "house_7", kind: "mirrors" },
      { from: "house_2", to: "house_8", kind: "mirrors" },
      { from: "house_3", to: "house_9", kind: "mirrors" },
      { from: "house_4", to: "house_10", kind: "mirrors" },
      { from: "house_5", to: "house_11", kind: "mirrors" },
      { from: "house_6", to: "house_12", kind: "mirrors" },
    ],
  },

  mandala: {
    name: "Mandala Spread",
    description:
      "A 9-card circular spread representing wholeness and the journey to self-discovery",
    cardCount: 9,
    positions: [
      {
        id: "center",
        name: "Center - Core Self",
        meaning: "Your essential nature and current spiritual center",
        role: "self",
      },
      {
        id: "north",
        name: "North - Spiritual Guidance",
        meaning: "Divine guidance and higher wisdom available to you",
        role: "advice",
      },
      {
        id: "northeast",
        name: "Northeast - Mental Clarity",
        meaning: "Thoughts, ideas, and mental processes that need attention",
        role: "general",
      },
      {
        id: "east",
        name: "East - New Beginnings",
        meaning: "Fresh starts and opportunities on the horizon",
        role: "general",
      },
      {
        id: "southeast",
        name: "Southeast - Relationships",
        meaning: "Your connections with others and social dynamics",
        role: "general",
      },
      {
        id: "south",
        name: "South - Passion and Creativity",
        meaning: "Your creative fire and what energizes you",
        role: "general",
      },
      {
        id: "southwest",
        name: "Southwest - Healing and Release",
        meaning: "What needs to be healed or released from your life",
        role: "challenge",
      },
      {
        id: "west",
        name: "West - Intuition and Emotions",
        meaning: "Your emotional landscape and intuitive insights",
        role: "general",
      },
      {
        id: "northwest",
        name: "Northwest - Wisdom and Knowledge",
        meaning: "Lessons learned and wisdom gained from experience",
        role: "resource",
      },
    ],
    links: [
      { from: "north", to: "south", kind: "mirrors" },
      { from: "northeast", to: "southwest", kind: "mirrors" },
      { from: "east", to: "west", kind: "mirrors" },
      { from: "southeast", to: "northwest", kind: "mirrors" },
    ],
  },

  pentagram: {
    name: "Pentagram Spread",
    description:
      "A 5-card spread based on the five elements, exploring balance and spiritual harmony",
    cardCount: 5,
    positions: [
      {
        id: "spirit",
        name: "Spirit (Top)",
        meaning: "Divine guidance and your highest spiritual purpose",
        role: "message",
      },
      {
        id: "air",
        name: "Air (Upper Right)",
        meaning: "Thoughts, communication, and intellectual matters",
        role: "general",
      },
      {
        id: "fire",
        name: "Fire (Lower Right)",
        meaning: "Passion, action, and creative energy",
        role: "general",
      },
      {
        id: "earth",
        name: "Earth (Lower Left)",
        meaning: "Material world, stability, and practical concerns",
        role: "general",
      },
      {
        id: "water",
        name: "Water (Upper Left)",
        meaning: "Emotions, intuition, and subconscious influences",
        role: "general",
      },
    ],
    links: [
      { from: "fire", to: "water", kind: "tension" },
      { from: "air", to: "earth", kind: "tension" },
    ],
  },

  mirror_of_truth: {
    name: "Mirror of Truth",
    description:
      "A 4-card spread designed to clarify relationship confusion through four beams of light: illuminating your perspective, exploring their intentions, revealing objective truth, and guiding future direction",
    cardCount: 4,
    positions: [
      {
        id: "your_perspective",
        name: "First Light: Illuminate Yourself",
        meaning:
          "Your perspective - how your emotions, inner filters, anxieties, fears, or expectations influence your understanding of the situation",
        role: "self",
      },
      {
        id: "their_intention",
        name: "Second Light: Explore Their Heart",
        meaning:
          "Their intentions - looking beyond surface behavior to explore their true motivations, thoughts, and inner state",
        role: "other",
      },
      {
        id: "objective_truth",
        name: "Third Light: Restore Original Truth",
        meaning:
          "Objective facts - stripping away emotions and subjective judgments to present the most neutral and authentic picture of what happened",
        role: "present",
      },
      {
        id: "future_guidance",
        name: "Fourth Light: Guide Future Direction",
        meaning:
          "Influence and guidance - based on understanding the truth, pointing you toward the direction to move forward and actions to take",
        role: "advice",
      },
    ],
    links: [
      { from: "your_perspective", to: "their_intention", kind: "mirrors" },
      { from: "your_perspective", to: "objective_truth", kind: "tension" },
      { from: "objective_truth", to: "future_guidance", kind: "leads_to" },
    ],
  },

  daily_guidance: {
    name: "Daily Guidance",
    description:
      "A simple one-card draw for daily insight, guidance, and energy focus",
    cardCount: 1,
    positions: [
      {
        id: "guidance",
        name: "Today's Guidance",
        meaning: "The energy, lesson, or guidance you need for today",
        role: "message",
      },
    ],
  },

  yes_no: {
    name: "Yes/No Spread",
    description:
      "A 3-card spread for binary questions, providing clear guidance on yes/no decisions",
    cardCount: 3,
    positions: [
      {
        id: "situation",
        name: "The Situation",
        meaning: "The current circumstances surrounding your question",
        role: "present",
      },
      {
        id: "influences",
        name: "Influences",
        meaning: "Hidden factors and influences affecting the outcome",
        role: "hidden",
      },
      {
        id: "answer",
        name: "Answer",
        meaning: "The guidance and likely answer to your yes/no question",
        role: "outcome",
      },
    ],
    links: [
      { from: "influences", to: "situation", kind: "underlies" },
      { from: "situation", to: "answer", kind: "leads_to" },
    ],
  },

  weekly_forecast: {
    name: "Weekly Forecast",
    description:
      "A 7-card spread providing guidance for each day of the upcoming week",
    cardCount: 7,
    positions: [
      {
        id: "monday",
        name: "Monday",
        meaning:
          "Energy and focus for Monday - new beginnings and fresh starts",
        role: "general",
      },
      {
        id: "tuesday",
        name: "Tuesday",
        meaning: "Energy and focus for Tuesday - action and determination",
        role: "general",
      },
      {
        id: "wednesday",
        name: "Wednesday",
        meaning:
          "Energy and focus for Wednesday - communication and adaptability",
        role: "general",
      },
      {
        id: "thursday",
        name: "Thursday",
        meaning: "Energy and focus for Thursday - expansion and growth",
        role: "general",
      },
      {
        id: "friday",
        name: "Friday",
        meaning:
          "Energy and focus for Friday - love, creativity, and relationships",
        role: "general",
      },
      {
        id: "saturday",
        name: "Saturday",
        meaning: "Energy and focus for Saturday - responsibility and structure",
        role: "general",
      },
      {
        id: "sunday",
        name: "Sunday",
        meaning:
          "Energy and focus for Sunday - rest, reflection, and spiritual connection",
        role: "general",
      },
    ],
    links: [
      { from: "monday", to: "tuesday", kind: "leads_to" },
      { from: "tuesday", to: "wednesday", kind: "leads_to" },
      { from: "wednesday", to: "thursday", kind: "leads_to" },
      { from: "thursday", to: "friday", kind: "leads_to" },
      { from: "friday", to: "saturday", kind: "leads_to" },
      { from: "saturday", to: "sunday", kind: "leads_to" },
    ],
  },

  new_moon_intentions: {
    name: "New Moon Intentions",
    description:
      "A 5-card spread for setting intentions and manifesting new beginnings during the new moon",
    cardCount: 5,
    positions: [
      {
        id: "current_energy",
        name: "Current Energy",
        meaning:
          "Your current spiritual and emotional state as you enter this new cycle",
        role: "present",
      },
      {
        id: "release",
        name: "What to Release",
        meaning: "Old patterns, beliefs, or situations you need to let go of",
        role: "challenge",
      },
      {
        id: "intention",
        name: "Intention to Set",
        meaning:
          "The primary intention or goal to focus on during this lunar cycle",
        role: "advice",
      },
      {
        id: "manifest",
        name: "How to Manifest",
        meaning:
          "Practical steps and energy to put into manifesting your intention",
        role: "action",
      },
      {
        id: "potential_outcome",
        name: "Potential Outcome",
        meaning:
          "What you can expect to achieve by the full moon if you follow this guidance",
        role: "outcome",
      },
    ],
    links: [
      { from: "release", to: "current_energy", kind: "crosses" },
      { from: "intention", to: "release", kind: "tension" },
      { from: "manifest", to: "potential_outcome", kind: "leads_to" },
    ],
  },

  full_moon_release: {
    name: "Full Moon Release",
    description:
      "A 5-card spread for releasing what no longer serves and harvesting the fruits of your efforts",
    cardCount: 5,
    positions: [
      {
        id: "manifested",
        name: "What Has Manifested",
        meaning:
          "What you have successfully created or achieved during this lunar cycle",
        role: "present",
      },
      {
        id: "release",
        name: "What to Release",
        meaning:
          "Emotions, patterns, or situations that need to be released under the full moon",
        role: "challenge",
      },
      {
        id: "hidden_blessings",
        name: "Hidden Blessings",
        meaning:
          "Unexpected gifts or lessons that have emerged during this cycle",
        role: "resource",
      },
      {
        id: "how_to_release",
        name: "How to Release",
        meaning: "The best way to let go and release what no longer serves you",
        role: "action",
      },
      {
        id: "moving_forward",
        name: "Moving Forward",
        meaning:
          "How to carry the wisdom and energy forward into the next cycle",
        role: "advice",
      },
    ],
    links: [
      { from: "release", to: "manifested", kind: "crosses" },
      { from: "how_to_release", to: "release", kind: "answers" },
      { from: "manifested", to: "moving_forward", kind: "leads_to" },
    ],
  },

  elemental_balance: {
    name: "Elemental Balance",
    description:
      "A 4-card spread examining your connection to the four elements for balance and harmony",
    cardCount: 4,
    positions: [
      {
        id: "fire",
        name: "Fire - Passion and Action",
        meaning: "Your creative energy, passion, and ability to take action",
        role: "general",
      },
      {
        id: "water",
        name: "Water - Emotions and Intuition",
        meaning:
          "Your emotional state, intuitive abilities, and flow with life",
        role: "general",
      },
      {
        id: "air",
        name: "Air - Thoughts and Communication",
        meaning:
          "Your mental clarity, communication skills, and intellectual pursuits",
        role: "general",
      },
      {
        id: "earth",
        name: "Earth - Stability and Manifestation",
        meaning:
          "Your grounding, practical matters, and ability to manifest in the physical world",
        role: "general",
      },
    ],
    links: [
      { from: "fire", to: "water", kind: "tension" },
      { from: "air", to: "earth", kind: "tension" },
    ],
  },

  past_life_karma: {
    name: "Past Life Karma",
    description:
      "A 6-card spread exploring karmic patterns and past life influences on your current situation",
    cardCount: 6,
    positions: [
      {
        id: "past_life",
        name: "Past Life Influence",
        meaning:
          "The most relevant past life pattern affecting your current situation",
        role: "foundation",
      },
      {
        id: "karmic_lesson",
        name: "Karmic Lesson",
        meaning: "The lesson your soul is working to learn in this lifetime",
        role: "message",
      },
      {
        id: "karmic_debt",
        name: "Karmic Debt",
        meaning: "What you need to balance or resolve from past actions",
        role: "challenge",
      },
      {
        id: "soul_gifts",
        name: "Soul Gifts",
        meaning:
          "Talents and wisdom you've brought forward from previous lifetimes",
        role: "resource",
      },
      {
        id: "current_challenge",
        name: "Current Challenge",
        meaning:
          "How these karmic patterns are manifesting in your present life",
        role: "challenge",
      },
      {
        id: "path_to_resolution",
        name: "Path to Resolution",
        meaning: "How to heal and transcend these karmic patterns",
        role: "advice",
      },
    ],
    links: [
      { from: "past_life", to: "current_challenge", kind: "leads_to" },
      { from: "soul_gifts", to: "karmic_debt", kind: "answers" },
      { from: "path_to_resolution", to: "current_challenge", kind: "answers" },
    ],
  },

  compatibility: {
    name: "Compatibility Spread",
    description:
      "An 8-card spread for examining compatibility between two people in any type of relationship",
    cardCount: 8,
    positions: [
      {
        id: "person_a",
        name: "Person A - Core Nature",
        meaning: "The essential nature and energy of the first person",
        role: "general",
      },
      {
        id: "person_b",
        name: "Person B - Core Nature",
        meaning: "The essential nature and energy of the second person",
        role: "general",
      },
      {
        id: "attraction",
        name: "What Attracts You",
        meaning: "What draws these two people together",
        role: "resource",
      },
      {
        id: "challenges",
        name: "Potential Challenges",
        meaning: "Areas of conflict or difficulty in the relationship",
        role: "challenge",
      },
      {
        id: "communication",
        name: "Communication Style",
        meaning: "How these two people communicate and understand each other",
        role: "general",
      },
      {
        id: "shared_goals",
        name: "Shared Goals",
        meaning: "Common ground and shared aspirations",
        role: "resource",
      },
      {
        id: "growth_potential",
        name: "Growth Potential",
        meaning: "How this relationship can help both people grow and evolve",
        role: "general",
      },
      {
        id: "long_term_potential",
        name: "Long-term Potential",
        meaning: "The likely future and sustainability of this connection",
        role: "outcome",
      },
    ],
    links: [
      { from: "person_a", to: "person_b", kind: "mirrors" },
      { from: "attraction", to: "challenges", kind: "tension" },
      { from: "shared_goals", to: "challenges", kind: "answers" },
      { from: "growth_potential", to: "long_term_potential", kind: "leads_to" },
    ],
  },
} satisfies Record<SpreadType, TarotSpread>;

/** Stable id for a custom spread, e.g. "My Spread" → "custom_my_spread". */
export function customSpreadTypeId(spreadName: string): string {
  return `custom_${spreadName.toLowerCase().replace(/\s+/g, "_")}`;
}

/**
 * Get a specific spread by name
 */
export function getSpread(name: string): TarotSpread | undefined {
  return (TAROT_SPREADS as Record<string, TarotSpread>)[name];
}

/**
 * Validate if a spread type is supported
 */
export function isValidSpreadType(
  spreadType: string,
): spreadType is SpreadType {
  return spreadType in TAROT_SPREADS;
}
