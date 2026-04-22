import { compactFreeformToJsonResume, normalizeSectionNames, normalizeCvFieldNames } from './cvNormalizer';
import { JsonResumeSchema } from '../types/jsonresume';

describe('compactFreeformToJsonResume', () => {
  // --------------------------------------------------
  // Idempotency: already valid JsonResume
  // --------------------------------------------------
  it('returns identical output for already-valid JsonResume', () => {
    const input: JsonResumeSchema = {
      basics: { name: 'Alice', email: 'alice@example.com' },
      work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01', endDate: '2023-01' }],
      education: [{ institution: 'MIT', area: 'CS', studyType: 'BSc' }],
      skills: [{ name: 'Frontend', keywords: ['React', 'TypeScript'] }],
      languages: [{ language: 'English', fluency: 'Native' }],
    };
    const output = compactFreeformToJsonResume(input as Record<string, any>);
    expect(output).toEqual(input);
  });

  // --------------------------------------------------
  // German section names
  // --------------------------------------------------
  it('maps German section names to canonical JsonResume keys', () => {
    const input = {
      KONTAKT: { name: 'Max Mustermann', email: 'max@example.de' },
      BERUFSERFAHRUNG: [
        { title: 'Developer', subtitle: 'Firma GmbH', dates: '01/2020 – 12/2023', bullets: ['Built API'] },
      ],
      AUSBILDUNG: [
        { title: 'B.Sc. Informatik', subtitle: 'TU Berlin', dates: '2015 – 2019' },
      ],
      'TECHNISCHE KENNTNISSE': [
        { category: 'Sprachen', content: 'JavaScript, TypeScript' },
      ],
      SPRACHEN: [
        { category: 'Deutsch', content: 'Muttersprache' },
      ],
    };
    const output = compactFreeformToJsonResume(input);
    expect(output.basics).toBeDefined();
    expect(output.work).toBeDefined();
    expect(output.education).toBeDefined();
    expect(output.skills).toBeDefined();
    expect(output.languages).toBeDefined();
  });

  // --------------------------------------------------
  // Freeform array entries → proper JsonResume work/education
  // --------------------------------------------------
  it('converts freeform work entries to JsonResume work items', () => {
    const input = {
      work: [
        { title: 'Software Engineer', subtitle: 'Google', dates: '01/2020 – 12/2023', bullets: ['Led team', 'Shipped product'] },
      ],
    };
    const output = compactFreeformToJsonResume(input);
    expect(output.work).toHaveLength(1);
    const w = output.work![0];
    expect(w.name).toBe('Google');
    expect(w.position).toBe('Software Engineer');
    expect(w.startDate).toBe('2020-01');
    expect(w.endDate).toBe('2023-12');
    expect(w.highlights).toEqual(['Led team', 'Shipped product']);
  });

  it('converts freeform education entries to JsonResume education items', () => {
    const input = {
      education: [
        { title: 'B.Sc. Computer Science', subtitle: 'Stanford', dates: '2015 – 2019', content: 'GPA 3.8' },
      ],
    };
    const output = compactFreeformToJsonResume(input);
    expect(output.education).toHaveLength(1);
    const e = output.education![0];
    expect(e.institution).toBe('Stanford');
    expect(e.studyType).toBe('B.Sc. Computer Science');
    expect(e.startDate).toBe('2015');
    expect(e.endDate).toBe('2019');
  });

  // --------------------------------------------------
  // Unknown sections dropped or moved to meta
  // --------------------------------------------------
  it('drops unknown top-level sections instead of leaving them freeform', () => {
    const input = {
      basics: { name: 'Alice' },
      work: [{ name: 'Acme', position: 'Dev' }],
      'Random Section': [{ title: 'Foo' }],
      'Another Weird One': 'some text',
    };
    const output = compactFreeformToJsonResume(input) as any;
    expect(output['Random Section']).toBeUndefined();
    expect(output['Another Weird One']).toBeUndefined();
    // basics and work should still be present
    expect(output.basics).toBeDefined();
    expect(output.work).toBeDefined();
  });

  // --------------------------------------------------
  // Header Info / basics extraction
  // --------------------------------------------------
  it('extracts basics from Header Info section', () => {
    const input = {
      'Header Info': {
        Name: 'John Doe',
        Email: 'john@example.com',
        Phone: '+1 555-1234',
        Location: 'New York, NY',
        LinkedIn: 'https://linkedin.com/in/johndoe',
        GitHub: 'https://github.com/johndoe',
        Summary: 'Experienced developer',
      },
    };
    const output = compactFreeformToJsonResume(input);
    expect(output.basics).toBeDefined();
    expect(output.basics!.name).toBe('John Doe');
    expect(output.basics!.email).toBe('john@example.com');
    expect(output.basics!.phone).toBe('+1 555-1234');
    expect(output.basics!.summary).toBe('Experienced developer');
    expect(output.basics!.location).toBeDefined();
    expect(output.basics!.profiles).toBeDefined();
    const linkedIn = output.basics!.profiles!.find((p: any) => p.network === 'LinkedIn');
    expect(linkedIn).toBeDefined();
    expect(linkedIn!.url).toBe('https://linkedin.com/in/johndoe');
  });

  // --------------------------------------------------
  // Skills: flat array of strings
  // --------------------------------------------------
  it('converts flat array of skill strings to JsonResume skills', () => {
    const input = {
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    };
    const output = compactFreeformToJsonResume(input);
    expect(output.skills).toHaveLength(1);
    expect(output.skills![0].name).toBe('Skills');
    expect(output.skills![0].keywords).toEqual(['JavaScript', 'TypeScript', 'React', 'Node.js']);
  });

  // --------------------------------------------------
  // Languages: single string parsing
  // --------------------------------------------------
  it('parses languages from single string like "German (Native), English (Fluent)"', () => {
    const input = {
      languages: 'German (Native), English (Fluent), French (Intermediate)',
    };
    const output = compactFreeformToJsonResume(input);
    expect(output.languages).toHaveLength(3);
    expect(output.languages![0]).toEqual({ language: 'German', fluency: 'Native' });
    expect(output.languages![1]).toEqual({ language: 'English', fluency: 'Fluent' });
    expect(output.languages![2]).toEqual({ language: 'French', fluency: 'Intermediate' });
  });

  // --------------------------------------------------
  // Date parsing edge cases
  // --------------------------------------------------
  it('parses various date formats correctly', () => {
    const input = {
      work: [
        { title: 'Dev', subtitle: 'Co', dates: 'Jan 2020 - Present', bullets: [] },
        { title: 'Intern', subtitle: 'Inc', dates: '2018-2020', bullets: [] },
        { title: 'Lead', subtitle: 'Org', dates: '06/2017 bis 03/2019', bullets: [] },
      ],
    };
    const output = compactFreeformToJsonResume(input);
    expect(output.work).toHaveLength(3);
    expect(output.work![0].startDate).toBe('2020-01');
    expect(output.work![0].endDate).toBe('Present');
    expect(output.work![1].startDate).toBe('2018');
    expect(output.work![1].endDate).toBe('2020');
    expect(output.work![2].startDate).toBe('2017-06');
    expect(output.work![2].endDate).toBe('2019-03');
  });

  // --------------------------------------------------
  // Cleanup: removes empty values and __vh_tags
  // --------------------------------------------------
  it('removes empty arrays, empty objects, nulls, and __vh_tags', () => {
    const input = {
      basics: { name: 'Alice', label: '', email: null, phone: undefined },
      work: [],
      education: [{ institution: 'MIT', area: '' }],
      skills: ['', null, 'React'],
      __vh_tags: { 'work.0.title': 'title' },
      __meta: { foo: 'bar' },
    };
    const output = compactFreeformToJsonResume(input) as any;
    expect(output.__vh_tags).toBeUndefined();
    expect(output.__meta).toBeUndefined();
    expect(output.work).toBeUndefined();
    expect(output.skills).toBeDefined();
    expect(output.skills![0].keywords).toEqual(['React']);
  });
});
