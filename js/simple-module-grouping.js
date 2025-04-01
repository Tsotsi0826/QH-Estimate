/**
 * Module Grouping with Dynamic Drag and Drop
 * - Makes category module text green
 * - Indents child modules
 * - Allows drag and drop to create sub-modules
 */

// Store parent-child relationships
let moduleRelationships = {
    // parentId: [childId1, childId2, ...] 
    // e.g. 'foundations': ['foundations-concrete', 'foundations-steel']
};

// Run when page loads
window.addEventListener('load', function() {
    console.log("Module grouping script running - v2.0");
    
    // Load saved relationships
    loadModuleRelationships();
    
    // Wait a moment for the DOM to be ready
    setTimeout(function() {
        // Apply initial styling
        styleModules();
        
        // Set up drag and drop
        setupDragAndDrop();
    }, 500);
});

// Load relationships from storage
function loadModuleRelationships() {
    try {
        const savedRelationships = sessionStorage.getItem('moduleRelationships');
        if (savedRelationships) {
            moduleRelationships = JSON.parse(savedRelationships);
            console.log("Loaded module relationships:", moduleRelationships);
        } else {
            // Initialize with default parent categories
            moduleRelationships = {
                'foundations': [],
                'brickwork': [],
                'surfacebeds': [],
                'plaster': [], 
                'floor': [],
                'carpentry': []
            };
        }
    } catch (error) {
        console.error("Error loading module relationships:", error);
        moduleRelationships = {};
    }
}

// Save relationships to storage
function saveModuleRelationships() {
    try {
        sessionStorage.setItem('moduleRelationships', JSON.stringify(moduleRelationships));
        console.log("Saved module relationships:", moduleRelationships);
    } catch (error) {
        console.error("Error saving module relationships:", error);
    }
}

// Find the parent of a module
function getParentModule(childId) {
    for (const parentId in moduleRelationships) {
        if (moduleRelationships[parentId].includes(childId)) {
            return parentId;
        }
    }
    return null;
}

// Apply styling based on relationships
function styleModules() {
    console.log("Applying module styling...");
    
    // Get all module items
    const modules = document.querySelectorAll('.module-item');
    console.log("Found " + modules.length + " modules");
    
    // Reset styling for all modules
    modules.forEach(function(module) {
        // Clear background color
        module.style.backgroundColor = '';
        // Reset padding
        module.style.paddingLeft = '';
        
        // Reset text color and weight
        const moduleText = module.querySelector('span');
        if (moduleText) {
            moduleText.style.color = '';
            moduleText.style.fontWeight = '';
        }
    });
    
    // Style parent modules
    for (const parentId in moduleRelationships) {
        const parentModule = document.querySelector(`.module-item[data-module-id="${parentId}"]`);
        if (parentModule) {
            const moduleText = parentModule.querySelector('span');
            if (moduleText) {
                moduleText.style.color = '#4eca8b';
                moduleText.style.fontWeight = 'bold';
            }
        }
    }
    
    // Style child modules
    modules.forEach(function(module) {
        const moduleId = module.getAttribute('data-module-id');
        if (!moduleId) return;
        
        // Check if this is a child module
        const parentId = getParentModule(moduleId);
        if (parentId) {
            // This is a child module - apply indentation
            module.style.paddingLeft = '40px';
        }
    });
    
    console.log("Module styling complete");
}

// Set up enhanced drag and drop
function setupDragAndDrop() {
    // Get all module items
    const modules = document.querySelectorAll('.module-item');
    
    // Add new drag events to all modules
    modules.forEach(function(module) {
        // Add dragenter handler
        module.addEventListener('dragenter', function(e) {
            e.preventDefault();
            if (!module.classList.contains('dragging')) {
                module.style.borderTop = '2px solid #4eca8b';
            }
        });
        
        // Add dragleave handler
        module.addEventListener('dragleave', function(e) {
            module.style.borderTop = '';
        });
        
        // Add dragover handler
        module.addEventListener('dragover', function(e) {
            e.preventDefault(); // Required to allow drop
        });
        
        // Add drop handler
        module.addEventListener('drop', function(e) {
            e.preventDefault();
            module.style.borderTop = '';
            
            // Get the dragged module ID
            const draggedModuleId = document.querySelector('.dragging')?.getAttribute('data-module-id');
            if (!draggedModuleId) return;
            
            // Get the target module ID
            const targetModuleId = module.getAttribute('data-module-id');
            if (!targetModuleId || targetModuleId === draggedModuleId) return;
            
            // Process the drop based on target and type
            processModuleDrop(draggedModuleId, targetModuleId);
        });
    });
    
    // Add observer for new modules
    setupObserver();
}

