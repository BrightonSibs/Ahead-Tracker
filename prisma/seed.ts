import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const AliasType = {
  NAME_VARIANT: 'NAME_VARIANT',
  MAIDEN_NAME: 'MAIDEN_NAME',
  ABBREVIATED: 'ABBREVIATED',
  INITIALS_ONLY: 'INITIALS_ONLY',
  LEGACY: 'LEGACY',
} as const;
const DataSource = {
  GOOGLE_SCHOLAR: 'GOOGLE_SCHOLAR',
  CROSSREF: 'CROSSREF',
  ORCID: 'ORCID',
  PUBMED: 'PUBMED',
  RESEARCHGATE: 'RESEARCHGATE',
  MANUAL: 'MANUAL',
  CSV_IMPORT: 'CSV_IMPORT',
} as const;
const VerifiedStatus = {
  VERIFIED: 'VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  EXCLUDED: 'EXCLUDED',
} as const;
const MatchType = {
  ORCID_MATCH: 'ORCID_MATCH',
  EXACT_NAME_MATCH: 'EXACT_NAME_MATCH',
  ALIAS_MATCH: 'ALIAS_MATCH',
  FUZZY_MATCH: 'FUZZY_MATCH',
  MANUAL_ASSIGNMENT: 'MANUAL_ASSIGNMENT',
} as const;
const UserRole = {
  ADMIN: 'ADMIN',
  ANALYST: 'ANALYST',
  VIEWER: 'VIEWER',
} as const;
type FacultyRecord = {
  facultyId: number;
  canonicalName: string;
  department: string;
  orcid: string | null;
  sluStartDate: Date | null;
  aliases: Array<{ aliasName: string; aliasType: string }>;
  specialties: string[];
  notes?: string | null;
};

const DEPARTMENTS = [
  { code: 'AHEAD', name: 'AHEAD', shortName: 'AHEAD', color: '#1a6fb5', displayOrder: 1 },
  { code: 'HCOR', name: 'HCOR', shortName: 'HCOR', color: '#14b8a6', displayOrder: 2 },
];

// ─── FACULTY ROSTER (authoritative from spreadsheet) ──────────────────────
const FACULTY: FacultyRecord[] = [
  {
    facultyId: 1,
    canonicalName: 'Divya Subramaniam',
    department: 'HCOR',
    orcid: null,
    sluStartDate: new Date('2018-08-01'),
    aliases: [
      { aliasName: 'Divya S. Subramaniam', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'DS Subramaniam', aliasType: AliasType.INITIALS_ONLY },
    ],
    specialties: ['Health Economics', 'Outcomes Research'],
  },
  {
    facultyId: 2,
    canonicalName: 'Irene Ryan',
    department: 'AHEAD',
    orcid: '0000-0002-4897-4248',
    sluStartDate: new Date('2016-01-01'),
    aliases: [],
    specialties: ['Pharmacoeconomics', 'Health Technology Assessment'],
  },
  {
    facultyId: 3,
    canonicalName: 'Matthew C. Simpson',
    department: 'AHEAD',
    orcid: null,
    sluStartDate: new Date('2015-07-01'),
    aliases: [
      { aliasName: 'Matthew Simpson', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'Matt C. Simpson', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'Matt Simpson', aliasType: AliasType.NAME_VARIANT },
    ],
    specialties: ['Health Policy', 'Epidemiology'],
  },
  {
    facultyId: 4,
    canonicalName: 'Zidong Zhang',
    department: 'AHEAD',
    orcid: null,
    sluStartDate: new Date('2019-08-01'),
    aliases: [],
    specialties: ['Biostatistics', 'Health Data Science'],
  },
  {
    facultyId: 5,
    canonicalName: 'Tong Si',
    department: 'HCOR',
    orcid: null,
    sluStartDate: new Date('2017-01-01'),
    aliases: [],
    specialties: ['Comparative Effectiveness', 'Pharmacoepidemiology'],
  },
  {
    facultyId: 6,
    canonicalName: 'Noor Al-Hammadi',
    department: 'HCOR',
    orcid: null,
    sluStartDate: new Date('2020-08-01'),
    aliases: [
      { aliasName: 'Noor R. Al-Hammadi', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'NR Al-Hammadi', aliasType: AliasType.INITIALS_ONLY },
      { aliasName: 'NR Al Hammadi', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'N Al-Hammadi', aliasType: AliasType.INITIALS_ONLY },
      { aliasName: 'N Al Hammadi', aliasType: AliasType.INITIALS_ONLY },
    ],
    specialties: ['Outcomes Research', 'Chronic Disease Management'],
  },
  {
    facultyId: 7,
    canonicalName: 'Paula Buchanan',
    department: 'HCOR',
    orcid: '0000-0002-9088-2515',
    sluStartDate: new Date('2014-01-01'),
    aliases: [
      { aliasName: 'Paula M Buchanan', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'PM Buchanan', aliasType: AliasType.INITIALS_ONLY },
      { aliasName: 'Paula Stirnemann', aliasType: AliasType.MAIDEN_NAME },
      { aliasName: 'Paula M Stirnemann', aliasType: AliasType.MAIDEN_NAME },
      { aliasName: 'PM Stirnemann', aliasType: AliasType.MAIDEN_NAME },
    ],
    specialties: ['Patient-Reported Outcomes', 'Quality of Life'],
  },
  {
    facultyId: 8,
    canonicalName: 'Dipti Subramaniam',
    department: 'HCOR',
    orcid: null,
    sluStartDate: new Date('2018-08-01'),
    aliases: [
      { aliasName: 'Dipti P Subramaniam', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'DP Subramaniam', aliasType: AliasType.INITIALS_ONLY },
    ],
    specialties: ['Health Economics', 'Real-World Evidence'],
  },
  {
    facultyId: 9,
    canonicalName: 'Bahareh Rahmani',
    department: 'HCOR',
    orcid: null,
    sluStartDate: new Date('2021-01-01'),
    aliases: [
      { aliasName: 'B Rahmani', aliasType: AliasType.INITIALS_ONLY },
    ],
    specialties: ['Health Services Research', 'Mental Health'],
  },
  {
    facultyId: 10,
    canonicalName: 'Jason M Doherty',
    department: 'AHEAD',
    orcid: null,
    sluStartDate: new Date('2016-08-01'),
    aliases: [
      { aliasName: 'Jason Doherty', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'JM Doherty', aliasType: AliasType.INITIALS_ONLY },
    ],
    specialties: ['Pharmacoeconomics', 'Decision Modeling'],
  },
  {
    facultyId: 11,
    canonicalName: 'Joanne Salas',
    department: 'AHEAD',
    orcid: null,
    sluStartDate: new Date('2017-01-01'),
    aliases: [],
    specialties: ['Primary Care Research', 'Mental Health Economics'],
  },
  {
    facultyId: 12,
    canonicalName: 'Eric Armbrecht',
    department: 'AHEAD',
    orcid: null,
    sluStartDate: new Date('2013-08-01'),
    aliases: [
      { aliasName: 'ES Armbrecht', aliasType: AliasType.INITIALS_ONLY },
      { aliasName: 'E Armbrecht', aliasType: AliasType.INITIALS_ONLY },
    ],
    specialties: ['Health Technology Assessment', 'Aging Research'],
  },
  {
    facultyId: 14,
    canonicalName: 'Tim Chrusciel',
    department: 'AHEAD',
    orcid: null,
    sluStartDate: new Date('2015-01-01'),
    aliases: [
      { aliasName: 'T Chrusciel', aliasType: AliasType.ABBREVIATED },
      { aliasName: 'T. Chrusciel', aliasType: AliasType.ABBREVIATED },
      { aliasName: 'TP Chrusciel', aliasType: AliasType.INITIALS_ONLY },
      { aliasName: 'Tim P Chrusciel', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'Timothy Chrusciel', aliasType: AliasType.NAME_VARIANT },
    ],
    specialties: ['Biostatistics', 'Clinical Research Methods'],
  },
  {
    facultyId: 15,
    canonicalName: 'Paul Hitz',
    department: 'AHEAD',
    orcid: null,
    sluStartDate: new Date('2012-08-01'),
    aliases: [
      { aliasName: 'Paul J Hitz', aliasType: AliasType.NAME_VARIANT },
      { aliasName: 'PJ Hitz', aliasType: AliasType.INITIALS_ONLY },
      { aliasName: 'Paul John Hitz', aliasType: AliasType.NAME_VARIANT },
    ],
    specialties: ['Health Economics', 'Pharmaceutical Policy'],
  },
];

