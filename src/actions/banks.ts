"use server";

import { db } from "@/db";
import { eq, asc, and } from "drizzle-orm";
import { bankBranches } from "@/db/schema";

export async function getBankNames(): Promise<string[]> {
  const data = await db
    .selectDistinct({ bankName: bankBranches.bank_name })
    .from(bankBranches)
    .orderBy(asc(bankBranches.bank_name));
  return data.map((d) => d.bankName);
}

export async function getBranchesByBank(bankName: string) {
  const data = await db
    .select({
      branchName: bankBranches.branch_name,
      districtName: bankBranches.district_name,
    })
    .from(bankBranches)
    .where(eq(bankBranches.bank_name, bankName))
    .orderBy(asc(bankBranches.branch_name));
  return data;
}

export async function getRoutingNumber(bankName: string, branchName: string) {
  const data = await db
    .select({ routingNumber: bankBranches.routing_number })
    .from(bankBranches)
    .where(
      and(
        eq(bankBranches.bank_name, bankName),
        eq(bankBranches.branch_name, branchName)
      )
    )
    .limit(1);
  return data[0]?.routingNumber;
}

export async function lookupSwiftCode(swiftCode: string) {
  try {
    if (!swiftCode || swiftCode.length < 8) return null;
    const countryCode = swiftCode.substring(4, 6).toUpperCase();

    const response = await fetch(
      `https://raw.githubusercontent.com/PeterNotenboom/SwiftCodes/master/AllCountries/${countryCode}.json`
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
          swiftCode.startsWith(b.swift_code)
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
