/**
 * openpayments_search_manufacturer — Search payments by manufacturer/company name.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { opFetchJson } from "../lib/fetcher.js";
import { buildQuery, eq, like, gte, type Condition } from "../lib/query-builder.js";
import { getDistributionId } from "../lib/distributions.js";
import { formatGeneralPayment, groupByField, sumPayments } from "../lib/formatters.js";

const PROPERTIES = [
  "Covered_Recipient_First_Name",
  "Covered_Recipient_Last_Name",
  "Covered_Recipient_NPI",
  "Covered_Recipient_Specialty_1",
  "Recipient_State",
  "Total_Amount_of_Payment_USDollars",
  "Nature_of_Payment_or_Transfer_of_Value",
  "Date_of_Payment",
  "Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name",
  "Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1",
];

export function registerSearchManufacturer(server: McpServer): void {
  server.tool(
    "openpayments_search_manufacturer",
    "Search CMS Open Payments for all payments made by a specific manufacturer or GPO. Returns individual payments and a summary with total spending and payment type breakdown.",
    {
      manufacturer_name: z.string().describe("Manufacturer or GPO name (e.g. Pfizer, Medtronic, Johnson & Johnson)"),
      state: z.string().optional().describe("Filter recipients by two-letter state abbreviation"),
      payment_nature: z.string().optional().describe("Nature of payment (e.g. Consulting Fee, Food and Beverage, Travel and Lodging, Compensation for services other than consulting)"),
      min_amount: z.number().optional().describe("Minimum payment amount in USD"),
      limit: z.number().min(1).max(100).default(25).describe("Max results (default 25, max 100)"),
    },
    async ({ manufacturer_name, state, payment_nature, min_amount, limit }) => {
      const conditions: Condition[] = [
        like("Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name", manufacturer_name),
      ];

      if (state) {
        conditions.push(eq("Recipient_State", state));
      }
      if (payment_nature) {
        conditions.push(like("Nature_of_Payment_or_Transfer_of_Value", payment_nature));
      }
      if (min_amount !== undefined) {
        conditions.push(gte("Total_Amount_of_Payment_USDollars", String(min_amount)));
      }

      const body = buildQuery({
        conditions,
        properties: PROPERTIES,
        sorts: [{ property: "Total_Amount_of_Payment_USDollars", order: "desc" }],
        limit,
      });

      const data = await opFetchJson(getDistributionId("general"), body);
      const formatted = data.results.map(formatGeneralPayment);

      const byNature = groupByField(data.results, "Nature_of_Payment_or_Transfer_of_Value");
      const totalAmount = sumPayments(data.results);

      // Count unique recipients by NPI
      const uniqueNpis = new Set(data.results.map((r) => r.Covered_Recipient_NPI).filter(Boolean));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total_results: data.count,
                returned: formatted.length,
                payments: formatted,
                summary: {
                  total_payment_amount: Math.round(totalAmount * 100) / 100,
                  unique_recipients: uniqueNpis.size,
                  top_payment_natures: byNature.slice(0, 10),
                },
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