const JOURNALS = [
  { journalName: 'JAMA Internal Medicine', issn: '2168-6106', impactFactor: 21.4, quartile: 'Q1' },
  { journalName: 'Value in Health', issn: '1098-3015', impactFactor: 5.9, quartile: 'Q1' },
  { journalName: 'PharmacoEconomics', issn: '1170-7690', impactFactor: 4.1, quartile: 'Q1' },
  { journalName: 'Health Affairs', issn: '0278-2715', impactFactor: 8.1, quartile: 'Q1' },
  { journalName: 'Medical Care', issn: '0025-7079', impactFactor: 4.2, quartile: 'Q1' },
  { journalName: 'Journal of General Internal Medicine', issn: '0884-8734', impactFactor: 4.3, quartile: 'Q1' },
  { journalName: 'Health Services Research', issn: '0017-9124', impactFactor: 3.8, quartile: 'Q1' },
  { journalName: 'American Journal of Public Health', issn: '0090-0036', impactFactor: 7.2, quartile: 'Q1' },
  { journalName: 'Journal of Health Economics', issn: '0167-6296', impactFactor: 3.6, quartile: 'Q1' },
  { journalName: 'Annals of Internal Medicine', issn: '0003-4819', impactFactor: 39.2, quartile: 'Q1' },
  { journalName: 'PLOS ONE', issn: '1932-6203', impactFactor: 3.7, quartile: 'Q2' },
  { journalName: 'BMJ Open', issn: '2044-6055', impactFactor: 2.9, quartile: 'Q2' },
  { journalName: 'Journal of Managed Care & Specialty Pharmacy', issn: '2376-0540', impactFactor: 3.1, quartile: 'Q2' },
  { journalName: 'Applied Health Economics and Health Policy', issn: '1175-5652', impactFactor: 3.5, quartile: 'Q1' },
  { journalName: 'Psychiatric Services', issn: '1075-2730', impactFactor: 4.0, quartile: 'Q1' },
];

