const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit to avoid timeouts
        files: 5 // Maximum 5 files at once
    },
    fileFilter: (req, file, cb) => {
        // Allow all file types but log them
        console.log('Multer receiving file:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        cb(null, true);
    }
});

module.exports = upload;