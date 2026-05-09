// client/src/types/interviewMaterial.ts

export type MaterialType = 'pdf' | 'image' | 'text' | 'markdown' | 'link' | 'docx';

/** Shape of a populated JobApplication reference on a global material. */
export interface MaterialJobRef {
    _id: string;
    jobTitle: string;
    companyName: string;
    status: string;
}

export interface InterviewMaterial {
    _id: string;
    userId: string;
    jobApplicationId?: string | MaterialJobRef | null;
    type: MaterialType;
    title: string;
    description?: string;

    // File fields
    cloudinaryUrl?: string;
    originalFilename?: string;
    mimeType?: string;
    fileSize?: number;

    // Content / link
    content?: string;
    url?: string;

    isGlobal: boolean;
    isFavorite?: boolean;
    shareToken?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateMaterialPayload {
    jobApplicationId?: string | null;
    type?: MaterialType;
    title: string;
    description?: string;
    content?: string;
    url?: string;
    isGlobal?: boolean;
}

export interface UpdateMaterialPayload {
    title?: string;
    description?: string;
    content?: string;
    url?: string;
    isGlobal?: boolean;
    isFavorite?: boolean;
    jobApplicationId?: string | null;
}
