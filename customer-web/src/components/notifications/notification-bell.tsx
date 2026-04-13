"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, limit } from "firebase/firestore";
import { auth, db, getClientMessaging } from "@/lib/firebase";
import { useToast } from "@/components/providers/toast-provider";
import { isSupported } from "firebase/messaging";
import { registerPushTokenForUser, requestNotificationPermission } from "@/lib/fcm";

export type InAppNotification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  seen: boolean;
  createdAt: string;
  orderId?: string;
};

function parseCreatedAt(value: unknown): string {
  if (typeof value === "string") return value;
  return "";
}

export function NotificationBell() {
  const { showToast } = useToast();
  const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      setPushSupported(typeof window !== "undefined" && (await isSupported()));
      if (typeof window !== "undefined" && "Notification" in window) {
        setPermission(Notification.permission);
      }
    })();
  }, []);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(40)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: InAppNotification[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            userId: String(data.userId ?? ""),
            title: String(data.title ?? "Update"),
            body: String(data.body ?? ""),
            seen: Boolean(data.seen),
            createdAt: parseCreatedAt(data.createdAt),
            ...(typeof data.orderId === "string" ? { orderId: data.orderId } : {})
          };
        });
        setItems(next);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const unread = items.filter((n) => !n.seen).length;

  const markSeen = useCallback(async (n: InAppNotification) => {
    if (n.seen || !uid) return;
    try {
      await updateDoc(doc(db, "notifications", n.id), { seen: true });
    } catch {
      /* rules or network */
    }
  }, [uid]);

  async function enablePush() {
    if (!uid) return;
    setPushBusy(true);
    try {
      const perm = await requestNotificationPermission();
      setPermission(perm);
      if (perm !== "granted") {
        showToast({
          type: "error",
          title: "Notifications blocked",
          description: "Allow notifications in your browser settings to get order alerts."
        });
        return;
      }
      const token = await registerPushTokenForUser(uid);
      if (token) {
        showToast({ title: "Push enabled", description: "You’ll get alerts when your order status changes." });
      } else {
        const messaging = await getClientMessaging();
        const vapid = Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim());
        showToast({
          type: "error",
          title: "Could not enable push",
          description: !messaging
            ? "Messaging is not supported in this browser."
            : !vapid
              ? "Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY in the app configuration."
              : "Check the browser console for details."
        });
      }
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <>
      {uid ? (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full border border-slate-200 p-2 dark:border-slate-700 dark:text-slate-200"
      >
        {unread > 0 ? <BellRing className="h-4 w-4 text-orange-600" /> : <Bell className="h-4 w-4" />}
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Notifications</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Order status updates</p>
          </div>

          {pushSupported && permission !== "granted" ? (
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="text-xs text-slate-600 dark:text-slate-300">Get alerts even when this tab is in the background.</p>
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void enablePush()}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Enable push notifications
              </button>
            </div>
          ) : null}

          <div className="max-h-[min(60vh,320px)] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href="/orders"
                      onClick={() => {
                        void markSeen(n);
                        setOpen(false);
                      }}
                      className={`block px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                        !n.seen ? "bg-orange-50/60 dark:bg-orange-950/20" : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{n.body}</p>
                      {n.createdAt ? (
                        <p className="mt-1 text-[10px] text-slate-400">
                          {(() => {
                            const t = new Date(n.createdAt).getTime();
                            return Number.isNaN(t) ? n.createdAt : new Date(t).toLocaleString();
                          })()}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
            <Link
              href="/orders"
              className="text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
              onClick={() => setOpen(false)}
            >
              View all orders
            </Link>
          </div>
        </div>
      ) : null}
    </div>
      ) : null}
    </>
  );
}
