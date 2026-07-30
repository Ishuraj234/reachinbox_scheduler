import { ScheduledEmailRow } from "../types";
import { EmptyState, LoadingRows, StatusBadge } from "./StateViews";

interface Props {
  rows: ScheduledEmailRow[];
  isLoading: boolean;
}

export default function ScheduledTable({ rows, isLoading }: Props) {
  if (isLoading) return <LoadingRows />;
  if (rows.length === 0)
    return <EmptyState title="No scheduled emails" subtitle="Compose a new email to schedule your first send." />;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b border-slate-200">
          <th className="py-3 px-6 font-medium">Email</th>
          <th className="py-3 px-6 font-medium">Subject</th>
          <th className="py-3 px-6 font-medium">Scheduled Time</th>
          <th className="py-3 px-6 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="py-3 px-6 text-ink">{r.recipientEmail}</td>
            <td className="py-3 px-6 text-slate-600">{r.subject}</td>
            <td className="py-3 px-6 text-slate-600">{new Date(r.scheduledFor).toLocaleString()}</td>
            <td className="py-3 px-6">
              <StatusBadge status={r.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
