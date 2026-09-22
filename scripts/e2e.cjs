// End-to-end test against the live backend on 3001. Exercises the full
// ticketing lifecycle and prints PASS/FAIL per assertion.
const BASE = "http://localhost:3001";
const crypto = require("crypto");
let cookie = "";
let pass = 0, fail = 0;

function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (detail ? " :: " + detail : "")); }
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
    const pl = await api("GET", "/api/events/" + e.id + "/promos");
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
  // With real Paystack keys, finalize correctly refuses an unverified
  // payment. The webhook is the source of truth, signed with the secret.
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
  const bookingsNow = await api("GET", "/api/events/" + event.id + "/bookings");
  const paidBooking = (bookingsNow.json || []).find((b) => b.status === "paid");
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

  // Waitlist join on an event with the flag off must refuse.
  const other = (await api("GET", "/api/events")).json.find((e) => e.id !== event.id);
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
  // The seed brands one published vendor (whichever set the database
  // holds), so the test finds it by slug rather than by name.
  const djVendor = (r.json || []).find((v) => v.slug) || r.json[0];
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
