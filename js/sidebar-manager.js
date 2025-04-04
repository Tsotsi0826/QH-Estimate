// js/sidebar-manager.js - Debugging Element Finding in Render/Search
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
        // ***** START DEBUG CHECK *****
        console.log("DEBUG SidebarRender: Attempting render...");
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("DEBUG SidebarRender: FAILED - #modules-container not found!");
            return; // Stop if container missing
        }
        console.log("DEBUG SidebarRender: Found #modules-container.");
        if (!Array.isArray(moduleData)) {
             console.error("DEBUG SidebarRender: FAILED - moduleData is not an array!", moduleData);
             return; // Stop if data invalid
        }
        console.log("DEBUG SidebarRender: moduleData is valid array.");
        // ***** END DEBUG CHECK *****

        modules = moduleData || []; // Update local reference
        container.innerHTML = ''; // Clear existing list
        console.log(`[SidebarManager] Rendering module list with ${modules.length} modules.`); // This should appear now

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
        // ***** START DEBUG CHECK *****
        console.log("DEBUG SidebarSearch: Attempting setup...");
        const searchInput = document.getElementById('module-search-input');
        const container = document.getElementById('modules-container');
        if (!searchInput) {
             console.error("DEBUG SidebarSearch: FAILED - #module-search-input not found!");
             return; // Stop if input missing
        }
        if (!container) {
             console.error("DEBUG SidebarSearch: FAILED - #modules-container not found!");
             return; // Stop if container missing
        }
        console.log("DEBUG SidebarSearch: Found search input and container.");
        // ***** END DEBUG CHECK *****

        let debounceTimer;
        const debounceFilter = (func, delay) => {
             clearTimeout(debounceTimer);
             debounceTimer = setTimeout(func, delay);
        }; // Simplified debounce

         searchInput.removeEventListener('input', handleSearchInput); // Remove previous listener first
         searchInput.addEventListener('input', handleSearchInput);

        console.log("[SidebarManager] Module search setup complete."); // This should appear now
    }

    // Separate handler function for search input
    function handleSearchInput() {
        const searchInput = document.getElementById('module-search-input'); // Re-find inside handler
        const container = document.getElementById('modules-container');
        if (!searchInput || !container) return;

         debounceFilter(() => { // Apply debounce here
             const searchTerm = searchInput.value.toLowerCase().trim();
             console.log("DEBUG SidebarSearch: Filtering with term:", searchTerm); // Log search term
             const allModuleElements = container.querySelectorAll('.module-item');
             if (searchTerm === '') {
                 renderModuleList(modules); return;
             }
             const visibleModuleIds = new Set();
             modules.forEach(module => {
                  const moduleName = module.name.toLowerCase();
                  const isMatch = moduleName.includes(searchTerm);
                  if (isMatch) {
                      visibleModuleIds.add(module.id);
                      let currentParentId = module.parentId;
                      while (currentParentId && currentParentId !== 'null') {
                          visibleModuleIds.add(currentParentId);
                          const parentModule = modules.find(m => m.id === currentParentId);
                          currentParentId = parentModule ? parentModule.parentId : null;
                      }
                  }
             });
             allModuleElements.forEach(moduleEl => {
                 const moduleId = moduleEl.dataset.moduleId;
                 moduleEl.style.display = visibleModuleIds.has(moduleId) ? 'flex' : 'none';
             });
         }, 250);
    }


    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) { /* ... same as before ... */ }

    // --- Drag and Drop ---
    function setupDragAndDrop() { /* ... same as before ... */ }
    function handleDragStart(e) { /* ... same as before ... */ }
    function handleDragOver(e) { /* ... same as before ... */ }
    function handleDragLeave(e) { /* ... same as before ... */ }
    function handleDrop(e) { /* ... same as before ... */ }
    function handleDragEnd(e) { /* ... same as before ... */ }
    function clearDropIndicators(element) { /* ... same as before ... */ }

    // --- Dropdown Menus & Actions ---
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
            return; // Stop if container missing
        }
        headerCollapseState = {};
         modules.forEach(module => { if (module.type === 'header') { if (headerCollapseState[module.id] === undefined) headerCollapseState[module.id] = true; } });

        // Call setup functions
        renderModuleList(modules);      // Should now log or error clearly
        setupModuleSearch();            // Should now log or error clearly
        setupDropdownMenus();           // Setup click outside and Escape key listeners

        console.log("[SidebarManager] Initialization complete.");
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.SidebarManager = {
        init: init,
        renderModuleList: renderModuleList
    };

})();
