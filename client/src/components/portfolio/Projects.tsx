// client/src/components/portfolio/Projects.tsx
import React, { useState, useMemo } from 'react';
import { Project } from '../../services/portfolioApi';

interface ProjectsProps {
  projects: Project[];
  username: string;
  isDarkMode?: boolean;
}

// Generate gradient placeholder based on project index
const getGradientClass = (index: number): string => {
  const gradients = [
    'bg-gradient-to-br from-indigo-400 to-purple-500',
    'bg-gradient-to-br from-pink-400 to-red-500',
    'bg-gradient-to-br from-cyan-400 to-blue-500',
    'bg-gradient-to-br from-green-400 to-teal-500',
    'bg-gradient-to-br from-amber-400 to-orange-500',
    'bg-gradient-to-br from-teal-500 to-indigo-600',
  ];
  return gradients[index % gradients.length];
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

const Projects: React.FC<ProjectsProps> = ({ projects, isDarkMode = false }) => {
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
          <h2 className={`text-3xl font-bold mb-4 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            Selected Work
          </h2>
          <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
            No projects available yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24" id="work">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h2 className={`text-3xl font-bold mb-4 ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}>
          Selected Work
        </h2>
        <p className={`mt-4 ${
          isDarkMode ? 'text-slate-400' : 'text-slate-600'
        }`}>
          Here are some projects I've worked on. Each one represents a unique challenge and learning experience.
        </p>
      </div>

      {/* Filter Buttons */}
      {allTechnologies.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
              selectedFilter === 'all'
                ? 'bg-primary text-white scale-110 shadow-md'
                : isDarkMode
                ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:scale-105 hover:shadow-md'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:scale-105 hover:shadow-md'
            }`}
          >
            All
          </button>
          {allTechnologies.slice(0, 10).map((tech) => (
            <button
              key={tech}
              onClick={() => setSelectedFilter(tech)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 capitalize ${
                selectedFilter === tech
                  ? 'bg-primary text-white scale-110 shadow-md'
                  : isDarkMode
                  ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:scale-105 hover:shadow-md'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:scale-105 hover:shadow-md'
              }`}
            >
              {tech}
            </button>
          ))}
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {displayedProjects.map((project, index) => (
          <ProjectCard key={project._id} project={project} index={index} isDarkMode={isDarkMode} />
        ))}
      </div>

      {/* Load More Button */}
      {filteredProjects.length > 6 && !showAll && (
        <div className="mt-12 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="px-6 py-3 bg-primary text-ink-950 font-semibold rounded-lg shadow-md hover:bg-gold-600 transition-all duration-300 hover:scale-105 hover:shadow-lg"
          >
            Load More Projects
          </button>
        </div>
      )}

      {showAll && filteredProjects.length > 6 && (
        <div className="mt-12 text-center">
          <button
            onClick={() => {
              setShowAll(false);
              window.scrollTo({ top: document.getElementById('work')?.offsetTop || 0, behavior: 'smooth' });
            }}
            className={`px-6 py-3 font-semibold rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg ${
              isDarkMode 
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Show Less
          </button>
        </div>
      )}
    </section>
  );
};

interface ProjectCardProps {
  project: Project;
  index: number;
  isDarkMode?: boolean;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, index, isDarkMode = false }) => {
  const [imageError, setImageError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const gradientClass = getGradientClass(index);
  const mainLanguage = getMainLanguage(project.technologies);
  const languageLogoUrl = getLanguageLogoUrl(mainLanguage);

  return (
    <div className={`rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group ${
      isDarkMode ? 'bg-slate-900' : 'bg-white'
    }`}>
      {/* Project Image */}
      <div className={`h-48 flex items-center justify-center ${gradientClass} transition-transform duration-300 group-hover:scale-105`}>
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
                className="h-20 w-20 invert brightness-0"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="text-white/80 text-4xl font-bold">
                {project.title.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Content */}
      <div className="p-6">
        <h3 className={`text-xl font-semibold mb-2 transition-colors duration-300 group-hover:text-primary ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}>
          {project.title}
        </h3>
        <p className={`mt-2 text-sm line-clamp-4 ${
          isDarkMode ? 'text-slate-400' : 'text-slate-600'
        }`}>
          {project.description}
        </p>
        {project.technologies && project.technologies.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {project.technologies.slice(0, 4).map((tech, techIndex) => (
              <span
                key={techIndex}
                className={`text-xs px-2 py-1 rounded transition-all duration-300 hover:scale-110 hover:shadow-sm ${
                  isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {tech}
              </span>
            ))}
            {project.technologies.length > 4 && (
              <span className={`text-xs px-2 py-1 rounded transition-all duration-300 hover:scale-110 hover:shadow-sm ${
                isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}>
                +{project.technologies.length - 4}
              </span>
            )}
          </div>
        )}
        {(project.projectUrl || project.githubUrl) && (
          <a
            href={project.githubUrl || project.projectUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-6 block w-full text-center py-2 px-4 border rounded-md text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-md ${
              isDarkMode
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-primary'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-primary'
            }`}
          >
            {project.githubUrl ? 'View Code' : 'View Project'}
          </a>
        )}
      </div>
    </div>
  );
};

export default Projects;
