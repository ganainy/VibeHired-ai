import { ForwardRefExoticComponent, RefAttributes } from 'react';
import { ResumeData } from '../utils/cvDataTransform';
import GermanLatexResume from './GermanLatexResume';

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  category: 'professional' | 'modern';
  previewImage?: string;
  component: ForwardRefExoticComponent<{ data: ResumeData } & RefAttributes<HTMLDivElement>>;
}

export const TEMPLATES: Record<string, TemplateConfig> = {
  'german-latex': {
    id: 'german-latex',
    name: 'LaTeX',
    description: 'Professional LaTeX-style CV with clean formatting',
    category: 'professional',
    component: GermanLatexResume,
  },
};

export const getTemplate = (id: string): TemplateConfig | undefined => {
  return TEMPLATES[id];
};

export const getAllTemplates = (): TemplateConfig[] => {
  return Object.values(TEMPLATES);
};

export const getTemplatesByCategory = (category: TemplateConfig['category']): TemplateConfig[] => {
  return Object.values(TEMPLATES).filter(template => template.category === category);
};
