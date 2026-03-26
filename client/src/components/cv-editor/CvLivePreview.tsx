import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import { getTemplate, TemplateConfig } from '../../templates/config';
import { TemplateWrapper } from '../../templates/TemplateWrapper';
import { CvDynamicPayload } from '../../types/cvDescriptor';
import DynamicTemplate from '../../templates/DynamicTemplate';
import FreeformCvRenderer from '../cv-freeform/FreeformCvRenderer';

function isJsonResumeLike(data: unknown): data is JsonResumeSchema {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const candidate = data as Record<string, unknown>;
  return 'basics' in candidate || 'work' in candidate || 'education' in candidate || 'skills' in candidate;
}

interface CvLivePreviewProps {
  data: JsonResumeSchema | null;
  templateId: string;
  onTemplateChange?: (templateId: string) => void;
  className?: string;
  /**
   * When provided (for CVs that have been analysed by the AI), the preview
   * is rendered via DynamicTemplate and the legacy TemplateWrapper path is
   * skipped entirely.
   */
  dynamicPayload?: CvDynamicPayload | null;
  diffChanges?: Array<{ section: string; before?: string; after?: string; reason?: string }>;
  showDiffOverlay?: boolean;
}

/** Ref API exposed by CvLivePreview */
export type CvLivePreviewRef = HTMLDivElement;

const CvLivePreview = forwardRef<HTMLDivElement, CvLivePreviewProps>(({
  data,
  templateId,
  onTemplateChange,
  className = '',
  dynamicPayload,
  diffChanges,
  showDiffOverlay = false,
}, ref) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig | null>(null);

  useEffect(() => {
    // Only need the legacy template when dynamicPayload is absent
    if (!dynamicPayload) {
      const template = getTemplate(templateId);
      if (template) setSelectedTemplate(template);
    }
  }, [templateId, dynamicPayload]);

  // ── Dynamic path ───────────────────────────────────────────────────────────
  if (dynamicPayload) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 p-0">
          <div
            ref={ref as React.RefObject<HTMLDivElement>}
            className="bg-white mx-auto w-full max-w-[210mm] shrink-0"
            id="cv-preview-container"
          >
            <DynamicTemplate
              ref={previewRef}
              payload={dynamicPayload}
              templateId={templateId}
              diffChanges={diffChanges}
              showDiffOverlay={showDiffOverlay}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Legacy path (JsonResume → TemplateWrapper) ─────────────────────────────
  if (!data) {
    return (
      <div className={`flex items-center justify-center p-4 sm:p-8 bg-gray-50 dark:bg-gray-900 rounded-lg ${className}`}>
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">No CV data available for preview</p>
        </div>
      </div>
    );
  }

  if (!isJsonResumeLike(data)) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-3 sm:p-6">
          <div id="cv-preview-container" className="mx-auto w-full max-w-[210mm] shrink-0">
            <FreeformCvRenderer
              ref={ref as React.RefObject<HTMLDivElement>}
              value={data as Record<string, any>}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!selectedTemplate) {
    return (
      <div className={`flex items-center justify-center p-4 sm:p-8 bg-gray-50 dark:bg-gray-900 rounded-lg ${className}`}>
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Template not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 p-0">
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="bg-white dark:bg-gray-800 mx-auto w-full max-w-[210mm] shrink-0"
          id="cv-preview-container"
        >
          <div ref={previewRef} className="cv-preview-container">
            <TemplateWrapper
              ref={previewRef}
              data={data}
              templateId={templateId}
              TemplateComponent={selectedTemplate.component}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

CvLivePreview.displayName = 'CvLivePreview';

export default CvLivePreview;

