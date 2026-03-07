// lib/call-agent-utils.ts
import { v4 as uuidv4 } from 'uuid';
import {
  Contact,
  ContactStatus,
  CallOutcome,
  ColumnMapping,
  CallAnalysis,
  CallMetadata,
  DashboardStats,
  VoiceId,
  VoiceConfig,
  CallCategory,
} from '@/types/call-agent';

export const VOICE_CONFIGS: Record<VoiceId, VoiceConfig> = {
  maya: { id: 'maya', name: 'Maya', agentName: 'Maya', gender: 'female' },
  josh: { id: 'josh', name: 'Josh', agentName: 'Josh', gender: 'male' },
  matt: { id: 'matt', name: 'Matt', agentName: 'Matt', gender: 'male' },
  nat: { id: 'nat', name: 'Nat', agentName: 'Natalie', gender: 'female' },
};

export function getVoiceConfig(voiceId: VoiceId): VoiceConfig {
  return VOICE_CONFIGS[voiceId] || VOICE_CONFIGS.maya;
}

export function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      const nextChar = row[i + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    companyName: null,
    firstName: null,
    lastName: null,
    contactName: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    phoneNumber: null,
    email: null,
    extraFields: {},
  };

  // Core field patterns - map to dedicated contact columns
  const corePatterns: Record<string, RegExp[]> = {
    companyName: [/^company[\s_-]*name/i, /^business[\s_-]*name/i, /^company$/i, /^business$/i, /^dba$/i, /store[\s_-]*name/i, /^merchant/i, /^org(anization)?[\s_-]*name/i, /^practice[\s_-]*name/i, /^clinic[\s_-]*name/i, /^firm[\s_-]*name/i],
    firstName: [/^first[\s_-]*name/i, /^fname/i, /^given[\s_-]*name/i, /^first$/i, /^primer[\s_-]*nombre/i, /^nombre$/i],
    lastName: [/^last[\s_-]*name/i, /^lname/i, /^surname/i, /^family[\s_-]*name/i, /^last$/i, /^apellido/i],
    contactName: [/^contact[\s_-]*name/i, /^full[\s_-]*name/i, /^name$/i, /^contact$/i, /^nombre[\s_-]*completo/i],
    address: [/^address$/i, /^street/i, /^address[\s_-]*1/i, /^addr$/i, /^mailing[\s_-]*address/i, /^direccion/i],
    city: [/^city$/i, /^town$/i, /^municipality/i, /^ciudad/i, /^locality/i],
    state: [/^state$/i, /^province$/i, /^st$/i, /^region$/i, /^estado$/i, /^county$/i],
    zipCode: [/^zip/i, /^postal/i, /^postcode/i, /^zip[\s_-]*code/i],
    phoneNumber: [/^phone$/i, /^phone[\s_-]*number/i, /^tel$/i, /^telephone/i, /^mobile$/i, /^cell$/i, /^cell[\s_-]*phone/i, /^telefono/i, /^main[\s_-]*phone/i, /^primary[\s_-]*phone/i],
    email: [/^email$/i, /^e-?mail[\s_-]*address/i, /^mail$/i, /^correo/i, /^primary[\s_-]*email/i, /^main[\s_-]*email/i],
  };

  // Known extra field patterns - auto-recognized and stored in custom_fields
  const knownExtraPatterns: Record<string, RegExp[]> = {
    corporate_email: [/^corporate[\s_-]*email/i, /^business[\s_-]*email/i, /^work[\s_-]*email/i, /^company[\s_-]*email/i, /^office[\s_-]*email/i],
    personal_email: [/^personal[\s_-]*email/i, /^private[\s_-]*email/i, /^home[\s_-]*email/i, /^alt(ernate)?[\s_-]*email/i],
    business_phone: [/^business[\s_-]*phone/i, /^work[\s_-]*phone/i, /^office[\s_-]*phone/i, /^company[\s_-]*phone/i, /^direct[\s_-]*line/i],
    personal_phone: [/^personal[\s_-]*phone/i, /^home[\s_-]*phone/i, /^private[\s_-]*phone/i, /^alt(ernate)?[\s_-]*phone/i],
    fax: [/^fax/i],
    website: [/^website/i, /^url$/i, /^web$/i, /^site$/i, /^homepage/i, /^domain/i],
    decision_maker_name: [/^decision[\s_-]*maker/i, /^dm[\s_-]*name/i, /^key[\s_-]*contact/i],
    decision_maker_first_name: [/^decision[\s_-]*maker[\s_-]*first/i, /^dm[\s_-]*first/i],
    decision_maker_last_name: [/^decision[\s_-]*maker[\s_-]*last/i, /^dm[\s_-]*last/i],
    decision_maker_email: [/^decision[\s_-]*maker[\s_-]*email/i, /^dm[\s_-]*email/i],
    decision_maker_phone: [/^decision[\s_-]*maker[\s_-]*phone/i, /^dm[\s_-]*phone/i],
    owner_name: [/^owner[\s_-]*name/i, /^owner$/i, /^propietario/i],
    manager_name: [/^manager[\s_-]*name/i, /^manager$/i, /^gerente/i],
    job_title: [/^(job[\s_-]*)?title$/i, /^position$/i, /^role$/i, /^designation/i, /^cargo/i, /^puesto/i],
    department: [/^department/i, /^dept/i, /^division/i, /^departamento/i],
    industry: [/^industry/i, /^sector$/i, /^vertical/i, /^industria/i],
    company_size: [/^company[\s_-]*size/i, /^employees/i, /^num[\s_-]*employees/i, /^headcount/i, /^size$/i],
    revenue: [/^revenue/i, /^annual[\s_-]*revenue/i, /^income/i, /^sales[\s_-]*volume/i, /^ingreso/i],
    address_2: [/^address[\s_-]*2/i, /^suite/i, /^apt/i, /^unit$/i, /^floor/i],
    country: [/^country/i, /^pais/i, /^nation/i],
    neighborhood: [/^neighborhood/i, /^barrio/i, /^district/i, /^zone$/i, /^colonia/i],
    doctor_assigned: [/^doctor/i, /^dr[\s_-]*(assigned)?/i, /^physician/i, /^provider[\s_-]*name/i, /^medico/i, /^attending/i],
    patient_sex: [/^(patient[\s_-]*)?sex$/i, /^gender$/i, /^sexo$/i, /^genero/i],
    patient_dob: [/^(date[\s_-]*of[\s_-]*)?birth/i, /^dob$/i, /^birthday/i, /^fecha[\s_-]*nacimiento/i],
    patient_id: [/^patient[\s_-]*id/i, /^mrn$/i, /^medical[\s_-]*record/i, /^chart[\s_-]*number/i],
    insurance: [/^insurance/i, /^seguro/i, /^payer/i, /^health[\s_-]*plan/i],
    insurance_id: [/^insurance[\s_-]*id/i, /^policy[\s_-]*number/i, /^member[\s_-]*id/i],
    appointment_date: [/^appointment[\s_-]*date/i, /^appt[\s_-]*date/i, /^scheduled[\s_-]*date/i, /^cita/i, /^visit[\s_-]*date/i],
    appointment_time: [/^appointment[\s_-]*time/i, /^appt[\s_-]*time/i, /^scheduled[\s_-]*time/i, /^visit[\s_-]*time/i],
    appointment_type: [/^appointment[\s_-]*type/i, /^appt[\s_-]*type/i, /^visit[\s_-]*type/i, /^service[\s_-]*type/i, /^tipo[\s_-]*cita/i],
    lead_source: [/^lead[\s_-]*source/i, /^source$/i, /^how[\s_-]*did/i, /^referral[\s_-]*source/i, /^origen/i, /^fuente/i],
    lead_status: [/^lead[\s_-]*status/i, /^lead[\s_-]*stage/i, /^pipeline[\s_-]*stage/i, /^etapa/i],
    deal_value: [/^deal[\s_-]*value/i, /^deal[\s_-]*amount/i, /^opportunity[\s_-]*value/i, /^potential[\s_-]*value/i],
    product_interest: [/^product[\s_-]*interest/i, /^interested[\s_-]*in/i, /^producto/i],
    notes: [/^notes?$/i, /^comments?$/i, /^description$/i, /^notas/i, /^observaciones/i, /^remarks/i],
    tags: [/^tags?$/i, /^labels?$/i, /^categories?$/i, /^etiquetas/i],
    priority: [/^priority$/i, /^urgency$/i, /^prioridad$/i],
    language: [/^language$/i, /^idioma$/i, /^preferred[\s_-]*language/i],
    timezone: [/^timezone$/i, /^time[\s_-]*zone/i, /^zona[\s_-]*horaria/i],
    external_id: [/^external[\s_-]*id/i, /^ext[\s_-]*id/i, /^crm[\s_-]*id/i, /^ref[\s_-]*(id|number)/i],
  };

  const mappedHeaders = new Set<string>();

  // First pass: map core fields
  headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().trim();
    for (const [field, fieldPatterns] of Object.entries(corePatterns)) {
      if ((mapping as unknown as Record<string, unknown>)[field] === null) {
        for (const pattern of fieldPatterns) {
          if (pattern.test(normalizedHeader)) {
            (mapping as unknown as Record<string, unknown>)[field] = header;
            mappedHeaders.add(header);
            break;
          }
        }
      }
    }
  });

  // Second pass: map known extra fields
  headers.forEach((header) => {
    if (mappedHeaders.has(header)) return;
    const normalizedHeader = header.toLowerCase().trim();
    for (const [fieldName, fieldPatterns] of Object.entries(knownExtraPatterns)) {
      for (const pattern of fieldPatterns) {
        if (pattern.test(normalizedHeader)) {
          mapping.extraFields![fieldName] = header;
          mappedHeaders.add(header);
          return;
        }
      }
    }
  });

  // Third pass: auto-capture ALL remaining unmapped columns as custom fields
  // Ensures no data is lost from any CSV/JSON with extra columns
  headers.forEach((header) => {
    if (mappedHeaders.has(header)) return;
    const trimmed = header.trim();
    if (!trimmed) return;
    const fieldName = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (fieldName) {
      mapping.extraFields![fieldName] = header;
    }
  });

  return mapping;
}

