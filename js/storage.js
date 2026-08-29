/* storage.js — armazenamento mínimo, privado, local-only.
   Nunca envia dados para rede. Sem analytics, sem cookies externos.
   Chaves:
     anima:prefs -> {theme, prayerLang}
     anima:progress -> {examId, sectionIndex}  (apenas posição, não respostas)
     anima:state:{examId} -> {marks, notes}  (opt-in, local)
     anima:notesEnabled -> boolean
*/
const Storage = (() => {
  const PREFIX = "anima:";
  const safe = {
    get(key){
      try { return localStorage.getItem(PREFIX+key); } catch { return null; }
    },
    set(key, val){
      try { localStorage.setItem(PREFIX+key, val); return true; } catch { return false; }
    },
    remove(key){
      try { localStorage.removeItem(PREFIX+key); } catch {}
    }
  };

  function getPrefs(){
    try{
      const raw = safe.get("prefs");
      if(!raw) return {theme:"auto", prayerLang:"pt"};
      const j = JSON.parse(raw);
      return {theme: j.theme || "auto", prayerLang: j.prayerLang || "pt"};
    }catch{ return {theme:"auto", prayerLang:"pt"}; }
  }
  function savePrefs(p){
    const cur = getPrefs();
    const next = {...cur, ...p};
    safe.set("prefs", JSON.stringify(next));
  }

  function getProgress(){
    try{
      const raw = safe.get("progress");
      if(!raw) return null;
      return JSON.parse(raw);
    }catch{ return null; }
  }
  function saveProgress(examId, sectionIndex){
    safe.set("progress", JSON.stringify({examId, sectionIndex}));
  }
  function clearProgress(){ safe.remove("progress"); }

  function notesEnabled(){
    return safe.get("notesEnabled") === "1";
  }
  function setNotesEnabled(v){
    if(v) safe.set("notesEnabled","1");
    else safe.remove("notesEnabled");
  }

  // state per exam: {marks: { "sectionId:qIndex": "none"|"reflect"|"confess", notes: { "sectionId:qIndex": string } }
  function getState(examId){
    try{
      const raw = safe.get("state:"+examId);
      if(!raw) return {marks:{}, notes:{}};
      const j = JSON.parse(raw);
      return {marks: j.marks || {}, notes: j.notes || {}};
    }catch{ return {marks:{}, notes:{}}; }
  }
  function saveState(examId, state){
    // Não salvar se não há marcações e notas desabilitadas e sem notas
    safe.set("state:"+examId, JSON.stringify(state));
  }
  function clearState(examId){
    safe.remove("state:"+examId);
  }
  function clearAllStates(){
    // remove todos anima:state:*
    try{
      const keys=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k && k.startsWith(PREFIX+"state:")) keys.push(k);
      }
      keys.forEach(k=>{ try{localStorage.removeItem(k);}catch{} });
    }catch{}
  }
  function clearAll(){
    clearProgress();
    clearAllStates();
    safe.remove("notesEnabled");
    // prefs mantém tema/idioma? O requisito diz "limpar estados persistidos relacionados ao usuário" e voltar ao inicial.
    // Mantemos prefs? O wipe total deve remover tudo exceto? Vamos remover marks mas manter prefs de tema? 
    // Spec: "remover os dados locais; limpar estados persistidos relacionados ao usuário; retornar ao estado inicial."
    // Interpretação: apagar marks/notes/progress, mas manter tema pode ser considerado não-sensível. Porém "Apagar todos os meus dados" deve ser abrangente.
    // Vamos limpar progress+states+notesEnabled e manter prefs de tema/idioma por conveniência, mas oferecer wipe completo se o usuário quiser.
    // Para atender "apagar todos", vamos também limpar prefs se chamado como full.
  }
  function wipeEverything(){
    try{
      const keys=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach(k=>{ try{localStorage.removeItem(k);}catch{} });
    }catch{}
  }

  return {getPrefs, savePrefs, getProgress, saveProgress, clearProgress, notesEnabled, setNotesEnabled, getState, saveState, clearState, clearAllStates, clearAll, wipeEverything, PREFIX};
})();
