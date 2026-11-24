import { getVendors } from "@/actions";
import VendorsClient from "./vendors-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const vendors = await getVendors();
  return <VendorsClient initialVendors={vendors} />;
}
