// simple-module-grouping.js - Creates visual grouping of modules

document.addEventListener('DOMContentLoaded', function() {
    // Add styles for module groups
    const style = document.createElement('style');
    style.textContent = `
        /* Group header */
        .module-group-header {
            background-color: #4eca8b;
            color: white;
            font-weight: bold;
            padding: 10px 20px;
            margin-top: 10px;
        }
        
        /* Group children */
        .module-group-child {
            padding-left: 35px !important;
        }
    `;
    document.head.appendChild(style);
    
    // Wait for modules to load
    setTimeout(setupGroups, 500);
    
    // Set up module groups
    function setupGroups() {
        const modulesContainer = document.getElementById('modules-container');
        if (!modulesContainer) return;
        
        // Define module groups
        const groups = [
            {
                name: 'Foundations',
                modules: ['foundations-excavation', 'foundations-concrete', 'foundations-steel']
            }
            // Add more groups as needed
        ];
        
        // Process each group
        groups.forEach(group => {
            // Create group header
            const header = document.createElement('div');
            header.className = 'module-group-header';
            header.textContent = group.name;
            
            // Find the first module of the group
            const firstModule = modulesContainer.querySelector(`[data-module-id="${group.modules[0]}"]`);
            
            if (firstModule) {
                // Insert the header before the first module
                modulesContainer.insertBefore(header, firstModule);
                
                // Mark all modules in the group as children
                group.modules.forEach(moduleId => {
                    const module = modulesContainer.querySelector(`[data-module-id="${moduleId}"]`);
                    if (module) {
                        module.classList.add('module-group-child');
                    }
                });
            }
        });
    }
});
