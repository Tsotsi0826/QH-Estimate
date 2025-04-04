// js/module-definition-manager.js - UPDATED VERSION (Triggers Dashboard Render)
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let modules = []; // Holds the master list of module definitions managed by this file

    // --- Private Functions (Moved or Internal Helpers) ---

    /**
     * Saves the current module structure (from the local 'modules' array)
     * to Firebase and sessionStorage backup.
     */
    async function saveModuleStructure() {
        console.log("[ModuleDefManager] Saving module structure");
        const modulesToSave = modules.map(module => ({
            id: module.id,
            name: module.name,
            requiresClient: module.requiresClient,
            type: module.type || 'regular',
            parentId: module.parentId,
            order: module.order ?? 0
        }));
        console.log("[ModuleDefManager] Modules prepared for saving:", modulesToSave.length);
        let firebaseSuccess = false;
        if (window.ConstructionApp && window.ConstructionApp.Firebase) {
            try {
                firebaseSuccess = await window.ConstructionApp.Firebase.saveModules(modulesToSave);
                if (firebaseSuccess) {
                    console.log("[ModuleDefManager] Module structure saved to Firebase.");
                } else {
                     console.warn("[ModuleDefManager] Firebase.saveModules reported failure (but promise resolved).");
                }
            } catch (error) {
                 console.error("[ModuleDefManager] Error saving module structure to Firebase:", error);
                 firebaseSuccess = false;
            }
        } else {
            console.warn("[ModuleDefManager] Firebase not available, cannot save structure to Firebase.");
        }
        try {
            sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
            console.log("[ModuleDefManager] Module structure backup saved to sessionStorage.");
        } catch (storageError) {
            console.error("[ModuleDefManager] Error saving structure backup to sessionStorage:", storageError);
        }
        return firebaseSuccess;
    }

    /**
     * Gets the default set of modules.
     */
    function getDefaultModules() {
        console.log("[ModuleDefManager] Providing default module set.");
        return [
            { id: 'notes', name: 'Notes', requiresClient: true, type: 'regular', parentId: null, order: 0 },
            { id: 'p-and-gs', name: 'P&G\'s', requiresClient: true, type: 'regular', parentId: null, order: 1 },
            { id: 'foundations', name: 'Foundations', requiresClient: false, type: 'header', parentId: null, order: 2 },
            { id: 'earthworks', name: 'Earthworks', requiresClient: true, type: 'regular', parentId: 'foundations', order: 0 },
            { id: 'concrete', name: 'Concrete', requiresClient: true, type: 'regular', parentId: 'foundations', order: 1 },
            { id: 'steel', name: 'Steel', requiresClient: true, type: 'regular', parentId: 'foundations', order: 2 },
            { id: 'structure', name: 'Structure', requiresClient: false, type: 'header', parentId: null, order: 3 },
            { id: 'brickwork', name: 'Brickwork', requiresClient: true, type: 'regular', parentId: 'structure', order: 0 },
            { id: 'demolish', name: 'Demolish', requiresClient: true, type: 'regular', parentId: null, order: 4 },
            { id: 'ceilings', name: 'Ceilings', requiresClient: true, type: 'regular', parentId: null, order: 5 },
        ];
    }

     /**
       * Restores the module structure from sessionStorage backup.
       */
     function restoreModuleOrderFromBackup() {
         const savedOrder = sessionStorage.getItem('moduleOrder');
         if (savedOrder) {
             try {
                 const orderData = JSON.parse(savedOrder);
                 if (!Array.isArray(orderData)) { throw new Error("Backup data is not an array."); }
                 console.log("[ModuleDefManager] Restoring structure from backup:", orderData.length, "modules");
                 return orderData.map(mod => ({
                     ...mod,
                     type: mod.type || 'regular',
                     parentId: (mod.parentId === undefined || mod.parentId === 'null') ? null : mod.parentId,
                     order: mod.order ?? 0,
                     renderTemplate: mod.renderTemplate || function(client) { return `<h3>${mod.name}</h3><p>Default Content</p>`; },
                     saveData: mod.saveData || function() { return {}; }
                 }));
             } catch (error) {
                 console.error("[ModuleDefManager] Error parsing module structure backup:", error);
                 sessionStorage.removeItem('moduleOrder');
             }
         } else {
             console.warn("[ModuleDefManager] No module structure backup found in sessionStorage.");
         }
         return null;
     }

    /**
     * Triggers the SidebarManager to re-render its list using the current master list.
     */
    function triggerSidebarRender() {
        setTimeout(() => {
            if (window.ConstructionApp.SidebarManager?.renderModuleList) {
                console.log("[ModuleDefManager] Triggering sidebar re-render.");
                window.ConstructionApp.SidebarManager.renderModuleList(modules);
            } else {
                console.warn("[ModuleDefManager] SidebarManager.renderModuleList not found. Cannot trigger re-render.");
            }
        }, 0);
    }

    /**
     * Triggers the DashboardRenderer to re-render the main content area.
     * Needs the current client context.
     */
    function triggerDashboardRender() {
         setTimeout(() => {
             const ClientManager = window.ConstructionApp.ClientManager;
             const DashboardRenderer = window.ConstructionApp.DashboardRenderer;
             if (ClientManager?.getCurrentClient && DashboardRenderer?.render) {
                 console.log("[ModuleDefManager] Triggering dashboard content re-render.");
                 const currentClient = ClientManager.getCurrentClient();
                 // Pass the current modules from this manager to ensure renderer uses latest order
                 DashboardRenderer.render(currentClient, modules);
             } else {
                 console.warn("[ModuleDefManager] ClientManager or DashboardRenderer not available. Cannot trigger dashboard re-render.");
             }
         }, 0); // Use setTimeout like triggerSidebarRender
    }


    /**
     * Recalculates the 'order' property for all modules based on their position
     * within their parent group in the master 'modules' array.
     */
    function recalculateModuleOrder() {
        const modulesByParent = {};
        modules.forEach(module => {
            const parentKey = module.parentId === null ? 'null' : module.parentId;
            if (!modulesByParent[parentKey]) { modulesByParent[parentKey] = []; }
            modulesByParent[parentKey].push(module);
        });
        Object.values(modulesByParent).forEach(group => {
            group.forEach((module, index) => { module.order = index; });
        });
         console.log("[ModuleDefManager] Module order recalculated.");
    }


    // --- Public API Functions ---

    /**
     * Loads module definitions from Firebase/backup/defaults, processes them,
     * stores them in the local 'modules' array, and returns them.
     */
    async function loadModuleDefinitions() {
        console.log("[ModuleDefManager] Loading modules structure");
        let loadedModules = [];
        let source = "Unknown";
        try {
            if (!window.ConstructionApp?.Firebase) throw new Error("Firebase module not available");
            loadedModules = await window.ConstructionApp.Firebase.loadModules();
            source = "Firebase";
            console.log("[ModuleDefManager] Attempted load from Firebase. Found:", loadedModules?.length || 0);
            if (!Array.isArray(loadedModules)) {
                console.warn("[ModuleDefManager] Firebase loadModules did not return an array.");
                loadedModules = [];
            }
            if (loadedModules.length === 0) {
                console.warn("[ModuleDefManager] No modules in Firebase or invalid data, trying backup.");
                source = "Backup";
                loadedModules = restoreModuleOrderFromBackup() || [];
                if (loadedModules.length > 0) {
                    console.log("[ModuleDefManager] Restored from backup:", loadedModules.length);
                } else {
                    console.warn("[ModuleDefManager] Backup empty or failed. Using defaults.");
                    source = "Defaults";
                    loadedModules = getDefaultModules();
                    // Save defaults back immediately if using them
                    modules = loadedModules; // Temporarily set 'modules' so save works
                    await saveModuleStructure();
                    console.log("[ModuleDefManager] Saved default modules.");
                }
            }
        } catch (error) {
            console.error("[ModuleDefManager] Error loading from Firebase, trying backup:", error);
            source = "Backup (after error)";
            loadedModules = restoreModuleOrderFromBackup() || [];
            if (loadedModules.length > 0) {
                console.log("[ModuleDefManager] Restored from backup after Firebase error:", loadedModules.length);
            } else {
                console.warn("[ModuleDefManager] Backup failed/empty after Firebase error. Using defaults.");
                source = "Defaults (after error)";
                loadedModules = getDefaultModules();
                 try {
                     modules = loadedModules; // Temporarily set 'modules' so save works
                     await saveModuleStructure();
                     console.log("[ModuleDefManager] Saved default modules after initial load error.");
                 } catch (saveError) {
                    console.error("[ModuleDefManager] Failed to save default modules after Firebase load error:", saveError);
                 }
            }
        }

        // --- Process loaded modules (Ensure 'Notes', properties, sort) ---
        const notesModuleIndex = loadedModules.findIndex(m => m.id === 'notes');
        let notesModuleData = notesModuleIndex > -1 ? loadedModules.splice(notesModuleIndex, 1)[0] : {};
        notesModuleData = {
            id: 'notes', name: notesModuleData.name || 'Notes',
            requiresClient: notesModuleData.requiresClient !== undefined ? notesModuleData.requiresClient : true,
            type: notesModuleData.type || 'regular', parentId: notesModuleData.parentId !== undefined ? notesModuleData.parentId : null,
            order: -1,
            renderTemplate: notesModuleData.renderTemplate || function(client) { return `<h3>Notes</h3><p>Client notes area.</p>`; },
            saveData: notesModuleData.saveData || function() { return {}; }
        };
        loadedModules.unshift(notesModuleData);

        // Store the final processed list in the local 'modules' variable
        modules = loadedModules.map((mod, index) => ({
            ...mod,
            parentId: (mod.parentId === 'null' || mod.parentId === undefined) ? null : mod.parentId,
            order: mod.order ?? index,
            renderTemplate: mod.renderTemplate || function(client) { return `<h3>${mod.name}</h3><p>Default Content</p>`; },
            saveData: mod.saveData || function() { return {}; }
        }));

        recalculateModuleOrder();
        modules.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

        console.log(`[ModuleDefManager] Module structure processed. Final count: ${modules.length}. Source: ${source}`);
        return modules;
    }

    /**
     * Adds a new module definition based on input info.
     */
    function addNewModuleDefinition(moduleInfo) {
         const moduleName = moduleInfo.name?.trim();
         if (!moduleName) { alert("Module name is required."); return null; }
         const moduleType = moduleInfo.type || 'regular';
         const parentId = moduleType === 'header' ? null : (moduleInfo.parentId === 'null' ? null : moduleInfo.parentId);
         const requiresClient = moduleInfo.requiresClient !== undefined ? moduleInfo.requiresClient : true;
         const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
         if (!moduleId) { alert("Could not generate a valid ID from the module name."); return null; }
         if (modules.some(m => m.id === moduleId)) { alert(`Module ID "${moduleId}" already exists or is invalid.`); return null; }

         let order = 0;
         const siblings = modules.filter(m => m.parentId === parentId);
         if (siblings.length > 0) { order = Math.max(...siblings.map(m => m.order ?? -1)) + 1; }

         const newModuleData = {
             id: moduleId, name: moduleName, requiresClient: requiresClient, type: moduleType,
             parentId: parentId, order: order,
             renderTemplate: function(client) { return `<h3>${moduleName}</h3><p>Default content.</p>`; },
             saveData: function() { return {}; }
         };
         console.log("[ModuleDefManager] Adding new module:", newModuleData);
         modules.push(newModuleData);
         recalculateModuleOrder();
         modules.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

         saveModuleStructure().then(() => { // Ensure save completes before triggering renders
             triggerSidebarRender();
             triggerDashboardRender(); // <-- ADDED: Trigger dashboard render
         });

         return newModuleData;
    }

     /**
       * Edits an existing module definition (e.g., renames).
       */
     function editModuleDefinition(moduleId, updatedInfo) {
         if (!moduleId || !updatedInfo || !updatedInfo.name) { console.error("[ModuleDefManager] Invalid arguments for editModuleDefinition."); return false; }
         const newName = updatedInfo.name.trim();
         if (newName === '') { alert("Module name cannot be empty."); return false; }
         const moduleIndex = modules.findIndex(m => m.id === moduleId);
         if (moduleIndex === -1) { alert("Error: Module to edit was not found."); return false; }

         console.log(`[ModuleDefManager] Renaming module ${moduleId} to "${newName}"`);
         modules[moduleIndex].name = newName;

         saveModuleStructure().then(() => { // Ensure save completes before triggering renders
             triggerSidebarRender();
             triggerDashboardRender(); // <-- ADDED: Trigger dashboard render
         });

         return true;
     }

    /**
     * Deletes a module definition and its descendants.
     */
    function deleteModuleDefinition(moduleId) {
        if (!moduleId || moduleId === 'notes') {
            if (moduleId === 'notes') alert('The Notes module cannot be deleted.');
            return false;
        }
        const moduleIndex = modules.findIndex(m => m.id === moduleId);
        if (moduleIndex === -1) { alert("Error: Module to delete was not found."); return false; }

        console.log(`[ModuleDefManager] Deleting module ${moduleId} and descendants.`);
        const idsToDelete = new Set([moduleId]);
        const queue = [moduleId];
        while (queue.length > 0) {
            const currentParentId = queue.shift();
            modules.forEach(module => {
                if (module.parentId === currentParentId && !idsToDelete.has(module.id)) {
                    idsToDelete.add(module.id);
                    queue.push(module.id);
                }
            });
        }

        const initialLength = modules.length;
        modules = modules.filter(module => !idsToDelete.has(module.id));
        const deletedCount = initialLength - modules.length;

        if (deletedCount > 0) {
            console.log(`[ModuleDefManager] ${deletedCount} module(s) removed.`);
            recalculateModuleOrder();

            saveModuleStructure().then(() => { // Ensure save completes before triggering renders
                triggerSidebarRender();
                triggerDashboardRender(); // <-- ADDED: Trigger dashboard render
            });
            return true;
        } else {
            console.warn("[ModuleDefManager] Delete operation did not remove any modules.");
            return false;
        }
    }

    /**
     * Handles moving a module based on drag-and-drop actions from the sidebar.
     */
    function handleModuleMove(draggedId, targetId, dropIndicator) {
        console.log(`[ModuleDefManager] Handling move request: dragged=${draggedId}, target=${targetId}, position=${dropIndicator}`);
        const draggedIndex = modules.findIndex(m => m.id === draggedId);
        const targetIndex = modules.findIndex(m => m.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) { console.error(`[ModuleDefManager] Move Error: Dragged or target module not found.`); return false; }

        const draggedModule = modules[draggedIndex];
        const targetModule = modules[targetIndex];
        let newParentId = null;
        let insertionIndex = -1;

        if (dropIndicator === 'middle' && targetModule.type === 'header') {
            newParentId = targetModule.id;
            insertionIndex = targetIndex + 1;
        } else if (dropIndicator === 'top') {
            newParentId = targetModule.parentId;
            insertionIndex = targetIndex;
        } else { // bottom
            newParentId = targetModule.parentId;
            insertionIndex = targetIndex + 1;
        }
        console.log(`[ModuleDefManager] Calculated new parent: ${newParentId}, insertion index: ${insertionIndex}`);

        draggedModule.parentId = newParentId;
        const [removedModule] = modules.splice(draggedIndex, 1);
        if (draggedIndex < insertionIndex) { insertionIndex--; }
        modules.splice(insertionIndex, 0, removedModule);

        console.log("[ModuleDefManager] Recalculating order after move...");
        recalculateModuleOrder();

        console.log("[ModuleDefManager] Saving structure after move...");
        saveModuleStructure().then(() => { // Ensure save completes before triggering renders
            triggerSidebarRender();
            triggerDashboardRender(); // <-- ADDED: Trigger dashboard render
        });

        return true;
    }

    /**
     * Gets the current list of module definitions managed by this module.
     */
    function getModuleDefinitions() {
        return [...modules]; // Return a copy
    }


    // --- Expose Public Interface ---
    window.ConstructionApp.ModuleDefinitionManager = {
        loadModuleDefinitions: loadModuleDefinitions,
        getModuleDefinitions: getModuleDefinitions,
        addNewModuleDefinition: addNewModuleDefinition,
        editModuleDefinition: editModuleDefinition,
        deleteModuleDefinition: deleteModuleDefinition,
        saveModuleStructure: saveModuleStructure, // Keep exposed if needed elsewhere
        recalculateModuleOrder: recalculateModuleOrder, // Keep exposed if needed elsewhere
        handleModuleMove: handleModuleMove
        // Note: triggerSidebarRender and triggerDashboardRender are internal helpers
    };

})();
