'use strict';
// Interface et collections. Les stores tracks/files de la V0.1 sont conservés.
let playlists=[],tab='titles',detail=null,playlistEditId=null,draftArtwork=null;
let recentIds=[],resumeSnapshot=null,saveTimer=null;
try{recentIds=JSON.parse(localStorage.getItem('ml-recent')||'[]');if(!Array.isArray(recentIds))recentIds=[];resumeSnapshot=JSON.parse(localStorage.getItem('ml-session')||'null');}catch{}
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
function action(label,fn,className=''){const b=node('button',className,label);b.type='button';b.onclick=fn;return b;}
function art(track,className='art'){const el=node('div',className);setArt(el,track);return el;}
function setArt(el,track){el.replaceChildren();if(track?.artwork?.startsWith('data:image/')){const image=node('img');image.src=track.artwork;image.alt='';image.loading='lazy';el.append(image);}else el.textContent='♫';}
function albumKey(t){return JSON.stringify([t.artist||'Artiste inconnu',t.album||'Album inconnu']);}
function collectionTracks(){
 let values=[...tracks];
 if(tab==='favorites')values=values.filter(t=>t.favorite);
 if(detail?.kind==='artist')values=values.filter(t=>t.artist===detail.key);
 if(detail?.kind==='album')values=values.filter(t=>albumKey(t)===detail.key);
 if(detail?.kind==='playlist'){const p=playlists.find(x=>x.id===detail.key);values=(p?.trackIds||[]).map(trackById).filter(Boolean);}
 const query=$('search').value.trim().toLocaleLowerCase();values=values.filter(t=>[t.title,t.artist,t.album||''].join(' ').toLocaleLowerCase().includes(query));
 if(detail?.kind!=='playlist'){
  const mode=$('sort').value;
  values.sort((a,b)=>mode==='recent'?(b.importedAt||0)-(a.importedAt||0):String(a[mode]||'').localeCompare(String(b[mode]||''),'fr',{numeric:true,sensitivity:'base'}));
 }
 return values;
}
shownTracks=collectionTracks;
function setTab(value){tab=value;detail=null;favoriteFilter=false;$('search').value='';render();}
function openDetail(kind,key,name){detail={kind,key,name};$('search').value='';render();}
function writePlaylist(playlist,remove=false){return new Promise((resolve,reject)=>{const tx=db.transaction('playlists','readwrite');if(remove)tx.objectStore('playlists').delete(playlist.id);else tx.objectStore('playlists').put(playlist);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Sauvegarde interrompue'));tx.onerror=()=>reject(tx.error);});}
async function savePlaylist(p){await writePlaylist(p);const index=playlists.findIndex(x=>x.id===p.id);if(index<0)playlists.push(p);else playlists[index]=p;render();}
function editPlaylist(p=null){playlistEditId=p?.id||null;$('playlist-name').value=p?.name||'';$('playlist-dialog-title').textContent=p?'Renommer la playlist':'Nouvelle playlist';$('playlist-dialog').showModal();}
$('playlist-form').onsubmit=async event=>{event.preventDefault();const name=$('playlist-name').value.trim();if(!name)return;const old=playlists.find(p=>p.id===playlistEditId);try{await savePlaylist(old?{...old,name}:{id:crypto.randomUUID(),name,trackIds:[],createdAt:Date.now()});$('playlist-dialog').close();if(detail?.key===old?.id){detail.name=name;render();}}catch(error){notify(error.message,true);}};
$('close-playlist').onclick=()=>$('playlist-dialog').close();
async function movePlaylistTrack(p,id,delta){const ids=[...p.trackIds],i=ids.indexOf(id),j=i+delta;if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];try{await savePlaylist({...p,trackIds:ids});}catch(error){notify(error.message,true);}}
async function removePlaylistTrack(p,id){try{await savePlaylist({...p,trackIds:p.trackIds.filter(x=>x!==id)});}catch(error){notify(error.message,true);}}
function trackRow(t,list){
 const row=node('div','track'+(t.id===currentId?' active':''));
 const button=action('',()=>startQueue(t.id,list.map(x=>x.id)),'track-main');
 const text=node('span','track-text');text.append(node('b','',t.title),node('small','',(t.favorite?'♥ · ':'')+t.artist+' · '+(t.album||t.ext.toUpperCase())));button.append(art(t),text);row.append(button);
 if(t.duration)row.append(node('span','duration-label',time(t.duration)));
 if(detail?.kind==='playlist'){
  const p=playlists.find(x=>x.id===detail.key);const controls=node('span','playlist-tools');
  const up=action('↑',()=>movePlaylistTrack(p,t.id,-1));up.setAttribute('aria-label','Monter '+t.title);up.disabled=p.trackIds.indexOf(t.id)===0;
  const down=action('↓',()=>movePlaylistTrack(p,t.id,1));down.setAttribute('aria-label','Descendre '+t.title);down.disabled=p.trackIds.indexOf(t.id)===p.trackIds.length-1;
  const remove=action('−',()=>removePlaylistTrack(p,t.id));remove.setAttribute('aria-label','Retirer de cette playlist');controls.append(up,down,remove);row.append(controls);
 }
 const more=action('⋯',()=>openEditor(t.id),'more');more.setAttribute('aria-label','Options de '+t.title);row.append(more);return row;
}
render=()=>{
 const labels={titles:'Titres',artists:'Artistes',albums:'Albums',playlists:'Playlists',favorites:'Favoris'};
 $('tabs').replaceChildren(...Object.entries(labels).map(([key,label])=>{const b=action(label,()=>setTab(key),tab===key?'selected':'');b.setAttribute('aria-current',tab===key?'page':'false');return b;}));
 $('back').hidden=!detail;$('back').onclick=()=>{detail=null;$('search').value='';render();};
 $('section-title').textContent=detail?.name||({titles:'Tous les titres',artists:'Tes artistes',albums:'Tes albums',playlists:'Tes playlists',favorites:'Tes favoris'}[tab]);
 const list=$('tracks');list.replaceChildren();const controls=$('collection-actions');controls.replaceChildren();
 const grouped=!detail&&['artists','albums','playlists'].includes(tab);$('sort').hidden=grouped||detail?.kind==='playlist';
 const visible=collectionTracks();
 if(tab==='playlists'&&!detail)controls.append(action('＋ Nouvelle playlist',()=>editPlaylist(),'primary'));
 if(detail?.kind==='playlist'){
  const p=playlists.find(x=>x.id===detail.key);
  if(p){controls.append(action('Renommer',()=>editPlaylist(p)),action('Supprimer',async()=>{if(!confirm('Supprimer la playlist « '+p.name+' » ? Les morceaux seront conservés.'))return;try{await writePlaylist(p,true);playlists=playlists.filter(x=>x.id!==p.id);detail=null;render();}catch(error){notify(error.message,true);}},'danger'));}
 }
 if(!grouped&&visible.length){controls.prepend(action('▶ Tout lire',()=>startQueue(visible[0].id,visible.map(x=>x.id)),'primary'),action('⇄ Mélanger',()=>{shuffle=true;startQueue(visible[Math.floor(Math.random()*visible.length)].id,visible.map(x=>x.id));}));}
 if(grouped){
  const groups=new Map();
  if(tab==='playlists')for(const p of playlists)groups.set(p.id,{name:p.name,items:p.trackIds.map(trackById).filter(Boolean)});
  else for(const t of tracks){const key=tab==='artists'?t.artist:albumKey(t);if(!groups.has(key))groups.set(key,{name:tab==='artists'?t.artist:t.album||'Album inconnu',items:[]});groups.get(key).items.push(t);}
  const query=$('search').value.trim().toLocaleLowerCase();const entries=[...groups.entries()].filter(([,g])=>(g.name+' '+g.items.map(t=>t.title+' '+t.artist).join(' ')).toLocaleLowerCase().includes(query));
  const grid=node('div','group-grid');
  for(const [key,g] of entries){const b=action('',()=>openDetail(tab==='artists'?'artist':tab==='albums'?'album':'playlist',key,g.name),'group-card'+(tab==='artists'?' artist':''));b.append(art(g.items.find(t=>t.artwork)||g.items[0]),node('b','',g.name),node('small','',g.items.length+' titre(s)'+(tab==='albums'?' · '+(g.items[0]?.artist||''):'')));grid.append(b);}
  list.append(grid);$('count').textContent=entries.length+' '+labels[tab].toLowerCase();
  if(!entries.length){const empty=node('div','empty');empty.append(node('strong','',tab==='playlists'?'Crée ta première playlist':'Rien ici pour le moment'),node('span','',tab==='playlists'?'Ajoute ensuite des titres avec leur bouton ⋯.':'Importe des morceaux ou modifie leurs informations avec ⋯.'));list.append(empty);}
 }else{
  $('count').textContent=visible.length+' titre(s)';for(const t of visible)list.append(trackRow(t,visible));
  if(!visible.length){const empty=node('div','empty');empty.append(node('strong','',tracks.length?'Aucun morceau ici':'À toi de composer la suite.'),node('span','',detail?.kind==='playlist'?'Depuis Titres, appuie sur ⋯ pour ajouter tes morceaux à cette playlist.':'Importe des morceaux ou essaie une autre recherche.'));list.append(empty);}
 }
 const recent=$('recent-section');recent.replaceChildren();
 if(tab==='titles'&&!detail&&!$('search').value){const values=recentIds.map(trackById).filter(Boolean).slice(0,6);if(values.length){recent.append(node('h2','','Récemment écoutés'));const strip=node('div','recent-strip');for(const t of values){const b=action('',()=>startQueue(t.id,tracks.map(x=>x.id)),'recent-card');b.append(art(t),node('b','',t.title));strip.append(b);}recent.append(strip);}}
 $('storage').textContent=(tracks.reduce((sum,t)=>sum+t.size,0)/1048576).toFixed(1)+' Mo de musique · '+playlists.length+' playlist(s)';
 renderQueue();syncUI();
};
const basicSyncUI=syncUI;
syncUI=()=>{basicSyncUI();const t=trackById(currentId);if(t){setArt($('mini-art'),t);setArt($('now-art'),t);$('now-favorite').textContent=t.favorite?'♥':'♡';$('now-favorite').classList.toggle('on',!!t.favorite);$('now-favorite').setAttribute('aria-label',t.favorite?'Retirer des favoris':'Ajouter aux favoris');}};
const basicMedia=updateMedia;
updateMedia=()=>{basicMedia();const t=trackById(currentId);if(navigator.mediaSession && t){navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist,album:t.album||'Music local',artwork:[{src:t.artwork||new URL('./icon.png',location.href).href,type:t.artwork?'image/jpeg':'image/png'}]});}};
function saveSession(){try{localStorage.setItem('ml-session',JSON.stringify({currentId,queue,originalQueue,shuffle,repeat,position:finite(audio.currentTime)}));localStorage.setItem('ml-recent',JSON.stringify(recentIds));}catch{}}
function queueChanged(){prepareNext();renderQueue();syncUI();saveSession();}
function moveQueue(index,delta){const j=index+delta;if(index<0||j<0||j>=queue.length)return;[queue[index],queue[j]]=[queue[j],queue[index]];if(!shuffle)originalQueue=[...queue];queueChanged();}
renderQueue=()=>{
 const container=$('queue');container.replaceChildren();
 queue.forEach((id,index)=>{const t=trackById(id);if(!t)return;const row=node('div','queue-row');const button=action((id===currentId?'♫  ':'')+t.title,()=>selectTrack(id),'queue-name'+(id===currentId?' active':''));
  const up=action('↑',()=>moveQueue(index,-1));up.disabled=index===0;up.setAttribute('aria-label','Monter '+t.title);
  const down=action('↓',()=>moveQueue(index,1));down.disabled=index===queue.length-1;down.setAttribute('aria-label','Descendre '+t.title);
  const remove=action('×',()=>{queue=queue.filter(x=>x!==id);originalQueue=originalQueue.filter(x=>x!==id);queueChanged();});remove.disabled=id===currentId;remove.setAttribute('aria-label','Retirer '+t.title+' de la file');row.append(button,up,down,remove);container.append(row);
 });
};
$('clear-upcoming').onclick=()=>{const i=queue.indexOf(currentId);if(i<0)return;queue=queue.slice(0,i+1);originalQueue=originalQueue.filter(x=>queue.includes(x));queueChanged();};
function enqueueTrack(id,playNext=false){
 if(!currentId){startQueue(id,[id]);return;}
 if(id===currentId){notify('Ce titre est déjà en cours de lecture.');return;}
 queue=queue.filter(x=>x!==id);originalQueue=originalQueue.filter(x=>x!==id);
 if(playNext){queue.splice(queue.indexOf(currentId)+1,0,id);originalQueue.splice(originalQueue.indexOf(currentId)+1,0,id);}else{queue.push(id);originalQueue.push(id);}
 queueChanged();$('editor').close();notify(playNext?'Le titre sera lu ensuite.':'Titre ajouté à la file.');
}
$('play-next').onclick=()=>enqueueTrack(editingId,true);$('enqueue').onclick=()=>enqueueTrack(editingId);
openEditor=id=>{const t=trackById(id);if(!t)return;editingId=id;draftArtwork=t.artwork||null;$('edit-title').value=t.title;$('edit-artist').value=t.artist;$('edit-album').value=t.album||'';$('art-input').value='';setArt($('edit-art'),t);$('favorite-track').textContent=t.favorite?'♥ Retirer le favori':'♡ Ajouter aux favoris';
 const select=$('playlist-target');select.replaceChildren();if(!playlists.length)select.append(new Option('Crée une playlist dans l’onglet Playlists',''));for(const p of playlists)select.append(new Option(p.name,p.id));$('add-to-playlist').disabled=!playlists.length;$('editor').showModal();
};
$('art-input').onchange=async()=>{const file=$('art-input').files[0];const id=editingId;if(!file)return;try{const image=await MusicMetadata.imageData(file);if(editingId!==id)return;draftArtwork=image;setArt($('edit-art'),{artwork:draftArtwork});}catch(error){notify(error.message,true);}};
$('remove-art').onclick=()=>{draftArtwork=null;setArt($('edit-art'),null);};
$('read-tags').onclick=async()=>{const id=editingId;$('read-tags').disabled=true;try{const file=await read('files',id);if(!file)throw Error('Fichier introuvable');const tags=await MusicMetadata.read(file);if(editingId!==id)return;for(const field of ['title','artist','album'])if(tags[field])$('edit-'+field).value=tags[field];if(tags.artwork){draftArtwork=tags.artwork;setArt($('edit-art'),tags);}notify(Object.keys(tags).length?'Tags lus : appuie sur Enregistrer pour les conserver.':'Aucun tag compatible trouvé.');}catch(error){notify(error.message,true);}finally{$('read-tags').disabled=false;}};
$('edit-form').onsubmit=async event=>{event.preventDefault();const title=$('edit-title').value.trim();if(!title)return;const t={...trackById(editingId),title,artist:$('edit-artist').value.trim()||'Artiste inconnu',album:$('edit-album').value.trim(),artwork:draftArtwork};try{await writeTrack(t);tracks=tracks.map(x=>x.id===t.id?t:x);$('editor').close();render();updateMedia();}catch(error){notify('Sauvegarde impossible : '+error.message,true);}};
$('add-to-playlist').onclick=async()=>{const p=playlists.find(x=>x.id===$('playlist-target').value);if(!p)return;if(p.trackIds.includes(editingId)){notify('Ce titre est déjà dans cette playlist.');return;}try{await savePlaylist({...p,trackIds:[...p.trackIds,editingId]});$('editor').close();notify('Ajouté à « '+p.name+' ».');}catch(error){notify(error.message,true);}};
$('now-favorite').onclick=async()=>{const t=trackById(currentId);if(!t)return;const changed={...t,favorite:!t.favorite};try{await writeTrack(changed);tracks=tracks.map(x=>x.id===t.id?changed:x);render();}catch(error){notify(error.message,true);}};
// Suppression du titre et des références de playlists dans une transaction unique.
$('delete-track').onclick=async()=>{const t=trackById(editingId);if(!t||!confirm('Supprimer « '+t.title+' » du lecteur et de toutes les playlists ? Ton original sera conservé.'))return;
 const nextPlaylists=playlists.map(p=>({...p,trackIds:p.trackIds.filter(id=>id!==t.id)}));
 try{await new Promise((resolve,reject)=>{const tx=db.transaction(['tracks','files','playlists'],'readwrite');tx.objectStore('tracks').delete(t.id);tx.objectStore('files').delete(t.id);for(const p of nextPlaylists)tx.objectStore('playlists').put(p);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Transaction interrompue'));tx.onerror=()=>reject(tx.error);});
  if(t.id===currentId)stop();tracks=tracks.filter(x=>x.id!==t.id);playlists=nextPlaylists;queue=queue.filter(x=>x!==t.id);originalQueue=originalQueue.filter(x=>x!==t.id);recentIds=recentIds.filter(x=>x!==t.id);queueChanged();$('editor').close();render();
 }catch(error){notify(error.message,true);}
};
$('sort').onchange=()=>render();
$('search').oninput=()=>render();
audio.addEventListener('play',()=>{if(currentId){recentIds=[currentId,...recentIds.filter(id=>id!==currentId)].slice(0,12);saveSession();}});
audio.addEventListener('pause',saveSession);
audio.addEventListener('timeupdate',()=>{if(!saveTimer){saveTimer=setTimeout(()=>{saveTimer=null;saveSession();},4000);}});
audio.addEventListener('loadedmetadata',async()=>{const t=trackById(currentId),duration=audio.duration;if(!t||!Number.isFinite(duration)||duration<=0)return;const changed={...t,duration};try{await writeTrack(changed);const index=tracks.findIndex(x=>x.id===changed.id);if(index>=0)tracks[index]=changed;}catch{}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveSession();});
$('export-catalog').onclick=()=>{const catalog={version:2,exportedAt:new Date().toISOString(),note:'Métadonnées et playlists uniquement. Audio et pochettes non inclus.',tracks:tracks.map(({artwork,...t})=>t),playlists};const blob=new Blob([JSON.stringify(catalog,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=node('a');link.href=url;link.download='music-local-catalogue.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
$('check-update').onclick=async()=>{if(!navigator.onLine){notify('Reconnecte-toi à Internet pour chercher une mise à jour.');return;}try{const reg=await navigator.serviceWorker.getRegistration();if(reg){await reg.update();notify('Vérification effectuée. Ferme puis rouvre le lecteur après la fin de la lecture.');}else notify('Rouvre le lecteur avec Internet pour activer le mode hors ligne.');}catch{notify('Vérification impossible pour le moment.',true);}};
// Une reprise prépare le morceau sans le lancer automatiquement.
async function restoreSession(){
 const s=resumeSnapshot;const token=selectionToken;if(!s || !trackById(s.currentId))return;
 queue=Array.isArray(s.queue)?[...new Set(s.queue)].filter(trackById):[];if(!queue.includes(s.currentId))queue.unshift(s.currentId);
 originalQueue=Array.isArray(s.originalQueue)?[...new Set(s.originalQueue)].filter(trackById):[...queue];if(!originalQueue.includes(s.currentId))originalQueue.unshift(s.currentId);
 shuffle=!!s.shuffle;repeat=[0,1,2].includes(s.repeat)?s.repeat:0;
 const file=await read('files',s.currentId);if(!file||token!==selectionToken)return;currentId=s.currentId;activeURL=URL.createObjectURL(file);
 const position=Number.isFinite(s.position)?Math.max(0,s.position):0;
 audio.addEventListener('loadedmetadata',()=>{audio.currentTime=Math.min(position,finite(audio.duration));updatePosition();},{once:true});audio.src=activeURL;audio.load();prepareNext();render();updateMedia();
}
(async()=>{try{db=await openDB();tracks=await read('tracks');playlists=await read('playlists');render();await restoreSession();}catch(error){$('import').disabled=true;notify('Stockage local indisponible : '+error.message,true);}setupOffline();})();
