'use strict';
// Interface et collections. Les stores tracks/files de la V0.1 sont conservés.
let playlists=[],tab='home',detail=null,playlistEditId=null,draftArtwork=null;
let recentIds=[],resumeSnapshot=null,saveTimer=null;
try{recentIds=JSON.parse(localStorage.getItem('ml-recent')||'[]');if(!Array.isArray(recentIds))recentIds=[];resumeSnapshot=JSON.parse(localStorage.getItem('ml-session')||'null');}catch{}
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
function action(label,fn,className=''){const b=node('button',className,label);b.type='button';b.onclick=fn;return b;}
function art(track,className='art'){const el=node('div',className);setArt(el,track);return el;}
function setArt(el,track){const key=track?.artwork||'';if(el.dataset.artKey===key)return;el.dataset.artKey=key;el.replaceChildren();if(track?.artwork?.startsWith('data:image/')){const image=node('img');image.src=track.artwork;image.alt='';image.loading='lazy';el.append(image);}else el.textContent='♫';}
function albumKey(t){return JSON.stringify([displayArtist(t),t.album||'Album inconnu']);}
function collectionTracks(){
 let values=[...tracks];
 if(tab==='favorites')values=values.filter(t=>t.favorite);
 if(detail?.kind==='artist')values=values.filter(t=>displayArtist(t)===detail.key);
 if(detail?.kind==='album')values=values.filter(t=>albumKey(t)===detail.key);
 if(detail?.kind==='playlist'){const p=playlists.find(x=>x.id===detail.key);values=(p?.trackIds||[]).map(trackById).filter(Boolean);}
 const query=normalizeSearch($('search').value);values=values.filter(t=>matchesSearch(t, $('search').value));
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
$('playlist-form').onsubmit=async event=>{event.preventDefault();const name=$('playlist-name').value.trim();if(!name)return;const old=playlists.find(p=>p.id===playlistEditId);try{await savePlaylist(old?{...old,name}:{id:crypto.randomUUID(),name,trackIds:[],createdAt:Date.now()});$('playlist-dialog').close();if(old&&detail?.key===old.id){detail.name=name;render();}}catch(error){notify(error.message,true);}};
$('close-playlist').onclick=()=>$('playlist-dialog').close();
async function movePlaylistTrack(p,id,delta){const ids=[...p.trackIds],i=ids.indexOf(id),j=i+delta;if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];try{await savePlaylist({...p,trackIds:ids});}catch(error){notify(error.message,true);}}
async function removePlaylistTrack(p,id){try{await savePlaylist({...p,trackIds:p.trackIds.filter(x=>x!==id)});}catch(error){notify(error.message,true);}}
function trackRow(t,list){
 const row=node('div','track'+(t.id===currentId?' active':''));
 const button=action('',()=>t.id===currentId?openPlayer():startQueue(t.id,list.map(x=>x.id)),'track-main');
 const text=node('span','track-text');text.append(node('b','',t.title),node('small','',(t.favorite?'♥ · ':'')+displayArtist(t)));button.append(art(t),text);row.append(button);
 if(t.duration)row.append(node('span','duration-label',time(t.duration)));
 const more=action('⋯',()=>openTrackActions(t),'more');more.setAttribute('aria-label','Options de '+t.title);row.append(more);return row;
}
// Navigation principale fixe ; seuls les contenus de la bibliothèque changent.
let homeView='titles';
render=()=>{
 const mainTab=['artists','albums','titles','home'].includes(tab)?'home':tab==='favorites'?'playlists':tab;
 $('tabs').replaceChildren(...[['home','Accueil'],['playlists','Playlists'],['search','Recherche']].map(([key,label])=>{
  const b=action(label,()=>setTab(key),mainTab===key?'selected':'');b.setAttribute('aria-current',mainTab===key?'page':'false');return b;
 }));
 const isHome=mainTab==='home'&&!detail, isPlaylists=tab==='playlists'&&!detail;
 document.querySelector('.hero').hidden=!isHome;
 $('home-filters').hidden=!isHome;
 $('home-filters').replaceChildren(...[['titles','Titres'],['artists','Artistes'],['albums','Albums']].map(([key,label])=>action(label,()=>{homeView=key;tab=key;detail=null;$('search').value='';render();},(tab==='home'?homeView:tab)===key?'selected':'')));
 $('search-tools').hidden=tab!=='search';
 $('search').placeholder='Titre, artiste, album…';
 $('back').hidden=!detail&&tab!=='favorites';$('back').onclick=()=>{if(tab==='favorites')tab='playlists';detail=null;$('search').value='';render();};
 const view=tab==='home'?homeView:tab;
 $('section-title').textContent=detail?.name||({titles:'Tous les titres',artists:'Artistes',albums:'Albums',playlists:'Mes playlists',favorites:'Favoris',search:'Recherche'}[view]);
 const list=$('tracks');list.replaceChildren();const controls=$('collection-actions');controls.replaceChildren();
 $('recent-section').replaceChildren();
 $('playlist-hero').replaceChildren();$('playlist-hero').hidden=true;
 const grouped=!detail&&['artists','albums'].includes(view);
 $('sort').hidden=grouped||isPlaylists||detail?.kind==='playlist';
 const visible=collectionTracks();
 if(isPlaylists){
  controls.append(action('＋ Créer',()=>editPlaylist(),'primary'));
  const grid=node('div','group-grid home-grid');
  grid.append(homeCard('Favoris',tracks.filter(t=>t.favorite).length+' titres',tracks.find(t=>t.favorite&&t.artwork),()=>setTab('favorites')));
  grid.append(homeCard('Toutes les musiques',tracks.length+' titres',allMusicArtwork?{artwork:allMusicArtwork}:null,()=>openDetail('all','all','Toutes les musiques'),true));
  for(const p of playlists)grid.append(homeCard(p.name,p.trackIds.filter(trackById).length+' titres',playlistCover(p),()=>openDetail('playlist',p.id,p.name)));
  list.append(grid);$('count').textContent=playlists.length+' playlists';
 }else if(grouped){
  const groups=new Map();for(const t of tracks){const key=view==='artists'?displayArtist(t):albumKey(t);if(!groups.has(key))groups.set(key,{name:view==='artists'?displayArtist(t):t.album||'Sans album',items:[]});groups.get(key).items.push(t);}
  const grid=node('div','group-grid');for(const [key,g] of groups){grid.append(homeCard(g.name,g.items.length+' titres',g.items.find(t=>t.artwork),()=>openDetail(view==='artists'?'artist':'album',key,g.name)));}
  list.append(grid);$('count').textContent=groups.size+' '+(view==='artists'?'artistes':'albums');
  if(!groups.size)list.append(node('p','empty','Importe tes premiers morceaux.'));
 }else{
  $('count').textContent=visible.length+' titres';
  if(visible.length)controls.append(action('▶ Lire',()=>startQueue(visible[0].id,visible.map(x=>x.id)),'primary'),action('⇄ Mélanger',()=>{shuffle=true;startQueue(visible[randomIndex(visible.length)].id,visible.map(x=>x.id));}));
  for(const t of visible)list.append(trackRow(t,visible));
  if(!visible.length)list.append(node('p','empty',detail?.kind==='playlist'?'Touche « Ajouter » pour choisir tes sons.':tracks.length?'Aucun résultat.':'Importe tes premiers morceaux.'));
 }
 if(detail?.kind==='playlist'||detail?.kind==='all'){
  const p=detail.kind==='playlist'?playlists.find(x=>x.id===detail.key):null;
  const panel=$('playlist-hero');panel.hidden=false;
  const cover=action('',()=>choosePlaylistPhoto(p?p.id:'all'),'playlist-cover-button');cover.setAttribute('aria-label','Changer la photo');cover.append(art(p?playlistCover(p):{artwork:allMusicArtwork}),node('span','cover-caption','Modifier la photo'));
  const heading=node('div','playlist-heading');heading.append(node('h1','',detail.name),node('p','',visible.length+' titres'));panel.append(cover,heading);
  if(p){controls.prepend(action('＋ Ajouter',()=>openTrackPicker(p),'primary'));controls.append(action('⋯',()=>playlistOptions(p)));}
 }
 $('storage').textContent=(tracks.reduce((sum,t)=>sum+t.size,0)/1048576).toFixed(1)+' Mo · '+tracks.length+' titres';
 renderQueue();syncUI();
};
const basicSyncUI=syncUI;
syncUI=()=>{basicSyncUI();const t=trackById(currentId);if(t){$('mini-artist').textContent=$('now-artist').textContent=displayArtist(t);setArt($('mini-art'),t);setArt($('now-art'),t);$('now-favorite').textContent=t.favorite?'♥':'♡';$('now-favorite').classList.toggle('on',!!t.favorite);$('now-favorite').setAttribute('aria-label',t.favorite?'Retirer des favoris':'Ajouter aux favoris');}};
const basicMedia=updateMedia;
updateMedia=()=>{basicMedia();const t=trackById(currentId);if(navigator.mediaSession && t){navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:displayArtist(t),album:t.album||"Loan's Music",artwork:[{src:t.artwork||new URL('./icon.png?v=4',location.href).href,type:t.artwork?'image/jpeg':'image/png'}]});}};
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
$('export-catalog').onclick=()=>{const catalog={version:2,exportedAt:new Date().toISOString(),note:'Métadonnées et playlists uniquement. Audio et pochettes non inclus.',tracks:tracks.map(({artwork,...t})=>t),playlists:playlists.map(({artwork,...p})=>p)};const blob=new Blob([JSON.stringify(catalog,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=node('a');link.href=url;link.download='loans-music-catalogue.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
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
let noticeTimer;
notify=(message,error=false)=>{
 clearTimeout(noticeTimer);const notice=$('notice');notice.textContent=message;notice.classList.toggle('error',error);notice.hidden=false;
 const dialog=document.querySelector('dialog[open]');if(dialog){let status=dialog.querySelector('.dialog-status');if(!status){status=node('p','dialog-status');status.setAttribute('role','status');dialog.append(status);}status.textContent=message;setTimeout(()=>status.remove(),error?8000:3000);}
 noticeTimer=setTimeout(()=>{notice.hidden=true;},error?8000:3000);
};
// Search ignores accents, case, apostrophe styles and punctuation. Each query word can match anywhere.
function normalizeSearch(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[’'`ʼ]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function matchesSearch(t,query){const text=normalizeSearch([t.title,t.artist,t.album,t.sourceName,displayArtist(t)].join(' ')),compact=text.replace(/ /g,'');return normalizeSearch(query).split(/ +/).every(word=>text.includes(word)||compact.includes(word));}
function displayArtist(t){
 if(t?.artist&&t.artist!=='Artiste inconnu')return t.artist;
 const match=String(t?.title||'').match(/^(.{1,80}?)\s+[-–—]\s+.+$/);
 return match?match[1].trim():'le son lé en 🧨';
}
function randomIndex(n){
 if(!Number.isInteger(n)||n<1||n>4294967296)throw new RangeError('Taille de sélection invalide');
 const limit=Math.floor(4294967296/n)*n,buffer=new Uint32Array(1);let value;
 do{crypto.getRandomValues(buffer);value=buffer[0];}while(value>=limit);
 return value%n;
}
randomized=ids=>{const result=[...ids];for(let i=result.length-1;i>0;i--){const j=randomIndex(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;};
// Un passage aléatoire contient chaque morceau une seule fois.
// À la répétition de toute la file, nouveau mélange, sans répéter immédiatement le dernier titre.
const plainNext=next;
next=(automatic=false)=>{
 if(shuffle&&repeat===1&&queue.length>1&&queue.indexOf(currentId)===queue.length-1){
  const previousId=currentId;const candidates=randomized(queue.filter(id=>id!==previousId));const first=candidates.shift();
  queue=[first,...randomized([...candidates,previousId])];selectTrack(first);saveSession();return;
 }
 plainNext(automatic);
};
let playlistPhotoTarget=null;
let allMusicArtwork=null;
try{allMusicArtwork=localStorage.getItem('lm-all-artwork')||null;}catch{}
function playlistCover(p){return p?.artwork?{artwork:p.artwork}:p?.trackIds?.map(trackById).find(t=>t?.artwork)||null;}
function choosePlaylistPhoto(key){playlistPhotoTarget=key;$('playlist-photo').value='';$('playlist-photo').click();}
$('playlist-photo').onchange=async()=>{
 const file=$('playlist-photo').files[0],target=playlistPhotoTarget;if(!file)return;
 try{
  const cover=await MusicMetadata.imageData(file);
  if(target==='all'){localStorage.setItem('lm-all-artwork',cover);allMusicArtwork=cover;}
  else{const p=playlists.find(x=>x.id===target);if(!p)return;await savePlaylist({...p,artwork:cover});}
  render();
 }catch(error){notify('Photo non enregistrée : '+error.message,true);}
};
function homeCard(title,subtitle,cover,onClick,isAll=false){const card=action('',onClick,'group-card home-card'+(isAll?' all-music':''));const picture=art(cover);if(isAll&&!cover){picture.textContent='♫';picture.classList.add('all-cover');}card.append(picture,node('b','',title),node('small','',subtitle));return card;}
// Add-only picker: current playlist members stay saved, newly checked tracks are appended.
function openTrackPicker(playlist){
 const dialog=makeDialog('Ajouter des sons','track-picker');
 const search=node('input');search.type='search';search.placeholder='Rechercher un son';search.setAttribute('aria-label','Rechercher un son');
 const list=node('div','picker-list'),selected=new Set();
 const save=action('Ajouter',async()=>{
  save.disabled=true;try{const latest=playlists.find(p=>p.id===playlist.id);if(!latest)throw Error('Playlist introuvable');
   await savePlaylist({...latest,trackIds:[...new Set([...latest.trackIds,...selected])].filter(trackById)});dialog.close();
  }catch(error){notify(error.message,true);}finally{save.disabled=selected.size===0;}
 },'primary');
 const paint=()=>{list.replaceChildren();for(const t of tracks.filter(t=>matchesSearch(t,search.value))){
  const label=node('label','picker-track'),box=node('input'),existing=playlist.trackIds.includes(t.id);box.type='checkbox';box.checked=existing||selected.has(t.id);box.disabled=existing;
  box.onchange=()=>{if(box.checked)selected.add(t.id);else selected.delete(t.id);save.textContent='Ajouter'+(selected.size?' ('+selected.size+')':'');save.disabled=!selected.size;};
  const text=node('span');text.append(node('b','',t.title),node('small','',existing?'Déjà ajouté':displayArtist(t)));label.append(box,art(t),text);list.append(label);
 }if(!list.children.length)list.append(node('p','hint',tracks.length?'Aucun résultat.':'Importe d’abord tes sons depuis Accueil.'));};
 save.disabled=true;search.oninput=paint;dialog.append(search,list,save);paint();dialog.showModal();
}
function makeDialog(title,id){
 const dialog=node('dialog','simple-dialog');if(id)dialog.id=id;
 const head=node('div','dialog-head');const close=action('✕',()=>dialog.close());close.setAttribute('aria-label','Fermer');head.append(node('h2','',title),close);dialog.append(head);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});return dialog;
}
function playlistOptions(p){
 const dialog=makeDialog(p.name);dialog.append(action('Renommer',()=>{dialog.close();editPlaylist(p);}),action('Retirer des morceaux',()=>{dialog.close();removePlaylistSelection(p);}),action('Supprimer la playlist',async()=>{
  if(!confirm('Supprimer « '+p.name+' » ? Tes sons seront conservés.'))return;
  try{await writePlaylist(p,true);playlists=playlists.filter(x=>x.id!==p.id);detail=null;dialog.close();render();}catch(error){notify(error.message,true);}
 },'danger'));dialog.showModal();
}
function removePlaylistSelection(p){
 const dialog=makeDialog('Retirer des sons'),selected=new Set(),list=node('div','picker-list');
 const save=action('Retirer',async()=>{save.disabled=true;try{const latest=playlists.find(x=>x.id===p.id);if(!latest)throw Error('Playlist introuvable');await savePlaylist({...latest,trackIds:latest.trackIds.filter(id=>!selected.has(id))});dialog.close();}catch(error){notify(error.message,true);}finally{save.disabled=!selected.size;}},'danger');save.disabled=true;
 for(const t of p.trackIds.map(trackById).filter(Boolean)){const label=node('label','picker-track'),box=node('input');box.type='checkbox';box.onchange=()=>{box.checked?selected.add(t.id):selected.delete(t.id);save.disabled=!selected.size;save.textContent='Retirer ('+selected.size+')';};label.append(box,node('span','',t.title));list.append(label);}dialog.append(list,save);dialog.showModal();
}
function openTrackActions(t){
 const dialog=makeDialog(t.title);dialog.append(action('＋ Ajouter à une playlist',()=>{dialog.close();chooseTrackPlaylist(t.id);}),action(t.favorite?'♥ Retirer des favoris':'♡ Ajouter aux favoris',async()=>{try{const changed={...t,favorite:!t.favorite};await writeTrack(changed);tracks=tracks.map(x=>x.id===t.id?changed:x);dialog.close();render();}catch(error){notify(error.message,true);}}),action('Lire ensuite',()=>{enqueueTrack(t.id,true);dialog.close();}),action('Modifier les informations',()=>{dialog.close();openEditor(t.id);}));dialog.showModal();
}
function chooseTrackPlaylist(id){
 const dialog=makeDialog('Choisir une playlist');
 for(const p of playlists){const b=action(p.name+(p.trackIds.includes(id)?' · Déjà ajouté':''),async()=>{b.disabled=true;try{const latest=playlists.find(x=>x.id===p.id);if(!latest)throw Error('Playlist introuvable');await savePlaylist({...latest,trackIds:[...new Set([...latest.trackIds,id])]});dialog.close();}catch(error){b.disabled=false;notify(error.message,true);}});b.disabled=p.trackIds.includes(id);dialog.append(b);}
 dialog.append(action('＋ Nouvelle playlist',()=>{dialog.close();editPlaylist();}));dialog.showModal();
}
$('export-audio').onclick=async()=>{
 const t=trackById(editingId);if(!t)return;
 try{const blob=await read('files',t.id);if(!blob)throw Error('Copie locale introuvable.');const url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download=t.sourceName||t.title+'.'+t.ext;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(error){notify(error.message,true);}
};
let sleepDeadline=0,sleepTimer=null;
function stopWhenDue(){if(sleepDeadline&&Date.now()>=sleepDeadline){sleepDeadline=0;audio.pause();$('sleep').value='0';clearTimeout(sleepTimer);notify('Lecture arrêtée par le minuteur.');}}
$('sleep').onchange=()=>{clearTimeout(sleepTimer);const minutes=Number($('sleep').value);sleepDeadline=minutes?Date.now()+minutes*60000:0;if(minutes)sleepTimer=setTimeout(stopWhenDue,minutes*60000);};
audio.addEventListener('timeupdate',stopWhenDue);audio.addEventListener('play',stopWhenDue);document.addEventListener('visibilitychange',stopWhenDue);
// Fixed full-screen player; queue and settings have their own scrollable panels.
function openPlayer(){if(currentId&&!$('player-dialog').open)$('player-dialog').showModal();}
$('open-player').onclick=openPlayer;$('mini-art').onclick=openPlayer;
$('settings-button').onclick=()=>$('settings-dialog').showModal();
$('close-settings').onclick=()=>$('settings-dialog').close();
$('open-queue').onclick=()=>$('queue-dialog').showModal();
$('close-queue').onclick=()=>$('queue-dialog').close();
const baseSetTab=setTab;
setTab=value=>{baseSetTab(value);window.scrollTo(0,0);};
(async()=>{try{db=await openDB();tracks=await read('tracks');playlists=await read('playlists');render();await restoreSession();}catch(error){$('import').disabled=true;notify('Stockage local indisponible : '+error.message,true);}setupOffline();})();
// Correctif 0.4.1
(() => {
  const main = document.querySelector('main');
  const previousSetTab = setTab;
  setTab = value => {
    previousSetTab(value);
    main.scrollTop = 0;
  };

  const brand = document.querySelector('.brand');
  brand.setAttribute('role', 'button');
  brand.setAttribute('tabindex', '0');
  brand.setAttribute('aria-label', 'Retour à l’accueil');
  const goHome = () => {
    homeView = 'titles';
    setTab('home');
  };
  brand.onclick = goHome;
  brand.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goHome();
    }
  };

  function stopEverything() {
    stop();
    queue = [];
    originalQueue = [];
    repeat = 0;
    sleepDeadline = 0;
    clearTimeout(sleepTimer);
    clearTimeout(saveTimer);
    saveTimer = null;
    resumeSnapshot = null;
    $('sleep').value = '0';
    $('queue-dialog').close();
    $('progress').style.width = '0%';
    render();
    saveSession();
  }

  const stopButton = action('×', stopEverything);
  stopButton.id = 'mini-stop';
  stopButton.title = 'Tout arrêter';
  stopButton.setAttribute('aria-label', 'Arrêter et fermer le lecteur');
  document.querySelector('.mini-inner').append(stopButton);

  const previousStartQueue = startQueue;
  startQueue = (id, ids) => {
    repeat = 0;
    previousStartQueue(id, ids);
  };

  const previousNext = next;
  next = (automatic = false) => {
    if (automatic && repeat === 0 && !nextId(true)) {
      stopEverything();
      return;
    }
    previousNext(automatic);
  };
})();
// Correctif Bluetooth 0.4.2 — ajouter après le correctif 0.4.1.
(() => {
  if (window.loanBluetooth042) return;
  window.loanBluetooth042 = true;
  audio.preload = 'auto';
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {}

  let pending = null;
  let playWanted = false;

  function cancelPending() {
    playWanted = false;
    if (pending) audio.removeEventListener('canplay', pending.onReady);
    pending = null;
  }

  function refreshPlayback() {
    syncUI();
    updateMedia();
  }

  function requestPlay(request) {
    if (!playWanted || pending !== request || request.token !== selectionToken) return;
    const attempt = ++request.attempts;
    const failed = error => {
      if (pending !== request || request.token !== selectionToken || request.attempts !== attempt) return;
      // Un changement de source peut interrompre une tentative précédente.
      if (error.name === 'AbortError' && request.attempts < 2) {
        if (audio.readyState >= 3) requestPlay(request);
        return;
      }
      cancelPending();
      refreshPlayback();
      notify(error.name === 'NotAllowedError'
        ? 'iOS a bloqué le démarrage. Appuie sur Lecture pour reprendre.'
        : 'Lecture impossible : ' + error.message, true);
    };
    try {
      Promise.resolve(audio.play()).then(() => {
        if (pending !== request || request.token !== selectionToken) return;
        audio.removeEventListener('canplay', request.onReady);
        pending = null;
        refreshPlayback();
        saveSession();
      }, failed);
    } catch (error) { failed(error); }
  }

  function playCurrent() {
    if (!currentId || !activeURL) return;
    cancelPending();
    playWanted = true;
    if (audio.ended) audio.currentTime = 0;
    const request = {token: selectionToken, attempts: 0, onReady: null};
    request.onReady = () => {
      if (pending === request && request.attempts < 2) requestPlay(request);
    };
    pending = request;
    audio.addEventListener('canplay', request.onReady);
    requestPlay(request);
  }

  function pauseCurrent() {
    ++selectionToken; // Annule aussi une lecture IndexedDB encore en attente.
    cancelPending();
    audio.pause();
    refreshPlayback();
    saveSession();
  }

  selectTrack = async id => {
    if (!trackById(id)) return;
    cancelPending();
    playWanted = true;
    const token = ++selectionToken;
    let url;
    try {
      // Si le suivant est prêt, aucun await avant audio.play().
      if (prepared?.id === id) {
        url = prepared.url;
        prepared = null;
      } else {
        const file = await read('files', id);
        if (token !== selectionToken || !playWanted) return;
        if (!file) throw Error('Fichier local introuvable. Réimporte ce son.');
        url = URL.createObjectURL(file);
      }
      if (token !== selectionToken || !playWanted) {
        URL.revokeObjectURL(url);
        return;
      }
      const oldURL = activeURL;
      activeURL = url;
      currentId = id;
      // Changer src déclenche le chargement : pas de pause()/load() supplémentaire.
      audio.src = url;
      playCurrent();
      if (oldURL && oldURL !== url) URL.revokeObjectURL(oldURL);
      prepareNext();
      if (!document.hidden) render();
      else refreshPlayback();
    } catch (error) {
      if (token !== selectionToken) return;
      cancelPending();
      refreshPlayback();
      notify('Lecture impossible : ' + error.message, true);
    }
  };

  const previousStop = stop;
  stop = () => { cancelPending(); previousStop(); };
  togglePlay = () => {
    if (playWanted || !audio.paused) pauseCurrent();
    else playCurrent();
  };
  $('mini-play').onclick = $('play').onclick = togglePlay;

  // Une interruption réelle prime sur toute tentative de démarrage.
  audio.addEventListener('pause', () => {
    if (audio.paused) {
      ++selectionToken;
      cancelPending();
    }
  });
  audio.addEventListener('error', cancelPending);

  if (navigator.mediaSession) {
    for (const [name, handler] of Object.entries({
      play: playCurrent,
      pause: pauseCurrent,
      nexttrack: () => next(),
      previoustrack: () => previous(),
      stop: () => {
        const button = $('mini-stop');
        if (button) button.click();
        else { stop(); render(); saveSession(); }
      }
    })) {
      try { navigator.mediaSession.setActionHandler(name, handler); } catch {}
    }
  }
  $('settings-dialog').append(node('p', 'hint', 'Correctif Bluetooth 0.4.2 actif'));
  // Aucune relance automatique au déverrouillage ou au retour dans l’app.
})();
/* Diagnostic de l’affichage sur iPhone */
(() => {
  const settings = document.getElementById('settings-dialog');
  if (!settings || document.getElementById('screen-diagnostic')) return;

  const button = document.createElement('button');
  button.id = 'screen-diagnostic';
  button.textContent = 'Mesurer l’écran';
  button.style.cssText = 'display:block;width:100%;margin-top:16px';

  const output = document.createElement('pre');
  output.style.cssText =
    'white-space:pre-wrap;font-size:12px;line-height:1.6';

  button.onclick = () => {
    const body = document.body;
    const tabs = document.getElementById('tabs');
    const main = document.querySelector('main');
    const viewport = window.visualViewport;
    const box = element => {
      const r = element.getBoundingClientRect();
      return `haut ${Math.round(r.top)}, bas ${Math.round(r.bottom)}, hauteur ${Math.round(r.height)}`;
    };

    const probe = document.createElement('div');
    probe.style.cssText =
      'position:absolute;visibility:hidden;height:100dvh;' +
      'padding-bottom:env(safe-area-inset-bottom);pointer-events:none';
    body.appendChild(probe);
    const dvh = probe.getBoundingClientRect().height;
    const safe = getComputedStyle(probe).paddingBottom;
    probe.style.height = '100lvh';
    const lvh = probe.getBoundingClientRect().height;
    probe.remove();

    output.textContent = [
      'Diagnostic écran 1',
      `Mode installé : ${
        navigator.standalone === true ||
        matchMedia('(display-mode: standalone)').matches
      }`,
      `Écran : ${screen.width} × ${screen.height}`,
      `Fenêtre : ${innerWidth} × ${innerHeight}`,
      `Zone visible : ${viewport ? Math.round(viewport.height) : '?'}`,
      `Décalage visible : ${viewport ? Math.round(viewport.offsetTop) : '?'}`,
      `Zoom : ${viewport ? viewport.scale : '?'}`,
      `100dvh : ${Math.round(dvh)}`,
      `100lvh : ${Math.round(lvh)}`,
      `Protection du bas : ${safe}`,
      `Page : ${box(body)}`,
      `Contenu : ${box(main)}`,
      `Menu : ${box(tabs)}`,
      `Position menu : ${getComputedStyle(tabs).position}`
    ].join('\n');
  };

  settings.append(button, output);
})();
/* Identifier l’ouverture depuis l’icône de l’application */
(() => {
  const mode = matchMedia('(display-mode: standalone)');

  function updateInstalledMode() {
    document.documentElement.classList.toggle(
      'loan-installed',
      navigator.standalone === true || mode.matches
    );
  }

  updateInstalledMode();
  window.addEventListener('pageshow', updateInstalledMode);
  mode.addEventListener('change', updateInstalledMode);
})();
