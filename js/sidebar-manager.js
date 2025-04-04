// js/sidebar-manager.js - Pass locally modified array to ModuleDefinitionManager
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

    /**
     * Recalculates order and saves the module structure by calling ModuleDefinitionManager,
     * PASSING the locally modified 'modules' array.
     */
    function triggerSaveStructure() {
        const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
        if (ModuleDefManager) {
            // Recalculate order on the locally modified array first
            if (typeof ModuleDefManager.recalculateModuleOrder === 'function') {
                // Pass the sidebar's current 'modules' array to be recalculated
                ModuleDefManager.recalculateModuleOrder(modules);
                console.log("[SidebarManager] Recalculated order for local modules array.");
            } else { console.warn("[SidebarManager] Cannot recalculate order..."); }

            // Pass the sidebar's (now reordered and order-recalculated) 'modules' array to be saved
            if (typeof ModuleDefManager.saveModuleStructure === 'function') {
                console.log("[SidebarManager] Triggering saveModuleStructure via ModuleDefinitionManager with updated array...");
                ModuleDefManager.saveModuleStructure(modules); // Pass the modified array
            } else { console.error("[SidebarManager] Cannot save structure: save function not found..."); }
        } else { console.error("[SidebarManager] Cannot save structure: ModuleDefinitionManager not found."); }
    }

    function triggerNavigation(moduleId) { /* ... same ... */ }

    // --- Sidebar Rendering ---
    function renderModuleList(moduleData) { /* ... same ... */ }
    function createModuleElement(moduleData, level = 0) { /* ... same ... */ }

    // --- Search ---
    function setupModuleSearch() { /* ... same ... */ }
    function handleSearchInput() { /* ... same ... */ }

    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) { /* ... same ... */ }

    // --- Drag and Drop (Keep Debug Logs) ---
    function setupDragAndDrop() { /* ... same ... */ }
    function handleDragStart(e) { /* ... same ... */ }
    function handleDragOver(e) { /* ... same ... */ }
    function handleDragLeave(e) { /* ... same ... */ }
    function handleDrop(e) {
        console.log("DEBUG DND: handleDrop Fired");
        e.preventDefault();
        if (!globalDraggedItem || !dragOverElement || !dropIndicator) { /* ... */ handleDragEnd(); return; }
        clearDropIndicators();

        const draggedId = globalDraggedItem.dataset.moduleId;
        const targetId = dragOverElement.dataset.moduleId;
        const draggedModuleIndex = modules.findIndex(m => m.id === draggedId);
        const targetModuleIndex = modules.findIndex(m => m.id === targetId);
        if (draggedModuleIndex === -1 || targetModuleIndex === -1) { /* ... */ handleDragEnd(); return; }
        const draggedModule = modules[draggedModuleIndex];
        const targetModule = modules[targetModuleIndex];
        let newParentId = null;
        let targetPositionInArray = -1;
        // --- Determine new parent and position ---
        if (dropIndicator === 'middle' && targetModule.type === 'header') { /* ... */ }
        else if (dropIndicator === 'bottom') { /* ... */ }
        else { /* dropIndicator === 'top' */ /* ... */ }
        // --- End determination ---
        console.log(`DEBUG DND: Drop - Moving ${draggedId} to parent ${newParentId} at index ${targetPositionInArray}`);

        // --- Update local 'modules' array directly ---
        draggedModule.parentId = newParentId;
        modules.splice(draggedModuleIndex, 1);
        if (draggedModuleIndex < targetPositionInArray) targetPositionInArray--;
        modules.splice(targetPositionInArray, 0, draggedModule);
        // --- End local update ---

        renderModuleList(modules); // Re-render sidebar with locally modified array

        // Trigger save - THIS NOW PASSES THE MODIFIED ARRAY TO THE MANAGER
        triggerSaveStructure();

        // Trigger dashboard render
        console.log("[SidebarManager] Triggering dashboard render after drop.");
        const currentClient = window.ConstructionApp.ClientManager?.getCurrentClient();
        window.ConstructionApp.DashboardRenderer?.render(currentClient);

        handleDragEnd();
    }
    function handleDragEnd(e) { /* ... same ... */ }
    function clearDropIndicators(element) { /* ... same ... */ }

    // --- Dropdown Menus & Actions (Keep Debug Logs + Escape Handler) ---
    function setupDropdownMenus() { /* ... same ... */ }
    function handleGlobalClickForDropdowns(e) { /* ... same ... */ }
    function handleEscapeKey(e) { /* ... same ... */ }
    function closeAllDropdowns() { /* ... same ... */ }

    // --- Initialization Function ---
    function init(modulesData) { /* ... same ... */ }

    // --- Expose Public Interface ---
    window.ConstructionApp.SidebarManager = {
        init: init,
        renderModuleList: renderModuleList
    };

})();
