// client/src/services/interviewMaterialsApi.ts
import { InterviewMaterial, CreateMaterialPayload, UpdateMaterialPayload } from '../types/interviewMaterial';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('authToken');
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

function getJsonHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
    };
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || `Request failed with status ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

/** Fetch all materials for a specific job */
export async function getMaterialsByJob(jobId: string): Promise<InterviewMaterial[]> {
    const res = await fetch(`${API_BASE_URL}/interview-materials?jobId=${encodeURIComponent(jobId)}`, {
        headers: getAuthHeaders(),
    });
    const data = await handleResponse<{ materials: InterviewMaterial[] }>(res);
    return data.materials;
}

/** Fetch all globally-shared materials (with populated job info) */
export async function getGlobalMaterials(): Promise<InterviewMaterial[]> {
    const res = await fetch(`${API_BASE_URL}/interview-materials/global`, {
        headers: getAuthHeaders(),
    });
    const data = await handleResponse<{ materials: InterviewMaterial[] }>(res);
    return data.materials;
}

/**
 * Create a material.
 * If `file` is provided the request is sent as multipart/form-data,
 * otherwise as application/json.
 */
export async function createMaterial(
    payload: CreateMaterialPayload,
    file?: File
): Promise<InterviewMaterial> {
    let res: Response;

    if (file) {
        const form = new FormData();
        form.append('file', file);
        form.append('title', payload.title);
        if (payload.jobApplicationId) form.append('jobApplicationId', payload.jobApplicationId);
        if (payload.description) form.append('description', payload.description);
        if (payload.isGlobal !== undefined) form.append('isGlobal', String(payload.isGlobal));

        res = await fetch(`${API_BASE_URL}/interview-materials`, {
            method: 'POST',
            headers: getAuthHeaders(), // no Content-Type — browser sets it with boundary
            body: form,
        });
    } else {
        res = await fetch(`${API_BASE_URL}/interview-materials`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(payload),
        });
    }

    const data = await handleResponse<{ material: InterviewMaterial }>(res);
    return data.material;
}

/** Patch a material (title, description, content, url, or isGlobal toggle) */
export async function updateMaterial(
    materialId: string,
    payload: UpdateMaterialPayload
): Promise<InterviewMaterial> {
    const res = await fetch(`${API_BASE_URL}/interview-materials/${materialId}`, {
        method: 'PATCH',
        headers: getJsonHeaders(),
        body: JSON.stringify(payload),
    });
    const data = await handleResponse<{ material: InterviewMaterial }>(res);
    return data.material;
}

/** Delete a material */
export async function deleteMaterial(materialId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/interview-materials/${materialId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    await handleResponse<void>(res);
}

/** Generate a title for a learning material using AI */
export async function generateMaterialTitle(
    type: string,
    content?: string,
    description?: string
): Promise<{ title: string }> {
    const res = await fetch(`${API_BASE_URL}/interview-materials/generate-title`, {
        method: 'POST',
        headers: getJsonHeaders(),
        body: JSON.stringify({ type, content, description }),
    });
    const data = await handleResponse<{ title: string }>(res);
    return data;
}

/** Share a material - generates a public link */
export async function shareMaterial(materialId: string): Promise<{ material: InterviewMaterial; shareUrl: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/interview-materials/${materialId}/share`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    const data = await handleResponse<{ material: InterviewMaterial; shareUrl: string; message: string }>(res);
    return data;
}

/** Unshare a material - revokes public access */
export async function unshareMaterial(materialId: string): Promise<{ material: InterviewMaterial; message: string }> {
    const res = await fetch(`${API_BASE_URL}/interview-materials/${materialId}/share`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    const data = await handleResponse<{ material: InterviewMaterial; message: string }>(res);
    return data;
}

/** Fetch a shared material by token (public, no auth required) */
export async function getSharedMaterial(token: string): Promise<InterviewMaterial> {
    const res = await fetch(`${API_BASE_URL}/shared/${token}`, {
        headers: { 'Content-Type': 'application/json' },
    });
    const data = await handleResponse<{ material: InterviewMaterial }>(res);
    return data.material;
}
