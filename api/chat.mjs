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

const ANSWER_WORD_CAP = 90;
function trimToWords(text, cap = ANSWER_WORD_CAP) {
  const words = (text || "").trim().split(/\s+/);
  return words.length <= cap ? text : words.slice(0, cap).join(" ") + "…";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });
  try {
    const { message = "", userId = "guest" } = req.body || {};
    if (!message.trim()) return res.status(400).json({ ok:false, error:"message required" });

    const results = mini.search(message, { prefix:true, fuzzy:0.2, boost:{ title:2 } }).slice(0,6);
    const context = results.map(r => `Source: Weavers Nest (chunk ${r.chunkId})\n${r.content}`).join("\n\n---\n\n");
    const system = `You are a polite Weavers Nest assistant.\nRULES:\n- Answer ONLY using the CONTEXT below.\n- If not in CONTEXT, reply exactly: "I don't have that in the provided documents."\n- Keep answers short and tourist-friendly.\n- No extra claims or web info.`;

    const prompt = `CONTEXT:\n\n${context || "[no results]"}\n\nUSER QUESTION:\n${message}`;
    let reply = "I don't have that in the provided documents.";

    const out = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role:"system", content: system }, { role:"user", content: prompt }],
      temperature: 0.1,
      max_tokens: 350
    });
    reply = trimToWords(out.choices?.[0]?.message?.content?.trim() || reply);

    // Basic log to function logs
    console.log(JSON.stringify({ ts:new Date().toISOString(), type:"chat", userId, message, reply, citations: results.map(r=>({chunkId:r.chunkId})) }));

    res.status(200).json({ ok:true, reply, citations: results.map(r=>({source:"Weavers Nest", chunkId:r.chunkId})) });
  } catch (e) {
    console.error(e);
    res.status(200).json({ ok:true, reply:"Model error. Please try again." });
  }
}
