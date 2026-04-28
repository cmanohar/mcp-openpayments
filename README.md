# mcp-openpayments

MCP server for CMS Open Payments (Sunshine Act) — search physician-industry payments, manufacturer spending, research funding, and teaching hospital payments. No API key required.

## What is Open Payments?

The [CMS Open Payments program](https://openpaymentsdata.cms.gov/) (Sunshine Act) requires pharmaceutical and medical device manufacturers to publicly report all payments and transfers of value made to physicians and teaching hospitals. This includes consulting fees, speaking honoraria, food and travel, research grants, and more. This server wraps the Open Payments public API to make that data queryable through any MCP-compatible client.

## Tools

| Tool | Description |
|------|-------------|
| `openpayments_search_physician` | Search payments to a physician by name, NPI, specialty, or state |
| `openpayments_physician_profile` | Full payment profile — general + research totals, breakdown by nature, top payers |
| `openpayments_search_manufacturer` | All payments made by a specific manufacturer or GPO |
| `openpayments_search_product` | Payments associated with a specific drug, device, or biological |
| `openpayments_research_payments` | Clinical study and research grant payments by PI, funder, or study name |
| `openpayments_teaching_hospital` | Payments made to teaching hospitals |

## Prerequisites

- Node.js >= 18
- No API key — all CMS Open Payments data is public

## Installation

```bash
git clone https://github.com/cmanohar/mcp-openpayments.git
cd mcp-openpayments
npm install
npm run build
```

The compiled server will be at `dist/index.js`.

## Adding to an MCP Client

This server uses stdio transport. Any MCP-compatible client (Claude Desktop, Claude Code, Cursor, etc.) accepts the same configuration shape:

```json
{
  "mcpServers": {
    "openpayments": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-openpayments/dist/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/mcp-openpayments` with the actual path where you cloned the repo.

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows), then restart Claude.

**Claude Code** — add to `.mcp.json` in your project root, or run:
```bash
claude mcp add openpayments node /absolute/path/to/mcp-openpayments/dist/index.js
```

After configuring, verify the server is connected by asking your client to list available tools.

---

## Tool Reference

### `openpayments_search_physician`

Search CMS Open Payments for payments made to a physician. Returns payment amounts, nature (consulting, speaking, food, travel), manufacturer, and associated products.

At least one search parameter is required.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `physician_name` | string | no | Last name, or `"Last, First"` format |
| `npi` | string | no | 10-digit National Provider Identifier |
| `specialty` | string | no | Specialty (e.g. `Orthopedic Surgery`, `Cardiology`) |
| `state` | string | no | Two-letter state code (e.g. `CA`, `NY`) |
| `min_amount` | number | no | Minimum payment amount in USD |
| `limit` | number | no | Max results; default 25, max 100 |

**Example queries**
- *"How much has Pfizer paid cardiologists in Texas?"*
- *"Show me payments to Dr. Smith with NPI 1234567890"*
- *"Find consulting fees over $10,000 to orthopedic surgeons in California"*

---

### `openpayments_physician_profile`

Comprehensive Open Payments profile for a physician. Aggregates both General and Research payment datasets (up to 2,000 records each) and returns total payments, breakdown by payment nature, top paying manufacturers, and the 10 most recent payments.

At least one of `physician_name` or `npi` is required. NPI is preferred for an exact match.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `physician_name` | string | no | Last name, or `"Last, First"` format |
| `npi` | string | no | 10-digit NPI — use this for an exact match |

**Example queries**
- *"Give me a full payment profile for NPI 1234567890"*
- *"How much total industry funding has Dr. Johnson received?"*
- *"What are the top companies paying Dr. Chen?"*

---

### `openpayments_search_manufacturer`

Search all payments made by a specific manufacturer or GPO. Returns individual payment records and a summary with total spending, unique recipient count, and breakdown by payment type.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `manufacturer_name` | string | **yes** | Manufacturer or GPO name (e.g. `Pfizer`, `Medtronic`) |
| `state` | string | no | Filter recipients by two-letter state code |
| `payment_nature` | string | no | Nature of payment (e.g. `Consulting Fee`, `Food and Beverage`) |
| `min_amount` | number | no | Minimum payment amount in USD |
| `limit` | number | no | Max results; default 25, max 100 |

**Example queries**
- *"How much did Medtronic spend on consulting fees last year?"*
- *"Show me all Pfizer payments to physicians in New York"*
- *"What speaking honoraria has Eli Lilly paid?"*

---

### `openpayments_search_product`

Search payments associated with a specific drug, biological, or medical device. Returns payment records and a summary with total spending, top physician specialties, and top manufacturers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_name` | string | **yes** | Drug or device name (e.g. `Keytruda`, `Ozempic`, `Mako`) |
| `product_type` | enum | no | `Drug`, `Device`, `Biological`, or `Medical Supply` |
| `limit` | number | no | Max results; default 25, max 100 |

**Example queries**
- *"What payments were made in connection with Ozempic?"*
- *"Which specialties received the most payments associated with Keytruda?"*
- *"Show me device payments for the Mako robotic system"*

---

### `openpayments_research_payments`

Search research payments — clinical studies, grants, and research funding from manufacturers to physicians. Returns study names, NCT numbers (ClinicalTrials.gov identifiers), principal investigators, and funding amounts.

At least one search parameter is required.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `physician_name` | string | no | Principal investigator last name |
| `npi` | string | no | PI's 10-digit NPI |
| `manufacturer_name` | string | no | Research funder name (e.g. `Merck`, `Genentech`) |
| `study_name` | string | no | Clinical study or research name keyword |
| `min_amount` | number | no | Minimum research payment amount in USD |
| `limit` | number | no | Max results; default 25, max 100 |

**Example queries**
- *"What clinical studies is Merck funding in oncology?"*
- *"Find research payments for studies related to GLP-1"*
- *"How much research funding has Dr. Patel received from industry?"*

---

### `openpayments_teaching_hospital`

Search payments made to teaching hospitals. Returns individual payment records and a summary with total spending, payment type breakdown, and top paying manufacturers.

At least one search parameter is recommended. If none are provided, the tool returns a broad sample of teaching hospital payments.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hospital_name` | string | no | Teaching hospital name or partial name |
| `state` | string | no | Two-letter state code |
| `manufacturer_name` | string | no | Filter by paying manufacturer |
| `min_amount` | number | no | Minimum payment amount in USD |
| `limit` | number | no | Max results; default 25, max 100 |

**Example queries**
- *"What has Stryker paid to teaching hospitals in California?"*
- *"Show payments to Mass General from device manufacturers"*
- *"Which teaching hospitals receive the most from Abbott?"*

---

## Data Notes

- **Dataset year:** 2024 (published by CMS in the annual Sunshine Act disclosure cycle)
- **Coverage:** General payments (consulting, speaking, food, travel, gifts) and Research payments (clinical studies, grants). Ownership/investment data is not yet exposed.
- **Annual refresh:** CMS publishes updated data each year. The distribution UUIDs that identify each dataset are hardcoded in `src/lib/distributions.ts`. When 2025 data is released, update those IDs to point to the new distributions.
- **No auth required:** All data is public. No API key or credentials needed.

## Development

```bash
npm run build      # Compile TypeScript → dist/
npm run dev        # Watch mode (recompiles on change)
npm test           # Run tests with Vitest
npm run test:watch # Watch mode for tests
npm start          # Run the compiled server
```

## License

MIT — Chinmay Patil
