// client/src/components/portfolio/PortfolioLayout.tsx
import React, { useState, useEffect } from 'react';
import { Button, Card } from '../common';
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setImageError(false);
  }, [profile.profileImageUrl]);

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

  const hasConnect = !!(profile.socialLinks?.github || profile.socialLinks?.linkedin || profile.socialLinks?.twitter || profile.socialLinks?.website || email);

  const navBtnStyle = (section: string): React.CSSProperties => ({
    padding: '0.375rem 0.875rem',
    borderRadius: '9999px',
    fontSize: '0.875rem',
    fontWeight: 500,
    background: activeSection === section ? 'var(--accent-bg)' : 'transparent',
    color: activeSection === section ? 'var(--accent)' : 'var(--text-secondary)',
    border: activeSection === section ? '1px solid rgba(0,98,65,0.25)' : '1px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  return (
    <div className="scroll-smooth" style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Sticky Navigation */}
      <header
        id={sectionIdPrefix + 'home'}
        style={{
          position: 'sticky', top: 0, zIndex: 40, width: '100%',
          background: isScrolled ? 'var(--bg-surface)' : 'transparent',
          borderBottom: isScrolled ? '1px solid var(--border)' : '1px solid transparent',
          backdropFilter: isScrolled ? 'blur(12px)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); scrollToSection('home'); }}
              className="text-xl font-semibold hover:opacity-75 transition-opacity"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', textDecoration: 'none' }}
            >
              {displayName}
            </a>
            <nav className="flex items-center gap-1">
              <button onClick={() => scrollToSection('about')} style={navBtnStyle('about')}>About</button>
              <button onClick={() => scrollToSection('work')} style={navBtnStyle('work')}>Work</button>
              {hasConnect && (
                <button onClick={() => scrollToSection('connect')} style={navBtnStyle('connect')}>Connect</button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="py-20 md:py-32" id={sectionIdPrefix + 'home'}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-8 space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {displayName}
              </h1>
              {displayTitle && (
                <p className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--accent)' }}>
                  {displayTitle}
                </p>
              )}
              {displayBio && (
                <p className="text-lg max-w-2xl leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {typeof displayBio === 'string' ? displayBio.replace(/[#*_`]/g, '') : displayBio}
                </p>
              )}
              <div className="flex flex-wrap gap-4 pt-2">
                <Button
                  onClick={() => scrollToSection('connect')}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  }
                  iconPosition="right"
                >
                  Get in Touch
                </Button>
                <Button variant="secondary" onClick={() => scrollToSection('work')}>
                  View My Work
                </Button>
              </div>
              {(email || profile.location) && (
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {email && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{email}</span>
                    </div>
                  )}
                  {profile.location && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover shadow-2xl transition-transform duration-300 hover:scale-105 shrink-0"
                  style={{ border: '3px solid var(--accent)' }}
                  src={profile.profileImageUrl}
                  referrerPolicy="no-referrer"
                  onError={() => { console.error('Failed to load profile image:', profile.profileImageUrl); setImageError(true); }}
                />
              </div>
            )}
          </div>
        </section>

        <div id={sectionIdPrefix + 'about'}>
          <About profile={profile} username={username} />
        </div>
        <div id={sectionIdPrefix + 'work'}>
          <Projects projects={projects} username={username} />
        </div>
      </main>

      {/* Connect / Footer */}
      {hasConnect && (
        <footer
          id={sectionIdPrefix + 'connect'}
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Connect
            </h2>
            <p className="mt-3 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Let's connect and stay in touch. Feel free to reach out!
            </p>
            <div className="flex justify-center flex-wrap gap-4 mt-10">
              {profile.socialLinks?.github && (
                <a
                  href={profile.socialLinks.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Card
                    padding="none"
                    className="w-40 p-3 sm:p-5 text-center hover:-translate-y-2 transition-all duration-300 hover:shadow-xl"
                    style={{ border: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    hoverable
                  >
                    <svg className="mx-auto h-9 w-9 mb-2" style={{ color: 'var(--text-primary)' }} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.565 21.799 24 17.301 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>GitHub</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{getGithubUsername(profile.socialLinks.github)}</p>
                  </Card>
                </a>
              )}
              {profile.socialLinks?.linkedin && (
                <a
                  href={profile.socialLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Card
                    padding="none"
                    className="w-40 p-3 sm:p-5 text-center hover:-translate-y-2 transition-all duration-300 hover:shadow-xl"
                    style={{ border: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    hoverable
                  >
                    <svg className="mx-auto h-9 w-9 mb-2" style={{ color: '#0a66c2' }} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
                    </svg>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>LinkedIn</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{getLinkedInUsername(profile.socialLinks.linkedin)}</p>
                  </Card>
                </a>
              )}
              {profile.socialLinks?.twitter && (
                <a
                  href={profile.socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Card
                    padding="none"
                    className="w-40 p-3 sm:p-5 text-center hover:-translate-y-2 transition-all duration-300 hover:shadow-xl"
                    style={{ border: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    hoverable
                  >
                    <svg className="mx-auto h-9 w-9 mb-2" style={{ color: 'var(--text-primary)' }} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.816-8.945L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>X / Twitter</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{getTwitterUsername(profile.socialLinks.twitter)}</p>
                  </Card>
                </a>
              )}
              {profile.socialLinks?.website && (
                <a
                  href={profile.socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Card
                    padding="none"
                    className="w-40 p-3 sm:p-5 text-center hover:-translate-y-2 transition-all duration-300 hover:shadow-xl"
                    style={{ border: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    hoverable
                  >
                    <svg className="mx-auto h-9 w-9 mb-2" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Website</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{getWebsiteDomain(profile.socialLinks.website)}</p>
                  </Card>
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Card
                    padding="none"
                    className="w-40 p-3 sm:p-5 text-center hover:-translate-y-2 transition-all duration-300 hover:shadow-xl"
                    style={{ border: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    hoverable
                  >
                    <svg className="mx-auto h-9 w-9 mb-2" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Email</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{email}</p>
                  </Card>
                </a>
              )}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              © {new Date().getFullYear()} {displayName}. All rights reserved. Generated with{' '}
              <a
                href="https://vibehired.ganainy.dev"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                VibeHired
              </a>
              .
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default PortfolioLayout;