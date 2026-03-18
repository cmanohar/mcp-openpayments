/**
 * Formatters for CMS Open Payments data.
 *
 * The API returns verbose column names like:
 *   Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name
 * We map these to clean, short keys for LLM consumption.
 */

// ── Column mappings ──

const GENERAL_FIELD_MAP: Record<string, string> = {
  Covered_Recipient_First_Name: "first_name",
  Covered_Recipient_Last_Name: "last_name",
  Covered_Recipient_NPI: "npi",
  Covered_Recipient_Specialty_1: "specialty",
  Covered_Recipient_Primary_Type_1: "recipient_type",
  Recipient_City: "city",
  Recipient_State: "state",
  Recipient_Zip_Code: "zip",
  Total_Amount_of_Payment_USDollars: "amount",
  Nature_of_Payment_or_Transfer_of_Value: "nature",
  Form_of_Payment_or_Transfer_of_Value: "form",
  Date_of_Payment: "date",
  Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name: "manufacturer",
  Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_1: "product_1",
  Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_2: "product_2",
  Name_of_Drug_or_Biological_or_Device_or_Medical_Supply_3: "product_3",
  Teaching_Hospital_Name: "teaching_hospital",
  Teaching_Hospital_CCN: "teaching_hospital_ccn",
  Program_Year: "year",
  Record_ID: "record_id",
};

const RESEARCH_FIELD_MAP: Record<string, string> = {
  ...GENERAL_FIELD_MAP,
  Name_of_Study: "study_name",
  ClinicalTrials_Gov_Identifier: "nct_number",
  Context_of_Research: "research_context",
};

// ── Record formatters ──

function mapRecord(
  record: Record<string, string>,
  fieldMap: Record<string, string>,
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [rawKey, cleanKey] of Object.entries(fieldMap)) {
    const val = record[rawKey];
    if (val !== undefined && val !== null && val !== "") {
      // Parse amount fields as numbers
      if (cleanKey === "amount") {
        out[cleanKey] = parseFloat(val) || 0;
      } else {
        out[cleanKey] = val;
      }
    }
  }
  // Build full name if both parts present
  if (out.first_name && out.last_name) {
    out.physician_name = `${out.last_name}, ${out.first_name}`;
  }
  // Combine products into single field (first non-empty)
  const product =
    out.product_1 || out.product_2 || out.product_3 || null;
  if (product) {
    out.product = product;
  }
  delete out.product_1;
  delete out.product_2;
  delete out.product_3;
  delete out.first_name;
  delete out.last_name;
  return out;
}

/** Format a general payment record. */
export function formatGeneralPayment(
  record: Record<string, string>,
): Record<string, string | number | null> {
  return mapRecord(record, GENERAL_FIELD_MAP);
}

/** Format a research payment record. */
export function formatResearchPayment(
  record: Record<string, string>,
): Record<string, string | number | null> {
  return mapRecord(record, RESEARCH_FIELD_MAP);
}

// ── Aggregation helpers ──

/** Sum a numeric field across records. */
export function sumPayments(
  records: Record<string, string>[],
  amountField: string = "Total_Amount_of_Payment_USDollars",
): number {
  return records.reduce((sum, r) => sum + (parseFloat(r[amountField]) || 0), 0);
}

/** Group records by a field, summing amounts and counting occurrences. */
export function groupByField(
  records: Record<string, string>[],
  field: string,
  amountField: string = "Total_Amount_of_Payment_USDollars",
): Array<{ key: string; total: number; count: number }> {
  const groups = new Map<string, { total: number; count: number }>();

  for (const r of records) {
    const key = r[field] || "Unknown";
    const existing = groups.get(key) ?? { total: 0, count: 0 };
    existing.total += parseFloat(r[amountField]) || 0;
    existing.count += 1;
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .map(([key, v]) => ({
      key,
      total: Math.round(v.total * 100) / 100,
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Return the top N items from an array sorted by a numeric key. */
export function topN<T extends Record<string, unknown>>(
  items: T[],
  n: number,
  sortKey: keyof T,
): T[] {
  return [...items]
    .sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))
    .slice(0, n);
}
