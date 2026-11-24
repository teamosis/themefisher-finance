import { getPaymentAccounts } from "@/actions";
import SettingsClient from "./settings-client";

export const metadata = {
  title: "Receiving Payment Accounts | Settings | Themefisher Finance",
  description:
    "Configure Themefisher receiving bank accounts for inward remittances.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPaymentAccountsPage() {
  const accounts = await getPaymentAccounts().catch(() => []);
  return <SettingsClient initialAccounts={accounts} />;
}
