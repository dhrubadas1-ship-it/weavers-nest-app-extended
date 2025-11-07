// public/app.js
// Clean, defensive front-end for Weavers Nest
// Handles: activities, build package, confirm/save, PDF, email, gallery modal, chat & voice

// ---------- Data ----------
const ACTIVITIES = [
  { id: "boro", name: "Boro Village (Handloom & songs)" },
  { id: "nyshi", name: "Nyshi Village (Cane & bamboo)" },
  { id: "mising", name: "Mising Village (Stilt houses & river life)" },
  { id: "garo", name: "Garo Village (Food & drumming)" },
  { id: "birding", name: "Bird Watching • Nameri NP" },
  { id: "rafting", name: "River Rafting • Jia Bhoroli" },
  { id: "safari", name: "Jeep Safari • Pakke (AR)" },
  { id: "handloom", name: "Handloom Centre • Morisuti" },
  { id: "picnic", name: "Picnic by the Jia Bhoroli" },
  { id: "store", name: "Bhalukpong Store" },
  { id: "tracking", name: "Forest Tracking" }
];

// ---------- Helpers ----------
const $ = (s) => {
  try {
    if (!s || typeof s !== "string" || s.trim() === "") return null;
    return document.querySelector(s);
  } catch (err) {
    console.warn("Bad selector:", s, err);
    return null;
  }
};

const $$ = (s) => {
  try {
    if (!s || typeof s !== "string" || s.trim() === "") return [];
    return Array.from(document.querySelectorAll(s));
  } catch (err) {
    console.warn("Bad selectorAll:", s, err);
    return [];
  }
};

const actsEl = $("#activities");
const summaryEl = $("#summary");
const buildBtn = $("#buildPackage");
const packageOut = $("#packageOut");
const downloadPdfBtn = $("#downloadPdf");
const emailPkgBtn = $("#emailPkg");
const confirmSaveBtn = $("#confirmSaveBtn");
const chatLog = $("#chatLog");
const chatForm = $("#chatForm");
const chatInput = $("#chatInput");
const sendBtn = $("#sendBtn");
const micBtn = $("#micBtn");
const micStatus = $("#micStatus");
const userIdInput = $("#userId");
const yearEl = $("#year");

let selected = new Set();
let UID = null;
(function initUID(){
  const key = "wn:uid";
  const qp = new URLSearchParams(location.search).get("uid");
  if (qp) { localStorage.setItem(key, qp); UID = qp; return; }
  let id = localStorage.getItem(key);
  if (!id) { id = "wn_" + Math.random().toString(36).slice(2,10); localStorage.setItem(key, id); }
  UID = id;
  if (userIdInput) userIdInput.value = UID;
})();