const SPECIALTIES = [
  { name: 'Health Economics', color: '#0ea5e9', description: 'Economic evaluation of health interventions' },
  { name: 'Pharmacoeconomics', color: '#8b5cf6', description: 'Economic aspects of pharmaceutical products' },
  { name: 'Outcomes Research', color: '#10b981', description: 'Patient and clinical outcomes measurement' },
  { name: 'Health Policy', color: '#f59e0b', description: 'Health system policy analysis' },
  { name: 'Epidemiology', color: '#ef4444', description: 'Population health studies' },
  { name: 'Biostatistics', color: '#ec4899', description: 'Statistical methods in biology and medicine' },
  { name: 'Health Technology Assessment', color: '#14b8a6', description: 'Evaluation of medical technologies' },
  { name: 'Comparative Effectiveness', color: '#6366f1', description: 'Comparing health interventions' },
  { name: 'Patient-Reported Outcomes', color: '#84cc16', description: 'Patient self-report measures' },
  { name: 'Real-World Evidence', color: '#0891b2', description: 'Evidence from real-world data sources' },
  { name: 'Decision Modeling', color: '#7c3aed', description: 'Mathematical models for health decisions' },
  { name: 'Mental Health Economics', color: '#db2777', description: 'Economic research on mental health' },
  { name: 'Primary Care Research', color: '#059669', description: 'Primary care delivery and outcomes' },
  { name: 'Aging Research', color: '#d97706', description: 'Health and economics of aging' },
  { name: 'Pharmacoepidemiology', color: '#dc2626', description: 'Drug safety and utilization in populations' },
  { name: 'Health Services Research', color: '#2563eb', description: 'Access, quality, and cost of health services' },
  { name: 'Quality of Life', color: '#16a34a', description: 'Health-related quality of life measurement' },
  { name: 'Pharmaceutical Policy', color: '#9333ea', description: 'Drug pricing and access policy' },
  { name: 'Health Data Science', color: '#0369a1', description: 'Machine learning and AI in healthcare' },
  { name: 'Chronic Disease Management', color: '#b45309', description: 'Long-term disease management strategies' },
  { name: 'Clinical Research Methods', color: '#475569', description: 'Trial design and methodology' },
];

