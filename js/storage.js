/* storage.js — armazenamento mínimo, privado, local-only.
    Nunca envia dados para rede. Sem analytics, sem cookies externos.
    Chaves:
      anima:prefs -> {theme, prayerLang}
      anima:progress -> {examId, sectionIndex}  (apenas posição, não respostas)
      anima:state:{examId} -> envelope versionado {v, data} (v1 texto puro, v2 AES-GCM)
      anima:notesEnabled -> boolean
      anima:pinSalt -> base64 salt para PBKDF2 (se PIN configurado)
      anima:pinCheck -> verificação cifrada "anima-pin-check" (para validar PIN)
    Auditoria (Fase 2):
      - Sensível: anima:state:{exame}
      - Não sensível: anima:prefs, anima:progress, anima:notesEnabled
*/
const Storage = (() => {
  const PREFIX = "anima:";
  const PIN_SALT_KEY = "pinSalt";
  const PIN_CHECK_KEY = "pinCheck";
  const PIN_CHECK_PLAINTEXT = "anima-pin-check";
  const PBKDF2_ITERATIONS = 600000; // OWASP ≥600k para PBKDF2-HMAC-SHA256
  const PIN_MIN_LEN = 6;
  let _cryptoKey = null;
  // rate-limit para brute-force offline mitigado parcialmente (sem persistência)
  let _failedAttempts = 0;
  let _lockoutUntil = 0;
  // fila para evitar concorrência de saveState
  let _saveQueue = Promise.resolve();

  const safe = {
    get(key){
      try { return localStorage.getItem(PREFIX+key); } catch { return null; }
    },
    set(key, val){
      try { localStorage.setItem(PREFIX+key, val); return true; } catch(e) {
        if(e && (e.name === "QuotaExceededError" || e.code === 22)){
          const q = new Error("QuotaExceededError");
          q.name = "QuotaExceededError";
          throw q;
        }
        return false;
      }
    },
    remove(key){
      try { localStorage.removeItem(PREFIX+key); } catch {}
    }
  };

  function bufToB64(buf){
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let binary = "";
    bytes.forEach(b=> binary += String.fromCharCode(b));
    return btoa(binary);
  }
  function b64ToBuf(b64){
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return bytes;
  }

  async function deriveKey(pin, saltBytes){
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      {name:"PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash:"SHA-256"},
      keyMaterial,
      {name:"AES-GCM", length:256},
      false,
      ["encrypt","decrypt"]
    );
  }
  async function encryptString(plain, cryptoKey){
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt({name:"AES-GCM", iv}, cryptoKey, enc.encode(plain));
    return bufToB64(iv) + "." + bufToB64(new Uint8Array(cipherBuf));
  }
  async function decryptString(encStr, cryptoKey){
    const parts = encStr.split(".");
    if(parts.length!==2) throw new Error("formato invalido");
    const iv = b64ToBuf(parts[0]);
    const data = b64ToBuf(parts[1]);
    const plainBuf = await crypto.subtle.decrypt({name:"AES-GCM", iv}, cryptoKey, data);
    return new TextDecoder().decode(plainBuf);
  }
  function loadSalt(){
    const s = safe.get(PIN_SALT_KEY);
    if(!s) return null;
    try{ return b64ToBuf(s); }catch{return null;}
  }
  function listExamIds(){
    const ids=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k && k.startsWith(PREFIX+"state:")) ids.push(k.slice((PREFIX+"state:").length));
      }
    }catch{}
    return ids;
  }
  function isPinEnabled(){
    return !!safe.get(PIN_SALT_KEY) && !!safe.get(PIN_CHECK_KEY);
  }
  function isUnlocked(){
    return _cryptoKey !== null;
  }
  // rate-limit helpers
  function isLockedOut(){
    return Date.now() < _lockoutUntil;
  }
  function registerFailedAttempt(){
    _failedAttempts++;
    if(_failedAttempts >= 5){
      _lockoutUntil = Date.now() + 30000; // 30s
      _failedAttempts = 0;
    }
  }
  function resetAttempts(){
    _failedAttempts = 0;
    _lockoutUntil = 0;
  }
  async function verifyPin(pin){
    if(isLockedOut()) return false;
    const salt = loadSalt();
    if(!salt) return false;
    try{
      const key = await deriveKey(pin, salt);
      const check = safe.get(PIN_CHECK_KEY);
      const dec = await decryptString(check, key);
      const ok = dec === PIN_CHECK_PLAINTEXT;
      if(ok) resetAttempts(); else registerFailedAttempt();
      return ok;
    }catch{ registerFailedAttempt(); return false; }
  }
  async function unlockPin(pin){
    if(isLockedOut()) return false;
    const salt = loadSalt();
    if(!salt) return false;
    try{
      const key = await deriveKey(pin, salt);
      const check = safe.get(PIN_CHECK_KEY);
      const dec = await decryptString(check, key);
      if(dec !== PIN_CHECK_PLAINTEXT){ registerFailedAttempt(); return false; }
      _cryptoKey = key;
      resetAttempts();
      return true;
    }catch{ registerFailedAttempt(); return false; }
  }
  function lockPin(){
    _cryptoKey = null;
  }
  async function enablePin(pin){
    if(isPinEnabled()) throw new Error("PIN já está ativo — use changePin()");
    if(!pin || pin.length < PIN_MIN_LEN) throw new Error("PIN deve ter ao menos "+PIN_MIN_LEN+" caracteres (use frase forte)");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = bufToB64(salt);
    const key = await deriveKey(pin, salt);
    const check = await encryptString(PIN_CHECK_PLAINTEXT, key);
    // migrar estados existentes com envelope versionado
    const ids = listExamIds();
    const plainStates = {};
    for(const id of ids){
      const raw = safe.get("state:"+id);
      if(!raw) continue;
      // ler via envelope ou legado e recuperar objeto puro para recifrar
      try{
        const outer = JSON.parse(raw);
        if(outer && outer.v === 2 && typeof outer.data === "string"){
          // legado v2 mas ainda sem envelope? já cifrado, pular - será decifrado depois? aqui é enable, então só havia v1 legado
          continue;
        }
        if(outer && outer.v === 1 && outer.data){
          plainStates[id] = JSON.stringify(outer.data);
          continue;
        }
        if(outer && outer.marks !== undefined){
          plainStates[id] = raw;
          continue;
        }
      }catch{
        // raw pode ser legado "iv.cipher" sem envelope — já cifrado (não deveria existir em enable)
        continue;
      }
    }
    // também cobrir examIds conhecidos se não estavam em list (primeira vez)
    for(const id of ["completo","rapido","diario"]){
      if(plainStates[id]) continue;
      const raw = safe.get("state:"+id);
      if(!raw) continue;
      try{
        const outer = JSON.parse(raw);
        if(outer && outer.marks !== undefined) plainStates[id]=raw;
      }catch{}
    }
    safe.set(PIN_SALT_KEY, saltB64);
    safe.set(PIN_CHECK_KEY, check);
    _cryptoKey = key;
    for(const [id, raw] of Object.entries(plainStates)){
      const enc = await encryptString(raw, key);
      safe.set("state:"+id, JSON.stringify({v:2, data: enc}));
    }
    resetAttempts();
    return true;
  }
  async function disablePin(pin){
    const ok = await verifyPin(pin);
    if(!ok) return false;
    if(!_cryptoKey) await unlockPin(pin);
    const key = _cryptoKey;
    const ids = listExamIds();
    for(const id of ids){
      const raw = safe.get("state:"+id);
      if(!raw) continue;
      try{
        const outer = JSON.parse(raw);
        if(outer && outer.v === 2 && typeof outer.data === "string"){
          const dec = await decryptString(outer.data, key);
          // dec é JSON string do estado
          const obj = JSON.parse(dec);
          safe.set("state:"+id, JSON.stringify({v:1, data: obj}));
          continue;
        }
        if(outer && outer.v === 1){
          continue;
        }
        if(outer && outer.marks !== undefined){
          // já texto puro legado
          continue;
        }
        // legado "iv.cipher" sem envelope
        if(typeof raw === "string" && raw.includes(".")){
          try{
            const dec = await decryptString(raw, key);
            const obj = JSON.parse(dec);
            safe.set("state:"+id, JSON.stringify({v:1, data: obj}));
          }catch{}
        }
      }catch{}
    }
    safe.remove(PIN_SALT_KEY);
    safe.remove(PIN_CHECK_KEY);
    _cryptoKey = null;
    resetAttempts();
    return true;
  }
  async function changePin(oldPin, newPin){
    if(!newPin || newPin.length < PIN_MIN_LEN) throw new Error("Novo PIN deve ter ao menos "+PIN_MIN_LEN+" caracteres");
    const ok = await verifyPin(oldPin);
    if(!ok) return false;
    await unlockPin(oldPin);
    const oldKey = _cryptoKey;
    const ids = listExamIds();
    const plains = {};
    for(const id of ids){
      const raw = safe.get("state:"+id);
      if(!raw) continue;
      try{
        const outer = JSON.parse(raw);
        if(outer && outer.v === 2 && typeof outer.data === "string"){
          plains[id] = await decryptString(outer.data, oldKey);
          continue;
        }
        if(outer && outer.v === 1 && outer.data){
          plains[id] = JSON.stringify(outer.data);
          continue;
        }
        if(outer && outer.marks !== undefined){
          plains[id]=JSON.stringify(outer);
          continue;
        }
        if(typeof raw === "string" && raw.includes(".")){
          plains[id]=await decryptString(raw, oldKey);
          continue;
        }
      }catch{ plains[id]=raw; }
    }
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newSaltB64 = bufToB64(newSalt);
    const newKey = await deriveKey(newPin, newSalt);
    const newCheck = await encryptString(PIN_CHECK_PLAINTEXT, newKey);
    safe.set(PIN_SALT_KEY, newSaltB64);
    safe.set(PIN_CHECK_KEY, newCheck);
    _cryptoKey = newKey;
    for(const [id, plain] of Object.entries(plains)){
      const enc = await encryptString(plain, newKey);
      safe.set("state:"+id, JSON.stringify({v:2, data: enc}));
    }
    resetAttempts();
    return true;
  }

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

  // ÚNICA API pública de leitura — envelope versionado {v, data}
  async function getStateAsync(examId){
    try{
      const raw = safe.get("state:"+examId);
      if(!raw) return {marks:{}, notes:{}};
      // tentar parse como envelope
      let outer;
      try{ outer = JSON.parse(raw); }catch{
        // legado "iv.cipher" sem envelope
        if(isPinEnabled()){
          if(!_cryptoKey) return {marks:{}, notes:{}, _locked:true};
          try{
            const dec = await decryptString(raw, _cryptoKey);
            const j = JSON.parse(dec);
            return {marks: j.marks || {}, notes: j.notes || {}};
          }catch{ return {marks:{}, notes:{}}; }
        }
        return {marks:{}, notes:{}};
      }
      if(outer && outer.v === 1 && outer.data){
        return {marks: outer.data.marks || {}, notes: outer.data.notes || {}};
      }
      if(outer && outer.v === 2 && typeof outer.data === "string"){
        if(!_cryptoKey) return {marks:{}, notes:{}, _locked:true};
        try{
          const dec = await decryptString(outer.data, _cryptoKey);
          const j = JSON.parse(dec);
          return {marks: j.marks || {}, notes: j.notes || {}};
        }catch{ return {marks:{}, notes:{}}; }
      }
      // legado sem versão {marks, notes}
      if(outer && outer.marks !== undefined){
        // se PIN está ativo mas dado está em claro, precisa ser mantido (migração futura)
        // se PIN ativo e desbloqueado, caller pode optar por recifrar no próximo save
        return {marks: outer.marks || {}, notes: outer.notes || {}};
      }
      return {marks:{}, notes:{}};
    }catch{ return {marks:{}, notes:{}}; }
  }

  function saveState(examId, state){
    // serializa via fila para evitar overwrites concorrentes
    const task = async () => {
      if(!isPinEnabled()){
        safe.set("state:"+examId, JSON.stringify({v:1, data: state}));
        return true;
      }
      if(!_cryptoKey){
        return false;
      }
      const enc = await encryptString(JSON.stringify(state), _cryptoKey);
      safe.set("state:"+examId, JSON.stringify({v:2, data: enc}));
      return true;
    };
    const p = _saveQueue.then(task, task);
    // atualizar fila sem deixar rejeição quebrar
    _saveQueue = p.catch(()=>{});
    return p;
  }
  function clearState(examId){
    safe.remove("state:"+examId);
  }
  function clearAllStates(){
    try{
      const keys=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k && k.startsWith(PREFIX+"state:")) keys.push(k);
      }
      keys.forEach(k=>{ try{localStorage.removeItem(k);}catch{} });
    }catch{}
  }
  // nomes explícitos para evitar confusão
  function resetContentOnly(){
    clearProgress();
    clearAllStates();
    safe.remove("notesEnabled");
    // mantém prefs e PIN intencionalmente
  }
  function resetEverythingIncludingPin(){
    try{
      const keys=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach(k=>{ try{localStorage.removeItem(k);}catch{} });
    }catch{}
    _cryptoKey=null;
    resetAttempts();
  }
  // alias compatíveis (deprecados)
  const clearAll = resetContentOnly;
  const wipeEverything = resetEverythingIncludingPin;
  async function wipeEverythingWithCaches(){
    resetEverythingIncludingPin();
    try{
      if(typeof caches !== "undefined" && caches.keys){
        const keys = await caches.keys();
        await Promise.all(keys.map(k=> caches.delete(k)));
      }
    }catch{}
  }

  return {getPrefs, savePrefs, getProgress, saveProgress, clearProgress, notesEnabled, setNotesEnabled, getStateAsync, saveState, clearState, clearAllStates, clearAll, resetContentOnly, wipeEverything, resetEverythingIncludingPin, wipeEverythingWithCaches, PREFIX, isPinEnabled, isUnlocked, verifyPin, unlockPin, lockPin, enablePin, disablePin, changePin, listExamIds, isLockedOut, PBKDF2_ITERATIONS, PIN_MIN_LEN, _cryptoKey: ()=>_cryptoKey};
})();