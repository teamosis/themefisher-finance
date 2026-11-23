import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { debitAccounts, paymentAccounts, clients, vendors, bankBranches } from "./schema";
import { count } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting database seed...");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in environment");
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  // 1. Seed Debit Accounts
  console.log("💳 Seeding debit accounts...");
  const debitAccountCount = await db.select({ value: count() }).from(debitAccounts);
  if (debitAccountCount[0].value === 0) {
    const scbDebitAccount = process.env.NEXT_PUBLIC_SCB_DEBIT_ACCOUNT || "0001914137101";
    await db.insert(debitAccounts).values([
      {
        account_number: scbDebitAccount,
        account_label: "Main SCB Account",
        bank_name: "Standard Chartered Bank",
        is_default: true,
      },
    ]);
    console.log("  ✓ Created default SCB debit account");
  } else {
    console.log("  ℹ Debit accounts already exist, skipping");
  }

  // 2. Seed Payment Accounts
  console.log("🏦 Seeding payment receiving accounts...");
  const paymentAccountCount = await db.select({ value: count() }).from(paymentAccounts);
  if (paymentAccountCount[0].value === 0) {
    const scbAccount = process.env.NEXT_PUBLIC_SCB_DEBIT_ACCOUNT || "0001914137101";
    await db.insert(paymentAccounts).values([
      {
        bank_name: "Standard Chartered Bank",
        bank_address: "67 Gulshan Avenue, Gulshan, Dhaka 1212, Bangladesh",
        name_on_account: "Themefisher",
        bic_swift: "SCBLBDDXXXX",
        account_number: scbAccount,
        account_name: "Standard Chartered Bank",
        account_details: `Name on Account: Themefisher\nAccount Number: ${scbAccount}\nBIC/SWIFT: SCBLBDDXXXX\nBank Address: 67 Gulshan Avenue, Gulshan, Dhaka 1212, Bangladesh`,
      },
    ]);
    console.log("  ✓ Created default receiving payment account (SCB)");
  } else {
    console.log("  ℹ Payment accounts already exist, skipping");
  }

  // 3. Seed Initial Clients
  console.log("👥 Seeding clients...");
  const clientCount = await db.select({ value: count() }).from(clients);
  if (clientCount[0].value === 0) {
    await db.insert(clients).values([
      {
        name: "Envato Pty Ltd",
        address: "PO Box 16122, Collins Street West, Victoria 8007, Australia",
        tax_id: "ABN 11 119 523 263",
        bank_name: "Australia and New Zealand Banking Group Limited",
        bank_address: "833 Collins Street, Docklands, Victoria 3008, Australia",
      },
      {
        name: "Stripe Payments Europe, Ltd.",
        address: "1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Ireland",
        tax_id: "IE 3206488LH",
        bank_name: "Citibank Europe PLC",
        bank_address: "1 North Wall Quay, Dublin 1, Ireland",
      },
      {
        name: "Bright Market, LLC (FastSpring)",
        address: "801 Garden St, Suite 201, Santa Barbara, CA 93101, USA",
        tax_id: "US 20-3944641",
        bank_name: "JPMorgan Chase Bank, N.A.",
        bank_address: "270 Park Ave, New York, NY 10017, USA",
      },
    ]);
    console.log("  ✓ Seeded default international clients");
  } else {
    console.log("  ℹ Clients already exist, skipping");
  }

  // 4. Seed Initial Vendors & Team Employees
  console.log("💼 Seeding vendors and employees...");
  const vendorCount = await db.select({ value: count() }).from(vendors);
  if (vendorCount[0].value === 0) {
    await db.insert(vendors).values([
      {
        receiver_name: "MD SOMRAT ALI",
        account_number: "1182200000001",
        bank_name: "STANDARD CHARTERED BANK",
        branch_name: "GULSHAN",
        routing_number: "215261882",
        is_employee: true,
        is_hidden: false,
        salary: "100000",
      },
      {
        receiver_name: "MEHEDI HASAN",
        account_number: "1182200000002",
        bank_name: "BRAC BANK PLC",
        branch_name: "GULSHAN",
        routing_number: "060261882",
        is_employee: true,
        is_hidden: false,
        salary: "80000",
      },
      {
        receiver_name: "TUHIN SARKER",
        account_number: "1182200000003",
        bank_name: "THE CITY BANK LTD.",
        branch_name: "PRINCIPAL",
        routing_number: "225272635",
        is_employee: true,
        is_hidden: false,
        salary: "90000",
      },
      {
        receiver_name: "CLOUDFLARE INC",
        account_number: "1182200000004",
        bank_name: "STANDARD CHARTERED BANK",
        branch_name: "GULSHAN",
        routing_number: "215261882",
        is_employee: false,
        is_hidden: false,
        salary: "0",
      },
    ]);
    console.log("  ✓ Seeded initial employees and vendors");
  } else {
    console.log("  ℹ Vendors already exist, skipping");
  }

  // 5. Seed Bangladesh Bank Branches
  console.log("🏛️ Checking bank branches dataset...");
  const branchCount = await db.select({ value: count() }).from(bankBranches);
  if (branchCount[0].value === 0) {
    const dataPath = path.join(__dirname, "data", "banks.json");
    let banksData: any;
    if (fs.existsSync(dataPath)) {
      banksData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    } else {
      console.log("  Fetching dataset from GitHub...");
      const res = await fetch("https://raw.githubusercontent.com/MdHRShohel/bd-bank-routing/master/data/banks.json");
      banksData = await res.json();
    }

    const records: Array<{
      bank_code: string;
      bank_name: string;
      district_name: string;
      branch_name: string;
      routing_number: string;
    }> = [];

    const seenRoutings = new Set<string>();

    for (const bank of banksData.banks || []) {
      const bankCode = String(bank.code || "").padStart(3, "0");
      const bankName = String(bank.name || "").trim().toUpperCase();

      for (const branch of bank.branches || []) {
        const routing = String(branch.routing || "").trim();
        if (!routing || seenRoutings.has(routing)) continue;
        seenRoutings.add(routing);

        records.push({
          bank_code: bankCode,
          bank_name: bankName,
          district_name: String(branch.district || "").trim().toUpperCase(),
          branch_name: String(branch.name || "").trim().toUpperCase(),
          routing_number: routing,
        });
      }
    }

    console.log(`  Found ${records.length} unique branches to insert.`);
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await db.insert(bankBranches).values(batch).onConflictDoNothing({ target: bankBranches.routing_number });
      const percent = Math.min(100, Math.round(((i + batch.length) / records.length) * 100));
      process.stdout.write(`  Inserting branches: ${i + batch.length}/${records.length} (${percent}%)\r`);
    }
    console.log("\n  ✓ Bank branches seeded successfully.");
  } else {
    console.log(`  ℹ Bank branches already seeded (${branchCount[0].value} branches present), skipping`);
  }

  console.log("✅ Database seeding complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
