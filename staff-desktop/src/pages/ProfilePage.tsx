import { DesktopAppShell } from "@/components/DesktopAppShell";
import { useAuth } from "@/contexts/AuthContext";
import { roleLabel } from "@/lib/role-routes";

export function ProfilePage() {
  const { profile, logout } = useAuth();

  return (
    <DesktopAppShell title="Profile" subtitle="Account details" onLogout={() => void logout()}>
      <div className="mx-auto max-w-lg p-8">
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{profile?.name ?? "Staff"}</p>
          <p className="mt-1 text-sm text-slate-500">{profile?.email}</p>
          <span className="mt-4 inline-block rounded-full bg-brand-teal/10 px-4 py-1.5 text-sm font-bold text-brand-teal">
            {profile?.role ? roleLabel(profile.role) : "Staff"}
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-8 w-full rounded-xl border-2 border-red-300 py-3 font-bold text-red-600"
          >
            Log out
          </button>
        </div>
      </div>
    </DesktopAppShell>
  );
}
