// server/src/routes/interviewMaterials.ts
import express, { Router } from 'express';
import multer from 'multer';
import authMiddleware from '../middleware/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';
import { listByJob, listGlobal, create, update, remove, generateTitle, shareMaterial, unshareMaterial } from '../controllers/interviewMaterialController';

const router: Router = express.Router();

// ── Multer config ─────────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/markdown',
]);

// Extensions that Windows may send as application/octet-stream
const OCTET_STREAM_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(null, true);
            return;
        }
        // Windows sometimes sends text/md files as application/octet-stream — allow by extension
        if (file.mimetype === 'application/octet-stream') {
            const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
            if (OCTET_STREAM_EXTENSIONS.has(ext)) {
                cb(null, true);
                return;
            }
        }
        cb(new Error(`File type not allowed: ${file.mimetype}`));
    },
});

// ── All routes require authentication ─────────────────────────────────────────
router.use(authMiddleware);

// GET /api/interview-materials?jobId=:id
router.get('/', asyncHandler(listByJob));

// GET /api/interview-materials/global
router.get('/global', asyncHandler(listGlobal));

// POST /api/interview-materials  (file upload optional)
router.post('/', upload.single('file'), asyncHandler(create));

// PATCH /api/interview-materials/:id
router.patch('/:id', asyncHandler(update));

// DELETE /api/interview-materials/:id
router.delete('/:id', asyncHandler(remove));

// POST /api/interview-materials/generate-title
router.post('/generate-title', asyncHandler(generateTitle));

// POST /api/interview-materials/:id/share - Generate share token
router.post('/:id/share', asyncHandler(shareMaterial));

// DELETE /api/interview-materials/:id/share - Remove share token
router.delete('/:id/share', asyncHandler(unshareMaterial));

export default router;
