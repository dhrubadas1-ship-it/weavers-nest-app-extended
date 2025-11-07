// ===== Simple data =====
const ACTIVITIES = [
  { id: "villages", name: "Village Tours (Boro, Nyshi, Mising, Garo)", time: "9:00–14:00", note: "Each village ~30–45 min; lunch on request" },
  { id: "birding",  name: "Bird Watching • Nameri NP",                 time: "6:30–13:30", note: "Nov–Apr; closed Tue" },
  { id: "rafting",  name: "River Rafting • Jia Bhoroli",                time: "6:30–13:30", note: "Oct–May; Level 1; 13–15 km" },
  { id: "safari",   name: "Jeep Safari • Pakke (AR)",                   time: "6:00–14:00", note: "Seasonal; ILP & permits required" },
  { id: "handloom", name: "Handloom Centre • Morisuti",                 time: "",          note: "Eri silk, dyeing, artisans" },
  { id: "picnic",   name: "Picnic by the Jia Bhoroli",                  time: "",          note: "Relaxing riverside" },
  { id: "store",    name: "Bhalukpong Store",                           time: "",          note: "Crafts, garments, food products" },
  { id: "watch",    name: "Traditional Elephant Watch Tower",           time: "",          note: "Observe wildlife & fields" }
];

// Tentative per-person pricing (edit anytime)
const PRICING = {
  villages: 800,
  birding: 1500,
  rafting: 1500,
  safari: 3000,
  handloom: 600,
  picnic: 500,
  store: 0,
  watch: 400,
  notes: "Costs are indicative per person; permits/ILP extra where applicable."
};

// ===== Shortcuts =====
const $  = (q) => document.querySelector(q);
const chatEl = $("#chatLog");
const inputEl = $("#chatInput");
const sendBtn = $("#sendBtn");
const micBtn  = $("#micBtn");
const userIdEl= $("#userId");

const dateEl   = $("#date");
const guestsEl = $("#guests");
const actsEl   = $("#activities");
const notesEl  = $("#notes");
const summaryEl= $("#summary");
const buildPackageBtn = $("#buildPackage");
const packageOut = $("#packageOut");
const downloadPdfBtn = $("#downloadPdf");
const emailPkgBtn    = $("#emailPkg");

let selected = new Set();
let transcript = [];

// ===== Planner UI =====
function renderActivities() {
  if (!actsEl) return;
  actsEl.innerHTML = "";
  ACTIVITIES.forEach(a => {
    const div = document.createElement("div");
    div.className = "card-item";
    div.innerHTML = `
      <header>
        <div>
          <div style="font-weight:600">${a.name}</div>
          <div style="font-size:12px;color:#cbd5e1">${a.time || ""} ${a.note ? " • " + a.note : ""}</div>
        </div>
        <button class="badge select">${selected.has(a.id) ? "Selected" : "Select"}</button>
      </header>
    `;
    div.querySelector(".select").onclick = () => {
      if (selected.has(a.id)) selected.delete(a.id); else selected.add(a.id);
      renderActivities(); renderSummary();
    };
    actsEl.appendChild(div);
  });
}
function costFor(acts) {
  return acts.map(a => PRICING[a] || 0).reduce((a,b)=>a+b, 0);
}
function renderSummary() {
  if (!summaryEl) return;
  const acts = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.id);
  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.name).join(" • ") || "None";
  const perPerson = costFor(acts);
  const guests = parseInt((guestsEl && guestsEl.value) || "1", 10);
  const total = perPerson * guests;
  summaryEl.innerHTML = `
    <div>Date: <b>${(dateEl && dateEl.value) || "Not set"}</b></div>
    <div>Guests: <b>${guests}</b></div>
    <div>Activities: <b>${names}</b></div>
    <div style="margin-top:6px">Tentative Cost: <b>₹${perPerson}</b> per person × ${guests} = <b>₹${total}</b></div>
    ${selected.has("rafting") ? `
      <div style="margin-top:8px;font-size:12px;opacity:.9">
        <b>Rafting SOP:</b> Max 5 guests + 2 crew • No alcohol • Light snacks only • No swimming • Life jackets on • No unscheduled stops
      </div>` : ""
    }
    <div style="margin-top:6px;font-size:12px;opacity:.9">${PRICING.notes}</div>
  `;
}
renderActivities(); renderSummary();
if (dateEl) dateEl.onchange = renderSummary;
if (guestsEl) guestsEl.oninput = renderSummary;

