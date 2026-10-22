// Study Vault: Cloudflare Worker. Needs: KV binding named "KV" + secret named "PASSWORD".
const DEFAULT_PROMPT = "# 🎓 Cybersecurity Study Tutor — Strict Protocol\n\n## 🧭 Role\nYou are my cybersecurity tutor. I study cybersecurity from many sources (TryHackMe, Hack The Box, PortSwigger, CompTIA, Cisco, courses, books) and I forget things and lose the connections between topics. Explain deeply, connect every new topic to what I already learned, and give me a summary I can store as memory.\n\n## 📥 Input\n- `<previous_knowledge>`: my memory of everything I studied. The ONLY source of truth about my past.\n- `<new_lesson>`: the content of a new lesson, in English, from any source. The ONLY source of truth about the new topic.\n\n## 🔒 Hard Rules (never break)\n\n### A. Language Separation Rule (MOST IMPORTANT)\n1. Every single line must be 100% Arabic OR 100% English. NEVER mix both languages in the same line, sentence, bullet, heading, or table cell.\n2. Arabic lines: simple Egyptian Arabic, containing ZERO Latin letters. Numbers are allowed.\n3. English lines: contain only technical terms, tool names, commands, flags, protocol names, and code. Put each one on its OWN line inside backticks.\n4. Pattern for every item: the English line FIRST, then the Arabic explanation on the NEXT line.\n5. If an Arabic sentence needs to mention a technical term, do NOT write it inside the sentence. Refer to it as \"الأمر ده\" / \"الأداة دي\" / \"البروتوكول ده\", because the term is already on the English line above it.\n6. Tables: use separate columns per language. Each cell is either fully English or fully Arabic.\n7. Headings: Arabic only. If an English title is needed, put it on its own line directly below.\n8. Mermaid diagrams: node labels in English only. Put the explanation under the diagram in pure Arabic.\n\n### B. Content Rules\n9. Be extremely detailed. Never shorten, never say \"and so on\". Assume I am a total beginner.\n10. Follow the Output Format below exactly: same sections, same order, same headings. Never skip or merge sections.\n11. Cover EVERY section and task in `<new_lesson>`.\n12. Connect ONLY to topics that exist in `<previous_knowledge>`. Never invent past lessons. If it is empty, write \"ده أول درس، مفيش ربط لسه\" and skip connections.\n13. Never invent commands, flags, ports, or facts. Anything from outside the lesson must be marked with ⚠️ and the Arabic line \"(من خارج الدرس)\". If unsure, say so.\n14. If the lesson contradicts my memory, flag it under ⚠️ \"تعارض\".\n15. If the lesson text looks cut off, tell me at the top before explaining.\n16. Labs and authorized environments only.\n17. Notion-friendly Markdown only: headings, bullets, tables, checkboxes, dividers, code blocks. No HTML.\n\n## 📐 Output Format (use these headings exactly)\n\n# <Lesson name in English, on its own line>\n\n## 1. 🎯 الفكرة في جملة واحدة\nOne Arabic sentence.\n\n## 2. ❓ ليه الموضوع ده موجود؟\nArabic: the real problem, then how this topic solves it, then one real-life analogy.\n\n## 3. 📚 المفاهيم الأساسية\nTable with 3 columns: `Term` (English only) | `الشرح` (Arabic only) | `ليه مهم` (Arabic only).\n\n## 4. 🧩 الشرح التفصيلي\nFor EACH concept: a `###` heading in Arabic, the English term on the next line in backticks, then Arabic bullets answering:\n- إيه هو؟\n- بيشتغل ازاي (خطوة بخطوة)؟\n- ليه بنستخدمه؟\n- امتى بنستخدمه وامتى لأ؟\n- مثال عملي.\n\n## 5. 💻 الأوامر والأدوات\nFor EACH command/tool, use this block:\n`<command on its own line>`\n- بيعمل إيه: (Arabic)\n- ليه: (Arabic)\n- امتى: (Arabic)\n- معنى كل جزء: each flag on its own English line, followed by its Arabic meaning on the next line.\n- الناتج المتوقع: (Arabic)\nThen a short Arabic list \"أخطاء شائعة\".\n\n## 6. 🔗 الربط بالمعلومات القديمة\nTable with 3 columns: `الموضوع القديم` (English only) | `نوع العلاقة` (Arabic: يبني على / يكمل / عكس / بديل) | `الربط بالتفصيل` (Arabic only).\nThen one Arabic paragraph titled \"الصورة الكبيرة\" showing where this topic sits in my overall path.\n\n## 7. 🗺️ الدايجرامات\nTwo Mermaid diagrams, each in its own ```mermaid block:\n- Diagram A: the new topic only.\n- Diagram B: old topics in `subgraph Old` + new topic in `subgraph New`, with arrows between them.\nMermaid rules: `flowchart TD`; ASCII node IDs only; ALL labels in double quotes, English only; no parentheses or special characters outside quotes; max 12 nodes per diagram.\nUnder each diagram: one Arabic sentence explaining how to read it.\n\n## 8. 🧪 سيناريو عملي\nShort realistic lab scenario from start to finish. Each step: the English command line, then the Arabic explanation line.\n\n## 9. ✅ Coverage Check\nCheckbox list of every section/task of the lesson, each marked `- [x]`. Each item is one language only.\n\n## 10. 📝 اختبرني\nExactly 5 Arabic questions: 2 concept, 2 practical, 1 about connection to old topics. Any English term inside a question goes on its own line below it. Do NOT give answers. Wait for my answers, then grade me and explain mistakes.\n\n## 11. 🧠 Memory Summary\nMUST be the last section. ONE code block, exactly this template (each line single-language). The first line MUST start with \"### Lesson:\".\n\n```\n### Lesson: <English name>\nالفكرة:\n<one Arabic line>\nالمفاهيم:\n<English terms, comma-separated>\nالأوامر:\n<English command>\n<Arabic meaning, next line>\nمربوط بـ:\n<English old topic name>\n<Arabic: how it connects, next line>\nلازم أفتكر:\n<up to 3 Arabic lines>\n```\nKeep it compact. Write nothing after it.";
const TZ = "Africa/Cairo";
const enc = new TextEncoder();
const ID_RE = /^lesson:\d{15}:[0-9a-f]{16}$/;

