/* Lecteur borné de tags ID3 et de métadonnées iTunes. Aucun service externe. */
const MusicMetadata = (() => {
 const MAX = 8 * 1024 * 1024;
 const latin = b => Array.from(b,x=>String.fromCharCode(x)).join('');
 const u32 = (b,o=0) => new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(o);
 const sync = (b,o=0) => ((b[o]&127)<<21)|((b[o+1]&127)<<14)|((b[o+2]&127)<<7)|(b[o+3]&127);
 const clean = s => s.replace(/\0/g,' ').trim().slice(0,200);
 function text(b) {
  if(!b.length)return '';
  let encoding=['windows-1252','utf-16le','utf-16be','utf-8'][b[0]]||'utf-8';
  if(b[0]===1 && b[1]===254 && b[2]===255)encoding='utf-16be';
  return clean(new TextDecoder(encoding).decode(b.subarray(1)));
 }
 function deunsync(b){const out=[];for(let i=0;i<b.length;i++){out.push(b[i]);if(b[i]===255 && b[i+1]===0)i++;}return new Uint8Array(out);}
 function parseID3(b) {
  const result={}; if(b.length<10 || latin(b.subarray(0,3))!=='ID3')return result;
  const version=b[3]; if(version!==3 && version!==4)return result;
  let end=Math.min(b.length,10+sync(b,6)), offset=10;
  // v2.3 unsynchronisation applies to the complete tag body.
  if(version===3 && (b[5]&128)){b=new Uint8Array([...b.subarray(0,10),...deunsync(b.subarray(10,end))]);end=b.length;}
  if(b[5]&64){if(offset+4>end)return result;offset+=version===4?sync(b,offset):4+u32(b,offset);}
  let frameCount=0;
  while(offset+10<=end && frameCount++<10000){
   const id=latin(b.subarray(offset,offset+4)); if(!/^[A-Z0-9]{4}$/.test(id))break;
   const size=version===4?sync(b,offset+4):u32(b,offset+4); const flags=b[offset+9]; offset+=10;
   if(!size || offset+size>end)break;
   let data=b.subarray(offset,offset+size);offset+=size;
   if((version===3 && (flags&224)) || (version===4 && (flags&77)))continue; // compressed/encrypted/grouped/DLI frames unsupported
   if(version===4 && ((flags&2)||(b[5]&128)))data=deunsync(data);
   if(id==='TIT2')result.title=text(data);
   if(id==='TPE1')result.artist=text(data);
   if(id==='TALB')result.album=text(data);
   if(id==='APIC' && !result.artBytes){
    const encoding=data[0];let pos=1;
    while(pos<data.length && data[pos]!==0)pos++;
    const mime=latin(data.subarray(1,pos));pos+=2;
    if(encoding===0||encoding===3){while(pos<data.length && data[pos]!==0)pos++;pos++;}
    else {while(pos+1<data.length && !(data[pos]===0 && data[pos+1]===0))pos+=2;pos+=2;}
    if(pos<data.length && ['image/jpeg','image/png','image/webp'].includes(mime)){result.artBytes=data.slice(pos);result.artMime=mime;}
   }
  }
  return result;
 }
 function parseMP4(b){
  const result={};let budget=12000;
  function walk(start,end,depth){if(depth>8)return;let p=start;
   while(p+8<=end && budget-->0){let size=u32(b,p),type=latin(b.subarray(p+4,p+8)),header=8;
    if(size===1){if(p+16>end)return;size=u32(b,p+8)*4294967296+u32(b,p+12);header=16;}
    if(size===0)size=end-p;if(size<header||p+size>end||!Number.isSafeInteger(size))return;
    const content=p+header,finish=p+size;
    if(['moov','udta','ilst'].includes(type))walk(content,finish,depth+1);
    else if(type==='meta')walk(content+4,finish,depth+1);
    else if(['©nam','©ART','aART','©alb','covr'].includes(type)){
     let q=content;
     while(q+16<=finish){const n=u32(b,q);if(n<16||q+n>finish)break;
      if(latin(b.subarray(q+4,q+8))==='data'){
       const data=b.subarray(q+16,q+n),format=u32(b,q+8)&0xffffff;
       if(type==='covr' && [13,14].includes(format)){result.artBytes=data.slice();result.artMime=format===13?'image/jpeg':'image/png';}
       else {const value=clean(new TextDecoder().decode(data));if(type==='©nam')result.title=value;if(type==='©ART'||(type==='aART'&&!result.artist))result.artist=value;if(type==='©alb')result.album=value;}
      }q+=n;
     }
    }p=finish;
   }
  }
  walk(0,b.length,0);return result;
 }
 async function imageData(blob){
  if(blob.size>MAX)throw new Error('Pochette trop lourde (8 Mo maximum).');
  const url=URL.createObjectURL(blob);
  try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,600/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.82);}finally{URL.revokeObjectURL(url);}
 }
 async function duration(file){
  return new Promise(resolve=>{
   const media=document.createElement('audio'),url=URL.createObjectURL(file);let finished=false;
   const done=value=>{if(finished)return;finished=true;clearTimeout(timer);media.removeAttribute('src');media.load();URL.revokeObjectURL(url);resolve(value);};
   const timer=setTimeout(()=>done(null),6000);
   media.preload='metadata';media.onloadedmetadata=()=>done(Number.isFinite(media.duration)&&media.duration>0?media.duration:null);media.onerror=()=>done(null);media.src=url;
  });
 }
 async function read(file){
  const head=new Uint8Array(await file.slice(0,16).arrayBuffer());let result={};
  try{
   if(latin(head.subarray(0,3))==='ID3'){
    const length=10+sync(head,6);if(length<=MAX)result=parseID3(new Uint8Array(await file.slice(0,length).arrayBuffer()));
   }else if(latin(head.subarray(4,8))==='ftyp'){
    // Scan only atom headers, never load the whole video into memory.
    let offset=0,limit=0;
    while(offset+8<=file.size && limit++<300){const header=new Uint8Array(await file.slice(offset,offset+16).arrayBuffer());let size=u32(header),headerSize=8;
     if(size===1){size=u32(header,8)*4294967296+u32(header,12);headerSize=16;}if(size===0)size=file.size-offset;
     if(size<headerSize||offset+size>file.size||!Number.isSafeInteger(size))break;
     if(latin(header.subarray(4,8))==='moov'){if(size<=MAX)result=parseMP4(new Uint8Array(await file.slice(offset,offset+size).arrayBuffer()));break;}offset+=size;
    }
   }
   if(result.artBytes){try{result.artwork=await imageData(new Blob([result.artBytes],{type:result.artMime}));}catch{}delete result.artBytes;delete result.artMime;}
  }catch{result={};}
  const seconds=await duration(file);if(seconds)result.duration=seconds;
  return Object.fromEntries(Object.entries(result).filter(([,v])=>v));
 }
 return {read,imageData,parseID3,parseMP4};
})();
