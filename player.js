
'use strict';
const $ = id => document.getElementById(id);
const audio = $('audio');
let db, tracks = [], queue = [], originalQueue = [], currentId = null, favoriteFilter = false;
let shuffle = false, repeat = 0, editingId = null, selectionToken = 0, preparingToken = 0;
let activeURL = null, prepared = null, scrubbing = false;
const finite = n => Number.isFinite(n) ? n : 0;
const time = n => { n = Math.floor(Math.max(0, finite(n))); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2,'0'); };
const trackById = id => tracks.find(t => t.id === id);
function notify(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = false; }
function openDB() { return new Promise((resolve,reject) => {
 const request = indexedDB.open('music-local-v1',2);
 request.onupgradeneeded = () => { const d=request.result; if(!d.objectStoreNames.contains('tracks'))d.createObjectStore('tracks',{keyPath:'id'}); if(!d.objectStoreNames.contains('files'))d.createObjectStore('files'); if(!d.objectStoreNames.contains('playlists'))d.createObjectStore('playlists',{keyPath:'id'}); };
 request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); notify('Le stockage a changé. Rouvre le lecteur.',true); }; resolve(request.result); };
 request.onerror = () => reject(request.error);
 request.onblocked = () => notify('Ferme les autres onglets du lecteur puis réessaie.',true);
}); }
function read(store, key) { return new Promise((resolve,reject) => {
 const tx = db.transaction(store,'readonly'); const request = key === undefined ? tx.objectStore(store).getAll() : tx.objectStore(store).get(key);
 request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
}); }
function writeTrack(track, file, remove = false) { return new Promise((resolve,reject) => {
 const tx = db.transaction(['tracks','files'],'readwrite');
 if(remove) { tx.objectStore('tracks').delete(track.id); tx.objectStore('files').delete(track.id); }
 else { tx.objectStore('tracks').put(track); if(file) tx.objectStore('files').put(file,track.id); }
 tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Écriture interrompue'));
}); }
function shownTracks() { const query = $('search').value.trim().toLocaleLowerCase(); return tracks.filter(t => (!favoriteFilter || t.favorite) && (t.title+' '+t.artist).toLocaleLowerCase().includes(query)); }
function render() {
 const list = $('tracks'); list.replaceChildren();
 const shown = shownTracks(); $('count').textContent = shown.length + (shown.length > 1 ? ' titres' : ' titre');
 if(!shown.length) { const empty = document.createElement('div'); empty.className = 'empty'; const title = document.createElement('strong'); title.textContent = tracks.length ? 'Aucun résultat' : 'Ta première écoute commence ici'; empty.append(title,document.createTextNode(tracks.length ? 'Essaie un autre filtre.' : 'Ajoute deux morceaux pour tester le lecteur.')); list.append(empty); }
 for(const t of shown) {
  const row = document.createElement('div'); row.className = 'track' + (t.id === currentId ? ' active' : '');
  const button = document.createElement('button'); button.className = 'track-main';
  const art = document.createElement('span'); art.className = 'art'; art.textContent = t.favorite ? '♥' : '♫'; art.setAttribute('aria-hidden','true');
  const text = document.createElement('span'); text.className = 'track-text';
  const title = document.createElement('b'); title.textContent = t.title;
  const subtitle = document.createElement('small'); subtitle.textContent = t.artist + ' · ' + t.ext.toUpperCase();
  text.append(title,subtitle); button.append(art,text); button.onclick = () => startQueue(t.id, shown.map(x=>x.id));
  const more = document.createElement('button'); more.className = 'more'; more.textContent = '⋯'; more.setAttribute('aria-label','Modifier '+t.title); more.onclick = () => openEditor(t.id);
  row.append(button,more); list.append(row);
 }
 $('storage').textContent = (tracks.reduce((sum,t)=>sum+t.size,0)/1048576).toFixed(1) + ' Mo de fichiers sur cet appareil';
 renderQueue(); syncUI();
}
function renderQueue() {
 $('queue').replaceChildren(); if(!queue.length) return;
 const heading = document.createElement('h2'); heading.textContent = 'File d’attente'; $('queue').append(heading);
 queue.forEach(id => { const t=trackById(id); if(!t)return; const b=document.createElement('button'); b.textContent=(id===currentId?'♫  ':'')+t.title; b.className=id===currentId?'active':''; b.onclick=()=>selectTrack(id); $('queue').append(b); });
}
function randomized(ids) { const a=[...ids]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function startQueue(id, ids) { originalQueue=[...ids]; queue=shuffle?[id,...randomized(ids.filter(x=>x!==id))]:[...ids]; selectTrack(id); }
function discardPrepared() { preparingToken++; if(prepared) URL.revokeObjectURL(prepared.url); prepared=null; }
function nextId(automatic=false) {
 if(!currentId || !queue.length)return null;
 if(automatic && repeat===2)return currentId;
 const index=queue.indexOf(currentId); return queue[index+1] || (repeat===1?queue[0]:null);
}
async function prepareNext() {
 discardPrepared(); const token=preparingToken; const id=nextId(); if(!id || id===currentId)return;
 try { const file=await read('files',id); if(token!==preparingToken || !file)return; prepared={id,url:URL.createObjectURL(file)}; } catch { /* Sélection manuelle possible si la préparation échoue. */ }
}
async function selectTrack(id) {
 const t=trackById(id); if(!t)return;
 const token=++selectionToken;
 let url;
 try {
  if(prepared?.id===id) { url=prepared.url; prepared=null; }
  else { const file=await read('files',id); if(token!==selectionToken)return; if(!file)throw new Error('Copie locale introuvable. Réimporte le fichier.'); url=URL.createObjectURL(file); }
  if(token!==selectionToken) { URL.revokeObjectURL(url); return; }
  audio.pause(); if(activeURL)URL.revokeObjectURL(activeURL); activeURL=url; currentId=id;
  audio.src=url; audio.load();
  const promise=audio.play(); render(); updateMedia(); prepareNext();
  await promise;
 } catch(error) { if(token===selectionToken)notify(error.name==='NotAllowedError'?'Appuie sur ▶ pour autoriser la lecture dans Safari.':('Lecture impossible : '+error.message),true); }
}
async function togglePlay() { if(!currentId)return; if(!audio.paused)audio.pause(); else { try { if(audio.ended)audio.currentTime=0; await audio.play(); } catch(error){notify('Lecture impossible : '+error.message,true);} } }
function next(automatic=false) { const id=nextId(automatic); if(id===currentId && automatic) { audio.currentTime=0; audio.play().catch(()=>notify('Appuie sur ▶ pour reprendre.',true)); } else if(id)selectTrack(id); }
function previous() { if(audio.currentTime>3){audio.currentTime=0;return;} const i=queue.indexOf(currentId); if(i>0)selectTrack(queue[i-1]); else audio.currentTime=0; }
function syncUI() {
 const t=trackById(currentId); $('mini').hidden=!t;
 if(t){$('mini-title').textContent=t.title; $('mini-artist').textContent=t.artist; $('now-title').textContent=t.title; $('now-artist').textContent=t.artist;}
 for(const id of ['mini-play','play']) { $(id).textContent=audio.paused?'▶':'Ⅱ'; $(id).setAttribute('aria-label',audio.paused?'Lecture':'Pause'); }
 $('shuffle').textContent='Aléatoire : '+(shuffle?'oui':'non'); $('shuffle').classList.toggle('on',shuffle); $('shuffle').setAttribute('aria-pressed',String(shuffle));
 $('repeat').textContent='Répéter : '+['non','la file','ce titre'][repeat]; $('repeat').classList.toggle('on',repeat!==0);
 $('next').disabled=$('mini-next').disabled=!nextId();
}
function updateMedia() {
 if(!('mediaSession' in navigator))return;
 const t=trackById(currentId);
 navigator.mediaSession.metadata=t?new MediaMetadata({title:t.title,artist:t.artist,album:"Loan's Music",artwork:[{src:new URL('./icon.png?v=4',location.href).href,sizes:'512x512',type:'image/png'}]}):null;
 navigator.mediaSession.playbackState=!t?'none':audio.paused?'paused':'playing'; updatePosition();
}
function updatePosition() { if(navigator.mediaSession?.setPositionState && Number.isFinite(audio.duration) && audio.duration>0){try{navigator.mediaSession.setPositionState({duration:audio.duration,playbackRate:audio.playbackRate,position:Math.min(audio.duration,Math.max(0,audio.currentTime))});}catch{}} }
function stop() { ++selectionToken; audio.pause(); audio.removeAttribute('src'); audio.load(); if(activeURL)URL.revokeObjectURL(activeURL); activeURL=null; discardPrepared(); currentId=null; $('player-dialog').close(); updateMedia(); }
function openEditor(id) { const t=trackById(id); editingId=id; $('edit-title').value=t.title; $('edit-artist').value=t.artist; $('favorite-track').textContent=t.favorite?'♥ Retirer le favori':'♡ Ajouter aux favoris'; $('editor').showModal(); }
$('edit-form').onsubmit=async event=>{event.preventDefault(); const title=$('edit-title').value.trim(); if(!title)return; const track={...trackById(editingId),title,artist:$('edit-artist').value.trim()||'Artiste inconnu'}; try{await writeTrack(track); tracks=tracks.map(t=>t.id===track.id?track:t); $('editor').close(); render(); updateMedia();}catch{notify('Modification non enregistrée.',true);} };
$('favorite-track').onclick=async()=>{const track={...trackById(editingId)};track.favorite=!track.favorite;try{await writeTrack(track);tracks=tracks.map(t=>t.id===track.id?track:t);$('editor').close();render();}catch{notify('Favori non enregistré.',true);} };
$('delete-track').onclick=async()=>{const t=trackById(editingId);if(!confirm('Supprimer « '+t.title+' » du lecteur ? Ton fichier original sera conservé.'))return;try{await writeTrack(t,null,true);if(t.id===currentId)stop();tracks=tracks.filter(x=>x.id!==t.id);queue=queue.filter(x=>x!==t.id);originalQueue=originalQueue.filter(x=>x!==t.id);prepareNext();$('editor').close();render();}catch{notify('Suppression impossible.',true);} };
$('import').onclick=()=>$('files').click();
$('files').onchange=async()=>{
 const files=[...$('files').files]; if(!files.length)return; $('import').disabled=true;
 const failures=[]; let added=0,duplicates=0;
 try{
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>false);
  for(let i=0;i<files.length;i++) {
   const file=files[i]; $('import-progress').textContent=`Import ${i+1}/${files.length} : ${file.name}`;
   const ext=file.name.split('.').pop().toLowerCase();
   if(!['mp3','m4a','wav','mp4'].includes(ext) || !file.size) {failures.push(file.name+' : format ou fichier invalide.');continue;}
   if(tracks.some(t=>t.sourceName===file.name && t.size===file.size && t.modified===file.lastModified)){duplicates++;continue;}
   const track={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,''),artist:'Artiste inconnu',sourceName:file.name,size:file.size,modified:file.lastModified,ext,favorite:false};
   try{const tags=await MusicMetadata.read(file); Object.assign(track,tags); track.importedAt=Date.now(); const types={mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',mp4:'video/mp4'};await writeTrack(track,file.slice(0,file.size,file.type||types[ext]));tracks.push(track);added++;}
   catch(error){failures.push(file.name+' : '+(error.name==='QuotaExceededError'?'espace de stockage insuffisant.':error.message));break;}
  }
  render(); notify(`${added} morceau(s) importé(s). ${duplicates?duplicates+' fichier(s) déjà présent(s).':''}${failures.length?'\n'+failures.join('\n'):''}`,failures.length>0);
 }finally{$('files').value='';$('import-progress').textContent='';$('import').disabled=false;}
};
$('search').oninput=render;
$('favorites').onclick=()=>{favoriteFilter=!favoriteFilter;$('favorites').setAttribute('aria-pressed',String(favoriteFilter));$('favorites').textContent=favoriteFilter?'♥':'♡';render();};
$('open-player').onclick=()=>$('player-dialog').showModal(); $('close-player').onclick=()=>$('player-dialog').close(); $('close-editor').onclick=()=>$('editor').close();
$('mini-play').onclick=$('play').onclick=togglePlay; $('next').onclick=$('mini-next').onclick=()=>next(); $('previous').onclick=previous;
$('shuffle').onclick=()=>{shuffle=!shuffle;if(currentId){queue=shuffle?[currentId,...randomized(originalQueue.filter(id=>id!==currentId))]:[...originalQueue];prepareNext();}render();};
$('repeat').onclick=()=>{repeat=(repeat+1)%3;prepareNext();syncUI();};
$('seek').oninput=()=>{scrubbing=true;$('elapsed').textContent=time(Number($('seek').value));};
$('seek').onchange=()=>{audio.currentTime=Number($('seek').value);scrubbing=false;updatePosition();};
for(const event of ['play','pause','loadedmetadata','durationchange'])audio.addEventListener(event,()=>{syncUI();updateMedia();});
audio.addEventListener('ended',()=>{syncUI();next(true);});
audio.addEventListener('error',()=>{if(currentId){notify('Ce fichier ne peut pas être lu. Essaie un MP3 ou un M4A compatible.',true);syncUI();}});
audio.addEventListener('timeupdate',()=>{const duration=finite(audio.duration);$('seek').max=String(duration||1);if(!scrubbing){$('seek').value=String(audio.currentTime||0);$('elapsed').textContent=time(audio.currentTime);}$('duration').textContent=time(duration);$('progress').style.width=(duration?audio.currentTime/duration*100:0)+'%';updatePosition();});
if('mediaSession' in navigator){for(const [name,handler] of Object.entries({play:()=>audio.play().catch(()=>notify('Ouvre le lecteur et appuie sur ▶.',true)),pause:()=>audio.pause(),nexttrack:()=>next(),previoustrack:previous,seekto:e=>{if(Number.isFinite(e.seekTime)&&Number.isFinite(audio.duration)){audio.currentTime=Math.min(audio.duration,Math.max(0,e.seekTime));updatePosition();}}})){try{navigator.mediaSession.setActionHandler(name,handler);}catch{}}}
async function setupOffline() {
 if(!('serviceWorker' in navigator)){$('offline').textContent='Mode hors ligne indisponible dans ce navigateur.';return;}
 try{
  await navigator.serviceWorker.register('./sw.js');
  const registration=await navigator.serviceWorker.ready;
  const channel=new MessageChannel();
  channel.port1.onmessage=event=>{if(event.data==='READY')$('offline').textContent="Prêt hors ligne · Loan's Music 0.4";};
  registration.active.postMessage('CHECK_READY',[channel.port2]);
 }catch{$('offline').textContent='Mode hors ligne non prêt. Rouvre la page avec Internet.';}
}
