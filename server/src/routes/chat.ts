import express, { Router } from 'express';
import { postChatMessage, getChatHistoryHandler } from '../controllers/chatController';
import authMiddleware from '../middleware/authMiddleware';
import { usageLimiter } from '../middleware/usageLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequest } from '../middleware/validateRequest';
import { chatMessageBodySchema, chatParamsSchema } from '../validations/chatSchemas';

const router: Router = express.Router();

// Protect all routes with authentication
router.use(authMiddleware);

// Chat routes
router.post(
    '/:jobId',
    validateRequest({
        params: chatParamsSchema,
        body: chatMessageBodySchema
    }),
    usageLimiter('chatMessage'),
    asyncHandler(postChatMessage)
);

router.get(
    '/:jobId/history',
    validateRequest({
        params: chatParamsSchema
    }),
    asyncHandler(getChatHistoryHandler)
);

export default router;

