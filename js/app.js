/* app.js — vanilla JS, sem rede, sem innerHTML com dados do usuário.
    Privacidade: nenhum fetch/XHR/WebSocket/analytics. Nenhum dado em URL. Nenhum console.log de dados sensíveis.
    Compatível com file:// (SW falha silenciosamente). CSP: default-src 'self' + connect-src 'none'.
*/
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  let currentExamId = null;
  let currentSection = 0;
  let pendingWipe = null;
  let cachedStates = {};
  let isPinLocked = false;
  let autoLockTimer = null;
  let inactivityTimer = null;

  const views = {
    home: $("#view-home"),
    intro: $("#view-intro"),
    exam: $("#view-exam"),
    conclusion: $("#view-conclusion"),
    prayers: $("#view-prayers"),
    about: $("#view-about")
  };

  function showView(name){
    Object.entries(views).forEach(([k,el])=>{
      if(!el) return;
      const isTarget = k===name;
      el.classList.toggle("hidden", !isTarget);
      el.hidden = !isTarget;
    });
    const target = views[name];
    if(target){ target.focus?.(); window.scrollTo(0,0); }
    updateHomeContinue();
    if(name==="about") updatePinUI();
  }

  function showStorageError(msg){
    let el = $("#storage-error");
    if(!el){
      el = document.createElement("div");
      el.id = "storage-error";
      el.className = "storage-error";
      el.setAttribute("role","alert");
      document.body.appendChild(el);
    }
    el.textContent = msg || "Armazenamento cheio. Apague anotações antigas ou use “Apagar todos os meus dados”. Nenhum dado foi enviado.";
    el.hidden = false;
    clearTimeout(el._tmr);
    el._tmr = setTimeout(()=>{ el.hidden=true; }, 6000);
  }
  function showPinBlockedMessage(){
    showStorageError("Proteção por PIN bloqueada. Desbloqueie em Sobre antes de salvar.");
  }

  function safeSaveProgress(examId, sectionIndex){
    try{ Storage.saveProgress(examId, sectionIndex); }
    catch(e){ if(e && e.name==="QuotaExceededError") showStorageError(); }
  }

  function applyTheme(){
    const prefs = Storage.getPrefs();
    const t = prefs.theme;
    const root = document.documentElement;
    if(t==="dark") root.setAttribute("data-theme","dark");
    else if(t==="light") root.setAttribute("data-theme","light");
    else root.removeAttribute("data-theme");
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta){
      const isDark = t==="dark" || (t==="auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      meta.setAttribute("content", isDark ? "#121418" : "#faf8f5");
    }
  }
  function toggleTheme(){
    const cur = Storage.getPrefs().theme;
    const isDarkPreferred = window.matchMedia("(prefers-color-scheme: dark)").matches;
    let next;
    if(cur==="auto") next = isDarkPreferred ? "light" : "dark";
    else if(cur==="dark") next = "light";
    else next = "dark";
    try{ Storage.savePrefs({theme: next}); }catch(e){ if(e&&e.name==="QuotaExceededError") showStorageError(); }
    applyTheme();
  }

  function getPrayerLang(){ return Storage.getPrefs().prayerLang || "pt"; }
  function setPrayerLang(lang){
    try{ Storage.savePrefs({prayerLang: lang}); }catch(e){ if(e&&e.name==="QuotaExceededError") showStorageError(); }
    renderPrayers();
  }
  function renderPrayers(){
    const lang = getPrayerLang();
    $$(".prayer-tabs .tab").forEach(b=>{
      const isActive = b.dataset.lang===lang;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", String(isActive));
    });
    $$(".prayer-body").forEach(el=>{
      const key = el.dataset.prayer;
      const text = PRAYERS[key] ? PRAYERS[key][lang] : "";
      el.textContent = text;
    });
  }

  function getExam(id){ return EXAM_CONTENT[id] || null; }
  function qKey(sectionId, qIndex){ return sectionId+":"+qIndex; }

  async function loadExamState(examId){
    if(!examId) return {marks:{}, notes:{}};
    const st = await Storage.getStateAsync(examId);
    if(st && st._locked){
      isPinLocked = true;
      cachedStates[examId] = {marks:{}, notes:{}, _locked:true};
      return cachedStates[examId];
    }
    isPinLocked = false;
    cachedStates[examId] = {marks: st.marks||{}, notes: st.notes||{}};
    return cachedStates[examId];
  }
  function getCachedState(examId){
    if(cachedStates[examId]) return cachedStates[examId];
    if(!Storage.isPinEnabled()){
      // leitura síncrona apenas para v1 (sem cifra) — única API síncrona permitida
      try{
        const raw = localStorage.getItem(Storage.PREFIX+"state:"+examId);
        if(!raw) return {marks:{}, notes:{}};
        const outer = JSON.parse(raw);
        if(outer && outer.v === 1 && outer.data) return {marks: outer.data.marks||{}, notes: outer.data.notes||{}};
        if(outer && outer.marks !== undefined) return {marks: outer.marks||{}, notes: outer.notes||{}};
      }catch{}
      return {marks:{}, notes:{}};
    }
    return {marks:{}, notes:{}, _locked:true};
  }
  function getMark(examId, sectionId, qIndex){
    const st = getCachedState(examId);
    if(st._locked) return "none";
    return st.marks[qKey(sectionId,qIndex)] || "none";
  }
  function setMark(examId, sectionId, qIndex, value){
    const st = getCachedState(examId);
    if(st._locked){ showPinBlockedMessage(); return; }
    if(value==="none") delete st.marks[qKey(sectionId,qIndex)];
    else st.marks[qKey(sectionId,qIndex)] = value;
    const p = Storage.saveState(examId, st);
    if(p && typeof p.then === "function"){
      p.then(ok=>{ if(ok===false) showPinBlockedMessage(); }).catch(e=>{ if(e&&e.name==="QuotaExceededError") showStorageError(); else if(e) showPinBlockedMessage(); });
    }
  }
  function getNote(examId, sectionId, qIndex){
    const st = getCachedState(examId);
    if(st._locked) return "";
    return st.notes[qKey(sectionId,qIndex)] || "";
  }
  function setNote(examId, sectionId, qIndex, text){
    const st = getCachedState(examId);
    if(st._locked){ showPinBlockedMessage(); return; }
    const t = (text||"").slice(0,2000);
    if(!t) delete st.notes[qKey(sectionId,qIndex)];
    else st.notes[qKey(sectionId,qIndex)] = t;
    const p = Storage.saveState(examId, st);
    if(p && typeof p.then==="function"){
      p.then(ok=>{ if(ok===false) showPinBlockedMessage(); }).catch(e=>{ if(e && e.name==="QuotaExceededError") showStorageError(); });
    }
  }

  async function renderExam(){
    const exam = getExam(currentExamId);
    if(!exam) return;
    await loadExamState(currentExamId);
    const stLocked = getCachedState(currentExamId)._locked;
    const section = exam.sections[currentSection];
    if(!section) return;

    $("#exam-kicker").textContent = exam.kicker + " · " + exam.label;
    $("#exam-section-title").textContent = section.title;
    $("#exam-section-desc").textContent = section.desc;
    $("#exam-progress").textContent = `${section.title} — ${currentSection+1} de ${exam.sections.length}`;

    const list = $("#sections-list");
    list.textContent = "";
    exam.sections.forEach((sec, idx)=>{
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = sec.title;
      btn.classList.toggle("active", idx===currentSection);
      btn.addEventListener("click", ()=>{
        currentSection = idx;
        safeSaveProgress(currentExamId, currentSection);
        renderExam();
        $("#sections-drawer").classList.add("hidden");
        $("#sections-drawer").hidden = true;
        $("#btn-exam-sections").setAttribute("aria-expanded","false");
      });
      const count = document.createElement("span");
      count.className = "sec-count";
      count.textContent = `${sec.questions.length} perguntas`;
      li.append(btn, count);
      list.appendChild(li);
    });

    const container = $("#exam-questions");
    container.textContent = "";
    if(stLocked){
      const warn = document.createElement("div");
      warn.className = "intro-warn";
      warn.textContent = "Seus dados estão protegidos por PIN. Desbloqueie em “Sobre → Proteção local” para ver e editar suas marcações.";
      container.appendChild(warn);
    }
    const notesEnabled = Storage.notesEnabled();

    section.questions.forEach((q, qIndex)=>{
      const card = document.createElement("div");
      card.className = "q-card";
      const p = document.createElement("p");
      p.className = "q-text";
      p.textContent = q;
      const qId = `q-${section.id}-${qIndex}`;
      p.id = qId;
      const actions = document.createElement("div");
      actions.className = "q-actions";
      actions.setAttribute("role","group");
      actions.setAttribute("aria-labelledby", qId);
      const states = [
        {val:"none", label:"—"},
        {val:"reflect", label:"Para refletir"},
        {val:"confess", label:"Levar à Confissão"}
      ];
      const currentMark = getMark(currentExamId, section.id, qIndex);
      states.forEach(s=>{
        const b = document.createElement("button");
        b.type = "button";
        b.className = "q-btn";
        if(currentMark===s.val) b.classList.add("active");
        b.setAttribute("aria-pressed", String(currentMark===s.val));
        b.dataset.state = s.val;
        b.textContent = s.label;
        b.disabled = !!stLocked;
        b.addEventListener("click", ()=>{
          if(stLocked) return;
          const nextVal = s.val;
          setMark(currentExamId, section.id, qIndex, nextVal);
          $$(".q-btn", actions).forEach(x=>{
            const isActive = x.dataset.state===nextVal;
            x.classList.toggle("active", isActive);
            x.setAttribute("aria-pressed", String(isActive));
          });
          safeSaveProgress(currentExamId, currentSection);
        });
        actions.appendChild(b);
      });
      card.append(p, actions);
      if(notesEnabled && !stLocked){
        const wrap = document.createElement("div");
        wrap.className = "q-note-wrap";
        const label = document.createElement("label");
        label.textContent = "Minha anotação privada (fica só neste dispositivo)";
        const tid = `note-${section.id}-${qIndex}`;
        label.setAttribute("for", tid);
        const ta = document.createElement("textarea");
        ta.className = "q-note";
        ta.id = tid;
        ta.placeholder = "Escreva apenas se desejar lembrar algo para a Confissão...";
        ta.maxLength = 2000;
        ta.setAttribute("autocomplete","off");
        ta.setAttribute("autocorrect","off");
        ta.setAttribute("autocapitalize","off");
        ta.setAttribute("spellcheck","false");
        ta.autocomplete = "off";
        ta.spellcheck = false;
        ta.value = getNote(currentExamId, section.id, qIndex);
        const hint = document.createElement("p");
        hint.className = "q-note-hint";
        hint.textContent = "Esta anotação permanece apenas neste dispositivo. Apague quando quiser.";
        let tmr=null;
        ta.addEventListener("input", ()=>{
          clearTimeout(tmr);
          tmr = setTimeout(()=> setNote(currentExamId, section.id, qIndex, ta.value), 300);
        });
        wrap.append(label, ta, hint);
        card.appendChild(wrap);
      }
      container.appendChild(card);
    });

    $("#btn-prev").disabled = currentSection===0;
    $("#btn-prev").style.opacity = currentSection===0 ? ".4" : "1";
    const isLast = currentSection===exam.sections.length-1;
    $("#btn-next").textContent = isLast ? "Concluir →" : "Próxima →";
    const btnFinish = $("#btn-finish-exam");
    if(btnFinish){
      const showFinish = isLast;
      btnFinish.classList.toggle("hidden", !showFinish);
      btnFinish.hidden = !showFinish;
    }
    $("#toggle-notes").checked = notesEnabled;
    updatePinHint();
    safeSaveProgress(currentExamId, currentSection);
  }

  function updatePinHint(){
    const el = $("#notes-pin-hint");
    if(!el) return;
    if(Storage.isPinEnabled()){
      if(Storage.isUnlocked()) el.textContent = "Proteção por PIN ativa e desbloqueada nesta sessão.";
      else el.textContent = "Proteção por PIN ativa — desbloqueie em Sobre para acessar suas notas.";
    } else {
      el.textContent = "Suas notas não estão protegidas por senha neste dispositivo.";
    }
  }

  function nextSection(){
    const exam = getExam(currentExamId);
    if(!exam) return;
    if(currentSection < exam.sections.length-1){
      currentSection++;
      renderExam();
      window.scrollTo(0,0);
    } else {
      showConclusion();
    }
  }
  function prevSection(){
    if(currentSection>0){
      currentSection--;
      renderExam();
      window.scrollTo(0,0);
    }
  }

  async function showConclusion(){
    const exam = getExam(currentExamId);
    await loadExamState(currentExamId);
    const st = getCachedState(currentExamId);
    if(st._locked){
      $("#conclusion-marked").classList.add("hidden");
      $("#conclusion-marked").hidden = true;
      showView("conclusion");
      return;
    }
    const marks = st.marks;
    const items = [];
    exam.sections.forEach(sec=>{
      sec.questions.forEach((q, idx)=>{
        const k = qKey(sec.id, idx);
        if(marks[k]==="confess"){
          items.push({section: sec.title, text: q, note: st.notes[k] || ""});
        }
      });
    });
    const wrap = $("#conclusion-marked");
    const list = $("#conclusion-list");
    list.textContent = "";
    if(items.length>0){
      wrap.classList.remove("hidden");
      wrap.hidden = false;
      items.forEach(it=>{
        const li = document.createElement("li");
        const strong = document.createElement("span");
        strong.style.fontSize = "12px";
        strong.style.color = "var(--muted-2)";
        strong.style.display = "block";
        strong.textContent = it.section;
        const p = document.createElement("span");
        p.textContent = it.text;
        li.append(strong, p);
        if(it.note){
          const note = document.createElement("span");
          note.style.display = "block";
          note.style.marginTop = "6px";
          note.style.fontSize = "13px";
          note.style.color = "var(--muted)";
          note.style.fontStyle = "italic";
          note.textContent = "Nota: " + it.note.slice(0,500);
          li.appendChild(note);
        }
        list.appendChild(li);
      });
    } else {
      wrap.classList.add("hidden");
      wrap.hidden = true;
    }
    showView("conclusion");
  }

  function startExam(examId){
    currentExamId = examId;
    currentSection = 0;
    showView("intro");
    $("#intro-kicker").textContent = getExam(examId).kicker;
  }

  async function beginExam(){
    const prog = Storage.getProgress();
    if(prog && prog.examId===currentExamId){
      currentSection = Math.min(prog.sectionIndex, getExam(currentExamId).sections.length-1);
    } else {
      currentSection = 0;
    }
    showView("exam");
    await renderExam();
  }

  function updateHomeContinue(){
    const prog = Storage.getProgress();
    const wrap = $("#home-continue-wrap");
    if(!prog || !getExam(prog.examId)){
      wrap.classList.add("hidden");
      wrap.hidden = true;
      return;
    }
    wrap.classList.remove("hidden");
    wrap.hidden = false;
  }

  async function continueExam(){
    const prog = Storage.getProgress();
    if(!prog) return;
    currentExamId = prog.examId;
    currentSection = prog.sectionIndex;
    showView("exam");
    await renderExam();
  }

  function openModal(title, body, confirmLabel, onConfirm){
    $("#modal-title").textContent = title;
    $("#modal-body").textContent = body;
    $("#modal-confirm").textContent = confirmLabel;
    pendingWipe = onConfirm;
    const m = $("#modal");
    m.classList.remove("hidden");
    m.hidden = false;
    $("#modal-confirm").focus();
  }
  function closeModal(){
    const m = $("#modal");
    m.classList.add("hidden");
    m.hidden = true;
    pendingWipe = null;
  }

  function wipeCurrentExam(){
    if(!currentExamId) return;
    Storage.clearState(currentExamId);
    delete cachedStates[currentExamId];
    Storage.clearProgress();
    currentSection = 0;
    renderExam();
  }
  async function finishExam(){
    // Finaliza exame: limpa progresso (remove "continuar") mas mantém marks/notes até wipe explícito
    Storage.clearProgress();
    updateHomeContinue();
    if(currentExamId && views.exam && !views.exam.classList.contains("hidden")){
      await showConclusion();
      showStorageError("Exame finalizado. Suas marcações permanecem até você apagar.");
    } else if(currentExamId){
      await loadExamState(currentExamId);
      showView("conclusion");
      // garante dados da conclusão visíveis mesmo sem voltar ao exame
      const st = getCachedState(currentExamId);
      if(!st._locked) await showConclusion();
      Storage.clearProgress();
      updateHomeContinue();
    } else {
      showView("home");
    }
  }

  async function finishExamAndHome(){
    Storage.clearProgress();
    updateHomeContinue();
    showView("home");
    showStorageError("Exame finalizado. Suas marcações permanecem até você usar 'Apagar todos os meus dados'.");
  }

  async function wipeAll(){
    if(Storage.wipeEverythingWithCaches) await Storage.wipeEverythingWithCaches();
    else if(Storage.resetEverythingIncludingPin) await Storage.resetEverythingIncludingPin();
    else Storage.wipeEverything();
    cachedStates = {};
    currentExamId = null;
    currentSection = 0;
    applyTheme();
    renderPrayers();
    updatePinUI();
    showView("home");
    updateHomeContinue();
  }

  function updatePinUI(){
    const status = $("#pin-status");
    const setup = $("#pin-setup");
    const unlock = $("#pin-unlock");
    const manage = $("#pin-manage");
    if(!status) return;
    if(!Storage.isPinEnabled()){
      status.textContent = "Desativado — Suas notas não estão protegidas por senha neste dispositivo.";
      setup.classList.remove("hidden"); setup.hidden=false;
      unlock.classList.add("hidden"); unlock.hidden=true;
      manage.classList.add("hidden"); manage.hidden=true;
    } else if(!Storage.isUnlocked()){
      if(Storage.isLockedOut()) status.textContent = "Bloqueado por tentativas — aguarde 30s.";
      else status.textContent = "Ativado — bloqueado. Digite o PIN para desbloquear nesta sessão.";
      setup.classList.add("hidden"); setup.hidden=true;
      unlock.classList.remove("hidden"); unlock.hidden=false;
      manage.classList.add("hidden"); manage.hidden=true;
    } else {
      status.textContent = "Ativado e desbloqueado — seus dados estão cifrados e acessíveis nesta sessão.";
      setup.classList.add("hidden"); setup.hidden=true;
      unlock.classList.add("hidden"); unlock.hidden=true;
      manage.classList.remove("hidden"); manage.hidden=false;
    }
    updatePinHint();
  }

  function triggerQuickExit(){
    // saida rapida deve tambem limpar memoria sensivel
    if(Storage.isUnlocked()){
      Storage.lockPin();
      cachedStates = {};
      updatePinUI();
    }
    // borra inputs visiveis e tira foco
    $$("textarea.q-note").forEach(t=>{ t.blur(); });
    document.activeElement?.blur();
    const qv = $("#quick-exit-view");
    qv.classList.remove("hidden");
    qv.hidden = false;
    qv.setAttribute("aria-hidden","false");
    window.scrollTo(0,0);
  }
  function closeQuickExit(){
    const qv = $("#quick-exit-view");
    qv.classList.add("hidden");
    qv.hidden = true;
    qv.setAttribute("aria-hidden","true");
    showView("home");
  }

  function resetInactivityTimer(){
    clearTimeout(inactivityTimer);
    if(!Storage.isPinEnabled() || !Storage.isUnlocked()) return;
    inactivityTimer = setTimeout(()=>{
      Storage.lockPin(); cachedStates={}; updatePinUI(); if(currentExamId) renderExam();
      showStorageError("Sessão bloqueada por inatividade (5 min).");
    }, 5*60*1000);
  }

  function bind(){
    $("#btn-theme").addEventListener("click", toggleTheme);
    $("#btn-help").addEventListener("click", ()=> showView("about"));
    $("#btn-sobre-home").addEventListener("click", ()=> showView("about"));
    $("#btn-footer-about").addEventListener("click", ()=> showView("about"));
    $("#btn-about-back").addEventListener("click", ()=> showView("home"));
    $("#btn-oracoes-home").addEventListener("click", ()=> { renderPrayers(); showView("prayers"); });
    $("#btn-prayers-back").addEventListener("click", ()=> showView("home"));
    $("#btn-to-prayers").addEventListener("click", ()=> { renderPrayers(); showView("prayers"); });
    $("#btn-back-home").addEventListener("click", ()=> showView("home"));
    $("#btn-exam-home").addEventListener("click", ()=> showView("home"));
    $("#btn-intro-back").addEventListener("click", ()=> showView("home"));

    $("#btn-start-completo").addEventListener("click", ()=> startExam("completo"));
    $("#btn-start-rapido").addEventListener("click", ()=> startExam("rapido"));
    $("#btn-start-diario").addEventListener("click", ()=> startExam("diario"));

    $("#btn-intro-begin").addEventListener("click", beginExam);

    $("#btn-continue").addEventListener("click", continueExam);
    $("#btn-restart-home").addEventListener("click", ()=>{
      openModal("Começar novamente?", "Isso apagará a posição salva do exame anterior e começará do início.", "Começar", ()=>{
        Storage.clearProgress();
        updateHomeContinue();
        closeModal();
      });
    });

    $("#btn-next").addEventListener("click", nextSection);
    $("#btn-prev").addEventListener("click", prevSection);

    $("#btn-exam-sections").addEventListener("click", ()=>{
      const d = $("#sections-drawer");
      const isHidden = d.classList.contains("hidden");
      d.classList.toggle("hidden", !isHidden);
      d.hidden = !isHidden;
      $("#btn-exam-sections").setAttribute("aria-expanded", String(isHidden));
    });
    $("#btn-close-drawer").addEventListener("click", ()=>{
      $("#sections-drawer").classList.add("hidden");
      $("#sections-drawer").hidden = true;
      $("#btn-exam-sections").setAttribute("aria-expanded","false");
    });

    $("#toggle-notes").addEventListener("change", (e)=>{
      try{ Storage.setNotesEnabled(e.target.checked); }catch(err){ if(err&&err.name==="QuotaExceededError") showStorageError(); }
      renderExam();
    });

    $("#btn-finish-exam")?.addEventListener("click", ()=>{
      openModal("Finalizar exame?", "O progresso 'continuar de onde parou' será limpo. Suas marcações permanecem até você apagar. Deseja finalizar?", "Finalizar", async ()=>{
        closeModal();
        await finishExam();
      });
    });
    $("#btn-finish-exam-conclusion")?.addEventListener("click", ()=>{
      openModal("Finalizar exame?", "Isso limpa o progresso e volta ao início. Suas marcações marcadas como 'Levar à Confissão' permanecem até você apagar.", "Finalizar", async ()=>{
        closeModal();
        await finishExamAndHome();
      });
    });
    $("#btn-clear-exam").addEventListener("click", ()=>{
      openModal("Apagar marcações deste exame?", "Todas as marcações e anotações deste exame serão apagadas apenas neste dispositivo.", "Apagar", ()=>{
        wipeCurrentExam();
        closeModal();
      });
    });
    $("#btn-clear-marked-conclusion").addEventListener("click", ()=>{
      openModal("Apagar marcações?", "Isso apagará as marcações e anotações deste exame.", "Apagar", ()=>{
        if(currentExamId) { Storage.clearState(currentExamId); delete cachedStates[currentExamId]; }
        Storage.clearProgress();
        closeModal();
        showView("home");
      });
    });
    function updatePrintHeader(){
      const el = $("#print-header");
      if(!el) return;
      const d = new Date();
      const fmt = d.toLocaleDateString("pt-BR", {day:"2-digit", month:"long", year:"numeric"});
      el.textContent = fmt + " — confidencial · apenas para a confissão";
      el.style.display = "block";
      const foot = $("#print-footer");
      if(foot) foot.style.display = "block";
    }
    $("#btn-print-marked").addEventListener("click", ()=>{
      updatePrintHeader();
      // garante que a view de conclusão está visível para impressão
      setTimeout(()=> window.print(), 50);
    });
    // after print, hide again (screen)
    window.addEventListener("afterprint", ()=>{
      const h = $("#print-header"); if(h) h.style.display="none";
      const f = $("#print-footer"); if(f) f.style.display="none";
    });
    $("#btn-finish-from-prayers")?.addEventListener("click", ()=>{
      openModal("Finalizar exame?", "O progresso será limpo e você voltará ao início. Use 'Imprimir' na tela anterior se precisar do PDF para a confissão.", "Finalizar", async ()=>{
        closeModal();
        await finishExamAndHome();
      });
    });

    const wipeHandler = ()=>{
      openModal("Apagar todos os meus dados?", "Isso removerá permanentemente todas as marcações, anotações, progresso e cache offline deste dispositivo, INCLUINDO o PIN. Esta ação não pode ser desfeita. Cache do Service Worker também será limpo (verificado via caches.keys()).", "Apagar tudo", async ()=>{
        await wipeAll();
        closeModal();
      });
    };
    $("#btn-wipe-all").addEventListener("click", wipeHandler);
    $("#btn-wipe-all-about").addEventListener("click", wipeHandler);
    $("#btn-footer-wipe").addEventListener("click", wipeHandler);

    $$(".prayer-tabs .tab").forEach(b=>{
      b.addEventListener("click", ()=> setPrayerLang(b.dataset.lang));
    });

    const pinMin = Storage.PIN_MIN_LEN || 6;
    $("#btn-enable-pin")?.addEventListener("click", async ()=>{
      const pin = $("#pin-input").value.trim();
      const conf = $("#pin-confirm").value.trim();
      if(pin.length < pinMin){ openModal("PIN inválido","O PIN deve ter ao menos "+pinMin+" caracteres. Use frase forte, não só 4 dígitos.","OK", closeModal); return; }
      if(pin !== conf){ openModal("PIN não confere","A confirmação não coincide.","OK", closeModal); return; }
      try{
        await Storage.enablePin(pin);
        cachedStates = {};
        if(currentExamId) await loadExamState(currentExamId);
        $("#pin-input").value=""; $("#pin-confirm").value="";
        updatePinUI();
        if(currentExamId) renderExam();
        resetInactivityTimer();
      }catch(e){
        const msg = e && e.message ? e.message : "Não foi possível ativar o PIN.";
        openModal("Erro", msg, "OK", closeModal);
      }
    });
    $("#btn-unlock-pin")?.addEventListener("click", async ()=>{
      if(Storage.isLockedOut()){ openModal("Bloqueado","Muitas tentativas. Aguarde 30s.","OK", closeModal); updatePinUI(); return; }
      const pin = $("#pin-unlock-input").value.trim();
      const ok = await Storage.unlockPin(pin);
      if(!ok){
        if(Storage.isLockedOut()) openModal("Bloqueado","Muitas tentativas. Aguarde 30s.","OK", closeModal);
        else openModal("PIN incorreto","Tente novamente.","OK", closeModal);
        updatePinUI();
        return;
      }
      cachedStates = {};
      if(currentExamId) await loadExamState(currentExamId);
      $("#pin-unlock-input").value="";
      updatePinUI();
      if(currentExamId) renderExam();
      else if(views.exam && !views.exam.classList.contains("hidden")) renderExam();
      resetInactivityTimer();
    });
    $("#btn-lock-pin")?.addEventListener("click", ()=>{
      Storage.lockPin(); cachedStates={}; updatePinUI(); if(currentExamId) renderExam();
      clearTimeout(autoLockTimer); clearTimeout(inactivityTimer);
    });
    $("#btn-lock-pin2")?.addEventListener("click", ()=>{
      Storage.lockPin(); cachedStates={}; updatePinUI(); if(currentExamId) renderExam();
      clearTimeout(autoLockTimer); clearTimeout(inactivityTimer);
    });
    function openPinDisableModal(){
      const m = $("#pin-disable-modal");
      $("#pin-disable-input").value = "";
      $("#pin-disable-error").textContent = "";
      $("#pin-disable-error").classList.add("hidden"); $("#pin-disable-error").hidden = true;
      m.classList.remove("hidden"); m.hidden = false;
      setTimeout(()=> $("#pin-disable-input").focus(), 50);
    }
    function closePinDisableModal(){
      const m = $("#pin-disable-modal");
      m.classList.add("hidden"); m.hidden = true;
    }
    $("#btn-disable-pin")?.addEventListener("click", openPinDisableModal);
    $("#pin-disable-cancel")?.addEventListener("click", closePinDisableModal);
    $("#pin-disable-modal")?.addEventListener("click", (e)=>{ if(e.target.id==="pin-disable-modal") closePinDisableModal(); });
    $("#pin-disable-confirm")?.addEventListener("click", async ()=>{
      const pin = $("#pin-disable-input").value;
      if(!pin || pin.length < pinMin){
        const err = $("#pin-disable-error");
        err.textContent = "Mínimo "+pinMin+" caracteres.";
        err.classList.remove("hidden"); err.hidden = false;
        return;
      }
      const ok = await Storage.disablePin(pin);
      if(!ok){
        const err = $("#pin-disable-error");
        if(Storage.isLockedOut()) err.textContent = "Bloqueado por tentativas. Aguarde 30s.";
        else err.textContent = "PIN incorreto. Tente novamente.";
        err.classList.remove("hidden"); err.hidden = false;
        updatePinUI();
        return;
      }
      cachedStates={};
      if(currentExamId) await loadExamState(currentExamId);
      closePinDisableModal();
      updatePinUI();
      if(currentExamId) renderExam();
      showStorageError("Proteção por PIN desativada.");
    });

    $("#btn-quick-exit")?.addEventListener("click", triggerQuickExit);
    $("#btn-quick-exit-back")?.addEventListener("click", closeQuickExit);

    $("#modal-cancel").addEventListener("click", closeModal);
    $("#modal-confirm").addEventListener("click", ()=>{
      if(typeof pendingWipe==="function") pendingWipe();
      else closeModal();
    });
    $("#modal").addEventListener("click", (e)=>{
      if(e.target.id==="modal") closeModal();
    });
    document.addEventListener("keydown", (e)=>{
      if(e.key==="Escape"){
        const pdm = $("#pin-disable-modal");
        if(pdm && !pdm.classList.contains("hidden")){ closePinDisableModal(); return; }
        const m = $("#modal");
        if(!m.classList.contains("hidden")){ closeModal(); return; }
        const qv = $("#quick-exit-view");
        if(qv && !qv.classList.contains("hidden")){ closeQuickExit(); return; }
        const d = $("#sections-drawer");
        if(!d.classList.contains("hidden")){
          d.classList.add("hidden"); d.hidden=true;
          $("#btn-exam-sections").setAttribute("aria-expanded","false");
          return;
        }
        if(currentExamId && views.exam && !views.exam.classList.contains("hidden")){
          triggerQuickExit();
        }
      }
      if(e.key==="Enter" && $("#pin-disable-modal") && !$("#pin-disable-modal").classList.contains("hidden")){
        $("#pin-disable-confirm").click();
      }
    });

    document.addEventListener("visibilitychange", ()=>{
      const ov = $("#privacy-overlay");
      if(!ov) return;
      if(document.hidden){
        ov.classList.remove("hidden");
        ov.hidden=false;
        clearTimeout(autoLockTimer);
        if(Storage.isPinEnabled() && Storage.isUnlocked()){
          autoLockTimer = setTimeout(()=>{
            Storage.lockPin(); cachedStates={}; updatePinUI(); if(currentExamId) renderExam();
          }, 30000);
        }
      } else {
        ov.classList.add("hidden");
        ov.hidden=true;
        clearTimeout(autoLockTimer);
        if(Storage.isUnlocked()) resetInactivityTimer();
      }
    });

    // auto-lock por inatividade 5 min
    ["click","keydown","mousemove","touchstart"].forEach(ev=>{
      document.addEventListener(ev, resetInactivityTimer, {passive:true});
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>{
      if(Storage.getPrefs().theme==="auto") applyTheme();
    });
  }

  document.addEventListener("DOMContentLoaded", async ()=>{
    applyTheme();
    renderPrayers();
    bind();
    updatePinUI();
    updatePinHint();
    showView("home");
    resetInactivityTimer();
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
  });
})();
