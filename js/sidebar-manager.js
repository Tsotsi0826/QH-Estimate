// js/sidebar-manager.js - Cleaned element debug logs, kept D&D/Dropdown logs
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
    function triggerSaveStructure() { /* ... */ }
    function triggerNavigation(moduleId) { /* ... */ }

    // --- Sidebar Rendering ---

    /**
     * Renders the hierarchical list of modules in the sidebar.
     * @param {Array} moduleData - The array of module objects to render.
     */
    function renderModuleList(moduleData) {
        // Removed debug checks for elements here
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] FAILED - #modules-container not found!");
            return;
        }
        if (!Array.isArray(moduleData)) {
             console.error("[SidebarManager] FAILED - moduleData is not an array!", moduleData);
             return;
        }

        modules = moduleData || []; // Update local reference
        container.innerHTML = ''; // Clear existing list
        console.log(`[SidebarManager] Rendering module list with ${modules.length} modules.`); // Keep this log

        const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

        function renderLevel(parentId, level) {
            sortedModules
                .filter(m => m.parentId === parentId)
                .forEach(module => {
                    const moduleElement = createModuleElement(module, level);
                    if (moduleElement) {
                        container.appendChild(moduleElement);
                        const isHeader = module.type === 'header';
                        const isCollapsed = headerCollapseState[module.id] === true;
                        if (!isHeader || !isCollapsed) {
                            renderLevel(module.id, level + 1);
                        }
                    }
                });
        }
        renderLevel(null, 0);
        setupDragAndDrop(); // Re-attach D&D listeners after re-rendering
    }

    /**
     * Creates a single module list item element for the sidebar.
     * @param {object} moduleData - The module object.
     * @param {number} level - The nesting level.
     * @returns {HTMLElement|null} The created div element or null if data is invalid.
     */
    function createModuleElement(moduleData, level = 0) { /* ... same as before ... */ }

    // --- Search ---
    function setupModuleSearch() {
        // Removed debug checks for elements here
        const searchInput = document.getElementById('module-search-input');
        const container = document.getElementById('modules-container');
        if (!searchInput) {
             console.error("[SidebarManager] FAILED - #module-search-input not found!");
             return;
        }
        if (!container) {
             console.error("[SidebarManager] FAILED - #modules-container not found!");
             return;
        }

        let debounceTimer;
        const debounceFilter = (func, delay) => { /* ... */ return func; }; // Simplified

         searchInput.removeEventListener('input', handleSearchInput);
         searchInput.addEventListener('input', handleSearchInput);

        console.log("[SidebarManager] Module search setup complete.");
    }

    // Separate handler function for search input
    function handleSearchInput() { /* ... same as before ... */ }


    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) { /* ... same as before ... */ }

    // --- Drag and Drop (Keep Debug Logs) ---
    function setupDragAndDrop() { /* ... same as before ... */ }
    function handleDragStart(e) { /* ... same as before ... */ }
    function handleDragOver(e) { /* ... same as before ... */ }
    function handleDragLeave(e) { /* ... same as before ... */ }
    function handleDrop(e) { /* ... same as before ... */ }
    function handleDragEnd(e) { /* ... same as before ... */ }
    function clearDropIndicators(element) { /* ... same as before ... */ }

    // --- Dropdown Menus & Actions (Keep Debug Logs + Escape Handler) ---
    function setupDropdownMenus() { /* ... same as before ... */ }
    function handleGlobalClickForDropdowns(e) { /* ... same as before ... */ }
    function handleEscapeKey(e) { /* ... same as before ... */ }
    function closeAllDropdowns() { /* ... same as before ... */ }


    // --- Initialization Function ---
    function init(modulesData) {
        console.log("[SidebarManager] Initializing...");
        modules = modulesData || [];
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] Sidebar container #modules-container not found during init! Cannot proceed.");
            return;
        }
        headerCollapseState = {};
         modules.forEach(module => { if (module.type === 'header') { if (headerCollapseState[module.id] === undefined) headerCollapseState[module.id] = true; } });

        // Call setup functions
        renderModuleList(modules);
        setupModuleSearch();
        setupDropdownMenus();

        console.log("[SidebarManager] Initialization complete.");
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.SidebarManager = {
        init: init,
        renderModuleList: renderModuleList
    };

})();
