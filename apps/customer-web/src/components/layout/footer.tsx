import { Facebook, Instagram, MapPin, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-12 rounded-3xl border bg-white p-6 shadow-md">
      <div className="grid gap-6 md:grid-cols-4">
        <div>
          <p className="text-lg font-bold text-orange-600">Nausheen Fruits</p>
          <p className="mt-2 text-sm text-slate-600">Premium juices, smoothies and fruit bowls delivered fresh.</p>
        </div>
        <div>
          <p className="font-semibold">Quick Links</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p>Home</p>
            <p>Menu</p>
            <p>Offers</p>
            <p>Orders</p>
          </div>
        </div>
        <div>
          <p className="font-semibold">Contact</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> +91 9XXXXXXXXX
            </p>
            <p className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Hyderabad, 20km delivery radius
            </p>
          </div>
        </div>
        <div>
          <p className="font-semibold">Follow Us</p>
          <div className="mt-2 flex gap-2 text-slate-600">
            <button aria-label="Instagram" className="rounded-full border p-2">
              <Instagram className="h-4 w-4" />
            </button>
            <button aria-label="Facebook" className="rounded-full border p-2">
              <Facebook className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-500">Open daily 8:00 AM to 11:00 PM</p>
    </footer>
  );
}
