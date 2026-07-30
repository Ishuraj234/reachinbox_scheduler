export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400 text-xl">
        ✉
      </div>
      <p className="font-medium text-ink">{title}</p>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

export function LoadingRows() {
  return (
    <div className="py-10 space-y-3 px-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SCHEDULED: "bg-brand-50 text-brand-700",
    PROCESSING: "bg-amber-50 text-amber-700",
    RESCHEDULED: "bg-purple-50 text-purple-700",
    SENT: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}
