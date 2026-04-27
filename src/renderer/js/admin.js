const { createApp, ref, reactive, computed, onMounted, onUnmounted, watch } = Vue;

createApp({
  setup() {
    const status = reactive({
      sharingActive: false,
      lanAddresses: [],
      lanUrls: [],
      roots: [],
      requiresPin: false,
      domainName: '',
      uploadEnabled: true,
      uploadMaxSizeMb: 51200,
      readEnabled: true,
      createEnabled: true,
      deleteEnabled: false,
      webdavEnabled: false,
      webdavUrls: [],
      port: 12345
    });

    const currentTab = ref('overview');
    const qrCode = ref('');
    const shareRootPath = ref('');
    const pinValue = ref('');
    const domainName = ref('');
    const serverPort = ref(12345);
    const uploadMaxSizeMb = ref(51200);
    const healthWarnings = ref([]);
    const toasts = ref([]);
    const activeWebdavUrl = ref('');
    const activeWebdavOs = ref('windows');
    const isDark = ref(document.documentElement.classList.contains('dark'));
    const desktopSettings = reactive({
      autoLaunch: false
    });

    const tabTitle = computed(() => {
      const titles = {
        overview: 'Dashboard',
        sharing: 'Sharing Control',
        security: 'Security',
        network: 'Connectivity',
        system: 'System'
      };
      return titles[currentTab.value] || 'Admin';
    });

    const permissions = reactive({
      readEnabled: true,
      uploadEnabled: true,
      createEnabled: true,
      deleteEnabled: false,
      webdavEnabled: false
    });

    const filteredPermissions = computed(() => {
      const p = { ...permissions };
      delete p.webdavEnabled;
      return p;
    });

    const electron = computed(() => !!window.electronAPI);

    const showToast = (message, type = 'success') => {
      const id = Date.now();
      toasts.value.push({ id, message, type });
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id);
      }, 3000);
    };

    // FIXED: Pure IPC refresh
    const refreshStatus = async () => {
      if (window.electronAPI) {
        const s = await window.electronAPI.getStatus();
        if (s) updateLocalStatus(s);
        
        const settings = await window.electronAPI.getSettings();
        if (settings) {
          desktopSettings.autoLaunch = settings.autoLaunch;
        }
        // No toast on auto-refresh to avoid spam, 
        // but manual clicks (if bound to a specific button) could show one.
      }
      await loadDiscoveryHealth();
      await loadQr();
    };

    const updateLocalStatus = (s) => {
      Object.assign(status, s);
      
      // Prevent overwriting inputs if user is currently typing (focused)
      const activeId = document.activeElement?.id || '';
      
      if (activeId !== 'input-shareRootPath') shareRootPath.value = s.roots?.[0]?.absPath || '';
      if (activeId !== 'input-domainName') domainName.value = s.domainName || '';
      if (activeId !== 'input-serverPort') serverPort.value = s.port || 12345;
      if (activeId !== 'input-uploadMaxSizeMb') uploadMaxSizeMb.value = s.uploadMaxSizeMb || 51200;
      
      permissions.readEnabled = !!s.readEnabled;
      permissions.uploadEnabled = !!s.uploadEnabled;
      permissions.createEnabled = !!(s.createEnabled || s.modifyEnabled);
      permissions.deleteEnabled = !!s.deleteEnabled;
      permissions.webdavEnabled = !!s.webdavEnabled;

      if (!activeWebdavUrl.value && s.webdavUrls?.length) {
        activeWebdavUrl.value = s.webdavUrls[0];
      }
    };

    const detectOs = () => {
      const platform = window.navigator.platform.toLowerCase();
      if (platform.includes('mac')) activeWebdavOs.value = 'macos';
      else if (platform.includes('linux')) activeWebdavOs.value = 'linux';
      else activeWebdavOs.value = 'windows';
    };

    const toggleTheme = () => {
      isDark.value = !isDark.value;
      if (isDark.value) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    };

      const copyWebdavCommand = (os, event) => {
        let cmd = '';
        const url = activeWebdavUrl.value;
        if (os === 'windows') cmd = `net use Z: "${url}"`;
        else if (os === 'macos') cmd = `osascript -e 'mount volume "${url}"'`;
        else if (os === 'linux') cmd = `gio mount "${url.replace('http://', 'dav://')}"`;
        
        copyText(cmd, event);
      };

    const toggleServer = async () => {
      if (!window.electronAPI) return;
      let success = false;
      if (status.sharingActive) {
        success = await window.electronAPI.stopServer();
        if (success) showToast('Sharing Stopped');
      } else {
        success = await window.electronAPI.startServer();
        if (success) showToast('Sharing Started');
      }
      if (!success) showToast('Failed to toggle server', 'error');
    };

    // FIXED: Toggle feedback for all permissions
    const togglePermission = async (key) => {
      permissions[key] = !permissions[key];
      const success = await saveTransferSettings(true);
      if (success) {
        const label = formatLabel(key);
        showToast(`${label} ${permissions[key] ? 'Enabled' : 'Disabled'}`);
      }
    };

    const saveTransferSettings = async (silent = false) => {
      if (!window.electronAPI) return false;
      const success = await window.electronAPI.updateTransferSettings({
        ...permissions,
        uploadMaxSizeMb: Number(uploadMaxSizeMb.value)
      });
      if (success && !silent) showToast('Transfer settings saved');
      else if (!success) showToast('Failed to save settings', 'error');
      return success;
    };

    const savePin = async () => {
      if (!window.electronAPI) return;
      if (pinValue.value && !/^\d{4,16}$/.test(pinValue.value)) {
        showToast('PIN must be 4-16 digits', 'error');
        return;
      }
      const success = await window.electronAPI.setPin(pinValue.value || undefined);
      if (success) {
        showToast(status.requiresPin ? 'Access PIN updated' : 'Access PIN enabled');
        pinValue.value = '';
      } else {
        showToast('Failed to set PIN', 'error');
      }
    };

    const clearPin = async () => {
      if (!window.electronAPI) return;
      const success = await window.electronAPI.setPin(undefined);
      if (success) showToast('Security PIN disabled');
    };

    const saveDomain = async () => {
      if (!window.electronAPI) return;
      const success = await window.electronAPI.setDomain(domainName.value || undefined);
      if (success) showToast('Domain updated successfully');
      else showToast('Failed to update domain', 'error');
    };

    const savePort = async () => {
      if (!window.electronAPI) return;
      const port = Number(serverPort.value);
      if (isNaN(port) || port < 1024 || port > 65535) {
        showToast('Invalid port number (1024-65535)', 'error');
        return;
      }
      const success = await window.electronAPI.changePort(port);
      if (success) {
        showToast('Port changed. Restarting server...');
        setTimeout(refreshStatus, 1000);
      } else {
        showToast('Failed to change port. Port might be in use.', 'error');
      }
    };

    const pickDirectory = async () => {
      if (!window.electronAPI) return;
      const picked = await window.electronAPI.pickDirectory();
      if (picked) {
        shareRootPath.value = picked;
        showToast('Directory selected');
      } else {
        // Potentially user cancelled or invalid
      }
    };

    const applyDirectory = async () => {
      if (!window.electronAPI) return;
      if (!shareRootPath.value) {
        showToast('Please provide a path', 'error');
        return;
      }
      const success = await window.electronAPI.applyDirectory(shareRootPath.value);
      if (success) showToast('Library root updated');
      else showToast('Invalid directory path', 'error');
    };

    const toggleAutoLaunch = async () => {
      if (!window.electronAPI) return;
      desktopSettings.autoLaunch = await window.electronAPI.toggleAutoLaunch(!desktopSettings.autoLaunch);
      showToast(`Autostart ${desktopSettings.autoLaunch ? 'Enabled' : 'Disabled'}`);
    };

    const loadQr = async () => {
      if (window.electronAPI) {
        const data = await window.electronAPI.getQr();
        qrCode.value = data.dataUrl;
      }
    };

    const loadDiscoveryHealth = async () => {
      if (window.electronAPI) {
        const data = await window.electronAPI.getDiscoveryHealth();
        healthWarnings.value = data.warnings || [];
      }
    };

    const copyText = (text, event) => {
      const btn = event.currentTarget;
      const fallbackCopy = (t) => {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed"; ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
      showToast('Copied to clipboard');
    };

    const openClientUI = () => {
      if (window.electronAPI && status.lanUrls && status.lanUrls.length) {
        window.electronAPI.openExternal(status.lanUrls[0]);
      } else {
        window.location.href = '/';
      }
    };

    const formatLabel = (key) => {
      const labels = {
        readEnabled: 'Read Access',
        uploadEnabled: 'File Uploads',
        createEnabled: 'Create Folders',
        deleteEnabled: 'Delete Files',
        webdavEnabled: 'WebDAV Support'
      };
      return labels[key] || key;
    };

    const getPermissionDesc = (key) => {
      const descs = {
        readEnabled: 'Allow browsing and downloading files',
        uploadEnabled: 'Allow clients to send files to this host',
        createEnabled: 'Allow creation of new directories',
        deleteEnabled: 'Allow removal of files and folders',
        webdavEnabled: 'Allow mounting library as a network drive'
      };
      return descs[key] || '';
    };

    let unsubscribe = null;

    onMounted(async () => {
      await refreshStatus();
      if (window.electronAPI) {
        unsubscribe = window.electronAPI.onStatusUpdate((newStatus) => {
          updateLocalStatus(newStatus);
        });
      }

      await refreshStatus();
      detectOs();
      setInterval(refreshStatus, 3000);
    });

    onUnmounted(() => {
      if (unsubscribe) unsubscribe();
    });

    return {
      status,
      currentTab,
      qrCode,
      shareRootPath,
      pinValue,
      domainName,
      serverPort,
      uploadMaxSizeMb,
      healthWarnings,
      toasts,
      desktopSettings,
      tabTitle,
      permissions,
      filteredPermissions,
      electron,
      activeWebdavUrl,
      activeWebdavOs,
      isDark,
      copyWebdavCommand,
      toggleTheme,
      refreshStatus,
      toggleServer,
      togglePermission,
      saveTransferSettings,
      savePin,
      clearPin,
      saveDomain,
      savePort,
      pickDirectory,
      applyDirectory,
      toggleAutoLaunch,
      copyText,
      openClientUI,
      formatLabel,
      getPermissionDesc
    };
  }
}).mount('#app');