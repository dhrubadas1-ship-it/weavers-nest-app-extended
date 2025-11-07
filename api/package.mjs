import fs from "fs";
import path from "path";
import MiniSearch from "mini-search";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const knowledgePath = path.join(process.cwd(), "data", "weavers_nest_knowledge.txt");
const rawText = fs.readFileSync(knowledgePath, "utf8");
const CHUNK_SIZE = 1000;
function chunkText(t) {
  const s = t.replace(/\s+/g, " ").trim();
  const chunks = [];
  for (let i = 0; i < s.length; i += CHUNK_SIZE) chunks.push(s.slice(i, i + CHUNK_SIZE));
  return chunks;
}
const docs = chunkText(rawText).map((c, i) => ({ id: `WN-${i}`, title: "Weavers Nest", content: c, chunkId: i }));
const mini = new MiniSearch({ fields: ["content","title"], storeFields: ["content","title","chunkId"] });
mini.addAll(docs);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error: "POST only" });
  const { date = "", guests = 2, activities = [], notes = "", userId = "guest" } = req.body || {};

  const query = (activities.join(" ") || "Weavers Nest activities") + " " + (notes || "");
  const results = mini.search(query, { prefix: true, fuzzy: 0.2 }).slice(0, 8);
  const ctx = results.map(r => `Source: Weavers Nest (chunk ${r.chunkId})\n${r.content}`).join("\n\n---\n\n");

  const system = `You are a trip designer for Weavers Nest (Assam).
RULES:
- Use ONLY the CONTEXT.
- Produce a compact package with: Title, Date, Guests, Selected Activities, Timeline (hour-by-hour if times are known), Important Notes (rain pauses, closures, safety SOP), and Booking Next Steps.
- No prices. No outside info. Keep to 180 words.`;

  const user = `CONTEXT:\n${ctx || "[no results]"}\n\nREQUEST:\nCreate a custom package for:\n- Date: ${date || "TBD"}\n- Guests: ${guests}\n- Activities: ${activities.join(", ") || "TBD"}\n- Notes: ${notes || "—"}`;

  let text = "I don't have that in the provided documents.";
  try {
    const out = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role:"system", content: system }, { role:"user", content: user }],
      temperature: 0.2,
      max_tokens: 400
    });
    text = out.choices?.[0]?.message?.content?.trim() || text;
  } catch (e) {
    console.error(e);
  }

  console.log(JSON.stringify({ ts:new Date().toISOString(), type:"package", userId, date, guests, activities, notes, suggestion:text, citations: results.map(r=>({chunkId:r.chunkId})) }));

  res.status(200).json({ ok:true, suggestion:text, citations: results.map(r=>({source:"Weavers Nest", chunkId:r.chunkId})) });
}
