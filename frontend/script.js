
// ============================================================================
// CONFIGURATION AND GLOBALS
// ============================================================================
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

let currentUser = null;
let authToken = null;
let fileSystem = {
    files: [],
    folders: [],
    currentPath: ''
};
let selectedItems = new Set();
let currentRenameId = null;
let pendingPhoneNumber = null;
let isSearchMode = false;
let storageOptions = null;
let currentStorageConfig = null;
let migrationSelectedFiles = new Set();


// ✨ Initialize particles background for dynamic feel
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 15;

    for (let i = 0; i < particleCount; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'particle';

            const size = Math.random() * 5 + 5; // 5-10px size
            const left = Math.random() * 100; // 0-100% horizontal position
            const animationDuration = Math.random() * 10 + 10; // 10-20 seconds
            const delay = Math.random() * 1; // 0-10 seconds delay

            particle.style.width = size + 'px';
            particle.style.height = size + 'px';
            particle.style.left = left + '%'; // 
            particle.style.animationDuration = animationDuration + 's'; //
            particle.style.animationDelay = delay + 's'; // Random delay for each particle

            particlesContainer.appendChild(particle);

            // Remove particle after animation
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, (animationDuration + delay) * 1000);
        }, i * 100);
    }
}

// Initialize particles on page load
document.addEventListener('DOMContentLoaded', function () {
    createParticles();

    // Create new particles every 5 seconds for continuous effect
    setInterval(createParticles, 5000);
});




// ============================================================================
// API UTILITY FUNCTIONS
// ============================================================================
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
}

async function apiCall(endpoint, options = {}) {
    try {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            headers: getAuthHeaders(),
            ...options
        };

        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
            config.headers['Content-Type'] = 'application/json';
        }

        if (config.body instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return data;
    } catch (error) {
        console.error('API call failed:', error);

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showConnectionStatus(false);
            throw new Error('Unable to connect to server. Please check your internet connection.');
        }

        throw error;
    }
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================
function showConnectionStatus(isOnline) {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
    statusEl.textContent = isOnline ? '🌐 Connected' : '🌐 Connection Lost';
    statusEl.style.display = 'block';

    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

async function checkConnection() {
    try {
        await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
        showConnectionStatus(true);
    } catch (error) {
        showConnectionStatus(false);
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    document.getElementById('successMessage').style.display = 'none';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 7000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';

    document.getElementById('errorMessage').style.display = 'none';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function saveAuthData(token, user) {
    authToken = token;
    currentUser = user;
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
}

function loadAuthData() {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('currentUser');

    if (token && userStr) {
        try {
            authToken = token;
            currentUser = JSON.parse(userStr);
            return true;
        } catch (error) {
            console.error('Failed to parse stored user data:', error);
            clearAuthData();
        }
    }
    return false;
}

function clearAuthData() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimeType) {
    if (!mimeType) return '📄';

    const type = mimeType.toLowerCase();

    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('presentation') || type.includes('powerpoint')) return '📋';
    if (type.includes('image')) return '🖼️';
    if (type.includes('video')) return '🎥';
    if (type.includes('audio')) return '🎵';
    if (type.includes('zip') || type.includes('archive')) return '📦';
    if (type.includes('text')) return '📄';

    return '📄';
}

function canPreview(mimeType) {
    if (!mimeType) return false;

    const previewableTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
        'text/plain', 'text/html', 'text/css', 'text/javascript', 'text/csv',
        'application/json', 'application/xml',
        'video/mp4', 'video/webm', 'video/ogg',
        'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg'
    ];

    return previewableTypes.includes(mimeType);
}

function getStorageMethodName(method) {
    const names = {
        'saved_messages': 'Saved Messages',
        'private_channel': 'Private Channel',
        'private_group': 'Private Group',
        'bot_storage': 'Bot Storage'
    };
    return names[method] || method;
}

function getStorageMethodIcon(method) {
    const icons = {
        'saved_messages': '💾',
        'private_channel': '📢',
        'private_group': '👥',
        'bot_storage': '🤖'
    };
    return icons[method] || '📁';
}

// ============================================================================
// AUTHENTICATION FUNCTIONS (Same as before)
// ============================================================================
async function sendOTP() {
    const phoneNumber = document.getElementById('loginPhone').value.trim();
    const sendOtpBtn = document.getElementById('sendOtpBtn');

    if (!phoneNumber) {
        showError('Please enter your phone number');
        return;
    }

    if (!phoneNumber.startsWith('+')) {
        showError('Please enter phone number with country code (e.g., +1234567890)');
        return;
    }

    try {
        sendOtpBtn.innerHTML = '<div class="loading"></div> Sending OTP...';
        sendOtpBtn.disabled = true;

        const result = await apiCall('/auth/send-code', {
            method: 'POST',
            body: { phoneNumber }
        });

        if (result.success) {
            pendingPhoneNumber = phoneNumber;
            showSuccess('Verification code sent to your Telegram!');
            document.getElementById('phoneStep').classList.remove('active');
            document.getElementById('otpStep').classList.add('active');
            document.getElementById('otpCode').focus();
        } else {
            throw new Error('Failed to send OTP');
        }
    } catch (error) {
        showError(error.message);
    } finally {
        sendOtpBtn.innerHTML = '📱 Send OTP';
        sendOtpBtn.disabled = false;
    }
}

async function verifyOTP() {
    const otpCode = document.getElementById('otpCode').value.trim();
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');

    if (!otpCode) {
        showError('Please enter the OTP code');
        return;
    }

    if (!pendingPhoneNumber) {
        showError('Session expired. Please request a new OTP.');
        goBackToPhone();
        return;
    }

    try {
        verifyOtpBtn.innerHTML = '<div class="loading"></div> Verifying...';
        verifyOtpBtn.disabled = true;

        const result = await apiCall('/auth/verify-code', {
            method: 'POST',
            body: {
                phoneNumber: pendingPhoneNumber,
                code: otpCode
            }
        });

        if (result.success) {
            saveAuthData(result.token, result.user);
            showSuccess('Successfully logged in!');
            showMainApp();
        } else if (result.requiresPassword) {
            document.getElementById('otpStep').classList.remove('active');
            document.getElementById('passwordStep').classList.add('active');
            document.getElementById('twoFaPassword').focus();
        } else {
            throw new Error('Login failed');
        }
    } catch (error) {
        showError(error.message);
    } finally {
        verifyOtpBtn.innerHTML = '✅ Verify & Login';
        verifyOtpBtn.disabled = false;
    }
}

async function verifyPassword() {
    const password = document.getElementById('twoFaPassword').value.trim();
    const verifyPasswordBtn = document.getElementById('verifyPasswordBtn');

    if (!password) {
        showError('Please enter your 2FA password');
        return;
    }

    if (!pendingPhoneNumber) {
        showError('Session expired. Please request a new OTP.');
        goBackToPhone();
        return;
    }

    try {
        verifyPasswordBtn.innerHTML = '<div class="loading"></div> Verifying...';
        verifyPasswordBtn.disabled = true;

        const result = await apiCall('/auth/verify-password', {
            method: 'POST',
            body: {
                phoneNumber: pendingPhoneNumber,
                password: password
            }
        });

        if (result.success) {
            saveAuthData(result.token, result.user);
            showSuccess('Successfully logged in!');
            showMainApp();
        } else {
            throw new Error('Invalid password');
        }
    } catch (error) {
        showError(error.message);
    } finally {
        verifyPasswordBtn.innerHTML = '🔐 Verify Password';
        verifyPasswordBtn.disabled = false;
    }
}

