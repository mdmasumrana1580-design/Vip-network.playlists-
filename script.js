const state={channels:[],category:'ALL',query:'',selected:null,hls:null};
const $=id=>document.getElementById(id);

function parseM3U(text){
  const lines=text.split(/\r?\n/), out=[];
  for(let i=0;i<lines.length;i++){
    if(!lines[i].startsWith('#EXTINF')) continue;
    const info=lines[i], name=(info.split(',').slice(1).join(',')||'').trim();
    const gm=info.match(/group-title="([^"]*)"/i), lm=info.match(/tvg-logo="([^"]*)"/i);
    let url='', j=i+1;
    while(j<lines.length && lines[j].trim()==='') j++;
    if(j<lines.length && !lines[j].trim().startsWith('#')) url=lines[j].trim();
    out.push({name,category:(gm?gm[1]:'OTHERS').toUpperCase(),logo:lm?lm[1]:'',url});
  }
  return out;
}
function categories(){
  const order=['ALL','SPORTS','BD','INDIA','OTHERS'];
  const counts=Object.fromEntries(order.map(x=>[x,x==='ALL'?state.channels.length:state.channels.filter(c=>c.category===x).length]));
  $('filters').innerHTML=order.map(x=>`<button class="${state.category===x?'active':''}" data-cat="${x}">${x} <small>(${counts[x]})</small></button>`).join('');
  $('sideFilters').innerHTML=order.map(x=>`<button class="side-btn ${state.category===x?'active':''}" data-cat="${x}">${x} <span style="float:right">${counts[x]}</span></button>`).join('');
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{state.category=b.dataset.cat;render()});
}
function filtered(){
  return state.channels.filter(c=>(state.category==='ALL'||c.category===state.category)&&c.name.toLowerCase().includes(state.query.toLowerCase()));
}
function render(){
  categories();
  const list=filtered(); $('count').textContent=list.length; $('listTitle').textContent=state.category==='ALL'?'All Channels':state.category+' Channels';
  $('channels').innerHTML=list.map((c,idx)=>`<article class="channel ${state.selected===c?'selected':''}" data-index="${idx}">
    <img src="${c.logo||'vip-network-logo.jpg'}" onerror="this.src='vip-network-logo.jpg'" alt="">
    <div class="name">${escapeHtml(c.name)}</div><div style="text-align:center"><span class="tag">${escapeHtml(c.category)}</span></div>
    <div class="status ${c.url?'':'off'}">${c.url?'● Live':'● No Stream Link'}</div>
  </article>`).join('');
  document.querySelectorAll('.channel').forEach(el=>el.onclick=()=>select(list[+el.dataset.index]));
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
let streamTimer=null;

function showFallback(c){
  if(streamTimer){clearTimeout(streamTimer);streamTimer=null}
  const video=$('video'), ph=$('placeholder'), sv=$('searchVideo');
  if(state.hls){state.hls.destroy();state.hls=null}
  video.pause(); video.removeAttribute('src'); video.load();
  video.classList.add('hidden'); ph.classList.remove('hidden');
  sv.src='searching-channel.mp4';
  sv.currentTime=0;
  sv.play().catch(()=>{});
  $('selectedStatus').textContent='Searching Channel • Stream unavailable';
}

function select(c){
  state.selected=c;
  $('selectedName').textContent=c.name;
  $('selectedCategory').textContent=c.category;
  $('selectedStatus').textContent=c.url?'Checking stream...':'No Stream Link';
  $('missingName').textContent=c.name;
  $('googleSearch').href='https://www.google.com/search?q='+encodeURIComponent(c.name+' official website live TV');
  $('youtubeSearch').href='https://www.youtube.com/results?search_query='+encodeURIComponent(c.name+' official');

  const video=$('video'), ph=$('placeholder');
  if(streamTimer){clearTimeout(streamTimer);streamTimer=null}
  if(state.hls){state.hls.destroy();state.hls=null}
  video.pause(); video.removeAttribute('src'); video.load();
  video.onerror=()=>showFallback(c);

  if(!c.url){
    showFallback(c);
  }else{
    ph.classList.add('hidden'); video.classList.remove('hidden');

    const streamStarted=()=>{
      if(streamTimer){clearTimeout(streamTimer);streamTimer=null}
      $('selectedStatus').textContent='Live • Stream Link Available';
    };
    video.addEventListener('playing',streamStarted,{once:true});
    video.addEventListener('loadeddata',()=>{ $('selectedStatus').textContent='Loading stream...'; },{once:true});

    // If nothing starts within 12 seconds, automatically show the 8-second video.
    streamTimer=setTimeout(()=>showFallback(c),12000);

    if(window.Hls && Hls.isSupported() && /\.m3u8(\?|$)/i.test(c.url)){
      state.hls=new Hls({enableWorker:true});
      state.hls.loadSource(c.url);
      state.hls.attachMedia(video);
      state.hls.on(Hls.Events.ERROR,(event,data)=>{
        if(data && data.fatal) showFallback(c);
      });
    }else{
      video.src=c.url;
    }
    video.play().catch(()=>{});
  }
  render();
}

$('search').addEventListener('input',e=>{state.query=e.target.value;render()});
fetch('playlist.m3u').then(r=>r.text()).then(t=>{state.channels=parseM3U(t);$('footerCount').textContent=state.channels.length;render();}).catch(e=>{$('channels').innerHTML='<p>Could not load playlist.m3u</p>'});
