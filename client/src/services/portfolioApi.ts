// client/src/services/portfolioApi.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

export interface AggregatedProfile {
  _id: string;
  userId: string;
  name?: string;
  title?: string;
  bio?: string;
  location?: string;
  phone?: string;
  socialLinks?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
    portfolio?: string;
    behance?: string;
    dribbble?: string;
    medium?: string;
    dev?: string;
    stackoverflow?: string;
    youtube?: string;
  };
  profileImageUrl?: string;
  cvViewUrl?: string;
  cvDownloadUrl?: string;
  cvFileUrl?: string;
  skills?: {
    programmingLanguages: string[];
    otherSkills: string[];
  };
  linkedinData?: {
    name?: string;
    title?: string;
    bio?: string;
    location?: string;
    experience?: any[];
    skills?: string[];
    languages?: any[];
  };
  user?: {
    email: string;
    id: string;
  };
}

export interface Project {
  _id: string;
  userId: string;
  title: string;
  description: string;
  detailedDescription?: string;
  imageUrl?: string;
  videoUrl?: string;
  projectUrl?: string;
  githubUrl?: string;
  technologies?: string[];
  tags?: string[];
  featured?: boolean;
  order?: number;
  sourceType?: 'manual' | 'github' | 'external';
  stars?: number;
  forks?: number;
  isVisibleInPortfolio?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublishedProfile {
  _id: string;
  name?: string;
  title?: string;
  bio?: string;
  profileImageUrl?: string;
  username: string;
  createdAt: string;
}

/**
 * Get aggregated profile data for a username
 */
export const getAggregatedProfile = async (username: string): Promise<AggregatedProfile> => {
  const response = await axios.get(`${API_BASE_URL}/profile/aggregated/${username}`);
  return response.data.data;
};

/**
 * Get basic profile by username
 */
export const getProfileByUsername = async (username: string) => {
  const response = await axios.get(`${API_BASE_URL}/profile/${username}`);
  return response.data.data;
};

/**
 * Get all published portfolios
 */
export const getPublishedPortfolios = async (): Promise<PublishedProfile[]> => {
  const response = await axios.get(`${API_BASE_URL}/profile/published/all`);
  return response.data.data;
};

/**
 * Get current user's profile
 */
export const getCurrentUserProfile = async () => {
  const token = localStorage.getItem('authToken');
  const response = await axios.get(`${API_BASE_URL}/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data.data;
};

/**
 * Update current user's profile
 */
export const updateProfile = async (data: any) => {
  const token = localStorage.getItem('authToken');
  const response = await axios.put(`${API_BASE_URL}/profile`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data.data;
};

/**
 * Sync LinkedIn profile
 */
export const syncLinkedIn = async () => {
  const token = localStorage.getItem('authToken');
  const response = await axios.post(
    `${API_BASE_URL}/linkedin/sync`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

/**
 * Get projects by username
 */
export const getProjectsByUsername = async (username: string): Promise<Project[]> => {
  const response = await axios.get(`${API_BASE_URL}/projects/${username}`);
  return response.data.data;
};

/**
 * Import projects from GitHub
 */
export const importGitHubProjects = async (githubUsername: string) => {
  const token = localStorage.getItem('authToken');
  const response = await axios.post(
    `${API_BASE_URL}/projects/import-github`,
    { githubUsername },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

/**
 * Get GitHub repositories for a username
 */
export const getGitHubRepos = async (username: string) => {
  const response = await axios.get(`${API_BASE_URL}/github/repos/${username}`);
  return response.data.data;
};

/**
 * Get GitHub skills for a username
 */
export const getGitHubSkills = async (username: string) => {
  const response = await axios.get(`${API_BASE_URL}/github/skills/${username}`);
  return response.data.data;
};

/**
 * Get current user's projects
 */
export const getCurrentUserProjects = async (): Promise<Project[]> => {
  const token = localStorage.getItem('authToken');
  const response = await axios.get(`${API_BASE_URL}/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data.data;
};

/**
 * Update a project
 */
export const updateProject = async (projectId: string, data: Partial<Project>): Promise<Project> => {
  const token = localStorage.getItem('authToken');
  const response = await axios.put(`${API_BASE_URL}/projects/${projectId}`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data.data;
};

/**
 * Update project orders in bulk
 */
export const updateProjectOrders = async (projectOrders: Array<{ id: string; order: number }>) => {
  const token = localStorage.getItem('authToken');
  const response = await axios.put(
    `${API_BASE_URL}/projects/reorder`,
    { projectOrders },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

/**
 * Toggle portfolio publish status
 */
export const togglePortfolioPublish = async (isPublished: boolean) => {
  const token = localStorage.getItem('authToken');
  const response = await axios.put(
    `${API_BASE_URL}/profile`,
    { isPublished },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data.data;
};
