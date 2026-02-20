/**
 * AI-driven CV descriptor types.
 *
 * Instead of being locked to the JsonResume schema, the AI analyses the
 * uploaded CV and emits a CvSectionDescriptor[] that describes every section
 * it found – including sections that JsonResume does not support (e.g.
 * "Certificates", "Volunteer Work", "Hobbies", or any custom heading).
 *
 * The live editor UI and the PDF preview are both generated dynamically from
 * this descriptor + the companion CvData blob, so no new hard-coded React
 * components are ever needed for new section types.
 */

// ─── Field-level types ───────────────────────────────────────────────────────

/**
 * The kind of input widget that should be rendered for a field.
 * Keep this list narrow – if in doubt the AI should use "textarea".
 */
export type FieldType =
  | 'text'        // single-line plain text (name, title, city …)
  | 'textarea'    // multi-line plain text (summaries, descriptions …)
  | 'date'        // YYYY-MM or YYYY string
  | 'url'         // hyperlink
  | 'email'       // email address
  | 'phone'       // phone number
  | 'string-list' // array of plain strings (bullet points, keywords …)
  | 'object-list' // array of nested objects (sub-entries inside a section entry)

/**
 * Descriptor for a single field inside one entry of an object-list section.
 * When sectionType is "single-object" or "freetext" these are the top-level fields.
 */
export interface FieldDef {
  /** Machine-readable key that maps to a property in the data object. */
  key: string
  /** Human-readable label shown above the input widget. */
  label: string
  /** Input widget type. */
  type: FieldType
  /** AI-suggested placeholder / hint text. Optional. */
  placeholder?: string
  /** Whether this field must be non-empty. Defaults to false. */
  required?: boolean
  /**
   * Only used when type === 'object-list'.
   * Describes the fields of each nested object in the list.
   */
  itemFields?: FieldDef[]
}

// ─── Section-level types ─────────────────────────────────────────────────────

/**
 * How the data in a section is structured.
 *
 * - single-object  → one object with named fields (e.g. contact details / basics)
 * - object-list    → an array of objects (e.g. work experience, education)
 * - string-list    → an array of plain strings (e.g. a flat skills list, interests)
 * - freetext       → single prose string (e.g. an objective / personal statement)
 */
export type SectionType =
  | 'single-object'
  | 'object-list'
  | 'string-list'
  | 'freetext'

/**
 * How the section should be visually rendered in the PDF template.
 *
 * - contact-block  → name / contact line at the top of the CV
 * - text-block     → prose paragraph (summary, objective …)
 * - timeline       → dated entries with title + description (work, education …)
 * - tag-cloud      → compact badges / tags (skills, languages, interests …)
 * - plain-list     → simple bulleted list
 * - two-column-list→ two-column bulleted list (good for long skill sets)
 */
export type DisplayStyle =
  | 'contact-block'
  | 'text-block'
  | 'timeline'
  | 'tag-cloud'
  | 'plain-list'
  | 'two-column-list'

/**
 * Full descriptor for one section of the CV.
 */
export interface CvSectionDescriptor {
  /**
   * Unique machine-readable key for this section.
   * The matching data is stored at cvData[key].
   */
  key: string
  /** Human-readable section heading (may be in any language). */
  label: string
  /** How the data is structured. */
  sectionType: SectionType
  /** How the section should be rendered in PDF preview. */
  displayStyle: DisplayStyle
  /**
   * Ordered list of fields.
   * - For single-object: top-level field definitions.
   * - For object-list: fields that every list entry contains.
   * - For string-list / freetext: leave empty or omit.
   */
  fields: FieldDef[]
  /** Render position (0-based). Lower numbers appear first. */
  order: number
  /**
   * Whether this section should be printed in the PDF.
   * Defaults to true. Users can hide sections without deleting the data.
   */
  visible?: boolean
}

// ─── Top-level payload ───────────────────────────────────────────────────────

/**
 * The complete AI-generated CV payload stored in MongoDB.
 *
 * descriptor  → the structural schema, produced once at upload time.
 * data        → the free-form content, keyed by CvSectionDescriptor.key.
 *
 * For object-list sections, data[key] is an array of plain objects.
 * For single-object sections, data[key] is a plain object.
 * For string-list sections, data[key] is an array of strings.
 * For freetext sections, data[key] is a string.
 */
export interface CvDynamicPayload {
  descriptor: CvSectionDescriptor[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
}
