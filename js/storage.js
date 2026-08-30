/* storage.js — armazenamento mínimo, privado, local-only.
    Nunca envia dados para rede. Sem analytics, sem cookies externos.
    Chaves:
      anima:prefs -> {theme, prayerLang}
      anima:progress -> {examId, sectionIndex}  (apenas posição, não respostas)
      anima:state:{examId} -> {marks, notes}  (opt-in, local — texto puro ou AES-GCM se PIN ativo)
      anima:notesEnabled -> boolean
      anima:pinSalt -> base64 salt para PBKDF2 (se PIN configurado)
      anima:pinCheck -> verificação cifrada "anima-pin-check" (para validar PIN)
    Auditoria (Fase 2):
      - Sensível (conteúdo do usuário): anima:state:{exame} (marcações + anotações)
      - Não sensível (metadados): anima:prefs, anima:progress, anima:notesEnabled
      Apenas anima:state:* é cifrado quando PIN está ativo. Metadados permanecem em claro por não conter conteúdo íntimo.
*/
const Storage = (() => {
  const PREFIX = "anima:";
  const PIN_SALT_KEY = "pinSalt";
  const PIN_CHECK_KEY = "pinCheck";
  const PIN_CHECK_PLAINTEXT = "anima-pin-check";
  let _cryptoKey = null; // CryptoKey em memória (sessão) quando desbloqueado
  let _pinSaltB64 = null; // cache

  const safe = {
    get(key){
      try { return localStorage.getItem(PREFIX+key); } catch { return null; }
    },
    set(key, val){
      try { localStorage.setItem(PREFIX+key, val); return true; } catch(e) {
        // Propagar QuotaExceededError para UI sem expor conteúdo no console
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

  // ---------- helpers base64 ----------
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

  // ---------- WebCrypto PBKDF2 + AES-GCM ----------
  async function deriveKey(pin, saltBytes){
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      {name:"PBKDF2", salt: saltBytes, iterations: 120000, hash:"SHA-256"},
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

  function isPinEnabled(){
    return !!safe.get(PIN_SALT_KEY) && !!safe.get(PIN_CHECK_KEY);
  }
  function isUnlocked(){
    return _cryptoKey !== null;
  }
  async function verifyPin(pin){
    const salt = loadSalt();
    if(!salt) return false;
    try{
      const key = await deriveKey(pin, salt);
      const check = safe.get(PIN_CHECK_KEY);
      const dec = await decryptString(check, key);
      return dec === PIN_CHECK_PLAINTEXT;
    }catch{ return false; }
  }
  async function unlockPin(pin){
    const salt = loadSalt();
    if(!salt) return false;
    try{
      const key = await deriveKey(pin, salt);
      const check = safe.get(PIN_CHECK_KEY);
      const dec = await decryptString(check, key);
      if(dec !== PIN_CHECK_PLAINTEXT) return false;
      _cryptoKey = key;
      _pinSaltB64 = safe.get(PIN_SALT_KEY);
      return true;
    }catch{ return false; }
  }
  function lockPin(){
    _cryptoKey = null;
  }
  async function enablePin(pin){
    if(!pin || pin.length < 4) throw new Error("PIN deve ter ao menos 4 caracteres");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = bufToB64(salt);
    const key = await deriveKey(pin, salt);
    const check = await encryptString(PIN_CHECK_PLAINTEXT, key);
    // Re-cifrar todos os states existentes de texto puro para cifrado
    const examIds = ["completo","rapido","diario"];
    const plainStates = {};
    for(const id of examIds){
      const raw = safe.get("state:"+id);
      if(raw){
        // tentar detectar se já é cifrado (contém "." e não é JSON válido com marks)
        try{
          const j = JSON.parse(raw);
          if(j.marks !== undefined || j.notes !== undefined){
            plainStates[id]=raw;
          } else {
            // pode ser cifrado legado? ignorar
          }
        }catch{
          // se não é JSON, é cifrado legado — já cifrado, manter
        }
      }
    }
    safe.set(PIN_SALT_KEY, saltB64);
    safe.set(PIN_CHECK_KEY, check);
    _cryptoKey = key;
    _pinSaltB64 = saltB64;
    // recifra
    for(const [id, raw] of Object.entries(plainStates)){
      const enc = await encryptString(raw, key);
      safe.set("state:"+id, enc);
    }
    return true;
  }
  async function disablePin(pin){
    // requer PIN atual para descriptografar e voltar a texto puro
    const ok = await verifyPin(pin);
    if(!ok) return false;
    // se ainda não desbloqueado, desbloqueia
    if(!_cryptoKey) await unlockPin(pin);
    const key = _cryptoKey;
    const examIds = ["completo","rapido","diario"];
    for(const id of examIds){
      const raw = safe.get("state:"+id);
      if(raw){
        try{
          const dec = await decryptString(raw, key);
          safe.set("state:"+id, dec);
        }catch{
          // se já é texto puro (JSON), mantém
        }
      }
    }
    safe.remove(PIN_SALT_KEY);
    safe.remove(PIN_CHECK_KEY);
    _cryptoKey = null;
    _pinSaltB64 = null;
    return true;
  }
  async function changePin(oldPin, newPin){
    const ok = await verifyPin(oldPin);
    if(!ok) return false;
    await unlockPin(oldPin);
    // descriptografa tudo com old key, gera novo salt/key e recifra
    const oldKey = _cryptoKey;
    const examIds = ["completo","rapido","diario"];
    const plains = {};
    for(const id of examIds){
      const raw = safe.get("state:"+id);
      if(raw){
        try{ plains[id] = await decryptString(raw, oldKey); }catch{ plains[id]=raw; }
      }
    }
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newSaltB64 = bufToB64(newSalt);
    const newKey = await deriveKey(newPin, newSalt);
    const newCheck = await encryptString(PIN_CHECK_PLAINTEXT, newKey);
    safe.set(PIN_SALT_KEY, newSaltB64);
    safe.set(PIN_CHECK_KEY, newCheck);
    _cryptoKey = newKey;
    _pinSaltB64 = newSaltB64;
    for(const [id, plain] of Object.entries(plains)){
      const enc = await encryptString(plain, newKey);
      safe.set("state:"+id, enc);
    }
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

  // state per exam: {marks: { "sectionId:qIndex": "none"|"reflect"|"confess", notes: { "sectionId:qIndex": string } }
  // Suporte a estados cifrados: se PIN ativo, o valor em localStorage é "ivB64.cipherB64" (AES-GCM). Caso bloqueado, retorna {_locked:true}.
  function getStateSync(examId){
    try{
      const raw = safe.get("state:"+examId);
      if(!raw) return {marks:{}, notes:{}};
      // se PIN ativo mas não desbloqueado -> sinalizar bloqueado
      if(isPinEnabled() && !_cryptoKey){
        return {marks:{}, notes:{}, _locked:true};
      }
      if(isPinEnabled() && _cryptoKey){
        // não pode descriptografar de forma síncrona -> retornar locked; usar getStateAsync
        return {marks:{}, notes:{}, _locked:true, _needsAsync:true};
      }
      const j = JSON.parse(raw);
      return {marks: j.marks || {}, notes: j.notes || {}};
    }catch{ return {marks:{}, notes:{}}; }
  }
  // Versão síncrona que tenta lidar com cifrado quando já desbloqueado de forma assíncrona não é possível;
  // por isso mantemos getState como compatível: se cifrado e desbloqueado, tenta descriptografar síncrono via cache plain?
  // Na prática, app.js usará getStateAsync quando PIN ativo.
  function getState(examId){
    // Compat: se PIN não ativo, comportamento clássico
    if(!isPinEnabled()){
      try{
        const raw = safe.get("state:"+examId);
        if(!raw) return {marks:{}, notes:{}};
        const j = JSON.parse(raw);
        return {marks: j.marks || {}, notes: j.notes || {}};
      }catch{ return {marks:{}, notes:{}}; }
    }
    // PIN ativo mas ainda bloqueado
    if(!_cryptoKey){
      return {marks:{}, notes:{}, _locked:true};
    }
    // PIN ativo e desbloqueado — raw está cifrado, mas não podemos descriptografar síncrono; retornar cache se houver
    // Para compat, tentamos descriptografar via operação síncrona não disponível, então retornamos vazio e o caller deve usar async
    // Mantemos fallback: se o valor parece JSON (texto puro legado), retorna direto
    try{
      const raw = safe.get("state:"+examId);
      if(!raw) return {marks:{}, notes:{}};
      // se contém "." e não começa com "{", é cifrado -> precisa async
      if(raw.includes(".") && !raw.trim().startsWith("{")){
        return {marks:{}, notes:{}, _locked:false, _needsAsync:true};
      }
      const j = JSON.parse(raw);
      return {marks: j.marks || {}, notes: j.notes || {}};
    }catch{ return {marks:{}, notes:{}, _needsAsync:true}; }
  }
  async function getStateAsync(examId){
    try{
      const raw = safe.get("state:"+examId);
      if(!raw) return {marks:{}, notes:{}};
      if(!isPinEnabled()){
        const j = JSON.parse(raw);
        return {marks: j.marks || {}, notes: j.notes || {}};
      }
      if(!_cryptoKey){
        return {marks:{}, notes:{}, _locked:true};
      }
      // tentar descriptografar
      try{
        const dec = await decryptString(raw, _cryptoKey);
        const j = JSON.parse(dec);
        return {marks: j.marks || {}, notes: j.notes || {}};
      }catch{
        // pode ser texto puro (caso migração incompleta)
        try{
          const j = JSON.parse(raw);
          return {marks: j.marks || {}, notes: j.notes || {}};
        }catch{
          return {marks:{}, notes:{}};
        }
      }
    }catch{ return {marks:{}, notes:{}}; }
  }
  function saveState(examId, state){
    if(!isPinEnabled()){
      safe.set("state:"+examId, JSON.stringify(state));
      return Promise.resolve(true);
    }
    if(!_cryptoKey){
      // bloqueado: não permitir salvar cifrado sem chave — avisa que precisa desbloquear
      // Para não perder dados, não salva (caller deve desbloquear)
      return Promise.resolve(false);
    }
    // cifrar assíncrono — retornar Promise
    return encryptString(JSON.stringify(state), _cryptoKey).then(enc=>{
      safe.set("state:"+examId, enc);
      return true;
    }).catch(()=>false);
  }
  // saveStateSync para callers que não aguardam (fallback)
  function saveStateSync(examId, state){
    if(!isPinEnabled()){
      safe.set("state:"+examId, JSON.stringify(state));
      return true;
    }
    return false;
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
  function clearAll(){
    clearProgress();
    clearAllStates();
    safe.remove("notesEnabled");
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
    _cryptoKey=null;
    _pinSaltB64=null;
  }
  async function wipeEverythingWithCaches(){
    wipeEverything();
    try{
      if(typeof caches !== "undefined" && caches.keys){
        const keys = await caches.keys();
        await Promise.all(keys.map(k=> caches.delete(k)));
      }
    }catch{}
  }

  return {getPrefs, savePrefs, getProgress, saveProgress, clearProgress, notesEnabled, setNotesEnabled, getState, getStateSync, getStateAsync, saveState, saveStateSync, clearState, clearAllStates, clearAll, wipeEverything, wipeEverythingWithCaches, PREFIX, isPinEnabled, isUnlocked, verifyPin, unlockPin, lockPin, enablePin, disablePin, changePin, _cryptoKey: ()=>_cryptoKey};
})();
