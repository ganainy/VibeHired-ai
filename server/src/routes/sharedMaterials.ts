// server/src/routes/sharedMaterials.ts
import express, { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getSharedMaterial } from '../controllers/sharedMaterialController';

const router: Router = express.Router();

router.get('/:token', asyncHandler(getSharedMaterial));

export default router;
