// /api/confirm.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  try {
    const body = req.body;
    if (!body || !body.uid || !body.mobile || !body.payload) return res.status(400).json({ ok:false, error:"Missing fields" });

    // basic mobile normalization
    let mobile = String(body.mobile || "").trim();
    mobile = mobile.replace(/[^\d+]/g, "");
    if (!/^\+?\d{10,15}$/.test(mobile)) return res.status(400).json({ ok:false, error:"Invalid mobile" });
    if (!mobile.startsWith("+")) {
      // assume 10-digit Indian local -> +91
      mobile = mobile.length === 10 ? "+91" + mobile : "+" + mobile;
    }

    // payload fields
    const payload = body.payload || {};
    const serverTs = new Date().toISOString();

    // Prepare the body to forward to Apps Script
    const forward = {
      secret: process.env.SHEETS_WEBHOOK_SECRET || "",
      type: "package",
      uid: body.uid,
      ts: serverTs,
      mobile,
      date: payload.date || "",
      guests: payload.guests || "",
      activities: payload.activities || [],
      notes: payload.notes || "",
      summary: String(payload.summary || "").slice(0, 5000),
      test: !!body.test
    };

    const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;
    if (!SHEETS_WEBHOOK_URL) return res.status(500).json({ ok:false, error:"SHEETS_WEBHOOK_URL not configured" });

    // Forward
    const fRes = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forward)
    });

    let j;
    try { j = await fRes.json(); } catch(e) { j = null; }

    if (!fRes.ok) {
      return res.status(502).json({ ok:false, error: "Sheets webapp error", detail: j || await fRes.text() });
    }

    return res.status(200).json({ ok:true, ts: serverTs, ref: (j && j.ref) || null });
  } catch (err) {
    console.error("confirm error:", err);
    return res.status(500).json({ ok:false, error: String(err) });
  }
}