function goBackToPhone() {
    document.getElementById('otpStep').classList.remove('active');
    document.getElementById('passwordStep').classList.remove('active');
    document.getElementById('phoneStep').classList.add('active');
    document.getElementById('otpCode').value = '';
    document.getElementById('twoFaPassword').value = '';
    pendingPhoneNumber = null;
}

function goBackToOTP() {
    document.getElementById('passwordStep').classList.remove('active');
    document.getElementById('otpStep').classList.add('active');
    document.getElementById('twoFaPassword').value = '';
}

async function showMainApp() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';

    // Update user info
    const userDisplay = `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() +
        ` (${currentUser.phone})`;
    document.getElementById('userPhone').textContent = userDisplay;

    // Load storage options and update UI
    await loadStorageOptions();
    updateStorageIndicator();

    // Load user files
    loadFiles();
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await apiCall('/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.error('Logout API call failed:', error);
        }

        clearAuthData();

        // Reset UI
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('loginContainer').style.display = 'flex';

        // Reset auth steps
        document.querySelectorAll('.auth-step').forEach(step => step.classList.remove('active'));
        document.getElementById('phoneStep').classList.add('active');

        // Clear form data and state
        document.getElementById('loginPhone').value = '';
        document.getElementById('otpCode').value = '';
        document.getElementById('twoFaPassword').value = '';

        fileSystem = { files: [], folders: [], currentPath: '' };
        selectedItems.clear();
        pendingPhoneNumber = null;
        isSearchMode = false;
        storageOptions = null;
        currentStorageConfig = null;
        migrationSelectedFiles.clear();

        showSuccess('Logged out successfully');
    }
}

// ============================================================================
// STORAGE MANAGEMENT FUNCTIONS
// ============================================================================
async function loadStorageOptions() {
    try {
        const result = await apiCall('/storage/options');
        if (result.success) {
            storageOptions = result.options;
            currentStorageConfig = {
                method: result.currentPreference || 'saved_messages',
                config: result.currentConfig || {}
            };
            console.log('Storage options loaded:', storageOptions);
            console.log('Current config:', currentStorageConfig);
        }
    } catch (error) {
        console.error('Error loading storage options:', error);
    }
}

function updateStorageIndicator() {
    const indicator = document.getElementById('storageIndicator');
    const methodSpan = document.getElementById('currentStorageMethod');

    if (currentStorageConfig) {
        const icon = getStorageMethodIcon(currentStorageConfig.method);
        const name = getStorageMethodName(currentStorageConfig.method);

        indicator.innerHTML = `<span>${icon}</span><span>${name}</span>`;
    }
}

async function openStorageSettings() {
    await loadStorageOptions();
    displayStorageOptions();
    document.getElementById('storageSettingsModal').style.display = 'block';
}

function displayStorageOptions() {
    const container = document.getElementById('storageOptions');
    if (!storageOptions) return;

    let html = '';

    // Saved Messages (always available)
    const isSavedSelected = currentStorageConfig.method === 'saved_messages';
    html += `
                <div class="storage-option ${isSavedSelected ? 'selected' : ''}" data-method="saved_messages" data-chat-id="me">
                    <input type="radio" name="storageMethod" value="saved_messages" ${isSavedSelected ? 'checked' : ''}>
                    <div class="storage-option-info">
                        <div class="storage-option-title">💾 Saved Messages</div>
                        <div class="storage-option-desc">Store files in your Telegram Saved Messages (Default & Recommended)</div>
                    </div>
                </div>
            `;

    // Private Channels
    storageOptions.channels.forEach(channel => {
        if (channel.canPost) {
            const isSelected = currentStorageConfig.method === 'private_channel' &&
                currentStorageConfig.config.chatId === channel.id;
            html += `
                        <div class="storage-option ${isSelected ? 'selected' : ''}" data-method="private_channel" data-chat-id="${channel.id}">
                            <input type="radio" name="storageMethod" value="private_channel" ${isSelected ? 'checked' : ''}>
                            <div class="storage-option-info">
                                <div class="storage-option-title">📢 ${channel.name}</div>
                                <div class="storage-option-desc">${channel.description} ${channel.isAutoCreated ? '(Auto-created)' : ''}</div>
                            </div>
                        </div>
                    `;
        }
    });

    // Private Groups
    storageOptions.groups.forEach(group => {
        if (group.canPost) {
            const isSelected = currentStorageConfig.method === 'private_group' &&
                currentStorageConfig.config.chatId === group.id;
            html += `
                        <div class="storage-option ${isSelected ? 'selected' : ''}" data-method="private_group" data-chat-id="${group.id}">
                            <input type="radio" name="storageMethod" value="private_group" ${isSelected ? 'checked' : ''}>
                            <div class="storage-option-info">
                                <div class="storage-option-title">👥 ${group.name}</div>
                                <div class="storage-option-desc">${group.description}</div>
                            </div>
                        </div>
                    `;
        }
    });

    // Bots
    storageOptions.bots.forEach(bot => {
        const isSelected = currentStorageConfig.method === 'bot_storage' &&
            currentStorageConfig.config.botUsername === bot.username;
        html += `
                    <div class="storage-option ${isSelected ? 'selected' : ''}" data-method="bot_storage" data-bot-username="${bot.username}">
                        <input type="radio" name="storageMethod" value="bot_storage" ${isSelected ? 'checked' : ''}>
                        <div class="storage-option-info">
                            <div class="storage-option-title">🤖 ${bot.name}</div>
                            <div class="storage-option-desc">${bot.description}</div>
                        </div>
                    </div>
                `;
    });

    container.innerHTML = html;

    // Add click handlers
    document.querySelectorAll('.storage-option').forEach(option => {
        option.addEventListener('click', function () {
            document.querySelectorAll('.storage-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            this.querySelector('input[type="radio"]').checked = true;
        });
    });

    // Update current storage display
    const currentDisplay = document.getElementById('currentStorageDisplay');
    if (currentStorageConfig) {
        const icon = getStorageMethodIcon(currentStorageConfig.method);
        const name = getStorageMethodName(currentStorageConfig.method);
        currentDisplay.innerHTML = `<span>${icon} ${name}</span>`;
    }
}

async function saveStorageSettings() {
    const selectedOption = document.querySelector('input[name="storageMethod"]:checked');
    if (!selectedOption) {
        showError('Please select a storage method');
        return;
    }

    const method = selectedOption.value;
    const optionElement = selectedOption.closest('.storage-option');
    const chatId = optionElement.dataset.chatId;
    const botUsername = optionElement.dataset.botUsername;

    try {
        const result = await apiCall('/storage/settings', {
            method: 'POST',
            body: {
                method: method,
                chatId: chatId,
                botUsername: botUsername
            }
        });

        if (result.success) {
            currentStorageConfig = {
                method: method,
                config: { chatId: chatId, botUsername: botUsername }
            };
            updateStorageIndicator();
            showSuccess('Storage settings saved successfully!');
            closeModal('storageSettingsModal');
        } else {
            throw new Error('Failed to save settings');
        }
    } catch (error) {
        showError('Failed to save settings: ' + error.message);
    }
}

async function createNewChannel() {
    document.getElementById('storageSettingsModal').style.display = 'none';
    document.getElementById('createChannelModal').style.display = 'block';
}

async function createChannel() {
    const channelName = document.getElementById('channelName').value.trim();
    const category = document.getElementById('channelCategory').value;

    if (!channelName) {
        showError('Please enter a channel name');
        return;
    }

    try {
        const result = await apiCall('/storage/create-channel', {
            method: 'POST',
            body: {
                channelName: channelName,
                category: category
            }
        });

        if (result.success) {
            showSuccess(`Channel "${channelName}" created successfully!`);
            closeModal('createChannelModal');
            document.getElementById('channelName').value = '';
            document.getElementById('channelCategory').value = 'general';

            // Refresh storage options
            await loadStorageOptions();

            // Reopen storage settings if it was open
            if (document.getElementById('storageSettingsModal').style.display === 'none') {
                openStorageSettings();
            }
        } else {
            throw new Error('Failed to create channel');
        }
    } catch (error) {
        showError('Failed to create channel: ' + error.message);
    }
}

async function refreshStorageOptions() {
    await loadStorageOptions();
    displayStorageOptions();
    showSuccess('Storage options refreshed!');
}

// ============================================================================
// FILE MANAGEMENT FUNCTIONS
// ============================================================================
async function loadFiles() {
    try {
        const result = await apiCall(`/files?folderPath=${encodeURIComponent(fileSystem.currentPath)}`);

        if (result.success) {
            fileSystem.files = result.files || [];
            fileSystem.folders = result.folders || [];
            isSearchMode = false;
            hideSearchResultsHeader();
            renderFiles();
        }
    } catch (error) {
        console.error('Failed to load files:', error);
        showError('Failed to load files: ' + error.message);
    }
}

async function searchFiles() {
    const query = document.getElementById('searchInput').value.trim();
    const fileType = document.getElementById('searchType').value;
    const storageMethod = document.getElementById('searchStorage').value;

    if (!query) {
        if (isSearchMode) {
            clearSearch();
        }
        return;
    }

    try {
        isSearchMode = true;
        let searchUrl = `/files/search?q=${encodeURIComponent(query)}`;
        if (fileType) searchUrl += `&type=${encodeURIComponent(fileType)}`;
        if (storageMethod) searchUrl += `&storage=${encodeURIComponent(storageMethod)}`;

        const result = await apiCall(searchUrl);

        if (result.success) {
            fileSystem.files = result.files || [];
            fileSystem.folders = result.folders || [];
            showSearchResultsHeader(query, result.files.length + result.folders.length);
            renderFiles();
        }
    } catch (error) {
        console.error('Search failed:', error);
        showError('Search failed: ' + error.message);
    }
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchType').value = '';
    document.getElementById('searchStorage').value = '';
    isSearchMode = false;
    hideSearchResultsHeader();
    loadFiles();
}

function showSearchResultsHeader(query, count) {
    const header = document.getElementById('searchResultsHeader');
    const countSpan = document.getElementById('searchResultsCount');
    countSpan.textContent = `${count} results for "${query}"`;
    header.style.display = 'block';
}

function hideSearchResultsHeader() {
    document.getElementById('searchResultsHeader').style.display = 'none';
}

function renderFiles() {
    const fileGrid = document.getElementById('fileGrid');
    const uploadZone = document.getElementById('uploadZone');

    const currentFiles = fileSystem.files;
    const currentFolders = fileSystem.folders;

    if (currentFiles.length === 0 && currentFolders.length === 0) {
        if (!isSearchMode) {
            uploadZone.style.display = 'block';
        } else {
            uploadZone.style.display = 'none';
        }
        fileGrid.innerHTML = `<div class="empty-state"><h3>${isSearchMode ? '🔍 No search results' : '📂 No files here yet'}</h3><p>${isSearchMode ? 'Try a different search term' : 'Upload some files to get started!'}</p></div>`;
    } else {
        uploadZone.style.display = 'none';
        let html = '';

        // Render folders first
        currentFolders.forEach(folder => {
            const isSelected = selectedItems.has(`folder-${folder.id}`);
            html += `
                        <div class="file-item ${isSelected ? 'selected' : ''}" onclick="selectItem('folder-${folder.id}')" ondblclick="navigateToFolder('${folder.folderPath ? folder.folderPath + '/' : ''}${folder.folderName}')">
                            <span class="file-icon">📁</span>
                            <div class="file-name">${folder.folderName}</div>
                            <div class="file-size">Folder</div>
                            ${folder.folderPath ? `<div class="file-location">📍 ${folder.folderPath}</div>` : ''}
                            <div class="file-actions">
                                <button class="action-btn btn-danger" onclick="event.stopPropagation(); deleteFolder(${folder.id})">🗑️ Delete</button>
                            </div>
                        </div>
                    `;
        });

        // Render files
        currentFiles.forEach(file => {
            const icon = getFileIcon(file.fileType);
            const size = formatFileSize(file.fileSize);
            const isPreviewable = canPreview(file.fileType);
            const isSelected = selectedItems.has(`file-${file.id}`);
            const storageIcon = getStorageMethodIcon(file.storageMethod);
            const storageName = getStorageMethodName(file.storageMethod);

            html += `
                        <div class="file-item ${isSelected ? 'selected' : ''}" onclick="selectItem('file-${file.id}')">
                            <div class="storage-badge ${file.storageMethod}" title="Stored in: ${storageName}">
                                ${storageIcon}
                            </div>
                            <span class="file-icon">${icon}</span>
                            <div class="file-name">${file.fileName}</div>
                            <div class="file-size">${size}</div>
                            ${file.folderPath ? `<div class="file-location">📍 ${file.folderPath}</div>` : ''}
                            <div class="file-actions">
                                ${isPreviewable ? `<button class="action-btn btn-success" onclick="event.stopPropagation(); previewFile(${file.id})">👁️ Preview </button>` : ''}
                                <button class="action-btn btn-primary" onclick="event.stopPropagation(); downloadFile(${file.id})">⬇️ Download</button>
                                <button class="action-btn btn-danger" onclick="event.stopPropagation(); deleteFile(${file.id})">🗑️ Delete</button>
                            </div>
                        </div>
                    `;
        });

        fileGrid.innerHTML = html;
    }
}

function selectItem(itemId) {
    if (selectedItems.has(itemId)) {
        selectedItems.delete(itemId);
    } else {
        selectedItems.add(itemId);
    }

    renderFiles(); // Re-render to update selection

    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.style.display = selectedItems.size > 0 ? 'block' : 'none';
    }
}

function navigateToFolder(path) {
    fileSystem.currentPath = path.startsWith('/') ? path.substring(1) : path;
    selectedItems.clear();

    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }

    updateBreadcrumb();
    loadFiles();
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    if (!fileSystem.currentPath) {
        breadcrumb.innerHTML = '<a href="#" onclick="navigateToFolder(\'\')">Home</a>';
    } else {
        const parts = fileSystem.currentPath.split('/').filter(part => part);
        let html = '<a href="#" onclick="navigateToFolder(\'\')">Home</a>';
        let currentPath = '';

        parts.forEach(part => {
            currentPath += '/' + part;
            html += ` > <a href="#" onclick="navigateToFolder('${currentPath}')">${part}</a>`;
        });

        breadcrumb.innerHTML = html;
    }
}

// ============================================================================
// UPLOAD FUNCTIONS
// ============================================================================
function showUploadModal() {
    // Update the current storage display
    const storageDisplay = document.getElementById('uploadCurrentStorage');
    if (currentStorageConfig) {
        const icon = getStorageMethodIcon(currentStorageConfig.method);
        const name = getStorageMethodName(currentStorageConfig.method);
        storageDisplay.innerHTML = `${icon} ${name}`;
    }

    document.getElementById('uploadModal').style.display = 'block';
}

function toggleStorageOptions() {
    const checkbox = document.getElementById('useCustomStorage');
    const options = document.getElementById('uploadStorageOptions');
    options.style.display = checkbox.checked ? 'block' : 'none';
}

function loadUploadStorageOptions() {
    if (!storageOptions) return;

    const container = document.getElementById('uploadStorageSelection');
    let html = '';

    // Saved Messages
    html += `
                <div class="storage-option" data-method="saved_messages" data-chat-id="me">
                    <input type="radio" name="uploadStorageMethod" value="saved_messages" checked>
                    <div class="storage-option-info">
                        <div class="storage-option-title">💾 Saved Messages</div>
                        <div class="storage-option-desc">Default storage method</div>
                    </div>
                </div>
            `;

    // Other options
    [...storageOptions.channels, ...storageOptions.groups].forEach(option => {
        if (option.canPost) {
            html += `
                        <div class="storage-option" data-method="${option.type}" data-chat-id="${option.id}">
                            <input type="radio" name="uploadStorageMethod" value="${option.type}">
                            <div class="storage-option-info">
                                <div class="storage-option-title">${getStorageMethodIcon(option.type)} ${option.name}</div>
                                <div class="storage-option-desc">${option.description}</div>
                            </div>
                        </div>
                    `;
        }
    });

    storageOptions.bots.forEach(bot => {
        html += `
                    <div class="storage-option" data-method="bot_storage" data-bot-username="${bot.username}">
                        <input type="radio" name="uploadStorageMethod" value="bot_storage">
                        <div class="storage-option-info">
                            <div class="storage-option-title">🤖 ${bot.name}</div>
                            <div class="storage-option-desc">${bot.description}</div>
                        </div>
                    </div>
                `;
    });

    container.innerHTML = html;

    // Add click handlers
    document.querySelectorAll('#uploadStorageSelection .storage-option').forEach(option => {
        option.addEventListener('click', function () {
            document.querySelectorAll('#uploadStorageSelection .storage-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            this.querySelector('input[type="radio"]').checked = true;
        });
    });
}

// Add this function to the JavaScript section

async function deleteFolder(id) {
    if (!confirm('Are you sure you want to delete this folder? This action cannot be undone.')) {
        return;
    }

    try {
        const result = await apiCall(`/files/folders/${id}`, {
            method: 'DELETE'
        });

        if (result.success) {
            showSuccess('Folder deleted successfully');
            selectedItems.delete(`folder-${id}`);
            loadFiles(); // Refresh the file list
        } else {
            throw new Error('Failed to delete folder');
        }
    } catch (error) {
        console.error('Delete folder error:', error);
        showError('Failed to delete folder: ' + error.message);
    }
}

// Update the deleteSelected function to handle folders
async function deleteSelected() {
    if (selectedItems.size === 0) return;

    if (confirm(`Are you sure you want to delete ${selectedItems.size} selected item(s)?`)) {
        try {
            let deletedCount = 0;
            let errors = [];

            for (const itemId of selectedItems) {
                const [type, id] = itemId.split('-');
                const numId = parseInt(id);

                try {
                    if (type === 'file') {
                        await apiCall(`/files/${numId}`, { method: 'DELETE' });
                    } else if (type === 'folder') {
                        await apiCall(`/files/folders/${numId}`, { method: 'DELETE' });
                    }
                    deletedCount++;
                } catch (error) {
                    errors.push(`Failed to delete ${type} ${numId}: ${error.message}`);
                }
            }

            selectedItems.clear();
            document.getElementById('deleteBtn').style.display = 'none';
            loadFiles();

            if (errors.length > 0) {
                showError(`Deleted ${deletedCount} items, but ${errors.length} failed:\n${errors.join('\n')}`);
            } else {
                showSuccess(`Successfully deleted ${deletedCount} items`);
            }
        } catch (error) {
            showError('Failed to delete items: ' + error.message);
        }
    }
}

// Update the renderFiles function to properly show delete button for folders
function renderFiles() {
    const fileGrid = document.getElementById('fileGrid');
    const uploadZone = document.getElementById('uploadZone');

    const currentFiles = fileSystem.files;
    const currentFolders = fileSystem.folders;

    if (currentFiles.length === 0 && currentFolders.length === 0) {
        if (!isSearchMode) {
            uploadZone.style.display = 'block';
        } else {
            uploadZone.style.display = 'none';
        }
        fileGrid.innerHTML = `<div class="empty-state"><h3>${isSearchMode ? '🔍 No search results' : '📂 No files here yet'}</h3><p>${isSearchMode ? 'Try a different search term' : 'Upload some files to get started!'}</p></div>`;
    } else {
        uploadZone.style.display = 'none';
        let html = '';

        // Render folders first
        currentFolders.forEach(folder => {
            const isSelected = selectedItems.has(`folder-${folder.id}`);
            html += `
                        <div class="file-item ${isSelected ? 'selected' : ''}" onclick="selectItem('folder-${folder.id}')" ondblclick="navigateToFolder('${folder.folderPath ? folder.folderPath + '/' : ''}${folder.folderName}')">
                            <span class="file-icon">📁</span>
                            <div class="file-name">${folder.folderName}</div>
                            <div class="file-size">Folder</div>
                            ${folder.folderPath ? `<div class="file-location">📍 ${folder.folderPath}</div>` : ''}
                            <div class="file-actions">
                                <button class="action-btn btn-danger" onclick="event.stopPropagation(); deleteFolder(${folder.id})" title="Delete Folder">
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    `;
        });

        // Render files
        currentFiles.forEach(file => {
            const icon = getFileIcon(file.fileType);
            const size = formatFileSize(file.fileSize);
            const isPreviewable = canPreview(file.fileType);
            const isSelected = selectedItems.has(`file-${file.id}`);
            const storageIcon = getStorageMethodIcon(file.storageMethod);
            const storageName = getStorageMethodName(file.storageMethod);

            html += `
                        <div class="file-item ${isSelected ? 'selected' : ''}" onclick="selectItem('file-${file.id}')">
                            <div class="storage-badge ${file.storageMethod}" title="Stored in: ${storageName}">
                                ${storageIcon}
                            </div>
                            <span class="file-icon">${icon}</span>
                            <div class="file-name">${file.fileName}</div>
                            <div class="file-size">${size}</div>
                            ${file.folderPath ? `<div class="file-location">📍 ${file.folderPath}</div>` : ''}
                            <div class="file-actions">
                                ${isPreviewable ? `<button class="action-btn btn-success" onclick="event.stopPropagation(); previewFile(${file.id})" title="Preview File">👁️ Preview</button>` : ''}
                                <button class="action-btn btn-primary" onclick="event.stopPropagation(); downloadFile(${file.id})" title="Download File">⬇️ Download</button>
                                <button class="action-btn btn-danger" onclick="event.stopPropagation(); deleteFile(${file.id})" title="Delete File">🗑️ Delete</button>
                            </div>
                        </div>
                    `;
        });

        fileGrid.innerHTML = html;
    }
}


// Update the uploadFiles function to remove manual storage selection
// Enhanced upload function with real-time progress tracking
async function uploadFiles() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    const description = document.getElementById('fileDescription').value.trim();
    
    if (files.length === 0) {
        showError('Please select files to upload');
        return;
    }
    
    // Show enhanced loading overlay
    showLoadingOverlay('Uploading Files...', 'Please wait while we upload your files securely');
    
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const uploadStatus = document.getElementById('uploadStatus');
    
    // Enhanced progress elements
    const progressFillEnhanced = document.getElementById('progressFillEnhanced');
    const uploadStatusEnhanced = document.getElementById('uploadStatusEnhanced');
    
    progressBar.style.display = 'block';
    uploadStatus.innerHTML = '';
    
    try {
        let uploadedCount = 0;
        const totalFiles = files.length;
        let totalSize = 0;
        let uploadedSize = 0;
        
        // Calculate total size of all files
        for (let file of files) {
            totalSize += file.size;
        }
        
        // Track upload start time for speed calculation
        const uploadStartTime = Date.now();
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileStartTime = Date.now();
            
            // Update loading overlay for current file
            updateLoadingProgress(
                `Uploading ${file.name}...`,
                `File ${i + 1} of ${totalFiles} • ${formatFileSize(file.size)}`,
                (uploadedSize / totalSize) * 100,
                false,
                `Preparing ${file.name}...`
            );
            
            // Update modal progress
            uploadStatus.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="loading-spinner-small"></div>
                    <span>Uploading ${file.name}... (${i + 1}/${totalFiles})</span>
                </div>
            `;
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('description', description);
            formData.append('folderPath', fileSystem.currentPath);
            formData.append('useCustomStorage', 'false');

            // Upload with real-time progress tracking
            const result = await uploadFileWithProgress(formData, file, (progressEvent) => {
                const fileProgress = (progressEvent.loaded / progressEvent.total) * 100;
                const totalProgress = ((uploadedSize + progressEvent.loaded) / totalSize) * 100;
                
                // Calculate upload speed and ETA
                const elapsed = (Date.now() - fileStartTime) / 1000;
                const speed = progressEvent.loaded / elapsed;
                const remainingBytes = file.size - progressEvent.loaded;
                const eta = remainingBytes / speed;
                
                // Update progress bars in real-time
                progressFill.style.width = totalProgress + '%';
                progressFillEnhanced.style.width = totalProgress + '%';
                
                // Create detailed status message
                const speedText = formatSpeed(speed);
                const etaText = formatTime(eta);
                const percentText = Math.round(fileProgress);
                
                // Update loading overlay with real-time info
                updateLoadingProgress(
                    `Uploading ${file.name}... ${percentText}%`,
                    `${formatFileSize(progressEvent.loaded)} / ${formatFileSize(file.size)} • ${speedText}`,
                    totalProgress,
                    false,
                    `File ${i + 1} of ${totalFiles} • ETA: ${etaText}`
                );
                
                // Update detailed status in enhanced overlay
                // uploadStatusEnhanced.innerHTML = `
                //     <div class="real-time-status">
                //         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                //             <div style="font-weight: 600; color: #fff;">${file.name}</div>
                //             <div style="font-weight: 600; color: #10b981;">${percentText}%</div>
                //         </div>
                //         <div style="display: flex; justify-content: space-between; font-size: 0.85rem; opacity: 0.9;">
                //             <span>${formatFileSize(progressEvent.loaded)} / ${formatFileSize(file.size)}</span>
                //             <span>${speedText}</span>
                //         </div>
                //         <div style="display: flex; justify-content: space-between; font-size: 0.8rem; opacity: 0.7; margin-top: 4px;">
                //             <span>File ${i + 1} of ${totalFiles}</span>
                //             <span>ETA: ${etaText}</span>
                //         </div>
                //         <div class="upload-speed" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                //             <span>Overall: ${Math.round(totalProgress)}%</span>
                //             <span>${formatFileSize(uploadedSize + progressEvent.loaded)} / ${formatFileSize(totalSize)}</span>
                //         </div>
                //     </div>
                // `;
            });

            if (result.success) {
                uploadedCount++;
                uploadedSize += file.size;
                
                // Show success for current file with celebration
                updateLoadingProgress(
                    `✅ ${file.name} uploaded successfully!`,
                    `${uploadedCount} of ${totalFiles} files completed • ${formatFileSize(uploadedSize)} uploaded`,
                    (uploadedSize / totalSize) * 100,
                    false,
                    `File uploaded in ${formatTime((Date.now() - fileStartTime) / 1000)}`
                );
                
                // Update enhanced status with success
                uploadStatusEnhanced.innerHTML = `
                    <div class="real-time-status">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <span style="color: #10b981; font-size: 1.2rem;">✅</span>
                            <div>
                                <div style="font-weight: 600; color: #10b981;">${file.name}</div>
                                <div style="font-size: 0.85rem; opacity: 0.9;">Upload completed successfully!</div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; opacity: 0.8;">
                            <span>${uploadedCount} of ${totalFiles} files done</span>
                            <span>${formatFileSize(uploadedSize)} / ${formatFileSize(totalSize)}</span>
                        </div>
                    </div>
                `;
                
                // Brief pause to show success
                await new Promise(resolve => setTimeout(resolve, 800));
            } else {
                throw new Error(`Failed to upload ${file.name}`);
            }
        }
        
        // Final success state with upload summary
        const totalUploadTime = (Date.now() - uploadStartTime) / 1000;
        const averageSpeed = totalSize / totalUploadTime;
        
        progressFill.style.width = '100%';
        progressFillEnhanced.style.width = '100%';
        
        updateLoadingProgress(
            `🎉 Upload Complete!`,
            `Successfully uploaded ${uploadedCount} file(s) using ${getStorageMethodName(currentStorageConfig.method)}`,
            100,
            false,
            `Total time: ${formatTime(totalUploadTime)} • Average speed: ${formatSpeed(averageSpeed)}`
        );
        
        uploadStatus.innerHTML = `
            <div style="color: #10b981; display: flex; align-items: center; gap: 10px;">
                <span>✅</span>
                <span>Successfully uploaded ${uploadedCount} file(s) using ${getStorageMethodName(currentStorageConfig.method)}!</span>
            </div>
        `;
        
        // Show final celebration in enhanced status
        uploadStatusEnhanced.innerHTML = `
            <div class="real-time-status" style="text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 10px;">🎉</div>
                <div style="font-weight: 600; color: #10b981; margin-bottom: 8px;">Upload Complete!</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">${uploadedCount} files • ${formatFileSize(totalSize)}</div>
                <div style="font-size: 0.85rem; opacity: 0.8; margin-top: 4px;">
                    Completed in ${formatTime(totalUploadTime)} • Avg speed: ${formatSpeed(averageSpeed)}
                </div>
            </div>
        `;
        
        // Hide loading overlay after a brief success display
        setTimeout(() => {
            hideLoadingOverlay();
            closeModal('uploadModal');
            loadFiles();
            fileInput.value = '';
            document.getElementById('fileDescription').value = '';
            showSuccess(`Successfully uploaded ${uploadedCount} file(s)! 🎉`);
        }, 2500);

    } catch (error) {
        console.error('Upload error:', error);
        
        // Show error in loading overlay
        updateLoadingProgress(
            '❌ Upload Failed',
            error.message,
            0,
            true,
            'Please try again or check your connection'
        );
        
        uploadStatus.innerHTML = `
            <div style="color: #ef4444; display: flex; align-items: center; gap: 10px;">
                <span>❌</span>
                <span>Upload failed: ${error.message}</span>
            </div>
        `;
        
        // Show error details in enhanced status
        uploadStatusEnhanced.innerHTML = `
            <div class="real-time-status" style="text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 10px; color: #ef4444;">❌</div>
                <div style="font-weight: 600; color: #ef4444; margin-bottom: 8px;">Upload Failed</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">${error.message}</div>
                <div style="font-size: 0.85rem; opacity: 0.8; margin-top: 8px;">
                    Please check your connection and try again
                </div>
            </div>
        `;
        
        // Hide loading overlay after showing error
        setTimeout(() => {
            hideLoadingOverlay();
            showError('Failed to upload files: ' + error.message);
        }, 4000);
    }
}

