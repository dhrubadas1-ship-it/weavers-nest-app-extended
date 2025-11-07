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
const chatEl = $("#chat");
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
const webhookUrlEl   = $("#webhookUrl");
const saveWebhookBtn = $("#saveWebhook");
const attachEl       = $("#attachPhoto");

let selected = new Set();
let transcript = [];
let savedWebhook = localStorage.getItem("wn:webhook") || "";

// Init webhook box
if (webhookUrlEl) webhookUrlEl.value = savedWebhook;
if (saveWebhookBtn) saveWebhookBtn.onclick = () => {
  savedWebhook = webhookUrlEl.value.trim();
  localStorage.setItem("wn:webhook", savedWebhook);
  alert("Webhook saved.");
};

// ===== Planner UI =====
function renderActivities() {
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
  const acts = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.id);
  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.name).join(" • ") || "None";
  const perPerson = costFor(acts);
  const guests = parseInt(guestsEl.value || "1", 10);
  const total = perPerson * guests;
  summaryEl.innerHTML = `
    <div>Date: <b>${dateEl.value || "Not set"}</b></div>
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
dateEl.onchange = renderSummary; guestsEl.oninput = renderSummary;

// ===== Chat =====
function addMsg(role, text, cites=[]) {
  const div = document.createElement("div");
  div.className = `msg ${role==="user"?"me":"bot"}`;
  div.innerHTML = text.split("\n").map(line=>`<div>${line}</div>`).join("");
  if (role !== "user" && cites.length) {
    const c = document.createElement("div");
    c.className = "cite";
    c.textContent = "Sources: " + cites.map(x=>`Weavers Nest#${x.chunkId}`).join(", ");
    div.appendChild(c);
  }
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  transcript.push({ ts: new Date().toISOString(), role, text, citations: cites });
  postToWebhook({ ts: new Date().toISOString(), type:"chat", role, text, userId: userIdEl.value || "guest" });
}
addMsg("bot", "Hi! Ask me about Weavers Nest timings, seasons, safety, or activities. I answer only from our official document.");

async function send() {
  const q = inputEl.value.trim();
  if (!q) return;
  addMsg("user", q);
  inputEl.value = "";
  sendBtn.disabled = true;
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q, userId: userIdEl.value || "guest" })
    });
    const j = await r.json();
    if (j.ok) {
      addMsg("bot", j.reply, j.citations || []);
      try {
        const u = new SpeechSynthesisUtterance(j.reply);
        u.rate = 1; u.pitch = 1; u.lang = "en-IN";
        speechSynthesis.speak(u);
      } catch {}
    } else addMsg("bot", "Error: " + (j.error || "unknown"));
  } catch { addMsg("bot", "Network error."); }
  finally { sendBtn.disabled = false; }
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

// ===== Custom Package (server) + local cost & share line =====
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

    // Ensure cost & “share with Manjeet” are present even if server didn’t add them
    const costLine = `Tentative Cost: ₹${per} per person × ${guests} = ₹${total} (indicative; permits/ILP extra).`;
    if (!/Tentative Cost/i.test(text)) text += `\n\n${costLine}`;
    if (!/Manjeet/i.test(text)) text += `\n\nNext: Download the PDF and share it with Manjeet: +91 96782 19052.`;

    packageOut.textContent = text;
    transcript.push({ ts: new Date().toISOString(), role: "bot", text: "[Package Suggestion]\n" + text, citations: j.citations||[] });
    postToWebhook({ ts: new Date().toISOString(), type:"package", userId: userIdEl.value || "guest", payload: text });
  } catch (e) {
    packageOut.textContent = "Network error.";
  }
};

// ===== PDF (client-side, no server change) =====
downloadPdfBtn.onclick = async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40, line = 14;
  let y = margin;

  function write(txt, bold=false, size=11) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(txt, 515);
    lines.forEach(str => {
      if (y > 800) { doc.addPage(); y = margin; }
      doc.text(str, margin, y); y += line;
    });
  }
  write("Weavers Nest Package & Transcript", true, 16); y += 6;
  write("----------------------------------------------"); y += 6;

  const pkg = (packageOut.textContent || "").trim();
  if (pkg) {
    write("Custom Package", true, 12); y += 4;
    write(pkg); y += 6;
    write("----------------------------------------------"); y += 6;
  }
  write("Transcript", true, 12); y += 4;
  transcript.forEach(item => write(`[${item.ts}] ${item.role.toUpperCase()}: ${item.text}`));

  doc.save("weavers-nest-package.pdf");
};

// ===== Email package to admin (works when RECIPIENT_EMAIL is set in Vercel) =====
async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result.split(",")[1]);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

emailPkgBtn.onclick = async () => {
  const text = (packageOut.textContent || "").trim();
  if (!text) return alert("Generate the package first.");
  let attachments = [];
  const f = attachEl?.files?.[0];
  if (f) {
    const b64 = await readFileAsBase64(f);
    attachments.push({ filename: f.name, content: b64, encoding: "base64", contentType: f.type || "image/jpeg" });
  }
  try {
    const r = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Weavers Nest Package", text, fromUser: userIdEl.value || "guest", attachments })
    });
    const j = await r.json();
    if (j.ok) alert("Package emailed to admin."); else alert("Email failed: " + (j.error || "unknown"));
  } catch { alert("Email failed."); }
};

// ===== Webhook logger (Google Sheets Apps Script) =====
async function postToWebhook(payload) {
  const url = (webhookUrlEl && webhookUrlEl.value) || "";
  if (!url) return;
  try {
    await fetch(url, { method:"POST", mode:"no-cors", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  } catch {}
}

// Footer year
document.getElementById("yr").textContent = new Date().getFullYear();
