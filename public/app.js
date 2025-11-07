// public/app.js
// Front-end logic: activities, package build, confirm/save, PDF, gallery modal, chat + voice

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
const $ = (s) => document.querySelector(s);
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
// === Restore / render activity cards (defensive) ===
(function restoreActivitiesUI(){
  if (!actsEl) return console.warn("No #activities element found - cannot render activities.");
  // Clear existing
  actsEl.innerHTML = "";

  ACTIVITIES.forEach(a => {
    const div = document.createElement("div");
    div.className = "card-item";
    div.dataset.id = a.id || "";
    const metaLine = (a.time ? a.time : "") + (a.note ? (a.time ? " • " : "") + a.note : "");
    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div style="flex:1">
          <div style="font-weight:600">${a.name}</div>
          <div style="font-size:12px;color:#64748b">${metaLine}</div>
        </div>
      </div>
      <button class="badge select ${selected.has(a.id) ? 'is-on' : ''}">${selected.has(a.id) ? 'Selected' : 'Select'}</button>
    `;
    const btn = div.querySelector(".select");
    btn.addEventListener("click", () => {
      if (selected.has(a.id)) selected.delete(a.id); else selected.add(a.id);
      btn.classList.toggle("is-on", selected.has(a.id));
      btn.textContent = selected.has(a.id) ? "Selected" : "Select";
      if (typeof renderSummary === "function") renderSummary();
      if (packageOut) packageOut.textContent = "";
      if (confirmSaveBtn) confirmSaveBtn.style.display = "none";
      if (downloadPdfBtn) downloadPdfBtn.disabled = true;
      if (emailPkgBtn) emailPkgBtn.disabled = true;
      try { localStorage.setItem("wn:selected", JSON.stringify(Array.from(selected))); } catch(e){}
    });
    actsEl.appendChild(div);
  });

  try {
    const prev = JSON.parse(localStorage.getItem("wn:selected") || "[]");
    prev.forEach(id => { if (id) selected.add(id); });
    $$("#activities .card-item").forEach(ci=>{
      const id = ci.dataset.id;
      const b = ci.querySelector('.select');
      if (selected.has(id)) { b.classList.add('is-on'); b.textContent = 'Selected'; } else { b.classList.remove('is-on'); b.textContent = 'Select'; }
    });
  } catch(e){}

  if (typeof renderSummary === "function") renderSummary();
  console.info("Activities rendered. Selected:", Array.from(selected));
})();

// === Reactivate Build Custom Package (drop-in) ===
(function activateBuildBtn(){
  if (!buildBtn) return console.warn("buildPackage button not found");
  // remove any old handler to avoid duplicates
  buildBtn.removeEventListener?.("click", buildBtn._handler);

  const handler = () => {
    const date = (document.getElementById("date")?.value) || "";
    const guests = parseInt(document.getElementById("guests")?.value || "1", 10);
    const notes = (document.getElementById("notes")?.value || "").trim();

    // collect activities from your selected Set (or fallback)
    let activities = [];
    if (window.selected && typeof window.selected.forEach === "function") {
      activities = Array.from(window.selected);
    } else {
      // fallback: badges with .is-on
      activities = Array.from(document.querySelectorAll("#activities .badge.is-on")).map(b => {
        const parent = b.closest(".card-item");
        return parent ? (parent.dataset?.id || (parent.innerText||"").split("\n")[0].trim()) : (b.innerText||"").trim();
      }).filter(Boolean);
    }

    // map activity ids to names if ACTIVITIES exists
    let activityNames = "None";
    if (Array.isArray(window.ACTIVITIES) && activities.length) {
      activityNames = activities.map(id => {
        const a = window.ACTIVITIES.find(x => x.id === id || x.name === id || (x.name && id && x.name.toLowerCase().includes(String(id).toLowerCase())));
        return a ? a.name : id;
      }).join(" • ");
    } else if (activities.length) {
      activityNames = activities.join(" • ");
    }

    const summaryText = `Date: ${date || "Not set"}
Guests: ${guests}
Activities: ${activityNames}
Notes: ${notes || "-"}

Download the PDF and share it with Manjeet: +91 96782 19052.`;

    // write to UI
    if (packageOut) {
      packageOut.textContent = summaryText;
      // make sure visible
      packageOut.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (summaryEl) {
      summaryEl.textContent = summaryText;
      summaryEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // enable actions
    if (confirmSaveBtn) confirmSaveBtn.style.display = "inline-block";
    if (downloadPdfBtn) downloadPdfBtn.disabled = false;
    if (emailPkgBtn) emailPkgBtn.disabled = false;

    // store last built package
    window.__lastBuiltPackage = {
      date,
      guests,
      activities,
      notes,
      summary: summaryText,
      ts: new Date().toISOString()
    };

    // slight visual confirmation (brief)
    try {
      buildBtn.classList.add("built");
      setTimeout(()=> buildBtn.classList.remove("built"), 900);
    } catch {}

    console.info("Package built:", window.__lastBuiltPackage);
  };

  // attach and save reference so we can remove later
  buildBtn.addEventListener("click", handler);
  buildBtn._handler = handler;
})();

// ---------- UID ----------
function getOrCreateUID() {
  const key = "wn:uid";
  const qp = new URLSearchParams(location.search).get("uid");
  if (qp) { localStorage.setItem(key, qp); return qp; }
  let id = localStorage.getItem(key);
  if (!id) {
    id = "wn_" + Math.random().toString(36).slice(2,10);
    localStorage.setItem(key, id);
  }
  return id;
}
UID = getOrCreateUID();
if (userIdInput) userIdInput.value = UID;

// ---------- Render activities ----------
function renderActivities() {
  if (!actsEl) return;
  actsEl.innerHTML = "";
  ACTIVITIES.forEach(a => {
    // Skip "Traditional Elephant Watch Tower" (removed)
    const div = document.createElement("div");
    div.className = "card-item";
    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div><div style="font-weight:600">${a.name}</div></div>
      </div>
      <button class="badge ${selected.has(a.id) ? 'is-on' : ''}">${selected.has(a.id) ? 'Selected' : 'Select'}</button>
    `;
    div.querySelector(".badge").onclick = () => {
      if (selected.has(a.id)) selected.delete(a.id); else selected.add(a.id);
      renderActivities(); renderSummary();
    };
    actsEl.appendChild(div);
  });
}

// ---------- Summary (no live cost) ----------
function renderSummary() {
  const date = ($("#date") && $("#date").value) || "Not set";
  const guests = ($("#guests") && $("#guests").value) || "1";
  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.name).join(" • ") || "None";
  const html = `Date: ${date}\nGuests: ${guests}\nActivities: ${names}`;
  if (summaryEl) summaryEl.innerText = html;
}
renderActivities(); renderSummary();
if ($("#date")) $("#date").addEventListener("change", renderSummary);
if ($("#guests")) $("#guests").addEventListener("input", renderSummary);

