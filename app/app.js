(function () {
  "use strict";

  /* ---------- Constantes ---------- */
  const CFG = window.A_MEDIAS_CONFIG || {};
  const PEOPLE = ["elena", "nacho"];
  const NAME = { elena: "Elena", nacho: "Nacho", ...(CFG.people || {}) };
  const OTHER = { elena: "nacho", nacho: "elena" };
  const CLS = { elena: "e", nacho: "n" };
  const INI = { elena: NAME.elena[0].toUpperCase(), nacho: NAME.nacho[0].toUpperCase() };

  const ICONS = {
    super: '<path d="M3 4h2l2.2 10.4a1.5 1.5 0 0 0 1.5 1.1h8.6a1.5 1.5 0 0 0 1.4-1.1L21 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    fuera: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 0-3.5 2.2-3.5 6v4H17"/>',
    ocio: '<path d="M4 8a2 2 0 0 0 0 4 2 2 0 0 1 0 4v2h16v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H4z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>',
    casa: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    transporte: '<rect x="5" y="3.5" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l1.5-3.5M16 21l-1.5-3.5"/><circle cx="8.5" cy="14.3" r=".6" fill="currentColor"/><circle cx="15.5" cy="14.3" r=".6" fill="currentColor"/>',
    otros: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ICONS.otros}</svg>`;
  const CATS = [
    { id: "super", n: "Súper" }, { id: "fuera", n: "Comer fuera" }, { id: "ocio", n: "Ocio" },
    { id: "casa", n: "Casa" }, { id: "transporte", n: "Transporte" }, { id: "otros", n: "Otros" },
  ];
  const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  const money = (c) => eur.format((c || 0) / 100);
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };

  function parseAmount(s) {
    s = String(s || "").trim().replace(/\s|€/g, "");
    if (!s) return NaN;
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(",", ".");
    if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
    const v = Math.round(Number(s) * 100);
    return v > 0 && v < 100000000 ? v : NaN;
  }
  // Fecha elegida (yyyy-mm-dd) -> timestamp: hoy usa la hora actual; otro día conserva la hora original o mediodía
  function tsFromDate(dateStr, keepFrom) {
    const [Y, M, D] = dateStr.split("-").map(Number);
    const now = new Date();
    const d = new Date(Y, M - 1, D);
    if (keepFrom && sameDay(d, keepFrom)) return keepFrom.toISOString();
    if (sameDay(d, now)) return now.toISOString();
    const src = keepFrom || new Date(Y, M - 1, D, 12, 0);
    d.setHours(src.getHours(), src.getMinutes(), 0, 0);
    return d.toISOString();
  }

  /* ---------- Estado ---------- */
  let sb = null;
  let items = [];        // {id, amount, payer, cat, ts(Date)}
  let loaded = false;
  let knownIds = new Set();
  let fWho = "todos", fCat = "todas", view = "movs";
  const month = new Date(); month.setDate(1);
  const add = { payer: null, payerTouched: false, cat: null, date: ymd(new Date()) };

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(text, action, isError) {
    const r = $("toast-root");
    clearTimeout(toastTimer);
    r.innerHTML = "";
    const d = document.createElement("div");
    d.className = "toast";
    d.innerHTML = `<span class="ok${isError ? " err" : ""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${isError ? '<path d="M12 7v6M12 17h.01"/>' : '<path d="m5 12 5 5 9-10"/>'}</svg></span><span></span>`;
    d.children[1].textContent = text;
    if (action) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = action.label;
      b.onclick = () => { r.innerHTML = ""; action.fn(); };
      d.appendChild(b);
    }
    r.appendChild(d);
    toastTimer = setTimeout(() => { r.innerHTML = ""; }, action ? 6000 : 3000);
  }
  const fail = (msg) => (err) => { console.error(err); toast(msg || "No se ha podido guardar. Revisa la conexión.", null, true); };

  /* ---------- Datos ---------- */
  const fromRow = (r) => ({ id: r.id, amount: r.amount_cents, payer: r.payer, cat: r.category, ts: new Date(r.spent_at) });
  const toRow = (x) => ({ amount_cents: x.amount, payer: x.payer, category: x.cat || "otros", spent_at: x.ts });

  async function load() {
    const { data, error } = await sb.from("gastos").select("id,amount_cents,payer,category,spent_at").order("spent_at", { ascending: false });
    if (error) { fail("No se han podido cargar los gastos.")(error); return; }
    const fresh = loaded ? new Set(data.map((r) => r.id).filter((id) => !knownIds.has(id))) : new Set();
    items = data.map(fromRow).filter((x) => NAME[x.payer]);
    knownIds = new Set(items.map((x) => x.id));
    loaded = true;
    renderAll(fresh);
  }
  let reloadTimer;
  const scheduleLoad = () => { clearTimeout(reloadTimer); reloadTimer = setTimeout(load, 150); };

  const api = {
    insert: (x) => sb.from("gastos").insert(x.id ? { id: x.id, ...toRow(x) } : toRow(x)).select("id").single(),
    update: (id, x) => sb.from("gastos").update(toRow(x)).eq("id", id),
    remove: (id) => sb.from("gastos").delete().eq("id", id),
  };
  async function run(p, msg) { const { data, error } = await p; if (error) throw Object.assign(new Error(msg), { cause: error }); return data; }

  /* ---------- Turno ---------- */
  function totals(list) {
    const t = { elena: 0, nacho: 0, elenaN: 0, nachoN: 0 };
    list.forEach((x) => { t[x.payer] += x.amount; t[x.payer + "N"]++; });
    return t;
  }
  function turnInfo() {
    const t = totals(items), diff = t.elena - t.nacho;
    if (!items.length || Math.abs(diff) < 50) return { who: null, t, diff };
    return { who: diff > 0 ? "nacho" : "elena", t, diff };
  }
  function renderTurn(hop) {
    if (!loaded) return;
    const { who, t, diff } = turnInfo();
    $("tl-elena").textContent = money(t.elena); $("tl-nacho").textContent = money(t.nacho);
    const sum = t.elena + t.nacho;
    const tilt = sum ? Math.max(-12, Math.min(12, -(diff / sum) * 24)) : 0;
    $("plank").style.setProperty("--tilt", tilt.toFixed(2) + "deg");
    if (hop) { const s = $("seat-" + hop); s.classList.remove("hop"); void s.offsetWidth; s.classList.add("hop"); }
    const T = $("t-title"), S = $("t-sub"), card = $("turn");
    if (!items.length) {
      card.style.removeProperty("--who");
      T.textContent = "Nadie va por delante";
      S.textContent = "Apuntad el primer gasto y el balancín empezará a moverse.";
    } else if (!who) {
      card.style.removeProperty("--who");
      T.textContent = "Estáis en paz";
      S.innerHTML = "Habéis puesto prácticamente lo mismo. <b>Paga quien quiera.</b>";
    } else {
      card.style.setProperty("--who", `var(--${who})`);
      T.innerHTML = `Le toca a <em>${esc(NAME[who])}</em>`;
      S.innerHTML = `${esc(NAME[OTHER[who]])} va <b class="num">${money(Math.abs(diff))}</b> por delante. Que pague ${esc(NAME[who])} lo siguiente hasta igualar.`;
    }
    if (!add.payerTouched) add.payer = who;
    renderAddForm();
  }

  /* ---------- Campos compartidos (alta y edición) ---------- */
  function renderPayer(box, st, onPick) {
    const { who } = turnInfo();
    box.innerHTML = "";
    PEOPLE.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.p = p; b.id = box.id + "-" + p;
      b.setAttribute("aria-pressed", String(st.payer === p));
      b.innerHTML = `<span class="av ${CLS[p]}">${esc(INI[p])}</span><span>${esc(NAME[p])}</span>${loaded && who === p ? '<span class="tag">Le toca</span>' : ""}`;
      b.onclick = () => onPick(p);
      box.appendChild(b);
    });
  }
  function renderCats(box, sel, onPick, withAll) {
    box.innerHTML = "";
    (withAll ? [{ id: "todas", n: "Todas" }] : []).concat(CATS).forEach((c) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.id = box.id + "-" + c.id;
      b.setAttribute("aria-pressed", String(sel === c.id));
      b.innerHTML = (c.id !== "todas" ? icon(c.id) : "") + esc(c.n);
      b.onclick = () => onPick(c.id);
      box.appendChild(b);
    });
  }
  function shake(el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }

  /* ---------- Formulario de alta ---------- */
  const amountIn = $("add-amount");
  function renderAddForm() {
    renderPayer($("add-payer"), add, (p) => { add.payer = p; add.payerTouched = true; renderAddForm(); });
    renderCats($("add-cats"), add.cat, (id) => { add.cat = add.cat === id ? null : id; renderAddForm(); });
    const dIn = $("add-date");
    dIn.value = add.date; dIn.max = ymd(new Date());
    $("add-today").setAttribute("aria-pressed", String(add.date === ymd(new Date())));
    $("add-yesterday").setAttribute("aria-pressed", String(add.date === ymd(yesterday())));
    $("add-submit").disabled = !(parseAmount(amountIn.value) > 0 && add.payer && add.date);
  }
  amountIn.addEventListener("input", renderAddForm);
  $("add-today").onclick = () => { add.date = ymd(new Date()); renderAddForm(); };
  $("add-yesterday").onclick = () => { add.date = ymd(yesterday()); renderAddForm(); };
  $("add-date").onchange = (e) => { if (e.target.value) { add.date = e.target.value; renderAddForm(); } };
  $("add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseAmount(amountIn.value);
    if (!(amount > 0)) { shake($("add-amount-wrap")); amountIn.focus(); return; }
    if (!add.payer) { shake($("add-payer")); return; }
    const x = { amount, payer: add.payer, cat: add.cat || "otros", ts: tsFromDate(add.date) };
    $("add-submit").disabled = true;
    try {
      const row = await run(api.insert(x));
      amountIn.value = ""; add.cat = null; add.payerTouched = false; add.date = ymd(new Date());
      toast(`${money(amount)} · pagó ${NAME[x.payer]}`, {
        label: "Deshacer",
        fn: () => run(api.remove(row.id)).then(load).catch(fail("No se ha podido deshacer.")),
      });
      await load();
      renderTurn(x.payer);
      amountIn.focus();
    } catch (err) { fail()(err); renderAddForm(); }
  });

  /* ---------- Lista ---------- */
  const dayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const dayYFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
  function dayLabel(d) {
    if (sameDay(d, new Date())) return "Hoy";
    if (sameDay(d, yesterday())) return "Ayer";
    const t = (d.getFullYear() === new Date().getFullYear() ? dayFmt : dayYFmt).format(d);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function emptyHTML(title, text) {
    return `<div class="empty"><div class="dots"><i></i><i></i></div><b>${esc(title)}</b><span>${esc(text)}</span></div>`;
  }
  function renderList(fresh) {
    const segBox = $("f-who");
    if (!segBox.querySelector("button")) {
      [["todos", "Todos"], ["elena", NAME.elena], ["nacho", NAME.nacho]].forEach(([k, n]) => {
        const b = document.createElement("button");
        b.type = "button"; b.id = "fw-" + k; b.dataset.w = k; b.textContent = n;
        b.onclick = () => { fWho = k; renderList(); };
        segBox.appendChild(b);
      });
    }
    ["todos", "elena", "nacho"].forEach((k, i) => {
      $("fw-" + k).setAttribute("aria-pressed", String(fWho === k));
      if (fWho === k) $("f-pill").style.transform = `translateX(${i * 100}%)`;
    });
    renderCats($("f-cat"), fCat, (id) => { fCat = id; renderList(); }, true);

    const box = $("list");
    if (!loaded) {
      box.innerHTML = Array.from({ length: 4 }, () => '<div class="sk-row"><span class="sk" style="width:42px;height:42px;border-radius:13px"></span><span style="display:flex;flex-direction:column;gap:6px"><span class="sk" style="width:45%;height:12px"></span><span class="sk" style="width:30%;height:10px"></span></span><span class="sk" style="height:14px"></span></div>').join("");
      $("f-meta").textContent = "";
      return;
    }
    const l = items.filter((x) => (fWho === "todos" || x.payer === fWho) && (fCat === "todas" || x.cat === fCat));
    $("f-meta").innerHTML = items.length ? `<b>${l.length}</b> ${l.length === 1 ? "gasto" : "gastos"} · <b>${money(l.reduce((s, x) => s + x.amount, 0))}</b>` : "";
    box.innerHTML = "";
    if (!l.length) {
      box.innerHTML = items.length
        ? emptyHTML("Nada con este filtro", "Prueba con otra persona o categoría.")
        : emptyHTML("Aún no hay gastos", "Apunta el primero en el formulario. El balancín hará el resto.");
      return;
    }
    const dayTotals = {};
    l.forEach((x) => { const k = ymd(x.ts); dayTotals[k] = (dayTotals[k] || 0) + x.amount; });
    let last = "";
    l.forEach((x) => {
      const k = ymd(x.ts);
      if (k !== last) {
        last = k;
        const h = document.createElement("div");
        h.className = "day num";
        h.innerHTML = `<span>${esc(dayLabel(x.ts))}</span><span>${money(dayTotals[k])}</span>`;
        box.appendChild(h);
      }
      const c = CAT[x.cat] || CAT.otros;
      const b = document.createElement("button");
      b.type = "button"; b.className = "row" + (fresh && fresh.has(x.id) ? " new" : "");
      b.setAttribute("aria-label", `${c.n}, ${money(x.amount)}, pagó ${NAME[x.payer]}. Editar`);
      b.innerHTML = `<span class="tile">${icon(c.id)}<span class="av xs ${CLS[x.payer]}">${esc(INI[x.payer])}</span></span>
        <span class="t"><b>${esc(c.n)}</b><small>Pagó ${esc(NAME[x.payer])} · ${timeFmt.format(x.ts)}</small></span>
        <span class="a num">${money(x.amount)}</span>
        <span class="edit" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg></span>`;
      b.onclick = () => openEdit(x);
      box.appendChild(b);
    });
  }

  /* ---------- Resumen ---------- */
  const mFmt = new Intl.DateTimeFormat("es-ES", { month: "long" });
  const mYFmt = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
  function renderRes() {
    const now = new Date(), y = month.getFullYear(), m = month.getMonth();
    $("m-title").textContent = (y === now.getFullYear() ? mFmt : mYFmt).format(month);
    $("m-next").disabled = y === now.getFullYear() && m === now.getMonth();
    const l = items.filter((x) => x.ts.getFullYear() === y && x.ts.getMonth() === m);
    const t = totals(l), sum = t.elena + t.nacho;
    $("s-tot").textContent = money(sum);
    $("sp-elena").style.flexGrow = String(t.elena || (sum ? 0 : 1));
    $("sp-nacho").style.flexGrow = String(t.nacho || (sum ? 0 : 1));
    $("s-who").innerHTML = PEOPLE.map((p) => `<div class="who"><span class="av ${CLS[p]}">${esc(INI[p])}</span><div><b>${money(t[p])}</b><small>${t[p + "N"]} ${t[p + "N"] === 1 ? "pago" : "pagos"}</small></div></div>`).join("");
    const note = $("s-note");
    if (!l.length) note.textContent = "Sin gastos este mes.";
    else if (Math.abs(t.elena - t.nacho) < 50) note.innerHTML = "Este mes vais <b>a la par</b>.";
    else {
      const lead = t.elena > t.nacho ? "elena" : "nacho";
      const pct = Math.round((t[lead] / sum) * 100);
      note.innerHTML = `Este mes <b>${esc(NAME[lead])}</b> ha cubierto el <b class="num">${pct} %</b> del gasto, <b class="num">${money(Math.abs(t.elena - t.nacho))}</b> más que ${esc(NAME[OTHER[lead]])}.`;
    }
    const by = {};
    l.forEach((x) => { const k = CAT[x.cat] ? x.cat : "otros"; by[k] = by[k] || { elena: 0, nacho: 0 }; by[k][x.payer] += x.amount; });
    const rows = Object.entries(by).sort((a, b) => (b[1].elena + b[1].nacho) - (a[1].elena + a[1].nacho));
    const box = $("s-cats");
    if (!rows.length) { box.innerHTML = emptyHTML("Sin categorías que mostrar", "Cuando haya gastos este mes verás en qué se os va el dinero."); return; }
    const max = rows[0][1].elena + rows[0][1].nacho;
    box.innerHTML = rows.map(([k, v]) => `<div class="cat"><span class="tile">${icon(k)}</span><div><div class="lab"><span>${esc(CAT[k].n)}</span><span>${money(v.elena + v.nacho)}</span></div><div class="track"><i class="e" style="width:${(v.elena / max) * 100}%"></i><i class="n" style="width:${(v.nacho / max) * 100}%"></i></div></div></div>`).join("");
  }
  $("m-prev").onclick = () => { month.setMonth(month.getMonth() - 1); renderRes(); };
  $("m-next").onclick = () => { month.setMonth(month.getMonth() + 1); renderRes(); };

  /* ---------- Pestañas ---------- */
  function setView(v) {
    view = v;
    $("tab-movs").setAttribute("aria-selected", String(v === "movs"));
    $("tab-res").setAttribute("aria-selected", String(v === "res"));
    $("v-movs").hidden = v !== "movs"; $("v-res").hidden = v !== "res";
    $("tabs-pill").style.transform = v === "res" ? "translateX(100%)" : "none";
  }
  $("tab-movs").onclick = () => setView("movs");
  $("tab-res").onclick = () => setView("res");

  /* ---------- Edición ---------- */
  let modalKeys = null;
  function closeModal() {
    const s = document.querySelector(".scrim");
    if (modalKeys) { document.removeEventListener("keydown", modalKeys); modalKeys = null; }
    if (!s) return;
    s.classList.add("out");
    setTimeout(() => s.remove(), 180);
  }
  function openEdit(x) {
    const st = { payer: x.payer, cat: x.cat, date: ymd(x.ts) };
    const trigger = document.activeElement;
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-labelledby="ed-title" autocomplete="off" novalidate>
      <div class="modal-h"><h2 id="ed-title">Editar gasto</h2><button type="button" class="close" id="ed-close" aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
      <div class="amount" id="ed-amount-wrap"><input id="ed-amount" inputmode="decimal" aria-label="Importe en euros"><span aria-hidden="true">€</span></div>
      <fieldset class="group"><legend>Pagado por</legend><div class="payer" id="ed-payer"></div></fieldset>
      <fieldset class="group"><legend>Categoría</legend><div class="chips" id="ed-cats"></div></fieldset>
      <fieldset class="group"><legend>Fecha</legend><div class="when"><input type="date" id="ed-date" class="date" aria-label="Fecha del gasto"></div></fieldset>
      <div class="modal-actions"><button type="button" class="btn-danger" id="ed-del">Borrar</button><button class="btn-primary" type="submit" id="ed-save">Guardar cambios</button></div>
    </form>`;
    $("layer").appendChild(scrim);
    const q = (s) => scrim.querySelector(s);
    const amt = q("#ed-amount"), dIn = q("#ed-date");
    amt.value = (x.amount / 100).toFixed(2).replace(".", ",");
    dIn.value = st.date; dIn.max = ymd(new Date());
    const paint = () => {
      renderPayer(q("#ed-payer"), st, (p) => { st.payer = p; paint(); });
      renderCats(q("#ed-cats"), st.cat, (id) => { st.cat = id; paint(); });
      q("#ed-save").disabled = !(parseAmount(amt.value) > 0 && dIn.value);
    };
    amt.addEventListener("input", paint);
    dIn.addEventListener("change", paint);
    const close = () => { closeModal(); if (trigger && trigger.focus) trigger.focus(); };
    q("#ed-close").onclick = close;
    scrim.addEventListener("mousedown", (e) => { if (e.target === scrim) close(); });
    modalKeys = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") { // mantener el foco dentro del diálogo
        const f = [...scrim.querySelectorAll("button:not(:disabled),input")];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
      }
    };
    document.addEventListener("keydown", modalKeys);
    const before = { amount: x.amount, payer: x.payer, cat: x.cat, ts: x.ts.toISOString() };
    q("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const amount = parseAmount(amt.value);
      if (!(amount > 0)) { shake(q("#ed-amount-wrap")); return; }
      const next = { amount, payer: st.payer, cat: st.cat, ts: tsFromDate(dIn.value, x.ts) };
      q("#ed-save").disabled = true;
      try {
        await run(api.update(x.id, next));
        close();
        toast("Cambios guardados", { label: "Deshacer", fn: () => run(api.update(x.id, before)).then(load).catch(fail("No se ha podido deshacer.")) });
        load();
      } catch (err) { fail()(err); paint(); }
    });
    q("#ed-del").onclick = async () => {
      try {
        await run(api.remove(x.id));
        close();
        toast(`Gasto de ${money(x.amount)} borrado`, { label: "Deshacer", fn: () => run(api.insert({ id: x.id, ...before })).then(load).catch(fail("No se ha podido recuperar.")) });
        load();
      } catch (err) { fail("No se ha podido borrar.")(err); }
    };
    paint();
    setTimeout(() => { amt.focus(); amt.select(); }, 30);
  }

  /* ---------- Atajos ---------- */
  document.addEventListener("keydown", (e) => {
    if (document.querySelector(".scrim") || $("app").hidden) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "n" || e.key === "N") { e.preventDefault(); amountIn.focus(); amountIn.select(); }
  });

  function renderAll(fresh) { renderTurn(); renderList(fresh); renderRes(); }

  /* ---------- Acceso ---------- */
  function showGate() {
    $("app").hidden = true; $("setup").hidden = true; $("gate").hidden = false;
    $("gate-form-wrap").hidden = false; $("gate-sent").hidden = true; $("gate-denied").hidden = true;
    setTimeout(() => $("gate-email").focus(), 30);
  }
  $("gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("gate-email").value.trim();
    const err = $("gate-error");
    err.hidden = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = "Escribe un email válido."; err.hidden = false; return; }
    const btn = $("gate-submit");
    btn.disabled = true; btn.textContent = "Enviando…";
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true },
    });
    btn.disabled = false; btn.textContent = "Enviarme el enlace";
    if (error) {
      err.textContent = /rate|seconds/i.test(error.message || "")
          ? "Has pedido varios enlaces seguidos. Espera un minuto y vuelve a probar."
          : "No se ha podido enviar el enlace. Prueba de nuevo.";
      err.hidden = false;
      return;
    }
    $("gate-sent-email").textContent = email;
    $("gate-form-wrap").hidden = true; $("gate-sent").hidden = false;
  });
  $("gate-back").onclick = showGate;
  $("gate-denied-out").onclick = async () => { await sb.auth.signOut(); };
  $("sign-out").onclick = async () => { await sb.auth.signOut(); };

  let channel = null;
  async function startApp(session) {
    // Solo los emails de la lista de miembros pueden usar la app
    const { data: ok, error } = await sb.rpc("es_miembro");
    if (error || ok !== true) {
      $("app").hidden = true; $("setup").hidden = true; $("gate").hidden = false;
      $("gate-form-wrap").hidden = true; $("gate-sent").hidden = true; $("gate-denied").hidden = false;
      $("gate-denied-email").textContent = session.user.email || "";
      return;
    }
    $("gate-denied").hidden = true;
    $("gate").hidden = true; $("setup").hidden = true; $("app").hidden = false;
    $("account-email").textContent = session.user.email || "";
    $("tl-elena-l").textContent = `${NAME.elena} ha pagado`;
    $("tl-nacho-l").textContent = `${NAME.nacho} ha pagado`;
    $("seat-elena").textContent = INI.elena; $("seat-nacho").textContent = INI.nacho;
    renderAll();
    load();
    if (!channel) {
      channel = sb.channel("gastos-cambios")
        .on("postgres_changes", { event: "*", schema: "public", table: "gastos" }, scheduleLoad)
        .subscribe();
    }
  }
  function stopApp() {
    if (channel) { sb.removeChannel(channel); channel = null; }
    items = []; loaded = false; knownIds = new Set();
    showGate();
  }

  /* ---------- Arranque ---------- */
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) {
    $("setup").hidden = false;
    return;
  }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  let started = false;
  sb.auth.onAuthStateChange((_evt, session) => {
    if (session && !started) { started = true; startApp(session); }
    else if (!session && started) { started = false; stopApp(); }
  });
  sb.auth.getSession().then(({ data }) => {
    if (data.session) { if (!started) { started = true; startApp(data.session); } }
    else if (!started) showGate();
  });
  // Recargar al volver a la pestaña por si el tiempo real se cortó
  document.addEventListener("visibilitychange", () => { if (!document.hidden && started) scheduleLoad(); });
})();
