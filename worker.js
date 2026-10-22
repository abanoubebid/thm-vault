// THM Vault: Cloudflare Worker. Needs: KV binding named "KV" + secret named "PASSWORD".
const DEFAULT_PROMPT = "# 🎓 TryHackMe Study Tutor — Strict Protocol\n\n## 🧭 Role\nYou are my cybersecurity tutor. I study TryHackMe rooms and I forget things and lose the connections between topics. Explain deeply, connect every new topic to what I already learned, and give me a summary I can store as memory.\n\n## 📥 Input\n- `<previous_knowledge>`: my memory of everything I studied. The ONLY source of truth about my past.\n- `<new_lesson>`: the English content of a new room. The ONLY source of truth about the new topic.\n\n## 🔒 Hard Rules (never break)\n\n### A. Language Separation Rule (MOST IMPORTANT)\n1. Every single line must be 100% Arabic OR 100% English. NEVER mix both languages in the same line, sentence, bullet, heading, or table cell.\n2. Arabic lines: simple Egyptian Arabic, containing ZERO Latin letters. Numbers are allowed.\n3. English lines: contain only technical terms, tool names, commands, flags, protocol names, and code. Put each one on its OWN line inside backticks.\n4. Pattern for every item: the English line FIRST, then the Arabic explanation on the NEXT line.\n5. If an Arabic sentence needs to mention a technical term, do NOT write it inside the sentence. Refer to it as \"الأمر ده\" / \"الأداة دي\" / \"البروتوكول ده\", because the term is already on the English line above it.\n6. Tables: use separate columns per language. Each cell is either fully English or fully Arabic.\n7. Headings: Arabic only. If an English title is needed, put it on its own line directly below.\n8. Mermaid diagrams: node labels in English only. Put the explanation under the diagram in pure Arabic.\n\n### B. Content Rules\n9. Be extremely detailed. Never shorten, never say \"and so on\". Assume I am a total beginner.\n10. Follow the Output Format below exactly: same sections, same order, same headings. Never skip or merge sections.\n11. Cover EVERY section and task in `<new_lesson>`.\n12. Connect ONLY to topics that exist in `<previous_knowledge>`. Never invent past lessons. If it is empty, write \"ده أول درس، مفيش ربط لسه\" and skip connections.\n13. Never invent commands, flags, ports, or facts. Anything from outside the lesson must be marked with ⚠️ and the Arabic line \"(من خارج الدرس)\". If unsure, say so.\n14. If the lesson contradicts my memory, flag it under ⚠️ \"تعارض\".\n15. If the lesson text looks cut off, tell me at the top before explaining.\n16. Labs and authorized environments only.\n17. Notion-friendly Markdown only: headings, bullets, tables, checkboxes, dividers, code blocks. No HTML.\n\n## 📐 Output Format (use these headings exactly)\n\n# <Room name in English, on its own line>\n\n## 1. 🎯 الفكرة في جملة واحدة\nOne Arabic sentence.\n\n## 2. ❓ ليه الموضوع ده موجود؟\nArabic: the real problem, then how this topic solves it, then one real-life analogy.\n\n## 3. 📚 المفاهيم الأساسية\nTable with 3 columns: `Term` (English only) | `الشرح` (Arabic only) | `ليه مهم` (Arabic only).\n\n## 4. 🧩 الشرح التفصيلي\nFor EACH concept: a `###` heading in Arabic, the English term on the next line in backticks, then Arabic bullets answering:\n- إيه هو؟\n- بيشتغل ازاي (خطوة بخطوة)؟\n- ليه بنستخدمه؟\n- امتى بنستخدمه وامتى لأ؟\n- مثال عملي.\n\n## 5. 💻 الأوامر والأدوات\nFor EACH command/tool, use this block:\n`<command on its own line>`\n- بيعمل إيه: (Arabic)\n- ليه: (Arabic)\n- امتى: (Arabic)\n- معنى كل جزء: each flag on its own English line, followed by its Arabic meaning on the next line.\n- الناتج المتوقع: (Arabic)\nThen a short Arabic list \"أخطاء شائعة\".\n\n## 6. 🔗 الربط بالمعلومات القديمة\nTable with 3 columns: `الموضوع القديم` (English only) | `نوع العلاقة` (Arabic: يبني على / يكمل / عكس / بديل) | `الربط بالتفصيل` (Arabic only).\nThen one Arabic paragraph titled \"الصورة الكبيرة\" showing where this topic sits in my overall path.\n\n## 7. 🗺️ الدايجرامات\nTwo Mermaid diagrams, each in its own ```mermaid block:\n- Diagram A: the new topic only.\n- Diagram B: old topics in `subgraph Old` + new topic in `subgraph New`, with arrows between them.\nMermaid rules: `flowchart TD`; ASCII node IDs only; ALL labels in double quotes, English only; no parentheses or special characters outside quotes; max 12 nodes per diagram.\nUnder each diagram: one Arabic sentence explaining how to read it.\n\n## 8. 🧪 سيناريو عملي\nShort realistic lab scenario from start to finish. Each step: the English command line, then the Arabic explanation line.\n\n## 9. ✅ Coverage Check\nCheckbox list of every section/task of the lesson, each marked `- [x]`. Each item is one language only.\n\n## 10. 📝 اختبرني\nExactly 5 Arabic questions: 2 concept, 2 practical, 1 about connection to old topics. Any English term inside a question goes on its own line below it. Do NOT give answers. Wait for my answers, then grade me and explain mistakes.\n\n## 11. 🧠 Memory Summary\nMUST be the last section. ONE code block, exactly this template (each line single-language). The first line MUST start with \"### Room:\" because my app reads it automatically:\n\n```\n### Room: <English name>\nالفكرة:\n<one Arabic line>\nالمفاهيم:\n<English terms, comma-separated>\nالأوامر:\n<English command>\n<Arabic meaning, next line>\nمربوط بـ:\n<English old topic name>\n<Arabic: how it connects, next line>\nلازم أفتكر:\n<up to 3 Arabic lines>\n```\nKeep it compact. Write nothing after it.";