// New function to upload file with real-time progress tracking
async function uploadFileWithProgress(formData, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Set up real-time progress tracking
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                onProgress({
                    loaded: event.loaded,
                    total: event.total,
                    percentage: (event.loaded / event.total) * 100
                });
            }
        });
        
        // Handle successful completion
        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || `HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            } catch (error) {
                reject(new Error('Invalid response from server'));
            }
        });
        
        // Handle network errors
        xhr.addEventListener('error', () => {
            reject(new Error('Network error occurred during upload'));
        });
        
        // Handle aborted uploads
        xhr.addEventListener('abort', () => {
            reject(new Error('Upload was aborted'));
        });
        
        // Handle timeout
        xhr.addEventListener('timeout', () => {
            reject(new Error('Upload timed out. Please try again with a smaller file.'));
        });
        
        // Set timeout (10 minutes for large files)
        xhr.timeout = 10 * 60 * 1000;
        
        // Set up request
        xhr.open('POST', `${API_BASE_URL}/files/upload`);
        
        // Add auth header if available
        if (authToken) {
            xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        }
        
        // Start upload
        xhr.send(formData);
    });
}

// Enhanced loading overlay functions with detailed status
function showLoadingOverlay(title = 'Loading...', subtitle = 'Please wait...') {
    const overlay = document.getElementById('loadingCircleOverlay');
    const titleEl = document.getElementById('loadingText');
    const subtitleEl = document.getElementById('loadingSubtext');
    const progressFill = document.getElementById('progressFillEnhanced');
    const statusEl = document.getElementById('uploadStatusEnhanced');
    
    titleEl.textContent = title;
    subtitleEl.textContent = subtitle;
    progressFill.style.width = '0%';
    statusEl.innerHTML = `
        <div class="real-time-status">
            <div style="text-align: center; opacity: 0.8;">Preparing upload...Please wait!!..</div>
        </div>
    `;
    
    overlay.style.display = 'flex';
    
    // Add fade-in animation
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.opacity = '1';
        overlay.style.transition = 'opacity 0.3s ease';
    }, 10);
}

function updateLoadingProgress(title, subtitle, progress, isError = false, additionalInfo = '') {
    const titleEl = document.getElementById('loadingText');
    const subtitleEl = document.getElementById('loadingSubtext');
    const progressFill = document.getElementById('progressFillEnhanced');
    
    titleEl.textContent = title;
    subtitleEl.innerHTML = additionalInfo ? `${subtitle}<br><small style="opacity: 0.8;">${additionalInfo}</small>` : subtitle;
    progressFill.style.width = progress + '%';
    
    // Apply color coding based on state
    if (isError) {
        titleEl.style.color = '#ef4444';
        progressFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
    } else if (progress === 100) {
        titleEl.style.color = '#10b981';
        progressFill.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    } else {
        titleEl.style.color = 'white';
        progressFill.style.background = 'linear-gradient(90deg, #667eea, #764ba2, #f093fb)';
    }
    
    // Add shimmer effect for active uploads
    if (progress > 0 && progress < 100 && !isError) {
        progressFill.classList.add('shimmer-effect');
    } else {
        progressFill.classList.remove('shimmer-effect');
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingCircleOverlay');
    
    overlay.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity = '0';
    
    setTimeout(() => {
        overlay.style.display = 'none';
        
        // Reset styles
        const titleEl = document.getElementById('loadingText');
        const progressFill = document.getElementById('progressFillEnhanced');
        
        titleEl.style.color = 'white';
        progressFill.style.background = 'linear-gradient(90deg, #667eea, #764ba2, #f093fb)';
        progressFill.classList.remove('shimmer-effect');
    }, 300);
}

// Speed and time formatting helpers
function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond === 0 || !isFinite(bytesPerSecond)) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let size = bytesPerSecond;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return '0s';
    
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

// Enhanced file size formatting
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Enhanced button loading state
function setButtonLoading(buttonId, isLoading, loadingText = 'Loading...') {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `<div class="loading-spinner-small"></div> ${loadingText}`;
    } else {
        button.disabled = false;
        button.innerHTML = button.getAttribute('data-original-text') || 'Upload Files';
    }
}

// Store original button text for restoration
document.addEventListener('DOMContentLoaded', function() {
    const uploadButton = document.querySelector('#uploadModal .btn-primary');
    if (uploadButton) {
        uploadButton.setAttribute('data-original-text', uploadButton.innerHTML);
    }
});
// ============================================================================
// FILE OPERATIONS
// ============================================================================
async function previewFile(id) {
    try {
        const file = fileSystem.files.find(f => f.id === id);
        if (!file) {
            showError('File not found');
            return;
        }

        document.getElementById('previewTitle').textContent = `Preview: ${file.fileName}`;
        document.getElementById('previewContainer').innerHTML = '<div style="text-align: center; padding: 40px;"><div class="loading"></div><br>Loading preview...</div>';

        document.getElementById('downloadFromPreview').onclick = () => downloadFile(id);
        document.getElementById('previewModal').style.display = 'block';

        const response = await fetch(`${API_BASE_URL}/files/${id}/preview`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Preview not available');
        }

        const contentType = response.headers.get('content-type');
        const container = document.getElementById('previewContainer');

        if (contentType.startsWith('image/')) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            container.innerHTML = `<img src="${url}" class="preview-image" alt="${file.fileName}">`;
        } else if (contentType === 'application/pdf') {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            container.innerHTML = `<iframe src="${url}" class="preview-pdf"></iframe>`;
        } else if (contentType.startsWith('video/')) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            container.innerHTML = `<video src="${url}" class="preview-video" controls></video>`;
        } else if (contentType.startsWith('audio/')) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            container.innerHTML = `<audio src="${url}" class="preview-audio" controls></audio>`;
        } else if (contentType.startsWith('text/')) {
            const text = await response.text();
            container.innerHTML = `<div class="preview-text">${text}</div>`;
        } else {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Preview not available for this file type</div>';
        }

    } catch (error) {
        console.error('Preview failed:', error);
        document.getElementById('previewContainer').innerHTML = '<div style="text-align: center; padding: 40px; color: #f44336;">Preview failed: ' + error.message + '</div>';
    }
}

async function downloadFile(id) {
    try {
        const file = fileSystem.files.find(f => f.id === id);
        if (!file) {
            showError('File not found');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/files/${id}/download`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        showSuccess(`Downloaded ${file.fileName}!`);
    } catch (error) {
        console.error('Download failed:', error);
        showError('Download failed: ' + error.message);
    }
}