// Process module drop
function processModuleDrop(draggedId, targetId) {
    console.log(`Processing drop: ${draggedId} onto ${targetId}`);
    
    // Check if target is a parent module
    const isTargetParent = moduleRelationships.hasOwnProperty(targetId);
    
    if (isTargetParent) {
        // Target is a parent - add dragged module as a child
        addChildToParent(targetId, draggedId);
    } else {
        // Target is not a parent - check if source is a child
        const sourceParent = getParentModule(draggedId);
        
        if (sourceParent) {
            // Dragged module is a child - remove it from parent
            removeChildFromParent(draggedId);
        }
    }
    
    // Apply updated styling
    styleModules();
}

// Add a child to a parent
function addChildToParent(parentId, childId) {
    console.log(`Adding ${childId} as child of ${parentId}`);
    
    // First remove from any existing parent
    removeChildFromParent(childId);
    
    // Add to new parent
    if (!moduleRelationships[parentId]) {
        moduleRelationships[parentId] = [];
    }
    
    if (!moduleRelationships[parentId].includes(childId)) {
        moduleRelationships[parentId].push(childId);
        console.log(`Added ${childId} to ${parentId}`);
    }
    
    // Save updated relationships
    saveModuleRelationships();
}

// Remove a child from its parent
function removeChildFromParent(childId) {
    for (const parentId in moduleRelationships) {
        const index = moduleRelationships[parentId].indexOf(childId);
        if (index !== -1) {
            moduleRelationships[parentId].splice(index, 1);
            console.log(`Removed ${childId} from parent ${parentId}`);
            
            // Save updated relationships
            saveModuleRelationships();
            return;
        }
    }
}

// Set up observer to detect new modules
function setupObserver() {
    const observer = new MutationObserver(function(mutations) {
        let modulesChanged = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Check if we added or removed modules
                const addedModules = Array.from(mutation.addedNodes).filter(
                    node => node.nodeType === 1 && node.classList.contains('module-item')
                );
                
                const removedModules = Array.from(mutation.removedNodes).filter(
                    node => node.nodeType === 1 && node.classList.contains('module-item')
                );
                
                if (addedModules.length > 0 || removedModules.length > 0) {
                    modulesChanged = true;
                }
            }
        });
        
        if (modulesChanged) {
            console.log("Modules changed, reapplying styling and drag/drop");
            
            // Handle removed modules
            cleanupRemovedModules();
            
            // Reapply styling
            styleModules();
            
            // Refresh drag and drop
            setupDragAndDrop();
        }
    });
    
    // Start observing the modules container
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer) {
        observer.observe(modulesContainer, { childList: true, subtree: true });
    }
}

// Clean up relationships for removed modules
function cleanupRemovedModules() {
    // Get all existing module IDs
    const existingModuleIds = new Set();
    document.querySelectorAll('.module-item').forEach(function(module) {
        const id = module.getAttribute('data-module-id');
        if (id) existingModuleIds.add(id);
    });
    
    // Clean up parents that no longer exist
    for (const parentId in moduleRelationships) {
        if (!existingModuleIds.has(parentId)) {
            delete moduleRelationships[parentId];
        }
    }
    
    // Clean up children that no longer exist
    for (const parentId in moduleRelationships) {
        moduleRelationships[parentId] = moduleRelationships[parentId].filter(
            childId => existingModuleIds.has(childId)
        );
    }
    
    // Save updated relationships
    saveModuleRelationships();
}
