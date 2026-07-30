import { SentEmailRow } from "../types";
import { EmptyState, LoadingRows, StatusBadge } from "./StateViews";

interface Props {
  rows: SentEmailRow[];
  isLoading: boolean;
}

export default function SentTable({ rows, isLoading }: Props) {
  if (isLoading) return <LoadingRows />;
  if (rows.length === 0)
    return <EmptyState title="No sent emails yet" subtitle="Once scheduled emails go out, they'll show up here." />;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 border-b border-slate-200">
          <th className="py-3 px-6 font-medium">Email</th>
          <th className="py-3 px-6 font-medium">Subject</th>
          <th className="py-3 px-6 font-medium">Sent Time</th>
          <th className="py-3 px-6 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="py-3 px-6 text-ink">{r.recipientEmail}</td>
            <td className="py-3 px-6 text-slate-600">{r.subject}</td>
            <td className="py-3 px-6 text-slate-600">
              {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
            </td>
            <td className="py-3 px-6">
              <StatusBadge status={r.status} />
              {r.status === "FAILED" && r.errorMessage && (
                <div className="text-xs text-red-500 mt-1 max-w-xs truncate" title={r.errorMessage}>
                  {r.errorMessage}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
