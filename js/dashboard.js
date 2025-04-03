// js/dashboard.js - Refactored: Dashboard rendering logic moved to dashboard-renderer.js

// --- Global Variables ---
let appData = {
    modules: [] // Still holds module definitions loaded by ModuleDefinitionManager
};

// Ensure the main app namespace exists
window.ConstructionApp = window.ConstructionApp || {};


// --- Initialization ---

document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG: DOMContentLoaded event fired");
    console.log("[Dashboard] DOM loaded, initializing app");
    setupDebugPanel(); // Setup debug panel first

    // Ensure dependent managers are available
    if (!window.ConstructionApp.ModuleDefinitionManager || !window.ConstructionApp.ClientManager || !window.ConstructionApp.SidebarManager || !window.ConstructionApp.ClientUI || !window.ConstructionApp.DashboardRenderer) { // Added DashboardRenderer check
        console.error("[Dashboard] CRITICAL: One or more required managers not found! App cannot initialize correctly.");
        const contentElement = document.getElementById('module-content');
         if (contentElement) {
             contentElement.innerHTML = `<div class="no-client-notification" style="background-color: #f8d7da; color: #721c24; border-color: #f5c6cb;"><h2>Initialization Error</h2><p>A critical component failed to load. Please check the console (F12) or contact support.</p></div>`;
         }
        return; // Stop initialization
    }

    console.log("DEBUG: Calling ModuleDefinitionManager.loadModuleDefinitions...");
    window.ConstructionApp.ModuleDefinitionManager.loadModuleDefinitions().then(loadedModules => {
        console.log("DEBUG: ModuleDefinitionManager.loadModuleDefinitions COMPLETE.");
        appData.modules = loadedModules; // Store the loaded modules

        // Assign the client change callback
        console.log("DEBUG: Setting ClientManager.onClientChanged callback to updateDashboard.");
        window.ConstructionApp.ClientManager.onClientChanged = updateDashboard;

        // Initialize the Dashboard Renderer, passing the loaded module data
        console.log("DEBUG: Initializing DashboardRenderer...");
        window.ConstructionApp.DashboardRenderer.init(appData.modules); // Init renderer

        console.log("DEBUG: Calling initApp...");
        initApp(); // Determine initial client state (triggers updateDashboard if client changes)
        console.log("DEBUG: initApp COMPLETE.");

        // Initialize the Sidebar Manager
        console.log("DEBUG: Initializing SidebarManager...");
        window.ConstructionApp.SidebarManager.init(appData.modules);

        // Initialize the Client UI Manager
        console.log("DEBUG: Initializing ClientUI...");
        window.ConstructionApp.ClientUI.init();

        // Setup Add Module Button (Still here for now)
        setupAddModuleButton();

        // Load client list asynchronously
        window.ConstructionApp.ClientManager.loadClients().then(() => {
            console.log("[Dashboard] Client list loaded");
        }).catch(error => {
            console.error("[Dashboard] Error loading client list:", error);
        });

    }).catch(error => {
        // Handle errors during module definition loading
        console.error("DEBUG: ModuleDefinitionManager.loadModuleDefinitions FAILED.", error);
        console.error("[Dashboard] Critical error during module definition loading:", error);
        const contentElement = document.getElementById('module-content');
        if (contentElement) {
             contentElement.innerHTML = `<div class="no-client-notification" style="background-color: #f8d7da; color: #721c24; border-color: #f5c6cb;"><h2>Error Loading Modules</h2><p>Could not load module definitions. Please check the console (F12) for details or contact support.</p><p>Error: ${error.message || 'Unknown error'}</p></div>`;
        }
    });
});

/**
 * Initializes the application state (client).
 * (No changes needed in this function)
 */
