// Re-export all CV descriptor types from the server source so client code can
// import from a local path without a cross-package reference.
// Do NOT add new types here – keep in sync with server/src/types/cvDescriptor.ts
export type {
  FieldType,
  FieldDef,
  SectionType,
  DisplayStyle,
  CvSectionDescriptor,
  CvDynamicPayload,
} from '../../../server/src/types/cvDescriptor';
