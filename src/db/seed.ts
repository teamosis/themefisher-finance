import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import fs from "fs";
import path from "path";
import * as schema from "./schema";
import { bankBranches } from "./schema";

async function seed() {
  console.log("🌱 Starting database seed...");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in environment");
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  // Seed Bangladesh Bank Branches
  console.log("🏛️ Checking bank branches dataset...");
  const branchCount = await db.select({ value: count() }).from(bankBranches);
  if (branchCount[0].value === 0) {
    const dataPath = path.join(__dirname, "data", "banks.json");
    let banksData: any;
    if (fs.existsSync(dataPath)) {
      banksData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    } else {
      console.log("  Fetching dataset from GitHub...");
      const res = await fetch(
        "https://raw.githubusercontent.com/MdHRShohel/bd-bank-routing/master/data/banks.json",
      );
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
      const bankName = String(bank.name || "")
        .trim()
        .toUpperCase();

      for (const branch of bank.branches || []) {
        const routing = String(branch.routing || "").trim();
        if (!routing || seenRoutings.has(routing)) continue;
        seenRoutings.add(routing);

        records.push({
          bank_code: bankCode,
          bank_name: bankName,
          district_name: String(branch.district || "")
            .trim()
            .toUpperCase(),
          branch_name: String(branch.name || "")
            .trim()
            .toUpperCase(),
          routing_number: routing,
        });
      }
    }

    console.log(`  Found ${records.length} unique branches to insert.`);
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await db
        .insert(bankBranches)
        .values(batch)
        .onConflictDoNothing({ target: bankBranches.routing_number });
      const percent = Math.min(
        100,
        Math.round(((i + batch.length) / records.length) * 100),
      );
      process.stdout.write(
        `  Inserting branches: ${i + batch.length}/${records.length} (${percent}%)\r`,
      );
    }
    console.log("\n  ✓ Bank branches seeded successfully.");
  } else {
    console.log(
      `  ℹ Bank branches already seeded (${branchCount[0].value} branches present), skipping`,
    );
  }

  console.log("✅ Database seeding complete!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
