const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.memoryStorage();

// File type validation - define allowed types
const ALLOWED_FILE_TYPES = {
    // Documents
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/json': '.json',
    'application/xml': '.xml',
    
    // Images
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    
    // Videos
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/webm': '.webm',
    'video/x-flv': '.flv',
    'video/3gpp': '.3gp',
    
    // Audio
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/m4a': '.m4a',
    'audio/aac': '.aac',
    'audio/flac': '.flac',
    
    // Archives
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/x-7z-compressed': '.7z',
    'application/gzip': '.gz',
    'application/x-tar': '.tar',
    
    // Other common types
    'application/octet-stream': '.bin' // Generic binary files
};

// Size limits based on file type (in bytes)
const SIZE_LIMITS = {
    // Images - 10MB
    'image/': 10 * 1024 * 1024,
    // Videos - 2GB (Telegram limit)
    'video/': 2000 * 1024 * 1024,
    // Audio - 50MB
    'audio/': 50 * 1024 * 1024,
    // Documents - 100MB
    'application/': 100 * 1024 * 1024,
    'text/': 100 * 1024 * 1024,
    // Default - 50MB
    'default': 50 * 1024 * 1024
};

// Enhanced file validation function
const validateFile = (file) => {
    const errors = [];
    
    // Check if file exists
    if (!file) {
        errors.push('No file provided');
        return errors;
    }
    
    // Validate filename
    if (!file.originalname || file.originalname.trim() === '') {
        errors.push('File must have a valid name');
    }
    
    // Validate file extension
    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;
    
    // Check for dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.dll', '.sys'];
    if (dangerousExtensions.includes(fileExt)) {
        errors.push(`File type ${fileExt} is not allowed for security reasons`);
    }
    
    // Validate mime type if it's in our allowed list
    if (mimeType && !ALLOWED_FILE_TYPES[mimeType] && mimeType !== 'application/octet-stream') {
        // For unknown mime types, allow but warn
        console.warn(`Unknown mime type detected: ${mimeType} for file: ${file.originalname}`);
    }
    
    // Validate file size based on type
    const fileTypeCategory = Object.keys(SIZE_LIMITS).find(category => 
        category !== 'default' && mimeType && mimeType.startsWith(category)
    );
    
    const sizeLimit = SIZE_LIMITS[fileTypeCategory] || SIZE_LIMITS.default;
    
    if (file.size > sizeLimit) {
        const sizeLimitMB = Math.round(sizeLimit / (1024 * 1024));
        const fileSizeMB = Math.round(file.size / (1024 * 1024));
        errors.push(`File size (${fileSizeMB}MB) exceeds limit (${sizeLimitMB}MB) for this file type`);
    }
    
    // Validate buffer exists and is not empty
    if (!file.buffer || file.buffer.length === 0) {
        errors.push('File buffer is empty or corrupted');
    }
    
    // Check for buffer corruption indicators
    if (file.buffer && file.size && file.buffer.length !== file.size) {
        errors.push('File buffer size mismatch - file may be corrupted');
    }
    
    return errors;
};

// Enhanced file filter with better validation
const fileFilter = (req, file, cb) => {
    console.log('Processing file upload:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        encoding: file.encoding
    });
    
    const validationErrors = validateFile(file);
    
    if (validationErrors.length > 0) {
        console.error('File validation failed:', validationErrors);
        return cb(new Error(validationErrors.join('; ')), false);
    }
    
    // File passed validation
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2000 * 1024 * 1024, // 2GB max (Telegram limit)
        files: 5, // Maximum 5 files at once
        fieldSize: 100 * 1024 * 1024, // 100MB for form fields
        parts: 10 // Maximum 10 form parts
    },
    fileFilter: fileFilter
});

// Error handling middleware for multer errors
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    error: 'File too large',
                    message: 'File size exceeds the maximum allowed limit',
                    maxSize: '2GB'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    error: 'Too many files',
                    message: 'Maximum 5 files allowed per upload'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    error: 'Unexpected file field',
                    message: 'File field name is not expected'
                });
            case 'LIMIT_PART_COUNT':
                return res.status(400).json({
                    error: 'Too many form parts',
                    message: 'Request contains too many form parts'
                });
            case 'LIMIT_FIELD_SIZE':
                return res.status(400).json({
                    error: 'Field too large',
                    message: 'Form field size exceeds limit'
                });
            default:
                return res.status(400).json({
                    error: 'Upload error',
                    message: err.message || 'File upload failed'
                });
        }
    } else if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
            error: 'File validation failed',
            message: err.message || 'File upload failed validation'
        });
    }
    
    next();
};

module.exports = {
    upload,
    handleUploadError,
    validateFile,
    ALLOWED_FILE_TYPES,
    SIZE_LIMITS
};