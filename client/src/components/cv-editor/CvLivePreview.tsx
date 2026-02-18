import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import { getTemplate, TemplateConfig } from '../../templates/config';
import { TemplateWrapper } from '../../templates/TemplateWrapper';

interface CvLivePreviewProps {
  data: JsonResumeSchema | null;
  templateId: string;
  onTemplateChange?: (templateId: string) => void;
  className?: string;
}

/** Ref API exposed by CvLivePreview */
export type CvLivePreviewRef = HTMLDivElement;

const CvLivePreview = forwardRef<HTMLDivElement, CvLivePreviewProps>(({
  data,
  templateId,
  onTemplateChange,
  className = '',
}, ref) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<TemplateConfig[]>([]);

  // Expose the preview element via ref - Forwarding direct DOM ref now for react-to-print
  // useImperativeHandle(ref, () => ({
  //   getPreviewElement: () => previewContainerRef.current,
  // }), []);

  useEffect(() => {
    const template = getTemplate(templateId);
    if (template) {
      setSelectedTemplate(template);
    }
  }, [templateId]);

  useEffect(() => {
    import('../../templates/config').then((module) => {
      setAvailableTemplates(module.getAllTemplates());
    });
  }, []);

  if (!data) {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-lg ${className}`}>
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">No CV data available for preview</p>
        </div>
      </div>
    );
  }

  if (!selectedTemplate) {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-lg ${className}`}>
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Template not found</p>
        </div>
      </div>
    );
  }

  const handleTemplateChange = (newTemplateId: string) => {
    if (onTemplateChange) {
      onTemplateChange(newTemplateId);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>


      <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 p-0">
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="bg-white dark:bg-gray-800 mx-auto w-full"
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
