// js/module-definition-manager.js
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let modules = []; // Holds the master list of module definitions managed by this file

    // --- Private Functions (Moved or Internal Helpers) ---

    /**
     * Saves the current module structure (from the local 'modules' array)
     * to Firebase and sessionStorage backup.
     * (Code moved from dashboard.js)
     */
    async function saveModuleStructure() {
        console.log("[ModuleDefManager] Saving module structure");

        // Create simplified objects for saving, using the local 'modules' array
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
        // Save to Firebase
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
                 firebaseSuccess = false; // Ensure it's false on error
            }
        } else {
            console.warn("[ModuleDefManager] Firebase not available, cannot save structure to Firebase.");
        }

        // Always try to save backup to sessionStorage
        try {
            sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
            console.log("[ModuleDefManager] Module structure backup saved to sessionStorage.");
        } catch (storageError) {
            console.error("[ModuleDefManager] Error saving structure backup to sessionStorage:", storageError);
        }

        return firebaseSuccess; // Return status of Firebase save attempt
    }

    /**
     * Gets the default set of modules.
     * (Code moved from dashboard.js)
     * @returns {Array} Default module definitions.
     */
    function getDefaultModules() {
        console.log("[ModuleDefManager] Providing default module set.");
        // Added 'notes' to the default set
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
             // Add other default modules as needed
        ];
    }

     /**
      * Restores the module structure from sessionStorage backup.
      * (Code moved from dashboard.js)
      * @returns {Array|null} The restored module array or null.
      */
    function restoreModuleOrderFromBackup() {
        const savedOrder = sessionStorage.getItem('moduleOrder');
        if (savedOrder) {
            try {
                const orderData = JSON.parse(savedOrder);
                if (!Array.isArray(orderData)) {
                    throw new Error("Backup data is not an array.");
                }
                console.log("[ModuleDefManager] Restoring structure from backup:", orderData.length, "modules");
                // Ensure basic properties exist on restore
                return orderData.map(mod => ({
                    ...mod,
                    type: mod.type || 'regular',
                    parentId: (mod.parentId === undefined || mod.parentId === 'null') ? null : mod.parentId,
                    order: mod.order ?? 0,
                    // Add default render/save placeholders if missing from backup
                    renderTemplate: mod.renderTemplate || function(client) { return `<h3>${mod.name}</h3><p>Default Content</p>`; },
                    saveData: mod.saveData || function() { return {}; }
                }));
            } catch (error) {
                console.error("[ModuleDefManager] Error parsing module structure backup:", error);
                sessionStorage.removeItem('moduleOrder'); // Clear corrupted backup
            }
        } else {
            console.warn("[ModuleDefManager] No module structure backup found in sessionStorage.");
        }
        return null; // Return null if no valid backup
    }

    /**
     * Triggers the SidebarManager to re-render its list.
     */
    function triggerSidebarRender() {
        // Use setTimeout to allow current execution stack to clear before rendering
        setTimeout(() => {
            if (window.ConstructionApp.SidebarManager && typeof window.ConstructionApp.SidebarManager.renderModuleList === 'function') {
                console.log("[ModuleDefManager] Triggering sidebar re-render.");
                // Pass the current, updated 'modules' array from this manager
                window.ConstructionApp.SidebarManager.renderModuleList(modules);
            } else {
                console.warn("[ModuleDefManager] SidebarManager.renderModuleList not found. Cannot trigger re-render.");
            }
        }, 0);
    }

    /**
     * Recalculates the 'order' property for all modules based on their position
     * within their parent group in the 'modules' array.
     * (Moved from sidebar-manager as it modifies the core data)
     */
    function recalculateModuleOrder() {
        const modulesByParent = {};

        // Group modules by parentId based on current 'modules' array order
        modules.forEach(module => {
            const parentKey = module.parentId === null ? 'null' : module.parentId;
            if (!modulesByParent[parentKey]) {
                modulesByParent[parentKey] = [];
            }
            modulesByParent[parentKey].push(module);
        });

        // Assign sequential order within each group
        Object.values(modulesByParent).forEach(group => {
            group.forEach((module, index) => {
                module.order = index;
            });
        });
         console.log("[ModuleDefManager] Module order recalculated.");
    }


    // --- Public API Functions ---

    /**
     * Loads module definitions from Firebase/backup/defaults, processes them,
     * stores them in the local 'modules' array, and returns them.
     * (Code adapted from dashboard.js's loadAndRenderModules)
     * @returns {Promise<Array>} A promise that resolves with the loaded module definitions array.
     */
    async function loadModuleDefinitions() {
        console.log("[ModuleDefManager] Loading modules structure"); // Changed log message
        let loadedModules = [];
        let source = "Unknown";

        try {
            if (!window.ConstructionApp?.Firebase) throw new Error("Firebase module not available");
            loadedModules = await window.ConstructionApp.Firebase.loadModules();
            source = "Firebase";
            console.log("[ModuleDefManager] Attempted load from Firebase. Found:", loadedModules?.length || 0);

            if (!Array.isArray(loadedModules)) {
                console.warn("[ModuleDefManager] Firebase loadModules did not return an array.");
                loadedModules = []; // Reset to trigger backup/defaults
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
                    // Attempt to save defaults back to Firebase if loaded from defaults
                    // Use the local saveModuleStructure which now handles Firebase/backup
                    await saveModuleStructure(); // This will save the 'loadedModules' (defaults)
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
                     // Attempt to save defaults back using the local function
                     await saveModuleStructure(); // This will save the 'loadedModules' (defaults)
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
            id: 'notes',
            name: notesModuleData.name || 'Notes',
            requiresClient: notesModuleData.requiresClient !== undefined ? notesModuleData.requiresClient : true,
            type: notesModuleData.type || 'regular',
            parentId: notesModuleData.parentId !== undefined ? notesModuleData.parentId : null,
            order: -1, // Ensure it comes first visually if sort uses order
            renderTemplate: notesModuleData.renderTemplate || function(client) { return `<h3>Notes</h3><p>Client notes area.</p>`; },
            saveData: notesModuleData.saveData || function() { return {}; }
        };
        loadedModules.unshift(notesModuleData); // Add notes to the beginning

        // Store the final processed list in the local 'modules' variable
        modules = loadedModules.map((mod, index) => ({
            ...mod,
            parentId: (mod.parentId === 'null' || mod.parentId === undefined) ? null : mod.parentId,
            order: mod.order ?? index, // Assign order if missing
            // Ensure placeholders exist if missing from loaded data
            renderTemplate: mod.renderTemplate || function(client) { return `<h3>${mod.name}</h3><p>Default Content</p>`; },
            saveData: mod.saveData || function() { return {}; }
        }));

        // Ensure order is calculated correctly after processing
        recalculateModuleOrder();
        // Final sort based on calculated order
        modules.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

        console.log(`[ModuleDefManager] Module structure processed. Final count: ${modules.length}. Source: ${source}`);
        return modules; // Return the processed list
    }

    /**
     * Adds a new module definition based on input info.
     * (Logic moved from dashboard.js's addNewModule)
     * @param {object} moduleInfo - Object containing name, type, parentId, requiresClient.
     * @returns {object|null} The newly created module object or null if failed.
     */
    function addNewModuleDefinition(moduleInfo) {
         // --- Validation ---
         const moduleName = moduleInfo.name?.trim();
         if (!moduleName) {
             alert("Module name is required.");
             return null;
         }
         const moduleType = moduleInfo.type || 'regular';
         // Convert 'null' string from select to actual null
         const parentId = moduleType === 'header' ? null : (moduleInfo.parentId === 'null' ? null : moduleInfo.parentId);
         const requiresClient = moduleInfo.requiresClient !== undefined ? moduleInfo.requiresClient : true;

         // Generate a simple ID
         const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
         if (!moduleId) {
             alert("Could not generate a valid ID from the module name.");
             return null;
         }

         // Check for duplicate ID in the current 'modules' array
         if (modules.some(m => m.id === moduleId)) {
             alert(`Module ID "${moduleId}" already exists or is invalid. Please choose a different name.`);
             return null;
         }
         // --- End Validation ---

         // Calculate order (append to the end of its parent group)
         let order = 0;
         const siblings = modules.filter(m => m.parentId === parentId);
         if (siblings.length > 0) {
             order = Math.max(...siblings.map(m => m.order ?? -1)) + 1;
         }

         // Create the new module object
         const newModuleData = {
             id: moduleId,
             name: moduleName,
             requiresClient: requiresClient,
             type: moduleType,
             parentId: parentId,
             order: order,
             // Add default render/save placeholders
             renderTemplate: function(client) { return `<h3>${moduleName}</h3><p>Default content.</p>`; },
             saveData: function() { return {}; }
         };

         console.log("[ModuleDefManager] Adding new module:", newModuleData);

         // Add to the local 'modules' array
         modules.push(newModuleData);
         // Ensure order is correct after adding
         recalculateModuleOrder();
         modules.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));


         // Save the updated structure (async but don't necessarily wait)
         saveModuleStructure();

         // Trigger sidebar re-render with the updated list
         triggerSidebarRender();

         return newModuleData; // Return the created module
    }

     /**
      * Edits an existing module definition (e.g., renames).
      * (Logic moved from sidebar-manager.js's editModule, adapted)
      * @param {string} moduleId - The ID of the module to edit.
      * @param {object} updatedInfo - Object with properties to update (e.g., { name: "New Name" }).
      * @returns {boolean} True if successful, false otherwise.
      */
    function editModuleDefinition(moduleId, updatedInfo) {
         if (!moduleId || !updatedInfo || !updatedInfo.name) {
             console.error("[ModuleDefManager] Invalid arguments for editModuleDefinition.");
             return false;
         }
         const newName = updatedInfo.name.trim();
         if (newName === '') {
             console.error("[ModuleDefManager] New module name cannot be empty.");
             alert("Module name cannot be empty."); // User feedback
             return false;
         }

         // Find module by moduleId in local 'modules' array
         const moduleIndex = modules.findIndex(m => m.id === moduleId);
         if (moduleIndex === -1) {
             console.error("[ModuleDefManager] Edit Error: Module not found:", moduleId);
             alert("Error: Module to edit was not found."); // User feedback
             return false;
         }

         // Check if new name causes ID conflict (if ID generation depends on name - currently it does only on creation)
         // For simplicity, we are only changing the name, not the ID here.

         // Update the name in the local 'modules' array
         console.log(`[ModuleDefManager] Renaming module ${moduleId} to "${newName}"`);
         modules[moduleIndex].name = newName;

         // Save the updated structure (async but don't necessarily wait)
         saveModuleStructure();

         // Trigger sidebar re-render to show the new name
         triggerSidebarRender();

         return true; // Indicate success
    }

    /**
     * Deletes a module definition and its descendants.
     * (Logic moved from sidebar-manager.js's deleteModule, adapted)
     * @param {string} moduleId - The ID of the module to delete.
     * @returns {boolean} True if successful, false otherwise.
     */
    function deleteModuleDefinition(moduleId) {
         // Prevent deleting the essential 'notes' module
         if (!moduleId || moduleId === 'notes') {
             console.warn("[ModuleDefManager] Attempted to delete invalid or protected module:", moduleId);
             // Provide user feedback if trying to delete notes
             if (moduleId === 'notes') alert('The Notes module cannot be deleted.');
             return false;
         }

         // Find the module in the local 'modules' array
         const moduleIndex = modules.findIndex(m => m.id === moduleId);
         if (moduleIndex === -1) {
             console.error("[ModuleDefManager] Delete Error: Module not found:", moduleId);
             alert("Error: Module to delete was not found."); // User feedback
             return false;
         }

         console.log(`[ModuleDefManager] Deleting module ${moduleId} and descendants.`);

         // Find all IDs to delete (the module itself and all descendants)
         const idsToDelete = new Set([moduleId]);
         const queue = [moduleId]; // Start with the module to delete

         while (queue.length > 0) {
             const currentParentId = queue.shift();
             // Find children of the current parent in the current 'modules' list
             modules.forEach(module => {
                 if (module.parentId === currentParentId && !idsToDelete.has(module.id)) {
                     idsToDelete.add(module.id);
                     queue.push(module.id); // Add child to the queue to find its descendants
                 }
             });
         }

         // Filter the local 'modules' array, keeping only those NOT in idsToDelete
         const initialLength = modules.length;
         modules = modules.filter(module => !idsToDelete.has(module.id));
         const deletedCount = initialLength - modules.length;

         if (deletedCount > 0) {
             console.log(`[ModuleDefManager] ${deletedCount} module(s) removed.`);
             // Recalculate order and save the modified structure
             recalculateModuleOrder(); // Recalculate order for remaining modules
             saveModuleStructure();

             // Trigger sidebar re-render
             triggerSidebarRender();
             return true; // Indicate success
         } else {
             console.warn("[ModuleDefManager] Delete operation did not remove any modules (maybe already deleted?).");
             return false; // Indicate nothing changed
         }
    }

    /**
     * Gets the current list of module definitions managed by this module.
     * @returns {Array} The array of module definitions.
     */
    function getModuleDefinitions() {
        // Return a copy to prevent accidental modification from outside
        return [...modules];
    }


    // --- Expose Public Interface ---
    window.ConstructionApp.ModuleDefinitionManager = {
        loadModuleDefinitions: loadModuleDefinitions,
        getModuleDefinitions: getModuleDefinitions,
        addNewModuleDefinition: addNewModuleDefinition,
        editModuleDefinition: editModuleDefinition,
        deleteModuleDefinition: deleteModuleDefinition,
        // Expose save function for Drag & Drop in SidebarManager
        saveModuleStructure: saveModuleStructure,
        // Expose recalculate order as D&D needs it before saving
        recalculateModuleOrder: recalculateModuleOrder
    };

})();
