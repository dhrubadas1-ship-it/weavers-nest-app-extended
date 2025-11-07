// public/app.js
// Robust front-end glue for Weavers Nest
// - Defensive wiring for Build Custom Package
// - PDF download (jsPDF if available, fallback to txt)
// - Confirm uses last built package
// - Gallery stable image handling (onerror fallback, object-fit)
// - Partner logos visibility helpers
// This file intentionally focuses on fixing the package/build + gallery/logo issues
// without modifying HTML on disk. Drop in as a full replacement.

// ---------- Utilities ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const safeText = (v) => (v === undefined || v === null) ? '' : String(v);

// ---------- App state ----------
window.__wn = window.__wn || {};
window.__lastBuiltPackage = window.__lastBuiltPackage || null;
window.selected = window.selected || new Set();

// ---------- DOM refs (defensive) ----------
const refs = {
  actsEl: $("#activities"),
  buildBtn: $("#buildPackage"),
  packageOut: $("#packageOut"),
  confirmBtn: $("#confirmSaveBtn"),
  downloadBtn: $("#downloadPdf"),
  emailBtn: $("#emailPkg"),
  dateEl: $("#date"),
  guestsEl: $("#guests"),
  notesEl: $("#notes"),
  galleryGrid: $("#galleryGrid"),
  partnerNodes: $$(".partner"),
  chatForm: $("#chatForm"),
  chatInput: $("#chatInput"),
  sendBtn: $("#sendBtn"),
};

// ---------- Ensure elements exist ----------
Object.keys(refs).forEach(k => {
  if (!refs[k]) {
    // avoid spamming console for optional nodes
    // console.debug(`ref missing: ${k}`);
  }
});

// ---------- Helper: read selected activities ----------
function currentSelectedActivities() {
  // prefer window.selected if populated
  if (window.selected && typeof window.selected === 'object' && window.selected.size !== undefined) {
    return Array.from(window.selected);
  }
  // fallback: find badges with is-on
  const out = [];
  $$("#activities .card-item").forEach(ci => {
    const badge = ci.querySelector(".badge");
    if (badge && badge.classList.contains("is-on")) {
      // try to find an id on the element or use its text
      const dataId = ci.dataset?.id;
      if (dataId) out.push(dataId);
      else {
        const txt = ci.innerText || "";
        out.push(txt.trim().split("\n")[0].trim());
      }
    }
  });
  return out;
}

// ---------- Helper: format package summary ----------
function buildSummaryText(date, guests, activityNames, notes) {
  return `Date: ${date || "Not set"}
Guests: ${guests}
Activities: ${activityNames || "None"}
Notes: ${notes || "-"}

Download the PDF and share it with Manjeet: +91 96782 19052.`;
}

// ---------- Robust build handler ----------
window.buildPackageHandler = function buildPackageHandler() {
  const date = refs.dateEl ? refs.dateEl.value : "";
  const guests = refs.guestsEl ? parseInt(refs.guestsEl.value || "1", 10) : 1;
  const notes = refs.notesEl ? refs.notesEl.value.trim() : "";
  const activities = currentSelectedActivities();

  // Find names of activities from DOM or fallback
  let activityNames = "";
  if (activities.length) {
    // try to map to visible names by searching activity elements
    const names = [];
    activities.forEach(a => {
      // if a is an id, try to find element with data-id or match by substring
      let foundName = null;
      const byData = $(`#activities [data-id="${a}"]`);
      if (byData) foundName = (byData.querySelector('div')?.innerText || byData.innerText).trim();
      if (!foundName) {
        // fallback: search for card that contains the id as text
        $$("#activities .card-item").some(ci => {
          const t = ci.innerText || "";
          if (t.toLowerCase().includes(String(a).toLowerCase())) { foundName = t.trim().split("\n")[0].trim(); return true; }
          return false;
        });
      }
      names.push(foundName || a);
    });
    activityNames = names.join(" • ");
  } else {
    // if nothing selected, try to read selected class names text
    activityNames = $$("#activities .card-item .badge.is-on").map(ci => {
      const p = ci.closest('.card-item');
      return p ? (p.querySelector('div')?.innerText || p.innerText).trim().split("\n")[0].trim() : "";
    }).filter(Boolean).join(" • ");
  }

  const summaryText = buildSummaryText(date, guests, activityNames, notes);

  // update UI
  if (refs.packageOut) {
    refs.packageOut.textContent = summaryText;
  } else {
    // try to find an alternate element
    const out = document.querySelector("#packageOut") || document.querySelector(".package-out");
    if (out) out.textContent = summaryText;
  }

  // enable buttons
  if (refs.confirmBtn) refs.confirmBtn.style.display = "inline-block";
  if (refs.downloadBtn) refs.downloadBtn.disabled = false;
  if (refs.emailBtn) refs.emailBtn.disabled = false;

  // persist last built package for other handlers
  window.__lastBuiltPackage = {
    date: date,
    guests: guests,
    activities: activities,
    notes: notes,
    summary: summaryText,
    ts: new Date().toISOString(),
  };

  console.info("Weavers Nest: package built", window.__lastBuiltPackage);
};

// wire the build button defensively
(function wireBuildButton() {
  const b = refs.buildBtn || document.getElementById("buildPackage");
  if (!b) {
    console.warn("Build button (#buildPackage) not found");
    return;
  }
  b.removeEventListener("click", window.buildPackageHandler);
  b.addEventListener("click", window.buildPackageHandler);
})();

// ---------- Confirm handler helper uses last built package ----------
async function postJson(url, body) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(()=> null);
    return { ok: r.ok, status: r.status, body: j || null, text: j ? JSON.stringify(j) : null };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// confirm click wiring (defer until element exists)