// ---------- Build package ----------
buildBtn && buildBtn.addEventListener("click", () => {
  const date = ($("#date") && $("#date").value) || "";
  const guests = parseInt(($("#guests") && $("#guests").value) || 1, 10);
  const activities = Array.from(selected);
  const notes = ($("#notes" && $("#notes").value) || "").trim();
  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.name).join(" • ") || "None";
  const summaryText = `Date: ${date || "Not set"}\nGuests: ${guests}\nActivities: ${names}\nNotes: ${notes || "-"}\n\nDownload the PDF and share it with Manjeet: +91 96782 19052.`;
  if (packageOut) packageOut.textContent = summaryText;
  // expose actions
  if (confirmSaveBtn) confirmSaveBtn.style.display = "inline-block";
  // ensure download & email behave
  if (downloadPdfBtn) downloadPdfBtn.disabled = false;
  if (emailPkgBtn) emailPkgBtn.disabled = false;
});

// === ENHANCED PACKAGE FORMAT + Confirm & Save handler ===
(function enhancePackageAndWireConfirm(){

  // mapping: activity id -> suggested time + short blurb
  const ACTIVITY_META = {
    boro:    { time: "09:00–13:00", note: "Handloom demo, rice-beer tasting, courtyard songs." },
    nyshi:   { time: "09:00–17:00", note: "Cane & bamboo crafts, forest edge walk." },
    mising:  { time: "09:00–13:00", note: "Stilt houses, riverside life & fish demo." },
    garo:    { time: "09:00–17:00", note: "Food tasting, drum gathering in evening." },
    birding: { time: "05:30–10:30", note: "Early morning birdwatching (best Nov–Apr)." },
    rafting: { time: "08:00–13:00", note: "Guided rafting with GoPro photos; safety briefing required." },
    safari:  { time: "06:00–12:00", note: "Jeep safari (permits may be required)." },
    handloom:{ time: "10:00–13:00", note: "Eri silk weaving demo & shopping." },
    picnic:  { time: "11:00–15:00", note: "Relaxing riverside lunch picnic." },
    store:   { time: "", note: "Local crafts, food products for purchase." },
    tracking:{ time: "06:00–11:00", note: "Guided forest tracking inside community lands." }
  };

  // helper to build attractive package text (multi-line + small bullets)
  function prettyPackage(pkg) {
    const date = pkg.date || "Not set";
    const guests = pkg.guests || 1;
    const notes = pkg.notes || "-";
    const acts = pkg.activities && pkg.activities.length ? pkg.activities : [];

    // for each activity build a nice line with time & short note
    const lines = acts.map(id => {
      const meta = ACTIVITY_META[id] || {};
      const name = (window.ACTIVITIES && window.ACTIVITIES.find(a=>a.id===id)) ? window.ACTIVITIES.find(a=>a.id===id).name : id;
      const time = meta.time ? ` (${meta.time})` : "";
      const note = meta.note ? ` — ${meta.note}` : "";
      return `• ${name}${time}${note}`;
    });

    // suggested add-ons (simple heuristics)
    const addOns = [];
    if (acts.includes("rafting")) addOns.push("GoPro video (extra), Dry bag");
    if (acts.includes("birding")) addOns.push("Binocular hire, Early breakfast pack");
    if (acts.includes("handloom") || acts.includes("store")) addOns.push("Carry extra cash for crafts");

    const suggestions = addOns.length ? `Suggested add-ons: ${addOns.join(" • ")}` : "Suggested add-ons: None";

    const packing = "Bring: water bottle, hat, sunscreen, comfortable shoes. Follow guide instructions for safety.";

    const human = [
      `Weavers Nest — Custom Package`,
      `Date: ${date}`,
      `Guests: ${guests}`,
      ``,
      `Planned activities:`,
      ...(lines.length ? lines : ["• None selected"]),
      ``,
      `Notes: ${notes}`,
      ``,
      suggestions,
      packing,
      ``,
      `To confirm this booking: click Confirm & Save and enter your mobile number.`,
      `Download or email this package for record keeping.`,
      ``,
      `Reference: ${pkg.ts || new Date().toISOString()}`
    ].join("\n");

    return human;
  }

  // replace UI summary with pretty format when build occurs
  const origBuild = window.buildPackageHandler || null;
  window.buildPackageHandler = function wrappedBuild() {
    if (typeof origBuild === "function") origBuild();
    const pkg = window.__lastBuiltPackage || {};
    const pretty = prettyPackage(pkg);
    const out = document.getElementById("packageOut") || document.getElementById("summary");
    if (out) out.textContent = pretty;
    const confirmBtn = document.getElementById("confirmSaveBtn");
    if (confirmBtn) confirmBtn.style.display = "inline-block";
    const dl = document.getElementById("downloadPdf");
    if (dl) dl.disabled = false;
    const em = document.getElementById("emailPkg");
    if (em) em.disabled = false;
  };

  // wire confirm button to send only after build
  const confirmBtn = document.getElementById("confirmSaveBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async function(){
      const pkg = window.__lastBuiltPackage;
      if (!pkg) { alert("Please build the package first."); return; }

      const saveAsTest = confirm("Mark this save as TEST? (OK = test, Cancel = real)");
      let mobile = prompt("Enter mobile number to confirm booking (10 digits or +country):", "");
      if (!mobile) { alert("Cancelled."); return; }
      mobile = mobile.replace(/[^\d+]/g,"");
      if (!/^\+?\d{10,15}$/.test(mobile)) { alert("Invalid mobile. Enter 10-15 digits."); return; }
      if (!mobile.startsWith("+")) {
        if (mobile.length === 10) mobile = "+91"+mobile; else mobile = "+"+mobile;
      }

      const payload = {
        uid: localStorage.getItem("wn:uid") || ("wn_" + Math.random().toString(36).slice(2,10)),
        mobile,
        test: !!saveAsTest,
        payload: {
          timestamp: new Date().toISOString(),
          date: pkg.date,
          guests: pkg.guests,
          activities: pkg.activities,
          notes: pkg.notes,
          summary: (document.getElementById("packageOut") || { textContent: pkg.summary }).textContent || pkg.summary
        }
      };

      confirmBtn.disabled = true;
      const prevText = confirmBtn.textContent;
      confirmBtn.textContent = "Saving…";

      try {
        const resp = await fetch("/api/confirm", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
        const j = await resp.json().catch(()=>null);
        if (resp.ok && j && j.ok) {
          alert("Saved — reference: " + (j.ref || j.ts || "saved"));
          confirmBtn.style.display = "none";
        } else {
          console.warn("Confirm error", j);
          alert("Save failed: " + (j?.error || "Unknown error"));
        }
      } catch (err) {
        console.error("Confirm exception", err);
        alert("Save failed: network error");
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = prevText || "Confirm & Save (enter mobile)";
      }
    });
  }

})();
  const date = ($("#date") && $("#date").value) || "";
  const guests = parseInt(($("#guests") && $("#guests").value) || 1, 10);
  const activities = Array.from(selected);
  const notes = ($("#notes" && $("#notes").value) || "").trim();
  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.name).join(" • ") || "None";
  const summaryText = `Date: ${date || "Not set"}\nGuests: ${guests}\nActivities: ${names}\nNotes: ${notes || "-"}\n\nDownload the PDF and share it with Manjeet: +91 96782 19052.`;

  const phone = await showPhonePrompt();
  if (!phone) return;
  confirmSaveBtn.disabled = true;
  confirmSaveBtn.textContent = "Saving…";

  const payload = {
    uid: UID,
    mobile: phone.mobile,
    test: !!phone.test,
    payload: {
      timestamp: new Date().toISOString(),
      date,
      guests,
      activities,
      notes,
      summary: summaryText
    }
  };

  const result = await postConfirm(payload);
  confirmSaveBtn.disabled = false;
  confirmSaveBtn.textContent = "Confirm & Save (enter mobile)";
  if (result.ok) {
    alert("Package saved. Reference: " + (result.ref || result.ts || "saved"));
    confirmSaveBtn.style.display = "none";
  } else {
    alert("Save failed: " + (result.error || "unknown"));
  }
});

