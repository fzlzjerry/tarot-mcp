import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TarotServer } from "./tarot-service.js";
import {
  getVisualAppResourceDefinition,
  readVisualAppResource,
} from "./visual-app-resource.js";
import { VISUAL_APP_RESOURCE_URI } from "./tool-definitions.js";

const CARDS_URI = "tarot://cards";
const SPREADS_URI = "tarot://spreads";

function jsonContents(uri: string, payload: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/**
 * Expose the immutable card and spread catalogs as MCP resources.
 */
export function registerResources(server: Server, tarotServer: TarotServer): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: CARDS_URI,
        name: "Tarot cards",
        description:
          "Summary of all 78 Rider-Waite cards (id, name, arcana, suit, number, element, keywords)",
        mimeType: "application/json",
      },
      {
        uri: SPREADS_URI,
        name: "Tarot spreads",
        description: "All built-in spreads with their positions and meanings",
        mimeType: "application/json",
      },
      getVisualAppResourceDefinition(),
    ],
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: "tarot://cards/{id}",
        name: "Tarot card",
        description: "Full data for one card (meanings, symbolism, astrology)",
        mimeType: "application/json",
      },
      {
        uriTemplate: "tarot://spreads/{type}",
        name: "Tarot spread",
        description: "One spread definition with its positions",
        mimeType: "application/json",
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === VISUAL_APP_RESOURCE_URI) {
      return readVisualAppResource(uri);
    }

    if (uri === CARDS_URI) {
      const cards = tarotServer.getAllCards().map((card) => ({
        id: card.id,
        name: card.name,
        arcana: card.arcana,
        suit: card.suit,
        number: card.number,
        element: card.element,
        keywords: card.keywords,
      }));
      return jsonContents(uri, { cards });
    }

    if (uri === SPREADS_URI) {
      return jsonContents(uri, { spreads: tarotServer.getAvailableSpreads() });
    }

    const cardMatch = /^tarot:\/\/cards\/(.+)$/.exec(uri);
    if (cardMatch) {
      const card = tarotServer.findCard(decodeURIComponent(cardMatch[1]));
      if (!card) {
        throw new Error(`Unknown card: ${cardMatch[1]}`);
      }
      return jsonContents(uri, card);
    }

    const spreadMatch = /^tarot:\/\/spreads\/(.+)$/.exec(uri);
    if (spreadMatch) {
      const type = decodeURIComponent(spreadMatch[1]);
      const spread = tarotServer
        .getAvailableSpreads()
        .find((entry) => entry.type === type);
      if (!spread) {
        throw new Error(`Unknown spread type: ${type}`);
      }
      return jsonContents(uri, spread);
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });
}