export function normalizePhoneNumber(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }

  if (digitsOnly.length > 10) {
    return `+${digitsOnly}`;
  }

  return phone;
}

export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  const phoneRegex = /^\+\d{7,15}$/;
  return phoneRegex.test(normalized);
}

export function mapRowToContact(
  row: string[],
  headers: string[],
  mapping: ColumnMapping
): Omit<Contact, 'id' | 'created_at' | 'updated_at'> | null {
  const getValue = (field: string | null): string => {
    if (!field) return '';
    const index = headers.indexOf(field);
    return index >= 0 && row[index] ? row[index].trim() : '';
  };

  const phoneRaw = getValue(mapping.phoneNumber);
  if (!phoneRaw) return null;

  const phoneNormalized = normalizePhoneNumber(phoneRaw);
  if (!isValidPhoneNumber(phoneNormalized)) return null;

  // Build contact_name from firstName + lastName or use contactName
  const firstName = getValue(mapping.firstName);
  const lastName = getValue(mapping.lastName);
  const fullContactName = getValue(mapping.contactName);

  let contactName = null;
  if (firstName || lastName) {
    contactName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
  } else if (fullContactName) {
    contactName = fullContactName;
  }

  // Build custom_fields from extraFields mapping
  const customFields: Record<string, unknown> = {};
  if (mapping.extraFields) {
    for (const [fieldName, headerName] of Object.entries(mapping.extraFields)) {
      const value = getValue(headerName);
      if (value) {
        customFields[fieldName] = value;
      }
    }
  }

  // If notes field was captured in extraFields, move it to the notes column
  const notesValue = customFields.notes as string | undefined;
  if (notesValue) {
    delete customFields.notes;
  }

  // If tags field was captured, try to parse as array
  const tagsValue = customFields.tags as string | undefined;
  let parsedTags: string[] | null = null;
  if (tagsValue) {
    parsedTags = tagsValue.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
    delete customFields.tags;
  }

  return {
    company_id: '', // Will be set by caller
    company_name: getValue(mapping.companyName) || 'Unknown Company',
    address: getValue(mapping.address) || null,
    city: getValue(mapping.city) || null,
    state: getValue(mapping.state) || null,
    zip_code: getValue(mapping.zipCode) || null,
    phone_number: phoneNormalized,
    original_phone_number: phoneRaw,
    contact_name: contactName,
    email: getValue(mapping.email) || null,
    status: 'Pending',
    call_outcome: 'Not Called',
    last_call_date: null,
    call_attempts: 0,
    call_id: null,
    call_status: null,
    call_duration: null,
    recording_url: null,
    transcript_text: null,
    transcripts: null,
    analysis: null,
    call_metadata: null,
    notes: notesValue || null,
    is_test_call: false,
    tags: parsedTags,
    list_id: null,
    custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
    source: 'csv',
  };
}

