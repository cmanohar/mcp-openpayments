#!/usr/bin/env node

/**
 * mcp-openpayments — MCP server for CMS Open Payments (Sunshine Act) data.
 *
 * Wraps the Open Payments DKAN API to search physician-industry payments,
 * manufacturer spending, research funding, and teaching hospital payments.
 *
 * No API key required — all data is public.
 *
 * Usage:
 *   node dist/index.js   # stdio transport
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerSearchPhysician } from "./tools/search-physician.js";
import { registerSearchManufacturer } from "./tools/search-manufacturer.js";
import { registerSearchProduct } from "./tools/search-product.js";
import { registerPhysicianProfile } from "./tools/physician-profile.js";
import { registerResearchPayments } from "./tools/research-payments.js";
import { registerTeachingHospital } from "./tools/teaching-hospital.js";

const server = new McpServer({
  name: "mcp-openpayments",
  version: "0.1.0",
});

// Register all 6 tools
registerSearchPhysician(server);
registerSearchManufacturer(server);
registerSearchProduct(server);
registerPhysicianProfile(server);
registerResearchPayments(server);
registerTeachingHospital(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-openpayments server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
