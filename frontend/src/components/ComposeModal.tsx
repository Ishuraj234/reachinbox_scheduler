import { useState } from "react";
import { parseLeadsFile, submitCompose } from "../api/client";

interface Props {
  onClose: () => void;
  onScheduled: () => void;
}

export default function ComposeModal({ onClose, onScheduled }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000); // default: 5 min from now
    return d.toISOString().slice(0, 16);
  });
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(f: File | null) {
    setFile(f);
    setLeadCount(null);
    if (!f) return;
    setIsParsing(true);
    try {
      const { count } = await parseLeadsFile(f);
      setLeadCount(count);
    } catch {
      setError("Could not parse that file. Please upload a CSV or TXT with email addresses.");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!subject.trim() || !body.trim()) return setError("Subject and body are required.");
    if (!file) return setError("Please upload a CSV/TXT file of leads.");

    setIsSubmitting(true);
    try {
      await submitCompose({
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        delayMs: delaySeconds * 1000,
        hourlyLimit,
        file,
      });
      onScheduled();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Something went wrong while scheduling.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-ink text-lg">Compose New Email</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Quick question about {{company}}"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Hi there, ..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Leads file (CSV or TXT)</label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
            {isParsing && <p className="text-xs text-slate-400 mt-1">Parsing file…</p>}
            {leadCount !== null && !isParsing && (
              <p className="text-xs text-brand-600 mt-1 font-medium">{leadCount} email address(es) detected</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Start time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Delay (sec)</label>
              <input
                type="number"
                min={1}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Hourly limit</label>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
