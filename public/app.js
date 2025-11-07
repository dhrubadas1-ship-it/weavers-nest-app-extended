const ACTIVITIES = [
  { id: "villages", name: "Village Tours (Boro, Nyshi, Mising, Garo)", time: "9:00–14:00", note: "Each village ~30–45 min; lunch on request" },
  { id: "birding", name: "Bird Watching • Nameri NP", time: "6:30–13:30", note: "Nov–Apr; closed Tue" },
  { id: "rafting", name: "River Rafting • Jia Bhoroli", time: "6:30–13:30", note: "Oct–May; Level 1; 13–15 km" },
  { id: "safari", name: "Jeep Safari • Pakke (AR)", time: "6:00–14:00", note: "Seasonal; ILP & permits required" },
  { id: "handloom", name: "Handloom Centre • Morisuti", time: "", note: "Eri silk, dyeing, artisans" },
  { id: "picnic", name: "Picnic by the Jia Bhoroli", time: "", note: "Relaxing riverside" },
  { id: "store", name: "Bhalukpong Store", time: "", note: "Crafts, garments, food products" },
  { id: "watch", name: "Traditional Elephant Watch Tower", time: "", note: "Observe wildlife & fields" }
];

const $ = (q) => document.querySelector(q);
const chatEl = $("#chat");
const inputEl = $("#chatInput");
const sendBtn = $("#sendBtn");
const micBtn = $("#micBtn");
const userIdEl = $("#userId");

const dateEl = $("#date");
const guestsEl = $("#guests");
const actsEl = $("#activities");
const notesEl = $("#notes");
const summaryEl = $("#summary");
const buildPackageBtn = $("#buildPackage");
const packageOut = $("#packageOut");
const downloadChatBtn = $("#downloadChat");
const downloadPdfBtn = $("#downloadPdf");
const emailPkgBtn = $("#emailPkg");
const webhookUrlEl = $("#webhookUrl");
const saveWebhookBtn = $("#saveWebhook");

let selected = new Set();
let transcript = []; // local transcript
let savedWebhook = localStorage.getItem("wn:webhook") || "";

// init webhook field
webhookUrlEl.value = savedWebhook;
saveWebhookBtn.onclick = () => {
  savedWebhook = webhookUrlEl.value.trim();
  localStorage.setItem("wn:webhook", savedWebhook);
  alert("Webhook URL saved.");
};

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
function renderSummary() {
  const acts = ACTIVITIES.filter(a => selected.has(a.id)).map(a => a.name).join(" • ") || "None";
  summaryEl.innerHTML = `
    <div>Date: <b>${dateEl.value || "Not set"}</b></div>
    <div>Guests: <b>${guestsEl.value}</b></div>
    <div>Activities: <b>${acts}</b></div>
    ${selected.has("rafting") ? `
      <div style="margin-top:8px;font-size:12px;opacity:.9">
        <b>Rafting SOP:</b> Max 5 guests + 2 crew • No alcohol • Light snacks only • No swimming • Life jackets on • No unscheduled stops
      </div>` : ""
    }
  `;
}
renderActivities(); renderSummary();
dateEl.onchange = renderSummary; guestsEl.oninput = renderSummary;

// --- Chat ---
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
  // also send to Google Sheets webhook (if set)
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
      try { // Speak
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

// Voice input
let rec;
if ("webkitSpeechRecognition" in window) {
  const R = window.webkitSpeechRecognition;
  rec = new R();
  rec.lang = "en-IN";
  rec.interimResults = false;
  rec.onresult = (e) => { const txt = e.results[0][0].transcript; inputEl.value = txt; send(); };
}
micBtn.onclick = () => { if (!rec) return alert("Voice input not supported."); try { rec.start(); } catch {} };

// Build Custom Package (server-assisted)
buildPackageBtn.onclick = async () => {
  packageOut.textContent = "Building…";
  try {
    const r = await fetch("/api/package", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateEl.value || "",
        guests: parseInt(guestsEl.value || "1", 10),
        activities: Array.from(selected),
        notes: notesEl.value || "",
        userId: userIdEl.value || "guest"
      })
    });
    const j = await r.json();
    if (j.ok) {
      packageOut.textContent = j.suggestion;
      transcript.push({ ts: new Date().toISOString(), role: "bot", text: "[Package Suggestion]\n" + j.suggestion, citations: j.citations||[] });
      postToWebhook({ ts: new Date().toISOString(), type:"package", userId: userIdEl.value || "guest", payload: j.suggestion });
    } else packageOut.textContent = "Error creating package.";
  } catch (e) { packageOut.textContent = "Network error."; }
};

// Download transcript JSON
downloadChatBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(transcript, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0,10);
  a.download = `weavers-nest-transcript-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// Download PDF via server
downloadPdfBtn.onclick = async () => {
  try {
    const r = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Weavers Nest Transcript", transcript, pkg: packageOut.textContent || "" })
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "weavers-nest-transcript.pdf";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) { alert("Failed to build PDF."); }
};

// Email package to admin
emailPkgBtn.onclick = async () => {
  const text = (packageOut.textContent || "").trim();
  if (!text) return alert("Generate the package first.");
  try {
    const r = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Weavers Nest Package", text, fromUser: userIdEl.value || "guest" })
    });
    const j = await r.json();
    if (j.ok) alert("Package emailed to admin."); else alert("Email failed: " + (j.error || "unknown"));
  } catch { alert("Email failed."); }
};

// Google Sheets webhook poster (Apps Script web app)
async function postToWebhook(payload) {
  if (!savedWebhook) return;
  try {
    await fetch(savedWebhook, { method:"POST", mode:"no-cors", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  } catch {}
}

document.getElementById("yr").textContent = new Date().getFullYear();
