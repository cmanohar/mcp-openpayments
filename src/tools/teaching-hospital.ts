/**
 * openpayments_teaching_hospital — Search payments to teaching hospitals.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { opFetchJson } from "../lib/fetcher.js";
import { buildQuery, eq, like, gte, type Condition } from "../lib/query-builder.js";
import { getDistributionId } from "../lib/distributions.js";
import { groupByField, sumPayments } from "../lib/formatters.js";

const PROPERTIES = [
  "Teaching_Hospital_Name",
  "Teaching_Hospital_CCN",
  "Recipient_State",
  "Recipient_City",
  "Total_Amount_of_Payment_USDollars",
  "Nature_of_Payment_or_Transfer_of_Value",
  "Date_of_Payment",
  "Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name",
  "Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1",
  "Program_Year",
];

export function registerTeachingHospital(server: McpServer): void {
  server.tool(
    "openpayments_teaching_hospital",
    "Search CMS Open Payments for payments made to teaching hospitals. Returns individual payments and a summary with total spending and payment type breakdown.",
    {
      hospital_name: z.string().optional().describe("Teaching hospital name or partial name"),
      state: z.string().optional().describe("Two-letter state abbreviation"),
      manufacturer_name: z.string().optional().describe("Filter by paying manufacturer name"),
      min_amount: z.number().optional().describe("Minimum payment amount in USD"),
      limit: z.number().min(1).max(100).default(25).describe("Max results (default 25, max 100)"),
    },
    async ({ hospital_name, state, manufacturer_name, min_amount, limit }) => {
      const conditions: Condition[] = [];

      if (hospital_name) {
        conditions.push(like("Teaching_Hospital_Name", hospital_name));
      } else {
        // If no hospital name specified, filter to only teaching hospital records
        conditions.push(like("Teaching_Hospital_Name", "%"));
      }

      if (state) {
        conditions.push(eq("Recipient_State", state));
      }
      if (manufacturer_name) {
        conditions.push(
          like("Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name", manufacturer_name),
        );
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

      const formatted = data.results.map((r) => ({
        hospital_name: r.Teaching_Hospital_Name || null,
        hospital_ccn: r.Teaching_Hospital_CCN || null,
        city: r.Recipient_City || null,
        state: r.Recipient_State || null,
        amount: parseFloat(r.Total_Amount_of_Payment_USDollars) || 0,
        nature: r.Nature_of_Payment_or_Transfer_of_Value || null,
        date: r.Date_of_Payment || null,
        manufacturer: r.Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name || null,
        product: r.Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1 || null,
      }));

      const byNature = groupByField(data.results, "Nature_of_Payment_or_Transfer_of_Value");
      const byManufacturer = groupByField(
        data.results,
        "Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name",
      );
      const totalAmount = sumPayments(data.results);

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
                  total_amount: Math.round(totalAmount * 100) / 100,
                  top_payment_natures: byNature.slice(0, 10),
                  top_manufacturers: byManufacturer.slice(0, 10),
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