const TZ = "Africa/Cairo";
const enc = new TextEncoder();
const DAY = 86400000;
const BULK = 25; // keys per bulk KV read (platform limit is 100)

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
const meta = (k) => k.metadata || {};

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
  const [a, b] = await Promise.all([sha(pw), sha(env.PASSWORD)]);
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

async function listKeys(env) {
  const keys = [];
  let cursor;
  do {
    const r = await env.KV.list({ prefix: "lesson:", cursor });
    for (const k of r.keys) keys.push(k);
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return keys;
}

// One bulk read instead of two separate round trips.
async function getSettings(env) {
  const m = await env.KV.get(["prompt", "memory"]);
  return { prompt: m.get("prompt") || DEFAULT_PROMPT, memory: m.get("memory") || "" };
}

function streak(keys) {
  const days = new Set(keys.map((k) => meta(k).d));
  let d = new Date(nowParts().d + "T00:00:00Z");
  const f = (x) => x.toISOString().slice(0, 10);
  if (!days.has(f(d))) d = new Date(d.getTime() - DAY);
  let n = 0;
  while (days.has(f(d))) { n++; d = new Date(d.getTime() - DAY); }
  return n;
}

// Pure function: builds the UI state from data we already have (no extra KV calls).
function view(keys, s) {
  return {
    count: keys.length,
    streak: streak(keys),
    lessons: keys.slice(-100).reverse().map((k) => ({ name: meta(k).n || "?", date: meta(k).d || "" })),
    prompt: s.prompt,
    memory: s.memory,
  };
}

async function state(env) {
  const [keys, s] = await Promise.all([listKeys(env), getSettings(env)]);
  return view(keys, s);
}

async function saveLesson(env, text) {
  const [keys, s] = await Promise.all([listKeys(env), getSettings(env)]);
  const h = hex((await sha(text)).slice(0, 8));
  const dup = keys.find((k) => meta(k).h === h);
  const prev = keys.filter((k) => k !== dup);
  const titles = prev.map((k) => "- " + (meta(k).n || "?") + " (" + (meta(k).d || "") + ")").join("\n");
  const memory = s.memory.trim();
  const knowledge =
    [memory, titles ? "Lessons I already studied:\n" + titles : ""].filter(Boolean).join("\n\n") ||
    "(لسه مفيش دروس سابقة، ده أول درس)";
  const message = s.prompt.trim() + "\n\n<previous_knowledge>\n" + knowledge + "\n</previous_knowledge>\n\n<new_lesson>\n" + text + "\n</new_lesson>";
  if (dup) return { name: meta(dup).n, duplicate: true, message, state: view(keys, s) };
  const first = text.split("\n").find((l) => l.trim()) || "Untitled";
  const name = first.trim().replace(/^#+\s*/, "").slice(0, 80) || "Untitled";
  const p = nowParts();
  const key = "lesson:" + String(p.ms).padStart(15, "0") + ":" + h;
  const m = { n: name, d: p.d, t: p.t, h };
  await env.KV.put(key, text, { metadata: m });
  // KV listing is eventually consistent, so add the new lesson locally instead of re-listing.
  return { name, duplicate: false, message, state: view([...keys, { name: key, metadata: m }], s) };
}

// Streams the file: first byte arrives immediately, memory stays small, and ALL lessons are exported.
async function exportMd(env, ctx) {
  const keys = await listKeys(env);
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter();
  ctx.waitUntil(
    (async () => {
      try {
        await w.write(enc.encode("# THM Lessons\n\n"));
        for (let i = 0; i < keys.length; i += BULK) {
          const chunk = keys.slice(i, i + BULK);
          const vals = await env.KV.get(chunk.map((k) => k.name));
          let out = "";
          for (const k of chunk) {
            const m = meta(k);
            out += "## " + (m.n || "?") + "\n- Date: " + (m.d || "") + " " + (m.t || "") + "\n\n" + (vals.get(k.name) || "") + "\n\n---\n\n";
          }
          await w.write(enc.encode(out));
        }
        await w.close();
      } catch (e) {
        await w.abort(e).catch(() => {});
      }
    })()
  );
  return new Response(readable, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="thm-lessons.md"', ...SEC },
  });
}

// Safe to embed inside an inline <script>.
const forScript = (o) =>
  JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export default {
  async fetch(req, env, ctx) {
    const a = await authed(req, env);
    if (a === "nopass") return new Response("Set the PASSWORD secret first.", { status: 500 });
    if (!a)
      return new Response("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="THM Vault", charset="UTF-8"', ...SEC },
      });
    if (!env.KV) return new Response('Bind a KV namespace with the variable name "KV".', { status: 500 });
    const url = new URL(req.url);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        // Embed the state in the page: one round trip instead of two.
        let init = null;
        try { init = await state(env); } catch (e) {}
        return new Response(PAGE.replace("__INIT__", () => forScript(init)), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            ...SEC,
          },
        });
      }
      if (req.method === "GET" && url.pathname === "/api/state") return json(await state(env));
      if (req.method === "GET" && url.pathname === "/export.md") return await exportMd(env, ctx);
      if (req.method === "GET" && url.pathname === "/favicon.ico") return new Response(null, { status: 204, headers: SEC });
      if (req.method === "POST" && (url.pathname === "/api/lesson" || url.pathname === "/api/settings")) {
        const o = req.headers.get("Origin");
        if (o && o !== url.origin) return json({ error: "forbidden" }, 403);
        if (!(req.headers.get("Content-Type") || "").startsWith("application/json")) return json({ error: "json only" }, 415);
        if ((Number(req.headers.get("Content-Length")) || 0) > 8000000) return json({ error: "big" }, 413);
        let body;
        try { body = await req.json(); } catch (e) { return json({ error: "bad json" }, 400); }
        if (!body || typeof body !== "object") return json({ error: "bad json" }, 400);
        if (url.pathname === "/api/lesson") {
          const text = String(body.text || "").trim();
          if (text.length < 80) return json({ error: "short" }, 400);
          if (text.length > 2000000) return json({ error: "big" }, 413);
          if (text.includes("<new_lesson>") || text.includes("Hard Rules (never break)")) return json({ error: "paste" }, 400);
          return json(await saveLesson(env, text));
        }
        // Validate everything first, so a rejected request never half-saves.
        const keysToSave = ["prompt", "memory"].filter((k) => typeof body[k] === "string");
        for (const k of keysToSave) if (body[k].length > 200000) return json({ error: "big" }, 413);
        const [keys, s] = await Promise.all([listKeys(env), getSettings(env)]);
        const writes = [];
        for (const k of keysToSave) {
          if (body[k].trim() === "" && k === "prompt") { writes.push(env.KV.delete("prompt")); s.prompt = DEFAULT_PROMPT; }
          else { writes.push(env.KV.put(k, body[k])); s[k] = body[k]; }
        }
        await Promise.all(writes);
        return json({ ok: true, state: view(keys, s) });
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
<title>THM Vault</title>
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
ol{list-style:none;margin:6px 0 0;padding:0}li{display:flex;justify-content:space-between;gap:10px;padding:8px 2px;border-top:1px solid var(--ln);font-size:.92rem}
li span:last-child{color:var(--mu);font-size:.82rem;white-space:nowrap}
details.panel summary{cursor:pointer;font-weight:600}
.btn:disabled{opacity:.5;cursor:not-allowed}
</style></head><body><main>
<div class="top"><div class="logo mono">THM/vault</div><a href="/export.md" download>حمّل كل الدروس (ملف)</a></div>
<div class="kpis"><div class="kpi"><span>دروس محفوظة</span><b id="kc">0</b></div><div class="kpi"><span>أيام متتالية</span><b id="ks">0</b></div></div>
<div class="panel"><h2>الصق الدرس</h2>
<p class="hint">أول ما تلصق، الدرس بيتحفظ والرسالة للـ AI بتتنسخ.</p>
<textarea id="t" aria-label="محتوى الدرس" placeholder="Paste the room content here..." autofocus></textarea>
<div class="st" id="st" role="status" aria-live="polite">مستني الدرس...</div>
<div class="row"><button class="btn main" id="go">احفظ</button><button class="btn" id="cp" disabled>انسخ الرسالة</button></div></div>
<div class="panel"><h2>الدروس المحفوظة</h2><ol id="log"></ol></div>
<details class="panel"><summary>الذاكرة (ملخصاتك)</summary>
<p class="hint" style="margin-top:6px">بتتحط في كل رسالة كـ previous knowledge.</p>
<textarea id="mem" class="tall" aria-label="الذاكرة"></textarea><div class="row"><button class="btn main" id="sm" disabled>احفظ الذاكرة</button></div></details>
<details class="panel"><summary>البرومبت</summary>
<p class="hint" style="margin-top:6px">بيتحط أول كل رسالة. لو مسحته كله هيرجع الأصلي.</p>
<textarea id="pr" class="tall" aria-label="البرومبت"></textarea><div class="row"><button class="btn main" id="sp" disabled>احفظ البرومبت</button><button class="btn" id="rp" disabled>رجّع الأصلي</button></div></details>
</main><script>
var $=function(i){return document.getElementById(i)},last='',busy=false,INIT=__INIT__;
function draw(s,full){$('kc').textContent=s.count;$('ks').textContent=s.streak;var o=$('log');o.innerHTML='';
 s.lessons.forEach(function(l){var li=document.createElement('li'),a=document.createElement('span'),b=document.createElement('span');a.className='mono';a.textContent=l.name;b.textContent=l.date;li.append(a,b);o.append(li)});
 if(full){if(full.mem)$('mem').value=s.memory;if(full.pr)$('pr').value=s.prompt}}
function msg(cls,ar,en){var e=$('st');e.className='st '+cls;e.textContent='';var a=document.createElement('span');a.textContent=ar;e.append(a);if(en){var b=document.createElement('span');b.className='mono';b.textContent=en;e.append(b)}}
async function copy(t){try{await navigator.clipboard.writeText(t);return true}catch(e){return false}}
async function post(p,o){var r=await fetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});var d=await r.json();if(!r.ok)throw new Error(d.error||r.status);return d}
async function send(){var text=$('t').value.trim();if(busy||text.length<80)return;busy=true;
 try{var d=await post('/api/lesson',{text:text});last=d.message;$('cp').disabled=false;draw(d.state,false);$('t').value='';
  var ok=await copy(last);msg('ok',(d.duplicate?'الدرس ده محفوظ قبل كده. ':'اتحفظ. ')+(ok?'الرسالة اتنسخت:':'دوس "انسخ الرسالة":'),d.name)}
 catch(e){var m=String(e.message||e);msg('er',m==='paste'?'ده مش درس، ده الرسالة اللي اتجهزت. الصق شرح الـ Room نفسه.':'الحفظ فشل. جرّب تاني.',m==='paste'?'':m)}
 finally{busy=false}}
$('t').addEventListener('paste',function(){setTimeout(send,80)});$('go').onclick=send;
$('cp').onclick=async function(){msg('ok',(await copy(last))?'اتنسخت.':'مقدرتش أنسخ.')};
async function save(o,ok,f){try{var d=await post('/api/settings',o);draw(d.state,f);msg('ok',ok)}catch(e){msg('er','الحفظ فشل.',String(e.message||e))}}
$('sm').onclick=function(){save({memory:$('mem').value},'اتحفظت الذاكرة.',{mem:true})};
$('sp').onclick=function(){save({prompt:$('pr').value},'اتحفظ البرومبت.',{pr:true})};
$('rp').onclick=function(){save({prompt:''},'رجع البرومبت الأصلي.',{pr:true})};
function boot(s){draw(s,{mem:true,pr:true});$('sm').disabled=$('sp').disabled=$('rp').disabled=false}
if(INIT)boot(INIT);else fetch('/api/state').then(function(r){if(!r.ok)throw 0;return r.json()}).then(boot).catch(function(){msg('er','مقدرتش أحمّل البيانات. حدّث الصفحة.')});
</script></body></html>`;
