// js/dashboard.js - Final Refactored Version: Initializes managers and handles core callback.

// --- Global Variables ---
// Keep appData here temporarily to hold the loaded modules from the definition manager
// and pass them to other managers during initialization.
let appData = {
    modules: []
};

// Ensure the main app namespace exists
window.ConstructionApp = window.ConstructionApp || {};


// --- Initialization ---

document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG: DOMContentLoaded event fired");
    console.log("[Dashboard] DOM loaded, initializing app");

    // Ensure ALL required managers are available before proceeding
    const requiredManagers = [
        'Firebase',
        'ModuleUtils',
        'ClientManager',
        'ModuleDefinitionManager',
        'SidebarManager',
        'ClientUI',
        'DashboardRenderer',
        'DebugPanel'
        // 'DataModels' is used by modules, not directly by dashboard init
    ];
    let missingManager = null;
    for (const managerName of requiredManagers) {
        // Check if the manager object exists and has an 'init' function (except for Firebase/DataModels/ModuleUtils)
        const manager = window.ConstructionApp[managerName];
        if (!manager || (typeof manager.init !== 'function' && !['Firebase', 'DataModels', 'ModuleUtils'].includes(managerName))) {
            missingManager = managerName;
            break;
        }
    }

    if (missingManager) {
        console.error(`[Dashboard] CRITICAL: Required manager "${missingManager}" not found or invalid! App cannot initialize correctly.`);
        const contentElement = document.getElementById('module-content');
        if (contentElement) {
            contentElement.innerHTML = `<div class="no-client-notification" style="background-color: #f8d7da; color: #721c24; border-color: #f5c6cb;"><h2>Initialization Error</h2><p>A critical component (${missingManager}) failed to load. Please check the console (F12) or contact support.</p></div>`;
        }
        // Try to init DebugPanel anyway to show potential errors if it exists
        window.ConstructionApp.DebugPanel?.init();
        return; // Stop initialization
    }
    console.log("[Dashboard] All required managers found.");

    // Initialize Debug Panel First
    console.log("DEBUG: Initializing DebugPanel...");
    window.ConstructionApp.DebugPanel.init();

    console.log("DEBUG: Calling ModuleDefinitionManager.loadModuleDefinitions...");
    window.ConstructionApp.ModuleDefinitionManager.loadModuleDefinitions().then(loadedModules => {
        console.log("DEBUG: ModuleDefinitionManager.loadModuleDefinitions COMPLETE.");
        appData.modules = loadedModules; // Store the loaded modules

        // Assign the client change callback AFTER managers are ready
        console.log("DEBUG: Setting ClientManager.onClientChanged callback to updateDashboard.");
        window.ConstructionApp.ClientManager.onClientChanged = updateDashboard;

        // Initialize other managers, passing necessary data
        console.log("DEBUG: Initializing DashboardRenderer...");
        window.ConstructionApp.DashboardRenderer.init(appData.modules);

        console.log("DEBUG: Initializing SidebarManager...");
        window.ConstructionApp.SidebarManager.init(appData.modules);

        console.log("DEBUG: Initializing ClientUI...");
        window.ConstructionApp.ClientUI.init();

        // Setup Add Module Button (Still controlled from here)
        setupAddModuleButton();

        // Determine initial client state AFTER all managers are initialized
        console.log("DEBUG: Calling initApp...");
        initApp(); // Triggers updateDashboard via callback if client changes
        console.log("DEBUG: initApp COMPLETE.");


        // Load client list asynchronously (ClientManager handles storage)
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
        // Update debug panel even on error
        window.ConstructionApp.DebugPanel?.update();
    });
});

/**
 * Initializes the application state (client). Called after managers are initialized.
 */
function initApp() {
    console.log("[Dashboard] Initializing app state (client)");
    const navigationState = sessionStorage.getItem('navigationState');
    const storedClientStr = sessionStorage.getItem('currentClient');
    let clientToSet = null;
    // Determine client based on stored data and navigation state
     try { clientToSet = JSON.parse(storedClientStr || 'null'); } catch (e) { clientToSet = null; sessionStorage.removeItem('currentClient');}
     if (navigationState === 'manualLogout' || navigationState === 'invalidAccess') {
         clientToSet = null; // Ensure client is null on logout/invalid access
     }
     sessionStorage.removeItem('navigationState'); // Clear flag after checking

    console.log("DEBUG: Calling ClientManager.setCurrentClient with client:", clientToSet ? clientToSet.name : 'None');
    // This triggers updateDashboard via callback if client is different or initially null/set
    window.ConstructionApp.ClientManager.setCurrentClient(clientToSet);

    window.ConstructionApp.DebugPanel?.update(); // Update debug panel
}