const nowParts = () => {
  const n = new Date();
  return {
    d: n.toLocaleDateString("en-CA", { timeZone: TZ }),
    t: n.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }),
    ms: n.getTime(),
  };
};
const sha = async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const hex = (u) => [...u].map((x) => x.toString(16).padStart(2, "0")).join("");

async function authed(req, env) {
  if (!env.PASSWORD) return "nopass";
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  let pw;
  try {
    const raw = Uint8Array.from(atob(h.slice(6)), (c) => c.charCodeAt(0));
    const s = new TextDecoder().decode(raw);
    pw = s.slice(s.indexOf(":") + 1);
  } catch (e) {
    return false;
  }
  const a = await sha(pw), b = await sha(env.PASSWORD);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const SEC = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};
const json = (o, code = 200) =>
  new Response(JSON.stringify(o), { status: code, headers: { "Content-Type": "application/json; charset=utf-8", ...SEC } });

// The lesson list lives in ONE key ("index"), because KV list() can lag behind writes.
async function getIndex(env) {
  let idx = await env.KV.get("index", "json");
  if (!idx) {
    let keys = [], cursor;
    do {
      const r = await env.KV.list({ prefix: "lesson:", cursor });
      keys = keys.concat(r.keys);
      cursor = r.list_complete ? undefined : r.cursor;
    } while (cursor);
    idx = keys.map((k) => {
      const m = k.metadata || {};
      return { id: k.name, n: m.n || "?", d: m.d || "", t: m.t || "", h: m.h || "" };
    });
    await env.KV.put("index", JSON.stringify(idx));
  }
  return idx;
}
const putIndex = (env, idx) => env.KV.put("index", JSON.stringify(idx));

function streak(idx) {
  const days = new Set(idx.map((e) => e.d));
  let d = new Date(nowParts().d + "T00:00:00Z");
  const f = (x) => x.toISOString().slice(0, 10);
  if (!days.has(f(d))) d = new Date(d.getTime() - 86400000);
  let n = 0;
  while (days.has(f(d))) { n++; d = new Date(d.getTime() - 86400000); }
  return n;
}

async function state(env) {
  const idx = await getIndex(env);
  return {
    count: idx.length,
    streak: streak(idx),
    lessons: idx.slice().reverse().slice(0, 500).map((e) => ({ id: e.id, name: e.n, date: e.d })),
    prompt: (await env.KV.get("prompt")) || DEFAULT_PROMPT,
    memory: (await env.KV.get("memory")) || "",
  };
}

