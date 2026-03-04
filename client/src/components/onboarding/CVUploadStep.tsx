// client/src/components/onboarding/CVUploadStep.tsx
import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, SkipForward } from 'lucide-react';
import { uploadCV } from '../../services/cvApi';

interface CVUploadStepProps {
  onNext: () => void;
  onBack: () => void;
}

type UploadStatus = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

const CVUploadStep: React.FC<CVUploadStepProps> = ({ onNext, onBack }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFile = useCallback(async (file: File) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('Only PDF or Word documents are supported.');
      setStatus('error');
      return;
    }
    setFileName(file.name);
    setStatus('uploading');
    setErrorMsg(null);

    // Animate fake progress while uploading
    let prog = 0;
    const interval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 18, 85);
      setProgress(prog);
    }, 200);

    try {
      await uploadCV(file);
      clearInterval(interval);
      setProgress(100);
      setStatus('success');
    } catch (e: any) {
      clearInterval(interval);
      setErrorMsg(e?.message || 'Upload failed. Please try again.');
      setStatus('error');
    }
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setStatus('idle');
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (status === 'idle') setStatus('dragging');
  };

  const onDragLeave = () => {
    if (status === 'dragging') setStatus('idle');
  };

  const resetUpload = () => {
    setStatus('idle');
    setFileName(null);
    setErrorMsg(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col items-center max-w-md mx-auto w-full py-4">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Upload your CV
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          We'll parse it so the AI can tailor applications automatically.
          <span className="ml-1" style={{ color: 'var(--text-muted)' }}>(PDF or Word)</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="w-full mb-6"
      >
        {/* Drop zone */}
        <AnimatePresence mode="wait">
          {status !== 'success' ? (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => status === 'idle' && fileInputRef.current?.click()}
              className="relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-colors overflow-hidden"
              style={{
                borderColor:
                  status === 'dragging'
                    ? 'var(--accent)'
                    : status === 'error'
                    ? 'var(--rose)'
                    : status === 'uploading'
                    ? 'var(--jade)'
                    : 'var(--border-bright)',
                background:
                  status === 'dragging'
                    ? 'rgba(232,184,68,0.05)'
                    : status === 'uploading'
                    ? 'rgba(45,212,160,0.04)'
                    : 'var(--bg-elevated)',
              }}
            >
              {/* Animated border pulse when dragging */}
              {status === 'dragging' && (
                <motion.div
                  className="absolute inset-0 rounded-2xl border-2 border-dashed"
                  style={{ borderColor: 'var(--accent)' }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}

              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 56,
                  height: 56,
                  background:
                    status === 'error' ? 'rgba(244,100,100,0.1)' : 'rgba(232,184,68,0.1)',
                  color: status === 'error' ? 'var(--rose)' : 'var(--accent)',
                }}
              >
                {status === 'error' ? <AlertCircle size={24} /> : <Upload size={24} />}
              </div>

              {status === 'uploading' ? (
                <div className="flex flex-col items-center gap-2 w-full px-8">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Parsing <span style={{ color: 'var(--jade)' }}>{fileName}</span>…
                  </p>
                  <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'var(--jade)' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {Math.round(progress)}%
                  </p>
                </div>
              ) : status === 'error' ? (
                <>
                  <p className="text-sm font-medium" style={{ color: 'var(--rose)' }}>{errorMsg}</p>
                  <button
                    className="btn-ghost text-xs mt-1"
                    onClick={(e) => { e.stopPropagation(); resetUpload(); }}
                  >
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {status === 'dragging' ? 'Drop to upload' : 'Drag & drop or click to browse'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PDF · DOCX · RTF — max 10 MB</p>
                  </div>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.rtf"
                onChange={onInputChange}
              />
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="rounded-2xl border flex flex-col items-center gap-3 py-10"
              style={{ borderColor: 'var(--jade)', background: 'rgba(45,212,160,0.05)' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.1 }}
                style={{ color: 'var(--jade)' }}
              >
                <CheckCircle size={40} />
              </motion.div>
              <div className="text-center">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  CV uploaded successfully!
                </p>
                <p className="text-xs mt-1 flex items-center gap-1 justify-center" style={{ color: 'var(--text-muted)' }}>
                  <FileText size={12} /> {fileName}
                </p>
              </div>
              <button
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
                onClick={(e) => { e.stopPropagation(); resetUpload(); }}
              >
                Upload a different file
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex gap-3 w-full justify-between"
      >
        <button className="btn-ghost text-sm" onClick={onBack}>Back</button>
        <div className="flex gap-2">
          {status !== 'success' && (
            <button
              className="btn-ghost text-sm flex items-center gap-1.5"
              style={{ color: 'var(--text-muted)' }}
              onClick={onNext}
            >
              <SkipForward size={13} />
              Skip for now
            </button>
          )}
          <button
            className="btn-primary flex items-center gap-2 text-sm px-6"
            onClick={onNext}
            disabled={status === 'uploading'}
          >
            Continue <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CVUploadStep;
