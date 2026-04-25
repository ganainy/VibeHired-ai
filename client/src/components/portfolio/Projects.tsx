// client/src/components/portfolio/Projects.tsx
import React, { useState, useMemo } from 'react';
import { GitFork, Star } from 'lucide-react';
import { Badge, Button, Card } from '../common';
import { Project } from '../../services/portfolioApi';

interface ProjectsProps {
  projects: Project[];
  username: string;
}

// Subtle accent-tinted placeholder backgrounds (design-system aligned)
const getPlaceholderStyle = (index: number): React.CSSProperties => {
  const styles: React.CSSProperties[] = [
    { background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-raised))' },
    { background: 'linear-gradient(135deg, var(--accent-bg), var(--bg-elevated))' },
    { background: 'linear-gradient(135deg, var(--bg-raised), var(--accent-bg))' },
    { background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-elevated))' },
    { background: 'linear-gradient(135deg, var(--accent-bg), var(--bg-raised))' },
    { background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))' },
  ];
  return styles[index % styles.length];
};

// Get the main programming language from project technologies
const getMainLanguage = (technologies: string[] | undefined): string | null => {
  if (!technologies || technologies.length === 0) return null;

  // Priority list of programming languages (most common first)
  const languagePriority = [
    'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'go', 'rust',
    'c++', 'c#', 'php', 'ruby', 'dart', 'scala', 'r', 'matlab', 'html', 'css',
    'sql', 'shell', 'powershell', 'c', 'cpp', 'objective-c', 'vue', 'react',
    'angular', 'node', 'nodejs', 'express', 'django', 'flask', 'spring', 'laravel',
    'rails', 'flutter', 'react-native', 'next', 'nextjs', 'nuxt', 'svelte'
  ];

  // Normalize and find the first matching language
  const normalizedTechs = technologies.map(t => t.toLowerCase().trim());
  
  for (const lang of languagePriority) {
    const found = normalizedTechs.find(tech => 
      tech === lang || 
      tech.includes(lang) || 
      lang.includes(tech)
    );
    if (found) {
      return lang;
    }
  }

  // If no match, return the first technology
  return normalizedTechs[0];
};

// Get language logo URL from Simple Icons CDN
const getLanguageLogoUrl = (language: string | null): string | null => {
  if (!language) return null;

  // Map language names to Simple Icons names
  const languageMap: { [key: string]: string } = {
    'javascript': 'javascript',
    'typescript': 'typescript',
    'python': 'python',
    'java': 'java',
    'kotlin': 'kotlin',
    'swift': 'swift',
    'go': 'go',
    'rust': 'rust',
    'c++': 'cplusplus',
    'cpp': 'cplusplus',
    'c#': 'csharp',
    'php': 'php',
    'ruby': 'ruby',
    'dart': 'dart',
    'scala': 'scala',
    'r': 'r',
    'matlab': 'matlab',
    'html': 'html5',
    'css': 'css3',
    'sql': 'mysql',
    'shell': 'bash',
    'powershell': 'powershell',
    'c': 'c',
    'objective-c': 'objectivec',
    'vue': 'vuedotjs',
    'react': 'react',
    'angular': 'angular',
    'node': 'nodedotjs',
    'nodejs': 'nodedotjs',
    'express': 'express',
    'django': 'django',
    'flask': 'flask',
    'spring': 'spring',
    'laravel': 'laravel',
    'rails': 'rubyonrails',
    'flutter': 'flutter',
    'react-native': 'react',
    'next': 'nextdotjs',
    'nextjs': 'nextdotjs',
    'nuxt': 'nuxtdotjs',
    'svelte': 'svelte'
  };

  const iconName = languageMap[language.toLowerCase()];
  if (!iconName) return null;

  // Use Simple Icons CDN
  return `https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/${iconName}.svg`;
};

