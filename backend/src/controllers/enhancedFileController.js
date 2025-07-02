const enhancedTelegramService = require('../services/enhancedTelegramService');
const telegramService = require('../services/telegramService'); // Keep old service for compatibility
const database = require('../config/database');
const { validateFile } = require('../middleware/upload');
const path = require('path');

class EnhancedFileController {
    // Helper function to sanitize folder paths
    sanitizeFolderPath(folderPath) {
        if (!folderPath) return '';
        
        // Remove dangerous characters and normalize
        const sanitized = folderPath
            .replace(/[<>:"|?*]/g, '') // Remove forbidden characters
            .replace(/\.\./g, '') // Remove parent directory references
            .replace(/^[\/\\]+/, '') // Remove leading slashes
            .replace(/[\/\\]+$/, '') // Remove trailing slashes
            .replace(/[\/\\]+/g, '/') // Normalize separators
            .trim();
            
        // Ensure it doesn't exceed reasonable length
        return sanitized.substring(0, 255);
    }
    
    // Helper function to validate storage configuration
    validateStorageConfig(storageConfig) {
        const errors = [];
        
        if (!storageConfig || typeof storageConfig !== 'object') {
            errors.push('Invalid storage configuration');
            return errors;
        }
        
        const { method, chatId, botUsername } = storageConfig;
        
        // Validate method
        const allowedMethods = ['saved_messages', 'private_channel', 'private_group', 'bot_storage'];
        if (!method || !allowedMethods.includes(method)) {
            errors.push('Invalid storage method. Must be one of: ' + allowedMethods.join(', '));
        }
        
        // Validate chatId for non-saved_messages methods
        if (method !== 'saved_messages') {
            if (!chatId || (chatId !== 'me' && !/^-?\d+$/.test(chatId.toString()))) {
                errors.push('Invalid chat ID for selected storage method');
            }
        }
        
        // Validate botUsername for bot storage
        if (method === 'bot_storage') {
            if (!botUsername || typeof botUsername !== 'string' || botUsername.trim() === '') {
                errors.push('Bot username is required for bot storage method');
            }
        }
        
        return errors;
    }

    async uploadFile(req, res) {
        try {
            // Enhanced file validation
            if (!req.file) {
                return res.status(400).json({ 
                    error: 'No file provided',
                    message: 'Please select a file to upload'
                });
            }

            // Additional file validation
            const fileValidationErrors = validateFile(req.file);
            if (fileValidationErrors.length > 0) {
                return res.status(400).json({ 
                    error: 'File validation failed',
                    message: fileValidationErrors.join('; '),
                    details: fileValidationErrors
                });
            }

            const user = req.user;
            const description = (req.body.description || '').trim();
            const rawFolderPath = req.body.folderPath || '';
            const folderPath = this.sanitizeFolderPath(rawFolderPath);
            const useCustomStorage = req.body.useCustomStorage === 'true';

            // Log upload attempt
            console.log('Processing file upload:', {
                userId: user.id,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                fileType: req.file.mimetype,
                folderPath: folderPath,
                useCustomStorage: useCustomStorage
            });

            let uploadResult;
            let storageMethod = 'saved_messages';
            let chatId = 'me';

            // Determine storage configuration
            let storageConfig = { method: 'saved_messages', chatId: 'me' };

            if (useCustomStorage) {
                // Use custom storage from upload form
                storageMethod = req.body.storageMethod || 'saved_messages';
                chatId = req.body.chatId || 'me';
                const botUsername = req.body.botUsername;
                
                storageConfig = {
                    method: storageMethod,
                    chatId: chatId,
                    botUsername: botUsername
                };
                
                console.log('Using custom storage config:', storageConfig);
            } else {
                // Use user's saved storage preference
                if (user.storage_preference && user.storage_preference !== 'saved_messages') {
                    try {
                        const userStorageConfig = JSON.parse(user.storage_config || '{}');
                        storageConfig = {
                            method: user.storage_preference,
                            chatId: userStorageConfig.chatId || 'me',
                            botUsername: userStorageConfig.botUsername
                        };
                        storageMethod = user.storage_preference;
                        chatId = userStorageConfig.chatId || 'me';
                        
                        console.log('Using user storage preference:', storageConfig);
                    } catch (error) {
                        console.error('Error parsing user storage config, falling back to saved messages:', error);
                        // Fallback to saved messages
                    }
                }
            }

            // Validate storage configuration
            const storageConfigErrors = this.validateStorageConfig(storageConfig);
            if (storageConfigErrors.length > 0) {
                return res.status(400).json({ 
                    error: 'Invalid storage configuration',
                    message: storageConfigErrors.join('; '),
                    details: storageConfigErrors
                });
            }

            // Upload using the determined storage method with enhanced error handling
            try {
                if (storageConfig.method === 'saved_messages') {
                    // Use the original service for saved messages (more stable)
                    uploadResult = await telegramService.uploadFile(
                        user.session_string,
                        req.file,
                        description
                    );
                    uploadResult.chatId = 'me';
                    uploadResult.method = 'saved_messages';
                } else {
                    // Use enhanced service for other storage methods
                    uploadResult = await enhancedTelegramService.uploadFileWithMethod(
                        user.session_string,
                        req.file,
                        description,
                        storageConfig
                    );
                }
                
                console.log('Upload successful:', {
                    messageId: uploadResult.messageId,
                    chatId: uploadResult.chatId,
                    method: uploadResult.method
                });
                
            } catch (uploadError) {
                console.error('Upload failed:', uploadError);
                
                // Provide user-friendly error messages
                let errorMessage = 'File upload failed';
                if (uploadError.message.includes('FLOOD_WAIT')) {
                    errorMessage = 'Upload rate limit exceeded. Please wait before trying again.';
                } else if (uploadError.message.includes('FILE_TOO_BIG')) {
                    errorMessage = 'File is too large for the selected storage method.';
                } else if (uploadError.message.includes('ENTITY_BOUNDS_INVALID')) {
                    errorMessage = 'Invalid storage destination. Please check your storage settings.';
                } else if (uploadError.message.includes('CHAT_WRITE_FORBIDDEN')) {
                    errorMessage = 'Cannot upload to the selected chat. Please check permissions.';
                } else if (uploadError.message.includes('SESSION_EXPIRED')) {
                    errorMessage = 'Your session has expired. Please log in again.';
                } else if (uploadError.message.includes('timeout') || uploadError.message.includes('TIMEOUT')) {
                    errorMessage = 'Upload timed out. Please try again with a smaller file or check your connection.';
                }
                
                return res.status(500).json({
                    error: 'Upload failed',
                    message: errorMessage,
                    details: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
                });
            }

            // Store file metadata in database with enhanced error handling
            const db = database.getDb();
            try {
                const fileId = await new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO files (user_id, file_name, file_type, file_size, telegram_message_id, telegram_chat_id, storage_method, folder_path, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            user.id,
                            req.file.originalname,
                            req.file.mimetype,
                            req.file.size,
                            uploadResult.messageId,
                            uploadResult.chatId || 'me',
                            uploadResult.method || 'saved_messages',
                            folderPath,
                            description
                        ],
                        function(err) {
                            if (err) {
                                console.error('Database error storing file metadata:', err);
                                reject(err);
                            } else {
                                console.log('File metadata stored with ID:', this.lastID);
                                resolve(this.lastID);
                            }
                        }
                    );
                });

                // Success response
                res.json({
                    success: true,
                    file: {
                        id: fileId,
                        fileName: req.file.originalname,
                        fileSize: req.file.size,
                        fileType: req.file.mimetype,
                        telegramMessageId: uploadResult.messageId,
                        telegramChatId: uploadResult.chatId || 'me',
                        storageMethod: uploadResult.method || 'saved_messages',
                        folderPath: folderPath,
                        description: description,
                        uploadedAt: new Date().toISOString()
                    },
                    message: 'File uploaded successfully'
                });
                
            } catch (dbError) {
                console.error('Database error after successful upload:', dbError);
                
                // Try to clean up the uploaded file from Telegram
                try {
                    if (storageConfig.method === 'saved_messages') {
                        await telegramService.deleteFile(user.session_string, uploadResult.messageId);
                    } else {
                        await enhancedTelegramService.deleteFileFromStorage(
                            user.session_string, 
                            uploadResult.messageId, 
                            uploadResult.chatId
                        );
                    }
                } catch (cleanupError) {
                    console.error('Failed to cleanup uploaded file after database error:', cleanupError);
                }
                
                return res.status(500).json({
                    error: 'Database error',
                    message: 'File uploaded but failed to save metadata. Please try again.'
                });
            }

        } catch (error) {
            console.error('Upload file error:', error);
            
            // Enhanced error response
            const isValidationError = error.message && (
                error.message.includes('validation') || 
                error.message.includes('Invalid') ||
                error.message.includes('required')
            );
            
            const statusCode = isValidationError ? 400 : 500;
            
            res.status(statusCode).json({ 
                error: 'Upload failed',
                message: error.message || 'An unexpected error occurred during file upload',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    // ... rest of the methods remain the same
    async getFiles(req, res) {
        try {
            const user = req.user;
            const folderPath = req.query.folderPath || '';

            console.log('Getting files for user:', user.id, 'in folder:', folderPath);

            const db = database.getDb();
            
            // Get files with storage method info
            const files = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM files WHERE user_id = ? AND folder_path = ? ORDER BY created_at DESC',
                    [user.id, folderPath],
                    (err, rows) => {
                        if (err) {
                            console.error('Database error getting files:', err);
                            reject(err);
                        } else {
                            resolve(rows || []);
                        }
                    }
                );
            });

            // Get folders
            const folders = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM folders WHERE user_id = ? AND folder_path = ? ORDER BY created_at DESC',
                    [user.id, folderPath],
                    (err, rows) => {
                        if (err) {
                            console.error('Database error getting folders:', err);
                            reject(err);
                        } else {
                            resolve(rows || []);
                        }
                    }
                );
            });

            res.json({
                success: true,
                files: files.map(file => ({
                    id: file.id,
                    fileName: file.file_name,
                    fileType: file.file_type,
                    fileSize: file.file_size,
                    telegramMessageId: file.telegram_message_id,
                    telegramChatId: file.telegram_chat_id,
                    storageMethod: file.storage_method,
                    folderPath: file.folder_path,
                    description: file.description,
                    createdAt: file.created_at
                })),
                folders: folders.map(folder => ({
                    id: folder.id,
                    folderName: folder.folder_name,
                    folderPath: folder.folder_path,
                    createdAt: folder.created_at
                }))
            });

        } catch (error) {
            console.error('Get files error:', error);
            res.status(500).json({ 
                error: 'Failed to get files: ' + error.message 
            });
        }
    }

    async searchFiles(req, res) {
        try {
            const user = req.user;
            const query = req.query.q || '';
            const fileType = req.query.type || '';
            const storageMethod = req.query.storage || '';

            if (!query.trim()) {
                return res.json({
                    success: true,
                    files: [],
                    folders: []
                });
            }

            console.log('Searching files for user:', user.id, 'query:', query);

            const db = database.getDb();
            
            // Build search conditions
            let fileSearchQuery = `
                SELECT * FROM files 
                WHERE user_id = ? 
                AND (
                    file_name LIKE ? OR 
                    description LIKE ? OR 
                    folder_path LIKE ?
                )
            `;
            let fileSearchParams = [user.id, `%${query}%`, `%${query}%`, `%${query}%`];

            // Add file type filter if specified
            if (fileType) {
                fileSearchQuery += ' AND file_type LIKE ?';
                fileSearchParams.push(`%${fileType}%`);
            }

            // Add storage method filter if specified
            if (storageMethod) {
                fileSearchQuery += ' AND storage_method = ?';
                fileSearchParams.push(storageMethod);
            }

            fileSearchQuery += ' ORDER BY created_at DESC LIMIT 100';

            // Search files
            const files = await new Promise((resolve, reject) => {
                db.all(fileSearchQuery, fileSearchParams, (err, rows) => {
                    if (err) {
                        console.error('Database error searching files:', err);
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                });
            });

            // Search folders
            const folders = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM folders WHERE user_id = ? AND folder_name LIKE ? ORDER BY created_at DESC LIMIT 50',
                    [user.id, `%${query}%`],
                    (err, rows) => {
                        if (err) {
                            console.error('Database error searching folders:', err);
                            reject(err);
                        } else {
                            resolve(rows || []);
                        }
                    }
                );
            });

            res.json({
                success: true,
                query: query,
                searchResults: true,
                files: files.map(file => ({
                    id: file.id,
                    fileName: file.file_name,
                    fileType: file.file_type,
                    fileSize: file.file_size,
                    telegramMessageId: file.telegram_message_id,
                    telegramChatId: file.telegram_chat_id,
                    storageMethod: file.storage_method,
                    folderPath: file.folder_path,
                    description: file.description,
                    createdAt: file.created_at
                })),
                folders: folders.map(folder => ({
                    id: folder.id,
                    folderName: folder.folder_name,
                    folderPath: folder.folder_path,
                    createdAt: folder.created_at
                }))
            });

        } catch (error) {
            console.error('Search files error:', error);
            res.status(500).json({ 
                error: 'Failed to search files: ' + error.message 
            });
        }
    }

    async previewFile(req, res) {
        try {
            const user = req.user;
            const fileId = req.params.id;

            console.log('Previewing file:', fileId, 'for user:', user.id);

            const db = database.getDb();
            const file = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM files WHERE id = ? AND user_id = ?',
                    [fileId, user.id],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }

            // Check if file type is previewable
            const previewableTypes = [
                'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
                'application/pdf',
                'text/plain', 'text/html', 'text/css', 'text/javascript', 'text/csv',
                'application/json', 'application/xml',
                'video/mp4', 'video/webm', 'video/ogg',
                'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg'
            ];

            if (!previewableTypes.includes(file.file_type)) {
                return res.status(400).json({ 
                    error: 'File type not supported for preview'
                });
            }

            // Download from appropriate storage location
            let fileBuffer;
            if (file.storage_method === 'saved_messages') {
                fileBuffer = await telegramService.downloadFile(
                    user.session_string,
                    file.telegram_message_id
                );
            } else {
                fileBuffer = await enhancedTelegramService.downloadFileFromStorage(
                    user.session_string,
                    file.telegram_message_id,
                    file.telegram_chat_id
                );
            }

            // Set appropriate headers for preview
            res.setHeader('Content-Type', file.file_type);
            res.setHeader('Content-Length', fileBuffer.length);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
            if (file.file_type.startsWith('image/') || file.file_type === 'application/pdf') {
                res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
            } else {
                res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
            }

            res.send(fileBuffer);

        } catch (error) {
            console.error('Preview file error:', error);
            res.status(500).json({ 
                error: 'Failed to preview file: ' + error.message 
            });
        }
    }

    async downloadFile(req, res) {
        try {
            const user = req.user;
            const fileId = req.params.id;

            console.log('Downloading file:', fileId, 'for user:', user.id);

            const db = database.getDb();
            const file = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM files WHERE id = ? AND user_id = ?',
                    [fileId, user.id],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }

            // Download from appropriate storage location
            let fileBuffer;
            if (file.storage_method === 'saved_messages') {
                fileBuffer = await telegramService.downloadFile(
                    user.session_string,
                    file.telegram_message_id
                );
            } else {
                fileBuffer = await enhancedTelegramService.downloadFileFromStorage(
                    user.session_string,
                    file.telegram_message_id,
                    file.telegram_chat_id
                );
            }

            // Set appropriate headers for download
            res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
            res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
            res.setHeader('Content-Length', fileBuffer.length);

            res.send(fileBuffer);

        } catch (error) {
            console.error('Download file error:', error);
            res.status(500).json({ 
                error: 'Failed to download file: ' + error.message 
            });
        }
    }

    async deleteFile(req, res) {
        try {
            const user = req.user;
            const fileId = req.params.id;

            console.log('Deleting file:', fileId, 'for user:', user.id);

            const db = database.getDb();
            const file = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM files WHERE id = ? AND user_id = ?',
                    [fileId, user.id],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }

            // Delete from appropriate storage location
            if (file.storage_method === 'saved_messages') {
                await telegramService.deleteFile(
                    user.session_string,
                    file.telegram_message_id
                );
            } else {
                await enhancedTelegramService.deleteFileFromStorage(
                    user.session_string,
                    file.telegram_message_id,
                    file.telegram_chat_id
                );
            }

            // Delete from database
            await new Promise((resolve, reject) => {
                db.run(
                    'DELETE FROM files WHERE id = ? AND user_id = ?',
                    [fileId, user.id],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            res.json({ success: true, message: 'File deleted successfully' });

        } catch (error) {
            console.error('Delete file error:', error);
            res.status(500).json({ 
                error: 'Failed to delete file: ' + error.message 
            });
        }
    }

    async createFolder(req, res) {
        try {
            const user = req.user;
            const { folderName, folderPath } = req.body;

            // Enhanced validation
            if (!folderName || typeof folderName !== 'string' || folderName.trim() === '') {
                return res.status(400).json({ 
                    error: 'Invalid folder name',
                    message: 'Folder name is required and must be a non-empty string'
                });
            }

            const sanitizedFolderName = folderName.trim();
            const sanitizedFolderPath = this.sanitizeFolderPath(folderPath || '');

            // Validate folder name for dangerous characters
            if (/[<>:"|?*\\\/]/.test(sanitizedFolderName)) {
                return res.status(400).json({ 
                    error: 'Invalid folder name',
                    message: 'Folder name contains invalid characters. Please use only letters, numbers, spaces, and basic punctuation.'
                });
            }

            // Check name length
            if (sanitizedFolderName.length > 100) {
                return res.status(400).json({ 
                    error: 'Invalid folder name',
                    message: 'Folder name must be 100 characters or less'
                });
            }

            console.log('Creating folder:', sanitizedFolderName, 'at path:', sanitizedFolderPath, 'for user:', user.id);

            const db = database.getDb();

            // Check for duplicate folder names in the same path
            const existingFolder = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT id, folder_name FROM folders WHERE user_id = ? AND folder_name = ? AND folder_path = ?',
                    [user.id, sanitizedFolderName, sanitizedFolderPath],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (existingFolder) {
                return res.status(409).json({ 
                    error: 'Folder already exists',
                    message: `A folder named "${sanitizedFolderName}" already exists in this location`,
                    existingFolderId: existingFolder.id
                });
            }

            // Create the folder
            const folderId = await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO folders (user_id, folder_name, folder_path) VALUES (?, ?, ?)',
                    [user.id, sanitizedFolderName, sanitizedFolderPath],
                    function(err) {
                        if (err) {
                            console.error('Database error creating folder:', err);
                            reject(err);
                        } else {
                            console.log('Folder created with ID:', this.lastID);
                            resolve(this.lastID);
                        }
                    }
                );
            });

            res.json({
                success: true,
                folder: {
                    id: folderId,
                    folderName: sanitizedFolderName,
                    folderPath: sanitizedFolderPath,
                    createdAt: new Date().toISOString()
                },
                message: 'Folder created successfully'
            });

        } catch (error) {
            console.error('Create folder error:', error);
            res.status(500).json({ 
                error: 'Failed to create folder',
                message: error.message || 'An unexpected error occurred while creating the folder'
            });
        }
    }

    async deleteFolder(req, res) {
        try {
            const user = req.user;
            const folderId = req.params.id;

            console.log('Deleting folder:', folderId, 'for user:', user.id);

            const db = database.getDb();
            
            // Get folder metadata
            const folder = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM folders WHERE id = ? AND user_id = ?',
                    [folderId, user.id],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!folder) {
                return res.status(404).json({ error: 'Folder not found' });
            }

            // Build the full folder path
            const fullFolderPath = folder.folder_path ? 
                `${folder.folder_path}/${folder.folder_name}` : 
                folder.folder_name;

            console.log('Full folder path to delete:', fullFolderPath);

            // Check if folder has any files
            const filesInFolder = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT COUNT(*) as count FROM files WHERE user_id = ? AND folder_path LIKE ?',
                    [user.id, `${fullFolderPath}%`],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows[0].count || 0);
                    }
                );
            });

            console.log('Files in folder:', filesInFolder);

            if (filesInFolder > 0) {
                return res.status(400).json({ 
                    error: `Cannot delete folder. It contains ${filesInFolder} file(s). Please move or delete the files first.` 
                });
            }

            // Check if folder has any subfolders
            const subfoldersInFolder = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT COUNT(*) as count FROM folders WHERE user_id = ? AND folder_path LIKE ?',
                    [user.id, `${fullFolderPath}%`],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows[0].count || 0);
                    }
                );
            });

            console.log('Subfolders in folder:', subfoldersInFolder);

            if (subfoldersInFolder > 0) {
                return res.status(400).json({ 
                    error: `Cannot delete folder. It contains ${subfoldersInFolder} subfolder(s). Please delete the subfolders first.` 
                });
            }

            // Delete the folder from database
            await new Promise((resolve, reject) => {
                db.run(
                    'DELETE FROM folders WHERE id = ? AND user_id = ?',
                    [folderId, user.id],
                    (err) => {
                        if (err) {
                            console.error('Database error deleting folder:', err);
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });

            console.log('Folder deleted successfully');

            res.json({ 
                success: true, 
                message: 'Folder deleted successfully' 
            });

        } catch (error) {
            console.error('Delete folder error:', error);
            res.status(500).json({ 
                error: 'Failed to delete folder: ' + error.message 
            });
        }
    }


    async getFileStats(req, res) {
        try {
            const user = req.user;

            console.log('Getting comprehensive file statistics for user:', user.id);

            const db = database.getDb();

            // Get total files and storage usage
            const stats = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT 
                        COUNT(*) as totalFiles,
                        SUM(file_size) as totalStorage,
                        AVG(file_size) as averageFileSize,
                        MIN(file_size) as smallestFile,
                        MAX(file_size) as largestFile
                    FROM files WHERE user_id = ?`,
                    [user.id],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            // Get storage method breakdown with enhanced details
            const storageBreakdown = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        storage_method,
                        COUNT(*) as count,
                        SUM(file_size) as size,
                        AVG(file_size) as averageSize,
                        MIN(created_at) as firstUpload,
                        MAX(created_at) as lastUpload
                    FROM files 
                    WHERE user_id = ? 
                    GROUP BY storage_method 
                    ORDER BY count DESC`,
                    [user.id],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            // Enhanced file type breakdown with categorization
            const typeBreakdown = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        file_type,
                        COUNT(*) as count,
                        SUM(file_size) as size,
                        AVG(file_size) as averageSize
                    FROM files 
                    WHERE user_id = ? 
                    GROUP BY file_type 
                    ORDER BY count DESC`,
                    [user.id],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            // Categorize file types
            const categorizeFileType = (mimeType) => {
                if (!mimeType) return 'unknown';
                if (mimeType.startsWith('image/')) return 'images';
                if (mimeType.startsWith('video/')) return 'videos';
                if (mimeType.startsWith('audio/')) return 'audio';
                if (mimeType.startsWith('text/') || mimeType.includes('document') || mimeType.includes('pdf')) return 'documents';
                if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('7z')) return 'archives';
                return 'other';
            };

            // Group by categories
            const categoryStats = typeBreakdown.reduce((acc, item) => {
                const category = categorizeFileType(item.file_type);
                if (!acc[category]) {
                    acc[category] = { count: 0, size: 0, types: [] };
                }
                acc[category].count += item.count;
                acc[category].size += item.size || 0;
                acc[category].types.push({
                    mimeType: item.file_type,
                    count: item.count,
                    size: item.size
                });
                return acc;
            }, {});

            // Get folder statistics
            const folderStats = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        folder_path,
                        COUNT(*) as fileCount,
                        SUM(file_size) as totalSize
                    FROM files 
                    WHERE user_id = ? 
                    GROUP BY folder_path 
                    ORDER BY fileCount DESC`,
                    [user.id],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            // Get recent activity (last 30 days)
            const recentActivity = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as uploads,
                        SUM(file_size) as sizeUploaded
                    FROM files 
                    WHERE user_id = ? 
                    AND created_at >= datetime('now', '-30 days')
                    GROUP BY DATE(created_at) 
                    ORDER BY date DESC`,
                    [user.id],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            // Calculate additional insights
            const insights = {
                totalFiles: stats.totalFiles || 0,
                totalStorage: stats.totalStorage || 0,
                averageFileSize: Math.round(stats.averageFileSize || 0),
                smallestFile: stats.smallestFile || 0,
                largestFile: stats.largestFile || 0,
                storageUtilization: {
                    byMethod: storageBreakdown.map(item => ({
                        method: item.storage_method,
                        count: item.count,
                        size: item.size || 0,
                        percentage: stats.totalFiles > 0 ? Math.round((item.count / stats.totalFiles) * 100) : 0,
                        averageSize: Math.round(item.averageSize || 0),
                        firstUpload: item.firstUpload,
                        lastUpload: item.lastUpload
                    })),
                    byCategory: Object.entries(categoryStats).map(([category, data]) => ({
                        category,
                        count: data.count,
                        size: data.size,
                        percentage: stats.totalFiles > 0 ? Math.round((data.count / stats.totalFiles) * 100) : 0,
                        types: data.types.sort((a, b) => b.count - a.count)
                    })).sort((a, b) => b.count - a.count),
                    byFolder: folderStats.map(item => ({
                        path: item.folder_path || '/',
                        fileCount: item.fileCount,
                        totalSize: item.totalSize || 0,
                        percentage: stats.totalFiles > 0 ? Math.round((item.fileCount / stats.totalFiles) * 100) : 0
                    }))
                },
                recentActivity: recentActivity,
                summary: {
                    mostUsedStorageMethod: storageBreakdown.length > 0 ? storageBreakdown[0].storage_method : null,
                    mostCommonFileType: typeBreakdown.length > 0 ? categorizeFileType(typeBreakdown[0].file_type) : null,
                    activeFolder: folderStats.length > 0 ? folderStats[0].folder_path || '/' : '/',
                    recentUploads: recentActivity.length > 0 ? recentActivity.reduce((sum, day) => sum + day.uploads, 0) : 0
                }
            };

            // Add performance timing
            const responseTime = Date.now();

            res.json({
                success: true,
                stats: insights,
                generatedAt: new Date().toISOString(),
                responseTime: `${Date.now() - responseTime}ms`
            });

        } catch (error) {
            console.error('Get file stats error:', error);
            res.status(500).json({ 
                error: 'Failed to get file statistics',
                message: error.message || 'An unexpected error occurred while generating statistics'
            });
        }
    }
}

module.exports = new EnhancedFileController();