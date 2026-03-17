const offers = [
  { code: "FRESH20", title: "20% off on orders above Rs. 499" },
  { code: "MANGO10", title: "10% off Mango Specials" }
];

export default function OffersPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Offers</h1>
      {offers.map((offer) => (
        <div key={offer.code} className="rounded-2xl bg-gradient-to-r from-amber-100 to-orange-100 p-4">
          <p className="font-semibold">{offer.code}</p>
          <p className="text-sm text-slate-600">{offer.title}</p>
        </div>
      ))}
    </section>
  );
}
