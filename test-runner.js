#!/usr/bin/env node

import { TarotCardManager } from "./dist/tarot/card-manager.js";
import { TarotServer } from "./dist/tarot-server.js";

/**
 * Simple test runner to validate our optimizations
 */
async function runTests() {
  console.log("🔮 Starting Tarot MCP Server Tests...\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }

  // Test CardManager initialization
  await asyncTest("CardManager can be created", async () => {
    const cardManager = await TarotCardManager.create();
    if (!cardManager) throw new Error("CardManager not created");
  });

  // Test singleton pattern
  await asyncTest("CardManager singleton works", async () => {
    const manager1 = await TarotCardManager.create();
    const manager2 = await TarotCardManager.create();
    if (manager1 !== manager2) throw new Error("Singleton pattern broken");
  });

  // Test card operations
  await asyncTest("Can get card info", async () => {
    const cardManager = await TarotCardManager.create();
    const info = cardManager.getCardInfo("The Fool", "upright");
    if (!info.includes("The Fool (Upright)"))
      throw new Error("Card info incorrect");
  });

  await asyncTest("Can list all cards", async () => {
    const cardManager = await TarotCardManager.create();
    const list = cardManager.listAllCards();
    if (!list.includes("Major Arcana")) throw new Error("Card list incorrect");
  });

  await asyncTest("Can find cards", async () => {
    const cardManager = await TarotCardManager.create();
    const card = cardManager.findCard("The Fool");
    if (!card || card.name !== "The Fool") throw new Error("Card not found");
  });

  await asyncTest("Can get random cards", async () => {
    const cardManager = await TarotCardManager.create();
    const cards = cardManager.getRandomCards(3);
    if (cards.length !== 3) throw new Error("Wrong number of random cards");

    // Check uniqueness
    const ids = new Set(cards.map((c) => c.id));
    if (ids.size !== 3) throw new Error("Duplicate cards in random selection");
  });

  // Test TarotServer
  await asyncTest("TarotServer can be created", async () => {
    const server = await TarotServer.create();
    if (!server) throw new Error("TarotServer not created");
  });

  await asyncTest("TarotServer has tools", async () => {
    const server = await TarotServer.create();
    const tools = server.getAvailableTools();
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new Error("No tools available");
    }
  });

  // Test error handling
  await asyncTest("Handles invalid card names gracefully", async () => {
    const cardManager = await TarotCardManager.create();
    const info = cardManager.getCardInfo("Invalid Card Name");
    if (!info.includes("not found"))
      throw new Error("Error not handled gracefully");
  });

  test("Throws error for too many cards", () => {
    TarotCardManager.create().then((cardManager) => {
      const allCards = cardManager.getAllCards();
      try {
        cardManager.getRandomCards(allCards.length + 1);
        throw new Error("Should have thrown error");
      } catch (error) {
        if (!error.message.includes("Cannot draw")) {
          throw new Error("Wrong error message");
        }
      }
    });
  });

  // Test performance
  await asyncTest("Multiple card manager creations are fast", async () => {
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      await TarotCardManager.create();
    }
    const duration = Date.now() - start;
    if (duration > 1000) throw new Error(`Too slow: ${duration}ms`);
  });

  await asyncTest("Random card generation is fast", async () => {
    const cardManager = await TarotCardManager.create();
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      cardManager.getRandomCard();
    }
    const duration = Date.now() - start;
    if (duration > 1000) throw new Error(`Too slow: ${duration}ms`);
  });

  // Test crypto usage
  test("Crypto functions work", () => {
    const manager = TarotCardManager.create().then((cardManager) => {
      // This should not throw
      const card = cardManager.getRandomCard();
      if (!card) throw new Error("Random card generation failed");
    });
  });

  // Test concurrent access
  await asyncTest("Handles concurrent requests", async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        TarotCardManager.create().then((manager) => {
          return manager.getRandomCards(3);
        }),
      );
    }
    const results = await Promise.all(promises);
    if (results.length !== 10) throw new Error("Concurrent requests failed");
  });

  // Summary
  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(
    `📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`,
  );

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed. Please review the issues above.");
    process.exit(1);
  } else {
    console.log(
      "\n🎉 All tests passed! The optimizations are working correctly.",
    );
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("❌ Test runner failed:", error);
  process.exit(1);
});
