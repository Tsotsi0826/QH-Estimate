// js/sidebar-manager.js - Updated: Calls DashboardRenderer after drop
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let headerCollapseState = {};
    let globalDraggedItem = null;
    let dragOverElement = null;
    let dropIndicator = null;
    let modules = []; // Local reference

    // --- Helper Functions ---

    /**
     * Saves the module structure by calling ModuleDefinitionManager.
     */
    function triggerSaveStructure() {
        const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
        if (ModuleDefManager) {
            // D&D already updated the local 'modules' array order.
            // Recalculate the .order property based on the new array order.
            ModuleDefManager.recalculateModuleOrder(); // Assumes this modifies the shared 'modules' array reference
            console.log("[SidebarManager] Triggering saveModuleStructure via ModuleDefinitionManager...");
            ModuleDefManager.saveModuleStructure();
        } else {
            console.error("[SidebarManager] Cannot save structure: ModuleDefinitionManager not found.");
        }
    }

    /**
     * Navigates to a module page using ModuleUtils.
     */
     function triggerNavigation(moduleId) { /* ... same as before ... */ }

    // --- Sidebar Rendering ---

    /**
     * Renders the hierarchical list of modules in the sidebar.
     * @param {Array} moduleData - The array of module objects to render.
     */
    function renderModuleList(moduleData) { /* ... same as before ... */ }

    /**
     * Creates a single module list item element for the sidebar.
     * @param {object} moduleData - The module object.
     * @param {number} level - The nesting level.
     * @returns {HTMLElement} The created div element.
     */
    function createModuleElement(moduleData, level = 0) { /* ... same as before, including edit/delete listeners calling ModuleDefManager ... */ }

    // --- Search ---
    function setupModuleSearch() { /* ... same as before ... */ }

    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) { /* ... same as before ... */ }

    // --- Drag and Drop ---

    function setupDragAndDrop() { /* ... same as before ... */ }
    function handleDragStart(e) { /* ... same as before ... */ }
    function handleDragOver(e) { /* ... same as before ... */ }
    function handleDragLeave(e) { /* ... same as before ... */ }

    /**
     * Handles the drop event, updates module order/parent, re-renders sidebar,
     * triggers save, AND NOW triggers dashboard render.
     */
    function handleDrop(e) {
        e.preventDefault();
        clearDropIndicators();

        if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) {
            handleDragEnd(); return;
        }

        const draggedId = globalDraggedItem.dataset.moduleId;
        const targetId = dragOverElement.dataset.moduleId;
        const draggedModuleIndex = modules.findIndex(m => m.id === draggedId);
        const targetModuleIndex = modules.findIndex(m => m.id === targetId);

        if (draggedModuleIndex === -1 || targetModuleIndex === -1) {
            console.error("[SidebarManager] DnD Error: Dragged or target module not found."); handleDragEnd(); return;
        }

        const draggedModule = modules[draggedModuleIndex];
        const targetModule = modules[targetModuleIndex];
        let newParentId = null;
        let targetPositionInArray = -1;

        // --- Determine new parent and position ---
        if (dropIndicator === 'middle' && targetModule.type === 'header') { /* ... logic ... */ }
        else if (dropIndicator === 'bottom') { /* ... logic ... */ }
        else { /* dropIndicator === 'top' */ /* ... logic ... */ }
        // --- End determination ---

        console.log(`[SidebarManager] Drop: Moving ${draggedId} to parent ${newParentId} at index ${targetPositionInArray}`);

        // --- Update local 'modules' array directly ---
        draggedModule.parentId = newParentId;
        modules.splice(draggedModuleIndex, 1);
        if (draggedModuleIndex < targetPositionInArray) targetPositionInArray--;
        modules.splice(targetPositionInArray, 0, draggedModule);
        // --- End local update ---

        // Re-render the sidebar list immediately for visual feedback
        renderModuleList(modules);

        // Trigger save via ModuleDefinitionManager (which recalculates order first)
        triggerSaveStructure();

        // ***** ADDED CODE START *****
        // After sidebar is updated and save is triggered, re-render the dashboard tiles
        console.log("[SidebarManager] Triggering dashboard render after drop.");
        const currentClient = window.ConstructionApp.ClientManager?.getCurrentClient();
        window.ConstructionApp.DashboardRenderer?.render(currentClient);
        // ***** ADDED CODE END *****

        // Clean up D&D state
        handleDragEnd();
    }

    function handleDragEnd(e) { /* ... same as before ... */ }
    function clearDropIndicators(element) { /* ... same as before ... */ }
    // recalculateModuleOrder is MOVED to ModuleDefinitionManager

    // --- Dropdown Menus & Actions ---

    function setupDropdownMenus() { /* ... same as before ... */ }
    function handleGlobalClickForDropdowns(e) { /* ... same as before ... */ }
    function closeAllDropdowns() { /* ... same as before ... */ }
    // editModule and deleteModule logic is MOVED to ModuleDefinitionManager (called from createModuleElement listeners)


    // --- Initialization Function ---
    function init(modulesData) { /* ... same as before ... */ }

    // --- Expose Public Interface ---
    window.ConstructionApp.SidebarManager = {
        init: init,
        renderModuleList: renderModuleList
    };

})();
