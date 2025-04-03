// js/client-ui.js - Manages the New Client and Open Client modals
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let clientModalOverlay = null; // Reference to the main overlay element

    // --- Private Functions (Moved from dashboard.js) ---

    /**
     * Creates the HTML content for the client modal (New or Open).
     * Also attaches necessary event listeners for elements within the modal.
     * @param {'new' | 'open'} type - The type of modal to create.
     * @returns {HTMLElement} The modal div element containing the content.
     */
    function createClientModal(type) {
        const modal = document.createElement('div');
        modal.className = 'modal'; // Use the CSS class defined in index.html
        const overlayId = 'client-modal-overlay'; // ID of the overlay for close buttons

        if (type === 'new') {
            // HTML for the New Client form
            modal.innerHTML = `
                <div class="modal-header">
                    <h2 class="modal-title">New Client</h2>
                    <span class="modal-close" data-modal-id="${overlayId}" title="Close">×</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="client-name">Client Name:</label>
                        <input type="text" id="client-name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="client-address">Client Address:</label>
                        <input type="text" id="client-address" class="form-control">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button>
                    <button class="btn btn-save" id="save-new-client-btn">Save Client</button>
                </div>`;

            // Attach listeners AFTER appending to DOM (using setTimeout ensures elements exist)
            setTimeout(() => {
                setupModalCloseButtons(modal, overlayId); // Setup close/cancel buttons

                // Setup Save button listener
                const saveBtn = modal.querySelector('#save-new-client-btn');
                if (saveBtn) {
                    saveBtn.addEventListener('click', () => {
                        const nameInput = modal.querySelector('#client-name');
                        const addressInput = modal.querySelector('#client-address');
                        const name = nameInput.value.trim();
                        const address = addressInput.value.trim();

                        if (!name) { // Basic validation
                            alert('Client name is required.');
                            nameInput.focus();
                            return;
                        }

                        // Prepare client data
                        const newClientData = { name: name, address: address, moduleData: {} };

                        // Use ClientManager to add and set the client
                        if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
                            // Disable button while saving
                            saveBtn.disabled = true;
                            saveBtn.textContent = 'Saving...';

                            window.ConstructionApp.ClientManager.addClient(newClientData, (success, result) => {
                                // Re-enable button
                                saveBtn.disabled = false;
                                saveBtn.textContent = 'Save Client';

                                if (success) {
                                    const addedClient = result; // addClient callback returns the client object
                                    // Set the newly added client as current
                                    window.ConstructionApp.ClientManager.setCurrentClient(addedClient);
                                    // The updateDashboard callback in dashboard.js will handle UI updates
                                    alert(`Client "${name}" created and selected.`);
                                    if(clientModalOverlay) clientModalOverlay.style.display = 'none'; // Close modal
                                } else {
                                    alert(`Error creating client: ${result || 'Unknown error'}`);
                                }
                            });
                        } else {
                            alert("Error: ClientManager is not available.");
                        }
                    });
                }
            }, 0);

        } else if (type === 'open') {
            // HTML for the Open Client list
            const clients = window.ConstructionApp?.ClientManager?.getAllClients() || [];
            let clientListHTML = '';

            if (clients.length > 0) {
                // Sort clients alphabetically
                clients.sort((a, b) => a.name.localeCompare(b.name));
                // Create list items
                clientListHTML = clients.map(client =>
                    `<div class="client-list-item" data-client-id="${client.id}">${client.name}</div>`
                ).join('');
            } else {
                clientListHTML = '<div style="padding: 15px; text-align: center; color: #666;">No existing clients found.</div>';
            }

            modal.innerHTML = `
                <div class="modal-header">
                    <h2 class="modal-title">Open Client</h2>
                    <span class="modal-close" data-modal-id="${overlayId}" title="Close">×</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="client-search">Search Clients:</label>
                        <input type="text" id="client-search" class="form-control" placeholder="Type to filter...">
                    </div>
                    <div class="client-list">${clientListHTML}</div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button>
                    </div>`;

            // Attach listeners AFTER appending to DOM
            setTimeout(() => {
                setupModalCloseButtons(modal, overlayId); // Setup close/cancel buttons
                setupClientListSelection(modal); // Setup clicks on client list items
                setupClientSearch(modal); // Setup search input filtering
            }, 0);
        }

        return modal; // Return the created modal element
    }

    /**
     * Adds event listeners to close/cancel buttons within a modal.
     * Uses cloning to prevent duplicate listeners if modal content is regenerated.
     * @param {HTMLElement} modal - The modal element containing the buttons.
     * @param {string} overlayId - The ID of the overlay to hide.
     */
    function setupModalCloseButtons(modal, overlayId) {
        const closeBtns = modal.querySelectorAll(`.modal-close[data-modal-id="${overlayId}"], .btn-cancel[data-modal-id="${overlayId}"]`);
        closeBtns.forEach(btn => {
            // Clone and replace to ensure no duplicate listeners from previous modal openings
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            // Add listener to the new button
            newBtn.addEventListener('click', () => {
                // Find the overlay using the stored reference or by ID
                const overlay = clientModalOverlay || document.getElementById(overlayId);
                if (overlay) overlay.style.display = 'none';
            });
        });
        console.log("[ClientUI] Modal close buttons setup.");
    }

    /**
     * Sets up filtering for the client list in the 'Open Client' modal.
     * @param {HTMLElement} modal - The modal element containing the list and search input.
     */
    function setupClientSearch(modal) {
        const searchInput = modal.querySelector('#client-search');
        const clientListContainer = modal.querySelector('.client-list');

        if (searchInput && clientListContainer) {
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                 clearTimeout(debounceTimer);
                 debounceTimer = setTimeout(() => {
                    const searchTerm = searchInput.value.toLowerCase().trim();
                    const clientItems = clientListContainer.querySelectorAll('.client-list-item');
                    clientItems.forEach(item => {
                        // Check if it's a valid client item before accessing textContent
                        if (item.dataset.clientId) {
                            const clientName = item.textContent.toLowerCase();
                            // Show/hide based on search term match
                            item.style.display = (searchTerm === '' || clientName.includes(searchTerm)) ? 'block' : 'none';
                        }
                    });
                }, 150); // Debounce slightly
            });
             console.log("[ClientUI] Client search input setup.");
        }
    }

    /**
     * Sets up click listener for selecting a client from the list in the 'Open Client' modal.
     * Uses event delegation on the list container.
     * @param {HTMLElement} modal - The modal element containing the client list.
     */
    function setupClientListSelection(modal) {
        const clientListContainer = modal.querySelector('.client-list');
        if (!clientListContainer) {
             console.error("[ClientUI] Client list container not found for selection setup.");
             return;
        }

        // Use event delegation on the container
        clientListContainer.addEventListener('click', (event) => {
            const listItem = event.target.closest('.client-list-item');

            // Check if a valid client item was clicked
            if (listItem && listItem.dataset.clientId) {
                const clientId = listItem.dataset.clientId;
                console.log("[ClientUI] Client selected:", clientId);

                // Get client data from ClientManager
                const clients = window.ConstructionApp?.ClientManager?.getAllClients() || [];
                const selectedClient = clients.find(c => c.id === clientId);

                if (selectedClient) {
                    // Use ClientManager to set the current client
                    if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
                        window.ConstructionApp.ClientManager.setCurrentClient(selectedClient);
                        // The updateDashboard callback in dashboard.js will handle UI updates
                        alert(`Client "${selectedClient.name}" selected.`);
                        if(clientModalOverlay) clientModalOverlay.style.display = 'none'; // Close the modal
                    } else {
                        alert("Error: ClientManager not available.");
                    }
                } else {
                    alert("Error: Could not find the selected client's data.");
                    console.error("[ClientUI] Selected client ID not found in ClientManager data:", clientId);
                }
            }
        });
         console.log("[ClientUI] Client list selection setup.");
    }

    // --- Initialization Function ---

    /**
     * Sets up listeners for New/Open client buttons and ensures the modal overlay exists.
     * This function is called once when the application loads.
     */
    function initClientUI() {
        console.log("[ClientUI] Initializing...");

        const newClientBtn = document.getElementById('new-client-btn');
        const openClientBtn = document.getElementById('open-client-btn');
        // Find or create the single overlay for client modals
        clientModalOverlay = document.getElementById('client-modal-overlay');

        if (!clientModalOverlay) {
            console.warn("[ClientUI] Client modal overlay #client-modal-overlay not found in HTML, creating it.");
            clientModalOverlay = document.createElement('div');
            clientModalOverlay.className = 'modal-overlay';
            clientModalOverlay.id = 'client-modal-overlay';
            clientModalOverlay.style.display = 'none'; // Start hidden
            document.body.appendChild(clientModalOverlay);
            // Add click outside to close listener ONCE during initialization
            clientModalOverlay.addEventListener('click', (event) => {
                if (event.target === clientModalOverlay) { // Only if clicking the overlay itself
                    clientModalOverlay.style.display = 'none';
                }
            });
        }

        // Attach listener to "New Client" button
        if (newClientBtn) {
            // Clone/replace to prevent duplicate listeners on hot-reload scenarios (less critical here)
            const newBtn = newClientBtn.cloneNode(true);
            newClientBtn.parentNode.replaceChild(newBtn, newClientBtn);
            newBtn.addEventListener('click', () => {
                console.log("[ClientUI] New Client button clicked.");
                const modalContent = createClientModal('new'); // Create the modal content
                clientModalOverlay.innerHTML = ''; // Clear previous modal content
                clientModalOverlay.appendChild(modalContent); // Add the new content
                clientModalOverlay.style.display = 'flex'; // Show the overlay
            });
        } else {
             console.warn("[ClientUI] New Client button #new-client-btn not found.");
        }

        // Attach listener to "Open Client" button
        if (openClientBtn) {
             // Clone/replace
             const openBtn = openClientBtn.cloneNode(true);
             openClientBtn.parentNode.replaceChild(openBtn, openClientBtn);
             openBtn.addEventListener('click', () => {
                 console.log("[ClientUI] Open Client button clicked.");
                 // Ensure latest client list is available before rendering modal
                 if (window.ConstructionApp.ClientManager) {
                    window.ConstructionApp.ClientManager.loadClients().then(() => {
                        const modalContent = createClientModal('open'); // Create the modal content
                        clientModalOverlay.innerHTML = ''; // Clear previous modal content
                        clientModalOverlay.appendChild(modalContent); // Add the new content
                        clientModalOverlay.style.display = 'flex'; // Show the overlay
                    }).catch(err => {
                        console.error("[ClientUI] Failed to load clients before opening modal:", err);
                        alert("Error loading client list. Please try again.");
                    });
                 } else {
                     alert("Error: ClientManager not available to load client list.");
                 }
            });
        } else {
             console.warn("[ClientUI] Open Client button #open-client-btn not found.");
        }
         console.log("[ClientUI] Initialization complete.");
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.ClientUI = {
        init: initClientUI
    };

})(); // Immediately invoke the function
