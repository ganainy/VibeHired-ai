// client/src/services/authApi.ts
import axios from 'axios';

// Reuse or redefine API_BASE_URL
const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api'}/auth`; // Auth specific endpoint

// --- Type Definitions ---
interface AuthResponse {
    message: string;
    token: string;
    user: {
        id: string;
        email: string;
        emailVerified: boolean;
    };
}

export interface RegisterResponse {
    message: string;
    requiresVerification?: boolean;
    emailSendFailed?: boolean;
    registeredEmail?: string;
    requiresApiKeys?: boolean;
}

export interface UserProfile {
    id: string;
    email: string;
    username?: string;
    role?: 'user' | 'admin' | 'owner';
    plan?: 'free' | 'starter' | 'pro' | 'premium';
    emailVerified?: boolean;
    onboardingComplete?: boolean;
    createdAt: string;
    updatedAt: string;
}

// Use generic error structure for now
interface ApiError {
    message: string;
    errors?: any; // Can be more specific later
}

// --- API Functions ---

export const registerUser = async (credentials: { email: string, username: string, password: string }): Promise<RegisterResponse> => {
    try {
        // Note: Axios automatically throws for non-2xx status codes
        const response = await axios.post<RegisterResponse>(`${API_BASE_URL}/register`, credentials);
        return response.data;
    } catch (error) {
        console.error("Registration API error:", error);
        if (axios.isAxiosError(error) && error.response) {
            // Extract backend error message if available
            throw error.response.data as ApiError;
        }
        throw { message: 'An unknown registration error occurred.' } as ApiError; // Throw generic error
    }
};

export const loginUser = async (credentials: { email: string, password: string }): Promise<AuthResponse> => {
    try {
        const response = await axios.post<AuthResponse>(`${API_BASE_URL}/login`, credentials);
        return response.data;
    } catch (error) {
        console.error("Login API error:", error);
        if (axios.isAxiosError(error) && error.response) {
            throw error.response.data as ApiError;
        }
        throw { message: 'An unknown login error occurred.' } as ApiError;
    }
};

export const getCurrentUserProfile = async (extraConfig?: object): Promise<UserProfile> => {
    try {
        const response = await axios.get<UserProfile>(`${API_BASE_URL}/me`, extraConfig);
        return response.data;
    } catch (error) {
        console.error("Get Profile API error:", error);
        if (axios.isAxiosError(error) && error.response) {
            // Preserve the HTTP status so callers can distinguish 401 (expired token) from 5xx
            throw { ...(error.response.data as ApiError), status: error.response.status };
        }
        throw { message: 'An unknown error occurred fetching user profile.' } as ApiError;
    }
};

// Username updates are no longer allowed after registration
// The updateUsername function has been removed

export const forgotPassword = async (email: string): Promise<{ message: string }> => {
    try {
        const response = await axios.post<{ message: string }>(`${API_BASE_URL}/forgot-password`, { email });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) throw error.response.data as ApiError;
        throw { message: 'An error occurred. Please try again.' } as ApiError;
    }
};

export const resetPassword = async (token: string, password: string): Promise<{ message: string }> => {
    try {
        const response = await axios.post<{ message: string }>(`${API_BASE_URL}/reset-password`, { token, password });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) throw error.response.data as ApiError;
        throw { message: 'An error occurred. Please try again.' } as ApiError;
    }
};

export const completeOnboarding = async (): Promise<void> => {
    try {
        await axios.post(`${API_BASE_URL}/complete-onboarding`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) throw error.response.data as ApiError;
        throw { message: 'An error occurred completing onboarding.' } as ApiError;
    }
};

export const getGoogleLoginUrl = async (): Promise<string> => {
    try {
        const response = await axios.get<{ url: string }>(
            `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api'}/auth/google/login`
        );
        return response.data.url;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) throw error.response.data as ApiError;
        throw { message: 'Could not get Google login URL.' } as ApiError;
    }
};

export const resendVerificationEmail = async (email: string): Promise<{ message: string }> => {
    try {
        const response = await axios.post<{ message: string }>(`${API_BASE_URL}/resend-verification`, { email });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) throw error.response.data as ApiError;
        throw { message: 'Could not resend verification email.' } as ApiError;
    }
};

export const verifyEmailToken = async (token: string): Promise<{ message: string }> => {
    try {
        const response = await axios.post<{ message: string }>(`${API_BASE_URL}/verify-email`, { token });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) throw error.response.data as ApiError;
        throw { message: 'Email verification failed.' } as ApiError;
    }
};
// export const updateUsername = async (username: string): Promise<{ message: string; username: string }> => {
//     try {
//         const response = await axios.put<{ message: string; username: string }>(`${API_BASE_URL}/username`, { username });
//         return response.data;
//     } catch (error) {
//         console.error("Update Username API error:", error);
//         if (axios.isAxiosError(error) && error.response) {
//             throw error.response.data as ApiError;
//         }
//         throw { message: 'An unknown error occurred updating username.' } as ApiError;
//     }
// };