import React, { useState, useEffect, useCallback } from 'react';
import { JobApplication } from '../../services/jobApi';
import { generateInterviewQuestions, evaluateAnswer, EvaluationResult } from '../../services/interviewApi';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';

// Map app language codes to BCP-47 speech API codes
function toSpeechLang(lang?: string): string {
    if (lang === 'de') return 'de-DE';
    return 'en-US';
}

type Phase = 'idle' | 'loading' | 'question' | 'evaluating' | 'result' | 'finished';

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
}

// ── CV → readable text ────────────────────────────────────────────────────────
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

const MockInterviewPanel: React.FC<Props> = ({ jobApplication, jobId, cvData, coverLetterText }) => {
    const speechLang = toSpeechLang(jobApplication.language);
    const tts = useSpeechSynthesis();
    const stt = useSpeechRecognition();

    const [phase, setPhase] = useState<Phase>('idle');
    const [error, setError] = useState<string | null>(null);
    const [questions, setQuestions] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answer, setAnswer] = useState('');
    const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
    const [results, setResults] = useState<QuestionResult[]>([]);
    const [copiedKey, setCopiedKey] = useState<'first' | 'second' | null>(null);

    const currentQuestion = questions[currentIndex] ?? '';
    const totalQuestions = questions.length;

    // Keep textarea in sync with speech-to-text transcript
    useEffect(() => {
        if (stt.transcript) {
            setAnswer(stt.transcript);
        }
    }, [stt.transcript]);

    // Shared context block used by both prompts
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

    /** First interview — general / cultural-fit / behavioural round */
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

    /** Second interview — technical / deep-dive round */
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

    const startInterview = useCallback(async () => {
        setError(null);
        setPhase('loading');
        setResults([]);
        setCurrentIndex(0);
        setAnswer('');
        setCurrentEvaluation(null);
        try {
            const qs = await generateInterviewQuestions(jobId);
            setQuestions(qs);
            setPhase('question');
        } catch (e: any) {
            setError(e.message ?? 'Failed to generate questions');
            setPhase('idle');
        }
    }, [jobId]);

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

    const isEnglish = jobApplication.language !== 'de';
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
        retake: isEnglish ? 'Retake Interview' : 'Interview wiederholen',
        micStart: isEnglish ? 'Speak your answer' : 'Antwort sprechen',
        micStop: isEnglish ? 'Stop recording' : 'Aufnahme stoppen',
        listening: isEnglish ? 'Listening…' : 'Aufnehme…',
        copyPromptTip: isEnglish
            ? 'Copy a ready-made prompt and paste it into ChatGPT, Claude, or any AI.'
            : 'Kopiiere einen fertigen Prompt und füge ihn in ChatGPT, Claude oder eine andere KI ein.',
        firstInterviewLabel: isEnglish ? '1st Interview' : '1. Interview',
        firstInterviewDesc: isEnglish ? 'General · Behavioural · Culture fit' : 'Allgemein · Verhalten · Kulturfit',
        secondInterviewLabel: isEnglish ? '2nd Interview' : '2. Interview',
        secondInterviewDesc: isEnglish ? 'Technical · Deep-dive · Problem-solving' : 'Technisch · Vertiefung · Problemlösung',
        copied: isEnglish ? 'Copied!' : 'Kopiert!',
    };

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl text-ink-950 shadow-sm" style={{background:"var(--accent)"}}>
                    <span className="material-symbols-outlined text-[22px]">mic</span>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{labels.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{labels.subtitle}</p>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600 transition-colors">
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
            )}

            {/* ── IDLE ── */}
            {phase === 'idle' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-slate-800 p-8 text-center space-y-6 shadow-sm">
                    <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{background:"var(--accent-bg)"}}>
                        <span className="material-symbols-outlined text-4xl" style={{color:"var(--accent)"}}>record_voice_over</span>
                    </div>
                    <div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed max-w-md mx-auto">
                            {isEnglish
                                ? 'The AI will generate 7 tailored interview questions based on the job description. Answer each one — by typing or using your microphone — and get instant feedback.'
                                : 'Die KI erstellt 7 passende Interviewfragen basierend auf der Stellenbeschreibung. Beantworte jede Frage – per Tippen oder Mikrofon – und erhalte sofortiges Feedback.'}
                        </p>
                        {!tts.isSupported && (
                            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                                {isEnglish
                                    ? 'Text-to-speech is not supported in your browser — questions will be shown as text only.'
                                    : 'Text-zu-Sprache wird in deinem Browser nicht unterstützt – Fragen werden nur als Text angezeigt.'}
                            </p>
                        )}
                        {!stt.isSupported && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                {isEnglish
                                    ? 'Speech-to-text is not supported in your browser — you can still type your answers.'
                                    : 'Sprache-zu-Text wird in deinem Browser nicht unterstützt – du kannst Antworten weiterhin eintippen.'}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <button
                            onClick={startInterview}
                            className="btn-primary font-semibold rounded-xl shadow-md hover:shadow-lg"
                        >
                            <span className="material-symbols-outlined text-base">play_arrow</span>
                            {labels.startBtn}
                            <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>3 cr</span>
                        </button>

                        {/* ── Copy prompts for external AI ── */}
                        <div className="w-full border-t border-zinc-100 dark:border-slate-800 pt-4 mt-1 space-y-3">
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                                {labels.copyPromptTip}
                            </p>
                            <div className="grid grid-cols-2 gap-2.5">
                                {/* First interview prompt */}
                                <button
                                    onClick={() => copyToClipboard(buildFirstInterviewPrompt(), 'first')}
                                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium border transition-all duration-150"
                                    style={{
                                        borderColor: copiedKey === 'first' ? 'var(--accent)' : 'var(--border)',
                                        color: copiedKey === 'first' ? 'var(--accent)' : 'var(--text-secondary)',
                                        background: copiedKey === 'first' ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                                    }}
                                >
                                    <span
                                        className="material-symbols-outlined text-xl"
                                        style={{ color: copiedKey === 'first' ? 'var(--accent)' : 'var(--jade)' }}
                                    >
                                        {copiedKey === 'first' ? 'check_circle' : 'waving_hand'}
                                    </span>
                                    <span className="font-semibold text-xs">
                                        {copiedKey === 'first' ? labels.copied : labels.firstInterviewLabel}
                                    </span>
                                    <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--text-muted)' }}>
                                        {labels.firstInterviewDesc}
                                    </span>
                                </button>

                                {/* Second interview prompt */}
                                <button
                                    onClick={() => copyToClipboard(buildSecondInterviewPrompt(), 'second')}
                                    className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium border transition-all duration-150"
                                    style={{
                                        borderColor: copiedKey === 'second' ? 'var(--accent)' : 'var(--border)',
                                        color: copiedKey === 'second' ? 'var(--accent)' : 'var(--text-secondary)',
                                        background: copiedKey === 'second' ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                                    }}
                                >
                                    <span
                                        className="material-symbols-outlined text-xl"
                                        style={{ color: copiedKey === 'second' ? 'var(--accent)' : 'var(--rose)' }}
                                    >
                                        {copiedKey === 'second' ? 'check_circle' : 'terminal'}
                                    </span>
                                    <span className="font-semibold text-xs">
                                        {copiedKey === 'second' ? labels.copied : labels.secondInterviewLabel}
                                    </span>
                                    <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--text-muted)' }}>
                                        {labels.secondInterviewDesc}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── LOADING ── */}
            {phase === 'loading' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{background:"var(--accent-bg)"}}>
                        <span className="material-symbols-outlined text-3xl animate-pulse" style={{color:"var(--accent)"}}>auto_awesome</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {isEnglish ? 'Generating your interview questions…' : 'Interviewfragen werden generiert…'}
                    </p>
                </div>
            )}

            {/* ── QUESTION ── */}
            {phase === 'question' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5">
                        <div
                            className="h-1.5 transition-all duration-500" style={{ width: `${((currentIndex) / totalQuestions) * 100}%` }}
                        />
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Question header */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider" style={{color:"var(--accent)"}}>
                                {isEnglish
                                    ? `Question ${currentIndex + 1} of ${totalQuestions}`
                                    : `Frage ${currentIndex + 1} von ${totalQuestions}`}
                            </span>
                            {tts.isSupported && (
                                <button
                                    onClick={handleReadAloud}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tts.isSpeaking ? 'text-ink-950' /* style set inline */
                                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gold-50 dark:hover:bg-gold-900/20 hover:text-gold-700 dark:hover:text-gold-300'
                                    }`}
                                    title={tts.isSpeaking ? labels.stop : labels.readAloud}
                                >
                                    <span className="material-symbols-outlined text-base">
                                        {tts.isSpeaking ? 'stop_circle' : 'volume_up'}
                                    </span>
                                    {tts.isSpeaking ? labels.stop : labels.readAloud}
                                </button>
                            )}
                        </div>

                        {/* Question text */}
                        <p className="text-gray-900 dark:text-gray-100 text-lg font-medium leading-relaxed">
                            {currentQuestion}
                        </p>

                        {/* Answer area */}
                        <div className="relative">
                            <textarea
                                value={answer}
                                onChange={(e) => {
                                    setAnswer(e.target.value);
                                }}
                                rows={5}
                                placeholder={labels.typeAnswer}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-gray-200 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 transition-all"
                            />
                            {stt.isListening && (
                                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-white" />
                                    {labels.listening}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-3">
                            {stt.isSupported ? (
                                <button
                                    onClick={toggleMic}
                                    title={stt.isListening ? labels.micStop : labels.micStart}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${stt.isListening
                                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                        : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gold-50 dark:hover:bg-gold-900/20 hover:border-gold-300 hover:text-gold-600 dark:hover:text-gold-400'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-base">
                                        {stt.isListening ? 'mic_off' : 'mic'}
                                    </span>
                                    {stt.isListening ? labels.micStop : labels.micStart}
                                </button>
                            ) : <div />}

                            <button
                                onClick={submitAnswer}
                                disabled={!answer.trim()}
                                className="btn-primary text-sm rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-base">send</span>
                                {labels.submit}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EVALUATING ── */}
            {phase === 'evaluating' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{background:"var(--accent-bg)"}}>
                        <span className="material-symbols-outlined text-3xl animate-spin" style={{color:"var(--accent)"}}>progress_activity</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {isEnglish ? 'Evaluating your answer…' : 'Antwort wird bewertet…'}
                    </p>
                </div>
            )}

            {/* ── RESULT ── */}
            {phase === 'result' && currentEvaluation && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5">
                        <div
                            className="h-1.5 transition-all duration-500" style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                        />
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Score + question */}
                        <div className="flex items-start justify-between gap-4">
                            <p className="text-gray-700 dark:text-gray-300 text-sm italic leading-relaxed flex-1">
                                "{currentQuestion}"
                            </p>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                                <span className="text-xs text-gray-400">{labels.score}</span>
                                <ScoreBadge score={currentEvaluation.score} />
                            </div>
                        </div>

                        {/* Your answer */}
                        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{labels.yourAnswer}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{answer}</p>
                        </div>

                        {/* Strengths */}
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

                        {/* Improvements */}
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

                        {/* Model answer */}
                        <div className="p-4 rounded-xl border" style={{background:"var(--accent-bg)", borderColor:"var(--accent-dim)"}}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1" style={{color:"var(--accent)"}}>
                                <span className="material-symbols-outlined text-sm">stars</span>
                                {labels.modelAnswer}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{currentEvaluation.modelAnswer}</p>
                        </div>

                        {/* Next / Finish */}
                        <div className="flex justify-end">
                            <button
                                onClick={handleNext}
                                className="btn-primary text-sm rounded-xl"
                            >
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
                    {/* Overall score card */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-slate-800 shadow-sm p-8 text-center space-y-4">
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{labels.interviewComplete}</p>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">{labels.overallScore}</span>
                            <div className={`text-5xl font-extrabold ${overallScore >= 8 ? 'text-green-500' : overallScore >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                                {overallScore}<span className="text-2xl text-gray-400 dark:text-gray-500">/10</span>
                            </div>
                        </div>
                        <button
                            onClick={startInterview}
                            className="btn-primary rounded-xl"
                        >
                            <span className="material-symbols-outlined text-base">replay</span>
                            {labels.retake}
                            <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>3 cr</span>
                        </button>
                    </div>

                    {/* Per-question summary */}
                    <div className="space-y-4">
                        {results.map((r, idx) => (
                            <details key={idx} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-slate-800 shadow-sm overflow-hidden group">
                                <summary className="flex items-center justify-between gap-4 cursor-pointer px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="shrink-0 text-xs font-bold text-gray-400 dark:text-gray-500 w-5 text-center">{idx + 1}</span>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{r.question}</p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <ScoreBadge score={r.evaluation.score} />
                                        <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200">
                                            <span className="material-symbols-outlined text-[20px]">expand_more</span>
                                        </span>
                                    </div>
                                </summary>
                                <div className="px-5 pb-5 pt-2 space-y-4 border-t border-slate-100 dark:border-slate-800">
                                    {/* Your answer */}
                                    <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                                        <p className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{labels.yourAnswer}</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{r.answer}</p>
                                    </div>
                                    {/* Strengths */}
                                    {r.evaluation.strengths.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1.5">{labels.strengths}</p>
                                            <ul className="space-y-1">
                                                {r.evaluation.strengths.map((s, i) => (
                                                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                                                        <span className="text-green-500 mt-0.5 shrink-0">•</span>{s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {/* Improvements */}
                                    {r.evaluation.improvements.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">{labels.improvements}</p>
                                            <ul className="space-y-1">
                                                {r.evaluation.improvements.map((imp, i) => (
                                                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                                                        <span className="text-amber-500 mt-0.5 shrink-0">•</span>{imp}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {/* Model answer */}
                                    <div className="p-3 rounded-lg border" style={{background:"var(--accent-bg)", borderColor:"var(--accent-dim)"}}>
                                        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{color:"var(--accent)"}}>{labels.modelAnswer}</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">{r.evaluation.modelAnswer}</p>
                                    </div>
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MockInterviewPanel;
