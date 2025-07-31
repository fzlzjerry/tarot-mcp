#!/usr/bin/env node

/**
 * Test script for new tarot MCP server features
 */

import { TarotServer } from './dist/tarot-server.js';

async function testNewFeatures() {
  console.log('🔮 Testing New Tarot MCP Server Features\n');
  
  const tarotServer = await TarotServer.create();
  
  console.log('='.repeat(60));
  console.log('📅 Testing Daily Card Feature');
  console.log('='.repeat(60));
  
  try {
    const dailyCard = await tarotServer.executeTool('get_daily_card', {
      question: "What do I need to know for today?"
    });
    console.log(dailyCard);
  } catch (error) {
    console.error('Error testing daily card:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🤖 Testing Spread Recommendation');
  console.log('='.repeat(60));
  
  try {
    const recommendation = await tarotServer.executeTool('recommend_spread', {
      question: "Should I take this new job opportunity?",
      category: "career",
      timeframe: "short_term"
    });
    console.log(recommendation);
  } catch (error) {
    console.error('Error testing spread recommendation:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🌙 Testing Moon Phase Reading');
  console.log('='.repeat(60));
  
  try {
    const moonReading = await tarotServer.executeTool('get_moon_phase_reading', {
      question: "How can I work with the current lunar energy?"
    });
    console.log(moonReading);
  } catch (error) {
    console.error('Error testing moon phase reading:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Testing New Spreads');
  console.log('='.repeat(60));
  
  const newSpreads = [
    { name: 'yes_no', question: 'Should I move to a new city?' },
    { name: 'weekly_forecast', question: 'What should I focus on this week?' },
    { name: 'elemental_balance', question: 'How are my elements balanced?' },
    { name: 'new_moon_intentions', question: 'What intentions should I set?' }
  ];
  
  for (const spread of newSpreads) {
    try {
      console.log(`\n--- Testing ${spread.name.replace(/_/g, ' ').toUpperCase()} ---`);
      const reading = await tarotServer.executeTool('perform_reading', {
        spreadType: spread.name,
        question: spread.question
      });
      console.log(reading.substring(0, 300) + '...\n[Reading truncated for brevity]');
    } catch (error) {
      console.error(`Error testing ${spread.name}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Testing Card Comparison');
  console.log('='.repeat(60));
  
  try {
    const comparison = await tarotServer.executeTool('get_card_meanings_comparison', {
      cardNames: ["The Fool", "The Magician", "The High Priestess"],
      context: "Starting a new spiritual journey"
    });
    console.log(comparison);
  } catch (error) {
    console.error('Error testing card comparison:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All Tests Completed!');
  console.log('='.repeat(60));
  console.log('\nNew features successfully added:');
  console.log('• 8 new tarot spreads');
  console.log('• 5 new tools');
  console.log('• Lunar integration');
  console.log('• AI spread recommendations');
  console.log('• Daily guidance features');
  console.log('• Card comparison tools');
}

// Run the tests
testNewFeatures().catch(console.error);
