/**
 * openpayments_search_physician — Search payments to physicians by name, NPI, specialty, state.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { opFetchJson } from "../lib/fetcher.js";
import { buildQuery, eq, like, gte, type Condition } from "../lib/query-builder.js";
import { getDistributionId } from "../lib/distributions.js";
import { formatGeneralPayment } from "../lib/formatters.js";

const PROPERTIES = [
  "Covered_Recipient_First_Name",
  "Covered_Recipient_Last_Name",
  "Covered_Recipient_NPI",
  "Covered_Recipient_Specialty_1",
  "Recipient_City",
  "Recipient_State",
  "Total_Amount_of_Payment_USDollars",
  "Nature_of_Payment_or_Transfer_of_Value",
  "Date_of_Payment",
  "Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name",
  "Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1",
  "Program_Year",
];

export function registerSearchPhysician(server: McpServer): void {
  server.tool(
    "openpayments_search_physician",
    "Search CMS Open Payments (Sunshine Act) for payments made to a physician. Returns payment amounts, nature (consulting, speaking, food, travel), manufacturer, and associated products.",
    {
      physician_name: z.string().optional().describe("Physician last name, or 'Last, First' format"),
      npi: z.string().optional().describe("National Provider Identifier (10-digit NPI)"),
      specialty: z.string().optional().describe("Physician specialty (e.g. Orthopedic Surgery, Cardiology)"),
      state: z.string().optional().describe("Two-letter state abbreviation (e.g. CA, NY)"),
      min_amount: z.number().optional().describe("Minimum total payment amount in USD"),
      limit: z.number().min(1).max(100).default(25).describe("Max results (default 25, max 100)"),
    },
    async ({ physician_name, npi, specialty, state, min_amount, limit }) => {
      const conditions: Condition[] = [];

      if (npi) {
        conditions.push(eq("Covered_Recipient_NPI", npi));
      }
      if (physician_name) {
        conditions.push(like("Covered_Recipient_Last_Name", physician_name));
      }
      if (specialty) {
        conditions.push(like("Covered_Recipient_Specialty_1", specialty));
      }
      if (state) {
        conditions.push(eq("Recipient_State", state));
      }
      if (min_amount !== undefined) {
        conditions.push(gte("Total_Amount_of_Payment_USDollars", String(min_amount)));
      }

      if (conditions.length === 0) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Provide at least one search parameter (physician_name, npi, specialty, or state)" }, null, 2) }],
          isError: true,
        };
      }

      const body = buildQuery({
        conditions,
        properties: PROPERTIES,
        sorts: [{ property: "Total_Amount_of_Payment_USDollars", order: "desc" }],
        limit,
      });

      const data = await opFetchJson(getDistributionId("general"), body);
      const formatted = data.results.map(formatGeneralPayment);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { total_results: data.count, returned: formatted.length, payments: formatted },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
