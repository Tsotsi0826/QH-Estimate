/**
 * Module Hierarchy System
 * 
 * A complete implementation for organizing modules into headers and submodules
 */

// Declare in global scope so it's accessible throughout the application
window.ModuleHierarchy = {};

(function() {
    // Module types
    const MODULE_TYPES = {
        HEADER: 'header',
        MODULE: 'module'
    };
    
    // Store hierarchy information
    let moduleHierarchy = {
        // Format: headerId: [moduleId1, moduleId2, ...] 
    };
    
    // Initialize when page loads
    window.addEventListener('load', function() {
        console.log("Module Hierarchy System initializing");
        
        // Load saved hierarchy
        loadHierarchy();
        
        // Replace the Add Module button with our enhanced version
        enhanceAddModuleButton();
        
        // Apply initial styling to existing modules
        setTimeout(applyHierarchyStyling, 500);
    });
    
    // Load hierarchy from storage
    function loadHierarchy() {
        try {
            const savedHierarchy = localStorage.getItem('moduleHierarchy');
            if (savedHierarchy) {
                moduleHierarchy = JSON.parse(savedHierarchy);
                console.log("Loaded module hierarchy:", moduleHierarchy);
            }
        } catch (error) {
            console.error("Error loading module hierarchy:", error);
            moduleHierarchy = {};
        }
    }
    
    // Save hierarchy to storage
    function saveHierarchy() {
        try {
            localStorage.setItem('moduleHierarchy', JSON.stringify(moduleHierarchy));
            console.log("Saved module hierarchy:", moduleHierarchy);
        } catch (error) {
            console.error("Error saving module hierarchy:", error);
        }
    }
    
    // Apply styling based on hierarchy
    function applyHierarchyStyling() {
        console.log("Applying hierarchy styling");
        
        // Get all modules
        const allModules = document.querySelectorAll('.module-item');
        
        // Reset styling
        allModules.forEach(module => {
            // Reset text style
            const moduleText = module.querySelector('span');
            if (moduleText) {
                moduleText.style.color = '';
                moduleText.style.fontWeight = '';
            }
            
            // Reset padding
            module.style.paddingLeft = '';
        });
        
        // Style headers
        Object.keys(moduleHierarchy).forEach(headerId => {
            const headerModule = document.querySelector(`.module-item[data-module-id="${headerId}"]`);
            if (headerModule) {
                // Style header text
                const headerText = headerModule.querySelector('span');
                if (headerText) {
                    headerText.style.color = '#4eca8b';
                    headerText.style.fontWeight = 'bold';
                }
                
                // Add header attribute for identification
                headerModule.setAttribute('data-module-type', MODULE_TYPES.HEADER);
            }
            
            // Style child modules
            moduleHierarchy[headerId].forEach(moduleId => {
                const moduleElement = document.querySelector(`.module-item[data-module-id="${moduleId}"]`);
                if (moduleElement) {
                    moduleElement.style.paddingLeft = '40px';
                    moduleElement.setAttribute('data-module-type', MODULE_TYPES.MODULE);
                }
            });
        });
    }
    
    // Replace the Add Module button with enhanced version
    function enhanceAddModuleButton() {
        const originalButton = document.getElementById('add-module-btn');
        if (!originalButton) {
            console.error("Add module button not found");
            return;
        }
        
        // Create a clone to remove existing event listeners
        const newButton = originalButton.cloneNode(true);
        originalButton.parentNode.replaceChild(newButton, originalButton);
        
        // Add new click handler
        newButton.addEventListener('click', showModuleTypeSelection);
    }
    
    // Show module type selection dialog
    function showModuleTypeSelection() {
        // Create modal overlay if it doesn't exist
        let modalOverlay = document.querySelector('.modal-overlay');
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.className = 'modal-overlay';
            document.body.appendChild(modalOverlay);
        }
        
        // Create the modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title">Add New Module</h2>
                <span class="modal-close">&times;</span>
            </div>
            <div class="modal-body">
                <p>What type of module would you like to create?</p>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="add-header-btn" class="btn" style="flex: 1;">Header</button>
                    <button id="add-module-btn" class="btn" style="flex: 1;">Module</button>
                </div>
            </div>
        `;
        
        // Add to DOM
        modalOverlay.innerHTML = '';
        modalOverlay.appendChild(modal);
        modalOverlay.style.display = 'flex';
        
        // Set up event handlers
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
        });
        
        // Close on outside click
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                modalOverlay.style.display = 'none';
            }
        });
        
        // Header button
        const headerBtn = modal.querySelector('#add-header-btn');
        headerBtn.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            addNewHeader();
        });
        
        // Module button
        const moduleBtn = modal.querySelector('#add-module-btn');
        moduleBtn.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            addNewModule();
        });
    }
    
    // Add a new header
    function addNewHeader() {
        // Prompt for header name
        const headerName = prompt("Enter header name:");
        if (!headerName || headerName.trim() === '') return;
        
        // Generate header ID
        const headerId = headerName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        // Check if ID already exists
        if (document.querySelector(`.module-item[data-module-id="${headerId}"]`)) {
            alert(`A module with the ID "${headerId}" already exists.`);
            return;
        }
        
        // Create the module
        createNewModule(headerId, headerName, true, true);
        
        // Add to hierarchy
        moduleHierarchy[headerId] = [];
        saveHierarchy();
        
        // Apply styling
        applyHierarchyStyling();
    }
    
    // Add a new module
    function addNewModule() {
        // Prompt for module name
        const moduleName = prompt("Enter module name:");
        if (!moduleName || moduleName.trim() === '') return;
        
        // Generate module ID
        const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        // Check if ID already exists
        if (document.querySelector(`.module-item[data-module-id="${moduleId}"]`)) {
            alert(`A module with the ID "${moduleId}" already exists.`);
            return;
        }
        
        // Get headers for selection
        const headers = Object.keys(moduleHierarchy);
        
        if (headers.length > 0) {
            // Show header selection dialog
            showHeaderSelectionDialog(moduleId, moduleName);
        } else {
            // No headers exist, just create the module
            createNewModule(moduleId, moduleName, true, false);
        }
    }
    
    // Show header selection dialog
    function showHeaderSelectionDialog(moduleId, moduleName) {
        // Create modal overlay if it doesn't exist
        let modalOverlay = document.querySelector('.modal-overlay');
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.className = 'modal-overlay';
            document.body.appendChild(modalOverlay);
        }
        
        // Get headers
        const headers = Object.keys(moduleHierarchy);
        
        // Create header options HTML
        let headerOptionsHtml = '';
        headers.forEach(headerId => {
            const headerElement = document.querySelector(`.module-item[data-module-id="${headerId}"]`);
            const headerName = headerElement ? headerElement.querySelector('span').textContent : headerId;
            
            headerOptionsHtml += `
                <div class="header-option" data-header-id="${headerId}" style="padding: 10px; margin: 5px 0; cursor: pointer; border: 1px solid #ddd; border-radius: 4px;">
                    ${headerName}
                </div>
            `;
        });
        
        // Create the modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title">Select Header</h2>
                <span class="modal-close">&times;</span>
            </div>
            <div class="modal-body">
                <p>Which header should this module be placed under?</p>
                <div style="max-height: 200px; overflow-y: auto; margin: 10px 0;">
                    ${headerOptionsHtml}
                </div>
                <button id="no-header-btn" class="btn" style="width: 100%; margin-top: 10px;">None (Create as standalone module)</button>
            </div>
        `;
        
        // Add to DOM
        modalOverlay.innerHTML = '';
        modalOverlay.appendChild(modal);
        modalOverlay.style.display = 'flex';
        
        // Set up event handlers
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
        });
        
        // Close on outside click
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                modalOverlay.style.display = 'none';
            }
        });
        
        // No header button
        const noHeaderBtn = modal.querySelector('#no-header-btn');
        noHeaderBtn.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            createNewModule(moduleId, moduleName, true, false);
        });
        
        // Header options
        const headerOptions = modal.querySelectorAll('.header-option');
        headerOptions.forEach(option => {
            option.addEventListener('click', () => {
                const headerId = option.getAttribute('data-header-id');
                modalOverlay.style.display = 'none';
                
                // Create the module
                createNewModule(moduleId, moduleName, true, false);
                
                // Add to header
                addModuleToHeader(moduleId, headerId);
            });
        });
    }
    
    // Create a new module in the DOM
    function createNewModule(moduleId, moduleName, requiresClient, isHeader) {
        console.log(`Creating new ${isHeader ? 'header' : 'module'}: ${moduleName} (${moduleId})`);
        
        // Create module element
        const moduleElement = document.createElement('div');
        moduleElement.className = 'module-item';
        moduleElement.draggable = true;
        moduleElement.setAttribute('data-module-id', moduleId);
        moduleElement.setAttribute('data-requires-client', requiresClient ? 'true' : 'false');
        moduleElement.setAttribute('data-module-type', isHeader ? MODULE_TYPES.HEADER : MODULE_TYPES.MODULE);
        
        moduleElement.innerHTML = `
            <div class="module-drag-handle">≡</div>
            <div class="module-icon">
                ...
                <div class="dropdown-menu">
                    <div class="dropdown-item edit-module">Edit</div>
                    <div class="dropdown-item delete-module">Delete</div>
                </div>
            </div>
            <span>${moduleName}</span>
        `;
        
        // Add to container
        const modulesContainer = document.getElementById('modules-container');
        modulesContainer.appendChild(moduleElement);
        
        // Add to app data
        if (window.appData && window.appData.modules) {
            window.appData.modules.push({
                id: moduleId,
                name: moduleName,
                requiresClient: requiresClient,
                renderTemplate: function(client) {
                    return `
                        <h3>${moduleName}</h3>
                        <p>This is a custom module. You can create an HTML file named "${moduleId}.html" to implement this module.</p>
                    `;
                },
                saveData: function() {
                    return {};
                }
            });
        }
        
        // Reattach event handlers if functions exist
        if (typeof setupModuleEventListeners === 'function') {
            setupModuleEventListeners(moduleElement);
        } else {
            // Add basic functionality
            const moduleText = moduleElement.querySelector('span');
            if (moduleText) {
                moduleText.addEventListener('click', function() {
                    const moduleId = moduleElement.getAttribute('data-module-id');
                    const requiresClient = moduleElement.getAttribute('data-requires-client') === 'true';
                    
                    // Don't navigate for headers
                    if (moduleElement.getAttribute('data-module-type') === MODULE_TYPES.HEADER) {
                        toggleHeaderChildren(moduleId);
                        return;
                    }
                    
                    if (requiresClient) {
                        // Verify client is selected
                        const client = window.ConstructionApp?.ClientManager?.getCurrentClient();
                        if (!client) {
                            alert("Please select or create a client first to access this module.");
                            return;
                        }
                        
                        // Set navigation state
                        sessionStorage.setItem('navigationState', 'fromDashboard');
                        
                        // Save client
                        sessionStorage.setItem('currentClient', JSON.stringify(client));
                        
                        // Navigate
                        window.location.href = moduleId + '.html';
                    } else {
                        window.location.href = moduleId + '.html';
                    }
                });
            }
        }
        
        // Save to Firebase if available
        if (window.ConstructionApp && window.ConstructionApp.Firebase) {
            if (typeof saveModulesToFirebase === 'function') {
                saveModulesToFirebase();
            }
        }
        
        return moduleElement;
    }
    
    // Add a module to a header
    function addModuleToHeader(moduleId, headerId) {
        console.log(`Adding module ${moduleId} to header ${headerId}`);
        
        // Add to hierarchy
        if (!moduleHierarchy[headerId]) {
            moduleHierarchy[headerId] = [];
        }
        
        // Add if not already present
        if (!moduleHierarchy[headerId].includes(moduleId)) {
            moduleHierarchy[headerId].push(moduleId);
        }
        
        // Save and apply styling
        saveHierarchy();
        applyHierarchyStyling();
    }
    
    // Toggle visibility of header children
    function toggleHeaderChildren(headerId) {
        console.log(`Toggling children of header ${headerId}`);
        
        // Check if header has children
        if (!moduleHierarchy[headerId] || moduleHierarchy[headerId].length === 0) {
            console.log(`Header ${headerId} has no children`);
            return;
        }
        
        // Get header element
        const headerElement = document.querySelector(`.module-item[data-module-id="${headerId}"]`);
        if (!headerElement) {
            console.error(`Header element not found: ${headerId}`);
            return;
        }
        
        // Toggle collapsed state
        const isCollapsed = headerElement.getAttribute('data-collapsed') === 'true';
        headerElement.setAttribute('data-collapsed', isCollapsed ? 'false' : 'true');
        
        // Toggle visibility of children
        moduleHierarchy[headerId].forEach(childId => {
            const childElement = document.querySelector(`.module-item[data-module-id="${childId}"]`);
            if (childElement) {
                childElement.style.display = isCollapsed ? 'flex' : 'none';
            }
        });
    }
    
    // Export public functions
    window.ModuleHierarchy = {
        addModuleToHeader: addModuleToHeader,
        isHeader: function(moduleId) {
            return moduleHierarchy.hasOwnProperty(moduleId);
        },
        getModuleHeader: function(moduleId) {
            for (const headerId in moduleHierarchy) {
                if (moduleHierarchy[headerId].includes(moduleId)) {
                    return headerId;
                }
            }
            return null;
        },
        refreshStyling: applyHierarchyStyling
    };
})();
