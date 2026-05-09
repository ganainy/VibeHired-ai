// server/src/services/interviewMaterialService.ts
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse } from 'cloudinary';
import InterviewMaterial, { IInterviewMaterial, MaterialType } from '../models/InterviewMaterial';
import { NotFoundError, AuthorizationError } from '../utils/errors/AppError';
import mongoose from 'mongoose';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive the Cloudinary resource_type from mime type */
function getCloudinaryResourceType(mimeType: string): 'image' | 'raw' {
    if (mimeType.startsWith('image/')) return 'image';
    return 'raw';
}

/** Derive our MaterialType from mimeType (and optionally filename extension as fallback) */
function deriveMaterialType(mimeType: string, filename?: string): MaterialType {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
    )
        return 'docx';
    if (mimeType === 'text/markdown') return 'markdown';
    // Windows may send .md files as application/octet-stream — check extension
    if (filename) {
        const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
        if (ext === '.md' || ext === '.markdown') return 'markdown';
    }
    return 'text';
}

/** Upload a buffer to Cloudinary */
async function uploadBufferToCloudinary(
    buffer: Buffer,
    mimeType: string,
    folder: string,
    publicId?: string
): Promise<UploadApiResponse> {
    const resourceType = getCloudinaryResourceType(mimeType);
    return new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType,
                ...(publicId ? { public_id: publicId } : {}),
            },
            (error, result) => {
                if (error) return reject(error);
                if (!result) return reject(new Error('Cloudinary upload returned no result'));
                resolve(result);
            }
        );
        uploadStream.end(buffer);
    });
}

// ── DTO types ─────────────────────────────────────────────────────────────────

export interface CreateMaterialDto {
    jobApplicationId?: string | null;
    type?: MaterialType; // only required for text/markdown/link (files auto-detect)
    title: string;
    description?: string;
    content?: string; // for text / markdown
    url?: string;     // for link
    isGlobal?: boolean;
}

