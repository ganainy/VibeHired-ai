// client/src/services/settingsApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

// Helper to get the auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

export interface ApiKeys {
  // Add other services here as needed
}

export interface UpdateApiKeysRequest {
  // Add other services here as needed
}

/**
 * Get user's API keys (masked)
 */
export const getApiKeys = async (): Promise<ApiKeys> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found.');
  }

  try {
    const response = await axios.get<ApiKeys>(`${API_BASE_URL}/settings/api-keys`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching API keys:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch API keys');
  }
};

/**
 * Update user's API keys
 */
export const updateApiKeys = async (keys: UpdateApiKeysRequest): Promise<ApiKeys> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found.');
  }

  try {
    const response = await axios.put<ApiKeys>(`${API_BASE_URL}/settings/api-keys`, keys, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error updating API keys:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to update API keys');
  }
};

/**
 * Delete a specific API key
 */
export const deleteApiKey = async (service: string): Promise<void> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found.');
  }

  try {
    await axios.delete(`${API_BASE_URL}/settings/api-keys/${service}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  } catch (error: any) {
    console.error('Error deleting API key:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to delete API key');
  }
};


export interface CustomPrompts {
  cvPrompt: string | null;
  coverLetterPrompt: string | null;
}

/**
 * Get user's custom prompts for CV and Cover Letter generation
 */
export const getCustomPrompts = async (): Promise<CustomPrompts> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found.');
  }

  try {
    const response = await axios.get<CustomPrompts>(`${API_BASE_URL}/settings/custom-prompts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching custom prompts:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch custom prompts');
  }
};

/**
 * Update user's custom prompts
 */
export const updateCustomPrompts = async (prompts: Partial<CustomPrompts>): Promise<CustomPrompts> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found.');
  }

  try {
    const response = await axios.put<CustomPrompts & { message: string }>(`${API_BASE_URL}/settings/custom-prompts`, prompts, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error updating custom prompts:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to update custom prompts');
  }
};

export interface PromptTemplate {
  id: string;
  name: string;
  type: 'cv' | 'coverLetter';
  content: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get user's custom prompt templates
 */
export const getPromptTemplates = async (): Promise<PromptTemplate[]> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found.');
  }

  try {
    const response = await axios.get<{ templates: PromptTemplate[] }>(`${API_BASE_URL}/settings/custom-prompts/templates`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data.templates;
  } catch (error: any) {
    console.error('Error fetching prompt templates:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch prompt templates');
  }
};

/**
 * Update user's custom prompt templates
 */
export const updatePromptTemplates = async (templates: PromptTemplate[]): Promise<PromptTemplate[]> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found.');
  }

  try {
    const response = await axios.put<{ message: string; templates: PromptTemplate[] }>(`${API_BASE_URL}/settings/custom-prompts/templates`, { templates }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data.templates;
  } catch (error: any) {
    console.error('Error updating prompt templates:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to update prompt templates');
  }
};

export interface PromptChecklistItem {
  id: string;
  text: string;
  enabled: boolean;
  isDefault?: boolean;
}

export interface PromptChecklists {
  cv?: PromptChecklistItem[] | null;
  coverLetter?: PromptChecklistItem[] | null;
}

/**
 * Get user's saved prompt checklist items
 */
export const getPromptChecklists = async (): Promise<PromptChecklists> => {
  const token = getAuthToken();
  if (!token) throw new Error('No authentication token found.');
  try {
    const response = await axios.get<{ checklists: PromptChecklists }>(`${API_BASE_URL}/settings/prompt-checklists`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.data.checklists;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch prompt checklists');
  }
};

/**
 * Save user's prompt checklist items (partial update — pass only the type you're updating)
 */
export const updatePromptChecklists = async (payload: { cv?: PromptChecklistItem[]; coverLetter?: PromptChecklistItem[] }): Promise<PromptChecklists> => {
  const token = getAuthToken();
  if (!token) throw new Error('No authentication token found.');
  try {
    const response = await axios.put<{ checklists: PromptChecklists }>(`${API_BASE_URL}/settings/prompt-checklists`, payload, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    return response.data.checklists;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update prompt checklists');
  }
};

