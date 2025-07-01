const enhancedTelegramService = require('../services/enhancedTelegramService');
const telegramService = require('../services/telegramService'); // Keep old service for compatibility
const database = require('../config/database');

class EnhancedFileController {
    async uploadFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file provided' });
            }

            const user = req.user;
            const description = req.body.description || '';
            const folderPath = req.body.folderPath || '';
            const useCustomStorage = req.body.useCustomStorage === 'true';

            console.log('Uploading file for user:', user.id);
            console.log('Use custom storage:', useCustomStorage);
            console.log('User storage preference:', user.storage_preference);
            console.log('User storage config:', user.storage_config);

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

            // Upload using the determined storage method
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

            // Store file metadata in database
            const db = database.getDb();
            const fileId = await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO files (user_id, file_name, file_type, file_size, telegram_message_id, telegram_chat_id, storage_method, folder_path, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        user.id,
                        req.file.originalname,
                        req.file.mimetype,
                        req.file.size,
                        uploadResult.messageId,
                        uploadResult.chatId || chatId,
                        uploadResult.method || storageMethod,
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

            res.json({
                success: true,
                file: {
                    id: fileId,
                    fileName: req.file.originalname,
                    fileSize: req.file.size,
                    fileType: req.file.mimetype,
                    telegramMessageId: uploadResult.messageId,
                    telegramChatId: uploadResult.chatId || chatId,
                    storageMethod: uploadResult.method || storageMethod,
                    folderPath: folderPath,
                    description: description
                }
            });

        } catch (error) {
            console.error('Upload file error:', error);
            res.status(500).json({ 
                error: 'Failed to upload file: ' + error.message 
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

            if (!folderName) {
                return res.status(400).json({ error: 'Folder name is required' });
            }

            console.log('Creating folder:', folderName, 'for user:', user.id);

            const db = database.getDb();
            const folderId = await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO folders (user_id, folder_name, folder_path) VALUES (?, ?, ?)',
                    [user.id, folderName, folderPath || ''],
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
                    folderName: folderName,
                    folderPath: folderPath || ''
                }
            });

        } catch (error) {
            console.error('Create folder error:', error);
            res.status(500).json({ 
                error: 'Failed to create folder: ' + error.message 
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

            console.log('Getting file statistics for user:', user.id);

            const db = database.getDb();

            // Get total files and storage usage
            const stats = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT 
                        COUNT(*) as totalFiles,
                        SUM(file_size) as totalStorage
                    FROM files WHERE user_id = ?`,
                    [user.id],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            // Get storage method breakdown
            const storageBreakdown = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        storage_method,
                        COUNT(*) as count,
                        SUM(file_size) as size
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

            // Get file type breakdown
            const typeBreakdown = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
                        file_type,
                        COUNT(*) as count,
                        SUM(file_size) as size
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

            res.json({
                success: true,
                stats: {
                    totalFiles: stats.totalFiles || 0,
                    totalStorage: stats.totalStorage || 0,
                    storageBreakdown: storageBreakdown,
                    typeBreakdown: typeBreakdown
                }
            });

        } catch (error) {
            console.error('Get file stats error:', error);
            res.status(500).json({ 
                error: 'Failed to get file statistics: ' + error.message 
            });
        }
    }
}

module.exports = new EnhancedFileController();