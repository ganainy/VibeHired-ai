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
import LoadingSkeleton from '../components/common/LoadingSkeleton';
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
      errorMessage.toLowerCase().includes('apify') ||
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

  const stepNames = ['Connecting Accounts', 'Configuring GitHub Repos', 'Configuring LinkedIn Data', 'Publish Portfolio', 'Community Portfolios'];

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

  const handleSaveAndContinue = async () => {
    if (activeTab === 0) {
      // Save URLs and move to next tab
      await handleSave();
      if (!error) {
        handleTabChange(1);
      }
    } else if (activeTab === 1) {
      // Move to LinkedIn configuration tab
      handleTabChange(2);
    } else if (activeTab === 2) {
      // Save LinkedIn data and settings, move to publish
      await handleSaveLinkedInData();
      if (!error) {
        handleTabChange(3);
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
        <LoadingSkeleton />
      </div>
    );
  }

  const progressPercentage = ((activeTab + 1) / 5) * 100;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-display">
      <main className="flex-grow flex justify-center py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full flex flex-col">
          {/* Page Heading */}
          <div className="flex flex-wrap justify-between gap-4 p-4 items-center">
            <div className="flex flex-col gap-2">
              <h1 className="text-zinc-900 dark:text-white text-2xl font-bold leading-tight">
                Portfolio Setup
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 text-base font-normal leading-normal">
                Connect your accounts, configure your data, and publish your professional portfolio in minutes.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6">
            <div className="flex border-b border-gray-200 dark:border-gray-700/80 gap-4 sm:gap-8 px-4 overflow-x-auto">
              <button
                onClick={() => handleTabChange(0)}
                className={`flex items-center justify-center gap-2 border-b-[3px] pb-[13px] pt-4 transition-colors whitespace-nowrap ${activeTab === 0
                  ? 'border-b-primary text-gray-900 dark:text-white'
                  : 'border-b-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
              >
                <span className="material-symbols-outlined text-base">link</span>
                <p className="text-sm font-bold leading-normal tracking-[0.015em]">Connect Accounts</p>
              </button>
              <button
                onClick={() => handleTabChange(1)}
                className={`flex items-center justify-center gap-2 border-b-[3px] pb-[13px] pt-4 transition-colors whitespace-nowrap ${activeTab === 1
                  ? 'border-b-primary text-gray-900 dark:text-white'
                  : 'border-b-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
              >
                <span className="material-symbols-outlined text-base">code</span>
                <p className="text-sm font-bold leading-normal tracking-[0.015em]">GitHub Repos</p>
              </button>
              <button
                onClick={() => handleTabChange(2)}
                className={`flex items-center justify-center gap-2 border-b-[3px] pb-[13px] pt-4 transition-colors whitespace-nowrap ${activeTab === 2
                  ? 'border-b-primary text-gray-900 dark:text-white'
                  : 'border-b-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
              >
                <span className="material-symbols-outlined text-base">work</span>
                <p className="text-sm font-bold leading-normal tracking-[0.015em]">LinkedIn Data</p>
              </button>
              <button
                onClick={() => handleTabChange(3)}
                className={`flex items-center justify-center gap-2 border-b-[3px] pb-[13px] pt-4 transition-colors whitespace-nowrap ${activeTab === 3
                  ? 'border-b-primary text-gray-900 dark:text-white'
                  : 'border-b-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
              >
                <span className="material-symbols-outlined text-base">publish</span>
                <p className="text-sm font-bold leading-normal tracking-[0.015em]">Publish</p>
              </button>
              <button
                onClick={() => handleTabChange(4)}
                className={`flex items-center justify-center gap-2 border-b-[3px] pb-[13px] pt-4 transition-colors whitespace-nowrap ${activeTab === 4
                  ? 'border-b-primary text-gray-900 dark:text-white'
                  : 'border-b-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
              >
                <span className="material-symbols-outlined text-base">groups</span>
                <p className="text-sm font-bold leading-normal tracking-[0.015em]">Community</p>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex flex-col gap-2 p-4 mt-4">
            <div className="flex gap-6 justify-between">
              <p className="text-gray-700 dark:text-gray-300 text-base font-medium leading-normal">
                Step {activeTab + 1} of 5: {stepNames[activeTab]}
              </p>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-col gap-8 p-4 mt-4">
            {error && (
              <div className="mb-4">
                <ErrorAlert message={error} />
              </div>
            )}

            {/* Tab 1: Connect Accounts */}
            {
              activeTab === 0 && (
                <>
                  <div className="text-center">
                    <h2 className="text-gray-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                      Connect Your Professional Accounts
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Sync your data from GitHub and LinkedIn to build your portfolio automatically.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* GitHub Card */}
                    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80 rounded-xl p-6 flex flex-col items-center text-center shadow-sm hover:shadow-lg transition-shadow duration-300">
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-10 h-10 text-gray-800 dark:text-white" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path>
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">GitHub</h3>
                      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-4 text-sm">
                        Showcase your coding projects, contributions, and technical skills automatically.
                      </p>

                      <div className="w-full space-y-3 mb-4">
                        <input
                          type="text"
                          value={githubUrl}
                          onChange={(e) => {
                            setGithubUrl(e.target.value);
                            const url = e.target.value;
                            const username = url.split('/').pop()?.replace('.git', '') || '';
                            setGithubUsername(username);
                          }}
                          placeholder="https://github.com/username"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="space-y-1">
                          <input
                            id="github-token-input"
                            type="password"
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            placeholder="GitHub Personal Access Token (Optional)"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                            <p>Optional - Only needed for higher rate limits</p>
                            <p>Public repos work without setup (60 requests/hour)</p>
                          </div>
                        </div>
                        <button
                          onClick={handleImportGitHub}
                          disabled={!githubUsername || isImporting}
                          className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-bold hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isImporting ? (
                            <>
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Importing...</span>
                            </>
                          ) : (
                            <span>Connect</span>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-4 text-sm text-gray-500 dark:text-gray-400">
                        {isGitHubConnected ? (
                          <>
                            <span className="material-symbols-outlined text-base text-green-600 dark:text-green-400">check_circle</span>
                            <span className="text-green-600 dark:text-green-400">Connected</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base">cancel</span>
                            <span>Not Connected</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* LinkedIn Card */}
                    <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80 rounded-xl p-6 flex flex-col items-center text-center shadow-sm hover:shadow-lg transition-shadow duration-300">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{background:'var(--accent-bg)', border:'1px solid var(--accent-dim)'}}>
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" style={{color:'var(--accent)'}}>
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path>
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">LinkedIn</h3>
                      <p className="text-gray-500 dark:text-gray-400 mt-2 mb-4 text-sm">
                        Sync your professional experience, education, and skills to keep your portfolio up-to-date.
                      </p>

                      <div className="w-full space-y-3 mb-4">
                        <input
                          type="text"
                          value={linkedinUrl}
                          onChange={(e) => setLinkedinUrl(e.target.value)}
                          placeholder="https://linkedin.com/in/username"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={handleSyncLinkedIn}
                          disabled={!linkedinUrl || isSyncing}
                          className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSyncing ? (
                            <>
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Syncing...</span>
                            </>
                          ) : (
                            <span>Connect</span>
                          )}
                        </button>
                      </div>

                      {/* LinkedIn Error Display */}
                      {linkedInError && (
                        <div className={`w-full mt-3 p-4 rounded-lg border ${isApiKeyError(linkedInError)
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                          : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-800'
                          }`}>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {isApiKeyError(linkedInError) ? (
                                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-sm font-semibold mb-1 ${isApiKeyError(linkedInError)
                                ? 'text-amber-800 dark:text-amber-300'
                                : 'text-red-800 dark:text-red-300'
                                }`}>
                                {isApiKeyError(linkedInError) ? 'API Key Required' : 'Sync Error'}
                              </h3>
                              <p className={`text-sm mb-3 ${isApiKeyError(linkedInError)
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-red-700 dark:text-red-400'
                                }`}>
                                {linkedInError}
                              </p>
                              {isApiKeyError(linkedInError) && (
                                <Link
                                  to="/settings"
                                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors bg-amber-600 hover:bg-amber-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  Go to Settings
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-4 text-sm">
                        {isLinkedInConnected ? (
                          <>
                            <span className="material-symbols-outlined text-base text-green-600 dark:text-green-400">check_circle</span>
                            <span className="text-green-600 dark:text-green-400">Connected</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base text-gray-500 dark:text-gray-400">cancel</span>
                            <span className="text-gray-500 dark:text-gray-400">Not Connected</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )
            }

            {/* Tab 1: Configure GitHub Repositories */}
            {
              activeTab === 1 && (
                <>
                  <div className="text-center">
                    <h2 className="text-gray-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                      Configure GitHub Repositories
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Choose which repositories to display in your portfolio.
                    </p>
                  </div>

                  {/* GitHub Repositories Section */}
                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">GitHub Repositories</h3>
                    {projects.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No GitHub repositories imported yet. Import them from the Connect Accounts tab.
                      </p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={projects.map((p) => p._id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-3">
                            {projects.map((project) => (
                              <SortableProjectItem
                                key={project._id}
                                project={project}
                                onToggleVisibility={handleToggleProjectVisibility}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </>
              )
            }

            {/* Tab 2: Configure LinkedIn Data */}
            {
              activeTab === 2 && (
                <>
                  <div className="text-center">
                    <h2 className="text-gray-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                      Configure LinkedIn Data
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Review and edit your LinkedIn data before adding it to your portfolio.
                    </p>
                  </div>

                  {/* Editable LinkedIn Data Section */}
                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Your Information</h3>
                      {!isLinkedInConnected && (
                        <span className="text-xs px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full">
                          Sync LinkedIn first to auto-fill fields
                        </span>
                      )}
                    </div>
                    {!isLinkedInConnected && !linkedInData.name && !linkedInData.title && (
                      <div className="mb-4 p-4 rounded-lg" style={{background:'var(--accent-bg)', border:'1px solid var(--accent-dim)'}}>
                        <p className="text-sm" style={{color:'var(--text-secondary)'}}>
                          <span className="font-medium" style={{color:'var(--accent)'}}>No LinkedIn data found.</span> Go to the "Connect Accounts" tab and sync your LinkedIn profile to automatically fill these fields with your LinkedIn information.
                        </p>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={linkedInData.name}
                          onChange={(e) => setLinkedInData({ ...linkedInData, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Your full name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Professional Title
                        </label>
                        <input
                          type="text"
                          value={linkedInData.title}
                          onChange={(e) => setLinkedInData({ ...linkedInData, title: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="e.g., Software Engineer, Product Manager"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Bio / Summary
                        </label>
                        <textarea
                          value={linkedInData.bio}
                          onChange={(e) => setLinkedInData({ ...linkedInData, bio: e.target.value })}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                          placeholder="Write a brief summary about yourself..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Location
                        </label>
                        <input
                          type="text"
                          value={linkedInData.location}
                          onChange={(e) => setLinkedInData({ ...linkedInData, location: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="e.g., San Francisco, CA"
                        />
                      </div>
                    </div>
                  </div>

                  {/* LinkedIn Visibility Settings Section */}
                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Visibility Settings</h3>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Show Name, Title & Bio</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Display your LinkedIn name, title, and bio</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linkedInSettings.showLinkedInName}
                            onChange={(e) => setLinkedInSettings({ ...linkedInSettings, showLinkedInName: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </label>
                      </label>

                      <label className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Show Experience</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Display your work experience from LinkedIn</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linkedInSettings.showLinkedInExperience}
                            onChange={(e) => setLinkedInSettings({ ...linkedInSettings, showLinkedInExperience: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </label>
                      </label>

                      <label className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Show Skills</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Display your skills from LinkedIn</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linkedInSettings.showLinkedInSkills}
                            onChange={(e) => setLinkedInSettings({ ...linkedInSettings, showLinkedInSkills: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </label>
                      </label>

                      <label className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Show Languages</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Display your languages from LinkedIn</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linkedInSettings.showLinkedInLanguages}
                            onChange={(e) => setLinkedInSettings({ ...linkedInSettings, showLinkedInLanguages: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </label>
                      </label>
                    </div>
                  </div>
                </>
              )
            }

            {/* Tab 3: Publish Portfolio */}
            {
              activeTab === 3 && (
                <div className="flex flex-col gap-6">
                  <div className="text-center">
                    <h2 className="text-gray-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                      Publish Your Portfolio
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Make your portfolio visible to the public and share it with the world.
                    </p>
                  </div>

                  {/* Username Configuration */}
                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Portfolio Username</h3>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={portfolioUsername || 'Not set'}
                          readOnly
                          disabled
                          placeholder="your-username"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed opacity-75"
                        />
                        {portfolioUsername && (
                          <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
                            Your portfolio will be at: {window.location.origin}/portfolio/{portfolioUsername}
                          </p>
                        )}
                        {!portfolioUsername && (
                          <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">
                            No username set. Your portfolio URL will use your email address.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Publish/Unpublish Section - Improved UX */}
                  <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80 rounded-xl p-8 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          {profile?.isPublished ? (
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30">
                              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-600">
                              <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                          )}
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Portfolio Status</h3>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                          {profile?.isPublished
                            ? 'Your portfolio is currently published and visible to the public. Anyone with the link can view it.'
                            : 'Your portfolio is currently unpublished and not visible to the public. Publish it to make it accessible.'}
                        </p>

                        {profile?.isPublished && portfolioUsername && (
                          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Portfolio URL</p>
                            <a
                              href={`${window.location.origin}/portfolio/${portfolioUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors break-all"
                            >
                              <span>{window.location.origin}/portfolio/{portfolioUsername}</span>
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}
                        {profile?.isPublished && !portfolioUsername && (
                          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                            <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 mb-1">⚠️ No Username Set</p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300">
                              Please set a username above to get your portfolio URL.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        <button
                          onClick={handleTogglePublish}
                          disabled={isTogglingPublish}
                          className={`flex min-w-[140px] items-center justify-center rounded-lg h-12 px-6 text-base font-bold leading-normal tracking-[0.015em] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg ${profile?.isPublished
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-primary text-white hover:bg-primary/90'
                            }`}
                        >
                          {isTogglingPublish ? (
                            <>
                              <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Processing...</span>
                            </>
                          ) : profile?.isPublished ? (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span>Unpublish</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <span>Publish</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            {/* Tab 4: Community Portfolios */}
            {activeTab === 4 && (
              <div className="flex flex-col gap-6">
                <div className="text-center">
                  <h2 className="text-gray-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                    Community Portfolios
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Explore portfolios created by other users and get inspired.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {publishedProfiles.map((profile) => (
                    <a
                      key={profile._id}
                      href={`/portfolio/${profile.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full"
                    >
                      <div className="h-32 bg-gradient-to-r from-blue-500 to-primary/80 relative">
                        {profile.profileImageUrl ? (
                          <img
                            src={profile.profileImageUrl}
                            alt={profile.name}
                            className="absolute -bottom-8 left-6 w-16 h-16 rounded-full border-4 border-white dark:border-gray-800 object-cover"
                          />
                        ) : (
                          <div className="absolute -bottom-8 left-6 w-16 h-16 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xl font-bold text-gray-500">
                            {profile.name?.charAt(0) || profile.username.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="p-6 pt-10 flex-grow flex flex-col">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                          {profile.name || profile.username}
                        </h3>
                        <p className="text-sm text-primary mb-2 truncate">@{profile.username}</p>
                        {profile.title && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-3 line-clamp-1">
                            {profile.title}
                          </p>
                        )}
                        {profile.bio && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-4 flex-grow">
                            {profile.bio}
                          </p>
                        )}
                        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
                          <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                          <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1 text-primary">
                            View <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}

                  {publishedProfiles.length === 0 && !isLoading && (
                    <div className="col-span-full text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No portfolios found</h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        Be the first to publish your portfolio!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {activeTab !== 3 && activeTab !== 4 && (
              <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700/80 mt-4">
                <button
                  onClick={handleSaveAndContinue}
                  disabled={isSaving}
                  className="flex min-w-[120px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span className="truncate">Save & Continue</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default PortfolioSetupPage;