(function wireConfirm() {
  const btn = refs.confirmBtn || document.getElementById("confirmSaveBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const pkg = window.__lastBuiltPackage;
    if (!pkg) {
      alert("Build the package first before confirming.");
      return;
    }
    // inline prompt flow (minimal UI)
    const isTest = confirm("Save this as a TEST record? (OK = test, Cancel = real)");
    let mobile = prompt("Enter mobile number to confirm booking (10 digits or +country):", "");
    if (!mobile) { alert("Confirmation cancelled."); return; }
    mobile = mobile.replace(/[^\d+]/g, "");
    if (!/^\+?\d{10,15}$/.test(mobile)) { alert("Please enter a valid mobile number (10-15 digits)."); return; }
    if (!mobile.startsWith("+")) {
      if (mobile.length === 10) mobile = "+91" + mobile;
      else mobile = "+" + mobile;
    }

    const payload = {
      uid: (localStorage.getItem("wn:uid") || ("wn_" + Math.random().toString(36).slice(2,10))),
      mobile: mobile,
      test: !!isTest,
      payload: {
        timestamp: new Date().toISOString(),
        date: pkg.date,
        guests: pkg.guests,
        activities: pkg.activities,
        notes: pkg.notes,
        summary: pkg.summary
      }
    };

    btn.disabled = true;
    btn.textContent = "Saving…";
    // call server route
    const res = await postJson("/api/confirm", payload);
    btn.disabled = false;
    btn.textContent = "Confirm & Save (enter mobile)";

    if (res && res.ok && res.body && res.body.ok) {
      alert("Package saved. Reference: " + (res.body.ref || res.body.ts || "saved"));
      btn.style.display = "none";
    } else {
      console.warn("Confirm error", res);
      alert("Save failed: " + (res.body?.error || res.error || res.text || "Unknown error"));
    }
  });
})();

// ---------- PDF download (uses last built package) ----------
(function wireDownload() {
  const btn = refs.downloadBtn || document.getElementById("downloadPdf");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const pkg = window.__lastBuiltPackage;
    if (!pkg) { alert("Build the package first."); return; }
    const text = pkg.summary || "";
    try {
      // prefer jsPDF if loaded
      if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
        const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Weavers Nest - Package", 40, 60);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(text, 520);
        doc.text(lines, 40, 90);
        doc.save("weavers-nest-package.pdf");
        return;
      }
    } catch (err) {
      console.warn("jsPDF error", err);
    }
    // fallback: text file
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "weavers-nest-package.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Could not generate file.");
      console.error(err);
    }
  });
})();

// ---------- Email package (uses last built package) ----------
(function wireEmail() {
  const btn = refs.emailBtn || document.getElementById("emailPkg");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const pkg = window.__lastBuiltPackage;
    if (!pkg) return alert("Build the package first.");
    try {
      const res = await postJson("/api/email", { subject: "Weavers Nest Package", text: pkg.summary, fromUser: (localStorage.getItem("wn:uid") || "guest") });
      if (res.ok && res.body && res.body.ok) {
        alert("Package emailed to admin.");
      } else {
        alert("Email failed: " + (res.body?.error || res.error || res.text || "unknown"));
      }
    } catch (err) {
      alert("Email failed.");
      console.error(err);
    }
  });
})();

// ---------- Gallery: ensure stable images and graceful fallback ----------
(function fixGalleryImages() {
  const grid = refs.galleryGrid || document.getElementById("galleryGrid");
  if (!grid) return;
  // ensure each image has object-fit and stable dimensions, attach onerror fallback
  grid.querySelectorAll("img").forEach(img => {
    try {
      img.style.objectFit = "cover";
      img.style.width = "100%";
      img.style.height = img.style.height || "140px";
      if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
      // attach a fallback only once
      if (!img.dataset.fallbackBound) {
        img.addEventListener("error", function onerr() {
          img.removeEventListener("error", onerr);
          img.dataset.fallbackBound = "1";
          img.src = "/images/placeholder.jpg";
        });
      }
    } catch (e) { /* ignore */ }
  });
})();

// ---------- Partners: reveal missing logos or mark with placeholder ----------
(function fixPartners() {
  const partners = refs.partnerNodes.length ? refs.partnerNodes : $$(".partner");
  partners.forEach(p => {
    const img = p.querySelector("img");
    if (!img) return;
    // ensure visible style, fallback
    img.style.maxHeight = img.style.maxHeight || "80px";
    img.style.objectFit = "contain";
    img.addEventListener("error", function onerr() {
      img.removeEventListener("error", onerr);
      img.src = "/images/placeholder.jpg";
      p.classList.add("visible");
    });
    // if already loaded OK mark visible
    if (img.complete && img.naturalWidth && img.naturalHeight) {
      p.classList.add("visible");
    } else {
      // try to set visible on load
      img.addEventListener("load", () => p.classList.add("visible"));
    }
  });
})();

// ---------- Small graceful initial state: disable actions until build ----------
(function initialState() {
  if (refs.downloadBtn) refs.downloadBtn.disabled = true;
  if (refs.emailBtn) refs.emailBtn.disabled = true;
  if (refs.confirmBtn) refs.confirmBtn.style.display = (window.__lastBuiltPackage ? "inline-block" : "none");
})();

// ---------- Optional: make sure build button visible/wired (safety) ----------
(function ensureBuildVisibility() {
  const b = refs.buildBtn || document.getElementById("buildPackage");
  if (b && b.style.display === "none") b.style.display = "inline-block";
})();

// ---------- Export for debugging convenience ----------
window.__wn.buildPackageHandler = window.buildPackageHandler;