// ---------- PDF using jsPDF ----------
downloadPdfBtn && downloadPdfBtn.addEventListener("click", async () => {
  const text = (packageOut && packageOut.textContent) || "";
  // use jsPDF if available
  try {
    const { jsPDF } = window.jspdf || (window.jspdf = null) || {};
    if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
      const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
      doc.setFontSize(14);
      doc.text("Weavers Nest Package", 40, 60);
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(text, 520);
      doc.text(lines, 40, 90);
      doc.save("weavers-nest-package.pdf");
    } else {
      // fallback: download as .txt
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "weavers-nest-package.txt";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.error(e);
    alert("PDF generation failed.");
  }
});

// ---------- Email package (simple) ----------
emailPkgBtn && emailPkgBtn.addEventListener("click", async () => {
  const text = (packageOut && packageOut.textContent) || "";
  if (!text) return alert("Build the package first.");
  try {
    const r = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Weavers Nest Package", text, fromUser: UID })
    });
    const j = await r.json();
    if (j.ok) alert("Package emailed to admin."); else alert("Email failed: " + (j.error || "unknown"));
  } catch (e) {
    alert("Email failed: " + String(e));
  }
});

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
closeBtn && closeBtn.addEventListener("click", () => modal.close());
modal && modal.addEventListener("click", (e)=> { if (e.target === modal) modal.close(); });

