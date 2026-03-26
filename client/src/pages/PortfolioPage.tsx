// client/src/pages/PortfolioPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAggregatedProfile, getProjectsByUsername, AggregatedProfile, Project } from '../services/portfolioApi';
import PortfolioLayout from '../components/portfolio/PortfolioLayout';
import Spinner from '../components/common/Spinner';
import ErrorAlert from '../components/common/ErrorAlert';

const PortfolioPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<AggregatedProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const fetchData = async () => {
      if (!username) {
        setError('No username provided.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const [profileData, projectsData] = await Promise.all([
          getAggregatedProfile(username),
          getProjectsByUsername(username),
        ]);

        setProfile(profileData);
        setProjects(projectsData);
      } catch (err: any) {
        console.error('Error fetching portfolio data:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load portfolio.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [username]);

  useEffect(() => {
    if (!profile) return;

    const handleScroll = () => {
      const sections = ['home', 'about', 'work', 'connect'];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [profile]);

  const scrollToSection = (sectionId: string) => {
    if (sectionId === 'home') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      return;
    }
    
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <div className="container mx-auto px-4 py-8 w-full">
          <ErrorAlert message={error} />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <div className="container mx-auto px-4 py-8 w-full">
          <div className="card rounded-xl p-6 sm:p-8 text-center max-w-md mx-auto mt-16" style={{ border: '1px solid var(--border)' }}>
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <svg className="w-8 h-8" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">User not found</h1>
            <p style={{ color: 'var(--text-secondary)' }}>The portfolio you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PortfolioLayout
      profile={profile}
      projects={projects}
      username={username || ''}
      activeSection={activeSection}
      onScrollToSection={scrollToSection}
    />
  );
};

export default PortfolioPage;

