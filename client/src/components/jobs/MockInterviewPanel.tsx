import React, { useState, useEffect, useCallback } from 'react';
import { JobApplication } from '../../services/jobApi';
import { generateInterviewQuestions, evaluateAnswer, EvaluationResult } from '../../services/interviewApi';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';

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

const MockInterviewPanel: React.FC<Props> = ({ jobApplication, jobId }) => {
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

    const currentQuestion = questions[currentIndex] ?? '';
    const totalQuestions = questions.length;

    // Keep textarea in sync with speech-to-text transcript
    useEffect(() => {
        if (stt.transcript) {
            setAnswer(stt.transcript);
        }
    }, [stt.transcript]);

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
    };

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-600 text-white shadow-sm">
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
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-6 shadow-sm">
                    <div className="mx-auto w-20 h-20 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-violet-600 dark:text-violet-400">record_voice_over</span>
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
                    <button
                        onClick={startInterview}
                        className="inline-flex items-center gap-2 px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                    >
                        <span className="material-symbols-outlined text-base">play_arrow</span>
                        {labels.startBtn}
                    </button>
                </div>
            )}

            {/* ── LOADING ── */}
            {phase === 'loading' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm">
                    <div className="mx-auto w-16 h-16 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-violet-600 dark:text-violet-400 animate-pulse">auto_awesome</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {isEnglish ? 'Generating your interview questions…' : 'Interviewfragen werden generiert…'}
                    </p>
                </div>
            )}

            {/* ── QUESTION ── */}
            {phase === 'question' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5">
                        <div
                            className="bg-violet-600 h-1.5 transition-all duration-500"
                            style={{ width: `${((currentIndex) / totalQuestions) * 100}%` }}
                        />
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Question header */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                                {isEnglish
                                    ? `Question ${currentIndex + 1} of ${totalQuestions}`
                                    : `Frage ${currentIndex + 1} von ${totalQuestions}`}
                            </span>
                            {tts.isSupported && (
                                <button
                                    onClick={handleReadAloud}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tts.isSpeaking
                                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300'
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
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-gray-200 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
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
                                        : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400'
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
                                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm">
                    <div className="mx-auto w-16 h-16 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-violet-500 animate-spin">progress_activity</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {isEnglish ? 'Evaluating your answer…' : 'Antwort wird bewertet…'}
                    </p>
                </div>
            )}

            {/* ── RESULT ── */}
            {phase === 'result' && currentEvaluation && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5">
                        <div
                            className="bg-violet-600 h-1.5 transition-all duration-500"
                            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
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
                        <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-100 dark:border-violet-800">
                            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">stars</span>
                                {labels.modelAnswer}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{currentEvaluation.modelAnswer}</p>
                        </div>

                        {/* Next / Finish */}
                        <div className="flex justify-end">
                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
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
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center space-y-4">
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{labels.interviewComplete}</p>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">{labels.overallScore}</span>
                            <div className={`text-5xl font-extrabold ${overallScore >= 8 ? 'text-green-500' : overallScore >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                                {overallScore}<span className="text-2xl text-gray-400 dark:text-gray-500">/10</span>
                            </div>
                        </div>
                        <button
                            onClick={startInterview}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all"
                        >
                            <span className="material-symbols-outlined text-base">replay</span>
                            {labels.retake}
                        </button>
                    </div>

                    {/* Per-question summary */}
                    <div className="space-y-4">
                        {results.map((r, idx) => (
                            <details key={idx} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group">
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
                                    <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-100 dark:border-violet-800">
                                        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1.5">{labels.modelAnswer}</p>
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
