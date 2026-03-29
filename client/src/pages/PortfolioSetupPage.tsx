// client/src/pages/PortfolioSetupPage.tsx
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getCurrentUserProfile,
  updateProfile,
  syncLinkedIn,
  importGitHubProjects,
  getCurrentUserProjects,
  updateProject,
  updateProjectOrders,
  togglePortfolioPublish,
  getPublishedPortfolios,
  Project,
  PublishedProfile,
} from '../services/portfolioApi';
// Username updates are no longer allowed after registration
// import { updateUsername as updateUsernameAPI } from '../services/authApi';
import Spinner from '../components/common/Spinner';
import ErrorAlert from '../components/common/ErrorAlert';
import Toast from '../components/common/Toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableProjectItemProps {
  project: Project;
  onToggleVisibility: (projectId: string, currentVisibility: boolean) => void;
}

const SortableProjectItem: React.FC<SortableProjectItemProps> = ({ project, onToggleVisibility }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-move"
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <svg
            className="w-5 h-5 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white">{project.title}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
            {project.description}
          </p>
          {project.technologies && project.technologies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {project.technologies.slice(0, 3).map((tech, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer ml-4">
        <input
          type="checkbox"
          checked={project.isVisibleInPortfolio ?? true}
          onChange={() => onToggleVisibility(project._id, project.isVisibleInPortfolio ?? true)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
      </label>
    </div>
  );
};

const PortfolioSetupPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize activeTab from URL parameter, default to 0
  const tabFromUrl = searchParams.get('tab');
  const initialTab = tabFromUrl ? parseInt(tabFromUrl, 10) : 0;
  const [activeTab, setActiveTab] = useState(initialTab >= 0 && initialTab <= 4 ? initialTab : 0);
  const [profile, setProfile] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [publishedProfiles, setPublishedProfiles] = useState<PublishedProfile[]>([]);
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [portfolioUsername, setPortfolioUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedInError, setLinkedInError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Helper to check if error is about missing API key
  const isApiKeyError = (errorMessage: string): boolean => {
    return errorMessage.toLowerCase().includes('api key') ||
      errorMessage.toLowerCase().includes('gemini');
  };

  // Connection status
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [isLinkedInConnected, setIsLinkedInConnected] = useState(false);

  // LinkedIn visibility settings
  const [linkedInSettings, setLinkedInSettings] = useState({
    showLinkedInName: true,
    showLinkedInExperience: true,
    showLinkedInSkills: true,
    showLinkedInLanguages: true,
  });

  // Editable LinkedIn data
  const [linkedInData, setLinkedInData] = useState({
    name: '',
    title: '',
    bio: '',
    location: '',
  });

  // Function to change tab and update URL
  const handleTabChange = (tabIndex: number) => {
    if (tabIndex >= 0 && tabIndex <= 4) {
      setActiveTab(tabIndex);
      setSearchParams({ tab: tabIndex.toString() });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await getCurrentUserProfile();
        setProfile(data.profile);
        setGithubUrl(data.profile?.socialLinks?.github || '');
        setLinkedinUrl(data.profile?.socialLinks?.linkedin || '');

        // Load GitHub token from profile integrations
        setGithubToken(data.profile?.integrations?.github?.accessToken || '');

        // Extract GitHub username from URL
        if (data.profile?.socialLinks?.github) {
          const url = data.profile.socialLinks.github;
          const username = url.split('/').pop()?.replace('.git', '') || '';
          setGithubUsername(username);
        }

        // Load LinkedIn settings
        if (data.profile?.settings) {
          setLinkedInSettings({
            showLinkedInName: data.profile.settings.showLinkedInName ?? true,
            showLinkedInExperience: data.profile.settings.showLinkedInExperience ?? true,
            showLinkedInSkills: data.profile.settings.showLinkedInSkills ?? true,
            showLinkedInLanguages: data.profile.settings.showLinkedInLanguages ?? true,
          });
        }

        // Set profile first for connection status check
        setProfile(data.profile);

        // Check connection status
        const userProjects = await getCurrentUserProjects();
        const hasGitHubProjects = userProjects.some(p => p.sourceType === 'github');
        setIsGitHubConnected(hasGitHubProjects);

        // Check LinkedIn connection
        const isLinkedInSynced = !!(data.profile?.name && data.profile?.title && data.profile?.bio);
        setIsLinkedInConnected(isLinkedInSynced);

        // Load LinkedIn data for editing - prioritize synced LinkedIn data
        // The profile fields (name, title, bio, location) are populated by LinkedIn sync
        setLinkedInData({
          name: data.profile?.name || '',
          title: data.profile?.title || '',
          bio: data.profile?.bio || '',
          location: data.profile?.location || '',
        });

        // Load portfolio username from user object
        setPortfolioUsername(data.user?.username || '');

        // Load projects for Configure GitHub tab
        if (activeTab === 1) {
          const githubProjects = userProjects.filter(p => p.sourceType === 'github');
          // Sort by order, then by creation date
          githubProjects.sort((a, b) => {
            const orderA = a.order ?? 0;
            const orderB = b.order ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          });
          setProjects(githubProjects);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  // Sync activeTab with URL parameter when it changes (e.g., browser back/forward)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl !== null) {
      const tabIndex = parseInt(tabFromUrl, 10);
      if (tabIndex >= 0 && tabIndex <= 4 && tabIndex !== activeTab) {
        setActiveTab(tabIndex);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 1) {
      loadProjects();
    } else if (activeTab === 2) {
      // Refresh LinkedIn data when accessing the LinkedIn Data tab
      refreshLinkedInData();
    } else if (activeTab === 4) {
      loadPublishedPortfolios();
    }
  }, [activeTab]);

  const loadPublishedPortfolios = async () => {
    try {
      setIsLoading(true);
      const profiles = await getPublishedPortfolios();
      setPublishedProfiles(profiles);
    } catch (err: any) {
      console.error('Error loading published portfolios:', err);
      // Don't set global error to avoid blocking the user
    } finally {
      setIsLoading(false);
    }
  };

  const refreshLinkedInData = async () => {
    try {
      const data = await getCurrentUserProfile();
      // Update editable LinkedIn data with latest profile data
      setLinkedInData({
        name: data.profile?.name || '',
        title: data.profile?.title || '',
        bio: data.profile?.bio || '',
        location: data.profile?.location || '',
      });
      // Update profile state
      setProfile(data.profile);
    } catch (err: any) {
      console.error('Error refreshing LinkedIn data:', err);
    }
  };


  const loadProjects = async () => {
    try {
      const userProjects = await getCurrentUserProjects();
      const githubProjects = userProjects.filter(p => p.sourceType === 'github');
      // Sort by order, then by creation date
      githubProjects.sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setProjects(githubProjects);
    } catch (err: any) {
      console.error('Error loading projects:', err);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = projects.findIndex((p) => p._id === active.id);
      const newIndex = projects.findIndex((p) => p._id === over.id);

      const newProjects = arrayMove(projects, oldIndex, newIndex);
      setProjects(newProjects);

      // Update orders in backend
      try {
        const projectOrders = newProjects.map((project, index) => ({
          id: project._id,
          order: index,
        }));
        await updateProjectOrders(projectOrders);
        setToast({ message: 'Project order updated!', type: 'success' });
      } catch (err: any) {
        // Revert on error
        setProjects(projects);
        setError(err.message || 'Failed to update project order');
        setToast({ message: err.message || 'Failed to update project order', type: 'error' });
      }
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      await updateProfile({
        socialLinks: {
          github: githubUrl,
          linkedin: linkedinUrl,
        },
        integrations: {
          github: {
            accessToken: githubToken || undefined,
          },
        },
      });

      setToast({ message: 'Profile updated successfully!', type: 'success' });

      // Refresh profile and check connection status
      const data = await getCurrentUserProfile();
      setProfile(data.profile);

      // Check connection status
      const userProjects = await getCurrentUserProjects();
      const hasGitHubProjects = userProjects.some(p => p.sourceType === 'github');
      setIsGitHubConnected(hasGitHubProjects);

      const isLinkedInSynced = !!(data.profile?.name && data.profile?.title && data.profile?.bio);
      setIsLinkedInConnected(isLinkedInSynced);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update profile';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLinkedInData = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Update profile with LinkedIn data and settings
      await updateProfile({
        name: linkedInData.name,
        title: linkedInData.title,
        bio: linkedInData.bio,
        location: linkedInData.location,
        settings: {
          ...profile?.settings,
          ...linkedInSettings,
        },
      });

      setToast({ message: 'LinkedIn data saved successfully!', type: 'success' });

      // Refresh profile
      const data = await getCurrentUserProfile();
      setProfile(data.profile);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save LinkedIn data';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncLinkedIn = async () => {
    try {
      setIsSyncing(true);
      setError(null);
      setLinkedInError(null);

      // First, save the LinkedIn URL to the profile if it's provided
      if (linkedinUrl) {
        await updateProfile({
          socialLinks: {
            linkedin: linkedinUrl,
            // Preserve existing social links
            github: profile?.socialLinks?.github,
          },
        });
      }

      // Then sync the LinkedIn profile
      await syncLinkedIn();
      setToast({ message: 'LinkedIn profile synced successfully!', type: 'success' });

      // Refresh profile and check connection status
      const data = await getCurrentUserProfile();
      setProfile(data.profile);

      // Update editable LinkedIn data with synced data
      setLinkedInData({
        name: data.profile?.name || '',
        title: data.profile?.title || '',
        bio: data.profile?.bio || '',
        location: data.profile?.location || '',
      });

      // Check if LinkedIn data (including experience, skills, languages) was synced
      const isLinkedInSynced = !!(data.profile?.name && data.profile?.title && data.profile?.bio);
      const hasLinkedInExtendedData = !!(data.profile?.linkedInExperience?.length || data.profile?.linkedInSkills?.length || data.profile?.linkedInLanguages?.length);
      setIsLinkedInConnected(isLinkedInSynced || hasLinkedInExtendedData);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to sync LinkedIn profile';
      setLinkedInError(errorMessage);
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportGitHub = async () => {
    if (!githubUsername) {
      setError('Please enter a GitHub username');
      return;
    }

    try {
      setIsImporting(true);
      setError(null);

      await importGitHubProjects(githubUsername);
      setToast({ message: 'GitHub projects imported successfully!', type: 'success' });

      // Refresh projects and connection status
      const userProjects = await getCurrentUserProjects();
      const githubProjects = userProjects.filter(p => p.sourceType === 'github');
      // Sort by order, then by creation date
      githubProjects.sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setProjects(githubProjects);
      const hasGitHubProjects = userProjects.some(p => p.sourceType === 'github');
      setIsGitHubConnected(hasGitHubProjects);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to import GitHub projects';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });

      // Auto-detect if token is needed based on error message
      const needsToken =
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('token is recommended');

      if (needsToken && !githubToken) {
        // Focus token field or show additional hint
        setTimeout(() => {
          const tokenInput = document.getElementById('github-token-input');
          if (tokenInput) {
            tokenInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (tokenInput as HTMLInputElement).focus();
          }
        }, 100);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleProjectVisibility = async (projectId: string, currentVisibility: boolean) => {
    try {
      await updateProject(projectId, { isVisibleInPortfolio: !currentVisibility });
      await loadProjects();
      setToast({ message: 'Project visibility updated!', type: 'success' });
    } catch (err: any) {
      setError(err.message || 'Failed to update project visibility');
      setToast({ message: err.message || 'Failed to update project visibility', type: 'error' });
    }
  };

  const handleTogglePublish = async () => {
    try {
      setIsTogglingPublish(true);
      setError(null);

      const newPublishStatus = !profile?.isPublished;
      await togglePortfolioPublish(newPublishStatus);

      setToast({
        message: newPublishStatus ? 'Portfolio published successfully!' : 'Portfolio unpublished successfully!',
        type: 'success'
      });

      // Refresh profile
      const data = await getCurrentUserProfile();
      setProfile(data.profile);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to toggle publish status';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsTogglingPublish(false);
    }
  };

  // Username updates are no longer allowed after registration
  // The handleUpdateUsername function has been removed

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Simplified: only 2 tabs – Setup (0) and Community (1)
  const setupTab = activeTab <= 3 ? 0 : 1;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-display">
      <main className="flex-grow flex justify-center py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">

          {/* ── Page Header ─────────────────────────────────── */}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Your Portfolio</h1>
            <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-sm">
              Connect your accounts, curate your projects and profile, then go live — all in one place.
            </p>
          </div>

          {/* ── Tabs ────────────────────────────────────────── */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 gap-6">
            <button
              onClick={() => { setActiveTab(0); setSearchParams({ tab: '0' }); }}
              className={`pb-3 pt-1 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${setupTab === 0
                ? 'border-primary text-gray-900 dark:text-white'
                : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              Setup
            </button>
            <button
              onClick={() => { setActiveTab(4); setSearchParams({ tab: '4' }); }}
              className={`pb-3 pt-1 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${setupTab === 1
                ? 'border-primary text-gray-900 dark:text-white'
                : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              Community
            </button>
          </div>

          {error && <div className="mb-2"><ErrorAlert message={error} /></div>}

          {/* ══════════════════════════════════════════════════
              SETUP TAB
          ══════════════════════════════════════════════════ */}
          {setupTab === 0 && (
            <div className="flex flex-col gap-8">

              {/* ── Step 1: Connect ─────────────────────────── */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">Connect Your Accounts</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">We pull your projects and experience directly — no copy-pasting.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* GitHub card */}
                  <div className="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-gray-800 dark:text-white" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">GitHub</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Import your public repositories</p>
                      </div>
                      {isGitHubConnected && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium flex-shrink-0">Connected</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={githubUrl}
                        onChange={(e) => {
                          setGithubUrl(e.target.value);
                          const url = e.target.value;
                          setGithubUsername(url.split('/').pop()?.replace('.git', '') || '');
                        }}
                        placeholder="https://github.com/username"
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div>
                        <input
                          id="github-token-input"
                          type="password"
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          placeholder="Personal Access Token (optional)"
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Only needed to avoid rate limits on public repos.</p>
                      </div>
                    </div>

                    <button
                      onClick={handleImportGitHub}
                      disabled={!githubUsername || isImporting}
                      className="flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isImporting ? (
                        <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Importing…</>
                      ) : isGitHubConnected ? (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh from GitHub</>
                      ) : (
                        'Connect GitHub'
                      )}
                    </button>
                  </div>

                  {/* LinkedIn card */}
                  <div className="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-bg)' }}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">LinkedIn</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Import experience, skills & bio</p>
                      </div>
                      {isLinkedInConnected && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium flex-shrink-0">Connected</span>
                      )}
                    </div>

                    <input
                      type="text"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    {linkedInError && (
                      <div className={`p-3 rounded-lg border text-xs ${isApiKeyError(linkedInError)
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                        }`}>
                        {linkedInError}
                        {isApiKeyError(linkedInError) && (
                          <Link to="/settings" className="block mt-1.5 underline font-medium">Go to Settings →</Link>
                        )}
                      </div>
                    )}

                    <button
                      onClick={handleSyncLinkedIn}
                      disabled={!linkedinUrl || isSyncing}
                      className="flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-white"
                      style={{ background: 'var(--accent)' }}
                    >
                      {isSyncing ? (
                        <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Syncing…</>
                      ) : isLinkedInConnected ? (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh from LinkedIn</>
                      ) : (
                        'Connect LinkedIn'
                      )}
                    </button>
                  </div>
                </div>
              </section>

              {/* ── Step 2: Projects ────────────────────────── */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</span>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">Choose Projects to Display</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Drag to reorder · toggle the switch to show or hide each project.</p>
                    </div>
                  </div>
                  {isGitHubConnected && (
                    <button
                      onClick={handleImportGitHub}
                      disabled={!githubUsername || isImporting}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      {isImporting ? 'Refreshing…' : 'Refresh'}
                    </button>
                  )}
                </div>

                <div className="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                  {!isGitHubConnected || projects.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                      <svg className="w-10 h-10 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      <p className="text-sm">No GitHub projects yet. Connect GitHub above to import them.</p>
                    </div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={projects.map((p) => p._id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                          {projects.map((project) => (
                            <SortableProjectItem key={project._id} project={project} onToggleVisibility={handleToggleProjectVisibility} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </section>

              {/* ── Step 3: Profile Info ─────────────────────── */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">3</span>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">Edit Your Profile Info</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Auto-filled from LinkedIn — you can edit anything before publishing.</p>
                    </div>
                  </div>
                  {isLinkedInConnected && (
                    <button
                      onClick={handleSyncLinkedIn}
                      disabled={!linkedinUrl || isSyncing}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      {isSyncing ? 'Refreshing…' : 'Refresh from LinkedIn'}
                    </button>
                  )}
                </div>

                {!isLinkedInConnected && !linkedInData.name && (
                  <div className="flex items-start gap-3 p-3 rounded-lg text-sm" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)' }}>
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p style={{ color: 'var(--text-secondary)' }}>Connect LinkedIn above to auto-fill these fields, or fill them in manually.</p>
                  </div>
                )}

                <div className="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
                      <input type="text" value={linkedInData.name} onChange={(e) => setLinkedInData({ ...linkedInData, name: e.target.value })} placeholder="Your full name" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Professional Title</label>
                      <input type="text" value={linkedInData.title} onChange={(e) => setLinkedInData({ ...linkedInData, title: e.target.value })} placeholder="e.g. Software Engineer" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
                    <input type="text" value={linkedInData.location} onChange={(e) => setLinkedInData({ ...linkedInData, location: e.target.value })} placeholder="e.g. Berlin, Germany" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Bio / Summary</label>
                    <textarea value={linkedInData.bio} onChange={(e) => setLinkedInData({ ...linkedInData, bio: e.target.value })} rows={4} placeholder="A short intro about yourself…" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                  </div>
                </div>

                {/* Visibility toggles */}
                <div className="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">What to show on your portfolio</p>
                  <div className="space-y-2">
                    {[
                      { key: 'showLinkedInName' as const, label: 'Name, title & bio' },
                      { key: 'showLinkedInExperience' as const, label: 'Work experience' },
                      { key: 'showLinkedInSkills' as const, label: 'Skills' },
                      { key: 'showLinkedInLanguages' as const, label: 'Languages' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                        <div className="relative inline-flex items-center cursor-pointer ml-4">
                          <input type="checkbox" checked={linkedInSettings[key]} onChange={(e) => setLinkedInSettings({ ...linkedInSettings, [key]: e.target.checked })} className="sr-only peer" />
                          <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSaveLinkedInData} disabled={isSaving} className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40">
                    {isSaving ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving…</> : 'Save Profile Info'}
                  </button>
                </div>
              </section>

              {/* ── Step 4: Publish ──────────────────────────── */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">4</span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">Go Live</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Make your portfolio publicly accessible with a shareable URL.</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${profile?.isPublished ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${profile?.isPublished ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                        {profile?.isPublished ? 'Published' : 'Not published'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {profile?.isPublished
                        ? 'Your portfolio is live and visible to anyone with the link.'
                        : 'Your portfolio is currently private. Publish it so recruiters and others can find you.'}
                    </p>
                    {profile?.isPublished && portfolioUsername && (
                      <a
                        href={`${window.location.origin}/portfolio/${portfolioUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary font-medium hover:underline break-all"
                      >
                        {window.location.origin}/portfolio/{portfolioUsername}
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    )}
                    {!portfolioUsername && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">⚠ No username set — contact support or set one during registration.</p>
                    )}
                  </div>

                  <button
                    onClick={handleTogglePublish}
                    disabled={isTogglingPublish}
                    className={`flex-shrink-0 flex items-center justify-center gap-2 h-10 px-6 rounded-lg text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${profile?.isPublished ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-primary text-white hover:bg-primary/90'}`}
                  >
                    {isTogglingPublish ? (
                      <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Working…</>
                    ) : profile?.isPublished ? (
                      'Unpublish'
                    ) : (
                      'Publish Portfolio'
                    )}
                  </button>
                </div>
              </section>

            </div>
          )}

          {/* ══════════════════════════════════════════════════
              COMMUNITY TAB
          ══════════════════════════════════════════════════ */}
          {setupTab === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publishedProfiles.map((prof) => (
                <a
                  key={prof._id}
                  href={`/portfolio/${prof.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-lg transition-all flex flex-col h-full"
                >
                  <div className="h-28 bg-gradient-to-r from-blue-500 to-primary/80 relative">
                    {prof.profileImageUrl ? (
                      <img src={prof.profileImageUrl} alt={prof.name} className="absolute -bottom-7 left-5 w-14 h-14 rounded-full border-4 border-white dark:border-gray-800 object-cover" />
                    ) : (
                      <div className="absolute -bottom-7 left-5 w-14 h-14 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-lg font-bold text-gray-500">
                        {prof.name?.charAt(0) || prof.username.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-5 pt-10 flex-grow flex flex-col">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate">{prof.name || prof.username}</h3>
                    <p className="text-xs text-primary mb-2">@{prof.username}</p>
                    {prof.title && <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-2 line-clamp-1">{prof.title}</p>}
                    {prof.bio && <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 flex-grow">{prof.bio}</p>}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex justify-between text-xs text-gray-400">
                      <span>Joined {new Date(prof.createdAt).toLocaleDateString()}</span>
                      <span className="group-hover:translate-x-1 transition-transform text-primary flex items-center gap-1">View <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></span>
                    </div>
                  </div>
                </a>
              ))}

              {publishedProfiles.length === 0 && !isLoading && (
                <div className="col-span-full text-center py-16 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <p className="text-sm">No portfolios published yet. Be the first!</p>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default PortfolioSetupPage;