async function deleteFile(id) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }

    try {
        const result = await apiCall(`/files/${id}`, {
            method: 'DELETE'
        });

        if (result.success) {
            showSuccess('File deleted successfully');
            selectedItems.delete(`file-${id}`);
            loadFiles();
        } else {
            throw new Error('Failed to delete file');
        }
    } catch (error) {
        showError('Failed to delete file: ' + error.message);
    }
}

async function deleteSelected() {
    if (selectedItems.size === 0) return;

    if (confirm(`Are you sure you want to delete ${selectedItems.size} selected item(s)?`)) {
        try {
            for (const itemId of selectedItems) {
                const [type, id] = itemId.split('-');
                const numId = parseInt(id);

                if (type === 'file') {
                    await apiCall(`/files/${numId}`, { method: 'DELETE' });
                }
            }

            selectedItems.clear();
            document.getElementById('deleteBtn').style.display = 'none';
            loadFiles();
            showSuccess('Selected items deleted successfully');
        } catch (error) {
            showError('Failed to delete items: ' + error.message);
        }
    }
}

// ============================================================================
// FOLDER OPERATIONS
// ============================================================================
function createFolder() {
    document.getElementById('folderModal').style.display = 'block';
}

async function confirmCreateFolder() {
    const folderName = document.getElementById('folderName').value.trim();

    if (!folderName) {
        showError('Please enter a folder name');
        return;
    }

    try {
        const result = await apiCall('/files/folders', {
            method: 'POST',
            body: {
                folderName: folderName,
                folderPath: fileSystem.currentPath
            }
        });

        if (result.success) {
            showSuccess('Folder created successfully');
            loadFiles();
            closeModal('folderModal');
            document.getElementById('folderName').value = '';
        } else {
            throw new Error('Failed to create folder');
        }
    } catch (error) {
        showError('Failed to create folder: ' + error.message);
    }
}

