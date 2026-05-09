import React, { useState, useMemo } from 'react';
import { CVDocument } from '../../services/cvApi';

interface BaseCvLibraryViewProps {
  cvs: CVDocument[];
  isLoading: boolean;
  onSelectCv: (id: string) => void;
  onUpload: () => void;
  onDeleteCv?: (id: string) => void;
  onCreateBranch?: () => void;
  onToggleStar?: (id: string, nextValue: boolean) => void;
}

function getCvLanguageLabel(cv: CVDocument): 'English' | 'German' | 'Unknown' {
  const data: any = cv.cvJson || {};

  const metaLanguageCandidates = [
    data?.meta?.language,
    data?.meta?.lang,
    data?.meta?.locale,
  ]
    .filter((v: unknown): v is string => typeof v === 'string')
    .map((v: string) => v.toLowerCase());

  const explicit = metaLanguageCandidates.find((v: string) => v.startsWith('de') || v.startsWith('en'));
  if (explicit?.startsWith('de')) return 'German';
  if (explicit?.startsWith('en')) return 'English';

  const sampleChunks: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      sampleChunks.push(value.trim().toLowerCase());
    }
  };

  push(data?.basics?.label);
  push(data?.basics?.summary);
  push(data?.work?.[0]?.position);
  push(data?.work?.[0]?.summary);
  push(data?.education?.[0]?.studyType);
  push(data?.education?.[0]?.area);

  const sectionLabels = data?.meta?.sectionLabels;
  if (sectionLabels && typeof sectionLabels === 'object') {
    Object.values(sectionLabels).forEach(push);
  }

  const signals = `${sampleChunks.join(' ')} ${(cv.displayName || '').toLowerCase()} ${(cv.category || '').toLowerCase()}`;

  const germanHints = [
    /\b(berufserfahrung|ausbildung|kenntnisse|sprachen|zusammenfassung|lebenslauf)\b/i,
    /\b(und|mit|der|die|das|ich|für|im|als)\b/i,
    /\b(deutsch|german|de)\b/i,
  ];
  const englishHints = [
    /\b(experience|education|skills|summary|resume|cover letter)\b/i,
    /\b(and|with|the|for|responsible|developed)\b/i,
    /\b(english|en)\b/i,
  ];

  const germanScore = germanHints.reduce((acc, re) => acc + (re.test(signals) ? 1 : 0), 0);
  const englishScore = englishHints.reduce((acc, re) => acc + (re.test(signals) ? 1 : 0), 0);

  if (germanScore > englishScore) return 'German';
  if (englishScore > germanScore) return 'English';
  return 'Unknown';
}