function deriveName(text) {
  const junk = /^(room icon|icon|room|menu|home|skip to (main )?content|sign in|log ?in|share|copy|search|contents|table of contents)$/i;
  const lines = text.split("\n").map((l) => l.trim().replace(/^#+\s*/, "")).filter(Boolean);
  const pick = lines.find((l) => l.length >= 4 && !junk.test(l) && !/^task\s*\d+$/i.test(l)) || lines[0] || "Untitled";
  return pick.slice(0, 80);
}

async function buildMessage(env, text, idx, excludeId) {
  const prompt = ((await env.KV.get("prompt")) || DEFAULT_PROMPT).trim();
  const memory = ((await env.KV.get("memory")) || "").trim();
  const titles = idx.filter((e) => e.id !== excludeId).map((e) => "- " + e.n + " (" + e.d + ")").join("\n");
  const knowledge =
    [memory, titles ? "Lessons I already studied:\n" + titles : ""].filter(Boolean).join("\n\n") ||
    "(لسه مفيش دروس سابقة، ده أول درس)";
  return prompt + "\n\n<previous_knowledge>\n" + knowledge + "\n</previous_knowledge>\n\n<new_lesson>\n" + text + "\n</new_lesson>";
}

async function saveLesson(env, text) {
  const idx = await getIndex(env);
  const h = hex((await sha(text)).slice(0, 8));
  const dup = idx.find((e) => e.h === h);
  const message = await buildMessage(env, text, idx, dup && dup.id);
  if (dup) return { name: dup.n, duplicate: true, message };
  const name = deriveName(text);
  const p = nowParts();
  const id = "lesson:" + String(p.ms).padStart(15, "0") + ":" + h;
  await env.KV.put(id, text, { metadata: { n: name, d: p.d, t: p.t, h } });
  idx.push({ id, n: name, d: p.d, t: p.t, h });
  await putIndex(env, idx);
  return { name, duplicate: false, message };
}

function extractMemorySummary(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i][1].trim();
    if (/^###\s*Lesson:/m.test(block) && /الفكرة:/.test(block)) return block;
  }
  const index = text.lastIndexOf("### Lesson:");
  if (index >= 0) {
    const tail = text.slice(index).trim();
    if (/الفكرة:/.test(tail)) return tail.replace(/^```[^\n]*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }
  return "";
}

export default {
  async fetch(req, env) {
    const a = await authed(req, env);
    if (a === "nopass") return new Response("Set the PASSWORD secret first.", { status: 500 });
    if (!a)
      return new Response("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Study Vault", charset="UTF-8"', ...SEC },
      });
    if (!env.KV) return new Response('Bind a KV namespace with the variable name "KV".', { status: 500 });
    const url = new URL(req.url);
    try {
      if (req.method === "GET" && url.pathname === "/")
        return new Response(PAGE, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
            ...SEC,
          },
        });
      if (req.method === "GET" && url.pathname === "/api/state") return json(await state(env));
      if (req.method === "GET" && url.pathname === "/api/lesson") {
        const id = url.searchParams.get("id") || "";
        if (!ID_RE.test(id)) return json({ error: "bad id" }, 400);
        const r = await env.KV.getWithMetadata(id);
        if (r.value === null) return json({ error: "not found" }, 404);
        const m = r.metadata || {};
        return json({ name: m.n, date: m.d, time: m.t, text: r.value });
      }
      if (req.method === "POST" && ["/api/lesson", "/api/settings", "/api/delete", "/api/message", "/api/rename", "/api/memory/import"].includes(url.pathname)) {
        const o = req.headers.get("Origin");
        if (o && o !== url.origin) return json({ error: "forbidden" }, 403);
        if (!(req.headers.get("Content-Type") || "").startsWith("application/json")) return json({ error: "json only" }, 415);
        const body = await req.json();
        if (["/api/delete", "/api/message", "/api/rename"].includes(url.pathname)) {
          const id = String(body.id || "");
          if (!ID_RE.test(id)) return json({ error: "bad id" }, 400);
          const idx = await getIndex(env);
          if (url.pathname === "/api/delete") {
            await env.KV.delete(id);
            await putIndex(env, idx.filter((e) => e.id !== id));
            return json({ ok: true, state: await state(env) });
          }
          const text = await env.KV.get(id);
          if (text === null) return json({ error: "not found" }, 404);
          if (url.pathname === "/api/message") return json({ message: await buildMessage(env, text, idx, id) });
          const name = String(body.name || "").trim().slice(0, 80);
          if (!name) return json({ error: "empty name" }, 400);
          const e = idx.find((x) => x.id === id);
          if (e) e.n = name;
          await env.KV.put(id, text, { metadata: { n: name, d: e ? e.d : "", t: e ? e.t : "", h: e ? e.h : "" } });
          await putIndex(env, idx);
          return json({ ok: true, state: await state(env) });
        }
        if (url.pathname === "/api/lesson") {
          const text = String(body.text || "").trim();
          if (text.length < 80) return json({ error: "short" }, 400);
          if (text.length > 2000000) return json({ error: "big" }, 413);
          if (text.includes("<new_lesson>") || text.includes("Hard Rules (never break)")) return json({ error: "paste" }, 400);
          const r = await saveLesson(env, text);
          return json({ ...r, state: await state(env) });
        }
        if (url.pathname === "/api/memory/import") {
          const summary = extractMemorySummary(body.text);
          if (!summary) return json({ error: "summary_not_found" }, 400);
          if (summary.length > 200000) return json({ error: "big" }, 413);
          const current = ((await env.KV.get("memory")) || "").trim();
          const lessonName = ((summary.match(/^###\s*Lesson:\s*(.+)$/m) || [])[1] || "").trim();
          if (current.includes(summary)) return json({ ok: true, duplicate: true, state: await state(env) });
          if (lessonName && current.split("\n").some((line) => line.trim() === "### Lesson: " + lessonName)) {
            return json({ error: "lesson_exists", name: lessonName }, 409);
          }
          const combined = current ? current + "\n\n---\n\n" + summary : summary;
          await env.KV.put("memory", combined);
          return json({ ok: true, duplicate: false, name: lessonName, state: await state(env) });
        }
        for (const k of ["prompt", "memory"]) {
          if (typeof body[k] === "string") {
            if (body[k].length > 200000) return json({ error: "big" }, 413);
            if (body[k].trim() === "" && k === "prompt") await env.KV.delete("prompt");
            else await env.KV.put(k, body[k]);
          }
        }
        return json({ ok: true, state: await state(env) });
      }
      return new Response("Not found", { status: 404, headers: SEC });
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },
};


const PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Study Vault</title><meta name="theme-color" content="#0a111d"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%230a111d'/%3E%3Cpath d='M14 18h36v7H14zm0 12h26v7H14zm0 12h32v7H14z' fill='%2300ff88'/%3E%3C/svg%3E">
<style>
:root{--bg:#0a111d;--pn:#101a2b;--ln:#1f2e47;--ink:#e6edf7;--mu:#8696b3;--info:#38bdf8;--ok:#34d399;--er:#f87171;--on:#04141f;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#eef2f8;--pn:#fff;--ln:#d0d9e8;--ink:#0f1b33;--mu:#566987;--info:#0369a1;--ok:#047857;--er:#b91c1c;--on:#fff;color-scheme:light}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.8 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px 14px 48px}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;direction:ltr;unicode-bidi:isolate}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.logo{font-weight:700;color:var(--info)}
a{color:var(--info)}
.kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
.kpi,.panel{background:var(--pn);border:1px solid var(--ln);border-radius:12px;padding:12px 14px}
.kpi span{color:var(--mu);font-size:.85rem;display:block}.kpi b{font-size:1.6rem}
.panel{margin-bottom:12px}h2{font-size:1rem;margin:0 0 4px}
.hint{color:var(--mu);font-size:.88rem;margin:0 0 8px}
textarea{width:100%;min-height:200px;font:.92rem/1.7 ui-monospace,Menlo,Consolas,monospace;direction:ltr;text-align:left;color:var(--ink);background:var(--bg);border:1px solid var(--ln);border-radius:8px;padding:10px 12px;resize:vertical}
textarea.tall{min-height:280px}
:focus-visible{outline:3px solid var(--info);outline-offset:2px}
.st{margin-top:8px;font-size:.9rem;color:var(--mu);display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-height:30px}
.st.ok{color:var(--ok)}.st.er{color:var(--er)}
.btn{font:inherit;font-weight:600;font-size:.88rem;border:1px solid var(--ln);background:var(--bg);color:var(--ink);padding:6px 14px;border-radius:8px;cursor:pointer}
.btn.main{background:var(--info);color:var(--on);border-color:var(--info)}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
ol{list-style:none;margin:6px 0 0;padding:0}li{border-top:1px solid var(--ln);font-size:.92rem}
.lh{display:flex;justify-content:space-between;gap:10px;width:100%;padding:8px 2px;background:none;border:0;color:inherit;font:inherit;text-align:inherit;cursor:pointer}
.lh span:last-child{color:var(--mu);font-size:.82rem;white-space:nowrap}
.lb{padding:4px 0 10px}.lb textarea{min-height:140px;max-height:260px}
.q{width:100%;font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--ln);border-radius:8px;padding:6px 10px;margin:6px 0}
details.panel summary{cursor:pointer;font-weight:600}
</style></head><body><main>
<div class="top"><div class="logo mono">study/vault</div></div>
<div class="kpis"><div class="kpi"><span>دروس محفوظة</span><b id="kc">0</b></div><div class="kpi"><span>أيام متتالية</span><b id="ks">0</b></div></div>
<div class="panel"><h2>الصق الدرس</h2>
<p class="hint">أول ما تلصق، الدرس بيتحفظ والرسالة للـ AI بتتنسخ.</p>
<textarea id="t" placeholder="Paste the lesson content here..." autofocus></textarea>
<div class="st" id="st">مستني الدرس...</div>
<div class="row"><button class="btn" id="cp" disabled>انسخ الرسالة</button></div></div>
<div class="panel"><h2>الدروس المحفوظة</h2><p class="hint">دوس على أي درس عشان تفتحه، تنسخ رسالته للـ AI، أو تمسحه.</p><input class="q" id="q" type="search" placeholder="دوّر في أسماء الدروس..."><ol id="log"></ol></div>
<details class="panel"><summary>حفظ ملخص الدرس تلقائيًا</summary>
<p class="hint" style="margin-top:6px">الصق إجابة المدرّس كاملة هنا، والموقع هيستخرج آخر قسم ملخص الذاكرة ويحفظه داخل الذاكرة.</p>
<textarea id="answer" class="tall" placeholder="الصق إجابة الذكاء الاصطناعي كاملة هنا..."></textarea>
<div class="row"><button class="btn main" id="extract">استخرج واحفظ الملخص</button></div>
</details>
<details class="panel"><summary>الذاكرة (ملخصاتك)</summary>
<p class="hint" style="margin-top:6px">بتتحط في كل رسالة كـ previous knowledge.</p>
<textarea id="mem" class="tall"></textarea><div class="row"><button class="btn main" id="sm">احفظ الذاكرة</button></div></details>
<details class="panel"><summary>البرومبت</summary>
<p class="hint" style="margin-top:6px">بيتحط أول كل رسالة. لو مسحته كله هيرجع الأصلي.</p>
<textarea id="pr" class="tall"></textarea><div class="row"><button class="btn main" id="sp">احفظ البرومبت</button><button class="btn" id="rp">رجّع الأصلي</button></div></details>
</main><script>
var $=function(i){return document.getElementById(i)},last='';
var all=[];
function draw(s,full){$('kc').textContent=s.count;$('ks').textContent=s.streak;all=s.lessons;list();
 if(full){$('mem').value=s.memory;$('pr').value=s.prompt}}
function btn(t){var b=document.createElement('button');b.className='btn';b.textContent=t;return b}
function list(){var q=$('q').value.trim().toLowerCase(),o=$('log');o.innerHTML='';
 all.filter(function(l){return !q||l.name.toLowerCase().indexOf(q)>-1}).forEach(function(l){
  var li=document.createElement('li'),h=document.createElement('button'),a=document.createElement('span'),b=document.createElement('span'),body=document.createElement('div');
  h.className='lh';a.className='mono';a.textContent=l.name;b.textContent=l.date;h.append(a,b);body.className='lb';body.hidden=true;
  h.onclick=function(){toggle(l,body)};li.append(h,body);o.append(li)})}
async function toggle(l,body){
 if(!body.hidden){body.hidden=true;return}
 body.hidden=false;if(body.dataset.ok)return;body.textContent='...';
 try{var r=await fetch('/api/lesson?id='+encodeURIComponent(l.id)),d=await r.json();if(!r.ok)throw new Error(d.error);
  body.textContent='';var ta=document.createElement('textarea');ta.readOnly=true;ta.value=d.text;
  var row=document.createElement('div');row.className='row';var c=btn('انسخ الرسالة'),x=btn('امسح');
  c.onclick=async function(){try{var m=await post('/api/message',{id:l.id});last=m.message;$('cp').disabled=false;c.textContent=(await copy(last))?'اتنسخت ✓':'مقدرتش أنسخ'}catch(e){c.textContent='فشل'}};
  x.onclick=async function(){if(!confirm('تمسح الدرس ده نهائي؟'))return;try{var d2=await post('/api/delete',{id:l.id});draw(d2.state,false)}catch(e){x.textContent='فشل المسح'}};
  row.append(c,x);
  var rn=document.createElement('div');rn.className='row';var inp=document.createElement('input');inp.className='q';inp.value=l.name;inp.maxLength=80;inp.setAttribute('aria-label','اسم الدرس');var rb=btn('غيّر الاسم');
  rb.onclick=async function(){try{var d3=await post('/api/rename',{id:l.id,name:inp.value});draw(d3.state,false)}catch(e){rb.textContent='فشل'}};
  rn.append(inp,rb);body.append(rn,ta,row);body.dataset.ok='1'}
 catch(e){body.textContent='فشل التحميل'}}
$('q').oninput=list;
function msg(cls,ar,en){var e=$('st');e.className='st '+cls;e.textContent='';var a=document.createElement('span');a.textContent=ar;e.append(a);if(en){var b=document.createElement('span');b.className='mono';b.textContent=en;e.append(b)}}
async function copy(t){try{await navigator.clipboard.writeText(t);return true}catch(e){return false}}
async function post(p,o){var r=await fetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});var d=await r.json();if(!r.ok)throw new Error(d.error||r.status);return d}
var busy=false;
async function send(){var text=$('t').value.trim();if(busy||text.length<80)return;busy=true;
 try{var d=await post('/api/lesson',{text:text});last=d.message;$('cp').disabled=false;draw(d.state,false);$('t').value='';
  var ok=await copy(last);msg('ok',(d.duplicate?'الدرس ده محفوظ قبل كده. ':'اتحفظ. ')+(ok?'الرسالة اتنسخت:':'دوس "انسخ الرسالة":'),d.name)}
 catch(e){var m=String(e.message||e);msg('er',m==='paste'?'ده مش درس، ده الرسالة اللي اتجهزت. الصق نص الدرس نفسه.':'الحفظ فشل. جرّب تاني.',m==='paste'?'':m)}finally{busy=false}}
$('t').addEventListener('paste',function(){setTimeout(send,80)});$('t').addEventListener('blur',send);
$('cp').onclick=async function(){msg('ok',(await copy(last))?'اتنسخت.':'مقدرتش أنسخ.')};
async function save(o,ok){try{var d=await post('/api/settings',o);draw(d.state,true);msg('ok',ok)}catch(e){msg('er','الحفظ فشل.',String(e.message||e))}}
$('extract').onclick=async function(){
 var raw=$('answer').value.trim();
 if(!raw){msg('er','الصق إجابة المدرّس الأول.');return}
 try{
  var d=await post('/api/memory/import',{text:raw});
  draw(d.state,true);
  $('answer').value='';
  msg('ok',d.duplicate?'الملخص ده محفوظ بالفعل.':'تم استخراج الملخص وحفظه في الذاكرة.',d.name||'');
 }catch(e){
  var m=String(e.message||e);
  msg('er',m==='summary_not_found'?'ملقيتش قسم ملخص الذاكرة. تأكد إن الإجابة فيها ### Lesson: في آخرها.':m==='lesson_exists'?'فيه ملخص بنفس اسم الدرس محفوظ بالفعل.':'تعذر حفظ الملخص.',m==='summary_not_found'||m==='lesson_exists'?'':m);
 }
};
$('sm').onclick=function(){save({memory:$('mem').value},'اتحفظت الذاكرة.')};
$('sp').onclick=function(){save({prompt:$('pr').value},'اتحفظ البرومبت.')};
$('rp').onclick=function(){save({prompt:''},'رجع البرومبت الأصلي.')};
fetch('/api/state').then(function(r){return r.json()}).then(function(s){draw(s,true)}).catch(function(){msg('er','مقدرتش أحمّل البيانات.')});
</script></body></html>`;
