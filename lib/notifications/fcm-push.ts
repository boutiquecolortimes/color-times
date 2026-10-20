import "server-only";
import { SignJWT, importPKCS8 } from "jose";

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string | undefined>;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    // Accept raw JSON or base64-encoded JSON (easier to paste into Vercel).
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as ServiceAccount;
    return parsed.project_id && parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    return null;
  }
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  const key = await importPKCS8(account.private_key.replace(/\\n/g, "\n"), "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("FCM auth failed");
  cachedAccessToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

/**
 * Push to the Color Times mobile app via Firebase Cloud Messaging (HTTP v1).
 * FCM delivers to Android directly and to iOS through the APNs key uploaded
 * in the Firebase console. Silently a no-op until FIREBASE_SERVICE_ACCOUNT is
 * set. Fire-and-forget: never throws into the calling route.
 *
 * Returns tokens FCM reported as no longer registered so callers can prune them.
 */
export async function sendPush(tokens: string[], message: PushMessage): Promise<string[]> {
  const unique = [...new Set(tokens.filter(Boolean))];
  const account = readServiceAccount();
  if (unique.length === 0 || !account) return [];

  const stale: string[] = [];
  try {
    const accessToken = await getAccessToken(account);
    const data = Object.fromEntries(
      Object.entries(message.data ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
    await Promise.all(
      unique.map(async (token) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                token,
                notification: { title: message.title, body: message.body },
                data,
                android: { priority: "high", notification: { channel_id: "default", color: "#C9A35C" } },
                apns: { payload: { aps: { sound: "default" } } },
              },
            }),
          }
        );
        if (response.status === 404 || response.status === 400) {
          const body = await response.text();
          if (body.includes("UNREGISTERED") || body.includes("registration-token-not-registered")) {
            stale.push(token);
          }
        }
      })
    );
  } catch (error) {
    console.error("FCM push failed:", error);
  }
  return stale;
}
