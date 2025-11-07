// ===== Weavers Nest front-end logic =====

// ------- Simple data -------
const ACTIVITIES = [
  { id: "villages", name: "Village Tours (Boro, Nyshi, Mising, Garo)" },
  { id: "birding", name: "Bird Watching • Nameri NP" },
  { id: "rafting", name: "River Rafting • Jia Bhoroli" },
  { id: "safari", name: "Jeep Safari • Pakke (AR)" },
  { id: "handloom", name: "Handloom Centre • Morisuti" },
  { id: "picnic", name: "Picnic by the Jia Bhoroli" },
  { id: "store", name: "Bhalukpong Store" },
  { id: "tracking", name: "Forest Tracking" }
];

// ------- helpers & elements -------
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
const userIdInput = $("#userId");
const googleFormBtn = $("#googleFormBtn");
const googleFormBtnBottom = $("#googleFormBtnBottom");

let selected = new Set();
let transcript = [];

// ------- UID (persisted) -------
function getOrCreateUID() {
  const key = "wn:uid";
  // prefer query param ?uid=
  const qp = new URLSearchParams(location.search).get("uid");
  if (qp) { localStorage.setItem(key, qp); return qp; }
  let uid = localStorage.getItem(key);
  if (!uid) {
    uid = "wn_" + Math.random().toString(36).slice(2,10);
    localStorage.setItem(key, uid);
  }
  return uid;
}
const UID = getOrCreateUID();
if (userIdInput) userIdInput.value = UID;

