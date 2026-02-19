import { ForwardRefExoticComponent, RefAttributes } from 'react';
import { ResumeData } from '../utils/cvDataTransform';
import ModernCleanResume from './ModernCleanResume';
import ATSOptimizedResume from './ATSOptimizedResume';
import CorporateProfessionalResume from './CorporateProfessionalResume';
import CreativeDesignResume from './CreativeDesignResume';
import ElegantMinimalistResume from './ElegantMinimalistResume';
import SoftwareEngineerResume from './SoftwareEngineerResume';
import GermanLatexResume from './GermanLatexResume';

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  category: 'professional' | 'creative' | 'modern' | 'ats-optimized' | 'minimalist';
  previewImage?: string;
  component: ForwardRefExoticComponent<{ data: ResumeData } & RefAttributes<HTMLDivElement>>;
}

export const TEMPLATES: Record<string, TemplateConfig> = {
  'modern-clean': {
    id: 'modern-clean',
    name: 'Modern Clean',
    description: 'A clean, modern design with excellent readability',
    category: 'modern',
    component: ModernCleanResume,
  },
  'ats-optimized': {
    id: 'ats-optimized',
    name: 'ATS Optimized',
    description: 'Designed for maximum ATS compatibility',
    category: 'ats-optimized',
    component: ATSOptimizedResume,
  },
  'corporate-professional': {
    id: 'corporate-professional',
    name: 'Corporate Professional',
    description: 'Professional corporate style',
    category: 'professional',
    component: CorporateProfessionalResume,
  },
  'creative-design': {
    id: 'creative-design',
    name: 'Creative Design',
    description: 'Creative design for designers and artists',
    category: 'creative',
    component: CreativeDesignResume,
  },
  'elegant-minimalist': {
    id: 'elegant-minimalist',
    name: 'Elegant Minimalist',
    description: 'Elegant minimalist design',
    category: 'minimalist',
    component: ElegantMinimalistResume,
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
