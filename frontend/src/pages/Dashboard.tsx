import { useEffect, useState, useCallback } from "react";
import Header from "../components/Header";
import Tabs from "../components/Tabs";
import ComposeModal from "../components/ComposeModal";
import ScheduledTable from "../components/ScheduledTable";
import SentTable from "../components/SentTable";
import { fetchScheduled, fetchSent } from "../api/client";
import { ScheduledEmailRow, SentEmailRow, User } from "../types";

interface Props {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: Props) {
  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");
  const [scheduled, setScheduled] = useState<ScheduledEmailRow[]>([]);
  const [sent, setSent] = useState<SentEmailRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [s, se] = await Promise.all([fetchScheduled(), fetchSent()]);
    setScheduled(s);
    setSent(se);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Poll every 10s so the dashboard reflects worker progress without a manual refresh.
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} onLogout={onLogout} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <Tabs active={tab} onChange={setTab} />
          <button
            onClick={() => setShowCompose(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm"
          >
            + Compose New Email
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {tab === "scheduled" ? (
            <ScheduledTable rows={scheduled} isLoading={isLoading} />
          ) : (
            <SentTable rows={sent} isLoading={isLoading} />
          )}
        </div>
      </main>

      {showCompose && (
        <ComposeModal onClose={() => setShowCompose(false)} onScheduled={load} />
      )}
    </div>
  );
}
