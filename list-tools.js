#!/usr/bin/env node

/**
 * List all available tools in the tarot MCP server
 */

import { TarotServer } from './dist/tarot-server.js';

async function listTools() {
  console.log('🔮 Tarot MCP Server - Available Tools\n');
  
  const tarotServer = await TarotServer.create();
  const tools = tarotServer.getAvailableTools();
  
  console.log(`Total tools available: ${tools.length}\n`);
  console.log('='.repeat(60));
  
  tools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name}`);
    console.log(`   Description: ${tool.description}`);
    console.log('');
  });
  
  console.log('='.repeat(60));
  console.log('\nNew tools added in this update:');
  console.log('• get_daily_card - Daily guidance card pull');
  console.log('• recommend_spread - AI-powered spread recommendations');
  console.log('• get_moon_phase_reading - Lunar-aligned readings');
  console.log('• get_card_meanings_comparison - Multi-card analysis');
}

// Run the tool listing
listTools().catch(console.error);
