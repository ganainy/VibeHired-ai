import React, { useState, useEffect, useCallback } from 'react';
import { JobApplication } from '../../services/jobApi';
import { generateInterviewQuestions, evaluateAnswer, EvaluationResult } from '../../services/interviewApi';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';

function toSpeechLang(lang?: string): string {
    if (lang === 'de') return 'de-DE';
    return 'en-US';
}

type Phase = 'select-level' | 'resume' | 'loading' | 'question' | 'evaluating' | 'result' | 'finished';
type InterviewLevel = 'first' | 'second';

interface QuestionResult {
    question: string;
    answer: string;
    evaluation: EvaluationResult;
}

interface Props {
    jobApplication: JobApplication;
    jobId: string;
    cvData?: JsonResumeSchema | null;
    coverLetterText?: string | null;
    showResumeOption?: boolean;
    showCopyPromptsDuringInterview?: boolean;
}

function cvToText(cv: JsonResumeSchema): string {
    const lines: string[] = [];

    const b = cv.basics;
    if (b) {
        if (b.name) lines.push(`Name: ${b.name}`);
        if (b.label) lines.push(`Title: ${b.label}`);
        if (b.email) lines.push(`Email: ${b.email}`);
        if (b.summary) { lines.push(''); lines.push(`Summary: ${b.summary}`); }
    }

    if (cv.work?.length) {
        lines.push('');
        lines.push('WORK EXPERIENCE');
        for (const w of cv.work) {
            const company = w.name || w.company || '';
            const role = w.position || w.jobTitle || '';
            const start = w.startDate || '';
            const end = w.endDate || 'Present';
            lines.push(`- ${role}${company ? ` at ${company}` : ''}${start ? ` (${start} – ${end})` : ''}`);
            if (w.summary) lines.push(`  ${w.summary}`);
            if (w.highlights?.length) w.highlights.forEach(h => lines.push(`  • ${h}`));
            else if (w.description) lines.push(`  ${w.description}`);
        }
    }

    if (cv.education?.length) {
        lines.push('');
        lines.push('EDUCATION');
        for (const e of cv.education) {
            const degree = e.studyType || e.degree || '';
            const area = e.area || '';
            const inst = e.institution || '';
            const start = e.startDate || '';
            const end = e.endDate || '';
            lines.push(`- ${[degree, area].filter(Boolean).join(' in ')}${inst ? ` at ${inst}` : ''}${start ? ` (${start}${end ? ` – ${end}` : ''})` : ''}`);
        }
    }

    if (cv.skills?.length) {
        lines.push('');
        lines.push('SKILLS');
        for (const s of cv.skills) {
            const kw = s.keywords?.join(', ') || '';
            lines.push(`- ${s.name || ''}${kw ? `: ${kw}` : ''}`);
        }
    }

    if (cv.languages?.length) {
        lines.push('');
        lines.push('LANGUAGES');
        for (const l of cv.languages) {
            lines.push(`- ${l.language || ''}${l.fluency ? ` (${l.fluency})` : ''}`);
        }
    }

    if (cv.projects?.length) {
        lines.push('');
        lines.push('PROJECTS');
        for (const p of cv.projects) {
            lines.push(`- ${p.name || ''}${p.description ? `: ${p.description}` : ''}`);
            if (p.highlights?.length) p.highlights.forEach(h => lines.push(`  • ${h}`));
        }
    }

    if (cv.certificates?.length) {
        lines.push('');
        lines.push('CERTIFICATES');
        for (const c of cv.certificates) {
            lines.push(`- ${c.name || ''}${c.issuer ? ` (${c.issuer})` : ''}${c.date ? `, ${c.date}` : ''}`);
        }
    }

    return lines.join('\n');
}

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
    const color =
        score >= 8 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
        : score >= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800';
    return (
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border ${color}`}>
            {score}/10
        </span>
    );
};

const MockInterviewPanel: React.FC<Props> = ({ jobApplication, jobId, cvData, coverLetterText, showResumeOption = true, showCopyPromptsDuringInterview = true }) => {
    const speechLang = toSpeechLang(jobApplication.language);
    const tts = useSpeechSynthesis();
    const stt = useSpeechRecognition();

    const [phase, setPhase] = useState<Phase>('select-level');
    const [level, setLevel] = useState<InterviewLevel>('first');
    const [error, setError] = useState<string | null>(null);
    const [questions, setQuestions] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answer, setAnswer] = useState('');
    const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
    const [results, setResults] = useState<QuestionResult[]>([]);
    const [copiedKey, setCopiedKey] = useState<'first' | 'second' | null>(null);
    const [showReview, setShowReview] = useState(false);
    const [showCopyPrompts, setShowCopyPrompts] = useState(true);

    const currentQuestion = questions[currentIndex] ?? '';
    const totalQuestions = questions.length;
    const isEnglish = jobApplication.language !== 'de';

    useEffect(() => {
        if (stt.transcript) {
            setAnswer(stt.transcript);
        }
    }, [stt.transcript]);

    const buildContextBlock = useCallback((): string[] => {
        const lang = jobApplication.language !== 'de' ? 'English' : 'German';
        const lines: string[] = [];

        lines.push('=== JOB DETAILS ===');
        lines.push(`Job Title: ${jobApplication.jobTitle}`);
        lines.push(`Company: ${jobApplication.companyName}`);
        lines.push(`Language: ${lang}`);

        if (jobApplication.jobDescriptionText) {
            lines.push('');
            lines.push('=== JOB DESCRIPTION ===');
            lines.push(jobApplication.jobDescriptionText.slice(0, 4000));
        }

        if (jobApplication.jobPrerequisites) {
            lines.push('');
            lines.push('=== KEY REQUIREMENTS ===');
            lines.push(jobApplication.jobPrerequisites.slice(0, 1500));
        }

        if (cvData && (cvData.basics?.name || cvData.work?.length || cvData.skills?.length)) {
            lines.push('');
            lines.push('=== MY CV ===');
            lines.push(cvToText(cvData));
        }

        if (coverLetterText?.trim()) {
            lines.push('');
            lines.push('=== COVER LETTER I SUBMITTED ===');
            lines.push(coverLetterText.trim().slice(0, 3000));
        }

        return lines;
    }, [jobApplication, cvData, coverLetterText]);

    const buildFirstInterviewPrompt = useCallback((): string => {
        const lang = jobApplication.language !== 'de' ? 'English' : 'German';
        const lines: string[] = [];

        lines.push('You are an experienced HR interviewer conducting a FIRST-ROUND interview with me.');
        lines.push('');
        lines.push(...buildContextBlock());
        lines.push('');
        lines.push('=== INSTRUCTIONS ===');
        lines.push('Conduct a first-round interview focused on general fit, motivation and soft skills. Follow these rules:');
        lines.push('');
        lines.push('1. Generate exactly 8 tailored questions covering:');
        lines.push('   - Self-introduction / background (1 question)');
        lines.push('   - Motivation & company fit — "Why this role / company?" (2 questions)');
        lines.push('   - Behavioural — "Tell me about a time when…" using the STAR method (3 questions)');
        lines.push('   - Teamwork, communication, and working style (2 questions)');
        lines.push('');
        lines.push('2. Ask ONE question at a time. Wait for my answer before continuing.');
        lines.push('');
        lines.push('3. After each of my answers give structured feedback with these exact headings:');
        lines.push('   Score: [0-10]  (0-3 = Poor | 4-6 = Acceptable | 7-8 = Good | 9-10 = Excellent)');
        lines.push('   Strengths: [1-3 bullet points — what was good about my answer]');
        lines.push('   Areas to Improve: [1-2 bullet points — what to sharpen]');
        lines.push('   Model Answer: [a concise ideal answer in 3-5 sentences]');
        lines.push('');
        lines.push('4. After all 8 questions, calculate my average score and give a short first-round performance summary including a hiring recommendation.');
        lines.push('');
        lines.push(`5. All questions and feedback MUST be written entirely in ${lang}.`);
        lines.push('');
        lines.push('Start now by presenting Question 1.');

        return lines.join('\n');
    }, [jobApplication, buildContextBlock]);

    const buildSecondInterviewPrompt = useCallback((): string => {
        const lang = jobApplication.language !== 'de' ? 'English' : 'German';
        const lines: string[] = [];

        lines.push('You are a senior technical interviewer conducting a SECOND-ROUND deep-dive interview with me.');
        lines.push('');
        lines.push(...buildContextBlock());
        lines.push('');
        lines.push('=== INSTRUCTIONS ===');
        lines.push('Conduct a second-round interview focused on technical depth and problem-solving ability. Follow these rules:');
        lines.push('');
        lines.push('1. Generate exactly 8 technically rigorous questions covering:');
        lines.push('   - Core technical / domain knowledge specific to the role requirements (3 questions)');
        lines.push('   - System design, architecture or process thinking relevant to the role (2 questions)');
        lines.push('   - Past technical project deep-dive — specific accomplishments from my CV (2 questions)');
        lines.push('   - Problem-solving scenario — a realistic challenge they would face on the job (1 question)');
        lines.push('');
        lines.push('2. Ask ONE question at a time. Wait for my answer before continuing.');
        lines.push('');
        lines.push('3. After each answer give structured feedback with these exact headings:');
        lines.push('   Score: [0-10]  (0-3 = Poor | 4-6 = Acceptable | 7-8 = Good | 9-10 = Excellent)');
        lines.push('   Strengths: [1-3 bullet points — technical accuracy, depth, clarity]');
        lines.push('   Areas to Improve: [1-2 bullet points — gaps, missing detail, better approaches]');
        lines.push('   Model Answer: [a concise expert answer in 3-6 sentences with concrete details]');
        lines.push('');
        lines.push('4. After all 8 questions, calculate my average score and give a technical evaluation summary with a hire / no-hire recommendation.');
        lines.push('');
        lines.push(`5. All questions and feedback MUST be written entirely in ${lang}.`);
        lines.push('');
        lines.push('Start now by presenting Question 1.');

        return lines.join('\n');
    }, [jobApplication, buildContextBlock]);

    const copyToClipboard = useCallback(async (text: string, key: 'first' | 'second') => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2500);
    }, []);

    const fetchQuestions = useCallback(async (count: number = 5, isAdditional: boolean = false) => {
        setError(null);
        setPhase('loading');
        try {
            const qs = await generateInterviewQuestions(jobId, level, count);
            if (isAdditional) {
                setQuestions(prev => [...prev, ...qs]);
            } else {
                setQuestions(qs);
                setCurrentIndex(0);
                setResults([]);
                setAnswer('');
                setCurrentEvaluation(null);
            }
            setPhase('question');
        } catch (e: any) {
            setError(e.message ?? 'Failed to generate questions');
            setPhase('select-level');
        }
    }, [jobId, level]);

    const startInterview = useCallback(async () => {
        await fetchQuestions(5, false);
    }, [fetchQuestions]);

    const addMoreQuestions = useCallback(async () => {
        await fetchQuestions(3, true);
    }, [fetchQuestions]);

    const endInterview = useCallback(() => {
        if (showResumeOption && (results.length > 0 || questions.length > 0)) {
            setPhase('resume');
        } else {
            setQuestions([]);
            setCurrentIndex(0);
            setResults([]);
            setAnswer('');
            setCurrentEvaluation(null);
            setPhase('select-level');
        }
    }, [results, questions, showResumeOption]);

    const continueInterview = useCallback(() => {
        if (results.length > 0) {
            setPhase('question');
        } else if (questions.length > 0) {
            setCurrentIndex(0);
            setPhase('question');
        }
    }, [results, questions]);

    const regenerateInterview = useCallback(() => {
        setQuestions([]);
        setCurrentIndex(0);
        setResults([]);
        setAnswer('');
        setCurrentEvaluation(null);
        setPhase('select-level');
    }, []);

    const handleReadAloud = useCallback(() => {
        if (tts.isSpeaking) {
            tts.stop();
        } else {
            tts.speak(currentQuestion, speechLang);
        }
    }, [tts, currentQuestion, speechLang]);

    const toggleMic = useCallback(() => {
        if (stt.isListening) {
            stt.stopListening();
        } else {
            stt.resetTranscript();
            setAnswer('');
            stt.startListening(speechLang);
        }
    }, [stt, speechLang]);

    const submitAnswer = useCallback(async () => {
        if (!answer.trim()) return;
        tts.stop();
        stt.stopListening();
        setPhase('evaluating');
        setError(null);
        try {
            const evaluation = await evaluateAnswer(jobId, currentQuestion, answer.trim());
            setCurrentEvaluation(evaluation);
            setPhase('result');
        } catch (e: any) {
            setError(e.message ?? 'Failed to evaluate answer');
            setPhase('question');
        }
    }, [jobId, currentQuestion, answer, tts, stt]);

    const handleNext = useCallback(() => {
        if (!currentEvaluation) return;
        const newResult: QuestionResult = {
            question: currentQuestion,
            answer,
            evaluation: currentEvaluation,
        };
        const updatedResults = [...results, newResult];
        setResults(updatedResults);

        const nextIndex = currentIndex + 1;
        if (nextIndex >= totalQuestions) {
            tts.stop();
            setPhase('finished');
        } else {
            setCurrentIndex(nextIndex);
            setAnswer('');
            stt.resetTranscript();
            setCurrentEvaluation(null);
            setPhase('question');
        }
    }, [currentEvaluation, currentQuestion, answer, results, currentIndex, totalQuestions, tts, stt]);

    const overallScore =
        results.length > 0
            ? Math.round(results.reduce((sum, r) => sum + r.evaluation.score, 0) / results.length)
            : 0;

    const labels = {
        title: isEnglish ? 'Mock Interview' : 'Mock-Interview',
        subtitle: isEnglish
            ? `Practise for ${jobApplication.jobTitle} at ${jobApplication.companyName}`
            : `Übung für ${jobApplication.jobTitle} bei ${jobApplication.companyName}`,
        startBtn: isEnglish ? 'Start Interview' : 'Interview starten',
        readAloud: isEnglish ? 'Read Aloud' : 'Vorlesen',
        stop: isEnglish ? 'Stop' : 'Stopp',
        typeAnswer: isEnglish ? 'Type or speak your answer…' : 'Antwort eingeben oder sprechen…',
        submit: isEnglish ? 'Submit Answer' : 'Antwort abschicken',
        nextQuestion: isEnglish ? 'Next Question' : 'Nächste Frage',
        finish: isEnglish ? 'Finish' : 'Beenden',
        strengths: isEnglish ? 'Strengths' : 'Stärken',
        improvements: isEnglish ? 'Areas to Improve' : 'Verbesserungspotenzial',
        modelAnswer: isEnglish ? 'Model Answer' : 'Musterlösung',
        yourAnswer: isEnglish ? 'Your Answer' : 'Deine Antwort',
        score: isEnglish ? 'Score' : 'Punktzahl',
        overallScore: isEnglish ? 'Overall Score' : 'Gesamtpunktzahl',
        interviewComplete: isEnglish ? 'Interview Complete' : 'Interview abgeschlossen',
        retake: isEnglish ? 'Start New Interview' : 'Neues Interview starten',
        micStart: isEnglish ? 'Speak your answer' : 'Antwort sprechen',
        micStop: isEnglish ? 'Stop recording' : 'Aufnahme stoppen',
        listening: isEnglish ? 'Listening…' : 'Aufnehme…',
        copyPromptTip: isEnglish
            ? 'Copy a ready-made prompt and paste it into ChatGPT, Claude, or any AI.'
            : 'Kopiiere einen fertigen Prompt und füge ihn in ChatGPT, Claude oder eine andere KI ein.',
        firstInterviewLabel: isEnglish ? 'Start 1st Round Interview' : '1. Interview-Runde starten',
        firstInterviewDesc: isEnglish ? 'General · Behavioural · Culture fit' : 'Allgemein · Verhalten · Kulturfit',
        secondInterviewLabel: isEnglish ? 'Start 2nd Round Interview' : '2. Interview-Runde starten',
        secondInterviewDesc: isEnglish ? 'Technical · Deep-dive · Problem-solving' : 'Technisch · Vertiefung · Problemlösung',
        copied: isEnglish ? 'Copied!' : 'Kopiert!',
        selectLevel: isEnglish ? 'Select Interview Level' : 'Interview-Level auswählen',
        firstLevelDesc: isEnglish ? 'General questions about your background, motivation, and soft skills' : 'Allgemeine Fragen zu deinem Hintergrund, Motivation und Soft Skills',
        secondLevelDesc: isEnglish ? 'Technical questions about your expertise and problem-solving abilities' : 'Technische Fragen zu deinem Fachwissen und Problemlösungsfähigkeiten',
        review: isEnglish ? 'Review Answers' : 'Antworten überprüfen',
        addMore: isEnglish ? 'Add More Questions' : 'Weitere Fragen hinzufügen',
        questionCount: isEnglish ? '5 questions' : '5 Fragen',
        startCredits: isEnglish ? '5 Credits' : '5 Credits',
        evalCredits: isEnglish ? '1 Credit / answer' : '1 Credit / Antwort',
        generating: isEnglish ? 'Generating your interview questions…' : 'Interviewfragen werden generiert…',
        evaluating: isEnglish ? 'Evaluating your answer…' : 'Antwort wird bewertet…',
        endInterview: isEnglish ? 'End Interview' : 'Interview beenden',
        continueInterview: isEnglish ? 'Continue Interview' : 'Interview fortsetzen',
        regenerateInterview: isEnglish ? 'Start New Interview' : 'Neues Interview starten',
        resumeTitle: isEnglish ? 'Continue where you left off' : 'Fortsetzen wo du aufgehört hast',
        resumeDesc: isEnglish ? 'You have an ongoing interview in progress' : 'Du hast ein laufendes Interview',
        questionProgress: isEnglish ? 'Question {n} of {total}' : 'Frage {n} von {total}',
        answeredProgress: isEnglish ? '{n} answered' : '{n} beantwortet',
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl text-ink-950 shadow-sm" style={{background:"var(--accent)"}}>
                    <span className="material-symbols-outlined text-[22px]">mic</span>
                </div>
                <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{labels.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{labels.subtitle}</p>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600 transition-colors">
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
            )}

            {/* ── SELECT LEVEL ── */}
            {phase === 'select-level' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-7 text-center space-y-5 shadow-sm">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{background:"var(--accent-bg)"}}>
                        <span className="material-symbols-outlined text-3xl" style={{color:"var(--accent)"}}>record_voice_over</span>
                    </div>
                    <div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed max-w-lg mx-auto">
                            {isEnglish
                                ? <>The AI will generate tailored interview questions based on your <strong>CV</strong> and the <strong>job description</strong>. Answer each one and get instant feedback.</>
                                : <>Die KI erstellt passende Interviewfragen basierend auf deinem <strong>Lebenslauf</strong> und der <strong>Stellenbeschreibung</strong>. Beantworte jede Frage und erhalte sofortiges Feedback.</>}
                        </p>
                    </div>

                    <div className="space-y-3 max-w-3xl mx-auto">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{labels.selectLevel}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                onClick={() => { setLevel('first'); startInterview(); }}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all relative ${level === 'first' ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20' : 'border-zinc-200 dark:border-slate-700 hover:border-gold-300'}`}
                            >
                                <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gold-500 text-ink-950">{labels.startCredits}</span>
                                <span className="material-symbols-outlined text-2xl" style={{color: 'var(--jade)'}}>waving_hand</span>
                                <span className="font-semibold text-sm">{labels.firstInterviewLabel}</span>
                                <span className="text-xs text-center text-gray-500 dark:text-gray-400">{labels.firstLevelDesc}</span>
                            </button>
                            <button
                                onClick={() => { setLevel('second'); startInterview(); }}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all relative ${level === 'second' ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20' : 'border-zinc-200 dark:border-slate-700 hover:border-gold-300'}`}
                            >
                                <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gold-500 text-ink-950">{labels.startCredits}</span>
                                <span className="material-symbols-outlined text-2xl" style={{color: 'var(--rose)'}}>terminal</span>
                                <span className="font-semibold text-sm">{labels.secondInterviewLabel}</span>
                                <span className="text-xs text-center text-gray-500 dark:text-gray-400">{labels.secondLevelDesc}</span>
                            </button>
                        </div>
                    </div>

                    <details className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                        <summary className="list-none cursor-pointer inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                            <span>{isEnglish ? 'Use with ChatGPT / Claude' : 'Mit ChatGPT / Claude verwenden'}</span>
                            <span className="material-symbols-outlined text-sm">expand_more</span>
                        </summary>
                        <div className="flex flex-wrap gap-2 justify-center mt-3">
                            <button
                                onClick={() => copyToClipboard(buildFirstInterviewPrompt(), 'first')}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                {copiedKey === 'first' ? labels.copied : (isEnglish ? 'Copy 1st level prompt' : '1. Runde Prompt kopieren')}
                            </button>
                            <button
                                onClick={() => copyToClipboard(buildSecondInterviewPrompt(), 'second')}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                {copiedKey === 'second' ? labels.copied : (isEnglish ? 'Copy 2nd level prompt' : '2. Runde Prompt kopieren')}
                            </button>
                        </div>
                    </details>
                </div>
            )}

            {/* ── RESUME INTERVIEW ── */}
            {phase === 'resume' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-6 shadow-sm">
                    <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{background:"var(--accent-bg)"}}>
                        <span className="material-symbols-outlined text-4xl" style={{color:"var(--accent)"}}>play_circle</span>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{labels.resumeTitle}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{labels.resumeDesc}</p>
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                            <span className="material-symbols-outlined text-sm">info</span>
                            {level === 'first' ? labels.firstInterviewLabel : labels.secondInterviewLabel} · {results.length} / {questions.length} {isEnglish ? 'answered' : 'beantwortet'}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={continueInterview}
                            className="w-full btn-primary font-semibold rounded-xl"
                        >
                            <span className="material-symbols-outlined text-base">play_arrow</span>
                            {labels.continueInterview}
                        </button>
                        <button
                            onClick={regenerateInterview}
                            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border border-zinc-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                        >
                            <span className="material-symbols-outlined text-base mr-1">refresh</span>
                            {labels.regenerateInterview}
                        </button>
                    </div>
                </div>
            )}

            {/* ── LOADING ── */}
            {phase === 'loading' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-4 shadow-sm">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{background:"var(--accent-bg)"}}>
                        <span className="material-symbols-outlined text-3xl animate-pulse" style={{color:"var(--accent)"}}>auto_awesome</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{labels.generating}</p>
                </div>
            )}

            {/* ── QUESTION ── */}
            {(phase === 'question' || phase === 'evaluating' || phase === 'result') && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5">
                        <div className="h-1.5 transition-all duration-500" style={{ width: `${((currentIndex) / totalQuestions) * 100}%`, background: 'var(--accent)' }} />
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider" style={{color:"var(--accent)"}}>
                                {isEnglish ? `Question ${currentIndex + 1} of ${totalQuestions}` : `Frage ${currentIndex + 1} von ${totalQuestions}`}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowReview(!showReview)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gold-50 dark:hover:bg-gold-900/20"
                                >
                                    <span className="material-symbols-outlined text-base">list</span>
                                    {labels.review}
                                </button>
                                <button
                                    onClick={endInterview}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                                >
                                    <span className="material-symbols-outlined text-base">stop</span>
                                    {labels.endInterview}
                                </button>
                            </div>
                        </div>

                        <p className="text-gray-900 dark:text-gray-100 text-lg font-medium leading-relaxed">
                            {currentQuestion}
                        </p>

                        {tts.isSupported && (
                            <button
                                onClick={handleReadAloud}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tts.isSpeaking ? 'text-ink-950' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gold-50 dark:hover:bg-gold-900/20 hover:text-gold-700'}`}
                            >
                                <span className="material-symbols-outlined text-base">{tts.isSpeaking ? 'stop_circle' : 'volume_up'}</span>
                                {tts.isSpeaking ? labels.stop : labels.readAloud}
                            </button>
                        )}

                        <div className="relative">
                            <textarea
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                rows={5}
                                placeholder={labels.typeAnswer}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-gray-200 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 transition-all"
                                disabled={phase === 'evaluating' || phase === 'result'}
                            />
                            {stt.isListening && (
                                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-white" />
                                    {labels.listening}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            {stt.isSupported ? (
                                <button
                                    onClick={toggleMic}
                                    disabled={phase === 'evaluating' || phase === 'result'}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${stt.isListening ? 'bg-red-50 dark:bg-red-900/20 border-red-300 text-red-600' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 text-gray-600'}`}
                                >
                                    <span className="material-symbols-outlined text-base">{stt.isListening ? 'mic_off' : 'mic'}</span>
                                    {stt.isListening ? labels.micStop : labels.micStart}
                                </button>
                            ) : <div />}

                            {phase === 'question' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>
                                        {labels.evalCredits}
                                    </span>
                                    <button
                                        onClick={submitAnswer}
                                        disabled={!answer.trim()}
                                        className="btn-primary text-sm rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-base">send</span>
                                        {labels.submit}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── EVALUATING ── */}
            {phase === 'evaluating' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-4 shadow-sm">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{background:"var(--accent-bg)"}}>
                        <span className="material-symbols-outlined text-3xl animate-spin" style={{color:"var(--accent)"}}>progress_activity</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{labels.evaluating}</p>
                </div>
            )}

            {/* ── RESULT ── */}
            {phase === 'result' && currentEvaluation && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5">
                        <div className="h-1.5 transition-all duration-500" style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%`, background: 'var(--accent)' }} />
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <p className="text-gray-700 dark:text-gray-300 text-sm italic leading-relaxed flex-1">"{currentQuestion}"</p>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                                <span className="text-xs text-gray-400">{labels.score}</span>
                                <ScoreBadge score={currentEvaluation.score} />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{labels.yourAnswer}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{answer}</p>
                        </div>

                        {currentEvaluation.strengths.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    {labels.strengths}
                                </p>
                                <ul className="space-y-1.5">
                                    {currentEvaluation.strengths.map((s, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="text-green-500 dark:text-green-400 mt-0.5 shrink-0">•</span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {currentEvaluation.improvements.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">tips_and_updates</span>
                                    {labels.improvements}
                                </p>
                                <ul className="space-y-1.5">
                                    {currentEvaluation.improvements.map((imp, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0">•</span>
                                            {imp}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="p-4 rounded-xl border" style={{background:"var(--accent-bg)", borderColor:"var(--accent-dim)"}}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1" style={{color:"var(--accent)"}}>
                                <span className="material-symbols-outlined text-sm">stars</span>
                                {labels.modelAnswer}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{currentEvaluation.modelAnswer}</p>
                        </div>

                        <div className="flex justify-end">
                            <button onClick={handleNext} className="btn-primary text-sm rounded-xl">
                                <span className="material-symbols-outlined text-base">
                                    {currentIndex + 1 >= totalQuestions ? 'flag' : 'arrow_forward'}
                                </span>
                                {currentIndex + 1 >= totalQuestions ? labels.finish : labels.nextQuestion}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── FINISHED ── */}
            {phase === 'finished' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8 text-center space-y-4">
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{labels.interviewComplete}</p>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">{labels.overallScore}</span>
                            <div className={`text-5xl font-extrabold ${overallScore >= 8 ? 'text-green-500' : overallScore >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                                {overallScore}<span className="text-2xl text-gray-400 dark:text-gray-500">/10</span>
                            </div>
                        </div>
                        <button onClick={() => setPhase('select-level')} className="btn-primary rounded-xl">
                            <span className="material-symbols-outlined text-base">replay</span>
                            {labels.retake}
                            <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>{labels.startCredits}</span>
                        </button>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{labels.review}</p>
                        <div className="space-y-4">
                            {results.map((r, idx) => (
                                <details key={idx} className="bg-gray-50 dark:bg-slate-800 rounded-lg overflow-hidden">
                                    <summary className="flex items-center justify-between gap-4 cursor-pointer px-4 py-3 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="shrink-0 text-xs font-bold text-gray-400 dark:text-gray-500 w-5 text-center">{idx + 1}</span>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{r.question}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <ScoreBadge score={r.evaluation.score} />
                                        </div>
                                    </summary>
                                    <div className="px-4 pb-4 space-y-3 border-t border-slate-200 dark:border-slate-700">
                                        <div className="pt-3">
                                            <p className="text-xs font-semibold text-gray-400 mb-1.5 uppercase">{labels.yourAnswer}</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300">{r.answer}</p>
                                        </div>
                                        <div className="p-3 rounded-lg border" style={{background:"var(--accent-bg)", borderColor:"var(--accent-dim)"}}>
                                            <p className="text-xs font-semibold uppercase mb-1.5" style={{color:"var(--accent)"}}>{labels.modelAnswer}</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300">{r.evaluation.modelAnswer}</p>
                                        </div>
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── REVIEW PANEL (During Interview) ── */}
            {showReview && results.length > 0 && (phase === 'question' || phase === 'result') && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{labels.review}</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {results.map((r, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-500">{idx + 1}. {r.question.slice(0, 50)}...</span>
                                    <ScoreBadge score={r.evaluation.score} />
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{r.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── COPY PROMPTS (Always Visible when not select-level) ── */}
            {showCopyPromptsDuringInterview && phase !== 'select-level' && (
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-slate-500">smart_toy</span>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{isEnglish ? 'Copy prompts for ChatGPT / Claude' : 'Prompts für ChatGPT / Claude kopieren'}</span>
                        </div>
                        <button
                            onClick={() => setShowCopyPrompts(!showCopyPrompts)}
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            {showCopyPrompts ? (isEnglish ? 'Hide' : 'Ausblenden') : (isEnglish ? 'Show' : 'Einblenden')}
                        </button>
                    </div>
                    {showCopyPrompts && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => copyToClipboard(buildFirstInterviewPrompt(), 'first')}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm" style={{color: 'var(--jade)'}}>
                                    {copiedKey === 'first' ? 'check' : 'person'}
                                </span>
                                {copiedKey === 'first' ? labels.copied : (isEnglish ? '1st Round' : '1. Runde')}
                            </button>
                            <button
                                onClick={() => copyToClipboard(buildSecondInterviewPrompt(), 'second')}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm" style={{color: 'var(--rose)'}}>
                                    {copiedKey === 'second' ? 'check' : 'code'}
                                </span>
                                {copiedKey === 'second' ? labels.copied : (isEnglish ? '2nd Round' : '2. Runde')}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── ADD MORE QUESTIONS BUTTON ── */}
            {phase === 'finished' && (
                <button onClick={addMoreQuestions} className="w-full btn-secondary rounded-xl py-3">
                    <span className="material-symbols-outlined text-base">add</span>
                    {labels.addMore}
                </button>
            )}
        </div>
    );
};

export default MockInterviewPanel;