export interface UpdateMaterialDto {
    title?: string;
    description?: string;
    content?: string;
    url?: string;
    isGlobal?: boolean;
    isFavorite?: boolean;
    jobApplicationId?: string | null;
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Get all materials for a specific job belonging to the user.
 */
export async function getMaterialsByJob(
    userId: string,
    jobId: string
): Promise<IInterviewMaterial[]> {
    return InterviewMaterial.find({
        userId: new mongoose.Types.ObjectId(userId),
        jobApplicationId: new mongoose.Types.ObjectId(jobId),
    }).sort({ createdAt: -1 });
}

/**
 * Get all globally-shared materials for the user, populated with job info
 * so the client can group them.
 */
export async function getGlobalMaterials(userId: string): Promise<IInterviewMaterial[]> {
    return InterviewMaterial.find({
        userId: new mongoose.Types.ObjectId(userId),
        isGlobal: true,
    })
        .populate('jobApplicationId', 'jobTitle companyName status')
        .sort({ jobApplicationId: 1, createdAt: -1 });
}

/**
 * Create a new material, optionally uploading a file to Cloudinary.
 */
export async function createMaterial(
    userId: string,
    dto: CreateMaterialDto,
    file?: Express.Multer.File
): Promise<IInterviewMaterial> {
    let materialData: Partial<IInterviewMaterial> = {
        userId: new mongoose.Types.ObjectId(userId) as any,
        jobApplicationId: dto.jobApplicationId
            ? (new mongoose.Types.ObjectId(dto.jobApplicationId) as any)
            : null,
        title: dto.title,
        description: dto.description,
        isGlobal: dto.isGlobal ?? false,
    };

    if (file) {
        // Determine type from mime (pass filename for octet-stream extension fallback)
        const derivedType = deriveMaterialType(file.mimetype, file.originalname);
        materialData.type = derivedType;
        materialData.mimeType = file.mimetype;
        materialData.originalFilename = file.originalname;
        materialData.fileSize = file.size;

        if (derivedType === 'text' || derivedType === 'markdown') {
            // Store text content directly in the DB — no Cloudinary needed
            materialData.content = file.buffer.toString('utf-8');
        } else {
            // Upload binary files to Cloudinary
            const uploadResult = await uploadBufferToCloudinary(
                file.buffer,
                file.mimetype,
                `interview-materials/${userId}`
            );
            materialData.cloudinaryUrl = uploadResult.secure_url;
            materialData.cloudinaryPublicId = uploadResult.public_id;
        }
    } else {
        // Non-file material
        if (!dto.type) throw new Error('type is required for non-file materials');
        materialData.type = dto.type;
        if (dto.type === 'text' || dto.type === 'markdown') {
            materialData.content = dto.content;
        } else if (dto.type === 'link') {
            materialData.url = dto.url;
        }
    }

    const material = new InterviewMaterial(materialData);
    return material.save();
}

/**
 * Update title, description, content, url, or isGlobal toggle.
 */
export async function updateMaterial(
    userId: string,
    materialId: string,
    dto: UpdateMaterialDto
): Promise<IInterviewMaterial> {
    const material = await InterviewMaterial.findById(materialId);
    if (!material) throw new NotFoundError('Material not found');
    if (material.userId.toString() !== userId) throw new AuthorizationError('Forbidden');

    if (dto.title !== undefined) material.title = dto.title;
    if (dto.description !== undefined) material.description = dto.description;
    if (dto.content !== undefined) material.content = dto.content;
    if (dto.url !== undefined) material.url = dto.url;
    if (dto.isGlobal !== undefined) material.isGlobal = dto.isGlobal;
    if (dto.isFavorite !== undefined) material.isFavorite = dto.isFavorite;
    if (dto.jobApplicationId !== undefined) {
        material.jobApplicationId = dto.jobApplicationId
            ? (new mongoose.Types.ObjectId(dto.jobApplicationId) as any)
            : null;
    }

    return material.save();
}

/**
 * Delete a material, removing the Cloudinary asset if applicable.
 */
export async function deleteMaterial(userId: string, materialId: string): Promise<void> {
    const material = await InterviewMaterial.findById(materialId);
    if (!material) throw new NotFoundError('Material not found');
    if (material.userId.toString() !== userId) throw new AuthorizationError('Forbidden');

    // Remove from Cloudinary if a file was stored
    if (material.cloudinaryPublicId) {
        try {
            const resourceType = material.mimeType
                ? getCloudinaryResourceType(material.mimeType)
                : 'raw';
            await cloudinary.uploader.destroy(material.cloudinaryPublicId, {
                resource_type: resourceType,
            });
        } catch (err) {
            // Log but don't fail the delete if Cloudinary cleanup errors
            console.error('[InterviewMaterial] Cloudinary delete error:', err);
        }
    }

    await material.deleteOne();
}

/**
 * Generate a share token for a material (makes it publicly accessible via link)
 */
export async function shareMaterial(userId: string, materialId: string): Promise<IInterviewMaterial> {
    const material = await InterviewMaterial.findById(materialId);
    if (!material) throw new NotFoundError('Material not found');
    if (material.userId.toString() !== userId) throw new AuthorizationError('Forbidden');

    // Generate a unique token if not already shared
    if (!material.shareToken) {
        const crypto = await import('crypto');
        material.shareToken = crypto.randomBytes(16).toString('hex');
    }

    return material.save();
}

/**
 * Remove the share token from a material (revokes public access)
 */
export async function unshareMaterial(userId: string, materialId: string): Promise<IInterviewMaterial> {
    const material = await InterviewMaterial.findById(materialId);
    if (!material) throw new NotFoundError('Material not found');
    if (material.userId.toString() !== userId) throw new AuthorizationError('Forbidden');

    material.shareToken = undefined;
    return material.save();
}

/**
 * Get a material by share token (public access, no auth required)
 */
export async function getMaterialByShareToken(shareToken: string): Promise<IInterviewMaterial | null> {
    return InterviewMaterial.findOne({ shareToken }).populate('userId', 'name');
}
