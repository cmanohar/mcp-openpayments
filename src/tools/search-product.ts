/**
 * openpayments_search_product — Search payments associated with a drug or device.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { opFetchJson } from "../lib/fetcher.js";
import { buildQuery, like, type Condition } from "../lib/query-builder.js";
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
  "Indicate_Drug_or_Biological_or_Device_or_Medical_Supply_1",
];

export function registerSearchProduct(server: McpServer): void {
  server.tool(
    "openpayments_search_product",
    "Search CMS Open Payments for payments associated with a specific drug, biological, or medical device. Returns payments and a summary with total spending and top specialties receiving payments.",
    {
      product_name: z.string().describe("Drug or device name (e.g. Keytruda, Mako, Ozempic, DaVinci)"),
      product_type: z
        .enum(["Drug", "Device", "Biological", "Medical Supply"])
        .optional()
        .describe("Filter by product type"),
      limit: z.number().min(1).max(100).default(25).describe("Max results (default 25, max 100)"),
    },
    async ({ product_name, product_type, limit }) => {
      const conditions: Condition[] = [
        like("Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1", product_name),
      ];

      if (product_type) {
        conditions.push(
          like("Indicate_Drug_or_Biological_or_Device_or_Medical_Supply_1", product_type),
        );
      }

      const body = buildQuery({
        conditions,
        properties: PROPERTIES,
        sorts: [{ property: "Total_Amount_of_Payment_USDollars", order: "desc" }],
        limit,
      });

      const data = await opFetchJson(getDistributionId("general"), body);
      const formatted = data.results.map(formatGeneralPayment);

      const bySpecialty = groupByField(data.results, "Covered_Recipient_Specialty_1");
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
                product: product_name,
                payments: formatted,
                summary: {
                  total_spending: Math.round(totalAmount * 100) / 100,
                  unique_manufacturers: byManufacturer.length,
                  top_specialties: bySpecialty.slice(0, 10),
                  manufacturers: byManufacturer.slice(0, 5),
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