export function generateCallTask(companyName: string, voiceConfig: VoiceConfig, companyContext?: string): string {
  const agentName = voiceConfig.agentName;
  
  const contextSection = companyContext 
    ? `\n\nIMPORTANT CONTEXT ABOUT YOUR COMPANY:\n${companyContext}\n\nUse this information naturally in your conversations when relevant.`
    : '';

  return `You are ${agentName}, a friendly and professional representative calling to verify business information for ${companyName}.${contextSection}

YOUR PRIMARY GOALS:
1. Verify or obtain the correct business address
2. Get the name of the owner, manager, or main contact
3. Obtain an email address for sending information

CONVERSATION APPROACH:
- Be warm, natural, and conversational
- Match the energy of the person you're speaking with
- Use their name once you learn it
- Be patient and never rush

INTRODUCTION:
"Hey, this is ${agentName} from ${companyName}. Can you hear me okay?"

After they confirm: "Perfect! I'm calling to quickly verify some information we have on file. This will only take about 30 seconds."

GATHER INFORMATION:
1. Address verification
2. Contact name
3. Email address

Be professional, helpful, and respectful at all times. If they ask to be removed from calls, comply immediately.`;
}

export function generateFirstSentence(voiceConfig: VoiceConfig, companyName: string): string {
  return `Hey, this is ${voiceConfig.agentName} from ${companyName}. Can you hear me okay?`;
}

