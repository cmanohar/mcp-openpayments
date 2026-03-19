/**
 * openpayments_physician_profile — Comprehensive payment profile for a physician.
 *
 * Queries both General and Research distributions to build a complete picture.
 * Uses pagination to aggregate up to 2000 records per distribution.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { opFetchAll } from "../lib/fetcher.js";
import { buildQuery, eq, like, type Condition } from "../lib/query-builder.js";
import { getDistributionId } from "../lib/distributions.js";
import { sumPayments, groupByField, topN } from "../lib/formatters.js";

const GENERAL_PROPERTIES = [
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

const RESEARCH_PROPERTIES = [
  "Covered_Recipient_First_Name",
  "Covered_Recipient_Last_Name",
  "Covered_Recipient_NPI",
  "Covered_Recipient_Specialty_1",
  "Recipient_City",
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

export function registerPhysicianProfile(server: McpServer): void {
  server.tool(
    "openpayments_physician_profile",
    "Get a comprehensive Open Payments profile for a physician — total general and research payments, breakdown by payment nature (consulting, speaking, food, travel, research), top paying manufacturers, and recent payments. Queries both General and Research payment datasets.",
    {
      physician_name: z.string().optional().describe("Physician last name, or 'Last, First' format"),
      npi: z.string().optional().describe("National Provider Identifier (10-digit). Preferred for exact match."),
    },
    async ({ physician_name, npi }) => {
      if (!physician_name && !npi) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Provide at least physician_name or npi" }, null, 2) }],
          isError: true,
        };
      }

      // Build conditions for both queries
      const conditions: Condition[] = [];
      if (npi) {
        conditions.push(eq("Covered_Recipient_NPI", npi));
      }
      if (physician_name) {
        conditions.push(like("Covered_Recipient_Last_Name", physician_name));
      }

      // Fetch general payments
      const generalBody = buildQuery({
        conditions,
        properties: GENERAL_PROPERTIES,
        sorts: [{ property: "Total_Amount_of_Payment_USDollars", order: "desc" }],
        limit: 500,
      });
      const general = await opFetchAll(getDistributionId("general"), generalBody, 2000);

      // Fetch research payments
      const researchBody = buildQuery({
        conditions,
        properties: RESEARCH_PROPERTIES,
        sorts: [{ property: "Total_Amount_of_Payment_USDollars", order: "desc" }],
        limit: 500,
      });
      const research = await opFetchAll(getDistributionId("research"), researchBody, 2000);

      // Aggregate
      const generalTotal = sumPayments(general.results);
      const researchTotal = sumPayments(research.results);

      const byNature = groupByField(
        general.results,
        "Nature_of_Payment_or_Transfer_of_Value",
      );

      const byManufacturer = groupByField(
        [...general.results, ...research.results],
        "Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name",
      );

      // Get physician info from first available record
      const firstRecord = general.results[0] ?? research.results[0];
      const physician = firstRecord
        ? {
            name: [firstRecord.Covered_Recipient_Last_Name, firstRecord.Covered_Recipient_First_Name]
              .filter(Boolean)
              .join(", "),
            npi: firstRecord.Covered_Recipient_NPI || npi || null,
            specialty: firstRecord.Covered_Recipient_Specialty_1 || null,
            city: firstRecord.Recipient_City || null,
            state: firstRecord.Recipient_State || null,
          }
        : { name: physician_name || null, npi: npi || null, specialty: null, city: null, state: null };

      // Recent payments (top 10 by date from general)
      const recentPayments = [...general.results]
        .filter((r) => r.Date_of_Payment)
        .sort((a, b) => (b.Date_of_Payment || "").localeCompare(a.Date_of_Payment || ""))
        .slice(0, 10)
        .map((r) => ({
          date: r.Date_of_Payment,
          manufacturer: r.Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name,
          amount: parseFloat(r.Total_Amount_of_Payment_USDollars) || 0,
          nature: r.Nature_of_Payment_or_Transfer_of_Value,
        }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                physician,
                summary: {
                  total_general_payments: Math.round(generalTotal * 100) / 100,
                  total_research_payments: Math.round(researchTotal * 100) / 100,
                  grand_total: Math.round((generalTotal + researchTotal) * 100) / 100,
                  general_payment_count: general.count,
                  research_payment_count: research.count,
                },
                by_nature: byNature.slice(0, 10),
                top_payers: topN(byManufacturer, 10, "total"),
                recent_payments: recentPayments,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