function initApp() {
    console.log("[Dashboard] Initializing app state");
    const navigationState = sessionStorage.getItem('navigationState');
    const storedClientStr = sessionStorage.getItem('currentClient');
    let clientToSet = null;
    // ... Logic to determine clientToSet based on state ...
     try { clientToSet = JSON.parse(storedClientStr || 'null'); } catch (e) { clientToSet = null; sessionStorage.removeItem('currentClient');}

    console.log("DEBUG: Calling ClientManager.setCurrentClient with client:", clientToSet ? clientToSet.name : 'None');
    window.ConstructionApp.ClientManager.setCurrentClient(clientToSet); // This triggers updateDashboard via callback

    sessionStorage.removeItem('navigationState');
    updateDebugPanel();
}

// --- Module Definition Loading/Saving/Defaults/Backup Functions are MOVED ---


// --- Module Creation (Modal Setup - Listener calls ModuleDefinitionManager) ---
// (setupAddModuleButton remains here for now)
function setupAddModuleButton() {
    const addModuleBtn = document.getElementById('add-module-btn');
    const modalOverlay = document.getElementById('add-module-modal-overlay');
    if (!addModuleBtn || !modalOverlay) { return; }

    addModuleBtn.addEventListener('click', () => {
        // Populate parent select
        const parentHeaderSelect = document.getElementById('parent-header-select');
        parentHeaderSelect.innerHTML = '<option value="null">(Top Level / No Parent)</option>';
        appData.modules.filter(m => m.type === 'header').sort((a, b) => a.name.localeCompare(b.name)).forEach(header => {
             const option = document.createElement('option'); option.value = header.id; option.textContent = header.name; parentHeaderSelect.appendChild(option);
        });
        // Reset form fields...
        document.getElementById('new-module-name').value = '';
        document.getElementById('new-module-type').value = 'regular';
        document.getElementById('parent-header-group').style.display = 'block';
        document.getElementById('parent-header-select').value = 'null';
        document.getElementById('new-module-requires-client').checked = true;
        modalOverlay.style.display = 'flex';
    });

    const moduleTypeSelect = document.getElementById('new-module-type');
    moduleTypeSelect?.addEventListener('change', function() { document.getElementById('parent-header-group').style.display = this.value === 'regular' ? 'block' : 'none'; if (this.value === 'header') document.getElementById('parent-header-select').value = 'null'; });

    // Generic close button setup
    const closeBtns = modalOverlay.querySelectorAll('.modal-close, .btn-cancel');
     closeBtns.forEach(btn => {
         const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn);
         newBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
     });
    // Save Button Listener calls ModuleDefinitionManager
    const saveNewModuleBtn = document.getElementById('save-new-module-btn');
     if (saveNewModuleBtn) {
        const newSaveBtn = saveNewModuleBtn.cloneNode(true); saveNewModuleBtn.parentNode.replaceChild(newSaveBtn, saveNewModuleBtn);
        newSaveBtn.addEventListener('click', () => {
            const moduleInfo = {
                 name: document.getElementById('new-module-name').value,
                 type: document.getElementById('new-module-type').value,
                 parentId: document.getElementById('parent-header-select').value,
                 requiresClient: document.getElementById('new-module-requires-client').checked
            };
            const newModule = window.ConstructionApp.ModuleDefinitionManager.addNewModuleDefinition(moduleInfo);
            if (newModule) { modalOverlay.style.display = 'none'; alert(`Module "${newModule.name}" created successfully.`); }
        });
     }
     console.log("[Dashboard] Add Module button setup.");
}

// --- Client Management UI Functions are MOVED ---


// --- Dashboard Content Rendering (Logic MOVED to dashboard-renderer.js) ---

/**
 * Update the dashboard UI based on the current client.
 * This is the primary callback for ClientManager.onClientChanged.
 * It now delegates rendering the main content area to DashboardRenderer.
 * @param {object|null} client - The new client object, or null if logged out.
 */