// ---------- Render activities ----------
function renderActivities() {
  if (!actsEl) return;
  actsEl.innerHTML = "";
  ACTIVITIES.forEach(a => {
    const div = document.createElement("div");
    div.className = "card-item";
    div.dataset.id = a.id;
    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div style="flex:1">
          <div style="font-weight:600">${a.name}</div>
        </div>
      </div>
      <button class="badge select">${selected.has(a.id) ? "Selected" : "Select"}</button>
    `;
    const btn = div.querySelector(".select");
    btn.addEventListener("click", () => {
      if (selected.has(a.id)) { selected.delete(a.id); btn.textContent = "Select"; btn.classList.remove("is-on"); }
      else { selected.add(a.id); btn.textContent = "Selected"; btn.classList.add("is-on"); }
      renderSummary();
      if (packageOut) packageOut.textContent = "";
      if (confirmSaveBtn) confirmSaveBtn.style.display = "none";
      if (downloadPdfBtn) downloadPdfBtn.disabled = true;
      if (emailPkgBtn) emailPkgBtn.disabled = true;
      try { localStorage.setItem("wn:selected", JSON.stringify(Array.from(selected))); } catch(e){}
    });
    actsEl.appendChild(div);
  });
  // restore prev selections
  try {
    const prev = JSON.parse(localStorage.getItem("wn:selected") || "[]");
    prev.forEach(id => { if (id) selected.add(id); });
    $$("#activities .card-item").forEach(ci=>{
      const id = ci.dataset.id;
      const b = ci.querySelector('.select');
      if (selected.has(id)) { b.classList.add('is-on'); b.textContent = 'Selected'; } else { b.classList.remove('is-on'); b.textContent = 'Select'; }
    });
  } catch(e){}
}
function renderSummary() {
  const date = ($("#date") && $("#date").value) || "Not set";
  const guests = ($("#guests") && $("#guests").value) || "1";
  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.name).join(" • ") || "None";
  const html = `Date: ${date}\nGuests: ${guests}\nActivities: ${names}`;
  if (summaryEl) summaryEl.innerText = html;
}
renderActivities();
renderSummary();
$("#date")?.addEventListener("change", renderSummary);
$("#guests")?.addEventListener("input", renderSummary);

// ---------- Build package (robust) ----------
function buildPackage() {
  const date = ($("#date") && $("#date").value) || "";
  const guests = parseInt(($("#guests") && $("#guests").value) || 1, 10);
  const activities = Array.from(selected);
  const notes = ($("#notes" && $("#notes").value) || "").trim();

  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.name).join(" • ") || "None";
  // add suggested times & tips
  const meta = {
    boro: "09:00–13:00 — Handloom demo, rice-beer tasting",
    nyshi: "09:00–17:00 — Cane & bamboo crafts, forest edge walk",
    mising: "09:00–13:00 — Stilt houses, river life demo",
    garo: "09:00–17:00 — Food tasting & evening drumming",
    birding: "05:30–10:30 — Early morning birding (Nov–Apr best)",
    rafting: "08:00–13:00 — Guided rafting, safety briefing",
    safari: "06:00–12:00 — Jeep safari (permits may be required)",
    handloom: "10:00–13:00 — Weaving demo & shopping",
    picnic: "11:00–15:00 — Riverside picnic",
    tracking: "06:00–11:00 — Guided forest tracking"
  };

  const lines = activities.map(id => {
    const name = (ACTIVITIES.find(a=>a.id===id)?.name) || id;
    const m = meta[id] ? ` (${meta[id]})` : "";
    return `• ${name}${m}`;
  });

  const addOns = [];
  if (activities.includes("rafting")) addOns.push("GoPro video (extra)");
  if (activities.includes("birding")) addOns.push("Binocular hire");
  if (activities.includes("handloom") || activities.includes("store")) addOns.push("Carry cash for crafts");

  const summaryText = [
    "Weavers Nest — Custom Package",
    `Date: ${date || "Not set"}`,
    `Guests: ${guests}`,
    "",
    "Planned activities:",
    ...(lines.length ? lines : ["• None selected"]),
    "",
    `Notes: ${notes || "-"}`,
    "",
    `Suggested add-ons: ${addOns.join(" • ") || "None"}`,
    "Bring: water, hat, sunscreen, comfortable shoes. Follow guide instructions.",
    "",
    "To confirm: click Confirm & Save and enter mobile number.",
    "",
    `Reference: ${new Date().toISOString()}`
  ].join("\n");

  if (packageOut) packageOut.textContent = summaryText;
  if (summaryEl) summaryEl.textContent = `Date: ${date || "Not set"} • Guests: ${guests} • Activities: ${names}`;

  if (confirmSaveBtn) confirmSaveBtn.style.display = "inline-block";
  if (downloadPdfBtn) downloadPdfBtn.disabled = false;
  if (emailPkgBtn) emailPkgBtn.disabled = false;

  window.__lastBuiltPackage = { date, guests, activities, notes, summary: summaryText, ts: new Date().toISOString() };
}
if (buildBtn) buildBtn.addEventListener("click", buildPackage);

// ---------- Confirm & Save (robust) ----------
async function postJson(url, body) {
  try {
    const r = await fetch(url, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
    const j = await r.json().catch(()=>null);
    return { ok: r.ok, status: r.status, body: j };
  } catch (e) { return { ok:false, error: String(e) }; }
}

if (confirmSaveBtn) {
  confirmSaveBtn.addEventListener("click", async () => {
    const pkg = window.__lastBuiltPackage;
    if (!pkg) { alert("Please build the package first."); return; }

    const testSave = confirm("Save as TEST? (OK = test, Cancel = real)");
    let mobile = prompt("Enter mobile number for confirmation (10 digits or +country):", "");
    if (!mobile) { alert("Cancelled."); return; }
    mobile = mobile.replace(/[^\d+]/g, "");
    if (!/^\+?\d{10,15}$/.test(mobile)) { alert("Invalid mobile number."); return; }
    if (!mobile.startsWith("+")) { mobile = mobile.length === 10 ? "+91" + mobile : "+"+mobile; }

    const payload = {
      uid: UID,
      mobile,
      test: !!testSave,
      payload: {
        timestamp: new Date().toISOString(),
        date: pkg.date,
        guests: pkg.guests,
        activities: pkg.activities,
        notes: pkg.notes,
        summary: (packageOut && packageOut.textContent) || pkg.summary
      }
    };

    confirmSaveBtn.disabled = true;
    const old = confirmSaveBtn.textContent;
    confirmSaveBtn.textContent = "Saving…";
    const res = await postJson("/api/confirm", payload);
    confirmSaveBtn.disabled = false;
    confirmSaveBtn.textContent = old || "Confirm & Save (enter mobile)";
    if (res.ok && res.body && res.body.ok) {
      alert("Saved. Reference: " + (res.body.ref || res.body.ts || "saved"));
      confirmSaveBtn.style.display = "none";
    } else {
      console.warn("Save failed", res);
      alert("Save failed: " + (res.body?.error || res.error || "unknown"));
    }
  });
}

// ---------- PDF (jsPDF preferred) ----------
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", () => {
    const pkg = window.__lastBuiltPackage;
    if (!pkg) { alert("Build the package first."); return; }
    const text = pkg.summary || "";
    try {
      if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
        const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
        doc.setFontSize(16);
        doc.text("Weavers Nest – Package", 40, 60);
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(text, 520);
        doc.text(lines, 40, 90);
        doc.save("weavers-nest-package.pdf");
        return;
      }
    } catch (e) { console.warn("jsPDF error", e); }
    // fallback
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "weavers-nest-package.txt"; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });
}

// ---------- Email Package ----------
if (emailPkgBtn) {
  emailPkgBtn.addEventListener("click", async () => {
    const pkg = window.__lastBuiltPackage;
    if (!pkg) return alert("Build the package first.");
    const res = await postJson("/api/email", { subject: "Weavers Nest Package", text: pkg.summary, fromUser: UID });
    if (res.ok && res.body && res.body.ok) alert("Package emailed to admin.");
    else alert("Email failed: " + (res.body?.error || res.error || "unknown"));
  });
}

// ---------- Gallery modal ----------
const modal = document.getElementById("photoModal");
const modalImg = document.getElementById("modalImg");
const modalCaption = document.getElementById("modalCaption");
const closeBtn = modal ? modal.querySelector(".modal-close") : null;
document.querySelectorAll(".g-item").forEach(fig => {
  fig.addEventListener("click", () => {
    const img = fig.querySelector("img");
    const name = fig.dataset.name || (img && img.alt) || "Photo";
    if (modalImg) modalImg.src = img.src;
    if (modalCaption) modalCaption.textContent = name;
    if (typeof modal.showModal === "function") modal.showModal();
  });
});
closeBtn?.addEventListener("click", () => modal.close());
modal?.addEventListener("click", (e)=>{ if (e.target === modal) modal.close(); });

// ---------- Chat & voice (simple) ----------
function addChat(role, html) {
  if (!chatLog) return;
  const div = document.createElement("div"); div.className = "msg " + (role==="user" ? "me" : "bot");
  div.innerHTML = `<div style="font-weight:700;color:${role==="user"?"#0f172a":"var(--brand)"}">${role==="user"?"You":"Guide"}</div><div>${html}</div>`;
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight;
}
addChat("bot","Hi! Ask me about timings, seasons, or activities. Say 'show rafting photos' to see pictures.");

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let rec = null;
if (SpeechRec) {
  try {
    rec = new SpeechRec();
    rec.lang = "en-IN"; rec.interimResults = false;
    rec.onstart = () => { if (micStatus) micStatus.textContent = "Listening..."; }
    rec.onend = () => { if (micStatus) micStatus.textContent = ""; }
    rec.onresult = (e) => { const txt = e.results[0][0].transcript; chatInput.value = txt; chatForm.dispatchEvent(new Event('submit',{cancelable:true})); };
  } catch(e){ rec = null; }
}
if (!SpeechRec && micStatus) micStatus.textContent = "Voice not supported";

if (micBtn) micBtn.addEventListener("click", ()=>{ if (!rec) return alert("Voice not supported"); try { rec.start(); } catch(e){ } });

if (chatForm) chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = (chatInput.value || "").trim();
  if (!q) return;
  addChat("user", q);
  chatInput.value = "";
  const low = q.toLowerCase();
  if (/photo|image|picture|pic|gallery|show.*(raft|weav|forest|track|bird)/.test(low)) {
    const pics = [
      {src:"/images/rafting.jpg", name:"River Rafting"},
      {src:"/images/weaving.jpg", name:"Village Weaving"},
      {src:"/images/tracking.jpg", name:"Forest Tracking"},
      {src:"/images/birding.jpg", name:"Bird Watching"}
    ];
    const html = pics.map(p=>`<div style="display:inline-block;margin:6px"><img src="${p.src}" style="width:120px;height:90px;object-fit:cover;border-radius:8px"/><div style="text-align:center;font-size:12px">${p.name}</div></div>`).join("");
    addChat("bot", html);
    return;
  }
  addChat("bot","Searching...");
  try {
    const res = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ message:q, userId: UID }) });
    const j = await res.json().catch(()=>({reply:"Sorry, no response"}));
    addChat("bot", j.reply || j.message || j.output || "Sorry, couldn't find that.");
  } catch(e) { addChat("bot","Network error."); }
});
// ===== Minimal UI patch: clone header Google Form button into the Build panel =====
(function attachFormClone() {
  try {
    const headerBtn = document.getElementById('googleFormBtn'); // header button (exists in index.html)
    if (!headerBtn) return; // nothing to do

    // create clone to place inside the plan controls
    const clone = headerBtn.cloneNode(true);
    clone.id = 'googleFormClone';
    // keep styles consistent: ensure it's a visible inline block near buttons
    clone.style.display = 'inline-block';
    clone.style.marginLeft = '6px';

    // find the build controls container (the sibling of build button)
    const buildBtnEl = document.getElementById('buildPackage');
    if (buildBtnEl && buildBtnEl.parentNode) {
      // insert clone after the build button group (append to same parent)
      buildBtnEl.parentNode.insertBefore(clone, buildBtnEl.nextSibling);
    } else {
      // fallback: append near packageOut area
      const panel = document.querySelector('#plan .panel');
      if (panel) panel.appendChild(clone);
    }

    // if the original used target/_blank etc., keep them
    clone.setAttribute('rel', 'noopener');

    // Accessibility: ensure role & title copied
    if (!clone.getAttribute('aria-label')) clone.setAttribute('aria-label', 'Book via Google Form');

    // Optional: ensure cloned link opens in new tab
    clone.addEventListener('click', (e) => {
      // nothing special - preserve original behaviour
    });
  } catch (err) {
    console.warn('Form clone failed', err);
  }
})();

// ===== Small extra defensive guard for PDF / Email buttons =====
(function strengthenGuards() {
  try {
    const dp = document.getElementById('downloadPdf');
    const em = document.getElementById('emailPkg');

    const guardWarn = (actionName) => {
      alert(`${actionName} — please build the package first.`);
    };

    if (dp) {
      dp.addEventListener('click', (ev) => {
        if (!window.__lastBuiltPackage) {
          ev.preventDefault();
          guardWarn('Download PDF');
          return;
        }
        // otherwise original handler proceeds
      }, true);
    }
    if (em) {
      em.addEventListener('click', (ev) => {
        if (!window.__lastBuiltPackage) {
          ev.preventDefault();
          guardWarn('Email Package');
          return;
        }
      }, true);
    }
  } catch (e) { /* silent */ }
})();

// footer year
if (yearEl) yearEl.textContent = new Date().getFullYear();
