// client/src/pages/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApiKeys, updateApiKeys, deleteApiKey, getProviderModels, ApiKeys } from '../services/settingsApi';
import { getGoogleCalendarStatus, getGoogleConnectUrl, disconnectGoogleCalendar } from '../services/googleCalendarApi';
import Toast from '../components/common/Toast';
import Spinner from '../components/common/Spinner';
import SearchableSelect from '../components/common/SearchableSelect';

// Icon Components
const EyeIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const KeyIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{color:'var(--accent)'}}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// Confirmation Modal Component
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form state
  const [geminiKey, setGeminiKey] = useState('');
  const [apifyToken, setApifyToken] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showApifyToken, setShowApifyToken] = useState(false);

  // AI Provider settings state
  const [defaultProvider, setDefaultProvider] = useState<'gemini' | 'openrouter' | 'ollama' | ''>('');
  const [defaultModel, setDefaultModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showOllamaUrl, setShowOllamaUrl] = useState(false);

  // Validation state
  const [geminiKeyTouched, setGeminiKeyTouched] = useState(false);
  const [apifyTokenTouched, setApifyTokenTouched] = useState(false);
  const [openRouterKeyTouched, setOpenRouterKeyTouched] = useState(false);
  const [ollamaUrlTouched, setOllamaUrlTouched] = useState(false);

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; service: 'gemini' | 'apify' | 'openrouter' | 'ollama' | null }>({
    isOpen: false,
    service: null,
  });

  // Google Calendar state
  const [googleCalConnected, setGoogleCalConnected] = useState(false);
  const [googleCalEmail, setGoogleCalEmail] = useState<string | null>(null);
  const [isLoadingGoogleCal, setIsLoadingGoogleCal] = useState(true);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);

  // Onboarding collapse state
  const [isOnboardingExpanded, setIsOnboardingExpanded] = useState(true);

  // Check if this is a new user (from registration)
  const isNewUser = location.state?.fromRegistration === true;

  useEffect(() => {
    loadApiKeys();
  }, []);

  // Fetch Google Calendar status + handle OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gcStatus = params.get('googleCalendar');
    if (gcStatus === 'connected') {
      setToast({ message: 'Google Calendar connected successfully!', type: 'success' });
      navigate('/settings', { replace: true });
    } else if (gcStatus === 'error') {
      const reason = params.get('reason') || 'unknown';
      setToast({ message: `Google Calendar connection failed: ${reason}`, type: 'error' });
      navigate('/settings', { replace: true });
    }
    loadGoogleCalStatus();
  }, []);

  const loadGoogleCalStatus = async () => {
    setIsLoadingGoogleCal(true);
    try {
      const status = await getGoogleCalendarStatus();
      setGoogleCalConnected(status.connected);
      setGoogleCalEmail(status.email);
    } catch {
      // Non-fatal — Google Calendar might not be configured on the server
    } finally {
      setIsLoadingGoogleCal(false);
    }
  };

  const handleGoogleConnect = async () => {
    setIsConnectingGoogle(true);
    try {
      const url = await getGoogleConnectUrl();
      window.location.href = url;
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to start Google OAuth flow.', type: 'error' });
      setIsConnectingGoogle(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    setIsDisconnectingGoogle(true);
    try {
      await disconnectGoogleCalendar();
      setGoogleCalConnected(false);
      setGoogleCalEmail(null);
      setToast({ message: 'Google Calendar disconnected.', type: 'info' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to disconnect.', type: 'error' });
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  // Fetch models when provider changes
  useEffect(() => {
    if (defaultProvider) {
      fetchModelsForProvider(defaultProvider).then((models) => {
        // If current model is not in the new list, reset it
        if (defaultModel && models.length > 0 && !models.includes(defaultModel)) {
          setDefaultModel('');
        }
      });
    } else {
      setAvailableModels([]);
    }
  }, [defaultProvider]);

  const loadApiKeys = async () => {
    try {
      setIsLoading(true);
      const keys = await getApiKeys();
      setApiKeys(keys);

      // Load AI provider settings
      if (keys.aiProviders) {
        if (keys.aiProviders.defaultProvider) {
          setDefaultProvider(keys.aiProviders.defaultProvider);
        }
        if (keys.aiProviders.defaultModel) {
          setDefaultModel(keys.aiProviders.defaultModel);
        }
        if (keys.aiProviders.providers?.ollama?.baseUrl) {
          setOllamaUrl(keys.aiProviders.providers.ollama.baseUrl);
        }
      }
      // Don't pre-fill the form with masked keys
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to load API keys', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch models for the current provider
  const fetchModelsForProvider = async (provider: 'gemini' | 'openrouter' | 'ollama'): Promise<string[]> => {
    if (!provider) {
      setAvailableModels([]);
      return [];
    }
    setLoadingModels(true);
    try {
      const models = await getProviderModels(provider);
      setAvailableModels(models);
      return models;
    } catch (error: any) {
      console.error('Error fetching models:', error);
      setAvailableModels([]);
      return [];
    } finally {
      setLoadingModels(false);
    }
  };

  const validateGeminiKey = (key: string): boolean => {
    return key.startsWith('AIza') && key.length > 20;
  };

  const validateApifyToken = (token: string): boolean => {
    return token.startsWith('apify_api_') && token.length > 20;
  };

  const validateOpenRouterKey = (key: string): boolean => {
    return (key.startsWith('sk-or-v1-') || key.startsWith('sk-')) && key.length > 20;
  };

  const validateOllamaUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const getGeminiKeyValidation = () => {
    if (!geminiKeyTouched) return null;
    if (!geminiKey.trim()) return { valid: false, message: 'Gemini API key is required' };
    if (!validateGeminiKey(geminiKey.trim())) {
      return { valid: false, message: 'Invalid format. Key should start with "AIza" and be at least 20 characters' };
    }
    return { valid: true, message: 'Valid Gemini API key format' };
  };

  const getApifyTokenValidation = () => {
    if (!apifyTokenTouched || !apifyToken.trim()) return null;
    if (!validateApifyToken(apifyToken.trim())) {
      return { valid: false, message: 'Invalid format. Token should start with "apify_api_" and be at least 20 characters' };
    }
    return { valid: true, message: 'Valid Apify token format' };
  };

  const getOpenRouterKeyValidation = () => {
    if (!openRouterKeyTouched) return null;
    if (!openRouterKey.trim()) return null; // Optional
    if (!validateOpenRouterKey(openRouterKey.trim())) {
      return { valid: false, message: 'Invalid format. Key should start with "sk-or-v1-" or "sk-" and be at least 20 characters' };
    }
    return { valid: true, message: 'Valid OpenRouter API key format' };
  };

  const getOllamaUrlValidation = () => {
    if (!ollamaUrlTouched) return null;
    if (!ollamaUrl.trim()) return { valid: false, message: 'Ollama base URL is required' };
    if (!validateOllamaUrl(ollamaUrl.trim())) {
      return { valid: false, message: 'Invalid URL format. Must be a valid HTTP or HTTPS URL' };
    }
    return { valid: true, message: 'Valid Ollama base URL format' };
  };

  const handleSave = async () => {
    // Check if at least one AI provider key is provided
    const hasGeminiKey = geminiKey.trim();
    const hasOpenRouterKey = openRouterKey.trim();
    const hasOllamaUrl = ollamaUrl.trim();
    const hasApifyToken = apifyToken.trim();

    if (!hasGeminiKey && !hasOpenRouterKey && !hasOllamaUrl && !hasApifyToken) {
      setToast({ message: 'Please provide at least one API key to save', type: 'error' });
      return;
    }

    // Validate keys if provided
    if (hasGeminiKey && !validateGeminiKey(geminiKey.trim())) {
      setToast({ message: 'Invalid Gemini API key format. Key should start with "AIza"', type: 'error' });
      return;
    }

    if (hasOpenRouterKey && !validateOpenRouterKey(openRouterKey.trim())) {
      setToast({ message: 'Invalid OpenRouter API key format. Key should start with "sk-or-v1-" or "sk-"', type: 'error' });
      return;
    }

    if (hasOllamaUrl && !validateOllamaUrl(ollamaUrl.trim())) {
      setToast({ message: 'Invalid Ollama base URL format. Must be a valid HTTP or HTTPS URL', type: 'error' });
      return;
    }

    // Validate Apify token if provided
    if (hasApifyToken && !validateApifyToken(apifyToken.trim())) {
      setToast({ message: 'Invalid Apify token format. Token should start with "apify_api_"', type: 'error' });
      return;
    }

    try {
      setIsSaving(true);
      const updateData: any = {};

      // Add Gemini key if provided (legacy location)
      if (hasGeminiKey) {
        updateData.gemini = {
          accessToken: geminiKey.trim(),
          enabled: true,
        };
      }

      // Add Apify token if provided
      if (hasApifyToken) {
        updateData.apify = {
          accessToken: apifyToken.trim(),
          enabled: true,
        };
      }

      // Add AI provider settings
      updateData.aiProviders = {
        defaultProvider,
        defaultModel: defaultModel.trim() || undefined,
        providers: {},
      };

      // Add Gemini to AI providers if provided
      if (hasGeminiKey) {
        updateData.aiProviders.providers.gemini = {
          accessToken: geminiKey.trim(),
          enabled: true,
        };
      }

      // Add OpenRouter if provided
      if (hasOpenRouterKey) {
        updateData.aiProviders.providers.openrouter = {
          accessToken: openRouterKey.trim(),
          enabled: true,
        };
      }

      // Add Ollama if provided
      if (hasOllamaUrl) {
        updateData.aiProviders.providers.ollama = {
          baseUrl: ollamaUrl.trim(),
          enabled: true,
        };
      }

      await updateApiKeys(updateData);

      const savedKeys = [];
      if (hasGeminiKey) savedKeys.push('Gemini');
      if (hasOpenRouterKey) savedKeys.push('OpenRouter');
      if (hasOllamaUrl) savedKeys.push('Ollama');
      if (hasApifyToken) savedKeys.push('Apify');

      setToast({ message: `${savedKeys.join(', ')} API key${savedKeys.length > 1 ? 's' : ''} saved successfully!`, type: 'success' });

      // Clear form
      setGeminiKey('');
      setOpenRouterKey('');
      setOllamaUrl('http://localhost:11434');
      setApifyToken('');
      setGeminiKeyTouched(false);
      setOpenRouterKeyTouched(false);
      setOllamaUrlTouched(false);
      setApifyTokenTouched(false);

      // Reload keys to show masked versions
      await loadApiKeys();

      // If new user with at least one AI provider key, redirect to dashboard after a short delay
      if (isNewUser && (hasGeminiKey || hasOpenRouterKey || hasOllamaUrl)) {
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to save API keys', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (service: 'gemini' | 'apify' | 'openrouter' | 'ollama') => {
    setDeleteModal({ isOpen: true, service });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.service) return;

    try {
      await deleteApiKey(deleteModal.service);
      setToast({ message: `${deleteModal.service} API key deleted successfully`, type: 'success' });
      await loadApiKeys();

      // Clear form if deleting
      if (deleteModal.service === 'gemini') {
        setGeminiKey('');
        setGeminiKeyTouched(false);
      } else if (deleteModal.service === 'openrouter') {
        setOpenRouterKey('');
        setOpenRouterKeyTouched(false);
      } else if (deleteModal.service === 'ollama') {
        setOllamaUrl('http://localhost:11434');
        setOllamaUrlTouched(false);
      } else if (deleteModal.service === 'apify') {
        setApifyToken('');
        setApifyTokenTouched(false);
      }
    } catch (error: any) {
      setToast({ message: error.message || `Failed to delete ${deleteModal.service} API key`, type: 'error' });
    }
  };

  const geminiValidation = getGeminiKeyValidation();
  const apifyValidation = getApifyTokenValidation();
  const openRouterValidation = getOpenRouterKeyValidation();
  const ollamaValidation = getOllamaUrlValidation();
  const isGeminiConfigured = apiKeys?.gemini?.accessToken || apiKeys?.aiProviders?.providers?.gemini?.accessToken ? true : false;
  const isApifyConfigured = apiKeys?.apify?.accessToken ? true : false;
  const isOpenRouterConfigured = apiKeys?.aiProviders?.providers?.openrouter?.accessToken ? true : false;
  const isOllamaConfigured = apiKeys?.aiProviders?.providers?.ollama?.enabled ? true : false;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 sm:py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{background: 'var(--accent-bg)'}}>
              <KeyIcon />
            </div>
            <h1 className="page-title" style={{fontSize: '1.5rem'}}>
              Integration & AI Settings
            </h1>
          </div>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 ml-12">
            Manage your API keys for AI features and integrations
          </p>
        </div>

        {/* Onboarding Section for New Users */}
        {isNewUser && (
          <div className="mb-6 sm:mb-8 rounded-xl shadow-sm overflow-hidden" style={{background:'var(--accent-bg)', border:'1px solid var(--accent-dim)'}}>
            <button
              onClick={() => setIsOnboardingExpanded(!isOnboardingExpanded)}
              className="w-full p-4 sm:p-6 flex items-center justify-between transition-colors rounded-t-xl"
              style={{background:'transparent'}}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-bg-hover,rgba(232,184,68,0.14))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex items-center gap-3">
                <InfoIcon />
                <h2 className="text-lg sm:text-xl font-semibold text-left" style={{color:'var(--text-primary)'}}>
                  Welcome! Let's set up your API keys
                </h2>
              </div>
              {isOnboardingExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>

            {isOnboardingExpanded && (
              <div className="px-4 sm:px-6 pb-6 space-y-4">
                <p className="text-sm sm:text-base" style={{color:'var(--text-secondary)'}}>
                  To use AI-powered features in this app, you need to provide your own API keys.
                  This ensures you have full control over your usage and costs.
                </p>

                {/* Gemini Section */}
                <div className="p-4 rounded-lg" style={{background:'var(--bg-elevated)', border:'1px solid var(--border)'}}>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{color:'var(--text-primary)'}}>
                    <KeyIcon />
                    Gemini API Key (Recommended)
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    Powers AI features: CV analysis, cover letter generation, chat assistance, and job description extraction. Highly recommended for full functionality.
                  </p>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">How to get your free Gemini API key:</p>
                    <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-2">
                      <li>Visit <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{color:'var(--accent)'}}>https://makersuite.google.com/app/apikey</a></li>
                      <li>Sign in with your Google account</li>
                      <li>Click "Create API Key"</li>
                      <li>Copy the generated key (starts with "AIza")</li>
                      <li>Paste it in the form below</li>
                    </ol>
                  </div>
                </div>

                {/* Apify Section */}
                <div className="p-4 rounded-lg" style={{background:'var(--bg-elevated)', border:'1px solid var(--border)'}}>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{color:'var(--text-primary)'}}>
                    <KeyIcon />
                    Apify API Token (Optional)
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    Only needed if you want to sync your LinkedIn profile data. You can skip this if you don't need LinkedIn features.
                  </p>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">How to get your free Apify token:</p>
                    <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-400 ml-2">
                      <li>Visit <a href="https://console.apify.com/account/integrations" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{color:'var(--accent)'}}>https://console.apify.com/account/integrations</a></li>
                      <li>Sign up for a free Apify account (or log in)</li>
                      <li>Go to Settings → Integrations</li>
                      <li>Find "Personal API tokens" and click "Create token"</li>
                      <li>Copy the token (starts with "apify_api_")</li>
                      <li>Paste it in the form below (optional)</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security Note */}
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <LockIcon />
          </div>
          <p className="text-sm text-green-800 dark:text-green-200">
            <strong>Security:</strong> Your API keys are stored securely in your account and never shared.
            They are encrypted and only used for your own requests.
          </p>
        </div>

        {/* API Keys Form */}
        <div className="space-y-6">
          {/* Apify API Token Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{background: 'var(--accent-bg)'}}>
                    <KeyIcon />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{fontFamily: 'var(--font-display)', color: 'var(--text-primary)'}}>
                      Apify API Token
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                      Optional - For LinkedIn integration
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isApifyConfigured ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      <CheckIcon />
                      Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-400">
                      Not Configured
                    </span>
                  )}
                  {isApifyConfigured && (
                    <button
                      onClick={() => handleDeleteClick('apify')}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete Apify API token"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label htmlFor="apify-token" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  API Token <span className="text-zinc-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    id="apify-token"
                    type={showApifyToken ? 'text' : 'password'}
                    value={apifyToken}
                    onChange={(e) => {
                      setApifyToken(e.target.value);
                      setApifyTokenTouched(true);
                    }}
                    onBlur={() => setApifyTokenTouched(true)}
                    placeholder={isApifyConfigured ? `Current: ${apiKeys?.apify?.accessToken || '****'}` : 'Enter your Apify token (starts with apify_api_) - Optional'}
                    className={`w-full px-4 py-2.5 pr-12 border rounded-lg bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-colors ${apifyValidation?.valid === false
                      ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                      : apifyValidation?.valid === true
                        ? 'border-green-300 dark:border-green-700 focus:ring-green-500'
                        : 'border-zinc-300 dark:border-zinc-600 focus:ring-gold-500/50'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApifyToken(!showApifyToken)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    aria-label={showApifyToken ? 'Hide token' : 'Show token'}
                  >
                    {showApifyToken ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                  {apifyValidation && (
                    <div className={`absolute right-12 top-1/2 transform -translate-y-1/2 ${apifyValidation.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                      {apifyValidation.valid ? <CheckIcon /> : <XIcon />}
                    </div>
                  )}
                </div>
                {apifyValidation && (
                  <p className={`mt-2 text-xs flex items-center gap-1 ${apifyValidation.valid
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                    }`}>
                    {apifyValidation.valid ? <CheckIcon /> : <XIcon />}
                    {apifyValidation.message}
                  </p>
                )}
                {!apifyValidation && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Format: Starts with "apify_api_" and at least 20 characters (optional)
                  </p>
                )}
                {isApifyConfigured && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Current token: {apiKeys?.apify?.accessToken || '****'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* AI Provider Settings Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{background: 'var(--accent-bg)'}}>
                  <KeyIcon />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{fontFamily: 'var(--font-display)', color: 'var(--text-primary)'}}>
                    AI Provider Settings
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                    Configure your AI provider preferences
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-6">
              {/* Default Provider Selection */}
              <div>
                <label htmlFor="default-provider" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Default AI Provider
                </label>
                <select
                  id="default-provider"
                  value={defaultProvider}
                  onChange={(e) => setDefaultProvider(e.target.value as 'gemini' | 'openrouter' | 'ollama' | '')}
                  className="input-base w-full px-4 py-2.5 focus:ring-gold-500/50"
                >
                  <option value="" className="dark:bg-zinc-600">Select a provider...</option>
                  <option value="gemini" className="dark:bg-zinc-600">Gemini</option>
                  <option value="openrouter" className="dark:bg-zinc-600">OpenRouter</option>
                  <option value="ollama" className="dark:bg-zinc-600">Ollama</option>
                </select>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Select your preferred AI provider. You must select a provider to use AI features.
                </p>
              </div>

              {/* Default Model Selection */}
              <div>
                <label htmlFor="default-model" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Default Model <span className="text-zinc-400 text-xs font-normal">(Optional)</span>
                </label>
                <SearchableSelect
                  id="default-model"
                  value={defaultModel}
                  onChange={(value: string) => setDefaultModel(value === 'Use provider default' ? '' : value)}
                  options={['Use provider default', ...availableModels]}
                  placeholder="Use provider default"
                  disabled={loadingModels || availableModels.length === 0}
                  className=""
                />
                {loadingModels ? (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Loading available models...
                  </p>
                ) : availableModels.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    {defaultProvider === 'ollama'
                      ? 'No models found. Please ensure Ollama is running and you have installed models (e.g., run "ollama pull llama3" in your terminal).'
                      : `No models available. Please configure your ${defaultProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} API key in the settings first.`}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Select a default model for {defaultProvider}. Leave empty to use provider default.
                  </p>
                )}
              </div>

              {/* Gemini API Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="gemini-key" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Gemini API Key <span className="text-zinc-400 text-xs font-normal">(Recommended)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {isGeminiConfigured ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        <CheckIcon />
                        Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-400">
                        Not Configured
                      </span>
                    )}
                    {isGeminiConfigured && (
                      <button
                        onClick={() => handleDeleteClick('gemini')}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete Gemini API key"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    id="gemini-key"
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
                      setGeminiKeyTouched(true);
                    }}
                    onBlur={() => setGeminiKeyTouched(true)}
                    placeholder={isGeminiConfigured ? `Current: ${apiKeys?.gemini?.accessToken || apiKeys?.aiProviders?.providers?.gemini?.accessToken || '****'}` : 'Enter your Gemini API key (starts with AIza)'}
                    className={`w-full px-4 py-2.5 pr-12 border rounded-lg bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-colors ${geminiValidation?.valid === false
                      ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                      : geminiValidation?.valid === true
                        ? 'border-green-300 dark:border-green-700 focus:ring-green-500'
                        : 'border-zinc-300 dark:border-zinc-600 focus:ring-gold-500/50'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    aria-label={showGeminiKey ? 'Hide key' : 'Show key'}
                  >
                    {showGeminiKey ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                  {geminiValidation && (
                    <div className={`absolute right-12 top-1/2 transform -translate-y-1/2 ${geminiValidation.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                      {geminiValidation.valid ? <CheckIcon /> : <XIcon />}
                    </div>
                  )}
                </div>
                {geminiValidation && (
                  <p className={`mt-2 text-xs flex items-center gap-1 ${geminiValidation.valid
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                    }`}>
                    {geminiValidation.valid ? <CheckIcon /> : <XIcon />}
                    {geminiValidation.message}
                  </p>
                )}
                {!geminiValidation && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Format: Starts with "AIza" and at least 20 characters. Recommended for AI features.
                  </p>
                )}
                {isGeminiConfigured && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Current key: {apiKeys?.gemini?.accessToken || apiKeys?.aiProviders?.providers?.gemini?.accessToken || '****'}
                  </p>
                )}
              </div>

              {/* OpenRouter API Key */}
              <div>
                <label htmlFor="openrouter-key" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  OpenRouter API Key <span className="text-zinc-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    id="openrouter-key"
                    type={showOpenRouterKey ? 'text' : 'password'}
                    value={openRouterKey}
                    onChange={(e) => {
                      setOpenRouterKey(e.target.value);
                      setOpenRouterKeyTouched(true);
                    }}
                    onBlur={() => setOpenRouterKeyTouched(true)}
                    placeholder={isOpenRouterConfigured ? `Current: ${apiKeys?.aiProviders?.providers?.openrouter?.accessToken || '****'}` : 'Enter your OpenRouter API key (starts with sk-or-v1- or sk-)'}
                    className={`w-full px-4 py-2.5 pr-12 border rounded-lg bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-colors ${openRouterValidation?.valid === false
                      ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                      : openRouterValidation?.valid === true
                        ? 'border-green-300 dark:border-green-700 focus:ring-green-500'
                        : 'border-zinc-300 dark:border-zinc-600 focus:ring-gold-500/50'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    aria-label={showOpenRouterKey ? 'Hide key' : 'Show key'}
                  >
                    {showOpenRouterKey ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                  {openRouterValidation && (
                    <div className={`absolute right-12 top-1/2 transform -translate-y-1/2 ${openRouterValidation.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                      {openRouterValidation.valid ? <CheckIcon /> : <XIcon />}
                    </div>
                  )}
                </div>
                {openRouterValidation && (
                  <p className={`mt-2 text-xs flex items-center gap-1 ${openRouterValidation.valid
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                    }`}>
                    {openRouterValidation.valid ? <CheckIcon /> : <XIcon />}
                    {openRouterValidation.message}
                  </p>
                )}
                {!openRouterValidation && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Format: Starts with "sk-or-v1-" or "sk-" and at least 20 characters (optional)
                  </p>
                )}
                {isOpenRouterConfigured && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Current key: {apiKeys?.aiProviders?.providers?.openrouter?.accessToken || '****'}
                    </p>
                    <button
                      onClick={() => handleDeleteClick('openrouter')}
                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete OpenRouter API key"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>

              {/* Ollama Base URL */}
              <div>
                <label htmlFor="ollama-url" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Ollama Base URL <span className="text-zinc-400 text-xs font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    id="ollama-url"
                    type={showOllamaUrl ? 'text' : 'password'}
                    value={ollamaUrl}
                    onChange={(e) => {
                      setOllamaUrl(e.target.value);
                      setOllamaUrlTouched(true);
                    }}
                    onBlur={() => setOllamaUrlTouched(true)}
                    placeholder="http://localhost:11434"
                    className={`w-full px-4 py-2.5 pr-12 border rounded-lg bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-colors ${ollamaValidation?.valid === false
                      ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                      : ollamaValidation?.valid === true
                        ? 'border-green-300 dark:border-green-700 focus:ring-green-500'
                        : 'border-zinc-300 dark:border-zinc-600 focus:ring-gold-500/50'
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOllamaUrl(!showOllamaUrl)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    aria-label={showOllamaUrl ? 'Hide URL' : 'Show URL'}
                  >
                    {showOllamaUrl ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                  {ollamaValidation && (
                    <div className={`absolute right-12 top-1/2 transform -translate-y-1/2 ${ollamaValidation.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                      {ollamaValidation.valid ? <CheckIcon /> : <XIcon />}
                    </div>
                  )}
                </div>
                {ollamaValidation && (
                  <p className={`mt-2 text-xs flex items-center gap-1 ${ollamaValidation.valid
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                    }`}>
                    {ollamaValidation.valid ? <CheckIcon /> : <XIcon />}
                    {ollamaValidation.message}
                  </p>
                )}
                {!ollamaValidation && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Default: http://localhost:11434 (change if your Ollama instance is running elsewhere)
                  </p>
                )}
                {isOllamaConfigured && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Current URL: {apiKeys?.aiProviders?.providers?.ollama?.baseUrl || 'http://localhost:11434'}
                    </p>
                    <button
                      onClick={() => handleDeleteClick('ollama')}
                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete Ollama configuration"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Google Calendar Integration Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--accent-bg)' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--accent)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                      Google Calendar
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                      Optional — Sync job reminders to your Google Calendar
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLoadingGoogleCal ? (
                    <Spinner size="sm" />
                  ) : googleCalConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      <CheckIcon />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-400">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {googleCalConnected ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Connected account</p>
                    {googleCalEmail && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{googleCalEmail}</p>
                    )}
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                      New reminders will automatically be added to your primary Google Calendar.
                    </p>
                  </div>
                  <button
                    onClick={handleGoogleDisconnect}
                    disabled={isDisconnectingGoogle}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                  >
                    {isDisconnectingGoogle ? <Spinner size="sm" /> : <TrashIcon />}
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Connect your Google account to automatically sync job reminders (e.g. "Follow up in one week")
                    directly to your Google Calendar with popup &amp; email notifications.
                  </p>
                  <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 list-disc list-inside">
                    <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent)' }}>Google Cloud Console</a></li>
                    <li>Create a project → Enable "Google Calendar API"</li>
                    <li>OAuth consent screen → Create OAuth 2.0 Client ID (Web application)</li>
                    <li>Add your server's callback URL, then set <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">GOOGLE_CLIENT_ID</code>, <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">GOOGLE_CLIENT_SECRET</code>, and <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">GOOGLE_REDIRECT_URI</code> in your server environment.</li>
                  </ul>
                  <button
                    onClick={handleGoogleConnect}
                    disabled={isConnectingGoogle}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isConnectingGoogle ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 48 48" fill="none">
                        <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
                        <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
                        <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
                        <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
                      </svg>
                    )}
                    Connect Google Account
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={
                isSaving ||
                (geminiKey.trim() === '' && apifyToken.trim() === '' && openRouterKey.trim() === '' && ollamaUrl.trim() === '') ||
                (geminiKey.trim() !== '' && geminiValidation?.valid === false) ||
                (apifyToken.trim() !== '' && apifyValidation?.valid === false) ||
                (openRouterKey.trim() !== '' && openRouterValidation?.valid === false) ||
                (ollamaUrl.trim() !== '' && ollamaValidation?.valid === false)
              }
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Spinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckIcon />
                    <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, service: null })}
          onConfirm={handleDeleteConfirm}
          title={`Delete ${deleteModal.service === 'gemini' ? 'Gemini' : deleteModal.service === 'openrouter' ? 'OpenRouter' : deleteModal.service === 'ollama' ? 'Ollama' : 'Apify'} API Key?`}
          message={`Are you sure you want to delete your ${deleteModal.service} ${deleteModal.service === 'ollama' ? 'configuration' : 'API key'}? This action cannot be undone and you'll need to re-enter it to use ${deleteModal.service === 'gemini' || deleteModal.service === 'openrouter' || deleteModal.service === 'ollama' ? 'AI features' : 'LinkedIn integration'}.`}
          confirmText="Delete"
          cancelText="Cancel"
        />

        {/* Toast Notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
};

export default SettingsPage;