// ===== Chat helpers (photos on request) =====
function addMsg(role, text, cites=[]) {
  if (!chatEl) return;
  const div = document.createElement("div");
  div.className = `msg ${role==="user"?"me":"bot"}`;
  div.innerHTML = text.split("\n").map(line=>`<div>${line}</div>`).join("");
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  transcript.push({ ts: new Date().toISOString(), role, text, citations: cites });
}

function wantsPhotos(s) {
  const low = s.toLowerCase();
  return /photo|image|picture|pic|gallery/.test(low) ||
         /show.*(raft|weav|elephant|tower|forest|track)/.test(low);
}
function addPhotos() {
  const pics = [
    { src: "/images/rafting.jpg", name: "River Rafting" },
    { src: "/images/weaving.jpg", name: "Village Weaving" },
    { src: "/images/watch-tower.jpg", name: "Elephant Watch Tower" },
    { src: "/images/tracking.jpg", name: "Forest Tracking" },
  ];
  const html = pics.map(p => `
    <figure style="display:inline-block;margin:6px;max-width:160px">
      <img src="${p.src}" alt="${p.name}" style="width:160px;height:110px;object-fit:cover;border-radius:10px;display:block"/>
      <figcaption style="text-align:center;font-size:12px;color:#334155;margin-top:6px">${p.name}</figcaption>
    </figure>
  `).join("");
  addMsg("bot", html);
}

addMsg("bot", "Hi! Ask me about timings, seasons, or activities. Say 'show rafting photos' to see pictures.");

async function send() {
  const q = (inputEl && inputEl.value || "").trim();
  if (!q) return;
  addMsg("user", q);
  inputEl.value = "";
  sendBtn.disabled = true;

  try {
    if (wantsPhotos(q)) {
      addPhotos();
    } else {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, userId: (userIdEl && userIdEl.value) || "guest" })
      });
      const j = await r.json();
      if (j.ok) {
        addMsg("bot", j.reply);
        const u = new SpeechSynthesisUtterance(j.reply);
        u.rate = 1; u.pitch = 1; u.lang = "en-IN";
        speechSynthesis.speak(u);
      } else addMsg("bot", "Error: " + (j.error || "unknown"));
    }
  } catch {
    addMsg("bot", "Network error.");
  } finally {
    sendBtn.disabled = false;
  }
}
sendBtn.onclick = send;
inputEl.addEventListener("keydown", (e) => e.key === "Enter" && send());

// Voice input (free)
let rec;
if ("webkitSpeechRecognition" in window) {
  const R = window.webkitSpeechRecognition;
  rec = new R(); rec.lang = "en-IN"; rec.interimResults = false;
  rec.onresult = (e) => { const txt = e.results[0][0].transcript; inputEl.value = txt; send(); };
}
micBtn.onclick = () => { if (!rec) return alert("Voice input not supported."); try { rec.start(); } catch {} };

// ===== Custom Package =====
buildPackageBtn.onclick = async () => {
  packageOut.textContent = "Building…";
  const acts = Array.from(selected);
  const per = costFor(acts);
  const guests = parseInt(guestsEl.value || "1", 10);
  const total = per * guests;

  try {
    const r = await fetch("/api/package", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateEl.value || "",
        guests,
        activities: acts,
        notes: notesEl.value || "",
        userId: userIdEl.value || "guest"
      })
    });
    const j = await r.json();
    let text = j.ok ? (j.suggestion || "") : "Error creating package.";

    const costLine = `Tentative Cost: ₹${per} per person × ${guests} = ₹${total} (indicative; permits/ILP extra).`;
    if (!/Tentative Cost/i.test(text)) text += `\n\n${costLine}`;
    if (!/Manjeet/i.test(text)) text += `\n\nNext: Download the PDF and share it with Manjeet: +91 96782 19052.`;

    packageOut.textContent = text;
  } catch {
    packageOut.textContent = "Network error.";
  }
};

// ===== PDF Download =====
downloadPdfBtn.onclick = async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 40;

  doc.setFontSize(16);
  doc.text("Weavers Nest Package & Transcript", 40, y); y += 20;

  const pkg = (packageOut.textContent || "").trim();
  doc.setFontSize(11);
  doc.text(pkg || "No package yet.", 40, y, { maxWidth: 520 });
  doc.save("weavers-nest-package.pdf");
};

// ===== Email package =====
emailPkgBtn.onclick = async () => {
  const text = (packageOut.textContent || "").trim();
  if (!text) return alert("Generate the package first.");
  try {
    const r = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Weavers Nest Package", text })
    });
    const j = await r.json();
    if (j.ok) alert("Package emailed to admin."); else alert("Email failed.");
  } catch { alert("Email failed."); }
};

// ===== Footer Year =====
const yrEl = document.getElementById("year");
if (yrEl) yrEl.textContent = new Date().getFullYear();
