// js/sidebar-manager.js - Restore D&D, Edit, Delete Logic + Keep Debug Logs
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
    function triggerSaveStructure() {
        const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
        if (ModuleDefManager) {
            if (typeof ModuleDefManager.recalculateModuleOrder === 'function') {
                ModuleDefManager.recalculateModuleOrder(); // Recalculates based on 'modules' array
            } else { console.warn("[SidebarManager] Cannot recalculate order..."); }
            if (typeof ModuleDefManager.saveModuleStructure === 'function') {
                console.log("[SidebarManager] Triggering saveModuleStructure via ModuleDefinitionManager...");
                ModuleDefManager.saveModuleStructure();
            } else { console.error("[SidebarManager] Cannot save structure: save function not found..."); }
        } else { console.error("[SidebarManager] Cannot save structure: ModuleDefinitionManager not found."); }
    }
    function triggerNavigation(moduleId) { /* ... same ... */ }

    // --- Sidebar Rendering ---
    function renderModuleList(moduleData) { /* ... same ... */ }

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
        moduleElement.setAttribute('data-requires-client', moduleData.requiresClient ? 'true' : 'false');
        moduleElement.setAttribute('data-module-type', moduleData.type || 'regular');
        moduleElement.setAttribute('data-parent-id', moduleData.parentId || 'null');
        moduleElement.setAttribute('data-level', level);

        let collapseIconHTML = '';
        if (moduleData.type === 'header') { /* ... add class, icon ... */ }
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
            // console.log(`DEBUG ListenerSetup: Attaching click listener to icon for ${moduleData.id}`);
            icon.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Icon clicked for ${moduleData.id}`);
                e.stopPropagation();
                const dropdown = icon.querySelector('.dropdown-menu');
                if (dropdown) {
                    const isVisible = dropdown.style.display === 'block';
                    closeAllDropdowns();
                    if (!isVisible) dropdown.style.display = 'block';
                }
            });
        } // else { console.warn(`DEBUG ListenerSetup: Could not find .module-icon for ${moduleData.id}`); }

        const editBtn = moduleElement.querySelector('.edit-module');
        if (editBtn) {
             // console.log(`DEBUG ListenerSetup: Attaching click listener to edit for ${moduleData.id}`);
             editBtn.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Edit clicked for ${moduleData.id}`);
                e.stopPropagation();
                // Try closing dropdown FIRST
                closeAllDropdowns();
                // Now perform edit action
                const moduleId = moduleElement.dataset.moduleId;
                const currentModule = modules.find(m => m.id === moduleId);
                if (!currentModule) { alert("Error: Cannot find module data to edit."); return; }
                const currentName = currentModule.name;
                const newName = prompt(`Edit module name:`, currentName); // Still using prompt

                if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
                    const finalNewName = newName.trim();
                    if (window.ConstructionApp.ModuleDefinitionManager) {
                         const success = window.ConstructionApp.ModuleDefinitionManager.editModuleDefinition(moduleId, { name: finalNewName });
                         if (success) alert(`Module renamed to "${finalNewName}"`);
                         else alert(`Failed to rename module.`);
                    } else alert("Error: Module Definition Manager not available.");
                }
            });
        } // else { console.warn(`DEBUG ListenerSetup: Could not find .edit-module for ${moduleData.id}`); }

        const deleteBtn = moduleElement.querySelector('.delete-module');
        if (deleteBtn) {
             // console.log(`DEBUG ListenerSetup: Attaching click listener to delete for ${moduleData.id}`);
             deleteBtn.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Delete clicked for ${moduleData.id}`);
                e.stopPropagation();
                 // Try closing dropdown FIRST
                closeAllDropdowns();
                // Now perform delete action
                const moduleId = moduleElement.dataset.moduleId;
                const currentModule = modules.find(m => m.id === moduleId);
                if (!currentModule) { alert("Error: Cannot find module data to delete."); return; }
                const moduleName = currentModule.name;
                const isHeader = currentModule.type === 'header';
                const directChildren = modules.filter(m => m.parentId === moduleId);
                let confirmMessage = `Are you sure you want to delete the "${moduleName}" module?`;
                if (isHeader && directChildren.length > 0) confirmMessage += `\n\nWARNING: This will also delete ALL descendants.`;
                confirmMessage += `\n\nThis action cannot be undone.`;
                const confirmed = confirm(confirmMessage);
                 if (confirmed) {
                     if (window.ConstructionApp.ModuleDefinitionManager) {
                          const success = window.ConstructionApp.ModuleDefinitionManager.deleteModuleDefinition(moduleId);
                          if (success) alert(`Module "${moduleName}" ${isHeader && directChildren.length > 0 ? 'and its descendants ' : ''}deleted successfully.`);
                          else alert(`Failed to delete module "${moduleName}".`);
                     } else alert("Error: Module Definition Manager not available.");
                 }
            });
        } // else { console.warn(`DEBUG ListenerSetup: Could not find .delete-module for ${moduleData.id}`); }

        if (moduleNameSpan && moduleData.type !== 'header') {
             // console.log(`DEBUG ListenerSetup: Attaching click listener to name for ${moduleData.id}`);
             moduleNameSpan.addEventListener('click', () => {
                 console.log(`DEBUG ActionClick: Name clicked for ${moduleData.id}`);
                 triggerNavigation(moduleData.id);
             });
        }

        if (moduleData.type === 'header') {
             const collapseTarget = moduleElement.querySelector('.collapse-icon') || moduleNameSpan || moduleElement;
             if (collapseTarget) {
                 // console.log(`DEBUG ListenerSetup: Attaching click listener to collapse for ${moduleData.id}`);
                 collapseTarget.addEventListener('click', (e) => {
                     console.log(`DEBUG ActionClick: Collapse target clicked for ${moduleData.id}`);
                     if (!e.target.closest('.module-icon') && !e.target.closest('.module-drag-handle')) {
                         handleCollapseToggle(moduleData.id);
                     }
                 });
             } // else { console.warn(`DEBUG ListenerSetup: Could not find collapse target for ${moduleData.id}`); }
         }

        return moduleElement;
    }

    // --- Search ---
    function setupModuleSearch() { /* ... same ... */ }
    function handleSearchInput() { /* ... same ... */ }

    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) { /* ... same ... */ }

    // --- Drag and Drop (Restored Logic) ---
    function setupDragAndDrop() { /* ... same ... */ }
    function handleDragStart(e) { /* ... same ... */ }
    function handleDragOver(e) { /* ... same ... */ }
    function handleDragLeave(e) { /* ... same ... */ }

    /**
     * Handles the drop event, updates module order/parent, re-renders sidebar,
     * triggers save, AND triggers dashboard render. LOGIC RESTORED.
     */
    function handleDrop(e) {
        console.log("DEBUG DND: handleDrop Fired");
        e.preventDefault();
        if (!globalDraggedItem || !dragOverElement || !dropIndicator) {
             console.log("DEBUG DND: Drop cancelled: Invalid state.");
             clearDropIndicators(); handleDragEnd(); return;
        }
        clearDropIndicators(); // Clear visual cues immediately

        const draggedId = globalDraggedItem.dataset.moduleId;
        const targetId = dragOverElement.dataset.moduleId;
        const draggedModuleIndex = modules.findIndex(m => m.id === draggedId);
        const targetModuleIndex = modules.findIndex(m => m.id === targetId);
        if (draggedModuleIndex === -1 || targetModuleIndex === -1) {
            console.error("DEBUG DND: Drop Error: Dragged or target module not found."); handleDragEnd(); return;
        }
        const draggedModule = modules[draggedModuleIndex];
        const targetModule = modules[targetModuleIndex];
        let newParentId = null;
        let targetPositionInArray = -1;

        // --- Determine new parent and position ---
        if (dropIndicator === 'middle' && targetModule.type === 'header') {
            // Dropping INTO a header
            newParentId = targetModule.id;
            const children = modules.filter(m => m.parentId === newParentId);
            if (children.length > 0) {
                const lastChild = children.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).pop();
                const lastChildIndex = modules.findIndex(m => m.id === lastChild.id);
                targetPositionInArray = lastChildIndex + 1;
            } else {
                targetPositionInArray = targetModuleIndex + 1;
            }
        } else if (dropIndicator === 'bottom') {
            // Dropping BELOW the target item (same parent)
            newParentId = targetModule.parentId;
            targetPositionInArray = targetModuleIndex + 1;
        } else { // dropIndicator === 'top'
            // Dropping ABOVE the target item (same parent)
            newParentId = targetModule.parentId;
            targetPositionInArray = targetModuleIndex;
        }
        // --- End determination ---

        console.log(`DEBUG DND: Drop - Moving ${draggedId} to parent ${newParentId} at index ${targetPositionInArray}`);

        // --- Update local 'modules' array directly --- RESTORED
        draggedModule.parentId = newParentId;
        modules.splice(draggedModuleIndex, 1);
        if (draggedModuleIndex < targetPositionInArray) targetPositionInArray--;
        modules.splice(targetPositionInArray, 0, draggedModule);
        // --- End local update ---

        // Re-render the sidebar list immediately for visual feedback
        renderModuleList(modules);

        // Trigger save via ModuleDefinitionManager (which recalculates order first)
        triggerSaveStructure();

        // Trigger dashboard render
        console.log("[SidebarManager] Triggering dashboard render after drop.");
        const currentClient = window.ConstructionApp.ClientManager?.getCurrentClient();
        window.ConstructionApp.DashboardRenderer?.render(currentClient);

        // Clean up D&D state
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
