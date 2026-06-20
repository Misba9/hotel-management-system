const DEFAULT_BASE_URL = "https://api.rapido.bike";

function env(name: string): string | undefined {
  const raw = process.env[name];
  return raw?.trim() || undefined;
}

export function getRapidoConfig() {
  const apiKey = env("RAPIDO_API_KEY");
  const baseUrl = (env("RAPIDO_API_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return { apiKey, baseUrl };
}

export type RapidoEstimateRequest = {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  orderId: string;
};

export type RapidoBookRequest = RapidoEstimateRequest & {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropAddress: string;
};

async function rapidoFetch<T>(path: string, init: RequestInit): Promise<T> {
  const { apiKey, baseUrl } = getRapidoConfig();
  if (!apiKey) {
    throw new Error("RAPIDO_API_KEY is not configured.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {})
    }
  });

  const body = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? `Rapido API failed (${response.status})`);
  }
  return body;
}

export async function rapidoEstimateRide(payload: RapidoEstimateRequest) {
  return rapidoFetch<{ estimateId?: string; fare?: number; etaMinutes?: number; currency?: string }>(
    "/v1/ride/estimate",
    {
      method: "POST",
      body: JSON.stringify({
        pickup: { lat: payload.pickupLat, lng: payload.pickupLng },
        drop: { lat: payload.dropLat, lng: payload.dropLng },
        orderId: payload.orderId
      })
    }
  );
}

export async function rapidoBookRide(payload: RapidoBookRequest) {
  return rapidoFetch<{ rideId?: string; status?: string; driverName?: string; driverPhone?: string }>(
    "/v1/ride/book",
    {
      method: "POST",
      body: JSON.stringify({
        pickup: {
          lat: payload.pickupLat,
          lng: payload.pickupLng,
          address: payload.pickupAddress
        },
        drop: {
          lat: payload.dropLat,
          lng: payload.dropLng,
          address: payload.dropAddress
        },
        customer: {
          name: payload.customerName,
          phone: payload.customerPhone
        },
        orderId: payload.orderId
      })
    }
  );
}

export async function rapidoTrackRide(rideId: string) {
  return rapidoFetch<{
    rideId?: string;
    status?: string;
    driverName?: string;
    driverPhone?: string;
    etaMinutes?: number;
    currentLat?: number;
    currentLng?: number;
  }>(`/v1/ride/${encodeURIComponent(rideId)}`, { method: "GET" });
}