// ------- Render activities (clickable) -------
function renderActivities() {
  if (!actsEl) return;
  actsEl.innerHTML = "";
  ACTIVITIES.forEach(a => {
    const div = document.createElement("div");
    div.className = "card-item";
    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div>
          <div style="font-weight:600">${a.name}</div>
        </div>
      </div>
      <button class="badge ${selected.has(a.id) ? "is-on" : ""}">${selected.has(a.id) ? "Selected" : "Select"}</button>
    `;
    div.querySelector(".badge").onclick = () => {
      if (selected.has(a.id)) selected.delete(a.id); else selected.add(a.id);
      renderActivities(); renderSummary();
    };
    actsEl.appendChild(div);
  });
}
function renderSummary() {
  const date = ($("#date") && $("#date").value) || "Not set";
  const guests = ($("#guests") && $("#guests").value) || "1";
  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a=>a.name).join(" • ") || "None";
  const html = `Date: ${date}\nGuests: ${guests}\nActivities: ${names}`;
  if (summaryEl) summaryEl.innerText = html;
}
renderActivities(); renderSummary();
if ($("#date")) $("#date").addEventListener("change", renderSummary);
if ($("#guests")) $("#guests").addEventListener("input", renderSummary);

// ------- Build package (shows summary & shows confirm button) -------
buildBtn.addEventListener("click", async () => {
  const date = ($("#date") && $("#date").value) || "";
  const guests = parseInt( ($("#guests") && $("#guests").value) || 1, 10 );
  const activities = Array.from(selected);
  const notes = ($("#notes" && $("#notes").value) || "").trim();
  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a=>a.name).join(" • ") || "None";
  const summaryText = `Date: ${date || "Not set"}\nGuests: ${guests}\nActivities: ${names}\nNotes: ${notes || "-" }\n\nDownload the PDF and share it with Manjeet: +91 96782 19052.`;
  if (packageOut) packageOut.textContent = summaryText;
  // show confirm button
  if (confirmSaveBtn) confirmSaveBtn.style.display = "inline-block";
});

// ------- Confirm modal (collect mobile) -------
function showConfirmModal(onConfirm) {
  // lightweight modal using prompt for minimal edits; replace with fancier UI if wanted
  const test = confirm("Mark this as TEST record? (OK = test, Cancel = real)");
  let mobile = prompt("Enter mobile number to confirm (10 digits or +country):");
  if (!mobile) { alert("Cancelled."); return; }
  mobile = mobile.trim();
  onConfirm({ mobile, test });
}

// ------- API: /api/confirm call -------
async function postConfirm(payload) {
  try {
    const res = await fetch("/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    return { ok:false, error: String(e) };
  }
}

// ------- Confirm & Save click -------
if (confirmSaveBtn) confirmSaveBtn.addEventListener("click", () => {
  // build payload
  const date = ($("#date") && $("#date").value) || "";
  const guests = parseInt( ($("#guests") && $("#guests").value) || 1, 10 );
  const activities = Array.from(selected);
  const notes = ($("#notes" && $("#notes").value) || "").trim();
  const names = ACTIVITIES.filter(a => selected.has(a.id)).map(a=>a.name).join(" • ") || "None";
  const summaryText = `Date: ${date || "Not set"}\nGuests: ${guests}\nActivities: ${names}\nNotes: ${notes || "-"}\n\nDownload the PDF and share it with Manjeet: +91 96782 19052.`;

  showConfirmModal(async ({ mobile, test }) => {
    // basic validation: digits or +digits
    const cleaned = mobile.replace(/[^\d+]/g,'');
    if (!/^\+?\d{10,15}$/.test(cleaned)) { alert("Please enter a valid mobile number (10+ digits)."); return; }
    const payload = {
      uid: UID,
      mobile: cleaned.startsWith("+") ? cleaned : (cleaned.length === 10 ? "+91" + cleaned : "+"+cleaned),
      test: !!test,
      payload: {
        timestamp: new Date().toISOString(),
        date,
        guests,
        activities,
        notes,
        summary: summaryText
      }
    };
    // UI feedback
    confirmSaveBtn.disabled = true;
    confirmSaveBtn.textContent = "Saving…";
    const result = await postConfirm(payload);
    confirmSaveBtn.disabled = false;
    confirmSaveBtn.textContent = "Confirm & Save (enter mobile)";
    if (result.ok) {
      alert("Package saved. Reference: " + (result.ref || result.ts || "saved"));
      // hide confirm after success (optional)
      confirmSaveBtn.style.display = "none";
    } else {
      alert("Save failed: " + (result.error || "unknown"));
    }
  });
});

// ------- PDF generation (simple client-side) -------
downloadPdfBtn && downloadPdfBtn.addEventListener("click", () => {
  const text = (packageOut && packageOut.textContent) || "";
  const blob = new Blob([text], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "weavers-nest-package.txt"; // keep simple; if you want PDF, include jsPDF
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

// ------- Email package (calls backend) -------
emailPkgBtn && emailPkgBtn.addEventListener("click", async () => {
  const text = (packageOut && packageOut.textContent) || "";
  if (!text) return alert("Build the package first.");
  try {
    const r = await fetch("/api/email", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ subject:"Weavers Nest Package", text, fromUser: UID }) });
    const j = await r.json();
    if (j.ok) alert("Emailed to admin."); else alert("Email failed: " + (j.error||""));
  } catch (e) { alert("Email failed: " + String(e)); }
});

// ------- Gallery modal -------
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

// ------- Chat (simple) -------
function addChat(role, text) {
  if (!chatLog) return;
  const div = document.createElement("div");
  div.style.margin="6px 0";
  div.innerHTML = `<div style="font-weight:700;color:${role==='user'?'#0f172a':'#0b7b6f'}">${role==='user'?'You':'Guide'}</div><div>${text}</div>`;
  chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight;
}
addChat("bot","Hi! Ask about timings, seasons, or activities. Say 'show rafting photos' to see pictures.");
chatForm && chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = (chatInput && chatInput.value || "").trim(); if (!q) return;
  addChat("user", q); chatInput.value = "";
  // photo trigger
  const low = q.toLowerCase();
  if (/photo|image|picture|pic|gallery|show.*(raft|weav|elephant|tower|forest|track)/.test(low)) {
    const pics = [
      {src:"/images/rafting.jpg", name:"River Rafting"},
      {src:"/images/weaving.jpg", name:"Village Weaving"},
      {src:"/images/tracking.jpg", name:"Forest Tracking"},
      {src:"/images/birding.jpg", name:"Bird Watching"}
    ];
    const html = pics.map(p=>`<div style="display:inline-block;margin:6px"><img src="${p.src}" style="width:120px;height:90px;object-fit:cover;border-radius:8px"/><div style="text-align:center;font-size:12px">${p.name}</div></div>`).join("");
    addChat("bot", html);
  } else {
    // forward to /api/chat for backend response
    addChat("bot","Searching…");
    try {
      const r = await fetch("/api/chat", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ message:q, userId: UID })});
      const j = await r.json();
      addChat("bot", j.reply || "Sorry, no answer.");
    } catch { addChat("bot","Network error."); }
  }
});

// ------- footer year -------
const yr = document.getElementById("year"); if (yr) yr.textContent = new Date().getFullYear();
