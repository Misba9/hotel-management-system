import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Page not found</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">This page does not exist or the link is wrong.</p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
      >
        Back to home
      </Link>
      <p>
        <Link href="/menu" className="text-sm font-medium text-orange-600 underline dark:text-orange-400">
          Browse menu
        </Link>
      </p>
    </main>
  );
}
