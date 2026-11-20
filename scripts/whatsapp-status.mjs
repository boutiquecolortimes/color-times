// WhatsApp (Meta Cloud API) status check: business verification, display
// name approval, phone number, account review, quality and webhook.
//
// Usage (from the project folder):
//   node --env-file=.env.local scripts/whatsapp-status.mjs
// If .env.local doesn't have the live values, copy the META_WHATSAPP_* vars
// from Vercel → Settings → Environment Variables and prefix them on the command.
const V = process.env.GRAPH_API_VERSION || "v21.0";
const TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN;
const WABA = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;
const PHONE = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

const missing = Object.entries({
  META_WHATSAPP_ACCESS_TOKEN: TOKEN,
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: WABA,
  META_WHATSAPP_PHONE_NUMBER_ID: PHONE,
}).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.log("✗ Missing:", missing.join(", "));
  process.exit(1);
}

async function graph(path, fields) {
  const url = new URL(`https://graph.facebook.com/${V}/${path}`);
  if (fields) url.searchParams.set("fields", fields);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const json = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, data: json } : { ok: false, error: json.error ?? { message: `HTTP ${res.status}` } };
}
const show = (label, value, note = "") => console.log(`  ${label.padEnd(26)} ${value ?? "—"}${note ? `   ${note}` : ""}`);
const err = (r) => `✗ ${r.error.message} (code ${r.error.code ?? "?"}${r.error.error_subcode ? `/${r.error.error_subcode}` : ""})`;

// 0. Token
console.log("\n0. ACCESS TOKEN");
const me = await graph("me", "id,name");
show("Token works", me.ok ? `✓ (${me.data.name ?? me.data.id})` : err(me));
const dbg = await graph(`debug_token?input_token=${TOKEN}`);
if (dbg.ok && dbg.data.data) {
  const d = dbg.data.data;
  show("Expires", d.expires_at ? new Date(d.expires_at * 1000).toISOString().slice(0, 10) : "never (system user) ✓");
  show("Scopes", (d.scopes ?? []).join(", "));
}

// 1. WhatsApp Business Account
console.log("\n1. WHATSAPP BUSINESS ACCOUNT");
let waba = await graph(WABA, "name,account_review_status,business_verification_status,ownership_type,health_status,owner_business_info");
if (!waba.ok) waba = await graph(WABA, "name,account_review_status");
if (!waba.ok) show("WABA", err(waba));
else {
  const w = waba.data;
  show("Name", w.name);
  show("Account review", w.account_review_status, w.account_review_status === "APPROVED" ? "✓" : "← Meta still reviewing the account");
  show("Business verification", w.business_verification_status ?? "(needs business_management permission)",
    w.business_verification_status === "verified" ? "✓" : w.business_verification_status ? "← THIS is usually what's slow" : "");
  show("Owner business", w.owner_business_info ? `${w.owner_business_info.name} (${w.owner_business_info.id})` : undefined);
  if (w.health_status) {
    show("Overall can_send_message", w.health_status.can_send_message);
    for (const e of w.health_status.entities ?? []) {
      show(`  ${e.entity_type} ${e.id}`, e.can_send_message);
      for (const x of e.errors ?? []) console.log(`      ✗ ${x.error_code}: ${x.error_description}${x.possible_solution ? ` → ${x.possible_solution}` : ""}`);
      for (const x of e.additional_info ?? []) console.log(`      ℹ ${x}`);
    }
  }
  // Business verification directly on the business (if permitted)
  if (w.owner_business_info?.id) {
    const biz = await graph(w.owner_business_info.id, "name,verification_status");
    if (biz.ok) show("Business (Meta) verification", biz.data.verification_status);
  }
}

// 2. Phone number
console.log("\n2. PHONE NUMBER");
const ph = await graph(PHONE, "display_phone_number,verified_name,code_verification_status,name_status,new_name_status,quality_rating,messaging_limit_tier,status,platform_type,account_mode,is_official_business_account,throughput");
if (!ph.ok) show("Phone", err(ph));
else {
  const p = ph.data;
  show("Number", p.display_phone_number);
  show("Display name", p.verified_name);
  show("Display name status", p.name_status, p.name_status === "APPROVED" ? "✓" : "← display name awaiting Meta review");
  if (p.new_name_status && p.new_name_status !== "NONE") show("New name request", p.new_name_status);
  show("Number status", p.status, p.status === "CONNECTED" ? "✓" : "← must be CONNECTED to send");
  show("OTP verification", p.code_verification_status, p.code_verification_status === "VERIFIED" ? "✓" : "← verify the number with OTP");
  show("Mode", p.account_mode, p.account_mode === "LIVE" ? "✓" : "← SANDBOX: only test numbers can receive");
  show("Platform", p.platform_type, p.platform_type === "CLOUD_API" ? "✓" : "");
  show("Quality", p.quality_rating);
  show("Daily limit tier", p.messaging_limit_tier, p.messaging_limit_tier === "TIER_50" || p.messaging_limit_tier === "TIER_250" ? "← low limit until business verification" : "");
  show("Official (green tick)", p.is_official_business_account);
}

// 3. Webhook subscription
console.log("\n3. WEBHOOK");
const subs = await graph(`${WABA}/subscribed_apps`);
show("Subscribed apps", subs.ok ? (subs.data.data?.length ? subs.data.data.map((a) => a.whatsapp_business_api_data?.name ?? a.id).join(", ") + " ✓" : "✗ none — incoming messages/status won't arrive") : err(subs));

// 4. Templates
console.log("\n4. MESSAGE TEMPLATES");
const t = await graph(`${WABA}/message_templates`, "name,status,category,rejected_reason");
if (!t.ok) show("Templates", err(t));
else {
  const counts = {};
  for (const x of t.data.data ?? []) counts[x.status] = (counts[x.status] ?? 0) + 1;
  show("By status", JSON.stringify(counts));
  for (const x of (t.data.data ?? []).filter((x) => x.status !== "APPROVED"))
    console.log(`      ${x.status.padEnd(9)} ${x.name} (${x.category})${x.rejected_reason && x.rejected_reason !== "NONE" ? ` — ${x.rejected_reason}` : ""}`);
}
console.log("");
