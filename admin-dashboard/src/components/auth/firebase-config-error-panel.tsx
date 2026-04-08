type Props = {
  message: string;
};

/**
 * Shown when `NEXT_PUBLIC_FIREBASE_*` is missing or inconsistent (before Auth can start).
 */
export function FirebaseConfigErrorPanel({ message }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        <p className="font-semibold">Firebase configuration error</p>
        <p className="mt-2 whitespace-pre-wrap font-mono text-xs">{message}</p>
        <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-red-800">
          <li>Use admin-dashboard/.env.local (same folder as next.config.mjs).</li>
          <li>Restart <code className="rounded bg-white/80 px-1">npm run dev</code> after changing env.</li>
          <li>Copy all values from one Web app: Firebase Console → Project settings → Your apps.</li>
          <li>Enable Email/Password: Authentication → Sign-in method.</li>
        </ul>
      </div>
    </div>
  );
}
