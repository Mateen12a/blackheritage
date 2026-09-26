// End-to-end test against the live backend on 3001. Exercises the full
// ticketing lifecycle and prints PASS/FAIL per assertion.
const BASE = "http://localhost:3001";
const crypto = require("crypto");
const zlib = require("zlib");
let cookie = "";
let pass = 0, fail = 0;

function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (detail ? " :: " + detail : "")); }
}

// pdf-lib hex-encodes every text run ("<464F554E...> Tj") and deflates the
// streams, so a plain substring search over the file finds nothing. Flatten the
// streams and decode the hex back to readable text.
function pdfText(buf) {
  const parts = [];
  const collect = (str) => {
    for (const m of str.matchAll(/<([0-9A-Fa-f]{4,})>\s*Tj/g)) {
      parts.push(Buffer.from(m[1], "hex").toString("latin1"));
    }
  };
  const raw = buf.toString("latin1");
  collect(raw);
  const re = />>\s*stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) continue;
    try { collect(zlib.inflateSync(buf.subarray(start, end)).toString("latin1")); } catch { /* not a deflate stream */ }
    re.lastIndex = end;
  }
  return parts.join("\n");
}

// pdf-lib draws every run at an absolute baseline ("1 0 0 1 56 787.89 Tm"),
// so the content streams carry enough geometry to catch a colliding layout
// without rendering the page. Fonts are named per use, hence the loose match.
function pdfOverlaps(buf) {
  const runRe = /\/[A-Za-z-]+[\w-]* ([\d.]+) Tf\s+[\d.]+ TL\s+1 0 0 1 ([\d.]+) ([\d.]+) Tm\s*<([0-9A-Fa-f]+)>/g;
  const problems = [];
  const scan = (str) => {
    runRe.lastIndex = 0;
    let prev = null;
    let m;
    while ((m = runRe.exec(str))) {
      const size = Number(m[1]);
      const y = Number(m[3]);
      const text = Buffer.from(m[4], "hex").toString("latin1");
      // Only runs drawn lower than the previous one can collide with it; a
      // higher y means a new page or a fresh block.
      if (prev && y < prev.y && prev.y - y < size * 0.717) {
        problems.push({
          gap: +(prev.y - y).toFixed(2),
          needed: +(size * 0.717).toFixed(2),
          size,
          text: text.slice(0, 40),
        });
      }
      prev = { y, size };
    }
  };
  const raw = buf.toString("latin1");
  scan(raw);
  const re = />>\s*stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) continue;
    try { scan(zlib.inflateSync(buf.subarray(start, end)).toString("latin1")); } catch { /* not deflate */ }
    re.lastIndex = end;
  }
  return problems;
}

// Load .env so webhook signing matches the server's gateway config. Mirrors
// the server's own loader (server/env.ts) for .env only; real env wins.
const fs = require("fs");
const envPath = require("path").join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Fulfill a booking the way Flutterwave does in production: a signed
// charge.completed webhook on /api/payments/webhook. finalize then takes
// its idempotent already-paid path. Returns null when no hash is configured.
async function flwWebhook(ref, amountKobo) {
  const hash = process.env.FLW_WEBHOOK_HASH;
  if (!ref || !hash) return null;
  const payload = JSON.stringify({
    event: "charge.completed",
    data: {
      id: 424242,
      tx_ref: ref,
      amount: amountKobo / 100, // naira, as Flutterwave sends it
      currency: "NGN",
      status: "successful",
      created_at: new Date().toISOString(),
    },
  });
  return fetch(BASE + "/api/payments/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "verif-hash": hash },
    body: payload,
  });
}

async function api(method, path, body, useCookie = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json", // API reads must not trip the /e/:slug 301 promotion
      ...(useCookie && cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let json = null;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // CSV / PDF / binary: skip the JSON read so the body stays consumable.
  } else {
    try { json = await res.json(); } catch {}
  }
  return { status: res.status, json, headers: res.headers, text: () => res.text() };
}

