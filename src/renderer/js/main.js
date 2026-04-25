const state={root:"",path:"",pin:"",roots:[],sharingActive:true,canControlHost:false,requiresPin:false,lanUrls:[],downloadMode:localStorage.getItem("lan_download_mode")==="managed"?"managed":"browser",downloads:new Map(),uploads:new Map(),uploadMaxSizeMb:51200,uploadEnabled:false,createEnabled:false,deleteEnabled:false,readEnabled:true,sortBy:"name",sortDir:"asc"};
      const listEl=document.getElementById("list"),listHeaderEl=document.getElementById("listHeader"),
            rootEl=document.getElementById("root"),breadcrumbEl=document.getElementById("breadcrumb"),
            pinInputEl=document.getElementById("pinInput"),pinInputContainerEl=document.getElementById("pinInputContainer"),
            refreshEl=document.getElementById("refresh"),
            downloadModeToggleEl=document.getElementById("downloadModeToggle"),downloadItemsEl=document.getElementById("downloadItems"),
            fileInputEl=document.getElementById("fileInput"),uploadBtnEl=document.getElementById("uploadBtn"),dirInputEl=document.getElementById("dirInput"),uploadDirBtnEl=document.getElementById("uploadDirBtn"),

            uploadItemsEl=document.getElementById("uploadItems"),uploadPanelEl=document.getElementById("uploadPanel"),
            rootLabelEl=document.getElementById("rootLabel"),
            dirActionsEl=document.getElementById("dirActions"),newDirNameEl=document.getElementById("newDirName"),createDirBtnEl=document.getElementById("createDirBtn"),
            pinOverlayEl=document.getElementById("pinOverlay"),pinOverlayInputEl=document.getElementById("pinOverlayInput"),
            pinOverlayErrorEl=document.getElementById("pinOverlayError"),pinOverlaySubmitEl=document.getElementById("pinOverlaySubmit");
      function formatBytes(b){
        if(!b)return{val:"0",unit:"B",full:"0 B"};
        const u=["B","KB","MB","GB","TB"],i=Math.min(Math.floor(Math.log2(b)/10),u.length-1);
        const v=b/Math.pow(1024,i);
        const val=i===0?v.toString():v.toFixed(2);
        return {val,unit:u[i],full:val+" "+u[i]};
      }
      function apiUrl(ep,p={}){const u=new URL(ep,window.location.origin);for(const[k,v]of Object.entries(p))if(v!=null&&v!=="")u.searchParams.set(k,String(v));return u;}
      function asFiniteNumber(value,fallback){
        const n=Number(value);
        return Number.isFinite(n)?n:fallback;
      }
      const PIN_KEY="lan_file_host_pin",storedPin=()=>sessionStorage.getItem(PIN_KEY)||"",
            savePin=(p)=>p?sessionStorage.setItem(PIN_KEY,p):sessionStorage.removeItem(PIN_KEY),
            clearPin=()=>{sessionStorage.removeItem(PIN_KEY);state.pin="";pinInputEl.value="";};
      function formatSpeed(v){if(!v||v<=0)return"\u2014";return formatBytes(v).full+"/s";}
      const UPLOAD_CHUNK_SIZE=2*1024*1024;
      const DOWNLOAD_CHUNK_SIZE=1024*1024;
      const DOWNLOAD_PARALLELISM=4;
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
      function normalizeRelPath(p){
        let v=String(p||"").split("\\\\").join("/");
        while(v.includes("//"))v=v.split("//").join("/");
        while(v.startsWith("/"))v=v.slice(1);
        if(v.endsWith("/"))v=v.slice(0,-1);
        return v.split("/").map((seg)=>seg.trim()).filter(Boolean).join("/");
      }
      function joinRelPath(base,part){
        const left=normalizeRelPath(base),right=normalizeRelPath(part);
        if(!left)return right;
        if(!right)return left;
        return left+"/"+right;
      }
      function stopDownloadControllers(d){
        if(d.controllers){d.controllers.forEach(c=>c.abort());d.controllers.clear();}
        if(d.controller){d.controller.abort();d.controller=null;}
      }
      function removeManagedDownload(relPath){
        const d=state.downloads.get(relPath);
        if(d)stopDownloadControllers(d);
        state.downloads.delete(relPath);
        renderDownloadPanel();
      }
      function pauseManagedDownload(relPath){
        const d=state.downloads.get(relPath);if(!d||d.status!=="downloading")return;
        d.status="paused";
        stopDownloadControllers(d);
        upsertDownload(d);
      }
      function cancelManagedDownload(relPath){
        const d=state.downloads.get(relPath);if(!d)return;
        d.status="canceled";
        d.error="";
        d.speed=0;
        d.received=0;
        d.total=0;
        d.chunks=[];
        d.chunkMap=new Map();
        d.pendingChunkIndexes=[];
        d.nextChunkIndex=0;
        stopDownloadControllers(d);
        upsertDownload(d);
      }
      function buildDownloadActions(d){
        const isDir = d.kind === "directory";
        const path = d.relPath;
        
        if (d.status === "downloading") {
          return isDir
            ? `<button class="danger" data-action="cancel" data-path="${path}">Cancel</button>`
            : `<button class="secondary" data-action="pause" data-path="${path}">Pause</button><button class="danger" data-action="cancel" data-path="${path}">Cancel</button>`;
        }
        
        if (d.status === "paused") {
          return isDir
            ? `<button data-action="start" data-path="${path}">Restart</button><button class="danger" data-action="cancel" data-path="${path}">Cancel</button>`
            : `<button data-action="start" data-path="${path}">Resume</button><button class="danger" data-action="cancel" data-path="${path}">Cancel</button>`;
        }
        
        if (d.status === "error") {
          return `<button data-action="start" data-path="${path}">Retry</button><button class="danger" data-action="cancel" data-path="${path}">Cancel</button>`;
        }
        
        if (d.status === "canceled") {
          return `<button data-action="start" data-path="${path}">Restart</button><button class="secondary" data-action="remove" data-path="${path}">Remove</button>`;
        }
        
        if (d.status === "completed") {
          return `<button class="secondary" data-action="remove" data-path="${path}">Remove</button>`;
        }
        
        if (d.status === "queued") {
          return `<button class="danger" data-action="cancel" data-path="${path}">Cancel</button>`;
        }
        
        return "";
      }
      function renderDownloadPanel(){
        const items=Array.from(state.downloads.values());
        if(!items.length){
          downloadItemsEl.className="download-empty";
          downloadItemsEl.textContent="No downloads yet.";
          return;
        }
        downloadItemsEl.className="";
        // Clear stale "No downloads yet." text node when transitioning from empty state
        if(downloadItemsEl.childNodes.length===1&&downloadItemsEl.firstChild.nodeType===3){
          downloadItemsEl.textContent="";
        }
        const keys=new Set(items.map((d)=>d.relPath));
        Array.from(downloadItemsEl.querySelectorAll("div[data-key]")).forEach((el)=>{
          if(!keys.has(el.dataset.key))el.remove();
        });
        items.forEach((d)=>{
          const pct=d.total>0?Math.min(100,Math.round((d.received/d.total)*100)):0;
          const doneText=d.total>0?formatBytes(d.received).full+" / "+formatBytes(d.total).full:formatBytes(d.received).full+" / unknown";
          const statusText=d.status==="error"&&d.error?d.status+": "+d.error:d.status;
          const barWidth=(d.status==="completed"?100:pct)+"%";
          let row=downloadItemsEl.querySelector('div[data-key="'+CSS.escape(d.relPath)+'"]');
          if(!row){
            // First time — create the full row structure
            row=document.createElement("div");row.className="download-item";row.dataset.key=d.relPath;
            row.innerHTML='<div class="download-top"><span class="download-name"></span><span class="download-status"></span></div>'+
              '<div class="progress-bar-wrap"><div class="progress-bar"></div></div>'+
              '<div class="download-meta"><span class="dl-done"></span><span class="dl-speed"></span></div>'+
              '<div class="download-actions"></div>';
            row.querySelector(".download-name").textContent=d.filename;
            downloadItemsEl.appendChild(row);
          }
          // Patch only the dynamic parts
          const statusEl=row.querySelector(".download-status");
          if(statusEl.textContent!==statusText)statusEl.textContent=statusText;
          const bar=row.querySelector(".progress-bar");
          if(bar.style.width!==barWidth)bar.style.width=barWidth;
          const doneEl=row.querySelector(".dl-done");
          if(doneEl.textContent!==doneText)doneEl.textContent=doneText;
          const speedEl=row.querySelector(".dl-speed");
          const speedText=formatSpeed(d.speed);
          if(speedEl.textContent!==speedText)speedEl.textContent=speedText;
          // Only rebuild actions HTML when status transitions (avoids button thrash)
          const actionsEl=row.querySelector(".download-actions");
          const newActions=buildDownloadActions(d);
          if(actionsEl.dataset.lastStatus!==d.status){
            actionsEl.innerHTML=newActions;
            actionsEl.dataset.lastStatus=d.status;
          }
        });
      }
      function showPinGate(){
        pinOverlayEl.classList.remove("hidden");
        // Small delay to allow the removal of 'hidden' to register before starting the transition
        setTimeout(()=>{
          pinOverlayEl.classList.remove("opacity-0");
          pinOverlayEl.classList.add("opacity-100");
          const inner=pinOverlayEl.querySelector(".glass-card");
          if(inner){
            inner.classList.remove("scale-95");
            inner.classList.add("scale-100");
          }
        },10);
        pinOverlayInputEl.value="";
        pinOverlayErrorEl.textContent="";
        pinOverlayInputEl.focus();
      }
      function hidePinGate(){
        pinOverlayEl.classList.remove("opacity-100");
        pinOverlayEl.classList.add("opacity-0");
        const inner=pinOverlayEl.querySelector(".glass-card");
        if(inner){
          inner.classList.remove("scale-100");
          inner.classList.add("scale-95");
        }
        setTimeout(()=>{
          pinOverlayEl.classList.add("hidden");
        },300);
      }
      async function submitPinOverlay(){
        const c=pinOverlayInputEl.value.trim();if(!c)return;
        const r=await fetch(apiUrl("/api/list",{root:state.root||"0",path:"",pin:c}));
        if(r.status===401){pinOverlayErrorEl.textContent="Incorrect PIN. Try again.";pinOverlayInputEl.select();return;}
        state.pin=c;pinInputEl.value=c;savePin(c);hidePinGate();await loadDirectory();
      }
      pinOverlaySubmitEl.addEventListener("click",submitPinOverlay);
      pinOverlayInputEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")submitPinOverlay();});
      function renderHostSummary(s){
        state.sharingActive=Boolean(s.sharingActive);state.canControlHost=Boolean(s.canControlHost);
        state.requiresPin=Boolean(s.requiresPin);state.lanUrls=Array.isArray(s.lanUrls)?s.lanUrls:[];
        pinInputContainerEl.classList.toggle('hidden', !state.requiresPin);
      }
      async function loadStatus(){
        const r=await fetch(apiUrl("/api/status"));if(!r.ok)throw new Error("Status error");
        const s=await r.json();state.roots=s.roots;
         state.uploadMaxSizeMb=s.uploadMaxSizeMb||51200;state.uploadEnabled=Boolean(s.uploadEnabled);
         state.readEnabled=Boolean(s.readEnabled ?? true);
         state.createEnabled=Boolean(s.createEnabled ?? s.modifyEnabled);
         state.deleteEnabled=Boolean(s.deleteEnabled);
        uploadPanelEl.classList.toggle('hidden', !state.uploadEnabled);
        fileInputEl.disabled=!state.uploadEnabled;
        dirInputEl.disabled=!state.uploadEnabled;
        uploadBtnEl.disabled=!state.uploadEnabled;
        uploadDirBtnEl.disabled=!state.uploadEnabled;
        dirActionsEl.classList.toggle('hidden', !state.createEnabled);
        const hasCurrentRoot=s.roots.some((root)=>root.id===state.root);
        state.root=hasCurrentRoot?state.root:((s.roots[0]&&s.roots[0].id)||"");
        renderHostSummary(s);rootEl.innerHTML="";
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
        const btn=wrap&&wrap.querySelector(".dl-btn");
        if(btn)btn.textContent=text;
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
        upsertDownload({relPath,filename:relPath.split("/").pop()||relPath,received:0,total:0,status:"delegated-to-browser",error:"",speed:0,chunks:[],kind:"file"});
      }
      function triggerBrowserManagedDownloadDirectory(relPath){
        const url=apiUrl("/api/download-directory",{root:state.root,path:relPath,pin:state.pin});
        const a=document.createElement("a");
        a.href=url.toString();
        a.click();
        const dirName=relPath.split("/").pop()||relPath||"archive";
        upsertDownload({relPath,filename:dirName+".zip",received:0,total:0,status:"delegated-to-browser",error:"",speed:0,chunks:[],kind:"directory"});
      }
      function parseFilename(resp,relPath){
        const disp=resp.headers.get("Content-Disposition")||"";
        const nm=disp.match(/filename="([^"]+)"/);
        return nm?decodeURIComponent(nm[1]):relPath.split("/").pop()||"download";
      }
      function parseTotalSize(resp,receivedFallback){
        const cr=resp.headers.get("Content-Range")||"";
        const m=cr.match(/\/(\d+)$/);
        if(m)return Number(m[1])||0;
        const cl=Number(resp.headers.get("Content-Length")||0);
        return cl>0?cl+receivedFallback:0;
      }
      async function ensureDownloadMetadata(download){
        const metaUrl=apiUrl("/api/download",{root:state.root,path:download.relPath,pin:state.pin});
        const metaResp=await fetch(metaUrl,{headers:{Range:"bytes=0-0"}});
        if(metaResp.status===401){clearPin();showPinGate();throw new Error("PIN required");}
        if(!(metaResp.ok||metaResp.status===206))throw new Error(metaResp.status+" "+metaResp.statusText);
        if(download.total===0)download.total=parseTotalSize(metaResp,0);
        if(!download.filename)download.filename=parseFilename(metaResp,download.relPath);
      }
      function buildPendingChunkIndexes(download){
        if(!download.total||download.total<1)return[];
        const totalChunks=Math.ceil(download.total/DOWNLOAD_CHUNK_SIZE);
        const pending=[];
        for(let i=0;i<totalChunks;i++)if(!download.chunkMap.has(i))pending.push(i);
        return pending;
      }
      async function downloadChunk(download,chunkIndex,startTs){
        const start=chunkIndex*DOWNLOAD_CHUNK_SIZE;
        const end=Math.min(download.total-1,start+DOWNLOAD_CHUNK_SIZE-1);
        const controller=new AbortController();
        download.controllers.add(controller);
        try{
          const url=apiUrl("/api/download",{root:state.root,path:download.relPath,pin:state.pin});
          const resp=await fetch(url,{headers:{Range:"bytes="+start+"-"+end},signal:controller.signal});
          if(resp.status===401){clearPin();showPinGate();throw new Error("PIN required");}
          if(!(resp.ok||resp.status===206))throw new Error(resp.status+" "+resp.statusText);
          // Stream chunk byte-by-byte for smooth progress updates
          const reader=resp.body.getReader();
          const parts=[];
          let chunkReceived=0;
          try{
            while(true){
              const{done,value}=await reader.read();
              if(done)break;
              parts.push(value);
              chunkReceived+=value.length;
              download.received+=value.length;
              const elapsed=Math.max(1,(Date.now()-startTs)/1000);
              download.speed=Math.round(download.received/elapsed);
              const pct=download.total>0?Math.min(100,Math.round((download.received/download.total)*100)):0;
              markButtonProgress(download.relPath,"\u2193 "+(download.total>0?pct+"%":"\u2026"),pct);
              upsertDownload(download);
            }
          }finally{reader.cancel();}
          // Assemble chunk from streamed parts
          const arr=new Uint8Array(chunkReceived);
          let offset=0;
          for(const p of parts){arr.set(p,offset);offset+=p.length;}
          download.chunkMap.set(chunkIndex,arr);
        }finally{download.controllers.delete(controller);}
      }
      async function streamManagedDownload(download){
        setButtonBusy(download.relPath,true);
        const t0=Date.now();
        try{
          download.status="downloading";download.error="";
          if(!download.chunkMap)download.chunkMap=new Map();
          if(!download.controllers)download.controllers=new Set();
          upsertDownload(download);
          await ensureDownloadMetadata(download);
          download.pendingChunkIndexes=buildPendingChunkIndexes(download);
          const worker=async()=>{
            while(download.status==="downloading"&&download.pendingChunkIndexes.length){
              const nextIndex=download.pendingChunkIndexes.shift();
              if(nextIndex==null)break;
              await downloadChunk(download,nextIndex,t0);
            }
          };
          await Promise.all(Array.from({length:Math.min(DOWNLOAD_PARALLELISM,Math.max(1,download.pendingChunkIndexes.length))},worker));
          if(download.status==="downloading"&&download.chunkMap.size===Math.ceil(download.total/DOWNLOAD_CHUNK_SIZE)){
            const ordered=[];
            for(let i=0;i<Math.ceil(download.total/DOWNLOAD_CHUNK_SIZE);i++)ordered.push(download.chunkMap.get(i)||new Uint8Array(0));
            const blob=new Blob(ordered,{type:"application/octet-stream"});
            const obj=URL.createObjectURL(blob);
            const a=document.createElement("a");
            a.href=obj;a.download=download.filename||"download";a.click();
            URL.revokeObjectURL(obj);
            download.status="completed";
            download.speed=0;
            upsertDownload(download);
            markButtonProgress(download.relPath,"\u2193 Download",0);
          }
        }catch(err){
          if(download.status!=="paused"&&download.status!=="canceled"){
            download.status=err&&err.name==="AbortError"?"paused":"error";
            download.error=err&&err.message?err.message:"Connection lost";
          }
          upsertDownload(download);
        }finally{
          stopDownloadControllers(download);
          setButtonBusy(download.relPath,false);
          if(download.status!=="downloading")markButtonProgress(download.relPath,"\u2193 Download",0);
        }
      }
      async function startManagedDownload(relPath){
        const existing=state.downloads.get(relPath);
        const download=existing&&existing.status!=="completed"?existing:{relPath,filename:relPath.split("/").pop()||relPath,received:0,total:0,status:"queued",error:"",speed:0,chunks:[],chunkMap:new Map(),pendingChunkIndexes:[],controllers:new Set(),kind:"file"};
        if(download.status==="canceled"){download.received=0;download.total=0;download.chunkMap=new Map();download.pendingChunkIndexes=[];download.chunks=[];}
        upsertDownload(download);
        await streamManagedDownload(download);
      }
      async function startManagedDownloadDirectory(relPath){
        const dirName=relPath.split("/").pop()||relPath||"archive";
        const download={relPath,filename:dirName+".zip",received:0,total:0,status:"queued",error:"",speed:0,chunks:[],kind:"directory"};
        upsertDownload(download);
        await streamManagedDownloadDirectory(download);
      }
      async function streamManagedDownloadDirectory(download){
        setButtonBusy(download.relPath,true);
        const t0=Date.now();
        let reader=null;
        try{
          download.status="downloading";download.error="";upsertDownload(download);
          const url=apiUrl("/api/download-directory",{root:state.root,path:download.relPath,pin:state.pin});
          const controller=new AbortController();
          download.controller=controller;
          const resp=await fetch(url,{signal:controller.signal});
          if(resp.status===401){clearPin();showPinGate();download.status="error";download.error="PIN required";upsertDownload(download);return;}
          if(!resp.ok){download.status="error";download.error=resp.status+" "+resp.statusText;upsertDownload(download);return;}
          download.total=Number(resp.headers.get("Content-Length")||resp.headers.get("X-Directory-Total-Size")||0);
          reader=resp.body.getReader();
          while(true){
            if(download.status!=="downloading"){
            reader.cancel();break;
            }
            const {done,value}=await reader.read();
            if(done||download.status!=="downloading")break;
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
          }else if(download.status==="downloading"){
            download.status="canceled";
            upsertDownload(download);
          }
        }catch(err){
          if(download.status!=="canceled"){
            download.status=err&&err.name==="AbortError"?"canceled":"error";
            download.error=err&&err.name!=="AbortError"&&err.message?err.message:"";
          }
          upsertDownload(download);
        }finally{
          if(reader){try{reader.cancel();}catch{}}
          download.controller=null;
          download.chunks=[];
          download.speed=0;
          setButtonBusy(download.relPath,false);
          if(download.status!=="downloading")markButtonProgress(download.relPath,"\u2193 ZIP",0);
        }
      }
      async function resumeManagedDownload(relPath){
        const d=state.downloads.get(relPath);
        if(!d)return;
        if(d.kind==="directory"){
          d.received=0;d.total=0;d.chunks=[];d.error="";
          await streamManagedDownloadDirectory(d);
          return;
        }
        if(d.status==="canceled"||d.status==="completed"){
          d.received=0;d.total=0;d.chunkMap=new Map();d.pendingChunkIndexes=[];d.chunks=[];
        }
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
       async function handleFileSelect(e){
         const files=Array.from(e.target.files||[]);
         if(!files.length)return;
         const over=files.find((f)=>(f.size/(1024*1024))>state.uploadMaxSizeMb);
         if(over){alert('"'+over.name+'" exceeds '+state.uploadMaxSizeMb+' MB limit');fileInputEl.value="";return;}
         await uploadFiles(files);
       }
       function handleDirectorySelect(e){
         const files=Array.from(e.target.files||[]);
         if(!files.length)return;
         const over=files.find((f)=>(f.size/(1024*1024))>state.uploadMaxSizeMb);
         if(over){alert('"'+over.name+'" exceeds '+state.uploadMaxSizeMb+' MB limit');dirInputEl.value="";return;}
         uploadDirectory();
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
               try{const c=JSON.parse(xhr.responseText);upload.received=asFiniteNumber(c.expectedOffset,chunkStart);}catch{}
               resolve({conflict:true});return;
             }
             if(xhr.status===200||xhr.status===201){
               try{const d=JSON.parse(xhr.responseText);upload.received=asFiniteNumber(d.receivedBytes,chunkEnd);}catch{upload.received=chunkEnd;}
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
      function getActiveUpload(){
        return Array.from(state.uploads.values()).find((u)=>u.status==="uploading")||null;
      }
      function processUploadQueue(){
        if(getActiveUpload())return;
        const next=Array.from(state.uploads.values()).find((u)=>u.status==="queued");
        if(next)startUpload(next.id,{fromQueue:true});
      }
       function removeUpload(id){
        const u=state.uploads.get(id);
        if(u&&u.chunkXhr)u.chunkXhr.abort();
        state.uploads.delete(id);
        renderUploadPanel();
      }
      async function startUpload(id,opts={}){
         const {fromQueue=false}=opts;
         const upload=state.uploads.get(id);
         if(!upload||!upload.file||upload.status==="uploading")return;
         const active=getActiveUpload();
         if(active&&active.id!==id){
           if(!fromQueue)alert("Another upload is in progress. Pause or cancel it before starting another file.");
           return;
         }
         if(!state.uploadEnabled){upload.status="error";upload.error="Uploads are disabled by host";renderUploadPanel();return;}
         upload.status="uploading";
         upload.error=null;
         upload.abortReason="";
         renderUploadPanel();
         try{
           if(!upload.uploadId){
             if(upload.targetPath&&upload.targetPath!==state.path)await ensureDirectoryChain(upload.targetPath);
             const initResp=await fetch(apiUrl("/api/upload/resumable/init",{pin:currentPin()}),{
               method:"POST",
               headers:{"Content-Type":"application/json"},
               body:JSON.stringify({filename:upload.filename,size:upload.size,root:state.root,path:upload.targetPath||state.path})
             });
             if(!initResp.ok){const e=await initResp.json().catch(()=>({error:"Failed to initialize upload"}));throw new Error(e.error||"Failed to initialize upload");}
             const initData=await initResp.json();
             upload.uploadId=initData.uploadId;
             upload.received=asFiniteNumber(initData.receivedBytes,0);
           }else{
             const statusResp=await fetch(apiUrl("/api/upload/resumable/status",{uploadId:upload.uploadId,pin:currentPin()}));
             if(statusResp.ok){const s=await statusResp.json();upload.received=asFiniteNumber(s.receivedBytes,upload.received);}
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
           if(upload.status!=="paused"&&upload.status!=="uploading")processUploadQueue();
         }
       }
      function enqueueUploadFile(file,targetPath){
        const id=Math.random().toString(36).slice(2);
        const upload={id,filename:file.name,size:file.size,received:0,status:"queued",error:null,speed:0,startTime:Date.now(),file,chunkXhr:null,uploadId:null,abortReason:"",targetPath};
        state.uploads.set(id,upload);
        return id;
      }
      async function uploadFiles(files){
        if(!files.length)return;
        if(!state.uploadEnabled){alert("Uploads are disabled by host");fileInputEl.value="";return;}
        for(const file of files){
          const sizeMb=file.size/(1024*1024);
          if(sizeMb>state.uploadMaxSizeMb){
           alert('"'+file.name+'" exceeds '+state.uploadMaxSizeMb+' MB limit');
           continue;
          }
          enqueueUploadFile(file,state.path);
        }
        fileInputEl.value="";
        renderUploadPanel();
        processUploadQueue();
      }
      async function uploadFile(){
        const file=fileInputEl.files?.[0];
         if(!file)return;
        await uploadFiles([file]);
       }
       async function ensureDirectoryChain(targetRelPath){
         const clean=normalizeRelPath(targetRelPath);
         if(!clean)return;
         const parts=clean.split("/");
         let current="";
         for(const segment of parts){
           const parent=current;
           current=current?current+"/"+segment:segment;
           const resp=await fetch(apiUrl("/api/fs/mkdir",{pin:currentPin()}),{
             method:"POST",
             headers:{"Content-Type":"application/json"},
             body:JSON.stringify({root:state.root,path:parent,name:segment}),
           });
           if(!resp.ok){
             const data=await resp.json().catch(()=>({error:"Failed to create directory chain"}));
             const msg=String(data.error||"");
             if(!/already exists/i.test(msg)){throw new Error(msg||"Failed to create directory chain");}
           }
         }
       }
       async function uploadDirectory(){
         const files=Array.from(dirInputEl.files||[]);
         if(!files.length)return;
         if(!state.uploadEnabled){alert("Uploads are disabled by host");return;}
         const rootPrefix=normalizeRelPath(state.path);
         for(const file of files){
           const relFromDir=normalizeRelPath(file.webkitRelativePath||file.name);
           const slashIdx=relFromDir.lastIndexOf("/");
           const dirPart=slashIdx===-1?"":relFromDir.slice(0,slashIdx);
           const targetPath=joinRelPath(rootPrefix,dirPart);
           enqueueUploadFile(file,targetPath);
         }
         dirInputEl.value="";
         renderUploadPanel();
         processUploadQueue();
       }
       function renderUploadPanel(){
         const items=Array.from(state.uploads.values());
         if(!items.length){
           uploadItemsEl.className="download-empty";
           uploadItemsEl.textContent="No uploads yet.";
           return;
         }
         uploadItemsEl.className="";
         // Remove stale rows
         const keys=new Set(items.map((u)=>u.id));
         Array.from(uploadItemsEl.querySelectorAll("div[data-key]")).forEach((el)=>{
           if(!keys.has(el.dataset.key))el.remove();
         });
         items.forEach((u)=>{
           const pct=u.size>0?Math.min(100,Math.round((u.received/u.size)*100)):0;
           const doneText=u.size>0?formatBytes(u.received).full+" / "+formatBytes(u.size).full:formatBytes(u.received).full+" / unknown";
           const statusText=u.status==="error"&&u.error?u.status+": "+u.error:u.status;
           const barWidth=(u.status==="completed"?100:pct)+"%";
           let row=uploadItemsEl.querySelector('div[data-key="'+CSS.escape(u.id)+'"]');
           if(!row){
             row=document.createElement("div");row.className="download-item";row.dataset.key=u.id;
             row.innerHTML='<div class="download-top"><span class="download-name"></span><span class="download-status"></span></div>'+
               '<div class="progress-bar-wrap"><div class="progress-bar"></div></div>'+
               '<div class="download-meta"><span class="ul-done"></span><span class="ul-speed"></span></div>'+
               '<div class="download-actions"></div>';
             row.querySelector(".download-name").textContent=u.filename;
             uploadItemsEl.appendChild(row);
           }
           const statusEl=row.querySelector(".download-status");
           if(statusEl.textContent!==statusText)statusEl.textContent=statusText;
           const bar=row.querySelector(".progress-bar");
           if(bar.style.width!==barWidth)bar.style.width=barWidth;
           const doneEl=row.querySelector(".ul-done");
           if(doneEl.textContent!==doneText)doneEl.textContent=doneText;
           const speedEl=row.querySelector(".ul-speed");
           const speedText=formatSpeed(u.speed);
           if(speedEl.textContent!==speedText)speedEl.textContent=speedText;
           const actionsEl=row.querySelector(".download-actions");
           if(actionsEl.dataset.lastStatus!==u.status){
             actionsEl.dataset.lastStatus=u.status;
             if(u.status==="uploading"){
               actionsEl.innerHTML='<button class="secondary" data-action="pause" data-id="'+u.id+'">Pause</button><button class="danger" data-action="cancel" data-id="'+u.id+'">Cancel</button>';
             }else if(u.status==="paused"){
               actionsEl.innerHTML='<button data-action="start" data-id="'+u.id+'">Resume</button><button class="danger" data-action="cancel" data-id="'+u.id+'">Cancel</button>';
             }else if(u.status==="error"){
               actionsEl.innerHTML='<button data-action="start" data-id="'+u.id+'">Retry</button><button class="danger" data-action="cancel" data-id="'+u.id+'">Cancel</button>';
             }else if(u.status==="canceled"){
               actionsEl.innerHTML='<button data-action="start" data-id="'+u.id+'">Restart</button><button class="secondary" data-action="remove" data-id="'+u.id+'">Remove</button>';
             }else if(u.status==="completed"){
               actionsEl.innerHTML='<button class="secondary" data-action="remove" data-id="'+u.id+'">Remove</button>';
             }else if(u.status==="queued"){
               actionsEl.innerHTML='<button class="danger" data-action="cancel" data-id="'+u.id+'">Cancel</button>';
             }else{
               actionsEl.innerHTML='';
             }
           }
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
        listHeaderEl.innerHTML="";
        const arrow=(k)=>state.sortBy===k?(state.sortDir==="asc"?"↑":"↓"):"";
        listHeaderEl.innerHTML=
          '<th class="list-header-cell"><button class="sort-btn" data-sort="name">Name '+arrow("name")+'</button></th>'+
          '<th class="list-header-cell text-right"><button class="sort-btn justify-end" data-sort="size">Size '+arrow("size")+'</button></th>'+
          '<th class="list-header-cell text-right"><button class="sort-btn justify-end" data-sort="date">Modified '+arrow("date")+'</button></th>'+
          '<th class="list-header-cell text-right">Actions</th>';
        listHeaderEl.querySelectorAll("button[data-sort]").forEach((btn)=>{
          btn.addEventListener("click",()=>toggleSort(btn.getAttribute("data-sort")));
        });
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
        if(!state.sharingActive){listEl.innerHTML='<tr><td colspan="4" class="py-10 text-center text-slate-500">Sharing is stopped. Start sharing to browse.</td></tr>';breadcrumbEl.innerHTML="";return;}
        if(!state.readEnabled){listEl.innerHTML='<tr><td colspan="4" class="py-10 text-center text-slate-500">Read operations are disabled by host.</td></tr>';breadcrumbEl.innerHTML="";return;}
        state.pin=pinInputEl.value.trim()||storedPin();
        if(state.requiresPin&&!state.pin){showPinGate();return;}
        const resp=await fetch(apiUrl("/api/list",{root:state.root,path:state.path,pin:state.pin,sortBy:state.sortBy,sortDir:state.sortDir}));
        if(resp.status===401){clearPin();showPinGate();return;}
        if(!resp.ok){listEl.innerHTML='<tr><td colspan="4" class="py-10 text-center text-red-500">Failed to load. Check root/path/PIN.</td></tr>';return;}
        const payload=await resp.json();savePin(state.pin);
        const rootName=(state.roots.find((r)=>r.id===state.root)||{}).name||"root";
        renderBreadcrumb(rootName,payload.path);listEl.innerHTML="";
        renderListHeader();
        if(payload.path){
          const pp=payload.path.includes("/")?payload.path.split("/").slice(0,-1).join("/"):"";
          const row=document.createElement("tr");row.className="item-row";
          row.innerHTML='<td colspan="4" class="name-cell"><button class="flex items-center gap-2">\u2b06 ..</button></td>';
          row.querySelector("button").addEventListener("click",()=>{state.path=pp;loadDirectory();});listEl.appendChild(row);
        }
        payload.entries.forEach((entry)=>{
          const row=document.createElement("tr");row.className="item-row";
          const nameCell=entry.isDirectory?'<td class="name-cell"><button class="flex items-start gap-2">&#128193; <span>'+entry.name+'/</span></button></td>':'<td class="name-cell"><div class="flex items-start gap-2">&#128196; <span>'+entry.name+'</span></div></td>';
          
          const size=formatBytes(entry.size);
          const sizeCell='<td class="col-size">'+(entry.isDirectory?"\u2014":`<span>${size.full}</span>`)+'</td>';
          
          const dt=new Date(entry.modifiedAt);
          const dateCell=`<td class="col-date"><span>${dt.toLocaleDateString()}</span><br/><span class="text-[10px] opacity-70">${dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></td>`;
          
          const delBtn=state.deleteEnabled?'<button class="icon-btn" data-delete="'+entry.relPath+'" data-name="'+entry.name+'">Delete</button>':'';
          const dlDisabled=state.readEnabled?'':' disabled';
          const actionCell=entry.isDirectory
            ?'<td class="col-actions"><div class="entry-actions" data-dl-path="'+entry.relPath+'"><button class="dl-btn"'+dlDisabled+'>\u2193 ZIP</button>'+delBtn+'</div></td>'
            :'<td class="col-actions"><div class="entry-actions" data-dl-path="'+entry.relPath+'"><button class="dl-btn"'+dlDisabled+'>\u2193 Download</button>'+delBtn+'</div></td>';
          
          row.innerHTML=nameCell+sizeCell+dateCell+actionCell;
          if(entry.isDirectory){row.querySelector(".name-cell button").addEventListener("click",()=>{state.path=entry.relPath;loadDirectory();});row.querySelector(".dl-btn").addEventListener("click",()=>downloadDirectory(entry.relPath));}
          else row.querySelector(".dl-btn").addEventListener("click",()=>downloadFile(entry.relPath));
          const deleteBtn=row.querySelector("button[data-delete]");
          if(deleteBtn)deleteBtn.addEventListener("click",()=>deleteEntry(entry.relPath,entry.name));
          listEl.appendChild(row);
        });
        if(!payload.entries.length&&!payload.path){
          const row=document.createElement("tr");row.className="item-row";
          row.innerHTML='<td colspan="4" class="py-10 text-center text-slate-500">This folder is empty.</td>';
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
      downloadModeToggleEl.addEventListener("change",()=>setDownloadMode(downloadModeToggleEl.checked?"browser":"managed"));
      fileInputEl.addEventListener("change",handleFileSelect);
      dirInputEl.addEventListener("change",handleDirectorySelect);
      uploadBtnEl.addEventListener("click",()=>fileInputEl.click());
      uploadDirBtnEl.addEventListener("click",()=>dirInputEl.click());
      createDirBtnEl.addEventListener("click",createDirectory);
      newDirNameEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")createDirectory();});
      // Delegated listener for download panel — survives innerHTML re-renders
      downloadItemsEl.addEventListener("click",(e)=>{
        const btn=e.target.closest("button[data-action]");if(!btn)return;
        const action=btn.dataset.action,path=btn.dataset.path;
        if(!path)return;
        if(action==="start")resumeManagedDownload(path);
        else if(action==="pause")pauseManagedDownload(path);
        else if(action==="cancel")cancelManagedDownload(path);
        else if(action==="remove")removeManagedDownload(path);
      });
      // Delegated listener for upload panel — survives innerHTML re-renders
      uploadItemsEl.addEventListener("click",(e)=>{
        const btn=e.target.closest("button[data-action]");if(!btn)return;
        const action=btn.dataset.action,id=btn.dataset.id;
        if(!id)return;
        if(action==="start")startUpload(id);
        else if(action==="pause")pauseUpload(id);
        else if(action==="cancel")cancelUpload(id);
        else if(action==="remove")removeUpload(id);
      });
      (async()=>{setDownloadMode(state.downloadMode);renderDownloadPanel();renderUploadPanel();await loadStatus();const saved=storedPin();if(saved){state.pin=saved;pinInputEl.value=saved;}await loadDirectory();})();