const Projects: React.FC<ProjectsProps> = ({ projects }) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  // Extract all unique technologies/tags for filtering
  const allTechnologies = useMemo(() => {
    const techSet = new Set<string>();
    projects.forEach((project) => {
      if (project.technologies) {
        project.technologies.forEach((tech) => techSet.add(tech.toLowerCase()));
      }
      if (project.tags) {
        project.tags.forEach((tag) => techSet.add(tag.toLowerCase()));
      }
    });
    return Array.from(techSet).sort();
  }, [projects]);

  // Filter projects based on selected technology
  const filteredProjects = useMemo(() => {
    if (selectedFilter === 'all') {
      return projects;
    }
    return projects.filter((project) => {
      const techs = [
        ...(project.technologies || []).map((t) => t.toLowerCase()),
        ...(project.tags || []).map((t) => t.toLowerCase()),
      ];
      return techs.includes(selectedFilter.toLowerCase());
    });
  }, [projects, selectedFilter]);

  // Determine which projects to display
  const displayedProjects = showAll ? filteredProjects : filteredProjects.slice(0, 6);

  if (!projects || projects.length === 0) {
    return (
      <section className="py-16 md:py-24" id="work">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Selected Work</h2>
          <p style={{ color: 'var(--text-secondary)' }}>No projects available yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24" id="work">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Selected Work</h2>
        <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
          Here are some projects I've worked on. Each one represents a unique challenge and learning experience.
        </p>
      </div>

      {/* Filter Buttons */}
      {allTechnologies.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button
            onClick={() => setSelectedFilter('all')}
            className="px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 hover:scale-105"
            style={{
              background: selectedFilter === 'all' ? 'var(--accent)' : 'var(--bg-elevated)',
              color: selectedFilter === 'all' ? 'var(--color-green-house, #0e0e17)' : 'var(--text-secondary)',
              border: selectedFilter === 'all' ? 'none' : '1px solid var(--border)',
            }}
          >
            All
          </button>
          {allTechnologies.slice(0, 10).map((tech) => (
            <button
              key={tech}
              onClick={() => setSelectedFilter(tech)}
              className="px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 capitalize hover:scale-105"
              style={{
                background: selectedFilter === tech ? 'var(--accent)' : 'var(--bg-elevated)',
                color: selectedFilter === tech ? 'var(--color-green-house, #0e0e17)' : 'var(--text-secondary)',
                border: selectedFilter === tech ? 'none' : '1px solid var(--border)',
              }}
            >
              {tech}
            </button>
          ))}
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {displayedProjects.map((project, index) => (
          <ProjectCard key={project._id} project={project} index={index} />
        ))}
      </div>

      {/* Load More Button */}
      {filteredProjects.length > 6 && !showAll && (
        <div className="mt-12 text-center">
          <Button onClick={() => setShowAll(true)}>
            Load More Projects
          </Button>
        </div>
      )}

      {showAll && filteredProjects.length > 6 && (
        <div className="mt-12 text-center">
          <Button
            variant="secondary"
            onClick={() => {
              setShowAll(false);
              window.scrollTo({ top: document.getElementById('work')?.offsetTop || 0, behavior: 'smooth' });
            }}
          >
            Show Less
          </Button>
        </div>
      )}
    </section>
  );
};

interface ProjectCardProps {
  project: Project;
  index: number;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, index }) => {
  const [imageError, setImageError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const placeholderStyle = getPlaceholderStyle(index);
  const mainLanguage = getMainLanguage(project.technologies);
  const languageLogoUrl = getLanguageLogoUrl(mainLanguage);
  const stars = Number(project.stars ?? 0);
  const forks = Number(project.forks ?? 0);

  return (
    <Card
      className="rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 group"
      style={{ border: '1px solid var(--border)' }}
      hoverable
    >
      {/* Project Image / Placeholder */}
      <div className="h-48 flex items-center justify-center transition-transform duration-300 group-hover:scale-105" style={placeholderStyle}>
        {project.imageUrl && !imageError ? (
          <img
            className="w-full h-full object-cover"
            src={project.imageUrl}
            alt={project.title}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {languageLogoUrl && !logoError ? (
              <img
                src={languageLogoUrl}
                alt={mainLanguage || 'Language logo'}
                className="h-16 w-16 opacity-70"
                style={{ filter: 'invert(1) sepia(1) saturate(3) hue-rotate(5deg) brightness(0.7)' }}
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="text-4xl font-bold" style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', opacity: 0.85 }}>
                {project.title.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Content */}
      <div className="p-6">
        <h3
          className="text-xl font-semibold mb-2 transition-colors duration-300"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        >
          {project.title}
        </h3>
        <p className="mt-2 text-sm line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
          {project.description}
        </p>
        {project.technologies && project.technologies.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.technologies.slice(0, 4).map((tech, techIndex) => (
              <Badge key={techIndex} variant="ink" size="sm">
                {tech}
              </Badge>
            ))}
            {project.technologies.length > 4 && (
              <Badge variant="ink" size="sm">+{project.technologies.length - 4}</Badge>
            )}
          </div>
        )}
        {(stars > 0 || forks > 0) && (
          <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {stars > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star size={13} /> {stars}
              </span>
            )}
            {forks > 0 && (
              <span className="inline-flex items-center gap-1">
                <GitFork size={13} /> {forks}
              </span>
            )}
          </div>
        )}
        {(project.projectUrl || project.githubUrl) && (
          <Button
            variant="ghost"
            onClick={() => {
              const url = project.githubUrl || project.projectUrl;
              if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            }}
            className="mt-5 block w-full text-center text-sm"
          >
            {project.githubUrl ? 'View Code' : 'View Project'}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default Projects;
