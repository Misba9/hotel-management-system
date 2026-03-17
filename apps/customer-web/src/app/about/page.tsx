export default function AboutPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-bold">About Nausheen Fruits</h1>
      <p className="max-w-3xl text-base text-slate-600">
        We are a Hyderabad-based premium juice center focused on fast delivery, fresh ingredients, and consistent
        quality. Every drink is prepared fresh from real fruits and served with hygiene-first packaging.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border bg-white p-4">
          <p className="font-semibold">100% Fresh</p>
          <p className="text-sm text-slate-600">No preservatives. No compromise.</p>
        </article>
        <article className="rounded-2xl border bg-white p-4">
          <p className="font-semibold">Fast Delivery</p>
          <p className="text-sm text-slate-600">Optimized delivery routes across city.</p>
        </article>
        <article className="rounded-2xl border bg-white p-4">
          <p className="font-semibold">Loved by Customers</p>
          <p className="text-sm text-slate-600">4.9 average customer rating.</p>
        </article>
      </div>
    </section>
  );
}
