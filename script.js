(() => {
  "use strict";

  /* ===== Utilidades ===== */
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const escapeHtml = (s="") => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const slug = (s="guion-musicala") => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");

  const STORAGE_KEY = "musicala:guion:v1";
  const OPTIONAL_IDS = new Set(["broll","cue","note"]);

  const labelMap = {
    hook: "1. Gancho (3–5 s)",
    demo_intro: "2. Desarrollo – Introducción (5–10 s)",
    demo_p1: "3. Desarrollo – Paso 1 (10–20 s)",
    demo_p2: "4. Desarrollo – Paso 2 (10–20 s)",
    demo_p3: "5. Desarrollo – Paso 3 (10–20 s)",
    close: "6. Cierre / Llamado a la acción (5–10 s)",
    broll: "7. Tomas de apoyo (B-roll) – opcional",
    cue: "8. Cues de audio/visual – opcional",
    note: "9. Nota de dirección – opcional"
  };
  const shortLabelMap = {
    hook:"1. Gancho",
    demo_intro:"2. Desarrollo – Intro",
    demo_p1:"3. Desarrollo – Paso 1",
    demo_p2:"4. Desarrollo – Paso 2",
    demo_p3:"5. Desarrollo – Paso 3",
    close:"6. Cierre / CTA",
    broll:"7. Tomas de apoyo (B-roll) – opcional",
    cue:"8. Cues de audio/visual – opcional",
    note:"9. Nota de dirección – opcional"
  };
  const guideMap = {
    hook: "Di en una frase qué problema resuelves o el beneficio principal. Ej: “¿Te cansas al cantar? Esta postura te libera el cuello en 30 s”.",
    demo_intro: "En 1–2 oraciones, explica qué vas a mostrar y qué necesita la persona (material/es, posición, app, etc.).",
    demo_p1: "Paso 1: escribe acciones claras (verbo al inicio). Ej: “Coloca los pies al ancho de caderas y suelta hombros”.",
    demo_p2: "Paso 2: agrega detalle o ejemplo corto. Evita párrafos largos.",
    demo_p3: "Paso 3: cierra el ejercicio o muestra el resultado esperado.",
    close: "Cierra con resultado + CTA. Ej: “Prueba 3 veces seguidas. Si mejoró, guarda este video y compártelo”.",
    broll: "Lista de tomas de apoyo (separadas por coma). Ej: manos, perfil, respiración lateral, texto ‘Postura neutra’.",
    cue: "Sonidos o rótulos puntuales. Ej: beep suave al pasar de paso; overlay ‘Paso 2’ en pantalla.",
    note: "Instrucciones para edición o rodaje. Ej: cortar silencios, evitar contra picado, subtítulos grandes."
  };

  /* ===== Estado fijo ===== */
  const docState = {
    title: "",
    kind: "short",
    goal: "",
    targetSeconds: 60,
    cta: "Si te sirvió, guárdalo y compártelo.",
    blocks: [
      { id:"hook",      seconds:5,  text:"" },
      { id:"demo_intro",seconds:8,  text:"" },
      { id:"demo_p1",   seconds:12, text:"" },
      { id:"demo_p2",   seconds:12, text:"" },
      { id:"demo_p3",   seconds:12, text:"" },
      { id:"close",     seconds:8,  text:"" },
      { id:"broll",     seconds:0,  text:"" },
      { id:"cue",       seconds:0,  text:"" },
      { id:"note",      seconds:0,  text:"" }
    ]
  };

  /* ===== Refs DOM ===== */
  const el = {
    btnPrint: $("#btnPrint"),
    totalSeconds: $("#totalSeconds"),
    deltaSeconds: $("#deltaSeconds"),
    titleInput: $("#titleInput"),
    kindSelect: $("#kindSelect"),
    targetInput: $("#targetInput"),
    goalInput: $("#goalInput"),
    blocksList: $("#blocksList"),
    totalSecondsBadge: $("#totalSecondsBadge"),
    deltaSecondsBadge: $("#deltaSecondsBadge"),
    ctaInput: $("#ctaInput"),
    validationList: $("#validationList"),
    tabButtons: $$(".tab"),
    panels: { tele: $("#tab-tele"), md: $("#tab-md"), check: $("#tab-check") },
    teleFont: $("#teleFont"), teleLine: $("#teleLine"), teleAuto: $("#teleAuto"),
    teleSpeed: $("#teleSpeed"), teleToggle: $("#teleToggle"), teleReset: $("#teleReset"),
    teleViewport: $("#teleViewport"), teleContent: $("#teleContent"),
    mdOutput: $("#mdOutput"),
    printDoc: $("#printDoc")
  };

  /* ===== Autosave ===== */
  let saveTimer = null;
  function scheduleSave(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(docState)); }catch(e){}
    }, 300);
  }
  function tryRestore(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const data = JSON.parse(raw);
      if(typeof data.title === "string") docState.title = data.title;
      if(typeof data.kind === "string") docState.kind = data.kind;
      if(typeof data.goal === "string") docState.goal = data.goal;
      if(typeof data.targetSeconds === "number") docState.targetSeconds = data.targetSeconds;
      if(typeof data.cta === "string") docState.cta = data.cta;
      const map = new Map((data.blocks||[]).map(b=>[b.id,b]));
      docState.blocks.forEach(b=>{
        const s = map.get(b.id);
        if(s){ b.text = s.text ?? b.text; b.seconds = typeof s.seconds==="number" ? s.seconds : b.seconds; }
      });
    }catch(e){}
  }

  /* ===== Render bloques (estructura fija) ===== */
  function renderBlocks(){
    el.blocksList.innerHTML = "";
    docState.blocks.forEach(b=>{
      const art = document.createElement("article");
      art.className = "block";

      const head = document.createElement("div");
      head.className = "block-head";
      const h = document.createElement("div");
      h.className = "block-title";
      h.textContent = labelMap[b.id] || b.id;
      head.appendChild(h);

      const grid = document.createElement("div");
      grid.className = "grid grid-4";

      // Texto
      const f1 = document.createElement("label");
      f1.className = "field";
      f1.innerHTML = `<span>Texto</span>`;
      const ta = document.createElement("textarea");
      ta.className = "block-text";
      ta.placeholder = guideMap[b.id] || "";
      ta.value = b.text;
      ta.addEventListener("input", ()=>{
        b.text = ta.value;
        updateAll({skipBlocks:true});
      });
      f1.appendChild(ta);
      grid.appendChild(f1);

      // Segundos (siempre manuales)
      const f2 = document.createElement("label");
      f2.className = "field";
      f2.innerHTML = `<span>Segundos (aprox.)</span>`;
      const sec = document.createElement("input");
      sec.type = "number"; sec.min = "0"; sec.max = "600";
      sec.value = Number(b.seconds||0);
      sec.addEventListener("input", ()=>{
        b.seconds = clamp(Number(sec.value||0),0,600);
        updateAll({skipBlocks:true});
      });
      f2.appendChild(sec);
      grid.appendChild(f2);

      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent =
        (b.id==="hook") ? "Objetivo: captar atención rápido."
      : (b.id.startsWith("demo_")) ? "Objetivo: mostrar el ‘cómo’ con acciones simples."
      : (b.id==="close") ? "Objetivo: cerrar con beneficio y llamada a la acción."
      : (b.id==="broll") ? "Opcional: tomas de apoyo para edición."
      : (b.id==="cue") ? "Opcional: sonidos o rótulos para marcar momentos."
      : "Opcional: instrucciones para rodaje/edición.";

      art.append(head, grid, hint);
      el.blocksList.appendChild(art);
    });
  }

  /* ===== Validación ===== */
  function totalSeconds(){
    return docState.blocks.reduce((a,b)=>a+Number(b.seconds||0),0);
  }
  function validate(){
    const hasHook  = (docState.blocks.find(b=>b.id==="hook")?.text||"").trim().length>0;
    const pasos    = ["demo_p1","demo_p2","demo_p3"].some(id => (docState.blocks.find(b=>b.id===id)?.text||"").trim().length>0);
    const hasClose = (docState.blocks.find(b=>b.id==="close")?.text||"").trim().length>0;
    const delta = Number(docState.targetSeconds||0) - totalSeconds();

    const issues = [];
    if(!hasHook) issues.push("Falta el Gancho (3–5 s).");
    if(!pasos)   issues.push("Escribe al menos un Paso (1/2/3) en Desarrollo.");
    if(!hasClose)issues.push("Falta el Cierre/CTA (5–10 s).");
    if(Math.abs(delta)>5) issues.push(`Ajusta la duración (Δ ${delta}s).`);
    return {ok:issues.length===0, issues, delta};
  }
  function renderValidation(){
    const v = validate();
    el.validationList.innerHTML = "";
    if(v.ok){
      const li = document.createElement("li");
      li.textContent = "Todo listo. Estructura mínima completa.";
      el.validationList.appendChild(li);
      el.validationList.style.color = "#10b981";
    }else{
      v.issues.forEach(m=>{
        const li = document.createElement("li"); li.textContent = m; el.validationList.appendChild(li);
      });
      el.validationList.style.color = "";
    }
    const delta = v.delta;
    const color = delta === 0 ? "#10b981" : (delta > 0 ? "#0C41C4" : "#CE0071");
    el.deltaSeconds.style.color = color;
    el.deltaSecondsBadge.style.color = color;
  }
  function renderTimeBadges(){
    const tot = totalSeconds();
    const delta = Number(docState.targetSeconds||0) - tot;
    el.totalSeconds.textContent = `${tot}s`;
    el.deltaSeconds.textContent = `${delta}s`;
    el.totalSecondsBadge.textContent = `${tot}s`;
    el.deltaSecondsBadge.textContent = `${delta}s`;
  }

  /* ===== Teleprompter ===== */
  let teleRunning=false, rafId=null, lastTs=0, teleMirror=false;
  function renderTele(){
    $("#teleContent").style.fontSize = clamp(Number(el.teleFont.value||42),18,96)+"px";
    $("#teleContent").style.lineHeight = clamp(Number(el.teleLine.value||1.4),1,2);

    const parts = [];
    parts.push(`<h2>${escapeHtml(docState.title || "Guion sin título")}</h2>`);
    docState.blocks.forEach(b=>{
      if (OPTIONAL_IDS.has(b.id) && !b.text.trim()) return; // limpiar opcionales vacíos
      const title = labelMap[b.id] || b.id;
      const head = `<div style="color:#9ca3af;font-size:.5em;margin:0 0 6px">${escapeHtml(title)}${b.seconds?` · ${b.seconds}s`:""}</div>`;
      const text = (b.text||"—").split("\n").map(p=>`<p>${escapeHtml(p)}</p>`).join("");
      parts.push(head+text);
    });
    if(docState.cta) parts.push(`<p><em>${escapeHtml(docState.cta)}</em></p>`);
    el.teleContent.innerHTML = parts.join("");

    el.teleContent.style.transform = teleMirror ? "scaleX(-1)" : "none";
  }
  function teleLoop(ts){
    if(!teleRunning) return;
    if(!lastTs) lastTs = ts;
    const dt = ts - lastTs; lastTs = ts;
    if(el.teleAuto.checked){
      const speed = clamp(Number(el.teleSpeed.value||40),10,200);
      el.teleViewport.scrollTop += (speed*dt)/1000;
    }
    rafId = requestAnimationFrame(teleLoop);
  }
  function teleStart(){ if(teleRunning) return; teleRunning=true; lastTs=0; el.teleToggle.textContent="Pausar"; rafId=requestAnimationFrame(teleLoop); }
  function telePause(){ teleRunning=false; el.teleToggle.textContent="Iniciar"; if(rafId) cancelAnimationFrame(rafId); rafId=null; }
  function teleReset(){ telePause(); el.teleViewport.scrollTop=0; }
  document.addEventListener("keydown", (e)=>{
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.code === "Space"){ e.preventDefault(); teleRunning ? telePause() : teleStart(); }
    if (e.key === "ArrowUp"){ e.preventDefault(); el.teleSpeed.value = String(Math.min(200, Number(el.teleSpeed.value||40)+5)); }
    if (e.key === "ArrowDown"){ e.preventDefault(); el.teleSpeed.value = String(Math.max(10, Number(el.teleSpeed.value||40)-5)); }
    if (e.key.toLowerCase() === "m"){ teleMirror = !teleMirror; renderTele(); }
  });

  /* ===== Markdown (visual) ===== */
  function toMarkdown(){
    const L=[];
    L.push(`# ${docState.title || "Guion sin título"}`,"");
    L.push(`Tipo: ${docState.kind}  `);
    L.push(`Objetivo: ${docState.goal || "—"}  `);
    L.push(`Duración objetivo: ${docState.targetSeconds}s`,"");
    docState.blocks.forEach(b=>{
      const title = labelMap[b.id] || b.id;
      L.push(`## ${title}${b.seconds?` (${b.seconds}s)`:""}`,"");
      L.push(b.text || "—",""); 
    });
    L.push("\n---");
    L.push(`CTA base: ${docState.cta || "—"}`);
    return L.join("\n");
  }
  function renderMarkdown(){ el.mdOutput.textContent = toMarkdown(); }

  /* ===== Print: documento limpio (sin membretes) ===== */
  function buildPrintDoc(){
    const metaRows = `
      <tr><th style="width:32%">Título</th><td>${escapeHtml(docState.title || "—")}</td></tr>
      <tr><th>Duración objetivo</th><td>${Number(docState.targetSeconds || 0)} s</td></tr>
      <tr><th>Duración estimada</th><td>${totalSeconds()} s</td></tr>
    `;
    const rows = docState.blocks
      .filter(b => !(OPTIONAL_IDS.has(b.id) && !b.text.trim()))
      .map(b=>`
        <tr>
          <td><strong>${escapeHtml(shortLabelMap[b.id] || b.id)}</strong></td>
          <td>${Number(b.seconds||0)}</td>
          <td>${escapeHtml(b.text||"—").replace(/\n/g,"<br>")}</td>
        </tr>
      `).join("");
    const ctaHtml = docState.cta
      ? `<div class="print-section" style="break-inside:avoid">
           <div class="print-h2">CTA</div>
           <div>${escapeHtml(docState.cta)}</div>
         </div>` : "";

    el.printDoc.innerHTML = `
      <div class="print-wrap">
        <div class="print-head">
          <div class="print-title">${escapeHtml(docState.title || "Guion sin título")}</div>
          <div class="print-meta">Plantilla de Guiones · Musicala</div>
        </div>
        <div class="print-section">
          <div class="print-h2">Resumen</div>
          <table class="print-table">${metaRows}</table>
        </div>
        <div class="print-section">
          <div class="print-h2">Contenido</div>
          <table class="print-table">
            <thead>
              <tr><th style="width:40%">Bloque</th><th style="width:10%">Seg.</th><th>Texto</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${ctaHtml}
      </div>
    `;
  }
  function doPrint(){ buildPrintDoc(); document.title = slug(docState.title||"guion-musicala"); window.print(); document.title="Plantilla de Guiones | Musicala"; }

  /* ===== Ciclo ===== */
  function updateAll(opts={}){
    renderTimeBadges();
    renderValidation();
    renderTele();
    if($("#tab-md").classList.contains("active")) renderMarkdown();
    scheduleSave();
  }

  /* ===== Eventos ===== */
  function wire(){
    el.titleInput.addEventListener("input", ()=>{docState.title=el.titleInput.value; updateAll();});
    el.kindSelect.addEventListener("change", ()=>{docState.kind=el.kindSelect.value; updateAll();});
    el.targetInput.addEventListener("input", ()=>{docState.targetSeconds=clamp(Number(el.targetInput.value||0),10,600); updateAll();});
    el.goalInput.addEventListener("input", ()=>{docState.goal=el.goalInput.value; updateAll();});
    el.ctaInput.addEventListener("input", ()=>{docState.cta=el.ctaInput.value; updateAll();});

    el.tabButtons.forEach(b=>{
      b.addEventListener("click", ()=>{
        el.tabButtons.forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        const tab = b.dataset.tab;
        Object.entries(el.panels).forEach(([k,p])=>p.classList.toggle("active",k===tab));
        if(tab==="md") renderMarkdown();
      });
    });

    el.teleFont.addEventListener("input", renderTele);
    el.teleLine.addEventListener("input", renderTele);
    el.teleToggle.addEventListener("click", ()=>{ if(teleRunning) telePause(); else teleStart(); });
    el.teleReset.addEventListener("click", teleReset);

    el.btnPrint.addEventListener("click", doPrint);
  }

  /* ===== Init ===== */
  function init(){
    tryRestore();
    wire();
    renderBlocks();
    updateAll();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
