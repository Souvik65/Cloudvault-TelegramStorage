const express = require('express');
const upload = require('../middleware/upload');
const authMiddleware = require('../middleware/auth');
const enhancedFileController = require('../controllers/enhancedFileController');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// File operations
router.post('/upload', upload.single('file'), enhancedFileController.uploadFile);
router.get('/', enhancedFileController.getFiles);
router.get('/search', enhancedFileController.searchFiles);
router.get('/stats', enhancedFileController.getFileStats);
router.get('/:id/preview', enhancedFileController.previewFile);
router.get('/:id/download', enhancedFileController.downloadFile);
router.delete('/:id', enhancedFileController.deleteFile);

// Folder operations
router.post('/folders', enhancedFileController.createFolder);
router.delete('/folders/:id', enhancedFileController.deleteFolder); // Add this line

module.exports = router;