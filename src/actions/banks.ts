"use server";

import { db } from "@/db";
import { bankBranches } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

const bankNames = unstable_cache(
  async () => {
    const data = await db
      .selectDistinct({ bankName: bankBranches.bank_name })
      .from(bankBranches)
      .orderBy(asc(bankBranches.bank_name));
    return data.map((d) => d.bankName);
  },
  ["bank-directory-names"],
  { revalidate: 3600 },
);

export async function getBankNames() {
  return bankNames();
}

const branchesByBank = unstable_cache(
  async (bankName: string) => {
    const data = await db
      .select({
        branchName: bankBranches.branch_name,
        districtName: bankBranches.district_name,
        routingNumber: bankBranches.routing_number,
      })
      .from(bankBranches)
      .where(eq(bankBranches.bank_name, bankName))
      .orderBy(asc(bankBranches.branch_name));
    return data;
  },
  ["bank-directory-branches"],
  { revalidate: 3600 },
);

export async function getBranchesByBank(bankName: string) {
  const normalizedName = bankName.trim().toUpperCase();
  const canonicalName = (await bankNames()).find(
    (name) => name.toUpperCase() === normalizedName,
  );
  return canonicalName ? branchesByBank(canonicalName) : [];
}

export async function lookupSwiftCode(swiftCode: string) {
  try {
    if (!swiftCode || swiftCode.length < 8) return null;
    const countryCode = swiftCode.substring(4, 6).toUpperCase();

    const response = await fetch(
      `https://raw.githubusercontent.com/PeterNotenboom/SwiftCodes/master/AllCountries/${countryCode}.json`,
    );
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : data.list;
    if (!list || !Array.isArray(list)) return null;

    let matched = list.find((b: any) => b.swift_code === swiftCode);
    if (!matched) {
      matched = list.find(
        (b: any) =>
          b.swift_code.startsWith(swiftCode) ||
          swiftCode.startsWith(b.swift_code),
      );
    }

    if (matched) {
      return {
        bank_name: matched.bank,
        branch: matched.branch,
        city: matched.city,
        country: countryCode,
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to lookup SWIFT code:", error);
    return null;
  }
}
