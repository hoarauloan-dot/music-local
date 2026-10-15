'use strict';
/* Loan's Music 0.6 — Windows/Chrome uniquement. */
(() => {
  if (!('showDirectoryPicker' in window) ||
      !/Windows/i.test(navigator.userAgent) ||
      document.getElementById('loan-pc-connect')) return;
  const panel = document.getElementById('youtube-panel');
  if (!panel) return;

  let directory = null, scanning = false, paused = false;
  const storage = new Promise((resolve, reject) => {
    const request = indexedDB.open('loan-pc-sync-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('settings');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  // La promesse peut échouer avant la première interaction.
  storage.catch(() => {});
  async function setting(key, value, remove = false) {
    const database = await storage;
    return new Promise((resolve, reject) => {
      const writing = arguments.length > 1;
      const tx = database.transaction('settings', writing ? 'readwrite' : 'readonly');
      const store = tx.objectStore('settings');
      const request = writing ? (remove ? store.delete(key) : store.put(value, key)) : store.get(key);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || Error('Sauvegarde interrompue.'));
      tx.onerror = () => reject(tx.error);
    });
  }
  const box = document.createElement('div');
  box.style.cssText = 'margin:16px 0;padding:14px;border:1px solid #333;border-radius:14px';
  const connect = document.createElement('button');
  connect.id = 'loan-pc-connect';
  connect.type = 'button';
  connect.textContent = 'Connecter le dossier LoanMusic';
  const disconnect = document.createElement('button');
  disconnect.type = 'button';
  disconnect.textContent = 'Déconnecter';
  disconnect.hidden = true;
  const status = document.createElement('p');
  status.className = 'hint';
  status.setAttribute('role', 'status');
  status.textContent = 'PC : sélectionne Musique → LoanMusic pour activer l’import automatique.';
  box.append(connect, disconnect, status);
  panel.prepend(box);

  async function scan() {
    if (!directory || scanning || paused || document.hidden || !db) return;
    scanning = true;
    const current = directory;
    try {
      if (await current.queryPermission({mode: 'read'}) !== 'granted') {
        status.textContent = 'Autorisation nécessaire : clique sur « Reconnecter / reprendre ».';
        return;
      }
      for await (const [name, handle] of current.entries()) {
        if (current !== directory || paused || document.hidden) break;
        if (handle.kind !== 'file' || !/^[A-Za-z0-9_-]{11}\.loan-ready\.json$/.test(name)) continue;
        const receiptFile = await handle.getFile();
        if (receiptFile.size > 4096) continue;
        let receipt;
        try { receipt = JSON.parse((await receiptFile.text()).replace(/^\uFEFF/, '')); }
        catch { continue; }
        if (receipt.version !== 1 || !/^[A-Za-z0-9_-]{11}$/.test(receipt.id) ||
            name !== receipt.id + '.loan-ready.json' ||
            typeof receipt.file !== 'string' || !receipt.file.toLowerCase().endsWith('.mp3') ||
            /[\\/\x00-\x1f]/.test(receipt.file) ||
            !Number.isSafeInteger(receipt.size) || receipt.size <= 0) continue;
        let file;
        try { file = await (await current.getFileHandle(receipt.file)).getFile(); }
        catch (error) { if (error.name === 'NotFoundError') continue; throw error; }
        if (file.size !== receipt.size) continue;
        const fingerprint = JSON.stringify([file.name, file.size, file.lastModified]);
        if (await setting('done:' + fingerprint)) continue;
        if (current !== directory) break;
        status.textContent = 'Import de « ' + file.name + ' »…';
        const result = await importMusicFiles([file]);
        if (result.busy) break;
        if (result.failures.length) throw Error(result.failures.join('\n'));
        await setting('done:' + fingerprint, true);
        status.textContent = 'Import terminé. Les prochains téléchargements seront ajoutés automatiquement.';
      }
    } catch (error) {
      paused = true;
      status.textContent = 'Import automatique en pause : ' + error.message + ' Clique sur « Reconnecter / reprendre » pour réessayer.';
    } finally { scanning = false; }
  }

  connect.onclick = async () => {
    connect.disabled = true;
    try {
      if (directory) {
        if (await directory.requestPermission({mode: 'read'}) !== 'granted') {
          status.textContent = 'Accès non autorisé. Tu peux réessayer ou déconnecter le dossier.';
          return;
        }
      } else {
        // À appeler directement depuis le clic pour conserver l’activation utilisateur.
        const picked = await window.showDirectoryPicker({id: 'loan-music-downloads', mode: 'read'});
        await setting('directory', picked);
        directory = picked;
      }
      paused = false;
      connect.textContent = 'Reconnecter / reprendre';
      disconnect.hidden = false;
      status.textContent = 'Dossier connecté : ' + directory.name + '. Import automatique actif quand Loan’s Music est visible.';
      await scan();
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = 'Connexion impossible : ' + error.message;
    } finally { connect.disabled = false; }
  };
  disconnect.onclick = async () => {
    directory = null;
    paused = true;
    try {
      await setting('directory', null, true);
      connect.textContent = 'Connecter le dossier LoanMusic';
      disconnect.hidden = true;
      status.textContent = 'Dossier déconnecté. Tes morceaux importés sont conservés.';
    } catch (error) { status.textContent = 'Déconnexion non enregistrée : ' + error.message; }
  };

  function addDownloadButtons() {
    for (const card of panel.querySelectorAll('.youtube-card')) {
      if (card.querySelector('.loan-pc-download')) continue;
      const anchor = card.querySelector('a.youtube-open');
      if (!anchor) continue;
      const id = new URL(anchor.href).searchParams.get('v');
      if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'primary loan-pc-download';
      button.textContent = 'Télécharger sur PC';
      button.onclick = () => {
        if (!directory) {
          status.textContent = 'Connecte d’abord Musique → LoanMusic avec le bouton ci-dessus.';
          box.scrollIntoView({block: 'nearest'});
          return;
        }
        // Seulement un identifiant YouTube validé, jamais une commande ou un chemin.
        window.location.href = 'loansmusic://download/' + id;
        status.textContent = 'Demande envoyée à Windows. Accepte l’ouverture de Loan’s Import si Chrome le demande. Reviens ici après le téléchargement.';
      };
      card.querySelector('.actions')?.append(button);
    }
  }
  new MutationObserver(addDownloadButtons).observe(panel, {childList: true, subtree: true});
  addDownloadButtons();
  setInterval(scan, 3000);
  window.addEventListener('focus', scan);
  document.addEventListener('visibilitychange', scan);
  (async () => {
    try {
      const saved = await setting('directory');
      if (!saved || directory) return;
      directory = saved;
      connect.textContent = 'Reconnecter / reprendre';
      disconnect.hidden = false;
      status.textContent = 'Dossier mémorisé : ' + saved.name + '. Vérification de l’autorisation…';
      if (await saved.queryPermission({mode: 'read'}) === 'granted') {
        status.textContent = 'Import automatique actif quand Loan’s Music est visible.';
        await scan();
      } else status.textContent = 'Clique sur « Reconnecter / reprendre » pour autoriser l’accès au dossier.';
    } catch (error) { status.textContent = 'Dossier non restauré : ' + error.message; }
  })();
})();
