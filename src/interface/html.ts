/**
 * HTML Page Template - Interface Layer
 *
 * Generates the HTML UI for file browsing and host control.
 * Pure function with no side effects; returns HTML string.
 */

/**
 * Render complete homepage HTML
 * @returns HTML document as string
 */
export function renderHomePage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>LAN File Host</title>
    <style>
      :root { color-scheme:light; --bg:#f5f7fb; --surface:#ffffff; --text:#152132; --muted:#607086; --accent:#1f6feb; --line:#dae2ee; --danger:#be2d2d; --success:#1f5f28; }
      * { box-sizing:border-box; }
      body { margin:0; padding:24px; font-family:"Segoe UI","Noto Sans",sans-serif; background:radial-gradient(circle at top right,#dbe9ff,var(--bg) 36%); color:var(--text); min-height:100vh; }
      .card { max-width:960px; margin:0 auto; background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:24px; box-shadow:0 10px 30px rgba(20,44,88,0.08); }
      h1 { margin:0 0 4px; font-size:22px; }
      .subtitle { margin:0 0 16px; color:var(--muted); font-size:14px; }
      .banner { border:1px solid #ffd59c; background:#fff7ea; color:#8c4f00; border-radius:10px; padding:10px 14px; margin:0 0 16px; font-size:13px; }
      .banner.safe { border-color:#bfe6c2; background:#ecfff0; color:var(--success); }
      .status-grid { display:grid; grid-template-columns:1fr 1fr auto; gap:12px; margin-bottom:14px; align-items:start; }
      .status-box { border:1px solid var(--line); border-radius:10px; padding:12px 14px; }
      .status-box strong { display:block; margin-bottom:4px; font-size:13px; }
      .status-box p { margin:0; color:var(--muted); font-size:13px; }
      .qr-box { border:1px solid var(--line); border-radius:10px; padding:10px; display:flex; flex-direction:column; align-items:center; gap:6px; }
      .qr-box img { width:120px; height:120px; display:block; border-radius:6px; }
      .qr-box .qr-label { font-size:11px; color:var(--muted); text-align:center; }
      .controls { display:flex; gap:8px; align-items:center; margin:0 0 14px; flex-wrap:wrap; }
      .browse-row { display:grid; grid-template-columns:minmax(140px,auto) 1fr auto; gap:10px; margin:0 0 10px; }
      input,select,button { border:1px solid var(--line); border-radius:10px; padding:9px 13px; font-size:14px; font-family:inherit; color:var(--text); background:var(--surface); }
      button { background:var(--accent); border-color:var(--accent); color:#fff; cursor:pointer; white-space:nowrap; }
      button:hover { filter:brightness(0.93); }
      button.secondary { background:var(--surface); color:var(--text); border-color:var(--line); }
      button.danger { background:var(--danger); border-color:var(--danger); }
      .breadcrumb { font-size:13px; color:var(--muted); margin:0 0 10px; display:flex; align-items:center; flex-wrap:wrap; gap:2px; }
      .breadcrumb span { color:var(--muted); }
      .breadcrumb button { background:none; border:none; padding:0 3px; color:var(--accent); font-size:13px; cursor:pointer; }
      .breadcrumb button:hover { text-decoration:underline; filter:none; }
      .list { border:1px solid var(--line); border-radius:10px; overflow:hidden; }
      .item { display:grid; grid-template-columns:minmax(180px,1fr) 90px 160px auto; gap:10px; align-items:center; border-bottom:1px solid var(--line); padding:9px 14px; }
      .item:last-child { border-bottom:none; }
      .item .name button { color:var(--accent); background:none; border:none; padding:0; font-size:14px; cursor:pointer; }
      .muted { color:var(--muted); font-size:13px; }
      .mono { font-family:"Menlo","Consolas",monospace; }
      .dl-btn { background:none; border:1px solid var(--accent); color:var(--accent); border-radius:8px; padding:4px 10px; font-size:12px; cursor:pointer; white-space:nowrap; min-width:90px; text-align:center; }
      .dl-btn:hover { background:var(--accent); color:#fff; filter:none; }
      .dl-btn:disabled { opacity:0.5; cursor:default; }
      .progress-bar-wrap { height:4px; border-radius:2px; background:var(--line); overflow:hidden; width:100%; margin-top:3px; }
      .progress-bar { height:100%; background:var(--accent); border-radius:2px; width:0%; transition:width 0.1s linear; }
      .pin-overlay { position:fixed; inset:0; background:rgba(20,33,50,0.55); display:flex; align-items:center; justify-content:center; z-index:100; }
      .pin-overlay.hidden { display:none; }
      .pin-card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:28px 32px; width:320px; box-shadow:0 20px 60px rgba(20,44,88,0.16); text-align:center; }
      .pin-card h2 { margin:0 0 8px; font-size:18px; }
      .pin-card p { margin:0 0 18px; font-size:13px; color:var(--muted); }
      .pin-card input { width:100%; text-align:center; letter-spacing:0.2em; font-size:18px; margin-bottom:12px; padding:10px; }
      .pin-card .pin-error { color:var(--danger); font-size:13px; margin:-6px 0 10px; min-height:18px; }
      .pin-card button { width:100%; }
      @media (max-width:760px) { body{padding:10px;} .card{padding:16px;} .status-grid{grid-template-columns:1fr 1fr;} .qr-box{display:none;} .browse-row{grid-template-columns:1fr;} .item{grid-template-columns:1fr auto;} .item .muted.hide-sm{display:none;} }
    </style>
  </head>
  <body>
    <div id="pinOverlay" class="pin-overlay hidden">
      <div class="pin-card">
        <h2>Session PIN Required</h2>
        <p>Enter the PIN to access shared files on this host.</p>
        <input id="pinOverlayInput" type="password" inputmode="numeric" maxlength="16" placeholder="Enter PIN" autocomplete="off" />
        <div id="pinOverlayError" class="pin-error"></div>
        <button id="pinOverlaySubmit">Unlock</button>
      </div>
    </div>
    <section class="card">
      <h1>LAN File Host</h1>
      <p class="subtitle">Browse and download files shared by this host.</p>
      <div id="warning" class="banner">Loading host status&#8230;</div>
      <div class="status-grid">
        <div class="status-box"><strong>Sharing Status</strong><p id="sharingState">&#8212;</p></div>
        <div class="status-box"><strong>Host IPs (LAN)</strong><p id="hostIps" class="mono">&#8212;</p></div>
        <div class="qr-box" id="qrBox" style="visibility:hidden">
          <img id="qrImg" src="" alt="QR code" />
          <div class="qr-label">Scan to open on phone</div>
        </div>
      </div>
      <div class="controls">
        <button id="startSharing" class="secondary" hidden>&#9654; Start Sharing</button>
        <button id="stopSharing" class="danger" hidden>&#9632; Stop Sharing</button>
        <button id="refreshStatus" class="secondary">&#8635; Refresh Status</button>
      </div>
      <div class="browse-row">
        <select id="root"></select>
        <input id="pinInput" type="password" inputmode="numeric" placeholder="Session PIN (if required)" autocomplete="off" />
        <button id="refresh">Browse</button>
      </div>
      <div class="breadcrumb" id="breadcrumb"></div>
      <div class="list" id="list"></div>
    </section>
    <script>
      const state={root:"",path:"",pin:"",roots:[],sharingActive:true,canControlHost:false,requiresPin:false,lanUrls:[]};
      const listEl=document.getElementById("list"),rootEl=document.getElementById("root"),breadcrumbEl=document.getElementById("breadcrumb"),
            pinInputEl=document.getElementById("pinInput"),refreshEl=document.getElementById("refresh"),
            warningEl=document.getElementById("warning"),sharingStateEl=document.getElementById("sharingState"),
            hostIpsEl=document.getElementById("hostIps"),refreshStatusEl=document.getElementById("refreshStatus"),
            startSharingEl=document.getElementById("startSharing"),stopSharingEl=document.getElementById("stopSharing"),
            qrBoxEl=document.getElementById("qrBox"),qrImgEl=document.getElementById("qrImg"),
            pinOverlayEl=document.getElementById("pinOverlay"),pinOverlayInputEl=document.getElementById("pinOverlayInput"),
            pinOverlayErrorEl=document.getElementById("pinOverlayError"),pinOverlaySubmitEl=document.getElementById("pinOverlaySubmit");
      function formatBytes(b){if(!b)return"0 B";const u=["B","KB","MB","GB","TB"],i=Math.min(Math.floor(Math.log2(b)/10),u.length-1);const v=b/Math.pow(1024,i);return(i===0?v:v.toFixed(1))+" "+u[i];}
      function apiUrl(ep,p={}){const u=new URL(ep,window.location.origin);for(const[k,v]of Object.entries(p))if(v!=null&&v!=="")u.searchParams.set(k,String(v));return u;}
      const PIN_KEY="lan_file_host_pin",storedPin=()=>sessionStorage.getItem(PIN_KEY)||"",
            savePin=(p)=>p?sessionStorage.setItem(PIN_KEY,p):sessionStorage.removeItem(PIN_KEY),
            clearPin=()=>{sessionStorage.removeItem(PIN_KEY);state.pin="";pinInputEl.value="";};
      function showPinGate(){pinOverlayEl.classList.remove("hidden");pinOverlayInputEl.value="";pinOverlayErrorEl.textContent="";pinOverlayInputEl.focus();}
      function hidePinGate(){pinOverlayEl.classList.add("hidden");}
      async function submitPinOverlay(){
        const c=pinOverlayInputEl.value.trim();if(!c)return;
        const r=await fetch(apiUrl("/api/list",{root:state.root||"0",path:"",pin:c}));
        if(r.status===401){pinOverlayErrorEl.textContent="Incorrect PIN. Try again.";pinOverlayInputEl.select();return;}
        state.pin=c;pinInputEl.value=c;savePin(c);hidePinGate();await loadDirectory();
      }
      pinOverlaySubmitEl.addEventListener("click",submitPinOverlay);
      pinOverlayInputEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")submitPinOverlay();});
      function renderWarning(s){
        warningEl.className=s.securityMode==="open-local-network"?"banner":"banner safe";
        warningEl.textContent=s.securityMode==="open-local-network"?"Warning: PIN is disabled. Any device on this LAN can access files while sharing is active.":"PIN protection is active for file access.";
      }
      function renderHostSummary(s){
        const started=s.lastStartedAt?new Date(s.lastStartedAt).toLocaleTimeString():"\u2014";
        sharingStateEl.textContent=s.sharingActive?"Active (last started: "+started+")":"Stopped by host";
        hostIpsEl.textContent=(s.lanAddresses||[]).length?s.lanAddresses.join("\n"):"No LAN IPv4 address detected";
        state.sharingActive=Boolean(s.sharingActive);state.canControlHost=Boolean(s.canControlHost);
        state.requiresPin=Boolean(s.requiresPin);state.lanUrls=Array.isArray(s.lanUrls)?s.lanUrls:[];
        startSharingEl.hidden=!state.canControlHost;stopSharingEl.hidden=!state.canControlHost;
      }
      async function loadQr(){try{const r=await fetch("/api/qr");if(!r.ok)return;const{dataUrl}=await r.json();qrImgEl.src=dataUrl;qrBoxEl.style.visibility="visible";}catch{}}
      async function loadStatus(){
        const r=await fetch(apiUrl("/api/status"));if(!r.ok)throw new Error("Status error");
        const s=await r.json();state.roots=s.roots;state.root=state.root||(s.roots[0]&&s.roots[0].id)||"";
        renderWarning(s);renderHostSummary(s);rootEl.innerHTML="";
        s.roots.forEach((root)=>{const o=document.createElement("option");o.value=root.id;o.textContent=root.name;if(root.id===state.root)o.selected=true;rootEl.appendChild(o);});
      }
      function renderBreadcrumb(rootName,relPath){
        breadcrumbEl.innerHTML="";
        const addBtn=(l,fn)=>{const b=document.createElement("button");b.textContent=l;b.addEventListener("click",fn);breadcrumbEl.appendChild(b);};
        const addSpan=(t)=>{const s=document.createElement("span");s.textContent=t;breadcrumbEl.appendChild(s);};
        addBtn(rootName,()=>{state.path="";loadDirectory();});
        if(relPath)relPath.split("/").forEach((part,i,arr)=>{addSpan(" / ");const acc=arr.slice(0,i+1).join("/");i===arr.length-1?addSpan(part):addBtn(part,()=>{state.path=acc;loadDirectory();});});
      }
      async function downloadFile(relPath){
        const url=apiUrl("/api/download",{root:state.root,path:relPath,pin:state.pin});
        const wrap=document.querySelector('[data-dl-path="'+CSS.escape(relPath)+'"]');
        const btn=wrap&&wrap.querySelector(".dl-btn"),bar=wrap&&wrap.querySelector(".progress-bar");
        if(btn){btn.disabled=true;btn.textContent="\u2193 0%";}
        try{
          const resp=await fetch(url);
          if(resp.status===401){clearPin();showPinGate();if(btn){btn.disabled=false;btn.textContent="\u2193 Download";}return;}
          if(!resp.ok){alert("Download failed: "+resp.statusText);if(btn){btn.disabled=false;btn.textContent="\u2193 Download";}return;}
          const contentLength=Number(resp.headers.get("Content-Length")||0),reader=resp.body.getReader(),chunks=[];let received=0;
          while(true){const{done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;
            if(contentLength>0&&btn&&bar){const pct=Math.round(received/contentLength*100);btn.textContent="\u2193 "+pct+"%";bar.style.width=pct+"%";}else if(btn)btn.textContent="\u2193 \u2026";}
          const disp=resp.headers.get("Content-Disposition")||"",nm=disp.match(/filename="([^"]+)"/),filename=nm?decodeURIComponent(nm[1]):relPath.split("/").pop()||"download";
          const blob=new Blob(chunks,{type:resp.headers.get("Content-Type")||"application/octet-stream"}),obj=URL.createObjectURL(blob),a=document.createElement("a");a.href=obj;a.download=filename;a.click();URL.revokeObjectURL(obj);
        }finally{if(btn){btn.disabled=false;btn.textContent="\u2193 Download";}if(bar)bar.style.width="0%";}
      }
      async function loadDirectory(){
        if(!state.sharingActive){listEl.innerHTML='<div class="item" style="grid-column:1/-1"><span>Sharing is stopped. Start sharing to browse.</span></div>';breadcrumbEl.innerHTML="";return;}
        state.pin=pinInputEl.value.trim()||storedPin();
        if(state.requiresPin&&!state.pin){showPinGate();return;}
        const resp=await fetch(apiUrl("/api/list",{root:state.root,path:state.path,pin:state.pin}));
        if(resp.status===401){clearPin();showPinGate();return;}
        if(!resp.ok){listEl.innerHTML='<div class="item" style="grid-column:1/-1"><span>Failed to load. Check root/path/PIN.</span></div>';return;}
        const payload=await resp.json();savePin(state.pin);
        const rootName=(state.roots.find((r)=>r.id===state.root)||{}).name||"root";
        renderBreadcrumb(rootName,payload.path);listEl.innerHTML="";
        if(payload.path){
          const pp=payload.path.includes("/")?payload.path.split("/").slice(0,-1).join("/"):"";
          const row=document.createElement("div");row.className="item";
          row.innerHTML='<div class="name" style="grid-column:1/-1"><button>\u2b06 ..</button></div>';
          row.querySelector("button").addEventListener("click",()=>{state.path=pp;loadDirectory();});listEl.appendChild(row);
        }
        payload.entries.forEach((entry)=>{
          const row=document.createElement("div");row.className="item";
          const nameCell=entry.isDirectory?'<div class="name"><button>\uD83D\uDCC1 '+entry.name+'/</button></div>':'<div class="name"><span>\uD83D\uDCC4 '+entry.name+'</span></div>';
          const sizeCell='<div class="muted hide-sm">'+(entry.isDirectory?"\u2014":formatBytes(entry.size))+'</div>';
          const dateCell='<div class="muted hide-sm">'+new Date(entry.modifiedAt).toLocaleString()+'</div>';
          const actionCell=entry.isDirectory?'<div></div>':'<div data-dl-path="'+entry.relPath+'">'+'<button class="dl-btn">\u2193 Download</button>'+'<div class="progress-bar-wrap"><div class="progress-bar"></div></div></div>';
          row.innerHTML=nameCell+sizeCell+dateCell+actionCell;
          if(entry.isDirectory)row.querySelector("button").addEventListener("click",()=>{state.path=entry.relPath;loadDirectory();});
          else row.querySelector(".dl-btn").addEventListener("click",()=>downloadFile(entry.relPath));
          listEl.appendChild(row);
        });
        if(!payload.entries.length&&!payload.path)listEl.innerHTML='<div class="item" style="grid-column:1/-1"><span class="muted">This folder is empty.</span></div>';
      }
      async function sendHostControl(action){
        const r=await fetch(apiUrl("/api/host/"+action),{method:"POST"});
        if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));alert(e.error||"Host control failed");return;}
        await loadStatus();await loadDirectory();
      }
      rootEl.addEventListener("change",()=>{state.root=rootEl.value;state.path="";loadDirectory();});
      refreshEl.addEventListener("click",()=>{state.path="";loadDirectory();});
      refreshStatusEl.addEventListener("click",async()=>{await loadStatus();await loadDirectory();});
      startSharingEl.addEventListener("click",()=>sendHostControl("start"));
      stopSharingEl.addEventListener("click",()=>sendHostControl("stop"));
      (async()=>{await loadStatus();loadQr();const saved=storedPin();if(saved){state.pin=saved;pinInputEl.value=saved;}await loadDirectory();})();
    </script>
  </body>
</html>`;
}
