import { getClients } from "@/actions";
import ClientsClient from "./clients-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const clients = await getClients();
  return <ClientsClient initialClients={clients} />;
}
