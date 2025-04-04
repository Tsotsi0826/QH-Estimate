// js/dashboard.js - Final Cleaned Version: Initializes managers and handles core callback.

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
        'Firebase', 'ModuleUtils', 'ClientManager', 'ModuleDefinitionManager',
        'SidebarManager', 'ClientUI', 'DashboardRenderer', 'DebugPanel'
    ];
    const noInitNeeded = [
        'Firebase', 'DataModels', 'ModuleUtils', 'ClientManager', 'ModuleDefinitionManager'
    ];
    let missingManager = null;
    for (const managerName of requiredManagers) {
        const manager = window.ConstructionApp[managerName];
        // Check if manager exists AND (if it needs an init function, check if it has one)
        if (!manager || (typeof manager.init !== 'function' && !noInitNeeded.includes(managerName))) {
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

        // Initialize other managers that require init
        console.log("DEBUG: Initializing DashboardRenderer...");
        window.ConstructionApp.DashboardRenderer.init(appData.modules);

        console.log("DEBUG: Initializing SidebarManager...");
        window.ConstructionApp.SidebarManager.init(appData.modules);

        console.log("DEBUG: Initializing ClientUI...");
        window.ConstructionApp.ClientUI.init();

        // Setup Add Module Button
        setupAddModuleButton(); // Cleaned version below

        // Determine initial client state AFTER all managers are initialized
        console.log("DEBUG: Calling initApp...");
        initApp(); // Triggers updateDashboard via callback if client changes
        console.log("DEBUG: initApp COMPLETE.");


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
        if (contentElement) { /* ... Display error message ... */ }
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
     try { clientToSet = JSON.parse(storedClientStr || 'null'); } catch (e) { clientToSet = null; sessionStorage.removeItem('currentClient');}
     if (navigationState === 'manualLogout' || navigationState === 'invalidAccess') { clientToSet = null; }
     sessionStorage.removeItem('navigationState');

    console.log("DEBUG: Calling ClientManager.setCurrentClient with client:", clientToSet ? clientToSet.name : 'None');
    window.ConstructionApp.ClientManager.setCurrentClient(clientToSet);

    window.ConstructionApp.DebugPanel?.update();
}

/**
 * Sets up the listener for the 'Add New Module' button - FINAL CLEANED VERSION.
 */
function setupAddModuleButton() {
    const addModuleBtn = document.getElementById('add-module-btn');
    const modalOverlay = document.getElementById('add-module-modal-overlay');
    // Find elements needed for modal setup and save action
    const parentHeaderSelect = document.getElementById('parent-header-select');
    const moduleNameInput = document.getElementById('new-module-name');
    const moduleTypeSelect = document.getElementById('new-module-type');
    const parentHeaderGroup = document.getElementById('parent-header-group');
    const requiresClientCheckbox = document.getElementById('new-module-requires-client');
    const saveNewModuleBtn = document.getElementById('save-new-module-btn');

    // Check if all required elements exist before attaching listeners
    if (!addModuleBtn || !modalOverlay || !parentHeaderSelect || !moduleNameInput || !moduleTypeSelect || !parentHeaderGroup || !requiresClientCheckbox || !saveNewModuleBtn) {
         console.warn("[Dashboard] Add module button or one/more modal elements not found during setup. Cannot attach listener properly.");
         return; // Stop setup if essential elements are missing
    }

    // Use clone/replace to prevent potential duplicate listeners
    const newAddBtn = addModuleBtn.cloneNode(true);
    addModuleBtn.parentNode.replaceChild(newAddBtn, addModuleBtn);

    // --- Attach the CLICK LISTENER to show modal ---
    newAddBtn.addEventListener('click', () => {
        try {
            // --- Populate parent select ---
            parentHeaderSelect.innerHTML = '<option value="null">(Top Level / No Parent)</option>'; // Reset
            const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
            if (!ModuleDefManager || typeof ModuleDefManager.getModuleDefinitions !== 'function') {
                console.error("Cannot populate parent headers: ModuleDefinitionManager not available.");
                alert("Error preparing Add Module dialog.");
                return;
            }
            const currentModules = ModuleDefManager.getModuleDefinitions() || [];
            const headerModules = currentModules.filter(m => m.type === 'header');
            headerModules.sort((a, b) => a.name.localeCompare(b.name)).forEach(header => {
                const option = document.createElement('option');
                option.value = header.id;
                option.textContent = header.name;
                parentHeaderSelect.appendChild(option);
             });

            // --- Reset form fields ---
            moduleNameInput.value = '';
            moduleTypeSelect.value = 'regular';
            parentHeaderGroup.style.display = 'block';
            parentHeaderSelect.value = 'null';
            requiresClientCheckbox.checked = true;

            // --- Show the modal ---
            modalOverlay.style.display = 'flex';

        } catch (error) {
            console.error("Error inside Add Module button click listener:", error);
            alert("An error occurred while trying to open the Add Module dialog. Please check the console.");
        }
    });
    // --- End of CLICK LISTENER ---

    // Type change listener
    moduleTypeSelect.addEventListener('change', function() { document.getElementById('parent-header-group').style.display = this.value === 'regular' ? 'block' : 'none'; if (this.value === 'header') document.getElementById('parent-header-select').value = 'null'; });

    // Generic close button setup
    const closeBtns = modalOverlay.querySelectorAll('.modal-close, .btn-cancel');
     closeBtns.forEach(btn => { const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn); newBtn.addEventListener('click', () => modalOverlay.style.display = 'none'); });

    // Save Button Listener calls ModuleDefinitionManager - DEBUG LOGS REMOVED
     if (saveNewModuleBtn) {
        const newSaveBtn = saveNewModuleBtn.cloneNode(true); saveNewModuleBtn.parentNode.replaceChild(newSaveBtn, saveNewModuleBtn);
        newSaveBtn.addEventListener('click', () => {
            // console.log("DEBUG AddModuleSave: Save button clicked."); // REMOVED
            const moduleInfo = {
                 name: document.getElementById('new-module-name').value,
                 type: document.getElementById('new-module-type').value,
                 parentId: document.getElementById('parent-header-select').value,
                 requiresClient: document.getElementById('new-module-requires-client').checked
            };
            // console.log("DEBUG AddModuleSave: Gathered moduleInfo:", moduleInfo); // REMOVED

            const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
            if (!ModuleDefManager || typeof ModuleDefManager.addNewModuleDefinition !== 'function') {
                 console.error("Cannot save module: ModuleDefinitionManager not available.");
                 alert("Error: Cannot save module definition.");
                 return;
            }
            // console.log("DEBUG AddModuleSave: Calling addNewModuleDefinition..."); // REMOVED
            const newModule = ModuleDefManager.addNewModuleDefinition(moduleInfo);
            // console.log("DEBUG AddModuleSave: addNewModuleDefinition returned:", newModule); // REMOVED

            if (newModule) { // Manager returns null on validation failure now
                 modalOverlay.style.display = 'none';
                 alert(`Module "${newModule.name}" created successfully.`);
            } // Else: Manager handles validation alerts/errors
        });
     }

     console.log("[Dashboard] Add Module button setup complete."); // Removed "(with debugging)"
}


/**
 * Update the dashboard UI based on the current client. (Callback for ClientManager)
 * Updates header/description elements and delegates rendering the main content area.
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

// --- Expose necessary functions ---
// Nothing needs to be exposed globally from dashboard.js anymore
window.ConstructionApp.Dashboard = {};
