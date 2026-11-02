'use strict';
/* Loan relay 0.7 — opt-in receiver on iPhone/iPad, no external SDK. */
(() => {
  if (!(/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))) return;
  const panel = document.getElementById('youtube-panel');
  if (!panel || document.getElementById('loan-cloud')) return;
  const KEY = 'loan-relay-session-v1';
  const MAX = 30 * 1024 * 1024;
  let config = null, busy = false;
  try { config = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  const box = document.createElement('details');
  box.id = 'loan-cloud';
  box.style.cssText = 'margin:16px 0;padding:16px;border:1px solid #444;border-radius:14px';
  const heading = document.createElement('summary');
  heading.textContent = 'Import automatique iPhone';
  const status = document.createElement('p');
  status.className = 'hint';
  status.setAttribute('role', 'status');
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Configurer le transfert privé';
  const form = document.createElement('form');
  function field(label, type, autocomplete) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.required = true;
    input.autocomplete = autocomplete;
    input.autocapitalize = 'none';
    input.spellcheck = false;
    wrap.append(input);
    form.append(wrap);
    return input;
  }
  const url = field('Project URL', 'url', 'off');
  const key = field('Publishable key', 'text', 'off');
  const email = field('Email du compte de transfert', 'email', 'username');
  const password = field('Mot de passe du compte de transfert', 'password', 'current-password');
  url.placeholder = 'https://IDENTIFIANT.supabase.co';
  key.placeholder = 'sb_publishable_…';
  const connect = document.createElement('button');
  connect.type = 'submit'; connect.textContent = 'Connecter et activer';
  form.append(connect);
  details.append(summary, form);
  const check = document.createElement('button');
  check.type = 'button'; check.textContent = 'Vérifier les imports';
  const disconnect = document.createElement('button');
  disconnect.type = 'button'; disconnect.textContent = 'Déconnecter le relais';
  box.append(heading, status, check, disconnect, details);
  panel.append(box);
  if (config) {
    url.value = config.url || ''; key.value = config.key || ''; email.value = config.email || '';
  }
  details.open = !config;
  status.textContent = config ? 'Relais connecté. Vérification au retour dans l’application.' : 'Désactivé : configure ton relais privé pour commencer.';

  function validate(c) {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.url) || !c.key.startsWith('sb_publishable_'))
      throw Error('Vérifie la Project URL et la clé Publishable (sb_publishable_).');
  }
  async function api(c, path, options = {}, binary = false, authenticated = true) {
    validate(c);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch(c.url + path, {
        ...options, credentials: 'omit', cache: 'no-store', redirect: 'error',
        signal: controller.signal,
        headers: {
          apikey: c.key,
          ...(authenticated ? {Authorization: 'Bearer ' + c.session.access_token} : {}),
          ...(options.body ? {'Content-Type': 'application/json'} : {})
        }
      });
      if (!response.ok) throw Error('Relais HTTP ' + response.status + ' : vérifie le compte, le projet et ses règles SQL.');
      if (!binary) return response.json();
      // Cap downloaded bytes even if the server metadata/content-length is wrong.
      const reader = response.body.getReader();
      let size = 0;
      const parts = [];
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX) throw Error('Fichier supérieur à 30 Mio.');
          parts.push(value);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      return new Blob(parts, {type: 'audio/mpeg'});
    } finally { clearTimeout(timer); }
  }
  async function session(c) {
    if ((c.session.expires_at || 0) * 1000 > Date.now() + 60000) return;
    const refreshed = await api(c, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({refresh_token: c.session.refresh_token})
    }, false, false);
    c.session = refreshed;
    if (config === c) localStorage.setItem(KEY, JSON.stringify(c));
  }
  function decodeName(value) {
    const match = /^(\d{10,16})_([a-f0-9]{64})_([A-Za-z0-9_-]{1,600})\.mp3$/.exec(value);
    if (!match) throw Error('Nom de transfert non reconnu.');
    let encoded = match[3].replace(/-/g, '+').replace(/_/g, '/');
    encoded += '='.repeat((4 - encoded.length % 4) % 4);
    const name = new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)));
    if (!name.endsWith('.mp3') || /[\/\\\x00-\x1f]/.test(name)) throw Error('Nom de MP3 invalide.');
    return {name, modified: Number(match[1]), hash: match[2]};
  }
  async function consume(c, object) {
    const info = decodeName(object.name);
    const uid = c.session.user.id;
    const path = uid + '/' + object.name;
    const receipt = 'loan-relay-done:' + c.url + ':' + path;
    const acknowledged = localStorage.getItem(receipt) === '1';
    if (!acknowledged) {
      const size = Number(object.metadata?.size);
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX) throw Error('Taille de MP3 invalide.');
      status.textContent = 'Import de « ' + info.name + ' »…';
      const blob = await api(c, '/storage/v1/object/authenticated/loan-inbox/' + path, {}, true);
      if (blob.size !== size) throw Error('Transfert incomplet. Nouvelle tentative au prochain retour.');
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      if (actual !== info.hash) throw Error('Le fichier reçu ne correspond pas au MP3 envoyé.');
      if (config !== c) return;
      const result = await importMusicFiles([new File([blob], info.name, {
        type: 'audio/mpeg', lastModified: info.modified
      })]);
      if (result.busy) throw Error('Un autre import est en cours. Réessaie dans quelques secondes.');
      if (result.failures.length || result.added + result.duplicates !== 1)
        throw Error(result.failures.join('\n') || 'Import non confirmé.');
      // A durable receipt MUST precede remote deletion. On quota errors keep remote file.
      localStorage.setItem(receipt, '1');
    }
    if (config !== c) return;
    await api(c, '/storage/v1/object/loan-inbox', {
      method: 'DELETE', body: JSON.stringify({prefixes: [path]})
    });
  }
  async function scan() {
    if (!config || busy || document.hidden || !navigator.onLine) return;
    if (!window.loanLibraryReady || typeof importMusicFiles !== 'function') {
      status.textContent = 'Bibliothèque pas encore prête. Vérifie les modifications de app.js et player.js.';
      return;
    }
    busy = true; connect.disabled = true;
    const c = config;
    try {
      await session(c);
      // Snapshot paginated names BEFORE deleting, so offsets cannot skip files.
      const objects = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api(c, '/storage/v1/object/list/loan-inbox', {
          method: 'POST', body: JSON.stringify({prefix: c.session.user.id + '/', limit: 100, offset,
            sortBy: {column: 'name', order: 'asc'}})
        });
        if (!Array.isArray(page)) throw Error('Liste de fichiers non reconnue.');
        objects.push(...page.filter(o => o.id));
        if (page.length < 100) break;
        if (offset >= 9900) throw Error('Trop de fichiers en attente. Vérifie le relais.');
      }
      for (const object of objects) {
        if (config !== c || document.hidden) break;
        await consume(c, object);
      }
      if (config === c) status.textContent = 'Vérification terminée. Les imports reprennent automatiquement au retour dans l’application.';
    } catch (error) {
      if (config === c) status.textContent = 'Import en attente : ' +
        (error.name === 'AbortError' ? 'connexion trop lente.' : error.message) +
        ' Le MP3 reste conservé. Tu peux réessayer ou te reconnecter.';
    } finally { busy = false; connect.disabled = false; }
  }
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    busy = true; connect.disabled = true;
    try {
      const c = {url: url.value.trim().replace(/\/$/, ''), key: key.value.trim(), email: email.value.trim()};
      validate(c);
      c.session = await api(c, '/auth/v1/token?grant_type=password', {
        method: 'POST', body: JSON.stringify({email: c.email, password: password.value})
      }, false, false);
      localStorage.setItem(KEY, JSON.stringify(c));
      config = c; password.value = ''; details.open = false;
      status.textContent = 'Relais connecté.';
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; connect.disabled = false; }
    await scan();
  };
  disconnect.onclick = () => {
    config = null;
    try { localStorage.removeItem(KEY); } catch {}
    details.open = true;
    status.textContent = 'Relais déconnecté. Tes morceaux importés sont conservés.';
  };
  check.onclick = scan;
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scan(); });
  window.addEventListener('pageshow', scan);
  window.addEventListener('online', scan);
  setTimeout(scan, 2500);
  setInterval(scan, 20000);
})();
