import { getActivityLogs } from "@/actions/activity-logs";
import ActivityLogsClient from "./activity-logs-client";

export const metadata = {
  title: "App Activity Logs | Settings | Themefisher Finance",
  description:
    "Complete audit trail of SCB bulk transfer Excels, salary sheets, invoices, and bank operations.",
};

export default async function SettingsActivityLogsPage() {
  const { rows, total } = await getActivityLogs({ limit: 50 }).catch(() => ({
    rows: [],
    total: 0,
    page: 1,
    limit: 50,
  }));

  return <ActivityLogsClient initialLogs={rows} initialTotal={total} />;
}
