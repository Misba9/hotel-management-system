"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BadgeCheck,
  ChevronRight,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Settings,
  Trash2,
  User,
  X
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/context/auth-context";
import { useUserProfile } from "@/context/user-profile-context";
import { getOrderStatusPresentation } from "@/lib/order-status-ui";
import { useDeliveryAddress } from "@/context/delivery-address-context";
import { useToast } from "@/components/providers/toast-provider";
import { fetchUserOrders, updateUser } from "@/lib/user-service";
import type { DeliveryAddress, DeliveryAddressInput, SavedAddressLabel } from "@/lib/delivery-address-types";
import { formatDeliveryAddressForOrder } from "@/lib/delivery-address-types";

type Section = "overview" | "orders" | "addresses" | "account";

type OrderRow = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  address?: string;
  trackingId?: string;
  itemsSummary?: string;
};

function getDisplayInitials(name: string, fallback?: string | null): string {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] ?? "?").toUpperCase();
  }
  const f = fallback?.trim();
  if (f && f.length >= 2) return f.slice(0, 2).toUpperCase();
  return "?";
}

function ProfileAvatar({
  photoURL,
  initials,
  className = ""
}: {
  photoURL: string | null | undefined;
  initials: string;
  className?: string;
}) {
  if (photoURL) {
    return (
      <div className={`relative shrink-0 overflow-hidden rounded-2xl ring-2 ring-white shadow-md dark:ring-slate-800 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote OAuth URLs */}
        <img src={photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      </div>
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-xl font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-800 ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function validateAddressInput(input: DeliveryAddressInput): Partial<Record<keyof DeliveryAddressInput, string>> {
  const e: Partial<Record<keyof DeliveryAddressInput, string>> = {};
  if (input.name.trim().length < 2) e.name = "Enter the recipient name.";
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) e.phone = "Enter a valid phone number.";
  if (input.addressLine.trim().length < 5) e.addressLine = "Enter a complete street / area.";
  if (input.city.trim().length < 2) e.city = "Enter city.";
  const pc = input.pincode.trim();
  if (!/^\d{6}$/.test(pc)) e.pincode = "Enter a 6-digit PIN code.";
  return e;
}

const navItems: { id: Section; label: string; icon: typeof User }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "orders", label: "Orders", icon: Package },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "account", label: "Account", icon: Settings }
];

function ProfileDetailsSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-2xl bg-slate-200 dark:bg-slate-700" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-10 w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-10 w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-10 w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="h-10 w-28 rounded-xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

function QuickStatsSkeleton() {
  return (
    <div className="mt-4 grid animate-pulse grid-cols-2 gap-4">
      <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

function ProfileSignedOutCard() {
  const { login } = useAuth();
  return (
    <section className="mx-auto max-w-lg space-y-6 py-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-950/50">
          <User className="h-7 w-7 text-orange-600 dark:text-orange-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Your profile</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Sign in to view orders, save delivery addresses, and manage your account.
        </p>
        <button
          type="button"
          onClick={() =>
            login({
              fullPageLoginHref: "/login?redirect=/profile",
              modalTitle: "Sign in to your profile",
              modalDescription: "Phone OTP, email, Google, or Apple — no page reload."
            })
          }
          className="mt-6 inline-flex w-full justify-center rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
        >
          Sign in
        </button>
        <Link
          href="/login?redirect=/profile"
          className="mt-4 block text-sm font-medium text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
        >
          Open full login page
        </Link>
        <p className="mt-4 text-xs text-slate-500">Browse the menu anytime; sign in to order and save addresses.</p>
      </div>
    </section>
  );
}

function ProfileAuthenticatedPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { profile, loading: userProfileLoading, error: profileError, refreshProfile } = useUserProfile();
  const { showToast } = useToast();
  const {
    addresses,
    loading: addressesLoading,
    addAddress,
    updateAddress,
    removeAddress,
    setAddressAsDefault,
    isAuthenticated: addressAuth
  } = useDeliveryAddress();

  const [section, setSection] = useState<Section>("overview");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [baselinePhone, setBaselinePhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);
  const [addressForm, setAddressForm] = useState<DeliveryAddressInput>({
    label: "Home",
    name: "",
    phone: "",
    addressLine: "",
    landmark: "",
    city: "",
    pincode: ""
  });
  const [addressErrors, setAddressErrors] = useState<Partial<Record<keyof DeliveryAddressInput, string>>>({});
  const [addressSaving, setAddressSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setFullName("");
      setPhone("");
      setBaselineName("");
      setBaselinePhone("");
      return;
    }
    if (userProfileLoading || !profile) return;
    const n = profile.name || user.displayName || "";
    const p = profile.phone || "";
    setFullName(n);
    setPhone(p);
    setBaselineName(n);
    setBaselinePhone(p);
  }, [user, userProfileLoading, profile, user?.displayName]);

  const isProfileDirty =
    fullName.trim() !== baselineName.trim() || phone.trim() !== baselinePhone.trim();

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const rows = await fetchUserOrders(user.uid);
      setOrders(rows);
    } catch {
      showToast({ type: "error", title: "Could not load orders", description: "Try again in a moment." });
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    if (user) void loadOrders();
    else setOrders([]);
  }, [user, loadOrders]);

  const emailDisplay = user?.email?.trim() || profile?.email?.trim() || "—";
  const emailVerifiedState = Boolean(user?.email && user.emailVerified);
  const phoneVerifiedState = Boolean(
    user?.phoneNumber && user?.providerData.some((p) => p.providerId === "phone")
  );
  const avatarInitials = getDisplayInitials(
    fullName || profile?.name || user?.displayName || "",
    user?.email || profile?.email
  );
  const stats = useMemo(() => {
    const totalSpent = orders.reduce((s, o) => s + Math.max(0, o.amount), 0);
    return { count: orders.length, totalSpent };
  }, [orders]);

  async function saveProfile() {
    if (!user) return;
    setProfileSaving(true);
    try {
      const email = user.email?.trim() || profile?.email?.trim() || "";
      await updateUser(user.uid, {
        name: fullName.trim() || "Customer",
        email,
        phone: phone.trim()
      });
      await refreshProfile();
      showToast({ title: "Profile updated successfully" });
    } catch {
      showToast({ type: "error", title: "Save failed", description: "Could not update your profile." });
    } finally {
      setProfileSaving(false);
    }
  }

  function openNewAddressDialog() {
    setEditingAddress(null);
    setAddressForm({
      label: "Home",
      name: "",
      phone: "",
      addressLine: "",
      landmark: "",
      city: "",
      pincode: ""
    });
    setAddressErrors({});
    setAddressDialogOpen(true);
  }

  function openEditAddressDialog(a: DeliveryAddress) {
    setEditingAddress(a);
    setAddressForm({
      label: a.label,
      name: a.name,
      phone: a.phone,
      addressLine: a.addressLine,
      landmark: a.landmark,
      city: a.city,
      pincode: a.pincode
    });
    setAddressErrors({});
    setAddressDialogOpen(true);
  }

  async function submitAddressForm() {
    if (!user?.uid) {
      window.alert("User not logged in");
      return;
    }

    console.log("USER ID:", user?.uid);
    console.log(addressForm.addressLine, addressForm.city, addressForm.pincode);

    const err = validateAddressInput(addressForm);
    setAddressErrors(err);
    if (Object.keys(err).length > 0) return;

    setAddressSaving(true);
    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id, addressForm);
        showToast({ title: "Address updated" });
      } else {
        await addAddress(addressForm);
        showToast({ title: "Address added" });
      }
      setAddressDialogOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save address";
      showToast({ type: "error", title: "Could not save address", description: msg });
    } finally {
      setAddressSaving(false);
    }
  }

  async function handleRemoveAddress(id: string) {
    if (!window.confirm("Remove this address?")) return;
    try {
      await removeAddress(id);
      showToast({ title: "Address removed" });
    } catch {
      showToast({ type: "error", title: "Could not remove address" });
    }
  }

  async function handleSetDefaultAddress(id: string) {
    try {
      await setAddressAsDefault(id);
      showToast({ title: "Default address updated" });
    } catch {
      showToast({ type: "error", title: "Could not set default address" });
    }
  }

  async function confirmLogout() {
    setLogoutDialogOpen(false);
    try {
      await logout();
      showToast({ title: "Signed out" });
      router.push("/menu");
    } catch {
      showToast({ type: "error", title: "Sign out failed" });
    }
  }

  return (
    <>
      {!user ? (
        <section className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 py-8" aria-busy="true" aria-label="Loading profile">
          <Loader2 className="h-9 w-9 animate-spin text-orange-500" aria-hidden />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading profile…</p>
        </section>
      ) : (
    <section className="space-y-6 pb-12">
      <header className="flex flex-col gap-1 border-b border-slate-200 pb-6 dark:border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-3xl">Profile</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Account overview, orders, and delivery addresses.</p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <nav
          className="no-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:w-56 lg:flex-shrink-0 lg:flex-col lg:overflow-visible"
          aria-label="Profile sections"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition whitespace-nowrap lg:w-full ${
                  active
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {section === "overview" ? (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
                  <div className="border-b border-slate-100 bg-gradient-to-br from-orange-50/90 to-amber-50/40 px-6 py-5 dark:border-slate-800 dark:from-orange-950/30 dark:to-slate-900">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Your details
                    </h2>
                    {profileError ? (
                      <p className="mt-3 text-sm text-red-600 dark:text-red-400">{profileError}</p>
                    ) : null}
                    {userProfileLoading ? (
                      <div className="mt-4">
                        <ProfileDetailsSkeleton />
                      </div>
                    ) : (
                      <>
                        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                          <ProfileAvatar
                            photoURL={user.photoURL}
                            initials={avatarInitials}
                            className="h-20 w-20 sm:h-24 sm:w-24"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Signed in as</p>
                            <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-50">
                              {fullName || profile?.name || user.displayName || "Member"}
                            </p>
                            <p className="truncate text-sm text-slate-600 dark:text-slate-400">{emailDisplay}</p>
                          </div>
                        </div>
                        <div className="mt-6 space-y-3">
                          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/50">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                <Pencil className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                                Full name
                              </label>
                            </div>
                            <input
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              autoComplete="name"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-orange-500/0 transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-600 dark:bg-slate-950 dark:focus:border-orange-600/50"
                              placeholder="Your name"
                            />
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/50">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                <Phone className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                                Phone
                              </label>
                              {phoneVerifiedState ? (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                                  <BadgeCheck className="h-3 w-3 shrink-0" aria-hidden />
                                  Verified
                                </span>
                              ) : null}
                            </div>
                            <input
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              autoComplete="tel"
                              inputMode="tel"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-orange-500/0 transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-600 dark:bg-slate-950 dark:focus:border-orange-600/50"
                              placeholder="Mobile number"
                            />
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-700/80 dark:bg-slate-900/50">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                <Mail className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                                Email
                              </label>
                              {emailVerifiedState ? (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                                  <BadgeCheck className="h-3 w-3 shrink-0" aria-hidden />
                                  Verified
                                </span>
                              ) : user.email ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                                  Unverified
                                </span>
                              ) : null}
                            </div>
                            <input
                              value={emailDisplay}
                              readOnly
                              className="w-full cursor-not-allowed rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-400"
                            />
                            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-500">
                              Email is managed by your sign-in provider. Contact support to change it.
                            </p>
                          </div>
                        </div>
                        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                          <button
                            type="button"
                            disabled={profileSaving || !isProfileDirty || userProfileLoading}
                            onClick={() => void saveProfile()}
                            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {profileSaving ? "Saving…" : "Save changes"}
                          </button>
                          {!isProfileDirty && !userProfileLoading ? (
                            <span className="text-xs text-slate-500 dark:text-slate-400">No unsaved changes</span>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 lg:col-span-5">
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-md dark:border-slate-700 dark:bg-slate-900">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Quick stats
                  </h2>
                  {ordersLoading ? (
                    <QuickStatsSkeleton />
                  ) : (
                    <dl className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Orders</dt>
                        <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                          {stats.count}
                        </dd>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">Lifetime spend</dt>
                        <dd className="mt-1 text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
                          Rs. {stats.totalSpent}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
                <Link
                  href="/orders"
                  className="flex items-center justify-between rounded-3xl border border-slate-200/80 bg-white p-5 text-sm font-medium text-slate-800 shadow-md transition hover:border-orange-200 hover:bg-orange-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-orange-900/40 dark:hover:bg-orange-950/20"
                >
                  View full order history
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              </div>
            </div>
          ) : null}

          {section === "orders" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Orders</h2>
                <Link href="/orders" className="text-sm font-medium text-orange-600 hover:underline dark:text-orange-400">
                  View all orders
                </Link>
              </div>
              {ordersLoading ? (
                <div className="space-y-3" aria-busy="true">
                  {[1, 2, 3].map((k) => (
                    <div
                      key={k}
                      className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/50"
                    />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/50">
                  <Package className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
                  <p className="mt-4 font-medium text-slate-800 dark:text-slate-100">No orders yet</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">When you place an order, it will appear here.</p>
                  <Link
                    href="/menu"
                    className="mt-6 inline-flex items-center gap-1 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                  >
                    Browse menu
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <ul className="space-y-4">
                  {orders.slice(0, 12).map((order) => {
                    const pres = getOrderStatusPresentation(order.status);
                    const placed = new Date(order.createdAt);
                    const dateStr = Number.isFinite(placed.getTime())
                      ? placed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                      : "—";
                    const shortId = order.id.length <= 14 ? order.id : `${order.id.slice(0, 6)}…${order.id.slice(-4)}`;
                    return (
                      <li
                        key={order.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                          <div>
                            <p className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">#{shortId}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">{dateStr}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${pres.badgeClass}`}>
                            {pres.label}
                          </span>
                        </div>
                        <div className="space-y-3 px-4 py-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Items</p>
                            <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">{order.itemsSummary || "—"}</p>
                          </div>
                          <div className="flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">Rs. {order.amount}</p>
                            <Link
                              href={
                                order.trackingId
                                  ? `/tracking?trackingId=${encodeURIComponent(order.trackingId)}`
                                  : `/tracking?trackingId=${encodeURIComponent(order.id)}`
                              }
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                            >
                              Track
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {section === "addresses" ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-slate-50">Delivery addresses</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {addressAuth ? "Synced to your account" : "Saved on this device"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewAddressDialog}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add address
                </button>
              </div>
              <div className="p-6">
                {addressesLoading ? (
                  <p className="text-sm text-slate-500">Loading addresses…</p>
                ) : addresses.length === 0 ? (
                  <p className="text-sm text-slate-500">No saved addresses. Add one for faster checkout.</p>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {addresses.map((a) => (
                      <li
                        key={a.id}
                        className={`relative rounded-2xl border p-4 ${
                          a.isDefault
                            ? "border-orange-400 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-950/20"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {a.isDefault ? (
                          <span className="mb-2 inline-block rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            Default
                          </span>
                        ) : null}
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {a.label}
                        </p>
                        <p className="font-medium text-slate-900 dark:text-slate-50">{a.name}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{a.phone}</p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{formatDeliveryAddressForOrder(a)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {!a.isDefault ? (
                            <button
                              type="button"
                              onClick={() => void handleSetDefaultAddress(a.id)}
                              className="text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
                            >
                              Set as default
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEditAddressDialog(a)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveAddress(a.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {section === "account" ? (
            <div className="max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-md dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Account</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Sign out on this device. Your cart stays in this browser until you clear it or sign in again to sync.
              </p>
              <button
                type="button"
                onClick={() => setLogoutDialogOpen(true)}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog.Root open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl focus:outline-none dark:border-slate-700 dark:bg-slate-900">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-50">Log out?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              You will need to sign in again to place orders and sync your saved addresses.
            </Dialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-800 dark:border-slate-600 dark:text-slate-200"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void confirmLogout()}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Log out
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(100vw-2rem,28rem)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl focus:outline-none dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {editingAddress ? "Edit address" : "New address"}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Label</label>
                <select
                  value={addressForm.label ?? "Home"}
                  onChange={(e) =>
                    setAddressForm((f) => ({ ...f, label: e.target.value as SavedAddressLabel }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {(
                [
                  ["name", "Full name"] as const,
                  ["phone", "Phone"] as const,
                  ["addressLine", "Street / area"] as const,
                  ["landmark", "Landmark (optional)"] as const,
                  ["city", "City"] as const,
                  ["pincode", "PIN code"] as const
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
                  <input
                    value={addressForm[field]}
                    onChange={(e) => setAddressForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                    autoComplete={
                      field === "name"
                        ? "name"
                        : field === "phone"
                          ? "tel"
                          : field === "addressLine"
                            ? "street-address"
                            : field === "city"
                              ? "address-level2"
                              : field === "pincode"
                                ? "postal-code"
                                : "off"
                    }
                  />
                  {addressErrors[field] ? <p className="mt-0.5 text-xs text-red-600">{addressErrors[field]}</p> : null}
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-600">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={addressSaving}
                onClick={() => void submitAddressForm()}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {addressSaving ? "Saving…" : editingAddress ? "Update" : "Save"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
      )}
    </>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth
      autoOpenModal={false}
      modalTitle="Your profile"
      modalDescription="Sign in with phone OTP, email, Google, or Apple — you stay on this page."
      fullPageLoginHref="/login?redirect=/profile"
      fallback={<ProfileSignedOutCard />}
    >
      <ProfileAuthenticatedPage />
    </RequireAuth>
  );
}
