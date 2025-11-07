// api/confirm.js
// Robust confirm handler: reads request body once, validates mobile/uid/payload,
// forwards a normalized payload to SHEETS_WEBHOOK_URL, and avoids double-reading responses.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // --- Read incoming body exactly once ---
    let body = null;
    try {
      // If framework has already parsed body (Next.js often does), prefer that
      if (req.body && Object.keys(req.body).length > 0) {
        body = req.body;
      } else if (typeof req.json === "function") {
        body = await req.json();
      } else {
        const txt = await req.text();
        body = txt ? JSON.parse(txt) : {};
      }
    } catch (err) {
      console.error("confirm error: invalid JSON body", err);
      return res.status(400).json({ ok: false, error: "Invalid JSON body" });
    }

    // --- Basic presence checks ---
    const missing = [];
    if (!body.uid) missing.push("uid");
    if (!body.mobile) missing.push("mobile");
    if (!body.payload) missing.push("payload");

    if (missing.length > 0) {
      return res.status(400).json({ ok: false, error: "Missing fields", missing });
    }

    // --- Mobile normalization & validation ---
    let mobile = String(body.mobile || "").trim();
    // remove everything except digits and plus
    mobile = mobile.replace(/[^\d+]/g, "");
    if (!/^\+?\d{10,15}$/.test(mobile)) {
      return res.status(400).json({ ok: false, error: "Invalid mobile" });
    }
    if (!mobile.startsWith("+")) {
      // assume 10-digit Indian local -> +91
      mobile = mobile.length === 10 ? "+91" + mobile : "+" + mobile;
    }

    // --- Prepare forward payload ---
    const payload = (body.payload && typeof body.payload === "object") ? body.payload : {};
    const serverTs = new Date().toISOString();

    const forward = {
      secret: process.env.SHEETS_WEBHOOK_SECRET || "",
      type: "package",
      uid: String(body.uid),
      ts: serverTs,
      mobile,
      date: payload.date || "",
      guests: payload.guests || "",
      activities: Array.isArray(payload.activities) ? payload.activities : (payload.activities ? [payload.activities] : []),
      notes: payload.notes || "",
      summary: String(payload.summary || "").slice(0, 5000),
      test: !!body.test
    };

    const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;
    if (!SHEETS_WEBHOOK_URL) {
      console.error("confirm error: SHEETS_WEBHOOK_URL not configured");
      return res.status(500).json({ ok: false, error: "SHEETS_WEBHOOK_URL not configured" });
    }

    // --- Forward the payload and read response exactly once ---
    const fRes = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forward)
    });

    // Read text once and attempt to parse JSON
    const fText = await fRes.text();
    let fJson = null;
    try { fJson = fText ? JSON.parse(fText) : null; } catch (e) { fJson = null; }

    if (!fRes.ok) {
      // Provide helpful detail (avoid leaking secrets)
      const detail = fJson || fText || `HTTP ${fRes.status}`;
      console.error("confirm forward error:", fRes.status, detail);
      return res.status(502).json({ ok: false, error: "Sheets webapp error", detail });
    }

    // Success: return server timestamp + any ref from sheets
    return res.status(200).json({ ok: true, ts: serverTs, ref: (fJson && fJson.ref) || null });
  } catch (err) {
    console.error("confirm error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
