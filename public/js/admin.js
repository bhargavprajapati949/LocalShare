const state={sharingActive:true,webdavUrls:[]};
      const sharingStateEl=document.getElementById("sharingState"),hostIpsEl=document.getElementById("hostIps"),
            refreshStatusEl=document.getElementById("refreshStatus"),toggleSharingEl=document.getElementById("toggleSharing"),
            shareRootPathEl=document.getElementById("shareRootPath"),shareRootStatusEl=document.getElementById("shareRootStatus"),
            applyShareRootEl=document.getElementById("applyShareRoot"),pickShareRootEl=document.getElementById("pickShareRoot"),warningEl=document.getElementById("warning"),
            qrBoxEl=document.getElementById("qrBox"),qrImgEl=document.getElementById("qrImg"),
        readEnabledEl=document.getElementById("readEnabled"),uploadEnabledEl=document.getElementById("uploadEnabled"),createEnabledEl=document.getElementById("createEnabled"),deleteEnabledEl=document.getElementById("deleteEnabled"),uploadMaxSizeMbEl=document.getElementById("uploadMaxSizeMb"),
        saveTransferEl=document.getElementById("saveTransfer"),transferStatusEl=document.getElementById("transferStatus"),
            pinStatusBoxEl=document.getElementById("pinStatusBox"),pinValueEl=document.getElementById("pinValue"),
            savePinBtnEl=document.getElementById("savePinBtn"),clearPinBtnEl=document.getElementById("clearPinBtn"),pinSaveStatusEl=document.getElementById("pinSaveStatus"),
            webdavEnabledEl=document.getElementById("webdavEnabled"),webdavStatusEl=document.getElementById("webdavStatus"),webdavUrlsEl=document.getElementById("webdavUrls"),webdavUrlsContainerEl=document.getElementById("webdavUrlsContainer"),
            openClientUIEl=document.getElementById("openClientUI"),domainNameEl=document.getElementById("domainName"),
            saveDomainEl=document.getElementById("saveDomain"),domainStatusEl=document.getElementById("domainStatus"),
            healthDomainEl=document.getElementById("healthDomain"),healthUrlsEl=document.getElementById("healthUrls"),healthWarningsEl=document.getElementById("healthWarnings");
      function apiUrl(ep,p={}){const u=new URL(ep,window.location.origin);for(const[k,v]of Object.entries(p))if(v!=null&&v!=="")u.searchParams.set(k,String(v));return u;}
      function renderWarning(s){
        if (s.securityMode === "open-local-network") {
          warningEl.className = "mb-6 p-4 rounded-xl text-sm border font-medium flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/50";
          warningEl.innerHTML = '<svg class="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> <span>Warning: PIN is disabled. Any device on this LAN can access files.</span>';
        } else {
          warningEl.className = "mb-6 p-4 rounded-xl text-sm border font-medium flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/50";
          warningEl.innerHTML = '<svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg> <span>PIN protection is active for file access.</span>';
        }
      }
      function renderHostSummary(s){const started=s.lastStartedAt?new Date(s.lastStartedAt).toLocaleTimeString():"—";sharingStateEl.textContent=s.sharingActive?"Active (started "+started+")":"Stopped";hostIpsEl.textContent=(s.lanAddresses||[]).length?s.lanAddresses.join("\\n"):"No IPv4 detected";state.sharingActive=Boolean(s.sharingActive);toggleSharingEl.classList.remove('hidden');if(state.sharingActive){toggleSharingEl.textContent="Stop Sharing";toggleSharingEl.className="btn-danger";}else{toggleSharingEl.textContent="Start Sharing";toggleSharingEl.className="btn-primary";}state.webdavUrls=Array.isArray(s.webdavUrls)?s.webdavUrls:[];webdavUrlsEl.textContent=state.webdavUrls.length?state.webdavUrls.join("\\n"):"No WebDAV URLs detected.";}
      async function loadQr(){try{const r=await fetch("/api/qr");if(!r.ok)return;const{dataUrl}=await r.json();qrImgEl.src=dataUrl;qrBoxEl.style.visibility="visible";}catch{}}
      async function loadStatus(){const r=await fetch(apiUrl("/api/status"));if(!r.ok)throw new Error("Status failed");const s=await r.json();renderWarning(s);renderHostSummary(s);if(s.roots&&s.roots[0])shareRootPathEl.value=s.roots[0].absPath;}
      async function loadTransferSettings(){
        try{
          const r=await fetch("/api/host/transfer");
          if(!r.ok)throw new Error("Transfer settings failed");
          const data=await r.json();
          readEnabledEl.checked=Boolean(data.readEnabled ?? true);
          uploadEnabledEl.checked=Boolean(data.uploadEnabled);
          createEnabledEl.checked=Boolean(data.createEnabled ?? data.modifyEnabled);
          deleteEnabledEl.checked=Boolean(data.deleteEnabled);
          webdavEnabledEl.checked=Boolean(data.webdavEnabled ?? true);
          uploadMaxSizeMbEl.value=String(data.uploadMaxSizeMb||51200);
          webdavStatusEl.textContent=webdavEnabledEl.checked?"WebDAV is enabled. Clients can connect using the URLs below.":"WebDAV is disabled by host.";
          webdavStatusEl.style.borderColor=webdavEnabledEl.checked?"var(--success)":"var(--line)";
          webdavStatusEl.style.color=webdavEnabledEl.checked?"var(--success)":"var(--muted)";
          webdavUrlsContainerEl.classList.toggle('hidden', !webdavEnabledEl.checked);
        }catch{
          transferStatusEl.textContent="Failed to load upload settings.";
          webdavStatusEl.textContent="Failed to load WebDAV settings.";
        }
      }
      async function sendHostControl(action){const r=await fetch(apiUrl("/api/host/"+action),{method:"POST"});if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));alert(e.error||"Failed");return;}await loadStatus();}
      async function applySharedDirectory(){
        const absPath=shareRootPathEl.value.trim();if(!absPath){alert("Enter a path");return;}
        shareRootStatusEl.className="mt-2 text-sm font-medium text-slate-500";
        shareRootStatusEl.textContent="Applying...";
        const r=await fetch(apiUrl("/api/host/share-root"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({absPath})});
        if(!r.ok){
          const e=await r.json().catch(()=>({error:"Failed"}));
          shareRootStatusEl.className="mt-2 text-sm font-medium text-red-500";
          shareRootStatusEl.textContent=e.error||"Failed to set directory.";
          return;
        }
        shareRootStatusEl.className="mt-2 text-sm font-medium text-emerald-500";
        shareRootStatusEl.textContent="Directory successfully updated!";
        setTimeout(()=>{shareRootStatusEl.textContent="";},3000);
        await loadStatus();
      }
      async function pickSharedDirectory(){
        shareRootStatusEl.className="mt-2 text-sm font-medium text-slate-500";
        shareRootStatusEl.textContent="Opening directory picker...";
        const r=await fetch(apiUrl("/api/host/pick-share-root"),{method:"POST"});
        if(!r.ok){
          const e=await r.json().catch(()=>({error:"Failed"}));
          shareRootStatusEl.className="mt-2 text-sm font-medium text-red-500";
          shareRootStatusEl.textContent=e.error||"Failed to pick directory.";
          setTimeout(()=>{shareRootStatusEl.textContent="";},3000);
          return;
        }
        const payload=await r.json();
        if(payload&&payload.absPath){
          shareRootPathEl.value=payload.absPath;
          shareRootStatusEl.className="mt-2 text-sm font-medium text-emerald-500";
          shareRootStatusEl.textContent="Directory successfully updated!";
          setTimeout(()=>{shareRootStatusEl.textContent="";},3000);
          await loadStatus();
        } else {
          shareRootStatusEl.textContent="";
        }
      }
      async function saveTransferSettings(){
        const maxSizeMb=Number(uploadMaxSizeMbEl.value);
        if(!Number.isFinite(maxSizeMb)||maxSizeMb<1||maxSizeMb>51200){
          transferStatusEl.className="text-sm font-medium mt-3 text-red-500";
          transferStatusEl.textContent="Max upload size must be between 1 and 51200 MB.";
          setTimeout(()=>{transferStatusEl.textContent="";},3000);
          return;
        }
        const payload={readEnabled:Boolean(readEnabledEl.checked),uploadEnabled:Boolean(uploadEnabledEl.checked),createEnabled:Boolean(createEnabledEl.checked),deleteEnabled:Boolean(deleteEnabledEl.checked),webdavEnabled:Boolean(webdavEnabledEl.checked),uploadMaxSizeMb:Math.round(maxSizeMb)};
        const r=await fetch("/api/host/transfer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!r.ok){
          const e=await r.json().catch(()=>({error:"Failed"}));
          transferStatusEl.className="text-sm font-medium mt-3 text-red-500";
          transferStatusEl.textContent=e.error||"Failed to save upload settings.";
          setTimeout(()=>{transferStatusEl.textContent="";},3000);
          return;
        }
        const data=await r.json();
        readEnabledEl.checked=Boolean(data.readEnabled ?? true);
        uploadEnabledEl.checked=Boolean(data.uploadEnabled);
        createEnabledEl.checked=Boolean(data.createEnabled ?? data.modifyEnabled);
        deleteEnabledEl.checked=Boolean(data.deleteEnabled);
        webdavEnabledEl.checked=Boolean(data.webdavEnabled ?? true);
        uploadMaxSizeMbEl.value=String(data.uploadMaxSizeMb||51200);
        transferStatusEl.className="text-sm font-medium mt-3 text-emerald-500";
        transferStatusEl.textContent="Upload settings saved.";
        setTimeout(()=>{transferStatusEl.textContent="";},3000);
        webdavStatusEl.textContent=webdavEnabledEl.checked?"WebDAV is enabled. Clients can connect using the URLs below.":"WebDAV is disabled by host.";
        webdavStatusEl.style.borderColor=webdavEnabledEl.checked?"var(--success)":"var(--line)";
        webdavStatusEl.style.color=webdavEnabledEl.checked?"var(--success)":"var(--muted)";
        webdavUrlsContainerEl.classList.toggle('hidden', !webdavEnabledEl.checked);
        await loadStatus();
      }
      async function saveWebdavSettings(){
        const r=await fetch("/api/host/transfer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({webdavEnabled:Boolean(webdavEnabledEl.checked)})});
        if(!r.ok){const e=await r.json().catch(()=>({error:"Failed"}));webdavStatusEl.textContent=e.error||"Failed to save WebDAV setting.";webdavStatusEl.style.borderColor="var(--danger)";webdavStatusEl.style.color="var(--danger)";return;}
        const data=await r.json();
        webdavEnabledEl.checked=Boolean(data.webdavEnabled ?? true);
        webdavStatusEl.textContent=webdavEnabledEl.checked?"WebDAV is enabled. Clients can connect using the URLs below.":"WebDAV is disabled by host.";
        webdavStatusEl.style.borderColor=webdavEnabledEl.checked?"var(--success)":"var(--line)";
        webdavStatusEl.style.color=webdavEnabledEl.checked?"var(--success)":"var(--muted)";
        webdavUrlsContainerEl.classList.toggle('hidden', !webdavEnabledEl.checked);
        await loadStatus();
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
            pinStatusBoxEl.className = "p-4 rounded-xl text-sm border font-medium mb-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/50";
            pinStatusBoxEl.style.borderColor="";
            pinStatusBoxEl.style.color="";
          }else{
            pinStatusBoxEl.textContent="PIN is disabled — files are open to all LAN devices";
            pinStatusBoxEl.className = "p-4 rounded-xl text-sm border font-medium mb-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/50";
            pinStatusBoxEl.style.borderColor="";
            pinStatusBoxEl.style.color="";
          }
          savePinBtnEl.textContent=data.requiresPin?"Change PIN":"Set PIN";
          clearPinBtnEl.style.display=(!data.requiresPin||data.pinSource==="env")?"none":"flex";
        }catch{
          pinStatusBoxEl.textContent="Failed to load PIN settings.";
        }
      }
      async function savePinSettings(){
        const pin=pinValueEl.value.trim();
        if(!/^\d{4,16}$/.test(pin)){pinSaveStatusEl.textContent="PIN must be 4\u201316 digits.";return;}
        const r=await fetch("/api/host/access/pin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin})});
        if(!r.ok){
          const e=await r.json().catch(()=>({error:"Failed"}));
          pinSaveStatusEl.className="text-sm font-medium mt-3 text-red-500";
          pinSaveStatusEl.textContent=e.error||"Failed to set PIN.";
          return;
        }
        pinValueEl.value="";
        pinSaveStatusEl.className="text-sm font-medium mt-3 text-emerald-500";
        pinSaveStatusEl.textContent="PIN set. Clients will now be prompted for it.";
        setTimeout(()=>{pinSaveStatusEl.textContent="";},3000);
        await loadPinSettings();
        await loadStatus();
      }
      async function clearPinSettings(){
        if(!confirm("Disable PIN? Clients will no longer need a PIN to access files."))return;
        const r=await fetch("/api/host/access/pin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:""})});
        if(!r.ok){
          const e=await r.json().catch(()=>({error:"Failed"}));
          pinSaveStatusEl.className="text-sm font-medium mt-3 text-red-500";
          pinSaveStatusEl.textContent=e.error||"Failed to clear PIN.";
          return;
        }
        pinSaveStatusEl.className="text-sm font-medium mt-3 text-emerald-500";
        pinSaveStatusEl.textContent="PIN disabled. Files are now open on the LAN.";
        setTimeout(()=>{pinSaveStatusEl.textContent="";},3000);
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
            row.className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 mb-2 border border-slate-200 dark:border-slate-700/50";
            const link=document.createElement("a");
            link.className="font-mono text-sm text-brand-600 dark:text-brand-400 truncate mr-3 flex-1";
            link.href=url;
            link.target="_blank";
            link.rel="noreferrer";
            link.textContent=url;
            const copyBtn=document.createElement("button");
            copyBtn.className="btn-secondary text-xs px-3 py-1.5 h-auto shrink-0 shadow-sm";
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
      async function saveDomainName(){
        const domainName=domainNameEl.value.trim();
        domainStatusEl.className="text-sm font-medium mt-2 text-slate-500";
        domainStatusEl.textContent="Updating...";
        const r=await fetch("/api/host/domain-name",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domainName:domainName||undefined})});
        if(!r.ok){
          const e=await r.json().catch(()=>({error:"Failed"}));
          domainStatusEl.className="text-sm font-medium mt-2 text-red-500";
          domainStatusEl.textContent=e.error||"Failed to update domain.";
          return;
        }
        const data=await r.json();
        domainNameEl.value=data.domainName||"";
        domainStatusEl.className="text-sm font-medium mt-2 text-emerald-500";
        domainStatusEl.textContent=data.domainName?"✓ Domain updated: "+data.domainName:"Domain reset to suggested: "+data.suggested;
        setTimeout(()=>{domainStatusEl.textContent="";},3000);
        await loadDiscoveryHealth();
      }
      toggleSharingEl.addEventListener("click",()=>sendHostControl(state.sharingActive?"stop":"start"));
      pickShareRootEl.addEventListener("click",pickSharedDirectory);
      applyShareRootEl.addEventListener("click",applySharedDirectory);
      shareRootPathEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")applySharedDirectory();});
      saveDomainEl.addEventListener("click",saveDomainName);
      domainNameEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")saveDomainName();});
      saveTransferEl.addEventListener("click",saveTransferSettings);
      webdavEnabledEl.addEventListener("change",saveWebdavSettings);uploadMaxSizeMbEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")saveTransferSettings();});
      savePinBtnEl.addEventListener("click",savePinSettings);
      pinValueEl.addEventListener("keydown",(e)=>{if(e.key==="Enter")savePinSettings();});
      clearPinBtnEl.addEventListener("click",clearPinSettings);
      refreshStatusEl.addEventListener("click",async()=>{await loadStatus();await loadTransferSettings();await loadPinSettings();await loadDiscoveryHealth();});
      openClientUIEl.addEventListener("click",()=>window.location.href="/");
      (async()=>{await loadStatus();await loadTransferSettings();await loadPinSettings();loadQr();await loadDomainName();await loadDiscoveryHealth();})();