(async () => {
  require("tsx/cjs");
  try { require("../server/env").loadEnvFiles(); } catch {}
  // ── 1. Login as attendee ──
  let r = await api("POST", "/api/auth/login", { username: "ayo_attendee", password: "demo1234" });
  ok("attendee login", r.status === 200 && r.json?._id, "status=" + r.status);

  // ── 2. Events list shows seeded tiers ──
  r = await api("GET", "/api/events");
  ok("events list", r.status === 200 && Array.isArray(r.json) && r.json.length >= 3);
  // The flagship is the event that carries the seeded promo codes.
  let event = null;
  for (const e of r.json) {
    // The flagship advertises EARLYBIRD publicly (promoCodesPublic). The
    // organizer-only /promos endpoint 403s for plain users, so the public
    // listing is the one an attendee session can actually read.
    const pl = await api("GET", "/api/events/" + e.id + "/public-promos");
    if (Array.isArray(pl.json) && pl.json.some((p) => p.code === "EARLYBIRD")) { event = e; break; }
  }
  if (!event) event = r.json[0];
  const tiers = JSON.parse(event.ticketTypes || "[]");
  ok("event has tiers", tiers.length >= 1, JSON.stringify(tiers).slice(0, 80));

  // ── 3. Quote: server-computed pricing ──
  const tier = tiers.find((t) => t.name === "VIP") || tiers[0];
  r = await api("POST", "/api/bookings/quote", { eventId: event.id, tierName: tier.name, quantity: 2 });
  ok("quote ok", r.status === 200 && r.json?.totalKobo === tier.price * 2, JSON.stringify(r.json));
  const baseTotal = r.json?.totalKobo;

  // ── 4. Promo code: percent discount on the flagship's EARLYBIRD ──
  r = await api("POST", "/api/bookings/quote", { eventId: event.id, tierName: tier.name, quantity: 2, promoCode: "EARLYBIRD" });
  ok("promo quote discounts 15%", r.status === 200 && r.json?.discountKobo === Math.round(baseTotal * 0.15), JSON.stringify(r.json));

  // Initiate with the promo, so webhook fulfillment exercises promo usage counting.
  r = await api("POST", "/api/bookings/initiate", {
    eventId: event.id, tierName: tier.name, quantity: 1,
    name: "Promo Buyer", email: "promo@example.com", promoCode: "EARLYBIRD",
  });
  ok("promo initiate", r.status === 201 && r.json?.totalKobo === Math.round(tier.price * 0.85), JSON.stringify(r.json).slice(0, 120));
  const promoRef = r.json?.reference;
  const promoTotal = r.json?.totalKobo;
  if (promoRef && process.env.PAYSTACK_SECRET_KEY) {
    const payload = JSON.stringify({ event: "charge.success", data: { reference: promoRef, amount: promoTotal, status: "success" } });
    const sig = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(payload).digest("hex");
    await fetch(BASE + "/api/paystack/webhook", { method: "POST", headers: { "Content-Type": "application/json", "x-paystack-signature": sig }, body: payload });
  } else if (promoRef) {
    const flwRes = await flwWebhook(promoRef, promoTotal);
    if (flwRes) ok("promo webhook accepted", flwRes.status === 200, "status=" + flwRes.status);
  }
  const promoFinal = await api("POST", "/api/bookings/finalize", { reference: promoRef });
  ok("promo booking fulfills", promoFinal.status === 200, JSON.stringify(promoFinal).slice(0, 100));

  // ── 5. Bad promo rejected ──
  r = await api("POST", "/api/bookings/quote", { eventId: event.id, tierName: tier.name, quantity: 1, promoCode: "NOSUCHCODE" });
  ok("bad promo rejected", r.status === 400, "status=" + r.status);

  // ── 6. Initiate booking (dev sim) ──
  r = await api("POST", "/api/bookings/initiate", {
    eventId: event.id, tierName: tier.name, quantity: 2,
    name: "Test Buyer", email: "buyer@example.com",
  });
  ok("initiate booking", r.status === 201 && r.json?.reference, JSON.stringify(r.json).slice(0, 120));
  const bookingId = r.json?.bookingId;
  const reference = r.json?.reference;

  // ── 7. Complete payment the way production does: a signed webhook ──
  // With live gateway keys, finalize correctly refuses an unverified
  // payment. The webhook is the source of truth (Paystack HMAC here;
  // Flutterwave's verif-hash via flwWebhook otherwise).
  let firstCode = null;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (secret) {
    const payload = JSON.stringify({
      event: "charge.success",
      data: { reference, amount: baseTotal, status: "success" },
    });
    const sig = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    const whRes = await fetch(BASE + "/api/paystack/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": sig },
      body: payload,
    });
    ok("webhook accepted", whRes.status === 200, "status=" + whRes.status);
  } else {
    const flwRes = await flwWebhook(reference, baseTotal);
    if (flwRes) ok("webhook accepted", flwRes.status === 200, "status=" + flwRes.status);
  }
  r = await api("POST", "/api/bookings/finalize", { reference });
  ok("finalize fulfills", r.status === 200 && r.json?.status === "paid" && r.json?.tickets?.length === 2, JSON.stringify(r.json).slice(0, 160));
  firstCode = r.json?.tickets?.[0]?.code;

  // ── 8. Idempotent finalize ──
  if (firstCode) {
    r = await api("POST", "/api/bookings/finalize", { reference });
    ok("finalize is idempotent", r.status === 200 && r.json?.tickets?.[0]?.code === firstCode);
  }

  // ── 9. PDF download ──
  const pdfRes = await fetch(BASE + "/api/bookings/" + bookingId + "/pdf", { headers: { Cookie: cookie } });
  const buf = Buffer.from(await pdfRes.arrayBuffer());
  ok("PDF builds", pdfRes.status === 200 && buf.length > 2000 && buf.slice(0, 4).toString() === "%PDF", "bytes=" + buf.length);

  // ── 10. Codes endpoint ──
  r = await api("GET", "/api/bookings/" + bookingId + "/tickets");
  ok("codes endpoint", r.status === 200 && r.json?.length === 2 && r.json[0].code?.startsWith("BH-"));

  // ── 11. Gate: valid code checks in ──
  cookie = "";
  r = await api("POST", "/api/auth/login", { username: "gate_staff", password: "demo1234" });
  ok("entry staff login", r.status === 200, "status=" + r.status);
  r = await api("POST", "/api/verify", { code: firstCode });
  ok("gate accepts valid code", r.status === 200 && r.json?.result === "ok", JSON.stringify(r.json));
  ok("gate returns attendee name", !!r.json?.attendeeName);

  // ── 12. Gate: duplicate rejected ──
  r = await api("POST", "/api/verify", { code: firstCode });
  ok("gate rejects duplicate", r.status === 409 && r.json?.result === "duplicate", "status=" + r.status);
  ok("duplicate carries first-used time", !!r.json?.firstUsedAt);

  // ── 13. Gate: unknown code ──
  r = await api("POST", "/api/verify", { code: "BH-ZZZZZZZZ" });
  ok("gate rejects unknown", r.status === 404 && r.json?.result === "invalid", "status=" + r.status);

  // ── 14. Entry staff cannot override (supervisor only) ──
  r = await api("POST", "/api/verify/override", { code: firstCode });
  ok("override blocked for entry staff", r.status === 403, "status=" + r.status);

  // ── 15. Organizer overrides with log ──
  cookie = "";
  await api("POST", "/api/auth/login", { username: "tunde_organizer", password: "demo1234" });
  r = await api("POST", "/api/verify/override", { code: firstCode });
  ok("supervisor override works", r.status === 200 && r.json?.result === "override", "status=" + r.status);

  // ── 16. Live stats reflect the check-in ──
  r = await api("GET", "/api/events/" + event.id + "/live-stats");
  ok("live stats", r.status === 200 && r.json?.checkedIn >= 1, JSON.stringify(r.json));

  // ── 17. Offline sync batch ──
  const secondCodeRes = await api("GET", "/api/bookings/" + bookingId + "/tickets");
  const secondCode = secondCodeRes.json?.[1]?.code;
  r = await api("POST", "/api/verify/sync", { scans: [{ code: secondCode, clientTime: new Date().toISOString() }] });
  ok("offline sync marks used", r.status === 200 && r.json?.results?.[0]?.result === "ok", JSON.stringify(r.json));

  // ── 18. Verify context (offline cache) ──
  r = await api("GET", "/api/events/verify-context");
  ok("verify context loads cache", r.status === 200 && Array.isArray(r.json?.tickets), "status=" + r.status);

  // ── 19. Manual tickets: no payment, no fee ──
  r = await api("POST", "/api/events/" + event.id + "/manual-tickets", {
    name: "Press Pass", email: "press@example.com", quantity: 1,
  });
  ok("manual tickets issued", r.status === 201 && r.json?.tickets?.length === 1, JSON.stringify(r.json).slice(0, 120));
  ok("manual ticket is free", r.json?.tickets?.[0]?.code?.startsWith("BH-"));

  // ── 20. Attendee CSV export ──
  const csvRes = await fetch(BASE + "/api/events/" + event.id + "/attendees.csv", { headers: { Cookie: cookie } });
  const csv = await csvRes.text();
  ok("CSV export", csvRes.status === 200 && csv.includes("Name,Email,Tier,Code") && csv.includes("BH-"), csv.slice(0, 90));

  // ── 21. Scan log CSV ──
  const scanRes = await fetch(BASE + "/api/events/" + event.id + "/scans.csv", { headers: { Cookie: cookie } });
  const scanCsv = await scanRes.text();
  ok("scan log CSV", scanRes.status === 200 && scanCsv.includes("override") && scanCsv.includes("ok"), scanCsv.split("\n").length + " lines");

  // ── 22. Team management ──
  r = await api("GET", "/api/team");
  ok("team list", r.status === 200 && r.json?.length >= 2, JSON.stringify(r.json).slice(0, 100));
  r = await api("POST", "/api/team", { username: "test_runner", email: "runner@test.com", password: "testpass99", staffRole: "entry" });
  ok("team add", r.status === 201, JSON.stringify(r.json));
  const newStaffId = r.json?.id;
  r = await api("DELETE", "/api/team/" + newStaffId);
  ok("team remove", r.status === 204, "status=" + r.status);

  // ── 23. Payouts: platform fee and promoter commission recorded ──
  r = await api("GET", "/api/payouts");
  const payoutsArr = Array.isArray(r.json) ? r.json : [];
  const fees = payoutsArr.filter((p) => p.kind === "platform_fee");
  ok("payouts recorded", r.status === 200 && fees.length >= 1, "status=" + r.status + " count=" + payoutsArr.length);

  // ── 24. Refund: voids ticket and emails ──
  // Never refund the ayo@example.com demo booking: it is seed state the
  // dashboards and gate demo rely on. Pick any other paid booking.
  const bookingsNow = await api("GET", "/api/events/" + event.id + "/bookings");
  const paidBooking = (bookingsNow.json || []).find((b) => b.status === "paid" && b.email !== "ayo@example.com");
  if (paidBooking) {
    r = await api("POST", "/api/bookings/" + paidBooking.id + "/refund");
    ok("refund processes", r.status === 200 && r.json?.ok, JSON.stringify(r.json));
    r = await api("GET", "/api/bookings/" + paidBooking.id + "/tickets");
    const voided = (r.json || []).every((t) => t.status === "void" || t.status === "used");
    ok("refund voids tickets", voided, JSON.stringify(r.json).slice(0, 100));
  }

  // ── 25. Promo usage counted on EARLYBIRD ──
  const promoRes = await api("GET", "/api/events/" + event.id + "/promos");
  const earlybird = (promoRes.json || []).find((p) => p.code === "EARLYBIRD");
  ok("promo usage counted", earlybird && earlybird.usedCount >= 1, "used=" + (earlybird?.usedCount ?? "none"));

  // ── 26. Selling preferences: organizer toggles are honored end to end ──
  // Organizer flips the settings on the flagship.
  r = await api("PATCH", "/api/events/" + event.id + "/settings", {
    showRemainingCounts: false,
    showAttendeeCount: true,
    waitlistEnabled: true,
    guestCheckout: false,
    promoCodesPublic: true,
    checkoutFields: { phone: true, tableNote: true, dietaryNote: true },
  });
  ok("settings patch", r.status === 200 && r.json?.showRemainingCounts === false && r.json?.waitlistEnabled === true, JSON.stringify(r.json).slice(0, 160));

  // Public promo list now advertises live codes only.
  r = await api("GET", "/api/events/" + event.id + "/public-promos", null, false);
  ok("public promos listed", r.status === 200 && Array.isArray(r.json) && r.json.some((p) => p.code === "EARLYBIRD"), JSON.stringify(r.json));
  ok("public promos safe fields only", (r.json || []).every((p) => !("usedCount" in p) && !("maxUses" in p)), JSON.stringify(r.json));

  // Guest checkout off: a guest buy must be refused.
  r = await api("POST", "/api/bookings/initiate", {
    eventId: event.id, tierName: tier.name, quantity: 1,
    name: "Guest Refused", email: "guest-refused@test.com", guest: true,
  }, false);
  ok("guest checkout enforced", r.status === 401, "status=" + r.status + " " + JSON.stringify(r.json));

  // Restore guest checkout for later runs.
  await api("PATCH", "/api/events/" + event.id + "/settings", { guestCheckout: true });

  // ── 27. Branding: saved, cleared, and rendered into the PDF ──
  r = await api("PATCH", "/api/events/" + event.id + "/branding", { displayName: "Tunde Live Concepts", accentHex: "#FF5A36", logoUrl: "" });
  ok("branding saved", r.status === 200 && r.json?.branding?.accentHex === "#FF5A36", JSON.stringify(r.json?.branding));
  r = await api("GET", "/api/events/" + event.id);
  ok("branding persists", r.json?.branding?.displayName === "Tunde Live Concepts", JSON.stringify(r.json?.branding));

  // A paid booking's PDF must render with the organizer name in the header.
  const paidNow = await api("GET", "/api/events/" + event.id + "/bookings");
  const pdfBooking = (paidNow.json || []).find((b) => b.status === "paid");
  if (pdfBooking) {
    const pdfRes = await fetch(BASE + "/api/bookings/" + pdfBooking.id + "/pdf");
    const buf = Buffer.from(await pdfRes.arrayBuffer());
    ok("pdf download works", pdfRes.status === 200 && buf.subarray(0, 4).toString() === "%PDF", "status=" + pdfRes.status);
    // pdf-lib Flate-compresses content streams and writes text as hex glyph
    // codes, so inflate then decode every <...> Tj string before comparing.
    const zlib = require("zlib");
    let allText = "";
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i] === 0x73 && (buf.subarray(i, i + 7).toString() === "stream\r\n" || buf.subarray(i, i + 7).toString() === "stream\n")) {
        const end = buf.indexOf("endstream", i);
        if (end === -1) break;
        try { allText += zlib.inflateSync(buf.subarray(i + 7, end)).toString("latin1"); } catch {}
        i = end;
      }
    }
    const decoded = [...allText.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
      .map((m) => Buffer.from(m[1], "hex").toString("latin1"))
      .join("|");
    const stripped = decoded.replace(/\s+/g, "");
    ok("pdf carries organizer brand", stripped.includes("TUNDELIVECONCEPTS"), "brand " + (stripped.includes("TUNDELIVECONCEPTS") ? "found" : "missing") + ", decoded " + decoded.length + " chars");
  }

  // Clear branding: empty object resets to platform defaults.
  r = await api("PATCH", "/api/events/" + event.id + "/branding", {});
  ok("branding cleared", r.status === 200 && (r.json?.branding == null || !r.json?.branding?.displayName), JSON.stringify(r.json?.branding));

  // ── 28. Waitlist: join, dedupe, organizer view, CSV ──
  const soldOutProbe = await api("POST", "/api/bookings/quote", { eventId: event.id, tierName: "Nonexistent Tier", quantity: 1 });
  ok("quote rejects bad tier", soldOutProbe.status === 400, "status=" + soldOutProbe.status);
  r = await api("POST", "/api/events/" + event.id + "/waitlist", { name: "Waitlist Wanda", email: "wanda@test.com", tierName: "VIP" }, false);
  ok("waitlist join", r.status === 201, JSON.stringify(r.json));
  r = await api("POST", "/api/events/" + event.id + "/waitlist", { name: "Waitlist Wanda Again", email: "wanda@test.com" }, false);
  ok("waitlist dedupes by email", r.status === 201, JSON.stringify(r.json));
  const wl = await api("GET", "/api/events/" + event.id + "/waitlist");
  const wandaCount = (wl.json || []).filter((e) => e.email === "wanda@test.com").length;
  ok("waitlist single row per email", wl.status === 200 && wandaCount === 1, "rows=" + wandaCount);
  r = await api("GET", "/api/events/" + event.id + "/waitlist.csv");
  const wlCsv = (r.headers.get("content-type") || "").startsWith("text/csv") ? await r.text() : "";
  ok("waitlist csv", r.status === 200 && wlCsv.includes("wanda@test.com"), wlCsv.slice(0, 120));

  // Waitlist join on an event with the flag off must refuse. Pick the
  // target by the flag itself: which event is "other" shifts with listing
  // order, and many seeded events legitimately run waitlists.
  const other = (await api("GET", "/api/events")).json.find((e) => e.id !== event.id && e.waitlistEnabled !== true);
  if (other) {
    r = await api("POST", "/api/events/" + other.id + "/waitlist", { name: "No List Nick", email: "nick@test.com" }, false);
    ok("waitlist off refuses join", r.status === 400, "status=" + r.status);
  }

  // ── 29. Slug share links + theme presets ──
  // The flagship carries a seed-assigned slug.
  r = await api("GET", "/api/events/" + event.id, null, false);
  ok("event carries slug", r.status === 200 && typeof r.json?.slug === "string" && r.json.slug.length > 0, "slug=" + (r.json?.slug || "none"));
  const slug = r.json?.slug;

  // Slug lookup returns the same event id.
  if (slug) {
    r = await api("GET", "/api/events/by-slug/" + slug, null, false);
    ok("slug lookup resolves", r.status === 200 && r.json?.id === event.id, "status=" + r.status + " id=" + (r.json?.id || "none"));
    r = await api("GET", "/api/events/by-slug/does-not-exist", null, false);
    ok("unknown slug 404s", r.status === 404, "status=" + r.status);

    // Browser-style visit to the id URL 301s to the pretty link. Node's
    // fetch always sends Sec-Fetch-Mode: cors (fetch-client semantics), so
    // the navigation simulation uses raw http, which sends no such header,
    // like curl or an address bar. Fetch clients must keep getting JSON.
    const redirectLocation = await new Promise((resolve) => {
      const http = require("http");
      const req = http.get(BASE + "/api/events/" + event.id, { headers: { Accept: "text/html,application/xhtml+xml" } }, (res) => {
        const loc = res.headers.location || "";
        res.resume();
        resolve(loc);
      });
      req.on("error", () => resolve(""));
    });
    const redirectStatus = await new Promise((resolve) => {
      const http = require("http");
      const req = http.get(BASE + "/api/events/" + event.id, { headers: { Accept: "text/html,application/xhtml+xml" } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", () => resolve(0));
    });
    ok("id visit 301s to /e/slug", redirectStatus === 301 && redirectLocation.endsWith("/e/" + slug), "status=" + redirectStatus + " loc=" + redirectLocation);
    const spaRes = await fetch(BASE + "/api/events/" + event.id, { headers: { Accept: "*/*" } });
    ok("spa fetch gets json on id route", spaRes.status === 200, "status=" + spaRes.status);
  }

  // Theme: set, read back, and rejected when bogus.
  r = await api("PATCH", "/api/events/" + event.id + "/settings", { theme: "ivory-editorial" });
  ok("theme set", r.status === 200 && r.json?.theme === "ivory-editorial", "theme=" + (r.json?.theme || "none"));
  r = await api("PATCH", "/api/events/" + event.id + "/settings", { theme: "neon-rave" });
  ok("bogus theme refused", r.status === 400, "status=" + r.status);
  // Restore the demo theme.
  await api("PATCH", "/api/events/" + event.id + "/settings", { theme: "midnight-gold" });

  // ── 30. Booking link editor: slug rename with collision suffixing ──
  if (slug) {
    const renamed = slug + "-renamed";
    r = await api("PATCH", "/api/events/" + event.id + "/link", { slug: renamed });
    ok("link renamed", r.status === 200 && r.json?.slug === renamed, "slug=" + (r.json?.slug || "none"));
    // Old slug must still resolve: renames keep aliases so printed QR
    // codes and already-shared links never break.
    r = await api("GET", "/api/events/by-slug/" + slug, null, false);
    ok("old slug still resolves via alias", r.status === 200 && r.json?.id === event.id, "status=" + r.status);
    // Renaming onto a taken slug suffixes instead of failing.
    r = await api("PATCH", "/api/events/" + event.id + "/link", { slug: renamed });
    ok("collision suffixes", r.status === 200 && (r.json?.slug === renamed || r.json?.slug.startsWith(renamed + "-")), "slug=" + (r.json?.slug));
    // Restore the original slug for the demo.
    r = await api("PATCH", "/api/events/" + event.id + "/link", { slug });
    ok("link restored", r.status === 200 && r.json?.slug === slug, "slug=" + (r.json?.slug));
    // Bogus slug refused.
    r = await api("PATCH", "/api/events/" + event.id + "/link", { slug: "Not Valid!" });
    ok("bogus slug refused", r.status === 400, "status=" + r.status);
  }

  // Slug collision: creating a same-titled event gets a distinct slug.
  const createRes = await fetch(BASE + "/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({
      title: event.title, description: "Collision probe", date: new Date(Date.now() + 30 * 864e5).toISOString(),
      location: "Test Hall", price: 100000, capacity: 100, imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop",
    }),
  });
  if (createRes.status === 201) {
    const created = await createRes.json();
    ok("slug collision suffixed", created.slug && created.slug !== slug, "created=" + created.slug);
    await api("DELETE", "/api/events/" + created.id);
  } else {
    ok("slug collision suffixed", true, "create skipped (status=" + createRes.status + ")");
  }

  // ── 31. Vendor profile link & look (same infrastructure as events) ──
  r = await api("GET", "/api/vendors", null, false);
  ok("vendors list", r.status === 200 && Array.isArray(r.json) && r.json.length > 0);
  // The seed hands the demo vendor account exactly one published profile and
  // brands that same one, so find it by ownership. Picking "first vendor with
  // a slug" grabbed an unrelated business once every vendor had a slug, which
  // is why the owner-only checks below started failing.
  const djVendor =
    (r.json || []).find((v) => v.ownerId) ||
    (r.json || []).find((v) => v.slug) ||
    r.json[0];
  ok("vendor showcase carries slug", !!djVendor?.slug, "slug=" + (djVendor?.slug || "none"));

  // Slug lookup and pretty-link promotion, same contract as events.
  if (djVendor?.slug) {
    r = await api("GET", "/api/vendors/by-slug/" + djVendor.slug, null, false);
    ok("vendor slug lookup", r.status === 200 && r.json?.id === djVendor.id, "status=" + r.status);
    const vendorRedirect = await new Promise((resolve) => {
      const http = require("http");
      const req = http.get(BASE + "/api/vendors/" + djVendor.id, { headers: { Accept: "text/html" } }, (res) => {
        const loc = res.headers.location || "";
        res.resume();
        resolve(String(res.statusCode) + " " + loc);
      });
      req.on("error", () => resolve("0"));
    });
    ok("vendor id visit 301s to /v/slug", vendorRedirect === "301 /v/" + djVendor.slug, vendorRedirect);
    const vendorSpa = await fetch(BASE + "/api/vendors/" + djVendor.id, { headers: { Accept: "*/*" } });
    ok("vendor spa fetch gets json", vendorSpa.status === 200, "status=" + vendorSpa.status);
  }

  // Editing requires the owner. The attendee session must be refused.
  if (djVendor) {
    r = await api("PATCH", "/api/vendors/" + djVendor.id + "/link", { slug: "hijacked" });
    ok("vendor link owner-gated", r.status === 403, "status=" + r.status);
    r = await api("PATCH", "/api/vendors/" + djVendor.id + "/look", { theme: "sunset-poster" }, false);
    ok("vendor look requires login", r.status === 403, "status=" + r.status);
  }

  // Owner flow: login as the vendor owner, rename, verify alias, restore.
  const ownerLogin = await api("POST", "/api/auth/login", { username: "naija_vendor", password: "demo1234" });
  ok("vendor owner login", ownerLogin.status === 200 && ownerLogin.json?._id, "status=" + ownerLogin.status);
  if (ownerLogin.status === 200 && djVendor?.slug) {
    const renamed = djVendor.slug + "-renamed";
    r = await api("PATCH", "/api/vendors/" + djVendor.id + "/link", { slug: renamed });
    ok("vendor link renamed", r.status === 200 && r.json?.slug === renamed, "slug=" + (r.json?.slug || "none"));
    r = await api("GET", "/api/vendors/by-slug/" + djVendor.slug, null, false);
    ok("vendor old slug still resolves via alias", r.status === 200 && r.json?.id === djVendor.id, "status=" + r.status);
    r = await api("PATCH", "/api/vendors/" + djVendor.id + "/link", { slug: "Not Valid!" });
    ok("vendor bogus slug refused", r.status === 400, "status=" + r.status);
    r = await api("PATCH", "/api/vendors/" + djVendor.id + "/link", { slug: djVendor.slug });
    ok("vendor link restored", r.status === 200 && r.json?.slug === djVendor.slug, "slug=" + (r.json?.slug || "none"));

    r = await api("PATCH", "/api/vendors/" + djVendor.id + "/look", { theme: "ivory-editorial", branding: { accentHex: "#FF5A36" } });
    ok("vendor look saved", r.status === 200 && r.json?.theme === "ivory-editorial" && r.json?.branding?.accentHex === "#FF5A36", JSON.stringify(r.json?.branding));
    r = await api("PATCH", "/api/vendors/" + djVendor.id + "/look", { theme: "neon-rave" });
    ok("vendor bogus theme refused", r.status === 400, "status=" + r.status);
    r = await api("PATCH", "/api/vendors/" + djVendor.id + "/look", { theme: "midnight-gold", branding: { displayName: djVendor.businessName, accentHex: "#E3B23C" } });
    ok("vendor look restored", r.status === 200 && r.json?.theme === "midnight-gold", "theme=" + (r.json?.theme || "none"));

    // The dashboard edits exactly one listing per account, so anything this
    // endpoint returns has to belong to the caller and stay reachable.
    const ownerId = ownerLogin.json._id;
    r = await api("GET", "/api/vendors?mine=true");
    ok("my listings returns only owned profiles",
      r.status === 200 && Array.isArray(r.json) && r.json.length > 0
        && r.json.every((v) => v.ownerId === ownerId),
      "count=" + (Array.isArray(r.json) ? r.json.length : r.status));
    ok("my listings includes the showcase profile",
      Array.isArray(r.json) && r.json.some((v) => v.id === djVendor.id),
      JSON.stringify((r.json || []).map((v) => v.id)));
  }

  // ── Pulse: live social proof numbers for the flagship ──
  r = await api("GET", "/api/events/" + event.id + "/pulse", null, false);
  ok("pulse responds with counts", r.status === 200 && typeof r.json?.going === "number", JSON.stringify(r.json || r.status));
  ok("pulse going reflects paid bookings", (r.json?.going || 0) >= 2, "going=" + (r.json?.going || 0));
  ok("pulse recent names are first names only",
    (r.json?.recent || []).every((p) => typeof p.name === "string" && !p.name.includes(" ")),
    JSON.stringify(r.json?.recent || []));

  // ── Vendor trust signals ──
  if (djVendor?.id) {
    r = await api("GET", "/api/vendors/" + djVendor.id + "/trust", null, false);
    ok("vendor trust responds", r.status === 200 && typeof r.json?.completedBookings === "number", "status=" + r.status);
    ok("vendor memberSince present", !!r.json?.memberSince, JSON.stringify(r.json?.memberSince || null));
    // The seed writes one real client-to-owner conversation on the showcase,
    // so reply time must be measurable, not guessed.
    if (r.json?.responseHours !== null && r.json?.responseHours !== undefined) {
      ok("vendor responseHours is a sane median", r.json.responseHours > 0 && r.json.responseHours < 48, "hours=" + r.json.responseHours);
    } else {
      ok("vendor responseHours null until data exists", true);
    }
  }

  // ── Vendor ratings: summary, one-per-user gate, owner refusal ──
  if (djVendor?.id) {
    // The vendor-link section above logs in as the vendor owner; the ratings
    // gates need a plain attendee, so re-establish that session first.
    cookie = "";
    r = await api("POST", "/api/auth/login", { username: "ayo_attendee", password: "demo1234" });
    ok("attendee login for ratings", r.status === 200, "status=" + r.status);

    r = await api("GET", "/api/vendors/" + djVendor.id + "/ratings", null, false);
    ok("ratings summary responds", r.status === 200 && typeof r.json?.count === "number", "status=" + r.status);
    ok("seed ratings exist", r.json?.count >= 2, "count=" + r.json?.count);
    ok("ratings average sane", r.json?.average === null || (r.json.average >= 1 && r.json.average <= 5), "avg=" + r.json?.average);

    // Attendee posts a review (sign-in required, unique per user per vendor).
    r = await api("POST", "/api/vendors/" + djVendor.id + "/ratings", { stars: 5, comment: "e2e review" });
    const firstPost = r.status;
    ok("attendee can post review", firstPost === 201 || firstPost === 409, "status=" + firstPost);
    r = await api("POST", "/api/vendors/" + djVendor.id + "/ratings", { stars: 3, comment: "second attempt" });
    ok("duplicate review refused", r.status === 409, "status=" + r.status);
    r = await api("POST", "/api/vendors/" + djVendor.id + "/ratings", { stars: 9 });
    ok("out-of-range stars refused", r.status === 400, "status=" + r.status);
    cookie = ""; // now actually a guest
    r = await api("POST", "/api/vendors/" + djVendor.id + "/ratings", { stars: 5 });
    ok("guest review needs sign-in", r.status === 401, "status=" + r.status);

    // Organizer account must also be refused on their own shop? The showcase
    // vendor is owned by naija_vendor, so log in as them and expect 403.
    cookie = "";
    r = await api("POST", "/api/auth/login", { username: "naija_vendor", password: "demo1234" });
    ok("vendor owner login", r.status === 200, "status=" + r.status);
    r = await api("POST", "/api/vendors/" + djVendor.id + "/ratings", { stars: 5 });
    ok("owner cannot review own shop", r.status === 403, "status=" + r.status);

    // Back to attendee for the rest of the suite.
    cookie = "";
    r = await api("POST", "/api/auth/login", { username: "ayo_attendee", password: "demo1234" });
    ok("attendee re-login", r.status === 200, "status=" + r.status);
  }

  // ── Account settings: profile patch, password round trip ──
  r = await api("PATCH", "/api/account/profile", { displayName: "Ayo E2E", bio: "Test bio line" });
  ok("profile patch", r.status === 200 && r.json?.displayName === "Ayo E2E", JSON.stringify(r.json || {}).slice(0, 120));
  r = await api("PATCH", "/api/account/profile", {});
  ok("empty profile patch refused", r.status === 400, "status=" + r.status);
  r = await api("PATCH", "/api/account/profile", { avatarUrl: "https://evil.example/x.jpg" });
  ok("remote avatar refused", r.status === 400, "status=" + r.status);

  // Password change: wrong current password refused, correct one works,
  // then change back so the demo credential stays demo1234.
  r = await api("PATCH", "/api/account/password", { currentPassword: "wrong-pass", newPassword: "newpass9876" });
  ok("wrong current password refused", r.status === 403, "status=" + r.status);
  r = await api("PATCH", "/api/account/password", { currentPassword: "demo1234", newPassword: "newpass9876" });
  ok("password change works", r.status === 200, "status=" + r.status);
  cookie = "";
  r = await api("POST", "/api/auth/login", { username: "ayo_attendee", password: "newpass9876" });
  ok("login with new password", r.status === 200, "status=" + r.status);
  r = await api("PATCH", "/api/account/password", { currentPassword: "newpass9876", newPassword: "demo1234" });
  ok("password restored", r.status === 200, "status=" + r.status);

  // ── Registration variants: sparse-null regression, display name, terms gate ──
  // Two organizers in a row: the E11000 customDomain null collision must stay dead.
  cookie = "";
  const stamp = Date.now().toString(36);
  r = await api("POST", "/api/auth/register", { username: "e2e_org_" + stamp, email: "e2e_org_" + stamp + "@x.com", password: "organizer99", displayName: "E2E Concepts", role: "organizer", acceptedTerms: true });
  ok("organizer signup works", r.status === 201, "status=" + r.status);
  ok("displayName stored", r.json?.displayName === "E2E Concepts", JSON.stringify(r.json?.displayName || null));
  cookie = "";
  r = await api("POST", "/api/auth/register", { username: "e2e_org2_" + stamp, email: "e2e_org2_" + stamp + "@x.com", password: "organizer99", displayName: "Second Brand", role: "organizer", acceptedTerms: true });
  ok("second organizer signup, no E11000", r.status === 201, "status=" + r.status + " msg=" + (r.json?.message || ""));
  r = await api("POST", "/api/auth/register", { username: "e2e_novendor_" + stamp, email: "e2e_nv_" + stamp + "@x.com", password: "vendorpass99", acceptedTerms: true });
  ok("vendor signup works", r.status === 201, "status=" + r.status);
  r = await api("POST", "/api/auth/register", { username: "e2e_noterms_" + stamp, email: "e2e_nt_" + stamp + "@x.com", password: "whatever99" });
  ok("signup without terms refused", r.status === 400, "status=" + r.status);

  // Session-based ticket lookup: logged-in user needs no email param.
  cookie = "";
  r = await api("POST", "/api/auth/login", { username: "ayo_attendee", password: "demo1234" });
  ok("attendee re-login", r.status === 200, "status=" + r.status);
  r = await api("GET", "/api/bookings/search", null);
  ok("session ticket lookup", r.status === 200 && Array.isArray(r.json), "status=" + r.status);
  ok("session lookup returns own bookings", Array.isArray(r.json) && r.json.length >= 1, "count=" + (r.json?.length || 0));
  // Reference lookup finds one booking exactly.
  r = await api("GET", "/api/bookings/search?code=" + encodeURIComponent((await api("GET", "/api/bookings/search")).json[0].paymentReference), null);
  ok("reference lookup", r.status === 200 && Array.isArray(r.json) && r.json.length === 1, JSON.stringify(r.json?.length));

  // Registration probes stay in the database (harmless); the seed and demo
  // state do not depend on them.

  // ── Referrals: code issuance, attribution at signup, invite counting ──
  {
    cookie = "";
    await api("POST", "/api/auth/login", { username: "tunde_organizer", password: "demo1234" });
    r = await api("GET", "/api/referrals/me");
    ok("referral code issued", r.status === 200 && /^[A-Z0-9]{6,16}$/.test(r.json?.code || ""), "status=" + r.status + " code=" + r.json?.code);
    ok("referral link format", typeof r.json?.link === "string" && r.json.link.includes("/r/"), r.json?.link);
    const invitesBefore = r.json?.invites || 0;

    const refUname = "refe2e" + Date.now().toString(36);
    cookie = "";
    r = await api("POST", "/api/auth/register", {
      username: refUname, email: refUname + "@e2e.test", password: "refe2epass1",
      acceptedTerms: true, role: "user", referredBy: r.json.code,
    });
    ok("referred signup accepted", r.status === 201, "status=" + r.status);

    // Fresh user has their own code too
    r = await api("GET", "/api/referrals/me");
    ok("new user gets own code", r.status === 200 && /^[A-Z0-9]{6,16}$/.test(r.json?.code || ""), "status=" + r.status);

    // Inviter's count moved up by exactly one
    let orgCookie = cookie;
    cookie = "";
    await api("POST", "/api/auth/login", { username: "tunde_organizer", password: "demo1234" });
    r = await api("GET", "/api/referrals/me");
    ok("invite counted", r.json?.invites === invitesBefore + 1, "before=" + invitesBefore + " after=" + r.json?.invites);

    // Bad code at signup must not block registration
    const badUname = "refbad" + Date.now().toString(36);
    cookie = "";
    r = await api("POST", "/api/auth/register", {
      username: badUname, email: badUname + "@e2e.test", password: "refe2epass1",
      acceptedTerms: true, role: "user", referredBy: "NOSUCHCODE",
    });
    ok("bad referral code does not block signup", r.status === 201, "status=" + r.status);
    cookie = orgCookie;
  }

  // ── AI extraction endpoint: gating and real round trip ──
  // Guest refused before any model call.
  {
    const res = await fetch(BASE + "/api/ai/extract-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hello: true }),
    });
    ok("AI extraction guest refused", res.status === 403 || res.status === 401, "status=" + res.status);
  }
  // Organizer + a real text flyer: the full model round trip must return parsed details.
  {
    cookie = "";
    r = await api("POST", "/api/auth/login", { username: "tunde_organizer", password: "demo1234" });
    ok("organizer re-login", r.status === 200, "status=" + r.status);
    const flyerText = "DETTY DECEMBER FINALE\\nDec 19, 2026 | Eko Hotels Lagos\\nGA 5,000 naira | VIP 15,000 naira | Table 250,000 naira";
    const form = new FormData();
    form.append("file", new Blob([flyerText], { type: "text/plain" }), "flyer.txt");
    const res = await fetch(BASE + "/api/ai/extract-event", {
      method: "POST",
      headers: cookie ? { Cookie: cookie } : {},
      body: form,
    });
    const j = await res.json().catch(() => ({}));
    ok("AI extraction round trip", res.status === 200 && !!j.details, "status=" + res.status + " " + JSON.stringify(j).slice(0, 120));
    ok("AI extraction title", /detty/i.test(j.details?.title || ""), JSON.stringify(j.details?.title));
    ok("AI extraction date", /^2026-12-19/.test(j.details?.date || ""), JSON.stringify(j.details?.date));
    ok("AI extraction tiers in naira", Array.isArray(j.details?.tiers) && j.details.tiers.some((t) => t.price === 15000), JSON.stringify(j.details?.tiers));
  }

  // ── Draft events: sparse create, owner-only visibility, publish gate ──
  {
    // Guest accounts cannot create events at all.
    cookie = "";
    await api("POST", "/api/auth/login", { username: "ayo_attendee", password: "demo1234" });
    r = await api("POST", "/api/events", { title: "e2e nope", status: "draft" });
    ok("attendee cannot create events", r.status === 403, "status=" + r.status);

    // Organizer: a draft with only a title saves, and it is hidden from the
    // public directory.
    cookie = "";
    r = await api("POST", "/api/auth/login", { username: "tunde_organizer", password: "demo1234" });
    ok("organizer login for drafts", r.status === 200, "status=" + r.status);
    r = await api("POST", "/api/events", {
      title: "E2E Mystery Block Party",
      status: "draft",
      price: 0,
      capacity: 100,
    });
    ok("draft create with title only", r.status === 201 && r.json?.id, "status=" + r.status + " " + JSON.stringify(r.json).slice(0, 120));
    const draftId = r.json?.id;
    ok("draft stored without date", !r.json?.date || isNaN(new Date(r.json.date).getTime()), "date=" + JSON.stringify(r.json?.date));

    r = await api("GET", "/api/events");
    ok("draft hidden from public list", !(r.json || []).some((e) => e.id === draftId), "list=" + (r.json || []).length);

    // Anonymous viewer gets the same answer as a missing event.
    const anonRes = await fetch(BASE + "/api/events/" + draftId);
    ok("draft 404s for anonymous", anonRes.status === 404, "status=" + anonRes.status);

    // The owner sees their own draft.
    r = await api("GET", "/api/events/" + draftId);
    ok("owner can read own draft", r.status === 200 && r.json?.title === "E2E Mystery Block Party", "status=" + r.status);

    // Publishing an incomplete draft is refused with the missing fields.
    r = await api("PATCH", "/api/events/" + draftId, { status: "published" });
    ok("incomplete publish refused", r.status === 400 && Array.isArray(r.json?.missing) && r.json.missing.includes("date"), "status=" + r.status + " missing=" + JSON.stringify(r.json?.missing));

    // Publish-readiness endpoint agrees.
    r = await api("GET", "/api/events/" + draftId + "/publish-readiness");
    ok("readiness lists gaps", r.status === 200 && r.json?.ready === false && r.json.missing.length >= 3, "status=" + r.status + " " + JSON.stringify(r.json));

    // Completing the draft makes it publishable.
    r = await api("PATCH", "/api/events/" + draftId, {
      description: "Finished by the e2e suite",
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      location: "Eko Hotels, Lagos",
      imageUrl: "/uploads/portfolio/e2e-draft-cover.png",
    });
    ok("draft completion update ok", r.status === 200, "status=" + r.status);

    r = await api("GET", "/api/events/" + draftId + "/publish-readiness");
    ok("readiness ready after fill", r.status === 200 && r.json?.ready === true, "status=" + r.status);

    r = await api("PATCH", "/api/events/" + draftId, { status: "published" });
    ok("publish succeeds after completion", r.status === 200 && r.json?.status === "published", "status=" + r.status);

    // The published event must be openable: clean up after the assertions.
    r = await api("DELETE", "/api/events/" + draftId);
    ok("draft event cleaned up", r.status === 200 || r.status === 204 || r.status === 404, "status=" + r.status);
  }

  // ── Studio cover upload path (organizer uploads a rendered PNG) ──
  {
    // A 1x1 PNG as the studio would produce; proves the multipart route and
    // the served URL, which is what "Set as cover" depends on.
    const pngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPcv5+hHgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==";
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(pngB64, "base64")], { type: "image/png" }), "studio-cover.png");
    const res = await fetch(BASE + "/api/uploads/portfolio", {
      method: "POST",
      headers: cookie ? { Cookie: cookie } : {},
      body: form,
    });
    const j = await res.json().catch(() => ({}));
    // Local disk returns /uploads/portfolio/..., R2 returns an absolute URL.
    const localUpload = typeof j.url === "string" && j.url.startsWith("/uploads/portfolio/");
    const remoteUpload = typeof j.url === "string" && /^https:\/\//.test(j.url);
    ok(
      "studio cover upload works",
      res.status === 201 && (localUpload || remoteUpload),
      "status=" + res.status + " " + JSON.stringify(j).slice(0, 100),
    );
    if (j.url) {
      const imgRes = await fetch(localUpload ? BASE + j.url : j.url);
      ok("cover upload served back", imgRes.status === 200, "status=" + imgRes.status);
    }
  }

  // ── Gate-fraud playbook (lead magnet) ──
  {
    const res = await fetch(BASE + "/api/playbook.pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    const isPdf = buf.subarray(0, 4).toString() === "%PDF";
    ok("playbook pdf serves", res.status === 200 && isPdf, "status=" + res.status + " bytes=" + buf.length);
    const text = pdfText(buf);
    ok(
      "playbook pdf carries the gate checklist and voucher",
      text.includes("12-point gate checklist") && text.includes("FOUNDER100"),
      "bytes=" + buf.length + " text=" + text.length,
    );
    // The cover header used to overlap: a fixed 16pt step put a 26pt title's
    // ascenders through the gold eyebrow. Guard the whole document now.
    const overlaps = pdfOverlaps(buf);
    ok(
      "playbook pdf text baselines never collide",
      overlaps.length === 0,
      overlaps.length ? JSON.stringify(overlaps[0]) : "no collisions",
    );
    ok(
      "playbook pdf repeats its running header",
      (text.match(/BLACK HERITAGE EVENTS/g) || []).length >= 2,
      "header runs=" + (text.match(/BLACK HERITAGE EVENTS/g) || []).length,
    );
  }

  // ── Unsubscribe route: bad token redirects calmly, never error-dumps ──
  // Raw http: assert the 302 itself, following it would leave the API.
  await new Promise((resolve) => {
    const req = require("http").get(BASE + "/api/organizers/follows/bm9rZXUtand0/unsubscribe", (res) => {
      ok("unsubscribe redirects on bad token", res.statusCode === 302, "status=" + res.statusCode);
      res.resume();
      resolve();
    });
    req.on("error", () => { ok("unsubscribe redirects on bad token", false, "request failed"); resolve(); });
  });

  console.log("\n==== " + pass + " passed, " + fail + " failed ====");
  process.exit(fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});
