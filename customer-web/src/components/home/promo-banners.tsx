import { offers } from "@/lib/catalog";
import Link from "next/link";

export function PromoBanners() {
  return (
    <section className="space-y-3">
      <h2 className="text-3xl font-semibold">Special Offers</h2>
      <article className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 p-5 text-white shadow-lg">
        <div>
          <p className="text-2xl font-bold">20% OFF First Order</p>
          <p className="text-sm text-orange-50">Use code FRESH20 and start healthy today.</p>
        </div>
        <Link href="/menu" className="rounded-xl bg-white px-5 py-2.5 font-semibold text-orange-600">
          Claim Offer
        </Link>
      </article>
      <div className="grid gap-3 md:grid-cols-2">
        {offers.map((offer) => (
          <article key={offer.id} className="rounded-2xl bg-gradient-to-r from-amber-100 to-orange-100 p-4">
            <p className="font-semibold text-orange-700">{offer.title}</p>
            <p className="mt-1 text-sm text-slate-600">{offer.subtitle}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
