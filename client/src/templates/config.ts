import { ForwardRefExoticComponent, RefAttributes } from 'react';
import { ResumeData } from '../utils/cvDataTransform';
import ModernCleanResume from './ModernCleanResume';
import ATSOptimizedResume from './ATSOptimizedResume';
import SoftwareEngineerResume from './SoftwareEngineerResume';
import GermanLatexResume from './GermanLatexResume';

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  category: 'professional' | 'modern' | 'ats-optimized';
  previewImage?: string;
  component: ForwardRefExoticComponent<{ data: ResumeData } & RefAttributes<HTMLDivElement>>;
}

export const TEMPLATES: Record<string, TemplateConfig> = {
  'ats-optimized': {
    id: 'ats-optimized',
    name: 'ATS Optimized',
    description: 'Maximum ATS compatibility with clean, parseable format',
    category: 'ats-optimized',
    component: ATSOptimizedResume,
  },
  'modern-clean': {
    id: 'modern-clean',
    name: 'Modern Clean',
    description: 'A clean, modern design with excellent readability',
    category: 'modern',
    component: ModernCleanResume,
  },
  'software-engineer': {
    id: 'software-engineer',
    name: 'Software Engineer',
    description: 'Optimized for software engineers',
    category: 'professional',
    component: SoftwareEngineerResume,
  },
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
