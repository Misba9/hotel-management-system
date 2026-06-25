"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Link2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import type { IntegrationApiRow, IntegrationSyncLogStatus } from "@shared/types/integrations";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntegrationManageDialog } from "@/features/integrations/integration-manage-dialog";

type SyncLogRow = {
  id: string;
  service: string;
  event: string;
  status: IntegrationSyncLogStatus;
  createdAt: string;
};

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function IntegrationsPageFeature() {
  const { user, authClaimsResolved } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationApiRow[]>([]);
  const [logs, setLogs] = useState<SyncLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [manageTarget, setManageTarget] = useState<IntegrationApiRow | null>(null);

  const loadIntegrations = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApiFetch("/api/integrations");
      if (!res.ok) {
        setError("Failed to load integrations.");
        return;
      }
      const data = (await res.json()) as { integrations?: IntegrationApiRow[]; logs?: SyncLogRow[] };
      if (data.integrations) setIntegrations(data.integrations);
      if (data.logs) setLogs(data.logs);
    } catch {
      setError("Failed to load integrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authClaimsResolved || !user) {
      setLoading(false);
      return;
    }
    void loadIntegrations();
  }, [authClaimsResolved, user, loadIntegrations]);

  useEffect(() => {
    if (!user || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;

    const db = getFirebaseDb();
    const q = query(collection(db, "integration_sync_logs"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogs(
          snap.docs.map((d) => {
            const data = d.data() as {
              service?: string;
              event?: string;
              status?: IntegrationSyncLogStatus;
              createdAt?: string;
            };
            return {
              id: d.id,
              service: data.service ?? "Unknown",
              event: data.event ?? "",
              status: data.status ?? "success",
              createdAt: data.createdAt ?? new Date().toISOString()
            };
          })
        );
      },
      () => {
        /* keep API-loaded logs on permission errors */
      }
    );
    return () => unsub();
  }, [user]);

  async function handleSync(item: IntegrationApiRow) {
    setSyncingId(item.id);
    setError(null);
    try {
      const res = await adminApiFetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Sync failed.");
        return;
      }
      await loadIntegrations();
    } catch {
      setError("Sync failed.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleToggle(item: IntegrationApiRow, enabled: boolean) {
    setTogglingId(item.id);
    setError(null);
    try {
      const res = await adminApiFetch("/api/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, enabled })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not update integration.");
        return;
      }
      const data = (await res.json()) as { integration?: IntegrationApiRow };
      if (data.integration) {
        setIntegrations((prev) => prev.map((row) => (row.id === data.integration!.id ? data.integration! : row)));
        setManageTarget((prev) => (prev?.id === data.integration!.id ? data.integration! : prev));
      } else {
        await loadIntegrations();
      }
      if (!enabled) setManageTarget(null);
    } catch {
      setError("Could not update integration.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <PageShell badge="Integrations" title="Connected Services" description="Delivery · payments · messaging · maps">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading integrations…
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {integrations.map((item) => (
            <GlassCard key={item.id} hover className="flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{item.name}</h3>
                  <p className="text-xs text-white/40">{item.category}</p>
                </div>
                {item.status === "connected" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : item.status === "pending" ? (
                  <RefreshCw className="h-5 w-5 text-amber-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-white/30" />
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge
                  variant={item.status === "connected" ? "success" : item.status === "pending" ? "warning" : "neutral"}
                >
                  {item.status}
                </Badge>
                <span className="text-[10px] text-white/35">Sync: {item.lastSyncLabel}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setManageTarget(item)}
                >
                  <Link2 className="h-3 w-3" />
                  {item.status === "disconnected" ? "Connect" : "Manage"}
                </Button>
                {item.status === "connected" || item.status === "pending" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={syncingId === item.id}
                    onClick={() => void handleSync(item)}
                    aria-label={`Sync ${item.name}`}
                  >
                    {syncingId === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                ) : null}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <GlassCard hover>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-white">Sync Logs</h3>
          <Badge variant="neutral">{logs.length} events</Badge>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-white/40">No sync activity yet. Connect a service or run a manual sync.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="shrink-0 font-mono text-xs text-white/35">{formatLogTime(log.createdAt)}</span>
                  <span className="shrink-0 text-sm font-medium text-brand-primary">{log.service}</span>
                  <span className="truncate text-sm text-white/60">{log.event}</span>
                </div>
                <Badge
                  variant={log.status === "success" ? "success" : log.status === "warning" ? "warning" : "danger"}
                  className="ml-2 shrink-0"
                >
                  {log.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <IntegrationManageDialog
        integration={manageTarget}
        open={manageTarget !== null}
        onOpenChange={(open) => {
          if (!open) setManageTarget(null);
        }}
        onToggle={handleToggle}
        busy={togglingId === manageTarget?.id}
      />
    </PageShell>
  );
}