// ---------- Chat & voice ----------
function addChat(role, textHtml) {
  if (!chatLog) return;
  const wrapper = document.createElement("div"); wrapper.className = "msg " + (role==="user" ? "me" : "bot");
  wrapper.innerHTML = `<div style="font-weight:700;color:${role==="user"?"#0f172a":"var(--brand)"}">${role==="user"?"You":"Guide"}</div><div>${textHtml}</div>`;
  chatLog.appendChild(wrapper);
  chatLog.scrollTop = chatLog.scrollHeight;
}
addChat("bot","Hi! Ask me about timings, seasons, or activities. Say 'show rafting photos' to see pictures.");

// feature-detect SpeechRecognition
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let rec = null;
if (SpeechRec) {
  try {
    rec = new SpeechRec();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onstart = () => { if (micStatus) micStatus.textContent = "Listening..."; }
    rec.onend = () => { if (micStatus) micStatus.textContent = ""; }
    rec.onresult = (e) => {
      const txt = e.results[0][0].transcript;
      chatInput.value = txt;
      // auto submit
      chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    };
  } catch (e) { rec = null; }
}
if (!SpeechRec && micStatus) micStatus.textContent = "Voice not supported in this browser";

if (micBtn) micBtn.addEventListener("click", () => {
  if (!rec) return alert("Voice input not supported in your browser.");
  try {
    rec.start();
  } catch (e) { console.warn("rec.start failed", e); }
});

chatForm && chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = (chatInput && chatInput.value || "").trim();
  if (!q) return;
  addChat("user", q);
  chatInput.value = "";
  // photo trigger
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
    const j = await res.json();
    addChat("bot", j.reply || j.message || "Sorry, couldn't find that.");
  } catch (e) {
    addChat("bot","Network error.");
  }
});

// footer year
if (yearEl) yearEl.textContent = new Date().getFullYear();
