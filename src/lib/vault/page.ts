import type { Lang } from "@/lib/i18n/langs";
import { LANGS } from "@/lib/i18n/langs";
import { vaultText } from "./text";
import { VAULT_CRYPTO_SRC } from "./crypto-src";
import { VAULT_UI_SRC } from "./ui-src";
import { ALLERGIES, BLOOD, CONDITIONS, HEALTH_LABELS } from "./health";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** The offline vault as one self-contained HTML page: no network is needed once it is saved on the phone (the service worker keeps a copy). No personal data is in it; everything the traveler saves lives in the phone's own storage. */
export function renderVaultPage(lang: Lang): string {
  const T = vaultText(lang);
  const cfg = JSON.stringify({ t: T, health: { labels: HEALTH_LABELS, blood: BLOOD, allergies: ALLERGIES, conditions: CONDITIONS } }).replace(/</g, "\\u003c").split("\u2028").join("\\u2028").split("\u2029").join("\\u2029");
  const types = ["passport", "evoa", "insurance", "booking", "ticket", "other"].map((k) => `<option value="${k}">${esc(T[`type_${k}`])}</option>`).join("");
  return `<!doctype html>
<html lang="${esc(LANGS[lang].htmlLang)}" dir="${LANGS[lang].dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>${esc(T.title)}</title>
<style>
  :root{--bg:#fbfaf6;--ink:#0b2545;--muted:#4a5b73;--line:#e6e2d8;--primary:#1557e0;--gold:#ffb627;--danger:#c2261c;--ok:#0e7a4f;--sky:#e8f1ff}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Noto Sans SC",sans-serif;background:var(--bg);color:var(--ink);line-height:1.5;font-size:16px}
  main{max-width:640px;margin:0 auto;padding:16px 16px 80px}
  h1{font-size:1.5rem;margin:.3em 0 .4em} h2{font-size:1.15rem;margin:1.2em 0 .4em} h3{margin:.2em 0}
  .muted{color:var(--muted);font-size:.92rem} .note{background:#fff1cc;color:#6b4500;font-weight:600;padding:10px 12px;border-radius:12px;font-size:.92rem}
  a{color:var(--primary)} .top{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 12px}
  section.box,#lock,#home{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;margin:14px 0}
  .fld{display:block;margin:10px 0} .fld>span,legend{display:block;font-weight:700;font-size:.9rem;margin-bottom:4px}
  input[type=text],input[type=password],input[type=date],input[type=tel],select,textarea{width:100%;min-height:46px;padding:8px 12px;border:1.5px solid #7a8699;border-radius:12px;font-size:16px;background:#fff;color:var(--ink)}
  textarea{min-height:90px} fieldset{border:1px solid var(--line);border-radius:14px;margin:12px 0;padding:10px 12px}
  .checks{display:grid;gap:4px}.check{display:flex;gap:10px;align-items:flex-start;min-height:44px;padding:6px 4px}.check input{width:22px;height:22px;margin-top:2px;flex:none}
  button,.btn{font:inherit;font-weight:800;min-height:46px;padding:10px 18px;border-radius:14px;border:1.5px solid var(--primary);background:#fff;color:var(--primary);cursor:pointer;text-decoration:none;display:inline-block}
  button.primary{background:var(--primary);color:#fff} button.danger{border-color:var(--danger);color:var(--danger)} button.ghost{border-color:var(--line);color:var(--ink)}
  button:disabled{opacity:.6;cursor:wait} .linkbtn{border:0;background:none;color:var(--muted);text-decoration:underline;font-weight:600;min-height:44px}
  :focus-visible{outline:3px solid var(--gold);outline-offset:2px}
  .bar{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.bar [role=tablist]{display:flex;gap:6px}
  [role=tab]{border-color:var(--line);color:var(--ink)}[role=tab][aria-selected=true]{background:var(--sky);border-color:var(--primary);color:var(--primary)}
  ul{list-style:none;margin:0;padding:0}#doclist li{margin:8px 0}.row{display:block;width:100%;text-align:start;border-color:var(--line);color:var(--ink);font-weight:600}.row b{display:block}
  .msg{min-height:1.4em;font-weight:700;color:var(--ok)}.msg.bad{color:var(--danger)} .pic{max-width:100%;border-radius:12px;border:1px solid var(--line)} .actions{display:flex;gap:10px;flex-wrap:wrap}
  #viewer{border:2px solid var(--primary);border-radius:14px;padding:12px;margin:12px 0}
  #cardwrap{position:fixed;inset:0;z-index:50;background:#fff;overflow:auto;padding:16px}#cardbox{max-width:640px;margin:0 auto;padding-bottom:90px}
  #cardbox h3{font-size:1.4rem;border-bottom:3px solid var(--danger);padding-bottom:6px} .csec{margin:14px 0}.csec h4{margin:0 0 4px;font-size:1.05rem;color:var(--danger)}
  .bi b{display:block}.bi span,.th{display:block;color:var(--primary);font-weight:700} #cardbox li{margin:4px 0;font-size:1.15rem}.who{font-size:1.2rem}.ask{background:var(--sky);padding:10px;border-radius:12px}
  .tel{font-weight:800;font-size:1.2rem} #cardclose{position:fixed;bottom:14px;inset-inline:16px;max-width:608px;margin:0 auto;background:var(--primary);color:#fff}
  body.full{overflow:hidden}[hidden]{display:none!important}
</style>
</head>
<body>
<main>
  <h1>${esc(T.title)}</h1>
  <p>${esc(T.intro)}</p>
  <p class="note">${esc(T.local)}</p>
  <p class="top"><a class="btn" href="/offline-emergency.html">☎ ${esc(T.emergency)}</a><a class="btn" href="/">${esc(T.back_app)}</a></p>
  <noscript><p class="note">JavaScript is needed.</p></noscript>

  <section id="lock" hidden aria-labelledby="lock_title">
    <h2 id="lock_title"></h2>
    <form id="lockform" novalidate>
      <label class="fld"><span>${esc(T.pass1)}</span><input id="pass" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label class="fld" id="pass2row" hidden><span>${esc(T.pass2)}</span><input id="pass2" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <button id="lock_btn" type="submit" class="primary"></button>
      <p id="forget" class="muted">${esc(T.forget)}</p>
    </form>
    <p id="lockmsg" class="msg" role="alert"></p>
    <p><button type="button" id="erase" class="linkbtn">${esc(T.erase_all)}</button></p>
  </section>

  <section id="home" hidden>
    <div class="bar"><div role="tablist"><button type="button" role="tab" id="tab_docs" aria-selected="true" aria-controls="pane_docs">${esc(T.tab_docs)}</button><button type="button" role="tab" id="tab_health" aria-selected="false" aria-controls="pane_health">${esc(T.tab_health)}</button></div><button type="button" id="lock_btn2" class="ghost">🔒 ${esc(T.lock)}</button></div>
    <div id="pane_docs" role="tabpanel" aria-labelledby="tab_docs">
      <ul id="doclist"></ul><div id="viewer" hidden></div>
      <h2>${esc(T.add_doc)}</h2>
      <form id="docform" novalidate>
        <label class="fld"><span>${esc(T.doc_type)}</span><select id="doc_type">${types}</select></label>
        <label class="fld"><span>${esc(T.doc_title)}</span><input id="doc_title" type="text" maxlength="80" autocomplete="off"></label>
        <label class="fld"><span>${esc(T.doc_note)}</span><textarea id="doc_note" maxlength="1000"></textarea></label>
        <label class="fld"><span>${esc(T.doc_file)}</span><input id="doc_file" type="file" accept="image/*,application/pdf"></label>
        <button id="doc_btn" type="submit" class="primary">${esc(T.save)}</button>
      </form>
      <p id="docmsg" class="msg" role="status"></p><p id="doccount" data-n="0" hidden></p>
    </div>
    <div id="pane_health" role="tabpanel" aria-labelledby="tab_health" hidden><form id="healthform" novalidate></form></div>
    <p class="muted">${esc(T.idle)}</p>
    <p><button type="button" id="erase2" class="linkbtn">${esc(T.erase_all)}</button></p>
  </section>
</main>
<div id="cardwrap" hidden role="dialog" aria-modal="true" aria-label="${esc(T.card_for_medic)}"><p class="muted">${esc(T.card_for_medic)}</p><div id="cardbox"></div><button type="button" id="cardclose">${esc(T.close)}</button></div>
<script type="application/json" id="cfg">${cfg}</script>
<script>${VAULT_CRYPTO_SRC}</script>
<script>${VAULT_UI_SRC}</script>
</body>
</html>
`;
}
