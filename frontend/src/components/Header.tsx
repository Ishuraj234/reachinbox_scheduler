import { User } from "../types";
import { logout } from "../api/client";

interface Props {
  user: User;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: Props) {
  return (
    <header className="w-full border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
            R
          </div>
          <span className="font-semibold text-ink">ReachInbox Scheduler</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-9 w-9 rounded-full" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="text-sm leading-tight">
              <div className="font-medium text-ink">{user.name}</div>
              <div className="text-slate-500">{user.email}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              onLogout();
            }}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
