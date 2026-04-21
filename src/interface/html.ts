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
      [hidden] { display:none !important; }
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
      .mode-toggle { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:13px; }
      .mode-toggle input { width:auto; margin:0; }
      .host-row { display:grid; grid-template-columns:1fr auto; gap:10px; margin:0 0 10px; }
      .host-label { display:block; margin:2px 0 6px; color:var(--muted); font-size:12px; }
      .health-box { border:1px solid var(--line); border-radius:10px; padding:12px; background:#fafcff; }
      .health-box h3 { margin:0 0 8px; font-size:14px; }
      .health-box .mono { font-family:"Menlo","Consolas",monospace; font-size:12px; white-space:pre-wrap; }
      .health-links { display:grid; gap:8px; }
      .health-link-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; }
      .health-link { color:var(--accent); text-decoration:none; overflow-wrap:anywhere; }
      .health-link:hover { text-decoration:underline; }
      .health-copy { padding:6px 10px; font-size:12px; }
      .health-list { margin:0; padding-left:16px; color:var(--muted); font-size:12px; }
      .health-list li { margin:4px 0; }
      .browse-row { display:grid; grid-template-columns:minmax(140px,auto) 1fr auto; gap:10px; margin:0 0 10px; }
      .dir-actions { display:flex; gap:8px; margin:0 0 10px; }
      .dir-actions input { flex:1; }
      .root-label { border:1px solid var(--line); border-radius:10px; padding:9px 13px; background:#f8fbff; color:var(--muted); font-size:13px; }
      .download-panel { margin-top:14px; border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
      .download-panel h3 { margin:0 0 8px; font-size:14px; }
      .download-empty { color:var(--muted); font-size:13px; }
      .download-item { border-top:1px solid var(--line); padding:8px 0; }
      .download-item:first-child { border-top:none; padding-top:0; }
      .download-top { display:flex; justify-content:space-between; gap:8px; align-items:center; font-size:13px; }
      .download-name { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .download-status { color:var(--muted); font-size:12px; }
      .download-meta { display:flex; justify-content:space-between; gap:8px; margin-top:4px; font-size:12px; color:var(--muted); }
      .download-actions { display:flex; gap:8px; margin-top:6px; }
      .download-actions button { padding:5px 8px; font-size:12px; }
      .btn-compact { padding:6px 10px; font-size:13px; }
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
      .list-header { display:grid; grid-template-columns:minmax(180px,1fr) 90px 160px auto; gap:10px; align-items:center; border-bottom:1px solid var(--line); padding:9px 14px; background:#f8fbff; }
      .sort-btn { background:none; border:none; padding:0; color:var(--text); font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px; }
      .sort-btn:hover { color:var(--accent); filter:none; }
      .item { display:grid; grid-template-columns:minmax(180px,1fr) 90px 160px auto; gap:10px; align-items:center; border-bottom:1px solid var(--line); padding:9px 14px; }
      .item:last-child { border-bottom:none; }
      .item .name button { color:var(--accent); background:none; border:none; padding:0; font-size:14px; cursor:pointer; }
      .entry-actions { display:flex; justify-content:flex-end; gap:6px; align-items:center; }
      .icon-btn { background:var(--surface); color:var(--danger); border:1px solid var(--line); border-radius:8px; padding:4px 8px; font-size:12px; cursor:pointer; }
      .icon-btn:hover { background:#fff5f5; filter:none; }
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
        <button id="startSharing" class="primary" hidden>&#9654; Start Sharing</button>
        <button id="stopSharing" class="danger" hidden>&#9632; Stop Sharing</button>
        <label class="mode-toggle"><input id="downloadModeToggle" type="checkbox" /> Browser-managed download mode</label>
      </div>
      <div class="browse-row">
        <select id="root"></select>
        <div id="rootLabel" class="root-label" hidden></div>
        <input id="pinInput" type="password" inputmode="numeric" placeholder="Session PIN (if required)" autocomplete="off" />
        <button id="refresh" class="primary btn-compact">Refresh</button>
      </div>
      <div class="dir-actions" id="dirActions" hidden>
        <input id="newDirName" type="text" placeholder="New folder name" autocomplete="off" />
        <button id="createDirBtn" class="secondary">Create Folder</button>
      </div>
      <div class="breadcrumb" id="breadcrumb"></div>
      <div class="list" id="list"></div>
        <section class="download-panel" id="uploadPanel">
             <h3>Uploads</h3>
             <div style="margin-bottom:10px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;">
               <input id="fileInput" type="file" style="flex:1;" />
               <button id="uploadBtn" class="secondary">📤 Upload</button>
             </div>
             <div id="uploadItems" class="download-empty">No uploads yet.</div>
        </section>
      <section class="download-panel">
        <h3>Downloads</h3>
        <div id="downloadItems" class="download-empty">No downloads yet.</div>
      </section>
    </section>
    <script>
      const state={root:"",path:"",pin:"",roots:[],sharingActive:true,canControlHost:false,requiresPin:false,lanUrls:[],downloadMode:localStorage.getItem("lan_download_mode")==="browser"?"browser":"managed",downloads:new Map(),uploads:new Map(),uploadMaxSizeMb:51200,uploadEnabled:false,createEnabled:false,deleteEnabled:false,sortBy:"name",sortDir:"asc"};
      const listEl=document.getElementById("list"),rootEl=document.getElementById("root"),breadcrumbEl=document.getElementById("breadcrumb"),
            pinInputEl=document.getElementById("pinInput"),refreshEl=document.getElementById("refresh"),
            warningEl=document.getElementById("warning"),sharingStateEl=document.getElementById("sharingState"),
        hostIpsEl=document.getElementById("hostIps"),
            startSharingEl=document.getElementById("startSharing"),stopSharingEl=document.getElementById("stopSharing"),
        downloadModeToggleEl=document.getElementById("downloadModeToggle"),downloadItemsEl=document.getElementById("downloadItems"),
           fileInputEl=document.getElementById("fileInput"),uploadBtnEl=document.getElementById("uploadBtn"),uploadItemsEl=document.getElementById("uploadItems"),uploadPanelEl=document.getElementById("uploadPanel"),
            rootLabelEl=document.getElementById("rootLabel"),
            dirActionsEl=document.getElementById("dirActions"),newDirNameEl=document.getElementById("newDirName"),createDirBtnEl=document.getElementById("createDirBtn"),
            qrBoxEl=document.getElementById("qrBox"),qrImgEl=document.getElementById("qrImg"),
            pinOverlayEl=document.getElementById("pinOverlay"),pinOverlayInputEl=document.getElementById("pinOverlayInput"),
            pinOverlayErrorEl=document.getElementById("pinOverlayError"),pinOverlaySubmitEl=document.getElementById("pinOverlaySubmit");
      function formatBytes(b){if(!b)return"0 B";const u=["B","KB","MB","GB","TB"],i=Math.min(Math.floor(Math.log2(b)/10),u.length-1);const v=b/Math.pow(1024,i);return(i===0?v:v.toFixed(1))+" "+u[i];}
      function apiUrl(ep,p={}){const u=new URL(ep,window.location.origin);for(const[k,v]of Object.entries(p))if(v!=null&&v!=="")u.searchParams.set(k,String(v));return u;}
      const PIN_KEY="lan_file_host_pin",storedPin=()=>sessionStorage.getItem(PIN_KEY)||"",
            savePin=(p)=>p?sessionStorage.setItem(PIN_KEY,p):sessionStorage.removeItem(PIN_KEY),
            clearPin=()=>{sessionStorage.removeItem(PIN_KEY);state.pin="";pinInputEl.value="";};
      function formatSpeed(v){if(!v||v<=0)return"\u2014";return formatBytes(v)+"/s";}
      const UPLOAD_CHUNK_SIZE=2*1024*1024;
      const currentPin=()=>pinInputEl.value.trim()||state.pin||storedPin();
      function setDownloadMode(mode){
        state.downloadMode=mode;
        localStorage.setItem("lan_download_mode",mode);
        downloadModeToggleEl.checked=mode==="browser";
      }
      function upsertDownload(entry){
        state.downloads.set(entry.relPath,entry);
        renderDownloadPanel();
      }
      function renderDownloadPanel(){
        const items=Array.from(state.downloads.values());
        if(!items.length){downloadItemsEl.className="download-empty";downloadItemsEl.innerHTML="No downloads yet.";return;}
        downloadItemsEl.className="";
        downloadItemsEl.innerHTML="";
        items.forEach((d)=>{
          const row=document.createElement("div");row.className="download-item";
          const pct=d.total>0?Math.round((d.received/d.total)*100):0;
          const doneText=d.total>0?formatBytes(d.received)+" / "+formatBytes(d.total):formatBytes(d.received)+" / unknown";
          const statusText=d.status==="error"&&d.error?d.status+": "+d.error:d.status;
          const actions=(d.status==="error"||d.status==="paused")?'<button data-action="resume" data-path="'+d.relPath+'">Resume</button>':'';
          row.innerHTML='<div class="download-top"><span class="download-name">'+d.filename+'</span><span class="download-status">'+statusText+'</span></div>'+
            '<div class="progress-bar-wrap"><div class="progress-bar" style="width:'+(d.status==="completed"?100:pct)+'%"></div></div>'+
            '<div class="download-meta"><span>'+doneText+'</span><span>'+formatSpeed(d.speed)+'</span></div>'+
            '<div class="download-actions">'+actions+'</div>';
          const resumeBtn=row.querySelector('button[data-action="resume"]');
          if(resumeBtn)resumeBtn.addEventListener("click",()=>resumeManagedDownload(d.relPath));
          downloadItemsEl.appendChild(row);
        });
      }
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
        hostIpsEl.textContent=(s.lanAddresses||[]).length?s.lanAddresses.join("\\n"):"No LAN IPv4 address detected";
        state.sharingActive=Boolean(s.sharingActive);state.canControlHost=Boolean(s.canControlHost);
        state.requiresPin=Boolean(s.requiresPin);state.lanUrls=Array.isArray(s.lanUrls)?s.lanUrls:[];
        pinInputEl.hidden=!state.requiresPin;
        startSharingEl.hidden=!state.canControlHost||state.sharingActive;
        stopSharingEl.hidden=!state.canControlHost||!state.sharingActive;
      }
      async function loadQr(){try{const r=await fetch("/api/qr");if(!r.ok)return;const{dataUrl}=await r.json();qrImgEl.src=dataUrl;qrBoxEl.style.visibility="visible";}catch{}}
      async function loadStatus(){
        const r=await fetch(apiUrl("/api/status"));if(!r.ok)throw new Error("Status error");
        const s=await r.json();state.roots=s.roots;
         state.uploadMaxSizeMb=s.uploadMaxSizeMb||51200;state.uploadEnabled=Boolean(s.uploadEnabled);
         state.createEnabled=Boolean(s.createEnabled ?? s.modifyEnabled);
         state.deleteEnabled=Boolean(s.deleteEnabled);
        uploadPanelEl.hidden=!state.uploadEnabled;
        fileInputEl.disabled=!state.uploadEnabled;
        uploadBtnEl.disabled=!state.uploadEnabled||!fileInputEl.files?.length;
        dirActionsEl.hidden=!state.createEnabled;
        const hasCurrentRoot=s.roots.some((root)=>root.id===state.root);
        state.root=hasCurrentRoot?state.root:((s.roots[0]&&s.roots[0].id)||"");
        renderWarning(s);renderHostSummary(s);rootEl.innerHTML="";
        s.roots.forEach((root)=>{const o=document.createElement("option");o.value=root.id;o.textContent=root.name;if(root.id===state.root)o.selected=true;rootEl.appendChild(o);});
        const activeRoot=s.roots.find((root)=>root.id===state.root);
        if(s.roots.length<=1){
          rootEl.hidden=true;
          rootEl.disabled=true;
          rootLabelEl.hidden=false;
          rootLabelEl.textContent=activeRoot?"Shared directory: "+activeRoot.name:"Shared directory";
        }else{
          rootEl.hidden=false;
          rootEl.disabled=false;
          rootLabelEl.hidden=true;
          rootLabelEl.textContent="";
        }
      }
      function renderBreadcrumb(rootName,relPath){
        breadcrumbEl.innerHTML="";
        const addBtn=(l,fn)=>{const b=document.createElement("button");b.textContent=l;b.addEventListener("click",fn);breadcrumbEl.appendChild(b);};
        const addSpan=(t)=>{const s=document.createElement("span");s.textContent=t;breadcrumbEl.appendChild(s);};
        addBtn(rootName,()=>{state.path="";loadDirectory();});
        if(relPath)relPath.split("/").forEach((part,i,arr)=>{addSpan(" / ");const acc=arr.slice(0,i+1).join("/");i===arr.length-1?addSpan(part):addBtn(part,()=>{state.path=acc;loadDirectory();});});
      }
      function markButtonProgress(relPath,text,pct){
        const wrap=document.querySelector('[data-dl-path="'+CSS.escape(relPath)+'"]');
        const btn=wrap&&wrap.querySelector(".dl-btn"),bar=wrap&&wrap.querySelector(".progress-bar");
        if(btn)btn.textContent=text;
        if(bar&&typeof pct==="number")bar.style.width=pct+"%";
      }
      function setButtonBusy(relPath,busy){
        const wrap=document.querySelector('[data-dl-path="'+CSS.escape(relPath)+'"]');
        const btn=wrap&&wrap.querySelector(".dl-btn");
        if(btn)btn.disabled=busy;
      }
      function triggerBrowserManagedDownload(relPath){
        const url=apiUrl("/api/download",{root:state.root,path:relPath,pin:state.pin});
        const a=document.createElement("a");
        a.href=url.toString();
        a.click();
        upsertDownload({relPath,filename:relPath.split("/").pop()||relPath,received:0,total:0,status:"delegated-to-browser",error:"",speed:0,chunks:[]});
      }
      function triggerBrowserManagedDownloadDirectory(relPath){
        const url=apiUrl("/api/download-directory",{root:state.root,path:relPath,pin:state.pin});
        const a=document.createElement("a");
        a.href=url.toString();
        a.click();
        const dirName=relPath.split("/").pop()||relPath||"archive";
        upsertDownload({relPath,filename:dirName+".zip",received:0,total:0,status:"delegated-to-browser",error:"",speed:0,chunks:[]});
      }
      function parseFilename(resp,relPath){
        const disp=resp.headers.get("Content-Disposition")||"";
        const nm=disp.match(/filename="([^"]+)"/);
        return nm?decodeURIComponent(nm[1]):relPath.split("/").pop()||"download";
      }
      function parseTotalSize(resp,receivedFallback){
        const cr=resp.headers.get("Content-Range")||"";
        const m=cr.match(/\\\/(\\d+)$/);
        if(m)return Number(m[1])||0;
        const cl=Number(resp.headers.get("Content-Length")||0);
        return cl>0?cl+receivedFallback:0;
      }
      async function streamManagedDownload(download){
        setButtonBusy(download.relPath,true);
        const t0=Date.now();
        try{
          download.status="downloading";download.error="";upsertDownload(download);
          while(download.total===0||download.received<download.total){
            const url=apiUrl("/api/download",{root:state.root,path:download.relPath,pin:state.pin});
            const headers={};
            if(download.received>0)headers.Range="bytes="+download.received+"-";
            const controller=new AbortController();
            download.controller=controller;
            const resp=await fetch(url,{headers,signal:controller.signal});
            if(resp.status===401){clearPin();showPinGate();download.status="error";download.error="PIN required";upsertDownload(download);break;}
            if(!(resp.ok||resp.status===206)){download.status="error";download.error=resp.status+" "+resp.statusText;upsertDownload(download);break;}
            if(download.total===0)download.total=parseTotalSize(resp,download.received);
            if(!download.filename)download.filename=parseFilename(resp,download.relPath);
            const reader=resp.body.getReader();
            while(true){
              const {done,value}=await reader.read();
              if(done)break;
              download.chunks.push(value);
              download.received+=value.length;
              const elapsed=Math.max(1,(Date.now()-t0)/1000);
              download.speed=Math.round(download.received/elapsed);
              const pct=download.total>0?Math.round((download.received/download.total)*100):0;
              markButtonProgress(download.relPath,"\u2193 "+(download.total>0?pct+"%":"\u2026"),pct);
              upsertDownload(download);
            }
            if(download.total===0)break;
            if(download.received>=download.total)break;
          }
          if(download.status==="downloading"&&(download.total===0||download.received>=download.total)){
            const blob=new Blob(download.chunks,{type:"application/octet-stream"});
            const obj=URL.createObjectURL(blob);
            const a=document.createElement("a");
            a.href=obj;a.download=download.filename||"download";a.click();
            URL.revokeObjectURL(obj);
            download.status="completed";
            upsertDownload(download);
            markButtonProgress(download.relPath,"\u2193 Download",0);
          }
        }catch(err){
          download.status="paused";
          download.error=err&&err.name==="AbortError"?"Canceled":(err&&err.message?err.message:"Connection lost");
          upsertDownload(download);
        }finally{
          download.controller=null;
          setButtonBusy(download.relPath,false);
          if(download.status!=="downloading")markButtonProgress(download.relPath,"\u2193 Download",0);
        }
      }
      async function startManagedDownload(relPath){
        const existing=state.downloads.get(relPath);
        const download=existing&&existing.status!=="completed"?existing:{relPath,filename:relPath.split("/").pop()||relPath,received:0,total:0,status:"queued",error:"",speed:0,chunks:[]};
        upsertDownload(download);
        await streamManagedDownload(download);
      }
      async function startManagedDownloadDirectory(relPath){
        const dirName=relPath.split("/").pop()||relPath||"archive";
        const download={relPath,filename:dirName+".zip",received:0,total:0,status:"queued",error:"",speed:0,chunks:[]};
        upsertDownload(download);
        await streamManagedDownloadDirectory(download);
      }
      async function streamManagedDownloadDirectory(download){
        setButtonBusy(download.relPath,true);
        const t0=Date.now();
        try{
          download.status="downloading";download.error="";upsertDownload(download);
          const url=apiUrl("/api/download-directory",{root:state.root,path:download.relPath,pin:state.pin});
          const resp=await fetch(url);
          if(resp.status===401){clearPin();showPinGate();download.status="error";download.error="PIN required";upsertDownload(download);return;}
          if(!resp.ok){download.status="error";download.error=resp.status+" "+resp.statusText;upsertDownload(download);return;}
          download.total=Number(resp.headers.get("Content-Length")||0);
          const reader=resp.body.getReader();
          while(true){
            const {done,value}=await reader.read();
            if(done)break;
            download.chunks.push(value);
            download.received+=value.length;
            const elapsed=Math.max(1,(Date.now()-t0)/1000);
            download.speed=Math.round(download.received/elapsed);
            const pct=download.total>0?Math.round((download.received/download.total)*100):0;
            markButtonProgress(download.relPath,"\u2193 "+(download.total>0?pct+"%":"\u2026"),pct);
            upsertDownload(download);
          }
          if(download.status==="downloading"&&download.received>0){
            const blob=new Blob(download.chunks,{type:"application/zip"});
            const obj=URL.createObjectURL(blob);
            const a=document.createElement("a");
            a.href=obj;a.download=download.filename||"archive.zip";a.click();
            URL.revokeObjectURL(obj);
            download.status="completed";
            upsertDownload(download);
            markButtonProgress(download.relPath,"\u2193 ZIP",0);
          }
        }catch(err){
          download.status="paused";
          download.error=err&&err.name==="AbortError"?"Canceled":(err&&err.message?err.message:"Connection lost");
          upsertDownload(download);
        }finally{
          setButtonBusy(download.relPath,false);
          if(download.status!=="downloading")markButtonProgress(download.relPath,"\u2193 ZIP",0);
        }
      }
      async function resumeManagedDownload(relPath){
        const d=state.downloads.get(relPath);
        if(!d)return;
        await streamManagedDownload(d);
      }
      async function downloadFile(relPath){
        if(state.downloadMode==="browser"){triggerBrowserManagedDownload(relPath);return;}
        await startManagedDownload(relPath);
      }
      async function downloadDirectory(relPath){
        if(state.downloadMode==="browser"){triggerBrowserManagedDownloadDirectory(relPath);return;}
        await startManagedDownloadDirectory(relPath);
      }
       function handleFileSelect(e){
         const file=e.target.files?.[0];
         if(!file)return;
         const sizeMb=file.size/(1024*1024);
         if(sizeMb>state.uploadMaxSizeMb){alert("File exceeds "+state.uploadMaxSizeMb+" MB limit");fileInputEl.value="";return;}
         uploadBtnEl.disabled=false;
       }
       function pauseUpload(id){
         const upload=state.uploads.get(id);
         if(!upload||upload.status!=="uploading")return;
         upload.abortReason="paused";
         upload.status="paused";
         upload.speed=0;
         if(upload.chunkXhr){upload.chunkXhr.abort();}else{renderUploadPanel();}
       }
       async function cancelUpload(id){
         const upload=state.uploads.get(id);
         if(!upload)return;
         upload.abortReason="canceled";
         if(upload.chunkXhr)upload.chunkXhr.abort();
         upload.status="canceled";
         upload.error=null;
         upload.speed=0;
         renderUploadPanel();
         if(upload.uploadId){
           await fetch(apiUrl("/api/upload/resumable",{uploadId:upload.uploadId,pin:currentPin()}),{method:"DELETE"}).catch(()=>{});
           upload.uploadId=null;
           upload.received=0;
         }
       }
       function sendChunk(upload){
         return new Promise((resolve,reject)=>{
           const chunkStart=upload.received;
           const chunkEnd=Math.min(chunkStart+UPLOAD_CHUNK_SIZE,upload.size);
           const chunkBlob=upload.file.slice(chunkStart,chunkEnd);
           const startedAt=Date.now();
           const bytesAtStart=chunkStart;
           const xhr=new XMLHttpRequest();
           upload.chunkXhr=xhr;
           xhr.upload.addEventListener("progress",(e)=>{
             if(e.lengthComputable){
               upload.received=chunkStart+e.loaded;
               const elapsed=Math.max(1,Date.now()-startedAt);
               upload.speed=(upload.received-bytesAtStart)/(elapsed/1000);
               renderUploadPanel();
             }
           });
           xhr.addEventListener("load",()=>{
             upload.chunkXhr=null;
             if(xhr.status===409){
               try{const c=JSON.parse(xhr.responseText);upload.received=Number(c.expectedOffset)||chunkStart;}catch{}
               resolve({conflict:true});return;
             }
             if(xhr.status===200||xhr.status===201){
               try{const d=JSON.parse(xhr.responseText);upload.received=Number(d.receivedBytes)||chunkEnd;}catch{upload.received=chunkEnd;}
               resolve({conflict:false});return;
             }
             let msg="Chunk upload failed";
             try{const e=JSON.parse(xhr.responseText);msg=e.error||msg;}catch{}
             reject(new Error(msg));
           });
           xhr.addEventListener("abort",()=>{
             upload.chunkXhr=null;
             const e=new Error("Aborted");e.name="AbortError";reject(e);
           });
           xhr.addEventListener("error",()=>{
             upload.chunkXhr=null;
             reject(new Error("Network error during chunk upload"));
           });
           const url=apiUrl("/api/upload/resumable/chunk",{uploadId:upload.uploadId,offset:chunkStart,pin:currentPin()});
           xhr.open("POST",url.toString());
           xhr.setRequestHeader("Content-Type","application/octet-stream");
           xhr.send(chunkBlob);
         });
       }
       async function startUpload(id){
         const upload=state.uploads.get(id);
         if(!upload||!upload.file||upload.status==="uploading")return;
         if(!state.uploadEnabled){upload.status="error";upload.error="Uploads are disabled by host";renderUploadPanel();return;}
         upload.status="uploading";
         upload.error=null;
         upload.abortReason="";
         renderUploadPanel();
         try{
           if(!upload.uploadId){
             const initResp=await fetch(apiUrl("/api/upload/resumable/init",{pin:currentPin()}),{
               method:"POST",
               headers:{"Content-Type":"application/json"},
               body:JSON.stringify({filename:upload.filename,size:upload.size,root:state.root,path:state.path})
             });
             if(!initResp.ok){const e=await initResp.json().catch(()=>({error:"Failed to initialize upload"}));throw new Error(e.error||"Failed to initialize upload");}
             const initData=await initResp.json();
             upload.uploadId=initData.uploadId;
             upload.received=Number(initData.receivedBytes)||0;
           }else{
             const statusResp=await fetch(apiUrl("/api/upload/resumable/status",{uploadId:upload.uploadId,pin:currentPin()}));
             if(statusResp.ok){const s=await statusResp.json();upload.received=Number(s.receivedBytes)||upload.received;}
           }
           renderUploadPanel();
           while(upload.received<upload.size){
             if(upload.abortReason==="paused"||upload.status==="paused"){const e=new Error("Aborted");e.name="AbortError";throw e;}
             if(upload.abortReason==="canceled"||upload.status==="canceled"){const e=new Error("Aborted");e.name="AbortError";throw e;}
             await sendChunk(upload);
             renderUploadPanel();
           }
           const doneResp=await fetch(apiUrl("/api/upload/resumable/complete",{uploadId:upload.uploadId,pin:currentPin()}),{method:"POST"});
           if(!doneResp.ok){const e=await doneResp.json().catch(()=>({error:"Failed to finalize upload"}));throw new Error(e.error||"Failed to finalize upload");}
           upload.status="completed";
           upload.received=upload.size;
           upload.speed=0;
           renderUploadPanel();
           await loadDirectory().catch(()=>{});
         }catch(err){
           if(err&&err.name==="AbortError"){
             if(upload.status!=="canceled")upload.status=upload.abortReason==="canceled"?"canceled":"paused";
             if((upload.abortReason==="canceled"||upload.status==="canceled")&&upload.uploadId){
               await fetch(apiUrl("/api/upload/resumable",{uploadId:upload.uploadId,pin:currentPin()}),{method:"DELETE"}).catch(()=>{});
               upload.uploadId=null;
               upload.received=0;
             }
           }else{
             upload.status="error";
             upload.error=err&&err.message?err.message:"Upload failed";
           }
           upload.speed=0;
           renderUploadPanel();
         }finally{
           upload.chunkXhr=null;
           upload.abortReason="";
           renderUploadPanel();
         }
       }
       async function uploadFile(){
         const file=fileInputEl.files?.[0];
         if(!file)return;
         const sizeMb=file.size/(1024*1024);
         if(sizeMb>state.uploadMaxSizeMb){alert("File exceeds "+state.uploadMaxSizeMb+" MB limit");fileInputEl.value="";uploadBtnEl.disabled=true;return;}
         if(!state.uploadEnabled){alert("Uploads are disabled by host");return;}
         const id=Math.random().toString(36).slice(2);
         const upload={id,filename:file.name,size:file.size,received:0,status:"queued",error:null,speed:0,startTime:Date.now(),file,chunkXhr:null,uploadId:null,abortReason:""};
         state.uploads.set(id,upload);
         fileInputEl.value="";
         uploadBtnEl.disabled=true;
         renderUploadPanel();
         startUpload(id);
       }
       function renderUploadPanel(){
         const items=Array.from(state.uploads.values());
         if(!items.length){uploadItemsEl.className="download-empty";uploadItemsEl.innerHTML="No uploads yet.";return;}
         uploadItemsEl.className="";uploadItemsEl.innerHTML="";
         items.forEach((u)=>{
           const row=document.createElement("div");row.className="download-item";
           const pct=u.size>0?Math.round((u.received/u.size)*100):0;
           const doneText=u.size>0?formatBytes(u.received)+" / "+formatBytes(u.size):formatBytes(u.received)+" / unknown";
           const statusText=u.status==="error"&&u.error?u.status+": "+u.error:u.status;
           const actions=u.status==="uploading"
             ?'<button class="secondary" data-action="pause" data-id="'+u.id+'">Pause</button><button class="danger" data-action="cancel" data-id="'+u.id+'">Cancel</button>'
             :(u.status==="paused"||u.status==="error"||u.status==="queued")
               ?'<button data-action="start" data-id="'+u.id+'">Start</button><button class="danger" data-action="cancel" data-id="'+u.id+'">Cancel</button>'
               :'';
           row.innerHTML='<div class="download-top"><span class="download-name">'+u.filename+'</span><span class="download-status">'+statusText+'</span></div>'+
             '<div class="progress-bar-wrap"><div class="progress-bar" style="width:'+(u.status==="completed"?100:pct)+'%"></div></div>'+
             '<div class="download-meta"><span>'+doneText+'</span><span>'+formatSpeed(u.speed)+'</span></div>'+
             '<div class="download-actions">'+actions+'</div>';
           const startBtn=row.querySelector('button[data-action="start"]');
           const pauseBtn=row.querySelector('button[data-action="pause"]');
           const cancelBtn=row.querySelector('button[data-action="cancel"]');
           if(startBtn)startBtn.addEventListener("click",()=>startUpload(u.id));
           if(pauseBtn)pauseBtn.addEventListener("click",()=>pauseUpload(u.id));
           if(cancelBtn)cancelBtn.addEventListener("click",()=>cancelUpload(u.id));
           uploadItemsEl.appendChild(row);
         });
       }
      function toggleSort(sortBy){
        if(state.sortBy===sortBy){
          state.sortDir=state.sortDir==="asc"?"desc":"asc";
        }else{
          state.sortBy=sortBy;
          state.sortDir=sortBy==="name"?"asc":"desc";
        }
        loadDirectory();
      }
      function renderListHeader(){
        const header=document.createElement("div");
        header.className="list-header";
        const arrow=(k)=>state.sortBy===k?(state.sortDir==="asc"?"↑":"↓"):"";
        header.innerHTML=
          '<button class="sort-btn" data-sort="name">Name '+arrow("name")+'</button>'+
          '<button class="sort-btn hide-sm" data-sort="size">Size '+arrow("size")+'</button>'+
          '<button class="sort-btn hide-sm" data-sort="date">Modified '+arrow("date")+'</button>'+
          '<span class="muted" style="text-align:right">Actions</span>';
        header.querySelectorAll("button[data-sort]").forEach((btn)=>{
          btn.addEventListener("click",()=>toggleSort(btn.getAttribute("data-sort")));
        });
        listEl.appendChild(header);
      }
      async function createDirectory(){
        const name=newDirNameEl.value.trim();
        if(!name){alert("Enter a folder name");return;}
        const resp=await fetch(apiUrl("/api/fs/mkdir",{pin:currentPin()}),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({root:state.root,path:state.path,name})});
        if(!resp.ok){const e=await resp.json().catch(()=>({error:"Failed to create folder"}));alert(e.error||"Failed to create folder");return;}
        newDirNameEl.value="";
        await loadDirectory();
      }
      async function deleteEntry(relPath,name){
        if(!confirm('Delete "'+name+'"? This cannot be undone.'))return;
        const resp=await fetch(apiUrl("/api/fs/entry",{root:state.root,path:relPath,pin:currentPin()}),{method:"DELETE"});
        if(!resp.ok){const e=await resp.json().catch(()=>({error:"Failed to delete"}));alert(e.error||"Failed to delete");return;}
        await loadDirectory();
      }
      async function loadDirectory(){
        if(!state.sharingActive){listEl.innerHTML='<div class="item" style="grid-column:1/-1"><span>Sharing is stopped. Start sharing to browse.</span></div>';breadcrumbEl.innerHTML="";return;}
        state.pin=pinInputEl.value.trim()||storedPin();
        if(state.requiresPin&&!state.pin){showPinGate();return;}
        const resp=await fetch(apiUrl("/api/list",{root:state.root,path:state.path,pin:state.pin,sortBy:state.sortBy,sortDir:state.sortDir}));
        if(resp.status===401){clearPin();showPinGate();return;}
        if(!resp.ok){listEl.innerHTML='<div class="item" style="grid-column:1/-1"><span>Failed to load. Check root/path/PIN.</span></div>';return;}
        const payload=await resp.json();savePin(state.pin);
        const rootName=(state.roots.find((r)=>r.id===state.root)||{}).name||"root";
        renderBreadcrumb(rootName,payload.path);listEl.innerHTML="";
        renderListHeader();
        if(payload.path){
          const pp=payload.path.includes("/")?payload.path.split("/").slice(0,-1).join("/"):"";
          const row=document.createElement("div");row.className="item";
          row.innerHTML='<div class="name" style="grid-column:1/-1"><button>\u2b06 ..</button></div>';
          row.querySelector("button").addEventListener("click",()=>{state.path=pp;loadDirectory();});listEl.appendChild(row);
        }
        payload.entries.forEach((entry)=>{
          const row=document.createElement("div");row.className="item";
          const nameCell=entry.isDirectory?'<div class="name"><button>&#128193; '+entry.name+'/</button></div>':'<div class="name"><span>&#128196; '+entry.name+'</span></div>';
          const sizeCell='<div class="muted hide-sm">'+(entry.isDirectory?"\u2014":formatBytes(entry.size))+'</div>';
          const dateCell='<div class="muted hide-sm">'+new Date(entry.modifiedAt).toLocaleString()+'</div>';
          const delBtn=state.deleteEnabled?'<button class="icon-btn" data-delete="'+entry.relPath+'" data-name="'+entry.name+'">Delete</button>':'';
          const actionCell=entry.isDirectory?'<div class="entry-actions" data-dl-path="'+entry.relPath+'"><button class="dl-btn">\u2193 ZIP</button>'+delBtn+'<div class="progress-bar-wrap"><div class="progress-bar"></div></div></div>':'<div class="entry-actions" data-dl-path="'+entry.relPath+'">'+'<button class="dl-btn">\u2193 Download</button>'+delBtn+'<div class="progress-bar-wrap"><div class="progress-bar"></div></div></div>';
          row.innerHTML=nameCell+sizeCell+dateCell+actionCell;
          if(entry.isDirectory){row.querySelector("button").addEventListener("click",()=>{state.path=entry.relPath;loadDirectory();});row.querySelector(".dl-btn").addEventListener("click",()=>downloadDirectory(entry.relPath));}
          else row.querySelector(".dl-btn").addEventListener("click",()=>downloadFile(entry.relPath));
          const deleteBtn=row.querySelector("button[data-delete]");
          if(deleteBtn)deleteBtn.addEventListener("click",()=>deleteEntry(entry.relPath,entry.name));
          listEl.appendChild(row);
        });
        if(!payload.entries.length&&!payload.path){
          const row=document.createElement("div");row.className="item";
          row.innerHTML='<div style="grid-column:1/-1"><span class="muted">This folder is empty.</span></div>';
          listEl.appendChild(row);
        }
      }
      async function sendHostControl(action){
        const r=await fetch(apiUrl("/api/host/"+action),{method:"POST"});
        if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));alert(e.error||"Host control failed");return;}
        await loadStatus();await loadDirectory();
      }
      rootEl.addEventListener("change",()=>{state.root=rootEl.value;state.path="";loadDirectory();});
      refreshEl.addEventListener("click",async()=>{state.path="";await loadStatus();await loadDirectory();});
      startSharingEl.addEventListener("click",()=>sendHostControl("start"));
      stopSharingEl.addEventListener("click",()=>sendHostControl("stop"));
      downloadModeToggleEl.addEventListener("change",()=>setDownloadMode(downloadModeToggleEl.checked?"browser":"managed"));
      fileInputEl.addEventListener("change",handleFileSelect);
      uploadBtnEl.addEventListener("click",uploadFile);
      createDirBtnEl.addEventListener("click",createDirectory);
      newDirNameEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")createDirectory();});
      (async()=>{setDownloadMode(state.downloadMode);renderDownloadPanel();renderUploadPanel();await loadStatus();loadQr();const saved=storedPin();if(saved){state.pin=saved;pinInputEl.value=saved;}await loadDirectory();})();
    </script>
  </body>