// Demo publications per researcher
const DEMO_PUBLICATIONS = [
  // Paula Buchanan (ID 7) - most senior, most publications
  {
    title: 'Cost-effectiveness of Disease Management Programs for Type 2 Diabetes in Missouri Medicaid',
    doi: '10.1016/j.jval.2019.04.001',
    publicationDate: new Date('2019-09-15'),
    publicationYear: 2019,
    journalName: 'Value in Health',
    abstract: 'This study evaluates the cost-effectiveness of structured disease management programs for type 2 diabetes patients enrolled in Missouri Medicaid. Using a Markov model over a 10-year horizon, we compared standard care versus intensive management.',
    sourcePrimary: DataSource.CROSSREF,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Paula M Buchanan', 'Irene Ryan', 'Eric Armbrecht'],
    facultyIds: [7, 2, 12],
    citationHistory: [
      { year: 2019, count: 8, source: DataSource.CROSSREF },
      { year: 2020, count: 24, source: DataSource.CROSSREF },
      { year: 2021, count: 41, source: DataSource.CROSSREF },
      { year: 2022, count: 58, source: DataSource.CROSSREF },
      { year: 2023, count: 71, source: DataSource.CROSSREF },
      { year: 2024, count: 79, source: DataSource.CROSSREF },
    ],
    specialties: ['Health Economics', 'Outcomes Research'],
  },
  {
    title: 'Patient-Reported Outcomes in Rheumatoid Arthritis: A Systematic Review of Measurement Tools',
    doi: '10.1136/bmjopen-2018-023401',
    publicationDate: new Date('2018-06-10'),
    publicationYear: 2018,
    journalName: 'BMJ Open',
    abstract: 'We conducted a systematic review of patient-reported outcome measures used in rheumatoid arthritis clinical trials published between 2010 and 2017.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Paula Stirnemann', 'Dipti Subramaniam'],
    facultyIds: [7, 8],
    citationHistory: [
      { year: 2018, count: 12, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2019, count: 35, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2020, count: 52, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2021, count: 68, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2022, count: 83, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2023, count: 94, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2024, count: 101, source: DataSource.GOOGLE_SCHOLAR },
    ],
    specialties: ['Patient-Reported Outcomes', 'Quality of Life'],
  },
  // Eric Armbrecht (ID 12) - longest tenure
  {
    title: 'Economic Burden of Alzheimer\'s Disease and Related Dementias in the United States, 2016-2025',
    doi: '10.1016/j.jalz.2016.09.003',
    publicationDate: new Date('2016-11-01'),
    publicationYear: 2016,
    journalName: 'Health Affairs',
    abstract: 'We estimated the total societal cost of Alzheimer\'s disease and related dementias from 2016 through projected 2025, including direct medical costs, long-term care costs, and informal caregiver burden.',
    sourcePrimary: DataSource.CROSSREF,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['ES Armbrecht', 'Paul J Hitz', 'Matthew C. Simpson'],
    facultyIds: [12, 15, 3],
    citationHistory: [
      { year: 2016, count: 45, source: DataSource.CROSSREF },
      { year: 2017, count: 112, source: DataSource.CROSSREF },
      { year: 2018, count: 178, source: DataSource.CROSSREF },
      { year: 2019, count: 234, source: DataSource.CROSSREF },
      { year: 2020, count: 289, source: DataSource.CROSSREF },
      { year: 2021, count: 321, source: DataSource.CROSSREF },
      { year: 2022, count: 352, source: DataSource.CROSSREF },
      { year: 2023, count: 378, source: DataSource.CROSSREF },
      { year: 2024, count: 391, source: DataSource.CROSSREF },
    ],
    specialties: ['Health Economics', 'Aging Research'],
  },
  {
    title: 'Return on Investment for Preventive Services in Medicare Advantage Plans',
    doi: '10.1097/MLR.0000000000000542',
    publicationDate: new Date('2015-08-20'),
    publicationYear: 2015,
    journalName: 'Medical Care',
    abstract: 'This analysis quantifies the return on investment from expanded preventive service coverage in Medicare Advantage plans, including cancer screening, cardiovascular prevention, and diabetes prevention programs.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['E Armbrecht', 'Tim P Chrusciel', 'Joanne Salas'],
    facultyIds: [12, 14, 11],
    citationHistory: [
      { year: 2015, count: 22, source: DataSource.PUBMED },
      { year: 2016, count: 67, source: DataSource.PUBMED },
      { year: 2017, count: 98, source: DataSource.PUBMED },
      { year: 2018, count: 119, source: DataSource.PUBMED },
      { year: 2019, count: 134, source: DataSource.PUBMED },
      { year: 2020, count: 145, source: DataSource.PUBMED },
      { year: 2021, count: 152, source: DataSource.PUBMED },
      { year: 2022, count: 158, source: DataSource.PUBMED },
      { year: 2023, count: 163, source: DataSource.PUBMED },
    ],
    specialties: ['Health Economics', 'Health Policy'],
  },
  // Paul Hitz (ID 15)
  {
    title: 'Pharmaceutical Pricing Reform and Access to Specialty Medications: Evidence from State-Level Policies',
    doi: '10.1377/hlthaff.2017.1234',
    publicationDate: new Date('2017-10-01'),
    publicationYear: 2017,
    journalName: 'Health Affairs',
    abstract: 'Using a difference-in-differences approach, we examine how state-level pharmaceutical pricing policies affect patient access to specialty medications, with focus on biologics for autoimmune conditions.',
    sourcePrimary: DataSource.CROSSREF,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Paul Hitz', 'Jason M Doherty', 'Irene Ryan'],
    facultyIds: [15, 10, 2],
    citationHistory: [
      { year: 2017, count: 18, source: DataSource.CROSSREF },
      { year: 2018, count: 52, source: DataSource.CROSSREF },
      { year: 2019, count: 89, source: DataSource.CROSSREF },
      { year: 2020, count: 127, source: DataSource.CROSSREF },
      { year: 2021, count: 156, source: DataSource.CROSSREF },
      { year: 2022, count: 178, source: DataSource.CROSSREF },
      { year: 2023, count: 195, source: DataSource.CROSSREF },
      { year: 2024, count: 203, source: DataSource.CROSSREF },
    ],
    specialties: ['Pharmaceutical Policy', 'Health Economics'],
  },
  {
    title: 'Budget Impact Analysis of Universal Basic Mental Health Coverage in Missouri',
    doi: '10.1007/s40273-018-0701-3',
    publicationDate: new Date('2018-12-01'),
    publicationYear: 2018,
    journalName: 'PharmacoEconomics',
    abstract: 'We project the 5-year budget impact to Missouri Medicaid of implementing universal basic mental health coverage comparable to physical health benefits.',
    sourcePrimary: DataSource.CROSSREF,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['PJ Hitz', 'Joanne Salas', 'Jason Doherty'],
    facultyIds: [15, 11, 10],
    citationHistory: [
      { year: 2018, count: 5, source: DataSource.CROSSREF },
      { year: 2019, count: 18, source: DataSource.CROSSREF },
      { year: 2020, count: 31, source: DataSource.CROSSREF },
      { year: 2021, count: 44, source: DataSource.CROSSREF },
      { year: 2022, count: 55, source: DataSource.CROSSREF },
      { year: 2023, count: 63, source: DataSource.CROSSREF },
      { year: 2024, count: 68, source: DataSource.CROSSREF },
    ],
    specialties: ['Health Economics', 'Mental Health Economics'],
  },
  // Matthew C. Simpson (ID 3)
  {
    title: 'Social Determinants of Health and Hospital Readmission Rates: A Nationwide Analysis',
    doi: '10.1097/MLR.0000000000001234',
    publicationDate: new Date('2018-03-15'),
    publicationYear: 2018,
    journalName: 'Medical Care',
    abstract: 'We analyzed the relationship between county-level social determinants of health indicators and 30-day hospital readmission rates across US hospitals, using Medicare claims data from 2012-2016.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Matthew C. Simpson', 'Tim Chrusciel', 'Zidong Zhang'],
    facultyIds: [3, 14, 4],
    citationHistory: [
      { year: 2018, count: 31, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2019, count: 78, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2020, count: 124, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2021, count: 167, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2022, count: 198, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2023, count: 221, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2024, count: 234, source: DataSource.GOOGLE_SCHOLAR },
    ],
    specialties: ['Health Policy', 'Epidemiology'],
  },
  {
    title: 'Racial and Ethnic Disparities in Access to Novel Oncology Therapies: Evidence from Commercial Insurance Claims',
    doi: '10.1200/JCO.21.02456',
    publicationDate: new Date('2022-04-10'),
    publicationYear: 2022,
    journalName: 'JAMA Internal Medicine',
    abstract: 'Using 2016-2020 commercial insurance claims, we document racial and ethnic disparities in time to initiation of FDA-approved cancer therapies following diagnosis.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Matt Simpson', 'Noor Al-Hammadi', 'Bahareh Rahmani'],
    facultyIds: [3, 6, 9],
    citationHistory: [
      { year: 2022, count: 19, source: DataSource.PUBMED },
      { year: 2023, count: 56, source: DataSource.PUBMED },
      { year: 2024, count: 88, source: DataSource.PUBMED },
    ],
    specialties: ['Health Policy', 'Outcomes Research'],
  },
  // Irene Ryan (ID 2)
  {
    title: 'Health Technology Assessment Frameworks for Gene Therapies: Challenges and Recommendations',
    doi: '10.1016/j.jval.2021.01.012',
    publicationDate: new Date('2021-04-01'),
    publicationYear: 2021,
    journalName: 'Value in Health',
    abstract: 'Gene therapies present unique challenges for standard HTA frameworks due to their one-time administration, long-term uncertain outcomes, and high upfront costs. We propose an adapted multi-criteria decision framework.',
    sourcePrimary: DataSource.ORCID,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Irene Ryan', 'Jason M Doherty', 'Paul John Hitz'],
    facultyIds: [2, 10, 15],
    citationHistory: [
      { year: 2021, count: 29, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2022, count: 87, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2023, count: 141, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2024, count: 178, source: DataSource.GOOGLE_SCHOLAR },
    ],
    specialties: ['Health Technology Assessment', 'Pharmacoeconomics'],
  },
  {
    title: 'Value-Based Contracting for Oncology Drugs: A Framework for Outcomes-Based Agreements',
    doi: '10.1007/s40273-020-00934-5',
    publicationDate: new Date('2020-07-01'),
    publicationYear: 2020,
    journalName: 'PharmacoEconomics',
    abstract: 'This paper develops a practical framework for value-based outcomes contracting between payers and pharmaceutical manufacturers for oncology drugs, addressing data requirements, governance, and risk-sharing mechanisms.',
    sourcePrimary: DataSource.ORCID,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Irene Ryan', 'Paula M Buchanan'],
    facultyIds: [2, 7],
    citationHistory: [
      { year: 2020, count: 14, source: DataSource.CROSSREF },
      { year: 2021, count: 48, source: DataSource.CROSSREF },
      { year: 2022, count: 79, source: DataSource.CROSSREF },
      { year: 2023, count: 103, source: DataSource.CROSSREF },
      { year: 2024, count: 118, source: DataSource.CROSSREF },
    ],
    specialties: ['Health Technology Assessment', 'Health Economics'],
  },
  // Jason M. Doherty (ID 10)
  {
    title: 'Cost-Utility Analysis of Expanded Newborn Screening Programs in Missouri',
    doi: '10.1097/MLR.0000000000001567',
    publicationDate: new Date('2017-06-01'),
    publicationYear: 2017,
    journalName: 'Medical Care',
    abstract: 'We assessed the cost-utility of expanding Missouri newborn screening panels to include spinal muscular atrophy and severe combined immune deficiency, using a decision-analytic model with a lifetime horizon.',
    sourcePrimary: DataSource.CROSSREF,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['JM Doherty', 'Eric Armbrecht', 'Tim P Chrusciel'],
    facultyIds: [10, 12, 14],
    citationHistory: [
      { year: 2017, count: 11, source: DataSource.CROSSREF },
      { year: 2018, count: 33, source: DataSource.CROSSREF },
      { year: 2019, count: 54, source: DataSource.CROSSREF },
      { year: 2020, count: 71, source: DataSource.CROSSREF },
      { year: 2021, count: 84, source: DataSource.CROSSREF },
      { year: 2022, count: 93, source: DataSource.CROSSREF },
      { year: 2023, count: 99, source: DataSource.CROSSREF },
    ],
    specialties: ['Health Economics', 'Decision Modeling'],
  },
  // Joanne Salas (ID 11)
  {
    title: 'Association Between Primary Care Visit Frequency and Emergency Department Utilization Among Patients with Depression',
    doi: '10.1370/afm.2456',
    publicationDate: new Date('2019-11-01'),
    publicationYear: 2019,
    journalName: 'Annals of Internal Medicine',
    abstract: 'Using Missouri Medicaid claims, we examined whether more frequent primary care visits were associated with reduced emergency department use among patients with a depression diagnosis.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Joanne Salas', 'T Chrusciel', 'Matt Simpson'],
    facultyIds: [11, 14, 3],
    citationHistory: [
      { year: 2019, count: 17, source: DataSource.PUBMED },
      { year: 2020, count: 49, source: DataSource.PUBMED },
      { year: 2021, count: 81, source: DataSource.PUBMED },
      { year: 2022, count: 109, source: DataSource.PUBMED },
      { year: 2023, count: 131, source: DataSource.PUBMED },
      { year: 2024, count: 148, source: DataSource.PUBMED },
    ],
    specialties: ['Primary Care Research', 'Mental Health Economics'],
  },
  // Tong Si (ID 5)
  {
    title: 'Comparative Effectiveness of SGLT-2 Inhibitors Versus GLP-1 Agonists in Patients with Type 2 Diabetes and Heart Failure',
    doi: '10.1001/jamainternmed.2020.3456',
    publicationDate: new Date('2020-10-01'),
    publicationYear: 2020,
    journalName: 'JAMA Internal Medicine',
    abstract: 'We conducted a real-world comparative effectiveness analysis of SGLT-2 inhibitors versus GLP-1 receptor agonists in reducing major adverse cardiovascular events among patients with T2D and comorbid heart failure.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Tong Si', 'Divya Subramaniam', 'DP Subramaniam'],
    facultyIds: [5, 1, 8],
    citationHistory: [
      { year: 2020, count: 42, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2021, count: 118, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2022, count: 189, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2023, count: 247, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2024, count: 289, source: DataSource.GOOGLE_SCHOLAR },
    ],
    specialties: ['Comparative Effectiveness', 'Pharmacoepidemiology'],
  },
  // Noor Al-Hammadi (ID 6)
  {
    title: 'Health-Related Quality of Life Among Patients with Chronic Obstructive Pulmonary Disease: Disparities by Race and Social Determinants',
    doi: '10.1371/journal.pone.0234567',
    publicationDate: new Date('2021-08-15'),
    publicationYear: 2021,
    journalName: 'PLOS ONE',
    abstract: 'This cross-sectional study examines variation in HRQOL among COPD patients by race, ethnicity, and social determinants of health using national health survey data from 2015-2019.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Noor R. Al-Hammadi', 'Bahareh Rahmani', 'Dipti P Subramaniam'],
    facultyIds: [6, 9, 8],
    citationHistory: [
      { year: 2021, count: 7, source: DataSource.PUBMED },
      { year: 2022, count: 23, source: DataSource.PUBMED },
      { year: 2023, count: 38, source: DataSource.PUBMED },
      { year: 2024, count: 49, source: DataSource.PUBMED },
    ],
    specialties: ['Outcomes Research', 'Chronic Disease Management'],
  },
  // Zidong Zhang (ID 4)
  {
    title: 'Machine Learning Approaches to Predicting Unplanned Hospitalization in Older Adults: A Systematic Review',
    doi: '10.1093/jamia/ocab023',
    publicationDate: new Date('2021-06-01'),
    publicationYear: 2021,
    journalName: 'Journal of General Internal Medicine',
    abstract: 'We systematically reviewed machine learning models used to predict unplanned hospitalization in adults aged 65 and older, assessing methodology, validation, and clinical implementation potential.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Zidong Zhang', 'Tim Chrusciel', 'Matthew Simpson'],
    facultyIds: [4, 14, 3],
    citationHistory: [
      { year: 2021, count: 21, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2022, count: 68, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2023, count: 112, source: DataSource.GOOGLE_SCHOLAR },
      { year: 2024, count: 143, source: DataSource.GOOGLE_SCHOLAR },
    ],
    specialties: ['Health Data Science', 'Biostatistics'],
  },
  // Bahareh Rahmani (ID 9)
  {
    title: 'Barriers and Facilitators to Mental Health Service Use Among Immigrant Populations: A Scoping Review',
    doi: '10.1176/appi.ps.202100245',
    publicationDate: new Date('2022-02-01'),
    publicationYear: 2022,
    journalName: 'Psychiatric Services',
    abstract: 'We conducted a scoping review of literature on barriers and facilitators to mental health service utilization among first- and second-generation immigrant populations in the United States.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['B Rahmani', 'Joanne Salas', 'Noor Al-Hammadi'],
    facultyIds: [9, 11, 6],
    citationHistory: [
      { year: 2022, count: 9, source: DataSource.PUBMED },
      { year: 2023, count: 28, source: DataSource.PUBMED },
      { year: 2024, count: 44, source: DataSource.PUBMED },
    ],
    specialties: ['Health Services Research', 'Mental Health Economics'],
  },
  // Divya Subramaniam (ID 1)
  {
    title: 'Cost-Effectiveness of Continuous Glucose Monitoring in Non-Insulin-Using Type 2 Diabetes Patients',
    doi: '10.1016/j.jval.2021.07.005',
    publicationDate: new Date('2021-10-01'),
    publicationYear: 2021,
    journalName: 'Value in Health',
    abstract: 'We evaluated the cost-effectiveness of real-time continuous glucose monitoring compared to standard self-monitoring of blood glucose in type 2 diabetes patients not using insulin.',
    sourcePrimary: DataSource.CROSSREF,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Divya Subramaniam', 'Tong Si', 'Paul Hitz'],
    facultyIds: [1, 5, 15],
    citationHistory: [
      { year: 2021, count: 11, source: DataSource.CROSSREF },
      { year: 2022, count: 37, source: DataSource.CROSSREF },
      { year: 2023, count: 62, source: DataSource.CROSSREF },
      { year: 2024, count: 78, source: DataSource.CROSSREF },
    ],
    specialties: ['Health Economics', 'Outcomes Research'],
  },
  // Tim Chrusciel (ID 14)
  {
    title: 'Propensity Score Methods in Pharmacoepidemiologic Research: A Practical Guide',
    doi: '10.1097/EDE.0000000000001234',
    publicationDate: new Date('2019-07-01'),
    publicationYear: 2019,
    journalName: 'American Journal of Public Health',
    abstract: 'We provide a practical methodological guide to implementing propensity score methods—matching, weighting, and stratification—in pharmacoepidemiologic studies using claims and electronic health record data.',
    sourcePrimary: DataSource.PUBMED,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['TP Chrusciel', 'Zidong Zhang', 'ES Armbrecht'],
    facultyIds: [14, 4, 12],
    citationHistory: [
      { year: 2019, count: 24, source: DataSource.PUBMED },
      { year: 2020, count: 72, source: DataSource.PUBMED },
      { year: 2021, count: 118, source: DataSource.PUBMED },
      { year: 2022, count: 155, source: DataSource.PUBMED },
      { year: 2023, count: 183, source: DataSource.PUBMED },
      { year: 2024, count: 198, source: DataSource.PUBMED },
    ],
    specialties: ['Biostatistics', 'Clinical Research Methods'],
  },
  // Dipti Subramaniam (ID 8)
  {
    title: 'Real-World Treatment Patterns and Outcomes for Patients with Psoriatic Arthritis Initiating Biologic Therapy',
    doi: '10.1007/s40744-022-00123-x',
    publicationDate: new Date('2022-09-01'),
    publicationYear: 2022,
    journalName: 'Journal of Managed Care & Specialty Pharmacy',
    abstract: 'We describe real-world biologic treatment initiation patterns, persistence, and clinical outcomes among commercially insured patients with newly diagnosed psoriatic arthritis using a large US claims database.',
    sourcePrimary: DataSource.CROSSREF,
    verifiedStatus: VerifiedStatus.VERIFIED,
    authorNames: ['Dipti P Subramaniam', 'Tong Si', 'Noor R. Al-Hammadi'],
    facultyIds: [8, 5, 6],
    citationHistory: [
      { year: 2022, count: 6, source: DataSource.CROSSREF },
      { year: 2023, count: 19, source: DataSource.CROSSREF },
      { year: 2024, count: 31, source: DataSource.CROSSREF },
    ],
    specialties: ['Real-World Evidence', 'Pharmacoepidemiology'],
  },
];