function refreshFiles() {
    loadFiles();
    selectedItems.clear();

    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================
async function openMigrationModal() {
    await loadStorageOptions();
    await loadMigrationFiles();
    displayMigrationStorageOptions();
    document.getElementById('migrationModal').style.display = 'block';
}

async function loadMigrationFiles() {
    try {
        const result = await apiCall('/files/search?q='); // Get all files
        if (result.success) {
            const container = document.getElementById('migrationFiles');
            let html = '';

            result.files.forEach(file => {
                const storageIcon = getStorageMethodIcon(file.storageMethod);
                const storageName = getStorageMethodName(file.storageMethod);

                html += `
                            <div class="migration-file">
                                <input type="checkbox" class="migration-file-checkbox" data-file-id="${file.id}" data-storage-method="${file.storageMethod}">
                                <span>${getFileIcon(file.fileType)}</span>
                                <div style="flex: 1;">
                                    <div><strong>${file.fileName}</strong></div>
                                    <div style="font-size: 12px; color: #666;">
                                        ${formatFileSize(file.fileSize)} • ${storageIcon} ${storageName}
                                        ${file.folderPath ? ` • 📍 ${file.folderPath}` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
            });

            container.innerHTML = html || '<div style="text-align: center; color: #666;">No files found</div>';
        }
    } catch (error) {
        console.error('Failed to load migration files:', error);
        showError('Failed to load files for migration');
    }
}

function displayMigrationStorageOptions() {
    const container = document.getElementById('migrationStorageOptions');
    if (!storageOptions) return;

    let html = '';

    // Saved Messages
    html += `
                <div class="storage-option" data-method="saved_messages" data-chat-id="me">
                    <input type="radio" name="migrationStorageMethod" value="saved_messages">
                    <div class="storage-option-info">
                        <div class="storage-option-title">💾 Saved Messages</div>
                        <div class="storage-option-desc">Move files to Saved Messages</div>
                    </div>
                </div>
            `;

    // Channels
    storageOptions.channels.forEach(channel => {
        if (channel.canPost) {
            html += `
                        <div class="storage-option" data-method="private_channel" data-chat-id="${channel.id}">
                            <input type="radio" name="migrationStorageMethod" value="private_channel">
                            <div class="storage-option-info">
                                <div class="storage-option-title">📢 ${channel.name}</div>
                                <div class="storage-option-desc">${channel.description}</div>
                            </div>
                        </div>
                    `;
        }
    });

    // Groups
    storageOptions.groups.forEach(group => {
        if (group.canPost) {
            html += `
                        <div class="storage-option" data-method="private_group" data-chat-id="${group.id}">
                            <input type="radio" name="migrationStorageMethod" value="private_group">
                            <div class="storage-option-info">
                                <div class="storage-option-title">👥 ${group.name}</div>
                                <div class="storage-option-desc">${group.description}</div>
                            </div>
                        </div>
                    `;
        }
    });

    // Bots
    storageOptions.bots.forEach(bot => {
        html += `
                    <div class="storage-option" data-method="bot_storage" data-bot-username="${bot.username}">
                        <input type="radio" name="migrationStorageMethod" value="bot_storage">
                        <div class="storage-option-info">
                            <div class="storage-option-title">🤖 ${bot.name}</div>
                            <div class="storage-option-desc">${bot.description}</div>
                        </div>
                    </div>
                `;
    });

    container.innerHTML = html;

    // Add click handlers
    document.querySelectorAll('#migrationStorageOptions .storage-option').forEach(option => {
        option.addEventListener('click', function () {
            document.querySelectorAll('#migrationStorageOptions .storage-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            this.querySelector('input[type="radio"]').checked = true;
        });
    });
}

function toggleAllFiles() {
    const selectAll = document.getElementById('selectAllFiles');
    const checkboxes = document.querySelectorAll('.migration-file-checkbox');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}

function selectByStorageMethod() {
    const selectByStorage = document.getElementById('selectByStorage');
    if (!selectByStorage.checked) return;

    const storageMethod = prompt('Enter storage method to select (saved_messages, private_channel, private_group, bot_storage):');
    if (!storageMethod) return;

    const checkboxes = document.querySelectorAll('.migration-file-checkbox');
    checkboxes.forEach(checkbox => {
        if (checkbox.dataset.storageMethod === storageMethod) {
            checkbox.checked = true;
        }
    });
}

async function startMigration() {
    const selectedFiles = Array.from(document.querySelectorAll('.migration-file-checkbox:checked'))
        .map(checkbox => parseInt(checkbox.dataset.fileId));

    if (selectedFiles.length === 0) {
        showError('Please select files to migrate');
        return;
    }

    const selectedStorageOption = document.querySelector('input[name="migrationStorageMethod"]:checked');
    if (!selectedStorageOption) {
        showError('Please select a destination storage method');
        return;
    }

    const storageElement = selectedStorageOption.closest('.storage-option');
    const newStorageConfig = {
        method: selectedStorageOption.value,
        chatId: storageElement.dataset.chatId,
        botUsername: storageElement.dataset.botUsername
    };

    const progress = document.getElementById('migrationProgress');
    const progressFill = document.getElementById('migrationProgressFill');
    const status = document.getElementById('migrationStatus');
    const startBtn = document.getElementById('startMigrationBtn');

    try {
        progress.style.display = 'block';
        startBtn.disabled = true;
        startBtn.textContent = 'Migrating...';

        status.textContent = `Starting migration of ${selectedFiles.length} files...`;
        progressFill.style.width = '0%';

        const result = await apiCall('/storage/migrate', {
            method: 'POST',
            body: {
                fileIds: selectedFiles,
                newStorageConfig: newStorageConfig
            }
        });

        if (result.success) {
            progressFill.style.width = '100%';
            status.innerHTML = `
                        ✅ Migration completed!<br>
                        Successfully migrated: ${result.migratedFiles.length} files<br>
                        ${result.errors.length > 0 ? `Errors: ${result.errors.length} files` : ''}
                    `;

            if (result.errors.length > 0) {
                console.error('Migration errors:', result.errors);
            }

            setTimeout(() => {
                closeModal('migrationModal');
                loadFiles(); // Refresh file list
            }, 3000);
        } else {
            throw new Error('Migration failed');
        }
    } catch (error) {
        status.textContent = `❌ Migration failed: ${error.message}`;
        showError('Migration failed: ' + error.message);
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = 'Start Migration';
    }
}

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================
async function openStatsModal() {
    document.getElementById('statsModal').style.display = 'block';
    await loadStats();
}

async function loadStats() {
    try {
        const result = await apiCall('/files/stats');
        if (result.success) {
            displayStats(result.stats);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
        showError('Failed to load statistics');
    }
}

function displayStats(stats) {
    const container = document.getElementById('storageStats');
    const detailedContainer = document.getElementById('detailedStats');

    // Main stats
    let html = `
                <div class="stat-card">
                    <div class="stat-number">${stats.totalFiles}</div>
                    <div class="stat-label">Total Files</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${formatFileSize(stats.totalStorage)}</div>
                    <div class="stat-label">Total Storage</div>
                </div>
            `;

    // Storage method breakdown
    if (stats.storageBreakdown && stats.storageBreakdown.length > 0) {
        stats.storageBreakdown.forEach(item => {
            const icon = getStorageMethodIcon(item.storage_method);
            const name = getStorageMethodName(item.storage_method);
            html += `
                        <div class="stat-card">
                            <div class="stat-number">${item.count}</div>
                            <div class="stat-label">${icon} ${name}</div>
                        </div>
                    `;
        });
    }

    container.innerHTML = html;

    // Detailed breakdown
    let detailedHtml = '<h3>File Type Breakdown</h3>';
    if (stats.typeBreakdown && stats.typeBreakdown.length > 0) {
        detailedHtml += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 15px;">';
        stats.typeBreakdown.forEach(type => {
            detailedHtml += `
                        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0;">
                            <div style="font-weight: bold;">${getFileIcon(type.file_type)} ${type.file_type || 'Unknown'}</div>
                            <div style="color: #666; font-size: 14px;">${type.count} files</div>
                            <div style="color: #666; font-size: 14px;">${formatFileSize(type.size)}</div>
                        </div>
                    `;
        });
        detailedHtml += '</div>';
    }

    detailedContainer.innerHTML = detailedHtml;
}

async function refreshStats() {
    await loadStats();
    showSuccess('Statistics refreshed!');
}

// ============================================================================
// DRAG AND DROP FUNCTIONALITY
// ============================================================================
function dragOverHandler(ev) {
    ev.preventDefault();
    document.getElementById('uploadZone').classList.add('dragover');
}

function dragLeaveHandler(ev) {
    document.getElementById('uploadZone').classList.remove('dragover');
}

async function dropHandler(ev) {
    ev.preventDefault();
    document.getElementById('uploadZone').classList.remove('dragover');

    const files = ev.dataTransfer.files;
    if (files.length === 0) return;

    try {
        for (let file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folderPath', fileSystem.currentPath);
            formData.append('useCustomStorage', 'false');

            await apiCall('/files/upload', {
                method: 'POST',
                body: formData
            });
        }

        showSuccess(`Successfully uploaded ${files.length} file(s)!`);
        loadFiles();
    } catch (error) {
        showError('Failed to upload files: ' + error.message);
    }
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';

    if (modalId === 'uploadModal') {
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        const uploadStatus = document.getElementById('uploadStatus');

        if (progressBar) progressBar.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        if (uploadStatus) uploadStatus.innerHTML = '';
    }

    if (modalId === 'migrationModal') {
        const progress = document.getElementById('migrationProgress');
        if (progress) progress.style.display = 'none';
        migrationSelectedFiles.clear();
    }
}

// ============================================================================
// EVENT LISTENERS AND INITIALIZATION
// ============================================================================

// Close modals when clicking outside
window.onclick = function (event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Add enter key listeners for forms
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('loginPhone').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') sendOTP();
    });

    document.getElementById('otpCode').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') verifyOTP();
    });

    document.getElementById('twoFaPassword').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') verifyPassword();
    });

    document.getElementById('folderName').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') confirmCreateFolder();
    });

    document.getElementById('channelName').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') createChannel();
    });
});

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================
async function init() {
    try {
        // Check if user is already logged in
        if (loadAuthData()) {
            try {
                // Verify token is still valid
                const result = await apiCall('/auth/me');
                if (result.success) {
                    currentUser = result.user;
                    showMainApp();
                    return;
                }
            } catch (error) {
                console.log('Stored token is invalid, showing login');
                clearAuthData();
            }
        }

        // Show login screen
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';

        // Check server connection
        await checkConnection();

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application');
    }
}

// Start the application
init();

// Check connection periodically
setInterval(checkConnection, 30000); // Check every 30 seconds
