// data-models.js - Default data for all modules

// Data models for Construction Estimator app
(function() {
    // Ensure our namespace exists
    window.ConstructionApp = window.ConstructionApp || {};
    
    // Default data models for each module
    const DataModels = {
        // P&Gs default items
        pAndGsItems: [
            { id: 'contracts-manager', description: 'Contracts manager as required', rate: 6500.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'site-agent', description: 'Site Agent', rate: 8500.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'architect', description: 'Architect - Snag List', rate: 2500.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'deliveries', description: 'Deliveries', rate: 0.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'phones', description: 'Phones / radios', rate: 500.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'vehicle', description: 'Vehicle & Petrol', rate: 1000.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'site-office', description: 'Site Office', rate: 1250.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'site-container', description: 'Site Container', rate: 750.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'toilet-subbies', description: 'Temp. Chemical Toilet Subbies', rate: 400.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'toilet-manager', description: 'Temp. Chemical Toilet Manager', rate: 400.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'electrical-connection', description: 'Temp. Electrical connection', rate: 7500.00, unit: '1', allow: false, qty: 0, isDefault: true },
            { id: 'electrical-usage', description: 'Temporary Electrical usage', rate: 100.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'fencing', description: 'Temporary Fencing', rate: 300.00, unit: 'm', allow: false, qty: 0, isDefault: true },
            { id: 'water-connection', description: 'Water Supply connection', rate: 5000.00, unit: '1', allow: false, qty: 0, isDefault: true },
            { id: 'water-usage', description: 'Water usage', rate: 150.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'head-office', description: 'Head Office Overheads', rate: 1000.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'insurances', description: 'Insurances', rate: 12500.00, unit: '1', allow: false, qty: 0, isDefault: true },
            { id: 'land-surveyor', description: 'Land Surveyor', rate: 12000.00, unit: '1', allow: false, qty: 0, isDefault: true },
            { id: 'health-safety-file', description: 'Health & safety file', rate: 7000.00, unit: '1', allow: false, qty: 0, isDefault: true },
            { id: 'health-safety-visits', description: 'Health & safety visits', rate: 2500.00, unit: 'Months', allow: false, qty: 0, isDefault: true },
            { id: 'site-board', description: 'Site Board', rate: 5500.00, unit: '1', allow: false, qty: 0, isDefault: true },
            { id: 'hoa-deposit', description: 'HOA/Builders Deposit', rate: 15000.00, unit: '1', allow: false, qty: 0, isDefault: true },
            { id: 'rubble-removal', description: 'General Rubble Removal', rate: 1700.00, unit: 'Weeks', allow: false, qty: 0, isDefault: true },
            { id: 'builders-clean', description: 'Builders Clean at End', rate: 7500.00, unit: '1', allow: false, qty: 0, isDefault: true }
        ],
        
        // Demolish default items
        demolishItems: [
            { id: 'demolish-walls', description: 'Demolish Walls', rate: 20.00, unit: 'm²', allow: false, qty: 0, isDefault: true },
            { id: 'remove-flooring', description: 'Remove Floor Finishes', rate: 15.00, unit: 'm²', allow: false, qty: 0, isDefault: true }
        ],
        
        // Concrete rates by strength
        concreteRates: {
            '20': 1500, // 20 MPa
            '25': 1620, // 25 MPa
            '30': 1750, // 30 MPa
            '35': 1880, // 35 MPa
            '40': 2000  // 40 MPa
        },
        
        // Helper function to merge default items with saved items
        mergeWithDefaults: function(defaultItems, savedItems) {
            if (!savedItems || !Array.isArray(savedItems) || savedItems.length === 0) {
                return [...defaultItems]; // Return a copy of the defaults
            }
            
            const result = [...defaultItems]; // Start with a copy of defaults
            
            // Update default items with saved values
            savedItems.forEach(savedItem => {
                const defaultIndex = result.findIndex(item => item.id === savedItem.id);
                if (defaultIndex >= 0) {
                    // Update the default item
                    result[defaultIndex] = {
                        ...result[defaultIndex], // Keep default properties
                        ...savedItem, // Override with saved properties
                        isDefault: true // Ensure it's still marked as default
                    };
                } else if (!savedItem.isDefault) {
                    // This is a custom item, add it
                    result.push({
                        ...savedItem,
                        isDefault: false
                    });
                }
            });
            
            return result;
        },
        
        // Get P&Gs items, optionally merged with saved data
        getPAndGsItems: function(savedItems) {
            return this.mergeWithDefaults(this.pAndGsItems, savedItems);
        },
        
        // Get Demolish items, optionally merged with saved data
        getDemolishItems: function(savedItems) {
            return this.mergeWithDefaults(this.demolishItems, savedItems);
        },
        
        // Get concrete rate based on strength
        getConcreteRate: function(strength) {
            return this.concreteRates[strength] || this.concreteRates['25']; // Default to 25 MPa
        }
    };
    
    // Export the DataModels
    window.ConstructionApp.DataModels = DataModels;
})();
