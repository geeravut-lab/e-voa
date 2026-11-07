// The screen logic of the offline vault page, as JavaScript SOURCE TEXT placed in the page (the page must work with no network and no app code).
// No backticks and no ${ in the source, so it can sit in a raw template string. User text is only ever put in with textContent, never as HTML.
export const VAULT_UI_SRC = String.raw`
(function () {
  var cfg = JSON.parse(document.getElementById("cfg").textContent), T = cfg.t, H = cfg.health, L = H.labels;
  var MAX_ITEMS = 40, MAX_FILE = 4 * 1024 * 1024, IDLE_MS = 180000;
  var state = { key: null, db: null, timer: null, urls: [], fails: 0, hiddenAt: 0 };
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) { if (k === "text") n.textContent = attrs[k]; else if (k === "class") n.className = attrs[k]; else if (attrs[k] === true) n.setAttribute(k, ""); else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function show(id) { ["lock", "home"].forEach(function (x) { $(x).hidden = x !== id; }); }
  function say(id, msg, bad) { var n = $(id); if (!n) return; n.textContent = msg || ""; n.className = "msg" + (bad ? " bad" : ""); }
  function busy(btn, on) { btn.disabled = on; btn.setAttribute("aria-busy", on ? "true" : "false"); if (on) { btn.dataset.l = btn.textContent; btn.textContent = T.working; } else if (btn.dataset.l) btn.textContent = btn.dataset.l; }

  // ---- storage
  function openDb() { return new Promise(function (res, rej) { var r = indexedDB.open("evoa-vault", 1); r.onupgradeneeded = function () { r.result.createObjectStore("meta"); r.result.createObjectStore("items", { keyPath: "id" }); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function tx(store, mode, fn) { return new Promise(function (res, rej) { var t = state.db.transaction(store, mode), req = fn(t.objectStore(store)); t.oncomplete = function () { res(req && req.result); }; t.onerror = t.onabort = function () { rej(t.error); }; }); }
  var getMeta = function () { return tx("meta", "readonly", function (s) { return s.get("m"); }); };
  var allItems = function () { return tx("items", "readonly", function (s) { return s.getAll(); }); };
  var putItem = function (it) { return tx("items", "readwrite", function (s) { return s.put(it); }); };
  var delItem = function (id) { return tx("items", "readwrite", function (s) { return s.delete(id); }); };
  var te = new TextEncoder();

  // ---- lock screen
  async function start() {
    if (!window.indexedDB || !window.crypto || !crypto.subtle) { $("lock").hidden = false; $("lockform").hidden = true; say("lockmsg", T.unsupported, true); return; }
    try { state.db = await openDb(); } catch (e) { $("lockform").hidden = true; say("lockmsg", T.unsupported, true); return; }
    var meta = await getMeta(); showLock(!meta);
  }
  function showLock(first) {
    show("lock"); state.key = null; $("lockform").hidden = false;
    $("lock_title").textContent = first ? T.create_title : T.unlock_title; $("pass2row").hidden = !first; $("lock_btn").textContent = first ? T.create_btn : T.unlock_btn; $("forget").hidden = !first;
    $("pass").value = ""; $("pass2").value = ""; say("lockmsg", "");
    $("lockform").dataset.first = first ? "1" : "0";
  }
  async function submitLock(ev) {
    ev.preventDefault();
    var first = $("lockform").dataset.first === "1", pass = $("pass").value, btn = $("lock_btn");
    if (pass.length < 6) return say("lockmsg", T.pass_short, true);
    if (first && pass !== $("pass2").value) return say("lockmsg", T.pass_mismatch, true);
    busy(btn, true);
    try {
      if (first) {
        var salt = VaultCrypto.rand(16), key = await VaultCrypto.deriveKey(pass, salt), chk = await VaultCrypto.seal(key, te.encode("vault-ok"));
        await tx("meta", "readwrite", function (s) { return s.put({ salt: salt, iter: VaultCrypto.ITER, iv: chk.iv, ct: chk.ct }, "m"); });
        state.key = key;
      } else {
        var m = await getMeta(), k = await VaultCrypto.deriveKey(pass, m.salt, m.iter), ok = false;
        try { ok = new TextDecoder().decode(await VaultCrypto.open(k, m.iv, m.ct)) === "vault-ok"; } catch (e) { ok = false; }
        if (!ok) { state.fails++; await new Promise(function (r) { setTimeout(r, Math.min(state.fails, 8) * 1000); }); say("lockmsg", T.wrong, true); busy(btn, false); return; }
        state.key = k; state.fails = 0;
      }
      $("pass").value = ""; $("pass2").value = ""; await enter();
    } catch (e) { say("lockmsg", T.unsupported, true); }
    busy(btn, false);
  }
  async function enter() { show("home"); armIdle(); await renderDocs(); await renderHealthForm(); tab("docs"); }
  function lock() {
    state.key = null; state.urls.forEach(function (u) { URL.revokeObjectURL(u); }); state.urls = [];
    clear($("doclist")); clear($("viewer")); $("viewer").hidden = true; clear($("healthform")); clear($("cardbox")); $("cardwrap").hidden = true; document.body.classList.remove("full");
    if (state.db) getMeta().then(function (m) { showLock(!m); }); else showLock(false);
  }
  function armIdle() { clearTimeout(state.timer); state.timer = setTimeout(lock, IDLE_MS); }
  ["click", "keydown", "touchstart", "input"].forEach(function (e) { document.addEventListener(e, function () { if (state.key) armIdle(); }, true); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) state.hiddenAt = Date.now(); else if (state.key && state.hiddenAt && Date.now() - state.hiddenAt > 120000) lock(); });
  window.addEventListener("pagehide", function () { state.key = null; });

  // ---- tabs
  function tab(name) { ["docs", "health"].forEach(function (n) { $("pane_" + n).hidden = n !== name; $("tab_" + n).setAttribute("aria-selected", n === name ? "true" : "false"); }); }

  // ---- documents
  var TYPES = ["passport", "evoa", "insurance", "booking", "ticket", "other"];
  async function decryptItems() {
    var rows = await allItems(), out = [];
    for (var i = 0; i < rows.length; i++) { if (rows[i].kind !== "doc") continue; try { out.push({ row: rows[i], meta: await VaultCrypto.openJson(state.key, rows[i].iv, rows[i].ct) }); } catch (e) { /* a record that cannot be opened is skipped */ } }
    out.sort(function (a, b) { return (b.meta.created || 0) - (a.meta.created || 0); });
    return out;
  }
  async function renderDocs() {
    var list = $("doclist"); clear(list); var items = await decryptItems();
    if (!items.length) list.appendChild(el("li", { class: "muted", text: T.empty }));
    items.forEach(function (it) {
      var b = el("button", { type: "button", class: "row" }, [el("b", { text: it.meta.title }), el("span", { class: "muted", text: (T["type_" + it.meta.type] || "") + (it.meta.created ? " · " + new Date(it.meta.created).toLocaleDateString() : "") })]);
      b.addEventListener("click", function () { viewItem(it); });
      list.appendChild(el("li", null, [b]));
    });
    $("doccount").dataset.n = String(items.length);
  }
  async function viewItem(it) {
    var v = $("viewer"); clear(v); v.hidden = false;
    var close = el("button", { type: "button", class: "ghost", text: T.close }), del = el("button", { type: "button", class: "danger", text: T.del });
    close.addEventListener("click", function () { v.hidden = true; clear(v); });
    del.addEventListener("click", async function () { if (!confirm(T.del_confirm)) return; await delItem(it.row.id); v.hidden = true; clear(v); await renderDocs(); });
    v.appendChild(el("h3", { text: it.meta.title })); v.appendChild(el("p", { class: "muted", text: T["type_" + it.meta.type] || "" }));
    if (it.meta.note) v.appendChild(el("p", { class: "note", text: it.meta.note }));
    if (it.row.bct) {
      var bytes = await VaultCrypto.open(state.key, it.row.biv, it.row.bct), blob = new Blob([bytes], { type: it.meta.mime || "application/octet-stream" }), url = URL.createObjectURL(blob); state.urls.push(url);
      if ((it.meta.mime || "").indexOf("image/") === 0) v.appendChild(el("img", { src: url, alt: it.meta.title, class: "pic" }));
      var dl = el("a", { href: url, download: it.meta.fname || "document", class: "btn", text: T.download });
      v.appendChild(el("p", null, [dl]));
      if (it.meta.mime === "application/pdf") v.appendChild(el("p", null, [el("a", { href: url, target: "_blank", rel: "noopener", class: "btn", text: T.open })]));
    }
    v.appendChild(el("p", { class: "actions" }, [close, del])); v.scrollIntoView({ block: "start" });
  }
  async function shrink(file) {
    var bmp; try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { bmp = await createImageBitmap(file); }
    var k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
    return await new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error("jpeg")); }, "image/jpeg", 0.85); });
  }
  async function addDoc(ev) {
    ev.preventDefault();
    var btn = $("doc_btn"), title = $("doc_title").value.trim(), type = $("doc_type").value, note = $("doc_note").value.trim(), file = $("doc_file").files[0];
    if (!title) return say("docmsg", T.need_title, true);
    if (Number($("doccount").dataset.n || 0) >= MAX_ITEMS) return say("docmsg", T.too_many, true);
    busy(btn, true); say("docmsg", "");
    try {
      var blob = null, mime = null, fname = null;
      if (file) {
        if (file.type === "application/pdf") { blob = file; mime = file.type; fname = file.name || "document.pdf"; }
        else if (file.type.indexOf("image/") === 0) { try { blob = await shrink(file); } catch (e) { busy(btn, false); return say("docmsg", T.bad_type, true); } mime = "image/jpeg"; fname = (title.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 30) || "photo") + ".jpg"; }
        else { busy(btn, false); return say("docmsg", T.bad_type, true); }
        if (blob.size > MAX_FILE) { busy(btn, false); return say("docmsg", T.too_big, true); }
      }
      var created = Date.now(), m = await VaultCrypto.sealJson(state.key, { title: title.slice(0, 80), type: TYPES.indexOf(type) >= 0 ? type : "other", note: note.slice(0, 1000), mime: mime, fname: fname, created: created });
      var b = blob ? await VaultCrypto.seal(state.key, new Uint8Array(await blob.arrayBuffer())) : null;
      await putItem({ id: "d" + created + "-" + Math.floor(Math.random() * 1e6), kind: "doc", iv: m.iv, ct: m.ct, biv: b && b.iv, bct: b && b.ct, created: created });
      $("docform").reset(); say("docmsg", T.saved); await renderDocs();
    } catch (e) { say("docmsg", T.unsupported, true); }
    busy(btn, false);
  }

  // ---- health card
  function cleanText(v, n) { return String(v || "").replace(/\s+/g, " ").trim().slice(0, n); }
  function checks(name, opts, picked) {
    return el("div", { class: "checks" }, opts.map(function (o) {
      var cb = el("input", { type: "checkbox", name: name, value: o.id }); if (picked.indexOf(o.id) >= 0) cb.checked = true;
      return el("label", { class: "check" }, [cb, el("span", { text: o.en + " — " + o.th })]);
    }));
  }
  function field(id, label, value, attrs) { return el("label", { class: "fld" }, [el("span", { text: label }), el("input", Object.assign({ id: id, type: "text", value: value || "", autocomplete: "off" }, attrs || {}))]); }
  async function loadHealth() {
    var row = await tx("items", "readonly", function (s) { return s.get("health"); });
    if (!row) return null; try { return await VaultCrypto.openJson(state.key, row.iv, row.ct); } catch (e) { return null; }
  }
  async function renderHealthForm() {
    var d = (await loadHealth()) || { contacts: [{}, {}], allergies: [], conditions: [] }, f = $("healthform"); clear(f);
    var blood = el("select", { id: "h_blood" }, [el("option", { value: "", text: "—" })].concat(H.blood.map(function (o) { return el("option", { value: o.id, text: o.en + " / " + o.th }); }))); blood.value = d.blood || "";
    f.appendChild(el("p", { class: "muted", text: T.health_hint }));
    f.appendChild(field("h_name", T.h_name, d.name, { maxlength: 80 })); f.appendChild(field("h_dob", T.h_dob, d.dob, { type: "date" }));
    f.appendChild(el("label", { class: "fld" }, [el("span", { text: T.h_blood }), blood]));
    f.appendChild(el("fieldset", null, [el("legend", { text: T.h_allergies }), checks("h_allergies", H.allergies, d.allergies || []), field("h_allergy_other", T.h_other, d.allergyOther, { maxlength: 200 })]));
    f.appendChild(el("fieldset", null, [el("legend", { text: T.h_conditions }), checks("h_conditions", H.conditions, d.conditions || []), field("h_condition_other", T.h_other, d.conditionOther, { maxlength: 200 })]));
    f.appendChild(field("h_meds", T.h_meds, d.meds, { maxlength: 400 }));
    for (var i = 0; i < 2; i++) { var c = (d.contacts || [])[i] || {}; f.appendChild(el("fieldset", null, [el("legend", { text: T.h_contact + " " + (i + 1) }), field("h_c" + i + "_name", T.h_c_name, c.name, { maxlength: 60 }), field("h_c" + i + "_phone", T.h_c_phone, c.phone, { type: "tel", maxlength: 30 }), field("h_c" + i + "_rel", T.h_c_rel, c.rel, { maxlength: 40 })])); }
    f.appendChild(el("fieldset", null, [el("legend", { text: T.h_insurer }), field("h_insurer", T.h_insurer, d.insurer, { maxlength: 80 }), field("h_policy", T.h_policy, d.policy, { maxlength: 60 }), field("h_ins_phone", T.h_ins_phone, d.insurerPhone, { type: "tel", maxlength: 30 })]));
    var save = el("button", { type: "submit", id: "health_btn", class: "primary", text: T.save }), showb = el("button", { type: "button", class: "ghost", text: T.show_card });
    showb.addEventListener("click", async function () { var cur = await loadHealth(); if (cur) showCard(cur); else say("healthmsg", T.empty, true); });
    f.appendChild(el("p", { class: "actions" }, [save, showb])); f.appendChild(el("p", { id: "healthmsg", class: "msg", role: "status" }));
  }
  function picked(name) { return Array.prototype.map.call(document.querySelectorAll("input[name=" + name + "]:checked"), function (x) { return x.value; }); }
  function phone(v) { return cleanText(v, 30).replace(/[^0-9+() -]/g, ""); }
  async function saveHealth(ev) {
    ev.preventDefault(); var btn = $("health_btn"); busy(btn, true);
    try {
      var g = function (id) { return $(id) ? $(id).value : ""; };
      var d = { name: cleanText(g("h_name"), 80), dob: /^\d{4}-\d{2}-\d{2}$/.test(g("h_dob")) ? g("h_dob") : "", blood: g("h_blood"), allergies: picked("h_allergies"), allergyOther: cleanText(g("h_allergy_other"), 200), conditions: picked("h_conditions"), conditionOther: cleanText(g("h_condition_other"), 200), meds: cleanText(g("h_meds"), 400),
        contacts: [0, 1].map(function (i) { return { name: cleanText(g("h_c" + i + "_name"), 60), phone: phone(g("h_c" + i + "_phone")), rel: cleanText(g("h_c" + i + "_rel"), 40) }; }), insurer: cleanText(g("h_insurer"), 80), policy: cleanText(g("h_policy"), 60), insurerPhone: phone(g("h_ins_phone")) };
      var m = await VaultCrypto.sealJson(state.key, d); await putItem({ id: "health", kind: "health", iv: m.iv, ct: m.ct, created: Date.now() });
      say("healthmsg", T.saved); showCard(d);
    } catch (e) { say("healthmsg", T.unsupported, true); }
    busy(btn, false);
  }
  function bi(pair) { return el("span", { class: "bi" }, [el("b", { text: pair[0] }), el("span", { text: pair[1], lang: "th" })]); }
  function nameOf(opts, id) { for (var i = 0; i < opts.length; i++) if (opts[i].id === id) return opts[i]; return null; }
  function section(pair, lines) { var ul = el("ul", null, lines.length ? lines : [el("li", { class: "muted", text: L.none[0] + " / " + L.none[1] })]); return el("section", { class: "csec" }, [el("h4", null, [bi(pair)]), ul]); }
  function line(en, th) { return el("li", null, [el("b", { text: en }), th ? el("span", { class: "th", text: th, lang: "th" }) : null]); }
  function showCard(d) {
    var box = $("cardbox"); clear(box);
    box.appendChild(el("h3", null, [bi(L.title)]));
    if (d.name || d.dob) box.appendChild(el("p", { class: "who" }, [el("b", { text: d.name || "" }), d.dob ? el("span", { text: "  " + L.dob[0] + " / " + L.dob[1] + ": " + d.dob }) : null]));
    var b = nameOf(H.blood, d.blood); box.appendChild(section(L.blood, b ? [line(b.en, b.th)] : []));
    var al = (d.allergies || []).map(function (id) { var o = nameOf(H.allergies, id); return o ? line(o.en, o.th) : null; }).filter(Boolean); if (d.allergyOther) al.push(line(d.allergyOther, "")); box.appendChild(section(L.allergies, al));
    var co = (d.conditions || []).map(function (id) { var o = nameOf(H.conditions, id); return o ? line(o.en, o.th) : null; }).filter(Boolean); if (d.conditionOther) co.push(line(d.conditionOther, "")); box.appendChild(section(L.conditions, co));
    box.appendChild(section(L.meds, d.meds ? [line(d.meds, "")] : []));
    var cs = (d.contacts || []).filter(function (c) { return c.name || c.phone; }).map(function (c) { var li = el("li", null, [el("b", { text: c.name || "" }), c.rel ? el("span", { text: " (" + c.rel + ")" }) : null, c.phone ? el("a", { href: "tel:" + c.phone.replace(/[^0-9+]/g, ""), class: "tel", text: " " + c.phone }) : null]); return li; });
    box.appendChild(section(L.contacts, cs));
    var ins = []; if (d.insurer) ins.push(line(d.insurer, "")); if (d.policy) ins.push(line(L.policy[0] + " / " + L.policy[1] + ": " + d.policy, "")); if (d.insurerPhone) ins.push(el("li", null, [el("b", { text: L.phone[0] + " / " + L.phone[1] + ":" }), el("a", { href: "tel:" + d.insurerPhone.replace(/[^0-9+]/g, ""), class: "tel", text: " " + d.insurerPhone })]));
    box.appendChild(section(L.insurance, ins));
    box.appendChild(el("p", { class: "ask" }, [bi(L.ask)])); box.appendChild(el("p", { class: "muted" }, [bi(L.note)]));
    $("cardwrap").hidden = false; document.body.classList.add("full"); $("cardwrap").scrollTop = 0;
  }

  // ---- other
  function eraseAll() {
    if (!confirm(T.erase_confirm)) return;
    state.key = null; if (state.db) state.db.close();
    var r = indexedDB.deleteDatabase("evoa-vault"); var done = function () { start().then(function () { say("lockmsg", T.erased); }); };
    r.onsuccess = done; r.onerror = done; r.onblocked = done;
  }
  $("lockform").addEventListener("submit", submitLock); $("lock_btn2").addEventListener("click", lock);
  $("docform").addEventListener("submit", addDoc); $("healthform").addEventListener("submit", saveHealth);
  $("tab_docs").addEventListener("click", function () { tab("docs"); }); $("tab_health").addEventListener("click", function () { tab("health"); });
  $("cardclose").addEventListener("click", function () { $("cardwrap").hidden = true; document.body.classList.remove("full"); });
  $("erase").addEventListener("click", eraseAll); $("erase2").addEventListener("click", eraseAll);
  start();
})();
`;
