// js/sidebar-manager.js - Debugging Listener Attachment
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let headerCollapseState = {};
    let globalDraggedItem = null;
    let dragOverElement = null;
    let dropIndicator = null;
    let modules = [];

    // --- Helper Functions ---
    function triggerSaveStructure() { /* ... */ }
    function triggerNavigation(moduleId) { /* ... */ }

    // --- Sidebar Rendering ---
    function renderModuleList(moduleData) {
        const container = document.getElementById('modules-container');
        if (!container) { /* ... error ... */ return; }
        if (!Array.isArray(moduleData)) { /* ... error ... */ return; }
        modules = moduleData || [];
        container.innerHTML = '';
        console.log(`[SidebarManager] Rendering module list with ${modules.length} modules.`);
        const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));
        function renderLevel(parentId, level) {
            const children = sortedModules.filter(m => m.parentId === parentId);
            children.forEach((module, index) => {
                const moduleElement = createModuleElement(module, level); // createModuleElement now adds listeners
                if (moduleElement) {
                    container.appendChild(moduleElement);
                } else {
                     console.error(`DEBUG SidebarRenderLoop: createModuleElement returned null for module ID: ${module.id}`);
                }
            });
        }
        renderLevel(null, 0);
        console.log("[SidebarManager] Finished rendering loop.");
        setupDragAndDrop(); // Setup D&D listeners for the container
    }

    /**
     * Creates element and ATTACHES LISTENERS.
     */
    function createModuleElement(moduleData, level = 0) {
        if (!moduleData || !moduleData.id || typeof moduleData.name === 'undefined') { /* ... error ... */ return null; }
        const moduleElement = document.createElement('div');
        // ... set attributes, classes, draggable ...
        moduleElement.className = 'module-item';
        moduleElement.draggable = true;
        moduleElement.setAttribute('data-module-id', moduleData.id);
        // ... other attributes ...
        moduleElement.setAttribute('data-level', level);


        let collapseIconHTML = '';
        if (moduleData.type === 'header') { /* ... */ }
        const configIcon = !moduleData.requiresClient ? ' <span title="Configuration Module" style="opacity: 0.7; margin-left: 5px;">⚙️</span>' : '';
        const moduleNameSpan = document.createElement('span');
        moduleNameSpan.className = 'module-name';
        moduleNameSpan.textContent = moduleData.name;

        moduleElement.innerHTML = `
            <div class="module-drag-handle" title="Drag to reorder">≡</div>
            ${collapseIconHTML}
            <div class="module-icon" title="Actions">
                ...
                <div class="dropdown-menu">
                    <div class="dropdown-item edit-module">Edit</div>
                    <div class="dropdown-item delete-module">Delete</div>
                </div>
            </div>
            ${configIcon}
        `;
        const iconElement = moduleElement.querySelector('.module-icon');
        if (iconElement) iconElement.after(moduleNameSpan);
        else moduleElement.insertBefore(moduleNameSpan, moduleElement.querySelector('.config-icon'));


        // --- Attach Event Listeners ---
        const icon = moduleElement.querySelector('.module-icon');
        if (icon) {
            console.log(`DEBUG ListenerSetup: Attaching click listener to icon for ${moduleData.id}`); // Log attachment
            icon.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Icon clicked for ${moduleData.id}`); // Log execution
                e.stopPropagation();
                const dropdown = icon.querySelector('.dropdown-menu');
                if (dropdown) {
                    const isVisible = dropdown.style.display === 'block';
                    closeAllDropdowns();
                    if (!isVisible) dropdown.style.display = 'block';
                }
            });
        } else { console.warn(`DEBUG ListenerSetup: Could not find .module-icon for ${moduleData.id}`); }

        const editBtn = moduleElement.querySelector('.edit-module');
        if (editBtn) {
             console.log(`DEBUG ListenerSetup: Attaching click listener to edit for ${moduleData.id}`); // Log attachment
             editBtn.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Edit clicked for ${moduleData.id}`); // Log execution
                e.stopPropagation();
                closeAllDropdowns(); // Try closing first
                const moduleId = moduleElement.dataset.moduleId;
                // ... (rest of edit logic calling ModuleDefManager) ...
                alert(`Placeholder: Edit action for ${moduleId}`); // Simplified handler
            });
        } else { console.warn(`DEBUG ListenerSetup: Could not find .edit-module for ${moduleData.id}`); }

        const deleteBtn = moduleElement.querySelector('.delete-module');
        if (deleteBtn) {
             console.log(`DEBUG ListenerSetup: Attaching click listener to delete for ${moduleData.id}`); // Log attachment
             deleteBtn.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Delete clicked for ${moduleData.id}`); // Log execution
                e.stopPropagation();
                closeAllDropdowns(); // Try closing first
                const moduleId = moduleElement.dataset.moduleId;
                // ... (rest of delete logic calling ModuleDefManager) ...
                alert(`Placeholder: Delete action for ${moduleId}`); // Simplified handler
            });
        } else { console.warn(`DEBUG ListenerSetup: Could not find .delete-module for ${moduleData.id}`); }

        if (moduleNameSpan && moduleData.type !== 'header') {
             console.log(`DEBUG ListenerSetup: Attaching click listener to name for ${moduleData.id}`); // Log attachment
             moduleNameSpan.addEventListener('click', () => {
                 console.log(`DEBUG ActionClick: Name clicked for ${moduleData.id}`); // Log execution
                 triggerNavigation(moduleData.id);
             });
        }

        if (moduleData.type === 'header') {
             const collapseTarget = moduleElement.querySelector('.collapse-icon') || moduleNameSpan || moduleElement;
             if (collapseTarget) {
                 console.log(`DEBUG ListenerSetup: Attaching click listener to collapse for ${moduleData.id}`); // Log attachment
                 collapseTarget.addEventListener('click', (e) => {
                     console.log(`DEBUG ActionClick: Collapse target clicked for ${moduleData.id}`); // Log execution
                     if (!e.target.closest('.module-icon') && !e.target.closest('.module-drag-handle')) {
                         handleCollapseToggle(moduleData.id);
                     }
                 });
             } else { console.warn(`DEBUG ListenerSetup: Could not find collapse target for ${moduleData.id}`); }
         }

        return moduleElement;
    }

    // --- Search ---
    function setupModuleSearch() { /* ... */ }
    function handleSearchInput() { /* ... */ }

    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) { /* ... */ }

    // --- Drag and Drop (Simplified Handlers) ---
    function setupDragAndDrop() {
        const container = document.getElementById('modules-container');
        if (!container) return;
        container.removeEventListener('dragstart', handleDragStart);
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('dragleave', handleDragLeave);
        container.removeEventListener('drop', handleDrop);
        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
        document.removeEventListener('dragend', handleDragEnd);
        document.addEventListener('dragend', handleDragEnd);
        console.log("[SidebarManager] Drag and drop listeners setup.");
    }

    function handleDragStart(e) {
        console.log("DEBUG DND: handleDragStart Fired"); // Log execution
        const target = e.target.closest('.module-item');
        if (!target || !target.draggable) { e.preventDefault(); return; }
        globalDraggedItem = target;
        try {
             e.dataTransfer.setData('text/plain', target.dataset.moduleId);
             e.dataTransfer.effectAllowed = 'move';
             setTimeout(() => { if (globalDraggedItem) globalDraggedItem.classList.add('dragging'); }, 0);
        } catch (err) { console.error("DEBUG DND: Error setting dataTransfer:", err); }
    }

    function handleDragOver(e) {
        // console.log("DEBUG DND: handleDragOver Fired"); // Still too noisy
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Simplified visual indication for debugging
        const targetElement = e.target.closest('.module-item');
        if (targetElement && targetElement !== globalDraggedItem) {
             clearDropIndicators(); // Clear others
             targetElement.classList.add('drag-over-bottom'); // Just add one indicator
             dragOverElement = targetElement; // Track element being dragged over
             dropIndicator = 'bottom'; // Assume bottom drop for simplicity now
        } else if (dragOverElement) {
             clearDropIndicators(); // Clear if not over a valid target
             dragOverElement = null;
             dropIndicator = null;
        }
    }

    function handleDragLeave(e) {
        // console.log("DEBUG DND: handleDragLeave Fired"); // Noisy
        clearDropIndicators(); // Simplify: clear indicators on any leave
        dragOverElement = null;
        dropIndicator = null;
    }

    function handleDrop(e) {
        console.log("DEBUG DND: handleDrop Fired"); // Log execution
        e.preventDefault();
        if (!globalDraggedItem || !dragOverElement || !dropIndicator) {
             console.log("DEBUG DND: Drop cancelled: Invalid state.");
             clearDropIndicators(); handleDragEnd(); return;
        }
        const draggedId = globalDraggedItem.dataset.moduleId;
        const targetId = dragOverElement.dataset.moduleId;
        console.log(`DEBUG DND: Drop detected - Dragged: ${draggedId}, Target: ${targetId}, Indicator: ${dropIndicator}`);
        // --- Temporarily disable actual reordering ---
        alert(`Placeholder: Drop ${draggedId} onto ${targetId} (${dropIndicator})`);
        // --- End temporary disable ---
        clearDropIndicators();
        handleDragEnd();
    }

    function handleDragEnd(e) {
        console.log("DEBUG DND: handleDragEnd Fired"); // Log execution
        try { if (globalDraggedItem) { globalDraggedItem.classList.remove('dragging'); } }
        catch (error) { /* ... */ }
        clearDropIndicators();
        globalDraggedItem = null;
        dragOverElement = null;
        dropIndicator = null;
    }

    function clearDropIndicators(element) {
         const selector = '.module-item.drag-over-top, .module-item.drag-over-bottom, .module-item.drag-over-middle';
         const elementsToClear = element ? [element] : document.querySelectorAll(selector);
         elementsToClear.forEach(el => { if (el) el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle'); });
     }

    // --- Dropdown Menus & Actions (Simplified Handlers) ---
    function setupDropdownMenus() {
        document.removeEventListener('click', handleGlobalClickForDropdowns);
        document.addEventListener('click', handleGlobalClickForDropdowns);
        document.removeEventListener('keydown', handleEscapeKey);
        document.addEventListener('keydown', handleEscapeKey);
        console.log("[SidebarManager] Dropdown menu listeners setup (Click & Escape).");
    }

    function handleGlobalClickForDropdowns(e) {
        console.log("DEBUG Dropdown: Global click detected.");
        if (!e.target.closest('.module-icon') && !e.target.closest('.dropdown-menu')) {
            console.log("DEBUG Dropdown: Click was outside, closing menus.");
            closeAllDropdowns();
        } else {
            console.log("DEBUG Dropdown: Click was inside icon or menu, not closing.");
        }
    }

    function handleEscapeKey(e) {
        if (e.key === 'Escape') {
            console.log("DEBUG Dropdown: Escape key pressed, closing menus.");
            closeAllDropdowns();
        }
    }

    function closeAllDropdowns() {
        const menus = document.querySelectorAll('#modules-container .dropdown-menu');
        let closedAny = false;
        menus.forEach(menu => {
            if (menu.style.display === 'block') {
                menu.style.display = 'none';
                closedAny = true;
            }
        });
        if (closedAny) {
             console.log("DEBUG Dropdown: closeAllDropdowns executed and closed at least one menu.");
        } else {
             console.log("DEBUG Dropdown: closeAllDropdowns executed, no menus were open.");
        }
    }


    // --- Initialization Function ---
    function init(modulesData) {
        console.log("[SidebarManager] Initializing...");
        modules = modulesData || [];
        const container = document.getElementById('modules-container');
        if (!container) { /* ... error ... */ return; }
        headerCollapseState = {};
         modules.forEach(module => { if (module.type === 'header') { if (headerCollapseState[module.id] === undefined) headerCollapseState[module.id] = true; } });
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
