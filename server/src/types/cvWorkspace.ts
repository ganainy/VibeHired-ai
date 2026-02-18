import { JsonResumeSchema } from './jsonresume';

export type CvWorkspaceMode = 'from-scratch' | 'pdf-edit';

export interface EditableCvWorkingCopyDTO {
  cvId: string;
  workspaceMode: CvWorkspaceMode;
  cvJson: JsonResumeSchema;
  templateId: string;
  fidelityLevel: 'high' | 'medium' | 'low';
  fidelityWarnings: string[];
  snapshotVersion: number;
  lastEditedAt: Date;
  pdfBase64?: string;
}

export interface SaveWorkspaceRequest {
  cvJson?: JsonResumeSchema;
  templateId?: string;
  workspaceMode?: CvWorkspaceMode;
}
