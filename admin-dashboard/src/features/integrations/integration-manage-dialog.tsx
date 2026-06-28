"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { IntegrationApiRow } from "@shared/types/integrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type Props = {
  integration: IntegrationApiRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (integration: IntegrationApiRow, enabled: boolean) => Promise<void>;
  busy: boolean;
};

export function IntegrationManageDialog({ integration, open, onOpenChange, onToggle, busy }: Props) {
  const [copied, setCopied] = useState(false);

  if (!integration) return null;

  async function copyWebhook() {
    if (!integration?.webhookUrl) return;
    await navigator.clipboard.writeText(integration.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canConnect = integration.credentialsReady || integration.id === "ondc";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{integration.name}</DialogTitle>
          <DialogDescription>{integration.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                integration.status === "connected" ? "success" : integration.status === "pending" ? "warning" : "neutral"
              }
            >
              {integration.status}
            </Badge>
            <span className="text-theme-text-secondary">Sync: {integration.lastSyncLabel}</span>
          </div>

          <div className="rounded-xl border border-theme-border bg-theme-card p-3">
            <p className="text-xs font-medium text-theme-text-secondary">Credentials</p>
            <p className="mt-1 text-theme-text-primary">
              {integration.credentialsReady ? "Server environment configured" : "Missing required environment variables"}
            </p>
            {!integration.credentialsReady && integration.missingEnv.length > 0 ? (
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-amber-300/90">
                {integration.missingEnv.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {integration.webhookUrl ? (
            <div className="rounded-xl border border-theme-border bg-theme-card p-3">
              <p className="text-xs font-medium text-theme-text-secondary">Webhook URL</p>
              <p className="mt-1 break-all font-mono text-[11px] text-theme-text-secondary">{integration.webhookUrl}</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => void copyWebhook()}>
                  <Copy className="h-3 w-3" />
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <a href={integration.webhookUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {integration.enabled ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void onToggle(integration, false)}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              type="button"
              disabled={busy || !canConnect}
              onClick={() => void onToggle(integration, true)}
            >
              {canConnect ? "Connect" : "Configure env first"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
