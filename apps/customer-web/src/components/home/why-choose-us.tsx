import { Clock3, Leaf, ShieldCheck, Star } from "lucide-react";

const points = [
  { icon: Clock3, title: "Fast Delivery", text: "Delivered across Hyderabad in 10-30 minutes." },
  { icon: Leaf, title: "100% Fresh Fruits", text: "Premium seasonal fruits sourced every morning." },
  { icon: ShieldCheck, title: "No Preservatives", text: "No artificial colors, no synthetic flavors." },
  { icon: Star, title: "4.9 Rated", text: "Loved by customers for taste and consistency." }
];

export function WhyChooseUs() {
  return (
    <section className="space-y-3">
      <h2 className="text-3xl font-semibold">Why choose Nausheen Fruits?</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {points.map((point) => (
          <article key={point.title} className="rounded-2xl border bg-white p-4">
            <point.icon className="mb-3 h-5 w-5 text-orange-600" />
            <h3 className="font-semibold">{point.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{point.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
