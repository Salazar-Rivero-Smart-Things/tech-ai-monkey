const PAYPAL_API =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

function credentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set.");
  }
  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = credentials();
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal auth failed (${res.status}).`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface PayPalOrderResult {
  id: string;
  approveUrl: string | null;
}

// Creates a one-time PayPal order for a plan (30-day pass) or a pay-as-you-go
// top-up. Recurring auto-renew via PayPal is a separate follow-up.
export async function createOrder(params: {
  amountEur: number;
  description: string;
  metadata: Record<string, string>;
}): Promise<PayPalOrderResult> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: params.description,
          custom_id: JSON.stringify(params.metadata),
          amount: {
            currency_code: "EUR",
            value: params.amountEur.toFixed(2),
          },
        },
      ],
      application_context: {
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`PayPal order creation failed (${res.status}).`);
  }
  const data = (await res.json()) as {
    id: string;
    links?: Array<{ rel: string; href: string }>;
  };
  const approveUrl = data.links?.find((l) => l.rel === "approve")?.href ?? null;
  return { id: data.id, approveUrl };
}

export async function captureOrder(orderId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
  });
  const data = (await res.json()) as { status?: string; purchase_units?: Array<{ custom_id?: string }> };
  if (!res.ok || (data.status !== "COMPLETED" && data.status !== "APPROVED")) {
    throw new Error(`PayPal capture failed (${res.status}).`);
  }
  return data;
}