function updateDashboard(client) {
    console.log("DEBUG: updateDashboard START - Client:", client ? client.name : 'None');

    // Get references to UI elements NOT handled by renderer (header/description)
    const logoutBtn = document.getElementById('logout-btn');
    const clientNameDisplay = document.getElementById('client-name-display');
    const dashboardDesc = document.querySelector('.dashboard-description');

    // Check if essential elements exist
    if (!clientNameDisplay || !dashboardDesc || !logoutBtn) {
        console.error("[Dashboard] One or more essential dashboard header/desc elements missing.");
        // Don't return entirely, renderer might still work
    }

    // Update header/description based on client
    if (client) {
        console.log("DEBUG: updateDashboard - Updating header/desc for client.");
        if(clientNameDisplay) clientNameDisplay.textContent = `Client: ${client.name}`;
        if(dashboardDesc) dashboardDesc.textContent = `${client.address || 'No address provided'}`;
        if(logoutBtn) {
            logoutBtn.style.display = 'inline-block';
            // Re-attach logout listener
            const newLogoutBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            newLogoutBtn.addEventListener('click', () => {
                window.ConstructionApp?.ModuleUtils?.logoutClient();
            });
        }
    } else {
        console.log("DEBUG: updateDashboard - Clearing header/desc for no client.");
        if(clientNameDisplay) clientNameDisplay.textContent = '';
        if(dashboardDesc) dashboardDesc.textContent = 'Overview of project data.';
        if(logoutBtn) logoutBtn.style.display = 'none';
    }

    // --- Delegate rendering the main content area ---
    if (window.ConstructionApp.DashboardRenderer) {
         console.log("DEBUG: Calling DashboardRenderer.render...");
         window.ConstructionApp.DashboardRenderer.render(client); // Call the renderer
    } else {
         console.error("[Dashboard] DashboardRenderer not found! Cannot render content.");
         const contentElement = document.getElementById('module-content');
         if(contentElement) contentElement.innerHTML = '<p style="color: red; font-weight: bold;">Error: Dashboard Renderer failed to load.</p>';
    }
    // --- End delegation ---

    updateDebugPanel(); // Update debug info
    console.log("DEBUG: updateDashboard COMPLETE.");
}

// --- Functions related to rendering tiles, handling clicks, clearing data, updating total cost are MOVED ---


// --- Debug Panel (Still here for now) ---

function setupDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    let toggleBtn = document.getElementById('debug-toggle-btn');
    if (!toggleBtn && debugPanel) { /* ... create button ... */ }
    if (toggleBtn) {
        toggleBtn.style.display = 'block';
        toggleBtn.removeEventListener('click', toggleDebugPanel);
        toggleBtn.addEventListener('click', toggleDebugPanel);
        console.log("[Dashboard] Debug panel toggle setup.");
    }
}

function toggleDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    const toggleBtn = document.getElementById('debug-toggle-btn');
    if (!debugPanel || !toggleBtn) return;
    const isVisible = debugPanel.style.display === 'block';
    debugPanel.style.display = isVisible ? 'none' : 'block';
    toggleBtn.textContent = isVisible ? 'Debug' : 'Hide Debug';
    if (!isVisible) updateDebugPanel();
}

function updateDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    if (!debugPanel || debugPanel.style.display !== 'block') return;
    // ... Logic to gather state and update debugPanel.innerHTML ...
    const navigationState = sessionStorage.getItem('navigationState');
    const currentClient = window.ConstructionApp?.ClientManager?.getCurrentClient();
    const storedClientStr = sessionStorage.getItem('currentClient');
    const moduleOrderStr = sessionStorage.getItem('moduleOrder');
    let storedClientParsed = null; try { storedClientParsed = JSON.parse(storedClientStr || 'null'); } catch(e){}
    let debugInfo = `... Debug info generation ...`; // Simplified
    debugPanel.innerHTML = debugInfo;
}


// --- Expose necessary functions ---
// Expose updateDebugPanel if other modules need it (like ClientUI, though we removed the call)
window.ConstructionApp.Dashboard = {
    updateDebugPanel: updateDebugPanel
};