export function generateVoicemailMessage(contactCompanyName: string, voiceConfig: VoiceConfig, userCompanyName: string): string {
  return `Hi, this is ${voiceConfig.agentName} from ${userCompanyName} calling for ${contactCompanyName}. Just calling to verify some business information. Please call back at your convenience. Thanks!`;
}

export function extractCallMetadata(callDetails: Record<string, unknown>): CallMetadata {
  return {
    price: (callDetails.price as number) || null,
    from: (callDetails.from as string) || null,
    to: (callDetails.to as string) || null,
    startedAt: (callDetails.started_at as string) || null,
    endedAt: (callDetails.end_at as string) || null,
    createdAt: (callDetails.created_at as string) || null,
    localDialing: (callDetails.local_dialing as boolean) || false,
    queueStatus: (callDetails.queue_status as string) || null,
    maxDuration: (callDetails.max_duration as number) || null,
    correctedDuration: (callDetails.corrected_duration as number) || null,
    batchId: (callDetails.batch_id as string) || null,
    summary: (callDetails.summary as string) || null,
    errorMessage: (callDetails.error_message as string) || null,
    answeredBy: (callDetails.answered_by as CallMetadata['answeredBy']) || null,
    model: (callDetails.model as string) || null,
    language: (callDetails.language as string) || null,
    voicemailDetected: callDetails.answered_by === 'voicemail',
  };
}

export function determineContactStatus(
  analysis: CallAnalysis,
  callDetails: { answered_by: string | null; status: string; error_message: string | null }
): { status: ContactStatus; outcome: CallOutcome } {
  if (callDetails.answered_by === 'voicemail') {
    return { status: 'Voicemail Left', outcome: 'Left Voicemail' };
  }

  if (callDetails.status === 'no_answer' || callDetails.status === 'busy') {
    return { status: 'No Answer', outcome: 'Follow-up Scheduled' };
  }

  if (callDetails.error_message) {
    const errorLower = callDetails.error_message.toLowerCase();
    if (errorLower.includes('invalid') || errorLower.includes('disconnected')) {
      return { status: 'Number Disconnected', outcome: 'Disconnected' };
    }
  }

  const notes = analysis.outcomeNotes?.toLowerCase() || '';

  if (notes.includes('wrong number')) {
    return { status: 'Wrong Number', outcome: 'Wrong Number' };
  }

  if (notes.includes('hung up') || notes.includes('refused')) {
    return { status: 'Withheld & Hung Up', outcome: 'Refused' };
  }

  const hasEmail = analysis.verifiedEmail !== null;
  const hasContact = analysis.contactName !== null;
  const hasAddress = analysis.verifiedAddress !== null;

  if (hasEmail && (hasContact || hasAddress)) {
    return { status: 'Fully Verified', outcome: hasContact ? 'Owner Gave Email' : 'Staff Gave Email' };
  }

  if (hasEmail || hasContact || hasAddress) {
    return { status: 'Research Needed', outcome: 'Incomplete Data Shared' };
  }

  return { status: 'For Callback', outcome: 'Follow-up Scheduled' };
}

