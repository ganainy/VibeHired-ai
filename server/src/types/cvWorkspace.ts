import { JsonResumeSchema } from './jsonresume';

export interface EditableCvWorkingCopyDTO {
  cvId: string;
  cvJson: JsonResumeSchema | null;
  templateId: string;
  snapshotVersion: number;
  lastEditedAt: Date;
  pdfBase64?: string;
}

export interface SaveWorkspaceRequest {
  cvJson?: JsonResumeSchema;
  templateId?: string;
}
