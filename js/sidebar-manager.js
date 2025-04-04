// js/sidebar-manager.js - Debugging init function entry and early steps
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let headerCollapseState = {};
    let globalDraggedItem = null;
    let dragOverElement = null;
    let dropIndicator = null;
    let modules = []; // Local reference, modified by D&D

    // --- Helper Functions ---
    function triggerSaveStructure() {
        const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
        if (ModuleDefManager) {
            if (typeof ModuleDefManager.recalculateModuleOrder === 'function') {
                // Pass the sidebar's current 'modules' array to be recalculated
                ModuleDefManager.recalculateModuleOrder(modules); // Pass modified array
                console.log("[SidebarManager] Recalculated order for local modules array.");
            } else { console.warn("[SidebarManager] Cannot recalculate order..."); }

            if (typeof ModuleDefManager.saveModuleStructure === 'function') {
                console.log("[SidebarManager] Triggering saveModuleStructure via ModuleDefinitionManager with updated array...");
                ModuleDefManager.saveModuleStructure(modules); // Pass the modified array
            } else { console.error("[SidebarManager] Cannot save structure: save function not found..."); }
        } else { console.error("[SidebarManager] Cannot save structure: ModuleDefinitionManager not found."); }
    }
    function triggerNavigation(moduleId) {
         if (window.ConstructionApp.ModuleUtils && typeof window.ConstructionApp.ModuleUtils.navigateToModule === 'function') {
             window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
         } else { console.error("[SidebarManager] Cannot navigate: navigateToModule function not found..."); }
     }

    // --- Sidebar Rendering ---
    function renderModuleList(moduleData) { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function createModuleElement(moduleData, level = 0) { /* ... logic as in sidebar-manager-js-pass-array ... */ }

    // --- Search ---
    function setupModuleSearch() { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function handleSearchInput() { /* ... logic as in sidebar-manager-js-pass-array ... */ }

    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) { /* ... logic as in sidebar-manager-js-pass-array ... */ }

    // --- Drag and Drop (Keep Debug Logs) ---
    function setupDragAndDrop() { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function handleDragStart(e) { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function handleDragOver(e) { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function handleDragLeave(e) { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function handleDrop(e) { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function handleDragEnd(e) { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function clearDropIndicators(element) { /* ... logic as in sidebar-manager-js-pass-array ... */ }

    // --- Dropdown Menus & Actions (Keep Debug Logs + Escape Handler) ---
    function setupDropdownMenus() { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function handleGlobalClickForDropdowns(e) { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function handleEscapeKey(e) { /* ... logic as in sidebar-manager-js-pass-array ... */ }
    function closeAllDropdowns() { /* ... logic as in sidebar-manager-js-pass-array ... */ }


    // --- Initialization Function ---
    function init(modulesData) {
        // ***** START DEBUG LOGS *****
        console.log("[SidebarManager] DEBUG Init: Entered init function.");
        console.log("[SidebarManager] DEBUG Init: Received modulesData:", modulesData);
        if (!Array.isArray(modulesData)) {
             console.error("[SidebarManager] DEBUG Init: ERROR - modulesData is not an array! Stopping init.");
             return;
        }
        console.log("[SidebarManager] DEBUG Init: modulesData is a valid array.");
        // ***** END DEBUG LOGS *****

        modules = modulesData || []; // Store initial reference
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] Init FAILED - #modules-container not found!");
            return; // Stop if container missing
        }
        console.log("[SidebarManager] DEBUG Init: Found #modules-container."); // Log success

        // Initialize header collapse state
        headerCollapseState = {}; // Reset first
        try {
            console.log("[SidebarManager] DEBUG Init: Starting headerCollapseState loop...");
             modules.forEach(module => {
                 if (module.type === 'header') {
                     if (headerCollapseState[module.id] === undefined) headerCollapseState[module.id] = true; // Default collapsed
                 }
             });
             console.log("[SidebarManager] DEBUG Init: Finished headerCollapseState loop.");
        } catch(loopError) {
             console.error("[SidebarManager] DEBUG Init: ERROR during headerCollapseState loop:", loopError);
             return; // Stop if error in loop
        }


        // Call the actual setup functions
        console.log("[SidebarManager] DEBUG Init: Calling renderModuleList...");
        renderModuleList(modules);      // Initial render
        console.log("[SidebarManager] DEBUG Init: Calling setupModuleSearch...");
        setupModuleSearch();            // Setup search input
        console.log("[SidebarManager] DEBUG Init: Calling setupDropdownMenus...");
        setupDropdownMenus();           // Setup global click listener for dropdowns

        console.log("[SidebarManager] Initialization complete.");
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.SidebarManager = {
        init: init,
        renderModuleList: renderModuleList
    };

})();
