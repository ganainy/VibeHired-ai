// client/src/pages/PortfolioSetupPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
      className="flex items-center justify-between p-4 border border-theme rounded-xl hover:bg-[var(--bg-elevated)] transition-colors cursor-move bg-white"
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <svg
            className="w-5 h-5 text-muted-color"
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
          <h4 className="font-bold text-primary-color">{project.title}</h4>
          <p className="text-sm text-muted-color mt-1 line-clamp-1">
            {project.description}
          </p>
          {project.technologies && project.technologies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {project.technologies.slice(0, 3).map((tech, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 bg-[var(--bg-elevated)] text-secondary-color rounded-md font-medium"
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
        <div className="w-11 h-6 bg-[var(--bg-raised)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-theme after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
      </label>
    </div>
  );
};

const PortfolioSetupPage: React.FC = () => {
  const { user } = useAuth();

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

  const isApiKeyError = (errorMessage: string): boolean => {
    return errorMessage.toLowerCase().includes('api key') ||
      errorMessage.toLowerCase().includes('gemini');
  };

  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [isLinkedInConnected, setIsLinkedInConnected] = useState(false);

  const [linkedInSettings, setLinkedInSettings] = useState({
    showLinkedInName: true,
    showLinkedInExperience: true,
    showLinkedInSkills: true,
    showLinkedInLanguages: true,
  });

  const [linkedInData, setLinkedInData] = useState({
    name: '',
    title: '',
    bio: '',
    location: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await getCurrentUserProfile();
        setProfile(data.profile);
        setGithubUrl(data.profile?.socialLinks?.github || '');
        setLinkedinUrl(data.profile?.socialLinks?.linkedin || '');

        setGithubToken(data.profile?.integrations?.github?.accessToken || '');

        if (data.profile?.socialLinks?.github) {
          const url = data.profile.socialLinks.github;
          const username = url.split('/').pop()?.replace('.git', '') || '';
          setGithubUsername(username);
        }

        if (data.profile?.settings) {
          setLinkedInSettings({
            showLinkedInName: data.profile.settings.showLinkedInName ?? true,
            showLinkedInExperience: data.profile.settings.showLinkedInExperience ?? true,
            showLinkedInSkills: data.profile.settings.showLinkedInSkills ?? true,
            showLinkedInLanguages: data.profile.settings.showLinkedInLanguages ?? true,
          });
        }

        setProfile(data.profile);

        const userProjects = await getCurrentUserProjects();
        const hasGitHubProjects = userProjects.some(p => p.sourceType === 'github');
        setIsGitHubConnected(hasGitHubProjects);

        const isLinkedInSynced = !!(data.profile?.name && data.profile?.title && data.profile?.bio);
        setIsLinkedInConnected(isLinkedInSynced);

        setLinkedInData({
          name: data.profile?.name || '',
          title: data.profile?.title || '',
          bio: data.profile?.bio || '',
          location: data.profile?.location || '',
        });

        setPortfolioUsername(data.user?.username || '');

        const githubProjects = userProjects.filter(p => p.sourceType === 'github');
        githubProjects.sort((a, b) => {
          const orderA = a.order ?? 0;
          const orderB = b.order ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        setProjects(githubProjects);

        const profiles = await getPublishedPortfolios();
        setPublishedProfiles(profiles);
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

  const loadProjects = async () => {
    try {
      const userProjects = await getCurrentUserProjects();
      const githubProjects = userProjects.filter(p => p.sourceType === 'github');
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

      try {
        const projectOrders = newProjects.map((project, index) => ({
          id: project._id,
          order: index,
        }));
        await updateProjectOrders(projectOrders);
        setToast({ message: 'Project order updated!', type: 'success' });
      } catch (err: any) {
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

      const data = await getCurrentUserProfile();
      setProfile(data.profile);

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

      if (linkedinUrl) {
        await updateProfile({
          socialLinks: {
            linkedin: linkedinUrl,
            github: profile?.socialLinks?.github,
          },
        });
      }

      await syncLinkedIn();
      setToast({ message: 'LinkedIn profile synced successfully!', type: 'success' });

      const data = await getCurrentUserProfile();
      setProfile(data.profile);

      setLinkedInData({
        name: data.profile?.name || '',
        title: data.profile?.title || '',
        bio: data.profile?.bio || '',
        location: data.profile?.location || '',
      });

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

      const userProjects = await getCurrentUserProjects();
      const githubProjects = userProjects.filter(p => p.sourceType === 'github');
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

      const needsToken =
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('token is recommended');

      if (needsToken && !githubToken) {
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

  const completionPercentage = (() => {
    let completed = 0;
    if (isGitHubConnected) completed += 1;
    if (isLinkedInConnected) completed += 1;
    if (projects.length > 0) completed += 1;
    if (linkedInData.name && linkedInData.title) completed += 1;
    if (profile?.isPublished) completed += 1;
    return Math.min(100, Math.round((completed / 5) * 100));
  })();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-display" style={{ backgroundColor: 'var(--bg-base)' }}>
      <main className="flex-grow flex justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">

          {/* Progress Header */}
          <section>
            <div className="flex justify-between items-end mb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-green mb-1">
                  Setup Progress
                </h2>
                <p className="text-2xl font-extrabold text-green">
                  Almost there, {linkedInData.name?.split(' ')[0] || 'there'}!
                </p>
              </div>
              <span className="text-sm font-bold text-green">
                {completionPercentage}% complete
              </span>
            </div>
            <div className="w-full h-3 bg-white rounded-full overflow-hidden shadow-sm border border-theme">
              <div
                className="h-full bg-green-accent rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-color">
              Complete the remaining sections to launch your professional portfolio.
            </p>
          </section>

          {error && <ErrorAlert message={error} />}

          <div className="space-y-8">

            {/* Step 1: Connect Accounts */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-theme">
              <div className="flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-green font-bold shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-primary-color mb-2">Connect Accounts</h3>
                  <p className="text-secondary-color mb-6">
                    Sync your latest activity from developer platforms to keep your portfolio fresh.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* GitHub */}
                    <div className="bg-white border border-theme rounded-xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-elevated">
                          <svg className="w-6 h-6 text-secondary-color" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-primary-color">GitHub</p>
                          <p className="text-xs text-muted-color">Import your public repositories</p>
                        </div>
                        {isGitHubConnected && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--jade-bg)] text-green font-bold flex-shrink-0">
                            Connected
                          </span>
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
                          className="w-full px-3 py-2 text-sm border border-theme rounded-lg bg-white text-primary-color focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <input
                          id="github-token-input"
                          type="password"
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          placeholder="Personal Access Token (optional)"
                          className="w-full px-3 py-2 text-sm border border-theme rounded-lg bg-white text-primary-color focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-color">Only needed to avoid rate limits on public repos.</p>
                      </div>

                      <button
                        onClick={handleImportGitHub}
                        disabled={!githubUsername || isImporting}
                        className="flex items-center justify-center gap-2 h-[50px] px-6 bg-primary hover:bg-green-accent text-white rounded-full font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isImporting ? (
                          <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Importing</>
                        ) : isGitHubConnected ? (
                          <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh from GitHub</>
                        ) : (
                          'Connect GitHub'
                        )}
                      </button>
                    </div>

                    {/* LinkedIn */}
                    <div className="bg-white border border-theme rounded-xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--accent-bg)]">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-primary-color">LinkedIn</p>
                          <p className="text-xs text-muted-color">Import experience, skills &amp; bio</p>
                        </div>
                        {isLinkedInConnected && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--jade-bg)] text-green font-bold flex-shrink-0">
                            Connected
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/username"
                        className="w-full px-3 py-2 text-sm border border-theme rounded-lg bg-white text-primary-color focus:outline-none focus:ring-2 focus:ring-primary"
                      />

                      {linkedInError && (
                        <div className={`p-3 rounded-lg border text-xs ${isApiKeyError(linkedInError)
                          ? 'bg-[var(--ember-bg)] border-[var(--ember)] text-ember'
                          : 'bg-red-50 border-error text-error'
                        }`}>
                          {linkedInError}
                          {isApiKeyError(linkedInError) && (
                            <Link to="/settings" className="block mt-1.5 underline font-medium">Go to Settings</Link>
                          )}
                        </div>
                      )}

                      <button
                        onClick={handleSyncLinkedIn}
                        disabled={!linkedinUrl || isSyncing}
                        className="flex items-center justify-center gap-2 h-[50px] px-6 bg-green-accent hover:bg-primary text-white rounded-full font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isSyncing ? (
                          <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Syncing</>
                        ) : isLinkedInConnected ? (
                          <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh from LinkedIn</>
                        ) : (
                          'Connect LinkedIn'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Choose Projects */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-theme">
              <div className="flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-green font-bold shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-primary-color mb-2">Choose Projects</h3>
                  <p className="text-secondary-color mb-6">
                    Select which repositories and contributions to highlight in your showcase.
                  </p>

                  <div className="bg-white border border-theme rounded-xl p-5">
                    {!isGitHubConnected || projects.length === 0 ? (
                      <div className="text-center py-8 text-muted-color">
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
                </div>
              </div>
            </div>

            {/* Step 3: Edit Profile Info */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-theme">
              <div className="flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-green font-bold shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-primary-color mb-2">Edit Profile Info</h3>
                  <p className="text-secondary-color mb-6">
                    Make your professional identity shine with a compelling bio and headline.
                  </p>

                  {!isLinkedInConnected && !linkedInData.name && (
                    <div className="flex items-start gap-3 p-4 rounded-xl mb-6 text-sm bg-[var(--accent-bg)] border border-[var(--accent-dim)]">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-secondary-color">Connect LinkedIn above to auto-fill these fields, or fill them in manually.</p>
                    </div>
                  )}

                  <div className="bg-white border border-theme rounded-xl p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-muted-color uppercase tracking-wider mb-2">Full Name</label>
                        <input
                          type="text"
                          value={linkedInData.name}
                          onChange={(e) => setLinkedInData({ ...linkedInData, name: e.target.value })}
                          placeholder="Your full name"
                          className="w-full bg-elevated border-transparent focus:border-green-accent focus:ring-0 rounded-lg p-3 text-primary-color font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-color uppercase tracking-wider mb-2">Professional Title</label>
                        <input
                          type="text"
                          value={linkedInData.title}
                          onChange={(e) => setLinkedInData({ ...linkedInData, title: e.target.value })}
                          placeholder="e.g. Software Engineer"
                          className="w-full bg-elevated border-transparent focus:border-green-accent focus:ring-0 rounded-lg p-3 text-primary-color font-medium"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-color uppercase tracking-wider mb-2">Location</label>
                      <input
                        type="text"
                        value={linkedInData.location}
                        onChange={(e) => setLinkedInData({ ...linkedInData, location: e.target.value })}
                        placeholder="e.g. Berlin, Germany"
                        className="w-full bg-elevated border-transparent focus:border-green-accent focus:ring-0 rounded-lg p-3 text-primary-color font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-color uppercase tracking-wider mb-2">Bio</label>
                      <textarea
                        value={linkedInData.bio}
                        onChange={(e) => setLinkedInData({ ...linkedInData, bio: e.target.value })}
                        rows={4}
                        placeholder="A short intro about yourself"
                        className="w-full bg-elevated border-transparent focus:border-green-accent focus:ring-0 rounded-lg p-3 text-primary-color font-medium leading-relaxed resize-none"
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-theme rounded-xl p-5 mt-4">
                    <p className="text-xs font-bold text-muted-color uppercase tracking-wide mb-3">What to show on your portfolio</p>
                    <div className="space-y-2">
                      {[
                        { key: 'showLinkedInName' as const, label: 'Name, title & bio' },
                        { key: 'showLinkedInExperience' as const, label: 'Work experience' },
                        { key: 'showLinkedInSkills' as const, label: 'Skills' },
                        { key: 'showLinkedInLanguages' as const, label: 'Languages' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer hover:bg-elevated transition-colors">
                          <span className="text-sm text-secondary-color font-medium">{label}</span>
                          <div className="relative inline-flex items-center cursor-pointer ml-4">
                            <input type="checkbox" checked={linkedInSettings[key]} onChange={(e) => setLinkedInSettings({ ...linkedInSettings, [key]: e.target.checked })} className="sr-only peer" />
                            <div className="w-10 h-5 bg-[var(--bg-raised)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end mt-6">
                    <button
                      onClick={handleSaveLinkedInData}
                      disabled={isSaving}
                      className="h-[50px] px-8 bg-primary hover:bg-green-accent text-white rounded-full font-bold transition-all shadow-md active:scale-95 disabled:opacity-40"
                    >
                      {isSaving ? (
                        <><svg className="animate-spin h-4 w-4 inline mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving</>
                      ) : 'Save Profile Info'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Go Live */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-green-accent/20">
              <div className="flex items-start gap-6">
                <div className="w-10 h-10 rounded-full bg-green-accent flex items-center justify-center text-white font-bold shrink-0">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-primary-color mb-2">Go Live</h3>
                  <p className="text-secondary-color mb-6">
                    Make your portfolio publicly accessible with a shareable URL.
                  </p>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border border-theme rounded-xl p-6">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-full bg-green-accent flex items-center justify-center text-white shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${profile?.isPublished ? 'bg-[var(--jade-bg)] text-green' : 'bg-elevated text-muted-color'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${profile?.isPublished ? 'bg-green' : 'bg-muted-color'}`}></span>
                            {profile?.isPublished ? 'Published' : 'Not published'}
                          </span>
                        </div>
                        <p className="text-sm text-secondary-color">
                          {profile?.isPublished
                            ? 'Your portfolio is live and visible to anyone with the link.'
                            : 'Your portfolio is currently private. Publish it so recruiters and others can find you.'}
                        </p>
                        {profile?.isPublished && portfolioUsername && (
                          <a
                            href={`${window.location.origin}/portfolio/${portfolioUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 text-sm text-green-accent font-bold hover:underline break-all"
                          >
                            {window.location.origin}/portfolio/{portfolioUsername}
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        )}
                        {!portfolioUsername && (
                          <p className="text-xs text-ember mt-2">No username set — contact support or set one during registration.</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {profile?.isPublished && (
                        <a
                          href={`${window.location.origin}/portfolio/${portfolioUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-[50px] px-6 bg-white border border-theme text-secondary-color rounded-full font-bold hover:bg-elevated transition-all flex items-center justify-center"
                        >
                          Preview Site
                        </a>
                      )}
                      <button
                        onClick={handleTogglePublish}
                        disabled={isTogglingPublish}
                        className={`h-[50px] px-8 rounded-full font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${profile?.isPublished ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-primary hover:bg-green-accent text-white'}`}
                      >
                        {isTogglingPublish ? (
                          <><svg className="animate-spin h-4 w-4 inline mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Working</>
                        ) : profile?.isPublished ? (
                          'Unpublish'
                        ) : (
                          'Publish Portfolio'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Community Portfolios */}
            <section className="mt-12">
              <h3 className="text-xl font-extrabold text-green mb-6">Community Portfolios</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {publishedProfiles.map((prof) => (
                  <a
                    key={prof._id}
                    href={`/portfolio/${prof.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-white rounded-2xl shadow-sm border border-theme overflow-hidden flex flex-col hover:shadow-lg transition-all"
                  >
                    <div className="h-32 bg-gradient-to-r from-blue-500 to-primary/80 relative">
                      <div className="absolute -bottom-6 left-6 w-20 h-20 rounded-full border-4 border-white overflow-hidden bg-white flex items-center justify-center">
                        {prof.profileImageUrl ? (
                          <img src={prof.profileImageUrl} alt={prof.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-bold text-muted-color">{prof.name?.charAt(0) || prof.username.charAt(0)}</span>
                        )}
                      </div>
                    </div>
                    <div className="p-6 pt-10 flex-1">
                      <h4 className="text-lg font-extrabold text-primary-color leading-tight">{prof.name || prof.username}</h4>
                      <p className="text-sm font-bold text-green-accent mb-2">@{prof.username}</p>
                      {prof.title && <p className="text-sm font-bold text-secondary-color mb-2">{prof.title}</p>}
                      {prof.bio && <p className="text-sm text-muted-color line-clamp-2 mb-6">{prof.bio}</p>}
                      <div className="pt-4 border-t border-theme flex justify-between items-center">
                        <span className="text-xs text-muted-color">Joined {new Date(prof.createdAt).toLocaleDateString()}</span>
                        <span className="text-sm font-extrabold text-green-accent flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          View <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              {publishedProfiles.length === 0 && (
                <div className="text-center py-16 text-muted-color bg-white rounded-2xl border border-theme">
                  <svg className="w-12 h-12 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <p className="text-sm">No portfolios published yet. Be the first!</p>
                </div>
              )}
            </section>

          </div>

          <footer className="mt-16 text-center">
            <p className="text-sm text-muted-color">
              &copy; {new Date().getFullYear()} Portfolio Studio. All changes are saved automatically.
            </p>
          </footer>

        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default PortfolioSetupPage;