async function main() {
  console.log('🌱 Starting seed...');
  await prisma.publicationResearcherMatch.deleteMany({});
  await prisma.publicationAuthor.deleteMany({});
  await prisma.citation.deleteMany({});
  await prisma.publicationSpecialty.deleteMany({});
  await prisma.sourceRecord.deleteMany({});
  await prisma.manualOverride.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.syncJob.deleteMany({});
  await prisma.researcherSpecialty.deleteMany({});
  await prisma.researcherIdentifier.deleteMany({});
  await prisma.researcherAlias.deleteMany({});
  await prisma.publication.deleteMany({});
  await prisma.researcher.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.journalMetric.deleteMany({});
  await prisma.specialty.deleteMany({});

  // ── Admin user ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@slu.edu' },
    update: {},
    create: { email: 'admin@slu.edu', name: 'Admin User', passwordHash, role: UserRole.ADMIN },
  });
  await prisma.user.upsert({
    where: { email: 'analyst@slu.edu' },
    update: {},
    create: { email: 'analyst@slu.edu', name: 'Research Analyst', passwordHash: await bcrypt.hash('analyst123', 10), role: UserRole.ANALYST },
  });
  await prisma.user.upsert({
    where: { email: 'viewer@slu.edu' },
    update: {},
    create: { email: 'viewer@slu.edu', name: 'Viewer', passwordHash: await bcrypt.hash('viewer123', 10), role: UserRole.VIEWER },
  });
  console.log('✅ Users created');

  // ── Departments ───────────────────────────────────────────────────────────
  for (const department of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: {
        name: department.name,
        shortName: department.shortName,
        color: department.color,
        activeStatus: true,
        displayOrder: department.displayOrder,
      },
      create: {
        code: department.code,
        name: department.name,
        shortName: department.shortName,
        color: department.color,
        activeStatus: true,
        displayOrder: department.displayOrder,
      },
    });
  }
  console.log('✅ Departments created');

  // ── Specialties ───────────────────────────────────────────────────────────
  const specialtyMap: Record<string, string> = {};
  for (const spec of SPECIALTIES) {
    const s = await prisma.specialty.upsert({
      where: { name: spec.name },
      update: {},
      create: spec,
    });
    specialtyMap[spec.name] = s.id;
  }
  console.log('✅ Specialties created');

  // ── Journal metrics ───────────────────────────────────────────────────────
  for (const journal of JOURNALS) {
    for (const year of [2020, 2021, 2022, 2023, 2024]) {
      // Slight variation per year
      const variation = 1 + (Math.random() - 0.5) * 0.1;
      await prisma.journalMetric.upsert({
        where: { journalName_year: { journalName: journal.journalName, year } },
        update: {},
        create: {
          journalName: journal.journalName,
          issn: journal.issn,
          year,
          impactFactor: parseFloat((journal.impactFactor * variation).toFixed(2)),
          quartile: journal.quartile,
          source: 'JCR',
        },
      });
    }
  }
  console.log('✅ Journal metrics created');

  // ── Researchers ───────────────────────────────────────────────────────────
  const researcherMap: Record<number, string> = {};
  for (const fac of FACULTY) {
    const researcher = await prisma.researcher.upsert({
      where: { facultyId: fac.facultyId },
      update: { notes: fac.notes || null },
      create: {
        facultyId: fac.facultyId,
        canonicalName: fac.canonicalName,
        department: fac.department,
        orcid: fac.orcid,
        sluStartDate: fac.sluStartDate,
        notes: fac.notes || null,
      },
    });
    researcherMap[fac.facultyId] = researcher.id;

    // ORCID identifier
    if (fac.orcid) {
      await prisma.researcherIdentifier.upsert({
        where: { identifierType_value: { identifierType: 'ORCID', value: fac.orcid } },
        update: {},
        create: { researcherId: researcher.id, identifierType: 'ORCID', value: fac.orcid, verified: true },
      });
    }

    // Specialties
    for (const specName of fac.specialties) {
      const specId = specialtyMap[specName];
      if (specId) {
        await prisma.researcherSpecialty.upsert({
          where: { researcherId_specialtyId: { researcherId: researcher.id, specialtyId: specId } },
          update: {},
          create: { researcherId: researcher.id, specialtyId: specId },
        });
      }
    }
  }
  console.log('✅ Researchers created with aliases');

  // ── Alias fallback upsert (handle duplicates gracefully) ──────────────────
  // Re-do aliases with proper unique keys
  for (const fac of FACULTY) {
    const researcherId = researcherMap[fac.facultyId];
    for (const alias of fac.aliases) {
      await prisma.researcherAlias.create({
        data: {
          researcherId,
          aliasName: alias.aliasName,
          aliasType: alias.aliasType,
          confidence: 1.0,
          source: 'faculty_roster',
        },
      });
    }
  }

  // ── Publications ──────────────────────────────────────────────────────────
  for (const pub of DEMO_PUBLICATIONS) {
    // Normalize title
    const normalizedTitle = pub.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

    const publication = await prisma.publication.upsert({
      where: { doi: pub.doi },
      update: {},
      create: {
        title: pub.title,
        normalizedTitle,
        doi: pub.doi,
        publicationDate: pub.publicationDate,
        publicationYear: pub.publicationYear,
        journalName: pub.journalName,
        abstract: pub.abstract,
        sourcePrimary: pub.sourcePrimary,
        verifiedStatus: pub.verifiedStatus,
      },
    });

    // Authors
    for (let i = 0; i < pub.authorNames.length; i++) {
      await prisma.publicationAuthor.create({
        data: {
          publicationId: publication.id,
          authorName: pub.authorNames[i],
          authorOrder: i + 1,
          isCorresponding: i === 0,
        },
      });
    }

    // Researcher matches
    for (const facultyId of pub.facultyIds) {
      const researcherId = researcherMap[facultyId];
      if (!researcherId) continue;

      // Determine match type
      const researcher = FACULTY.find(f => f.facultyId === facultyId)!;
      const matchedAuthor = pub.authorNames[pub.facultyIds.indexOf(facultyId)];
      const isExact = matchedAuthor === researcher.canonicalName;
      const isAlias = researcher.aliases.some(a => a.aliasName === matchedAuthor);
      const isOrcid = !!researcher.orcid;

      const matchType = isOrcid ? MatchType.ORCID_MATCH
        : isExact ? MatchType.EXACT_NAME_MATCH
        : isAlias ? MatchType.ALIAS_MATCH
        : MatchType.FUZZY_MATCH;

      const confidence = isOrcid ? 1.0 : isExact ? 0.98 : isAlias ? 0.92 : 0.75;

      // SLU tenure check
      const sluStart = researcher.sluStartDate;
      const includedInSlu = !sluStart || pub.publicationDate >= sluStart;

      await prisma.publicationResearcherMatch.upsert({
        where: { publicationId_researcherId: { publicationId: publication.id, researcherId } },
        update: {},
        create: {
          publicationId: publication.id,
          researcherId,
          matchType,
          matchConfidence: confidence,
          manuallyConfirmed: pub.verifiedStatus === VerifiedStatus.VERIFIED,
          includedInSluOutput: includedInSlu,
          sluTenureNote: !includedInSlu ? `Published before researcher's SLU start date (${sluStart?.toISOString().split('T')[0]})` : null,
        },
      });
    }

    // Citation history
    for (const cit of pub.citationHistory) {
      await prisma.citation.create({
        data: {
          publicationId: publication.id,
          source: cit.source,
          citationCount: cit.count,
          capturedAt: new Date(`${cit.year}-12-31`),
        },
      });
    }

    // Specialties
    for (const specName of pub.specialties) {
      const specId = specialtyMap[specName];
      if (specId) {
        await prisma.publicationSpecialty.upsert({
          where: { publicationId_specialtyId: { publicationId: publication.id, specialtyId: specId } },
          update: {},
          create: {
            publicationId: publication.id,
            specialtyId: specId,
            inferred: false,
            manuallyOverridden: false,
          },
        });
      }
    }

    // Source record
    await prisma.sourceRecord.create({
      data: {
        publicationId: publication.id,
        source: pub.sourcePrimary,
        externalId: pub.doi,
        rawData: JSON.stringify({ doi: pub.doi, title: pub.title, journal: pub.journalName }),
        normalizedAt: new Date(),
      },
    });
  }
  console.log('✅ Publications created with citations');

  // ── Alerts ────────────────────────────────────────────────────────────────
  await prisma.alert.createMany({
    data: [
      { alertType: 'DATA_QUALITY', title: 'Missing SLU start dates', message: '0 researchers are missing SLU start dates, which disables tenure-based filtering for those researchers.', resolved: false },
      { alertType: 'MISSING_IMPACT_FACTOR', title: 'Impact factor missing', message: '2 journals in the database are missing impact factors for 2024.', resolved: false },
    ],
  });

  // ── Sync job log ──────────────────────────────────────────────────────────
  await prisma.syncJob.create({
    data: {
      source: DataSource.CROSSREF,
      status: 'COMPLETED',
      startedAt: new Date('2024-11-01T09:00:00Z'),
      completedAt: new Date('2024-11-01T09:04:33Z'),
      recordsFound: 18,
      recordsCreated: 3,
      recordsUpdated: 15,
      triggeredBy: 'system_cron',
    },
  });

  console.log('✅ Alerts and sync logs created');
  console.log('🎉 Seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