export function calculateDashboardStats(contacts: Contact[]): DashboardStats {
  const completedCalls = contacts.filter((c) => c.call_duration && c.call_duration > 0);
  const totalCallDuration = completedCalls.reduce((acc, c) => acc + (c.call_duration || 0), 0);
  
  const totalCost = contacts.reduce((acc, c) => {
    const metadata = c.call_metadata as CallMetadata | null;
    return acc + (metadata?.price || 0);
  }, 0);
  
  const verifiedCount = contacts.filter((c) => c.status === 'Fully Verified').length;
  const attemptedCalls = contacts.filter((c) => c.call_attempts > 0).length;

  return {
    total: contacts.length,
    pending: contacts.filter((c) => c.status === 'Pending').length,
    calling: contacts.filter((c) => c.status === 'Calling').length,
    verified: verifiedCount,
    research: contacts.filter((c) => c.status === 'Research Needed').length,
    noAnswer: contacts.filter((c) => c.status === 'No Answer').length,
    invalid: contacts.filter((c) => c.status === 'Wrong Number' || c.status === 'Number Disconnected').length,
    voicemail: contacts.filter((c) => c.status === 'Voicemail Left').length,
    callback: contacts.filter((c) => c.status === 'For Callback').length,
    testCalls: contacts.filter((c) => c.is_test_call).length,
    totalCallDuration,
    totalCost,
    successRate: attemptedCalls > 0 ? Math.round((verifiedCount / attemptedCalls) * 100) : 0,
    avgCallDuration: completedCalls.length > 0 ? Math.round(totalCallDuration / completedCalls.length) : 0,
  };
}

export function contactsToCSV(contacts: Contact[]): string {
  const headers = [
    'Company Name', 'Address', 'City', 'State', 'Zip Code', 'Phone Number',
    'Contact Name', 'Email', 'Status', 'Call Outcome', 'Last Call Date',
    'Call Attempts', 'Call Duration', 'Notes'
  ];

  const escapeCSV = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = contacts.map((contact) => [
    escapeCSV(contact.company_name),
    escapeCSV(contact.address),
    escapeCSV(contact.city),
    escapeCSV(contact.state),
    escapeCSV(contact.zip_code),
    escapeCSV(contact.phone_number),
    escapeCSV(contact.contact_name),
    escapeCSV(contact.email),
    escapeCSV(contact.status),
    escapeCSV(contact.call_outcome),
    escapeCSV(contact.last_call_date),
    escapeCSV(String(contact.call_attempts)),
    escapeCSV(contact.call_duration ? String(contact.call_duration) : ''),
    escapeCSV(contact.notes),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phone;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `$${amount.toFixed(4)}`;
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

export function getStatusColor(status: ContactStatus): string {
  const colors: Record<ContactStatus, string> = {
    'Pending': 'bg-slate-100 text-slate-700 border-slate-200',
    'Calling': 'bg-blue-100 text-blue-700 border-blue-200',
    'Fully Verified': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'Research Needed': 'bg-amber-100 text-amber-700 border-amber-200',
    'No Answer': 'bg-orange-100 text-orange-700 border-orange-200',
    'For Callback': 'bg-violet-100 text-violet-700 border-violet-200',
    'Wrong Number': 'bg-red-100 text-red-700 border-red-200',
    'Number Disconnected': 'bg-red-100 text-red-700 border-red-200',
    'Withheld & Hung Up': 'bg-rose-100 text-rose-700 border-rose-200',
    'Voicemail Left': 'bg-violet-100 text-violet-700 border-violet-200',
  };
  return colors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function getSentimentColor(sentiment: string | undefined): string {
  switch (sentiment) {
    case 'positive':
      return 'text-emerald-600 bg-emerald-50';
    case 'negative':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-slate-600 bg-slate-50';
  }
}

export function getInterestLevelColor(level: string | undefined): string {
  switch (level) {
    case 'high':
      return 'text-emerald-600 bg-emerald-50';
    case 'medium':
      return 'text-blue-600 bg-blue-50';
    case 'low':
      return 'text-amber-600 bg-amber-50';
    case 'none':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-slate-600 bg-slate-50';
  }
}