"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where
} from "firebase/firestore";
import { MessageCircle, Navigation, User } from "lucide-react";

import { auth, db } from "@/lib/firebase";

type Loc = {
  lat: number;
  lng: number;
  riderName?: string;
  riderMobile?: string;
  updatedAt?: unknown;
};

type ChatRow = { id: string; authorUid: string; body: string };

export function DeliveryCustomerPanel({ orderId }: { orderId: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setSignedIn(Boolean(u)));
  }, []);

  useEffect(() => {
    if (!signedIn || !orderId) {
      setDeliveryId(null);
      return;
    }
    const q = query(collection(db, "deliveries"), where("orderId", "==", orderId), limit(3));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setDeliveryId(null);
          return;
        }
        setDeliveryId(snap.docs[0].id);
      },
      () => setDeliveryId(null)
    );
    return () => unsub();
  }, [signedIn, orderId]);

  useEffect(() => {
    if (!signedIn || !orderId) {
      setLoc(null);
      return;
    }
    const ref = doc(db, "deliveryLocations", orderId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setLoc(null);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        const lat = typeof d.lat === "number" ? d.lat : NaN;
        const lng = typeof d.lng === "number" ? d.lng : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setLoc(null);
          return;
        }
        setLoc({
          lat,
          lng,
          riderName: typeof d.riderName === "string" ? d.riderName : undefined,
          riderMobile: typeof d.riderMobile === "string" ? d.riderMobile : undefined,
          updatedAt: d.updatedAt
        });
      },
      () => setLoc(null)
    );
    return () => unsub();
  }, [signedIn, orderId]);

  useEffect(() => {
    if (!deliveryId || !signedIn) {
      setMessages([]);
      return;
    }
    const col = collection(db, "deliveries", deliveryId, "messages");
    const q = query(col, orderBy("createdAt", "asc"), limit(80));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => {
            const x = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              authorUid: typeof x.authorUid === "string" ? x.authorUid : "",
              body: typeof x.body === "string" ? x.body : ""
            };
          })
        );
      },
      () => setMessages([])
    );
    return () => unsub();
  }, [deliveryId, signedIn]);

  const uid = auth.currentUser?.uid ?? "";

  async function send() {
    if (!deliveryId || !draft.trim()) return;
    setSending(true);
    setHint(null);
    try {
      await addDoc(collection(db, "deliveries", deliveryId, "messages"), {
        authorUid: uid,
        body: draft.trim().slice(0, 2000),
        createdAt: serverTimestamp()
      });
      setDraft("");
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  if (!signedIn) return null;

  if (!deliveryId && !loc) {
    return null;
  }

  const mapHref =
    loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${loc.lat},${loc.lng}`)}`
      : null;

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Navigation className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Delivery</h2>
      </div>

      {loc ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <User className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
            {loc.riderName?.trim() ? loc.riderName : "Your rider"}
          </p>
          {loc.riderMobile ? (
            <p className="mt-1 text-slate-700 dark:text-slate-300">
              <a href={`tel:${loc.riderMobile.replace(/\s+/g, "")}`} className="font-medium text-emerald-800 underline dark:text-emerald-200">
                {loc.riderMobile}
              </a>
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Last location: {Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)}
          </p>
          {mapHref ? (
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline dark:text-emerald-200"
            >
              Open in Maps
            </a>
          ) : null}
        </div>
      ) : deliveryId ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Waiting for rider GPS…</p>
      ) : null}

      {deliveryId ? (
        <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
          <div className="mb-2 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-slate-500" aria-hidden />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Chat with rider</span>
          </div>
          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
            {messages.length === 0 ? (
              <li className="text-xs text-slate-500 dark:text-slate-400">No messages yet.</li>
            ) : (
              messages.map((m) => {
                const mine = m.authorUid === uid;
                return (
                  <li
                    key={m.id}
                    className={`max-w-[92%] rounded-lg px-3 py-2 text-sm ${
                      mine ? "ml-auto bg-sky-100 text-slate-900 dark:bg-sky-900/40 dark:text-slate-50" : "mr-auto bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600"
                    }`}
                  >
                    {m.body}
                  </li>
                );
              })
            )}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message…"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-orange-500/30 focus:ring-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
              maxLength={2000}
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={() => void send()}
              className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
          {hint ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{hint}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