const BaseCvLibraryView: React.FC<BaseCvLibraryViewProps> = ({
  cvs,
  isLoading,
  onSelectCv,
  onUpload,
  onDeleteCv,
  onCreateBranch,
  onToggleStar,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'english' | 'german' | 'unknown'>('all');
  const [focusFilter, setFocusFilter] = useState<string>('all');

  const focusOptions = useMemo(() => {
    return Array.from(new Set(cvs.map((cv) => (cv.category || '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [cvs]);

  const filteredCvs = useMemo(() => {
    return cvs.filter((cv) => {
      const displayName = cv.displayName || cv.category || 'Unnamed CV';
      const focusLabel = cv.category || '';
      const matchesSearch = `${displayName} ${focusLabel}`.toLowerCase().includes(searchTerm.toLowerCase());

      const languageLabel = getCvLanguageLabel(cv).toLowerCase();
      const matchesLanguage =
        languageFilter === 'all' ||
        (languageFilter === 'english' && languageLabel === 'english') ||
        (languageFilter === 'german' && languageLabel === 'german') ||
        (languageFilter === 'unknown' && languageLabel === 'unknown');

      const matchesFocus = focusFilter === 'all' || (cv.category || '').toLowerCase() === focusFilter.toLowerCase();

      return matchesSearch && matchesLanguage && matchesFocus;
    });
  }, [cvs, searchTerm, languageFilter, focusFilter]);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-black/40">
          <div className="inline-block w-6 h-6 rounded-full border-2 border-t-transparent animate-spin border-green" />
          Loading CVs...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar animate-fade-in">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl sm:text-[45px] font-semibold text-green font-manrope leading-tight tracking-tight">
          Base CV Library
        </h1>
        <button
          onClick={onUpload}
          className="bg-green-accent text-white font-semibold text-sm px-8 py-3 rounded-full flex items-center gap-2 shadow-lg hover:bg-green-hover transition-all squish whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[20px]">upload</span>
          Upload Base CV
        </button>
      </header>

      {/* Filter Bar Section */}
      <section className="bg-cream rounded-xl p-4 md:p-5 flex flex-col lg:flex-row items-center gap-4 border border-[#bec9c0]/20">
        {/* Search Input */}
        <div className="relative w-full lg:flex-grow">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-black/40 text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search base CVs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-none rounded-lg pl-10 pr-4 py-3 text-base text-black/87 placeholder:text-black/60 focus:ring-2 focus:ring-green transition-all outline-none"
          />
        </div>
        {/* Dropdowns Container */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full lg:w-auto">
          {/* Language Dropdown */}
          <div className="relative w-full md:w-48">
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value as typeof languageFilter)}
              className="appearance-none w-full bg-white border-none rounded-lg px-3 py-3 text-sm text-black/60 focus:ring-2 focus:ring-green cursor-pointer outline-none"
            >
              <option value="all">Language</option>
              <option value="english">English</option>
              <option value="german">German</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-black/40 text-[20px]">
              expand_more
            </span>
          </div>
          {/* Job Focus Dropdown */}
          <div className="relative w-full md:w-56">
            <select
              value={focusFilter}
              onChange={(e) => setFocusFilter(e.target.value)}
              className="appearance-none w-full bg-white border-none rounded-lg px-3 py-3 text-sm text-black/60 focus:ring-2 focus:ring-green cursor-pointer outline-none"
            >
              <option value="all">Job Focus</option>
              {focusOptions.map((focus) => (
                <option key={focus} value={focus}>
                  {focus}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-black/40 text-[20px]">
              expand_more
            </span>
          </div>
        </div>
      </section>

      {/* CV List */}
      {filteredCvs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-green-light">
            <span className="material-symbols-outlined text-3xl text-green">folder_open</span>
          </div>
          <h3 className="text-xl font-semibold text-black/87 mb-2">No CVs found</h3>
          <p className="text-base text-black/60 max-w-md">
            Try adjusting your filters or upload a new base CV to get started.
          </p>
          <button
            onClick={onUpload}
            className="mt-6 bg-green-accent text-white font-semibold text-sm px-6 py-3 rounded-full flex items-center gap-2 shadow-lg hover:bg-green-hover transition-all squish"
          >
            <span className="material-symbols-outlined text-[20px]">upload</span>
            Upload Base CV
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCvs.map((cv) => {
            const languageLabel = getCvLanguageLabel(cv);
            const displayName = cv.displayName || cv.category || 'Unnamed CV';
            const category = cv.category || 'General';
            const usageCount = cv.usedByJobCount || 0;

            return (
              <article
                key={cv._id}
                onClick={() => onSelectCv(cv._id)}
                className="bg-white rounded-xl p-5 whisper-shadow border border-cream-ceramic hover:border-green/30 transition-all duration-300 flex flex-col group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-black/87 group-hover:text-green transition-colors pr-2 leading-snug">
                    {displayName}
                  </h3>
                  <span className="material-symbols-outlined text-black/20 text-[20px] shrink-0">
                    description
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="bg-green-light text-green font-semibold text-xs px-2 py-1 rounded">
                    {category}
                  </span>
                  <span className="bg-cream-ceramic text-black/60 font-semibold text-xs px-2 py-1 rounded">
                    {languageLabel}
                  </span>
                </div>
                <div className="mt-auto pt-4 border-t border-cream-ceramic">
                  <div className="flex items-center gap-2 mb-3 text-green">
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    <span className="text-sm font-semibold">
                      {usageCount} job-specific CV{usageCount === 1 ? '' : 's'} generated
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-black/60 uppercase tracking-wider font-medium">Uploaded</span>
                      <span className="text-sm font-semibold text-black/87">{formatDate(cv.createdAt)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-black/60 uppercase tracking-wider font-medium">Last Tailored</span>
                      <span className="text-sm font-semibold text-black/87">{formatDate(cv.updatedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCv(cv._id);
                    }}
                    className="material-symbols-outlined text-black/40 hover:text-green squish p-1 rounded-lg hover:bg-green-light/50 transition-colors"
                    title="Edit"
                  >
                    edit
                  </button>
                  {onDeleteCv && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCv(cv._id);
                      }}
                      className="material-symbols-outlined text-black/40 hover:text-error squish p-1 rounded-lg hover:bg-error-bg transition-colors"
                      title="Delete"
                    >
                      delete
                    </button>
                  )}
                  {onToggleStar && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(cv._id, !cv.isStarred);
                      }}
                      className={`material-symbols-outlined squish p-1 rounded-lg transition-colors ${
                        cv.isStarred
                          ? 'text-amber-500 hover:bg-amber-50'
                          : 'text-black/40 hover:text-amber-500 hover:bg-amber-50'
                      }`}
                      title={cv.isStarred ? 'Unstar' : 'Star'}
                    >
                      {cv.isStarred ? 'star' : 'star_border'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}

        </div>
      )}
    </div>
  );
};

export default BaseCvLibraryView;