</html>`;
}

/**
 * Render client UI (file browsing and downloads, no admin controls)
 * @returns HTML document as string
 */
export function renderClientUI(): string {
  // Same as renderHomePage - client-only view
  return renderHomePage();
}

/**
 * Render admin UI (host controls, localhost only)
 * @returns HTML document as string
 */
export function renderAdminUI(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>LAN File Host - Admin</title>
    <style>
      :root { color-scheme:light; --bg:#f5f7fb; --surface:#ffffff; --text:#152132; --muted:#607086; --accent:#1f6feb; --line:#dae2ee; --danger:#be2d2d; --success:#1f5f28; }
      * { box-sizing:border-box; }
      [hidden] { display:none !important; }
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
      .host-row { display:grid; grid-template-columns:1fr auto; gap:10px; margin:0 0 10px; }
      .host-label { display:block; margin:2px 0 6px; color:var(--muted); font-size:12px; }
      .mode-toggle { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:13px; }
      .mode-toggle input { width:auto; margin:0; }
      input,select,button { border:1px solid var(--line); border-radius:10px; padding:9px 13px; font-size:14px; font-family:inherit; color:var(--text); background:var(--surface); }
      button { background:var(--accent); border-color:var(--accent); color:#fff; cursor:pointer; white-space:nowrap; }
      button:hover { filter:brightness(0.93); }
      button.secondary { background:var(--surface); color:var(--text); border-color:var(--line); }
      button.danger { background:var(--danger); border-color:var(--danger); }
      @media (max-width:760px) { body{padding:10px;} .card{padding:16px;} .status-grid{grid-template-columns:1fr 1fr;} .qr-box{display:none;} }
    </style>
  </head>
  <body>
    <section class="card">
      <h1>LAN File Host</h1>
      <p class="subtitle">Host control panel. Start/stop sharing and manage shared directories.</p>
      <div id="warning" class="banner">Loading…</div>
      <div class="status-grid">
        <div class="status-box"><strong>Sharing Status</strong><p id="sharingState">—</p></div>
        <div class="status-box"><strong>Host IPs (LAN)</strong><p id="hostIps" class="mono">—</p></div>
        <div class="qr-box" id="qrBox" style="visibility:hidden">
          <img id="qrImg" src="" alt="QR code" />
          <div class="qr-label">Share link</div>
        </div>
      </div>
      <div class="controls">
        <button id="startSharing" class="secondary" hidden>▶ Start Sharing</button>
        <button id="stopSharing" class="danger" hidden>■ Stop Sharing</button>
        <button id="refreshStatus" class="secondary">⟲ Refresh Status</button>
      </div>
      <div class="host-row">
        <label for="shareRootPath" class="host-label" style="grid-column:1/-1">Shared directory path</label>
        <input id="shareRootPath" type="text" placeholder="Absolute directory path to share" autocomplete="off" />
        <button id="pickShareRoot" class="secondary">Choose Directory</button>
      </div>
      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px;">
        <h2 style="margin:0 0 12px;font-size:16px;">Upload Configuration</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:13px;">Control upload/create/delete permissions and maximum upload size.</p>
        <div style="margin:0 0 10px;">
          <label class="mode-toggle"><input id="uploadEnabled" type="checkbox" /> Allow client upload actions</label>
        </div>
        <div style="margin:0 0 10px;">
          <label class="mode-toggle"><input id="createEnabled" type="checkbox" /> Allow create actions</label>
        </div>
        <div style="margin:0 0 10px;">
          <label class="mode-toggle"><input id="deleteEnabled" type="checkbox" /> Allow delete actions</label>
        </div>
        <div class="host-row">
          <label for="uploadMaxSizeMb" class="host-label" style="grid-column:1/-1">Maximum upload size (MB)</label>
          <input id="uploadMaxSizeMb" type="number" min="1" max="51200" step="1" placeholder="e.g., 51200" />
          <button id="saveTransfer" class="secondary">Save Upload Settings</button>
        </div>
        <p id="transferStatus" style="margin:8px 0 0;color:var(--muted);font-size:12px;"></p>
      </div>
      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px;">
        <h2 style="margin:0 0 12px;font-size:16px;">Session PIN</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:13px;">Require a PIN before clients can browse or download files. Leave empty to allow open access.</p>
        <div id="pinStatusBox" style="margin:0 0 12px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13px;color:var(--muted);">Loading&hellip;</div>
        <div class="host-row">
          <label for="pinValue" class="host-label" style="grid-column:1/-1">New PIN (4&ndash;16 digits)</label>
          <input id="pinValue" type="password" inputmode="numeric" maxlength="16" placeholder="4–16 digit PIN" autocomplete="off" />
          <button id="savePinBtn" class="secondary">Set PIN</button>
        </div>
        <div style="margin-top:8px;">
          <button id="clearPinBtn" class="secondary" style="color:var(--danger);border-color:var(--danger);">Disable PIN</button>
        </div>
        <p id="pinSaveStatus" style="margin:8px 0 0;color:var(--muted);font-size:12px;"></p>
      </div>
      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px;">
        <h2 style="margin:0 0 12px;font-size:16px;">WebDAV Mode</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:13px;">Use WebDAV clients (Finder, Files app, Cyberduck, etc.) with these URLs. Toggle availability for clients here.</p>
        <div style="margin:0 0 10px;">
          <label class="mode-toggle"><input id="webdavEnabled" type="checkbox" /> Enable WebDAV mode</label>
        </div>
        <div id="webdavStatus" style="margin:0 0 10px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13px;color:var(--muted);">Loading&hellip;</div>
        <div id="webdavUrls" class="mono" style="margin:0 0 12px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:12px;white-space:pre-wrap;color:var(--text);">Loading&hellip;</div>
        <button id="saveWebdav" class="secondary">Save WebDAV Setting</button>
      </div>
      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px;">
        <h2 style="margin:0 0 12px;font-size:16px;">Client Access</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:13px;">Open the client UI below to access files from any device on the LAN.</p>
        <button id="openClientUI" class="secondary">Open Client UI</button>
      </div>
      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px;">
        <h2 style="margin:0 0 12px;font-size:16px;">Network Configuration</h2>
        <p style="margin:0 0 12px;color:var(--muted);font-size:13px;">Configure mDNS domain name for easy network access.</p>
        <div class="host-row">
          <label for="domainName" class="host-label" style="grid-column:1/-1">Custom domain name (mDNS)</label>
          <input id="domainName" type="text" placeholder="e.g., my-files.local" autocomplete="off" />
          <button id="saveDomain" class="secondary">Save Domain</button>
        </div>
        <p id="domainStatus" style="margin:8px 0 0;color:var(--muted);font-size:12px;"></p>
      </div>
      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px;">
        <h2 style="margin:0 0 12px;font-size:16px;">Discovery Health</h2>
        <div class="health-box">
          <h3>Configured Domain</h3>
          <p id="healthDomain" class="mono" style="margin:0 0 10px;color:var(--text);">Loading...</p>
          <h3>Client URLs</h3>
          <p id="healthUrls" class="mono" style="margin:0 0 10px;color:var(--text);">Loading...</p>
          <h3 style="margin-top:8px;">Network Warnings</h3>
          <ul id="healthWarnings" class="health-list"><li>Loading...</li></ul>
        </div>
      </div>
    </section>
    <script>
      const state={sharingActive:true,webdavUrls:[]};
      const sharingStateEl=document.getElementById("sharingState"),hostIpsEl=document.getElementById("hostIps"),
            refreshStatusEl=document.getElementById("refreshStatus"),startSharingEl=document.getElementById("startSharing"),
            stopSharingEl=document.getElementById("stopSharing"),shareRootPathEl=document.getElementById("shareRootPath"),
            pickShareRootEl=document.getElementById("pickShareRoot"),warningEl=document.getElementById("warning"),
            qrBoxEl=document.getElementById("qrBox"),qrImgEl=document.getElementById("qrImg"),
        uploadEnabledEl=document.getElementById("uploadEnabled"),createEnabledEl=document.getElementById("createEnabled"),deleteEnabledEl=document.getElementById("deleteEnabled"),uploadMaxSizeMbEl=document.getElementById("uploadMaxSizeMb"),
        saveTransferEl=document.getElementById("saveTransfer"),transferStatusEl=document.getElementById("transferStatus"),
            pinStatusBoxEl=document.getElementById("pinStatusBox"),pinValueEl=document.getElementById("pinValue"),
            savePinBtnEl=document.getElementById("savePinBtn"),clearPinBtnEl=document.getElementById("clearPinBtn"),pinSaveStatusEl=document.getElementById("pinSaveStatus"),
            webdavEnabledEl=document.getElementById("webdavEnabled"),saveWebdavEl=document.getElementById("saveWebdav"),webdavStatusEl=document.getElementById("webdavStatus"),webdavUrlsEl=document.getElementById("webdavUrls"),
            openClientUIEl=document.getElementById("openClientUI"),domainNameEl=document.getElementById("domainName"),
            saveDomainEl=document.getElementById("saveDomain"),domainStatusEl=document.getElementById("domainStatus"),
            healthDomainEl=document.getElementById("healthDomain"),healthUrlsEl=document.getElementById("healthUrls"),healthWarningsEl=document.getElementById("healthWarnings");
      function apiUrl(ep,p={}){const u=new URL(ep,window.location.origin);for(const[k,v]of Object.entries(p))if(v!=null&&v!=="")u.searchParams.set(k,String(v));return u;}
      function renderWarning(s){warningEl.className=s.securityMode==="open-local-network"?"banner":"banner safe";warningEl.textContent=s.securityMode==="open-local-network"?"⚠ PIN is disabled":"✓ PIN is active";}
      function renderHostSummary(s){const started=s.lastStartedAt?new Date(s.lastStartedAt).toLocaleTimeString():"—";sharingStateEl.textContent=s.sharingActive?"Active (started "+started+")":"Stopped";hostIpsEl.textContent=(s.lanAddresses||[]).length?s.lanAddresses.join("\\n"):"No IPv4 detected";state.sharingActive=Boolean(s.sharingActive);startSharingEl.hidden=state.sharingActive;stopSharingEl.hidden=!state.sharingActive;state.webdavUrls=Array.isArray(s.webdavUrls)?s.webdavUrls:[];webdavUrlsEl.textContent=state.webdavUrls.length?state.webdavUrls.join("\\n"):"No WebDAV URLs detected.";}
      async function loadQr(){try{const r=await fetch("/api/qr");if(!r.ok)return;const{dataUrl}=await r.json();qrImgEl.src=dataUrl;qrBoxEl.style.visibility="visible";}catch{}}
      async function loadStatus(){const r=await fetch(apiUrl("/api/status"));if(!r.ok)throw new Error("Status failed");const s=await r.json();renderWarning(s);renderHostSummary(s);if(s.roots&&s.roots[0])shareRootPathEl.value=s.roots[0].absPath;}
      async function loadTransferSettings(){
        try{
          const r=await fetch("/api/host/transfer");
          if(!r.ok)throw new Error("Transfer settings failed");
          const data=await r.json();
          uploadEnabledEl.checked=Boolean(data.uploadEnabled);
          createEnabledEl.checked=Boolean(data.createEnabled ?? data.modifyEnabled);
          deleteEnabledEl.checked=Boolean(data.deleteEnabled);
          webdavEnabledEl.checked=Boolean(data.webdavEnabled ?? true);
          uploadMaxSizeMbEl.value=String(data.uploadMaxSizeMb||51200);
          webdavStatusEl.textContent=webdavEnabledEl.checked?"WebDAV is enabled. Clients can connect using the URLs below.":"WebDAV is disabled by host.";
          webdavStatusEl.style.borderColor=webdavEnabledEl.checked?"var(--success)":"var(--line)";
          webdavStatusEl.style.color=webdavEnabledEl.checked?"var(--success)":"var(--muted)";
        }catch{
          transferStatusEl.textContent="Failed to load upload settings.";
          webdavStatusEl.textContent="Failed to load WebDAV settings.";
        }
      }
      async function sendHostControl(action){const r=await fetch(apiUrl("/api/host/"+action),{method:"POST"});if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));alert(e.error||"Failed");return;}await loadStatus();}
      async function applySharedDirectory(){const absPath=shareRootPathEl.value.trim();if(!absPath){alert("Enter a path");return;}const r=await fetch(apiUrl("/api/host/share-root"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({absPath})});if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));alert(e.error||"Failed");return;}await loadStatus();}
      async function pickSharedDirectory(){const r=await fetch(apiUrl("/api/host/pick-share-root"),{method:"POST"});if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));alert(e.error||"Failed");return;}const payload=await r.json();if(payload&&payload.absPath)shareRootPathEl.value=payload.absPath;await loadStatus();}
      async function saveTransferSettings(){
        const maxSizeMb=Number(uploadMaxSizeMbEl.value);
        if(!Number.isFinite(maxSizeMb)||maxSizeMb<1||maxSizeMb>51200){
          transferStatusEl.textContent="Max upload size must be between 1 and 51200 MB.";
          return;
        }
        const payload={uploadEnabled:Boolean(uploadEnabledEl.checked),createEnabled:Boolean(createEnabledEl.checked),deleteEnabled:Boolean(deleteEnabledEl.checked),webdavEnabled:Boolean(webdavEnabledEl.checked),uploadMaxSizeMb:Math.round(maxSizeMb)};
        const r=await fetch("/api/host/transfer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!r.ok){
          const e=await r.json().catch(()=>({error:"Failed"}));
          transferStatusEl.textContent=e.error||"Failed to save upload settings.";
          return;
        }
        const data=await r.json();
        uploadEnabledEl.checked=Boolean(data.uploadEnabled);
        createEnabledEl.checked=Boolean(data.createEnabled ?? data.modifyEnabled);
        deleteEnabledEl.checked=Boolean(data.deleteEnabled);
        webdavEnabledEl.checked=Boolean(data.webdavEnabled ?? true);
        uploadMaxSizeMbEl.value=String(data.uploadMaxSizeMb||51200);
        transferStatusEl.textContent="Upload settings saved.";
        webdavStatusEl.textContent=webdavEnabledEl.checked?"WebDAV is enabled. Clients can connect using the URLs below.":"WebDAV is disabled by host.";
        webdavStatusEl.style.borderColor=webdavEnabledEl.checked?"var(--success)":"var(--line)";
        webdavStatusEl.style.color=webdavEnabledEl.checked?"var(--success)":"var(--muted)";
      }
      async function saveWebdavSettings(){
        const r=await fetch("/api/host/transfer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({webdavEnabled:Boolean(webdavEnabledEl.checked)})});
        if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));webdavStatusEl.textContent=e.error||"Failed to save WebDAV setting.";webdavStatusEl.style.borderColor="var(--danger)";webdavStatusEl.style.color="var(--danger)";return;}
        const data=await r.json();
        webdavEnabledEl.checked=Boolean(data.webdavEnabled ?? true);
        webdavStatusEl.textContent=webdavEnabledEl.checked?"WebDAV is enabled. Clients can connect using the URLs below.":"WebDAV is disabled by host.";
        webdavStatusEl.style.borderColor=webdavEnabledEl.checked?"var(--success)":"var(--line)";
        webdavStatusEl.style.color=webdavEnabledEl.checked?"var(--success)":"var(--muted)";
      }
      async function loadDomainName(){try{const r=await fetch("/api/host/domain-name");if(!r.ok)return;const data=await r.json();domainNameEl.value=data.domainName||"";domainStatusEl.textContent=data.domainName?"Domain: "+data.domainName:"Suggested: "+data.suggested;}catch{}}
      async function loadPinSettings(){
        try{
          const r=await fetch("/api/host/access");
          if(!r.ok)throw new Error("Failed");
          const data=await r.json();
          if(data.requiresPin){
            const src=data.pinSource==="env"?" (set via SESSION_PIN env var, cannot be cleared here)":data.pinSource==="runtime"?" (set via admin UI)":"";
            pinStatusBoxEl.textContent="PIN is active"+src;
            pinStatusBoxEl.style.borderColor="var(--success)";
            pinStatusBoxEl.style.color="var(--success)";
          }else{
            pinStatusBoxEl.textContent="PIN is disabled — files are open to all LAN devices";
            pinStatusBoxEl.style.borderColor="var(--line)";
            pinStatusBoxEl.style.color="var(--muted)";
          }
          clearPinBtnEl.hidden=!data.requiresPin||data.pinSource==="env";
        }catch{
          pinStatusBoxEl.textContent="Failed to load PIN settings.";
        }
      }
      async function savePinSettings(){
        const pin=pinValueEl.value.trim();
        if(!/^\\d{4,16}$/.test(pin)){pinSaveStatusEl.textContent="PIN must be 4\u201316 digits.";return;}
        const r=await fetch("/api/host/access/pin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin})});
        if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));pinSaveStatusEl.textContent=e.error||"Failed to set PIN.";return;}
        pinValueEl.value="";
        pinSaveStatusEl.textContent="PIN set. Clients will now be prompted for it.";
        await loadPinSettings();
        await loadStatus();
      }
      async function clearPinSettings(){
        if(!confirm("Disable PIN? Clients will no longer need a PIN to access files."))return;
        const r=await fetch("/api/host/access/pin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:""})});
        if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));pinSaveStatusEl.textContent=e.error||"Failed to clear PIN.";return;}
        pinSaveStatusEl.textContent="PIN disabled. Files are now open on the LAN.";
        await loadPinSettings();
        await loadStatus();
      }
      function renderDiscoveryHealth(data){
        healthDomainEl.textContent=data.domainName||"No custom domain configured";
        const urls=Array.isArray(data.recommendedClientUrls)?data.recommendedClientUrls:[];
        healthUrlsEl.innerHTML="";
        if(urls.length){
          urls.forEach((url)=>{
            const row=document.createElement("div");
            row.className="health-link-row";
            const link=document.createElement("a");
            link.className="health-link";
            link.href=url;
            link.target="_blank";
            link.rel="noreferrer";
            link.textContent=url;
            const copyBtn=document.createElement("button");
            copyBtn.className="secondary health-copy";
            copyBtn.type="button";
            copyBtn.textContent="Copy";
            copyBtn.addEventListener("click",async()=>{
              try{await navigator.clipboard.writeText(url);copyBtn.textContent="Copied";setTimeout(()=>{copyBtn.textContent="Copy";},1200);}catch{copyBtn.textContent="Failed";setTimeout(()=>{copyBtn.textContent="Copy";},1200);}
            });
            row.appendChild(link);
            row.appendChild(copyBtn);
            healthUrlsEl.appendChild(row);
          });
        }else{
          healthUrlsEl.textContent="No reachable LAN URLs detected.";
        }
        const warnings=Array.isArray(data.warnings)?data.warnings:[];
        healthWarningsEl.innerHTML="";
        if(!warnings.length){
          const li=document.createElement("li");li.textContent="No obvious blockers detected from host-side checks.";healthWarningsEl.appendChild(li);return;
        }
        warnings.forEach((w)=>{const li=document.createElement("li");li.textContent=w;healthWarningsEl.appendChild(li);});
      }
      async function loadDiscoveryHealth(){
        try{const r=await fetch("/api/discovery-health");if(!r.ok)throw new Error("health failed");const data=await r.json();renderDiscoveryHealth(data);}catch{healthDomainEl.textContent="Failed to load configured domain.";healthUrlsEl.textContent="Failed to load discovery diagnostics.";healthWarningsEl.innerHTML="<li>Check server logs and refresh.</li>";}
      }
      async function saveDomainName(){const domainName=domainNameEl.value.trim();const r=await fetch("/api/host/domain-name",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domainName:domainName||undefined})});if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));alert(e.error||"Failed");return;}const data=await r.json();domainNameEl.value=data.domainName||"";domainStatusEl.textContent=data.domainName?"✓ Domain updated: "+data.domainName:"Suggested: "+data.suggested;await loadDiscoveryHealth();}
      startSharingEl.addEventListener("click",()=>sendHostControl("start"));
      stopSharingEl.addEventListener("click",()=>sendHostControl("stop"));
      pickShareRootEl.addEventListener("click",pickSharedDirectory);
      shareRootPathEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")applySharedDirectory();});
      saveDomainEl.addEventListener("click",saveDomainName);
      domainNameEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")saveDomainName();});
      saveTransferEl.addEventListener("click",saveTransferSettings);
      saveWebdavEl.addEventListener("click",saveWebdavSettings);
      uploadMaxSizeMbEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")saveTransferSettings();});
      savePinBtnEl.addEventListener("click",savePinSettings);
      pinValueEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")savePinSettings();});
      clearPinBtnEl.addEventListener("click",clearPinSettings);
      refreshStatusEl.addEventListener("click",async()=>{await loadStatus();await loadTransferSettings();await loadPinSettings();await loadDiscoveryHealth();});
      openClientUIEl.addEventListener("click",()=>window.location.href="/");
      (async()=>{await loadStatus();await loadTransferSettings();await loadPinSettings();loadQr();await loadDomainName();await loadDiscoveryHealth();})();
    </script>
  </body>
</html>`;
}