// --- Module Definition Loading/Saving/Defaults/Backup Functions are MOVED ---


// --- Module Creation (Modal Setup - Listener calls ModuleDefinitionManager) ---
// (setupAddModuleButton remains here as it ties HTML button to ModuleDefManager)
function setupAddModuleButton() {
    const addModuleBtn = document.getElementById('add-module-btn');
    const modalOverlay = document.getElementById('add-module-modal-overlay');
    if (!addModuleBtn || !modalOverlay) {
         console.warn("[Dashboard] Add module button or modal overlay not found.");
         return;
    }

    addModuleBtn.addEventListener('click', () => {
        // Populate parent select using data from ModuleDefinitionManager
        const parentHeaderSelect = document.getElementById('parent-header-select');
        parentHeaderSelect.innerHTML = '<option value="null">(Top Level / No Parent)</option>'; // Reset
        // Safely get modules
        const currentModules = window.ConstructionApp.ModuleDefinitionManager?.getModuleDefinitions() || [];
        currentModules.filter(m => m.type === 'header').sort((a, b) => a.name.localeCompare(b.name)).forEach(header => {
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

    // Type change listener remains the same...
    const moduleTypeSelect = document.getElementById('new-module-type');
    moduleTypeSelect?.addEventListener('change', function() { document.getElementById('parent-header-group').style.display = this.value === 'regular' ? 'block' : 'none'; if (this.value === 'header') document.getElementById('parent-header-select').value = 'null'; });

    // Generic close button setup (could move to utils)
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
            // Call the manager to handle creation, saving, and triggering sidebar render
            const newModule = window.ConstructionApp.ModuleDefinitionManager?.addNewModuleDefinition(moduleInfo);
            if (newModule) {
                 modalOverlay.style.display = 'none';
                 alert(`Module "${newModule.name}" created successfully.`);
            } // Else: Manager handles validation alerts/errors
        });
     }
     console.log("[Dashboard] Add Module button setup.");
}

// --- Client Management UI Functions are MOVED ---


// --- Dashboard Content Rendering Functions are MOVED ---

/**
 * Update the dashboard UI based on the current client.
 * This is the primary callback for ClientManager.onClientChanged.
 * It updates header/description elements and delegates rendering the main content area.
 * @param {object|null} client - The new client object, or null if logged out.
 */
function updateDashboard(client) {
    console.log("DEBUG: updateDashboard START - Client:", client ? client.name : 'None');

    // Get references to UI elements NOT handled by renderer
    const logoutBtn = document.getElementById('logout-btn');
    const clientNameDisplay = document.getElementById('client-name-display');
    const dashboardDesc = document.querySelector('.dashboard-description');

    // Update header/description based on client
    if (client) {
        if(clientNameDisplay) clientNameDisplay.textContent = `Client: ${client.name}`;
        if(dashboardDesc) dashboardDesc.textContent = `${client.address || 'No address provided'}`;
        if(logoutBtn) {
            logoutBtn.style.display = 'inline-block';
            const newLogoutBtn = logoutBtn.cloneNode(true); // Re-attach listener
            logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            newLogoutBtn.addEventListener('click', () => { window.ConstructionApp?.ModuleUtils?.logoutClient(); });
        }
    } else {
        if(clientNameDisplay) clientNameDisplay.textContent = '';
        if(dashboardDesc) dashboardDesc.textContent = 'Overview of project data.';
        if(logoutBtn) logoutBtn.style.display = 'none';
    }

    // --- Delegate rendering the main content area to DashboardRenderer ---
    console.log("DEBUG: Calling DashboardRenderer.render...");
    window.ConstructionApp.DashboardRenderer?.render(client); // Use optional chaining

    // Update debug panel AFTER rendering might have changed state
    window.ConstructionApp.DebugPanel?.update(); // Use optional chaining
    console.log("DEBUG: updateDashboard COMPLETE.");
}

// --- Debug Panel Functions are MOVED ---


// --- Expose necessary functions ---
// Nothing needs to be exposed globally from dashboard.js anymore
window.ConstructionApp.Dashboard = {};
