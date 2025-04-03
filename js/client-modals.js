// js/client-modals.js
// Handles the setup and interactions for the New Client and Open Client modals.

(function() {
    // Ensure the main app namespace exists
    window.ConstructionApp = window.ConstructionApp || {};

    /**
     * Sets up listeners for the "New Client" and "Open Client" buttons.
     */
    function setupClientManagement() {
        console.log("[ClientModals] Setting up client management buttons");
        const newClientBtn = document.getElementById('new-client-btn');
        const openClientBtn = document.getElementById('open-client-btn');
        let clientModalOverlay = document.getElementById('client-modal-overlay');

        // Ensure the modal overlay exists in the DOM
        if (!clientModalOverlay) {
            console.warn("[ClientModals] Client modal overlay not found, creating it.");
            clientModalOverlay = document.createElement('div');
            clientModalOverlay.className = 'modal-overlay';
            clientModalOverlay.id = 'client-modal-overlay';
            clientModalOverlay.style.display = 'none'; // Start hidden
            document.body.appendChild(clientModalOverlay);
            // Add listener to close on overlay click
            clientModalOverlay.addEventListener('click', (event) => {
                if (event.target === clientModalOverlay) {
                    clientModalOverlay.style.display = 'none';
                }
            });
        }

        // New Client Button
        if (newClientBtn) {
            newClientBtn.addEventListener('click', () => {
                // Ensure overlay exists before proceeding
                const overlay = document.getElementById('client-modal-overlay');
                if (!overlay) {
                    console.error("[ClientModals] Cannot open modal: Overlay not found.");
                    return;
                }
                const clientModal = createClientModal('new'); // Generate modal content
                overlay.innerHTML = ''; // Clear previous content
                overlay.appendChild(clientModal); // Add new modal
                overlay.style.display = 'flex'; // Show overlay
            });
        } else {
             console.warn("[ClientModals] 'New Client' button not found.");
        }

        // Open Client Button
        if (openClientBtn) {
            openClientBtn.addEventListener('click', () => {
                 // Ensure overlay exists before proceeding
                const overlay = document.getElementById('client-modal-overlay');
                if (!overlay) {
                    console.error("[ClientModals] Cannot open modal: Overlay not found.");
                    return;
                }
                const clientModal = createClientModal('open'); // Generate modal content
                overlay.innerHTML = ''; // Clear previous content
                overlay.appendChild(clientModal); // Add new modal
                overlay.style.display = 'flex'; // Show overlay
            });
        } else {
             console.warn("[ClientModals] 'Open Client' button not found.");
        }
    }

    /**
     * Creates the HTML content for the client modal (New or Open).
     * @param {string} type - 'new' or 'open'.
     * @returns {HTMLElement} The modal div element.
     */
    function createClientModal(type) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        const overlayId = 'client-modal-overlay'; // ID of the overlay to close

        // Dependencies
        const ClientManager = window.ConstructionApp?.ClientManager;
        const DebugPanelUpdate = window.ConstructionApp?.DebugPanel?.update;

        if (type === 'new') {
            // HTML for the New Client modal
            modal.innerHTML = `
                <div class="modal-header">
                    <h2 class="modal-title">New Client</h2>
                    <span class="modal-close" data-modal-id="${overlayId}">&times;</span>
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

            // Attach listeners after a brief delay to ensure elements are in DOM
            setTimeout(() => {
                setupModalCloseButtons(modal, overlayId); // Setup Cancel and X buttons
                const saveBtn = modal.querySelector('#save-new-client-btn');
                if (saveBtn) {
                    saveBtn.addEventListener('click', () => {
                        const nameInput = modal.querySelector('#client-name');
                        const addressInput = modal.querySelector('#client-address');
                        const name = nameInput.value.trim();
                        const address = addressInput.value.trim();

                        if (!name) {
                            alert('Client name is required.');
                            nameInput.focus();
                            return;
                        }

                        // Prepare new client data
                        const newClientData = {
                            name: name,
                            address: address,
                            moduleData: {} // Initialize with empty module data
                        };

                        console.log("[ClientModals] Creating new client:", name);

                        // Use ClientManager to add and set the new client
                        if (ClientManager) {
                            ClientManager.addClient(newClientData, (success, result) => {
                                 if (success) {
                                      const addedClient = result;
                                      ClientManager.setCurrentClient(addedClient); // Set as current
                                      if (DebugPanelUpdate) DebugPanelUpdate(); // Update debug info
                                      alert(`Client "${name}" created and selected.`);
                                      const overlay = document.getElementById(overlayId);
                                      if (overlay) overlay.style.display = 'none'; // Close modal
                                 } else {
                                      console.error("[ClientModals] Error adding client via ClientManager:", result);
                                      alert(`Error creating client: ${result || 'Unknown error'}`);
                                 }
                            });
                        } else {
                             alert("Error: ClientManager is not available to save the client.");
                        }
                    });
                }
            }, 0);

        } else if (type === 'open') {
            // HTML for the Open Client modal
            const clients = ClientManager?.getAllClients() || [];
            let clientListHTML = '';

            if (clients.length > 0) {
                // Sort clients alphabetically by name
                clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
                    <span class="modal-close" data-modal-id="${overlayId}">&times;</span>
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

            // Attach listeners after a brief delay
            setTimeout(() => {
                setupModalCloseButtons(modal, overlayId); // Setup Cancel and X buttons
                setupClientListSelection(modal); // Handle clicking on a client item
                setupClientSearch(modal); // Handle filtering the list
            }, 0);
        }

        return modal; // Return the created modal element
    }

    /**
     * Attaches close listeners to Cancel and X buttons within a modal.
     * Clones buttons to prevent duplicate listeners.
     * @param {HTMLElement} modal - The modal element.
     * @param {string} overlayId - The ID of the overlay element to hide.
     */
    function setupModalCloseButtons(modal, overlayId) {
        const closeBtns = modal.querySelectorAll(`.modal-close[data-modal-id="${overlayId}"], .btn-cancel[data-modal-id="${overlayId}"]`);
        closeBtns.forEach(btn => {
            // Clone and replace to ensure only one listener is attached
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                const overlay = document.getElementById(overlayId);
                if (overlay) {
                    overlay.style.display = 'none';
                } else {
                    console.error("[ClientModals] Overlay not found:", overlayId);
                }
            });
        });
    }

    /**
     * Sets up the search functionality for the client list in the "Open Client" modal.
     * @param {HTMLElement} modal - The modal element containing the list and search input.
     */
    function setupClientSearch(modal) {
        const searchInput = modal.querySelector('#client-search');
        const clientListContainer = modal.querySelector('.client-list');

        if (searchInput && clientListContainer) {
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase().trim();
                const clientItems = clientListContainer.querySelectorAll('.client-list-item');
                clientItems.forEach(item => {
                    // Check if item represents a client (has data-client-id)
                    if (item.dataset.clientId) {
                        const clientName = item.textContent.toLowerCase();
                        // Show item if search term is empty or matches client name
                        item.style.display = (searchTerm === '' || clientName.includes(searchTerm)) ? 'block' : 'none';
                    }
                });
            });
        }
    }

    /**
     * Sets up the click listener for selecting a client from the list in the "Open Client" modal.
     * @param {HTMLElement} modal - The modal element containing the client list.
     */
    function setupClientListSelection(modal) {
        const clientListContainer = modal.querySelector('.client-list');
        if (!clientListContainer) return;

        // Dependencies
        const ClientManager = window.ConstructionApp?.ClientManager;
        const DebugPanelUpdate = window.ConstructionApp?.DebugPanel?.update;


        clientListContainer.addEventListener('click', (event) => {
            const listItem = event.target.closest('.client-list-item');
            // Ensure a valid client item was clicked
            if (listItem && listItem.dataset.clientId) {
                const clientId = listItem.dataset.clientId;
                const clients = ClientManager?.getAllClients() || [];
                const selectedClient = clients.find(c => c.id === clientId);

                if (selectedClient) {
                    console.log("[ClientModals] Selecting client:", selectedClient.name);
                    // Set the selected client as current using ClientManager
                     if (ClientManager) {
                          ClientManager.setCurrentClient(selectedClient);
                          if (DebugPanelUpdate) DebugPanelUpdate(); // Update debug info
                          const overlay = modal.closest('.modal-overlay');
                          if (overlay) overlay.style.display = 'none'; // Close modal
                          alert(`Client "${selectedClient.name}" selected.`);
                     } else {
                          alert("Error: ClientManager not available to set the client.");
                     }
                } else {
                    console.error("[ClientModals] Selected client ID not found in ClientManager list:", clientId);
                    alert("Error: Could not find the selected client's data.");
                }
            }
        });
    }

    // Expose the setup function on the global namespace
    window.ConstructionApp.ClientModals = {
        setup: setupClientManagement
    };

})();
