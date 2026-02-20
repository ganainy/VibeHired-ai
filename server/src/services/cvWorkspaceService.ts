import CV, { ICV } from '../models/CV';
import { NotFoundError } from '../utils/errors/AppError';
import { JsonResumeSchema } from '../types/jsonresume';
import { EditableCvWorkingCopyDTO, SaveWorkspaceRequest } from '../types/cvWorkspace';

/**
 * Get the workspace state for a CV
 */
export const getWorkspace = async (cvId: string, userId: string): Promise<EditableCvWorkingCopyDTO> => {
    const cv = await CV.findOne({ _id: cvId, userId }).select('+originalPdf');

    if (!cv) {
        throw new NotFoundError('CV not found');
    }

    return mapToWorkspaceDTO(cv);
};

/**
 * Save the workspace state for a CV
 */
export const saveWorkspace = async (
    cvId: string,
    userId: string,
    data: SaveWorkspaceRequest
): Promise<{ workspace: EditableCvWorkingCopyDTO, snapshotVersion: number }> => {
    const cv = await CV.findOne({ _id: cvId, userId });

    if (!cv) {
        throw new NotFoundError('CV not found');
    }

    // Update fields
    if (data.cvJson) {
        cv.cvJson = data.cvJson as JsonResumeSchema;
        // Invalidate analysis cache on content change
        cv.analysisCache = null;
    }

    if (data.templateId) {
        cv.templateId = data.templateId;
    }

    // Increment snapshot version
    cv.snapshotVersion = (cv.snapshotVersion || 0) + 1;
    cv.lastEditedAt = new Date();

    await cv.save();

    return {
        workspace: mapToWorkspaceDTO(cv),
        snapshotVersion: cv.snapshotVersion
    };
};

/**
 * Helper: Map CV document to Workspace DTO
 */
function mapToWorkspaceDTO(cv: ICV): EditableCvWorkingCopyDTO {
    return {
        cvId: cv._id.toString(),
        cvJson: cv.cvJson ?? null,
        templateId: cv.templateId || 'modern-clean', // Default fallback
        snapshotVersion: cv.snapshotVersion || 1,
        lastEditedAt: cv.lastEditedAt || cv.updatedAt,
        pdfBase64: cv.originalPdf ? cv.originalPdf.toString('base64') : undefined
    };
}
