/* app.js — vanilla JS, sem rede, sem innerHTML com dados do usuário sem sanitização.
   Privacidade: nenhum fetch/XHR/WebSocket/analytics. Nenhum dado em URL. Nenhum console.log de dados sensíveis.
*/
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  // Estado em memória
  let currentExamId = null;
  let currentSection = 0;
  let pendingWipe = null; // 'exam' | 'all'

  // Views
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
    // foco
    const target = views[name];
    if(target){ target.focus?.(); window.scrollTo(0,0); }
    // Atualiza hash silenciosamente? Não usar query string com dados sensíveis. Não colocar estado sensível em URL.
    // Usamos hash apenas para navegação não-sensível (view name) se quiser, mas não é necessário.
    // Evitamos colocar exam progress em URL.
    updateHomeContinue();
  }

  // Tema
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
    // ciclo: auto -> dark -> light -> auto ; mas simplificamos dark/light
    const isDarkPreferred = window.matchMedia("(prefers-color-scheme: dark)").matches;
    let next;
    if(cur==="auto") next = isDarkPreferred ? "light" : "dark";
    else if(cur==="dark") next = "light";
    else next = "dark";
    Storage.savePrefs({theme: next});
    applyTheme();
  }

  // Prayers idioma
  function getPrayerLang(){ return Storage.getPrefs().prayerLang || "pt"; }
  function setPrayerLang(lang){
    Storage.savePrefs({prayerLang: lang});
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
      // Conteúdo é estático confiável, mas ainda assim usamos textContent para evitar innerHTML
      el.textContent = text;
    });
  }

  // Helpers de exam content
  function getExam(id){ return EXAM_CONTENT[id] || null; }

  // Estado de marcações
  function qKey(sectionId, qIndex){ return sectionId+":"+qIndex; }

  function getMark(examId, sectionId, qIndex){
    const st = Storage.getState(examId);
    return st.marks[qKey(sectionId,qIndex)] || "none";
  }
  function setMark(examId, sectionId, qIndex, value){
    const st = Storage.getState(examId);
    if(value==="none") delete st.marks[qKey(sectionId,qIndex)];
    else st.marks[qKey(sectionId,qIndex)] = value;
    Storage.saveState(examId, st);
  }
  function getNote(examId, sectionId, qIndex){
    const st = Storage.getState(examId);
    return st.notes[qKey(sectionId,qIndex)] || "";
  }
  function setNote(examId, sectionId, qIndex, text){
    const st = Storage.getState(examId);
    // validação: limitar tamanho
    const t = (text||"").slice(0,2000);
    if(!t) delete st.notes[qKey(sectionId,qIndex)];
    else st.notes[qKey(sectionId,qIndex)] = t;
    Storage.saveState(examId, st);
  }

  // Render exame
  function renderExam(){
    const exam = getExam(currentExamId);
    if(!exam) return;
    const section = exam.sections[currentSection];
    if(!section) return;

    // header
    $("#exam-kicker").textContent = exam.kicker + " · " + exam.label;
    $("#exam-section-title").textContent = section.title;
    $("#exam-section-desc").textContent = section.desc;
    $("#exam-progress").textContent = `${section.title} — ${currentSection+1} de ${exam.sections.length}`;

    // drawer list
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
        Storage.saveProgress(currentExamId, currentSection);
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

    // questions
    const container = $("#exam-questions");
    container.textContent = "";
    const notesEnabled = Storage.notesEnabled();

    section.questions.forEach((q, qIndex)=>{
      const card = document.createElement("div");
      card.className = "q-card";

      const p = document.createElement("p");
      p.className = "q-text";
      p.textContent = q;
      // id para aria
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
        // aria-pressed
        b.setAttribute("aria-pressed", String(currentMark===s.val));
        b.dataset.state = s.val;
        b.textContent = s.label;
        b.addEventListener("click", ()=>{
          const nextVal = s.val;
          setMark(currentExamId, section.id, qIndex, nextVal);
          // atualizar UI localmente sem re-render completo para performance
          $$(".q-btn", actions).forEach(x=>{
            const isActive = x.dataset.state===nextVal;
            x.classList.toggle("active", isActive);
            x.setAttribute("aria-pressed", String(isActive));
          });
          // se virou confess, garantir que progress salvo
          Storage.saveProgress(currentExamId, currentSection);
        });
        actions.appendChild(b);
      });

      card.append(p, actions);

      if(notesEnabled){
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
        ta.value = getNote(currentExamId, section.id, qIndex);
        const hint = document.createElement("p");
        hint.className = "q-note-hint";
        hint.textContent = "Esta anotação permanece apenas neste dispositivo. Apague quando quiser.";
        // debounce save
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

    // nav buttons
    $("#btn-prev").disabled = currentSection===0;
    $("#btn-prev").style.opacity = currentSection===0 ? ".4" : "1";
    const isLast = currentSection===exam.sections.length-1;
    $("#btn-next").textContent = isLast ? "Concluir →" : "Próxima →";

    // toggle notes
    $("#toggle-notes").checked = notesEnabled;

    // salvar progress
    Storage.saveProgress(currentExamId, currentSection);
  }

  function nextSection(){
    const exam = getExam(currentExamId);
    if(!exam) return;
    if(currentSection < exam.sections.length-1){
      currentSection++;
      renderExam();
      window.scrollTo(0,0);
    } else {
      // concluir -> mostrar conclusão
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

  function showConclusion(){
    const exam = getExam(currentExamId);
    // coletar marcados como confess
    const st = Storage.getState(currentExamId);
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
        // usar textContent para evitar XSS mesmo com dados locais
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
    // se existe progresso salvo para esse exame, perguntar? O fluxo: intro -> begin
    // aqui chamamos intro
    showView("intro");
    $("#intro-kicker").textContent = getExam(examId).kicker;
  }

  function beginExam(){
    // checar se há progresso salvo para currentExamId
    const prog = Storage.getProgress();
    if(prog && prog.examId===currentExamId){
      currentSection = Math.min(prog.sectionIndex, getExam(currentExamId).sections.length-1);
    } else {
      currentSection = 0;
    }
    showView("exam");
    renderExam();
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

  function continueExam(){
    const prog = Storage.getProgress();
    if(!prog) return;
    currentExamId = prog.examId;
    currentSection = prog.sectionIndex;
    showView("exam");
    renderExam();
  }

  // Modal
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

  // Wipe
  function wipeCurrentExam(){
    if(!currentExamId) return;
    Storage.clearState(currentExamId);
    Storage.clearProgress();
    currentSection = 0;
    renderExam();
  }
  function wipeAll(){
    Storage.wipeEverything();
    currentExamId = null;
    currentSection = 0;
    applyTheme(); // reset
    renderPrayers();
    showView("home");
    updateHomeContinue();
  }

  // Eventos
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
      Storage.setNotesEnabled(e.target.checked);
      if(!e.target.checked){
        // opcional: avisar que notas existentes permanecem mas ocultas? Mantemos.
      }
      renderExam();
    });

    $("#btn-clear-exam").addEventListener("click", ()=>{
      openModal("Apagar marcações deste exame?", "Todas as marcações e anotações deste exame serão apagadas apenas neste dispositivo.", "Apagar", ()=>{
        wipeCurrentExam();
        closeModal();
      });
    });
    $("#btn-clear-marked-conclusion").addEventListener("click", ()=>{
      openModal("Apagar marcações?", "Isso apagará as marcações e anotações deste exame.", "Apagar", ()=>{
        if(currentExamId) Storage.clearState(currentExamId);
        Storage.clearProgress();
        closeModal();
        showView("home");
      });
    });
    $("#btn-print-marked").addEventListener("click", ()=> window.print());

    const wipeHandler = ()=>{
      openModal("Apagar todos os meus dados?", "Isso removerá permanentemente todas as marcações, anotações e progresso salvos neste dispositivo. Esta ação não pode ser desfeita.", "Apagar tudo", ()=>{
        wipeAll();
        closeModal();
      });
    };
    $("#btn-wipe-all").addEventListener("click", wipeHandler);
    $("#btn-wipe-all-about").addEventListener("click", wipeHandler);
    $("#btn-footer-wipe").addEventListener("click", wipeHandler);

    $$(".prayer-tabs .tab").forEach(b=>{
      b.addEventListener("click", ()=> setPrayerLang(b.dataset.lang));
    });

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
        const m = $("#modal");
        if(!m.classList.contains("hidden")) closeModal();
        const d = $("#sections-drawer");
        if(!d.classList.contains("hidden")){
          d.classList.add("hidden"); d.hidden=true;
          $("#btn-exam-sections").setAttribute("aria-expanded","false");
        }
      }
    });

    // Atualiza tema se sistema mudar e prefs for auto
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>{
      if(Storage.getPrefs().theme==="auto") applyTheme();
    });
  }

  // Init
  document.addEventListener("DOMContentLoaded", ()=>{
    applyTheme();
    renderPrayers();
    bind();
    showView("home");
    // registrar service worker se disponível (sem enviar dados)
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    }
  });
})();
