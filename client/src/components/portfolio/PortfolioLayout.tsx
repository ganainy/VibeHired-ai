// client/src/components/portfolio/PortfolioLayout.tsx
import React, { useState, useEffect } from 'react';
import { AggregatedProfile, Project } from '../../services/portfolioApi';
import About from './About';
import Projects from './Projects';

interface PortfolioLayoutProps {
  profile: AggregatedProfile;
  projects: Project[];
  username: string;
  sectionIdPrefix?: string; // For preview mode (e.g., 'preview-')
  onScrollToSection?: (sectionId: string) => void; // Custom scroll handler
  activeSection?: string; // For active section highlighting
}

const PortfolioLayout: React.FC<PortfolioLayoutProps> = ({
  profile,
  projects,
  username,
  sectionIdPrefix = '',
  onScrollToSection,
  activeSection,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('portfolio-theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Default to light mode
    return false;
  });
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Apply dark mode class to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Save preference to localStorage
    localStorage.setItem('portfolio-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    // Reset image error when profile changes
    setImageError(false);
  }, [profile.profileImageUrl]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const displayName = profile.linkedinData?.name || profile.name || username || 'Portfolio';
  const displayTitle = profile.linkedinData?.title || profile.title || '';
  const displayBio = profile.linkedinData?.bio || profile.bio || '';
  const email = profile.user?.email || '';

  // Helper functions to extract username/identifier from URLs
  const getGithubUsername = (url: string): string => {
    try {
      const match = url.match(/github\.com\/([^\/\?]+)/i);
      return match ? match[1] : url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  };

  const getLinkedInUsername = (url: string): string => {
    try {
      const match = url.match(/linkedin\.com\/(?:in|company)\/([^\/\?]+)/i);
      return match ? match[1] : url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  };

  const getTwitterUsername = (url: string): string => {
    try {
      const match = url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/i);
      return match ? match[1] : url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  };

  const getWebsiteDomain = (url: string): string => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
    }
  };

  const scrollToSection = (sectionId: string) => {
    if (onScrollToSection) {
      onScrollToSection(sectionId);
      return;
    }

    const fullSectionId = sectionIdPrefix + sectionId;

    if (sectionId === 'home') {
      const element = document.getElementById(fullSectionId);
      if (element) {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }
      return;
    }

    const element = document.getElementById(fullSectionId);
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

  const getSectionClassName = (section: string) => {
    const isActive = activeSection === section;
    return `text-sm font-medium transition-colors ${isActive
      ? 'text-primary dark:text-primary'
      : 'text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary'
      }`;
  };

  return (
    <div className={`scroll-smooth min-h-screen w-full font-display antialiased ${isDarkMode
      ? 'bg-background-dark text-slate-300'
      : 'bg-background-light text-slate-700'
      }`}>
      {/* Sticky Navigation Bar */}
      <header className={`sticky top-0 z-30 w-full backdrop-blur-sm border-b ${isDarkMode
        ? 'bg-background-dark/80 border-slate-800'
        : 'bg-background-light/80 border-slate-200'
        }`} id={sectionIdPrefix + 'home'}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a
              className={`text-2xl font-bold transition-transform duration-200 hover:scale-105 ${isDarkMode ? 'text-white' : 'text-slate-800'
                }`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('home');
              }}
            >
              {displayName}
            </a>
            <nav className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection('about')}
                className={`${getSectionClassName('about')} hover:scale-110 transition-transform duration-200`}
              >
                About
              </button>
              <button
                onClick={() => scrollToSection('work')}
                className={`${getSectionClassName('work')} hover:scale-110 transition-transform duration-200`}
              >
                Work
              </button>
              {(profile.socialLinks?.github || profile.socialLinks?.linkedin || profile.socialLinks?.twitter || profile.socialLinks?.website || email) && (
                <button
                  onClick={() => scrollToSection('connect')}
                  className={`${getSectionClassName('connect')} hover:scale-110 transition-transform duration-200`}
                >
                  Connect
                </button>
              )}
            </nav>
            <button
              onClick={toggleTheme}
              className="md:hidden p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200 hover:scale-110"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="py-20 md:py-32" id={sectionIdPrefix + 'home'}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-8 space-y-6">
              <h1 className={`text-4xl md:text-6xl font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                {displayName}
              </h1>
              {displayTitle && (
                <h2 className="text-2xl md:text-3xl font-semibold text-primary">
                  {displayTitle}
                </h2>
              )}
              {displayBio && (
                <p className={`text-lg max-w-2xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                  {typeof displayBio === 'string'
                    ? displayBio.replace(/[#*_`]/g, '')
                    : displayBio}
                </p>
              )}
              <div className="flex flex-wrap gap-4 pt-4">
                <a
                  href="#connect"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('connect');
                  }}
                  className="inline-flex items-center justify-center px-6 py-3 bg-primary text-ink-950 font-semibold rounded-lg shadow-md hover:bg-gold-600 transition-all duration-300 hover:scale-105 hover:shadow-lg group"
                >
                  Get in Touch
                  <svg className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <a
                  href="#work"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('work');
                  }}
                  className={`inline-flex items-center justify-center px-6 py-3 font-semibold rounded-lg transition-all duration-300 hover:scale-105 ${isDarkMode
                    ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:shadow-lg'
                    : 'bg-slate-200 text-slate-800 hover:bg-slate-300 hover:shadow-md'
                    }`}
                >
                  View My Work
                </a>
              </div>
              {(email || profile.location) && (
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-6 text-sm">
                  {email && (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{email}</span>
                    </div>
                  )}
                  {profile.location && (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{profile.location}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {profile.profileImageUrl && !imageError && (
              <div className="md:col-span-4 flex justify-center md:justify-end">
                <img
                  alt={`Portrait of ${displayName}`}
                  className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 shadow-lg transition-transform duration-300 hover:scale-105 hover:shadow-xl shrink-0"
                  style={{
                    borderColor: isDarkMode ? '#1e293b' : '#e2e8f0'
                  }}
                  src={profile.profileImageUrl}
                  referrerPolicy="no-referrer"
                  onError={() => {
                    console.error('Failed to load profile image:', profile.profileImageUrl);
                    setImageError(true);
                  }}
                />
              </div>
            )}
          </div>
        </section>

        <div id={sectionIdPrefix + 'about'}>
          <About profile={profile} username={username} isDarkMode={isDarkMode} />
        </div>
        <div id={sectionIdPrefix + 'work'}>
          <Projects projects={projects} username={username} isDarkMode={isDarkMode} />
        </div>

        {/* Connect Section */}
        {(profile.socialLinks?.github || profile.socialLinks?.linkedin || profile.socialLinks?.twitter || profile.socialLinks?.website || email) && (
          <footer className={`border-t ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`} id={sectionIdPrefix + 'connect'}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
              <h2 className={`text-3xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                Connect
              </h2>
              <p className={`mt-4 max-w-xl mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'
                }`}>
                Let's connect and stay in touch through these platforms. Feel free to reach out!
              </p>
              <div className="flex justify-center flex-wrap gap-4 mt-8">
                {profile.socialLinks?.github && (
                  <a
                    href={profile.socialLinks.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-40 p-4 border rounded-lg text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:scale-105 ${isDarkMode
                      ? 'bg-background-dark border-slate-700 hover:border-primary'
                      : 'bg-background-light border-slate-200 hover:border-primary'
                      }`}
                  >
                    <svg className="mx-auto h-10 w-10 mb-2 invert-0 dark:invert" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.565 21.799 24 17.301 24 12c0-6.627-5.373-12-12-12z"></path>
                    </svg>
                    <p className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'
                      }`}>
                      GitHub
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                      {getGithubUsername(profile.socialLinks.github)}
                    </p>
                  </a>
                )}
                {profile.socialLinks?.linkedin && (
                  <a
                    href={profile.socialLinks.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-40 p-4 border rounded-lg text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:scale-105 ${isDarkMode
                      ? 'bg-background-dark border-slate-700 hover:border-primary'
                      : 'bg-background-light border-slate-200 hover:border-primary'
                      }`}
                  >
                    <svg className="mx-auto h-10 w-10 mb-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"></path>
                    </svg>
                    <p className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'
                      }`}>
                      LinkedIn
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                      {getLinkedInUsername(profile.socialLinks.linkedin)}
                    </p>
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className={`w-40 p-4 border rounded-lg text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:scale-105 ${isDarkMode
                      ? 'bg-background-dark border-slate-700 hover:border-primary'
                      : 'bg-background-light border-slate-200 hover:border-primary'
                      }`}
                  >
                    <svg className="mx-auto h-10 w-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'
                      }`}>
                      Email
                    </p>
                    <p className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                      {email}
                    </p>
                  </a>
                )}
              </div>
            </div>
            <div className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
              <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm">
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                  © {new Date().getFullYear()} {displayName}. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
};

export default PortfolioLayout;
