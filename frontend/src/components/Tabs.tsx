interface Props {
  active: "scheduled" | "sent";
  onChange: (tab: "scheduled" | "sent") => void;
}

export default function Tabs({ active, onChange }: Props) {
  const tabs: { key: "scheduled" | "sent"; label: string }[] = [
    { key: "scheduled", label: "Scheduled Emails" },
    { key: "sent", label: "Sent Emails" },
  ];

  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
            active === t.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
