/**
 * openpayments_research_payments — Search research payments (clinical studies, grants).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { opFetchJson } from "../lib/fetcher.js";
import { buildQuery, eq, like, gte, type Condition } from "../lib/query-builder.js";
import { getDistributionId } from "../lib/distributions.js";
import { formatResearchPayment } from "../lib/formatters.js";

const PROPERTIES = [
  "Covered_Recipient_First_Name",
  "Covered_Recipient_Last_Name",
  "Covered_Recipient_NPI",
  "Covered_Recipient_Specialty_1",
  "Recipient_State",
  "Total_Amount_of_Payment_USDollars",
  "Date_of_Payment",
  "Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name",
  "Name_of_Study",
  "ClinicalTrials_Gov_Identifier",
  "Context_of_Research",
  "Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1",
  "Program_Year",
];

export function registerResearchPayments(server: McpServer): void {
  server.tool(
    "openpayments_research_payments",
    "Search CMS Open Payments for research payments — clinical studies, grants, and research funding from manufacturers to physicians. Returns study names, NCT numbers, principal investigators, and funding amounts.",
    {
      physician_name: z.string().optional().describe("Principal investigator last name"),
      npi: z.string().optional().describe("PI's National Provider Identifier (10-digit NPI)"),
      manufacturer_name: z.string().optional().describe("Research funder/manufacturer name (e.g. Merck, Genentech)"),
      study_name: z.string().optional().describe("Clinical study or research name keyword"),
      min_amount: z.number().optional().describe("Minimum research payment amount in USD"),
      limit: z.number().min(1).max(100).default(25).describe("Max results (default 25, max 100)"),
    },
    async ({ physician_name, npi, manufacturer_name, study_name, min_amount, limit }) => {
      const conditions: Condition[] = [];

      if (npi) {
        conditions.push(eq("Covered_Recipient_NPI", npi));
      }
      if (physician_name) {
        conditions.push(like("Covered_Recipient_Last_Name", physician_name));
      }
      if (manufacturer_name) {
        conditions.push(
          like("Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name", manufacturer_name),
        );
      }
      if (study_name) {
        conditions.push(like("Name_of_Study", study_name));
      }
      if (min_amount !== undefined) {
        conditions.push(gte("Total_Amount_of_Payment_USDollars", String(min_amount)));
      }

      if (conditions.length === 0) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Provide at least one search parameter" }, null, 2) }],
          isError: true,
        };
      }

      const body = buildQuery({
        conditions,
        properties: PROPERTIES,
        sorts: [{ property: "Total_Amount_of_Payment_USDollars", order: "desc" }],
        limit,
      });

      const data = await opFetchJson(getDistributionId("research"), body);
      const formatted = data.results.map(formatResearchPayment);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { total_results: data.count, returned: formatted.length, research_payments: formatted },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
