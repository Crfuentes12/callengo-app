// types/call-agent.ts
export type ContactStatus =
  | 'Pending'
  | 'Calling'
  | 'Fully Verified'
  | 'Research Needed'
  | 'No Answer'
  | 'For Callback'
  | 'Wrong Number'
  | 'Number Disconnected'
  | 'Withheld & Hung Up'
  | 'Voicemail Left';

export type CallOutcome =
  | 'Not Called'
  | 'Owner Gave Email'
  | 'Staff Gave Email'
  | 'Incomplete Data Shared'
  | 'Refused'
  | 'Left Voicemail'
  | 'Follow-up Scheduled'
  | 'Wrong Number'
  | 'Disconnected';

export type CallStatus =
  | 'pending'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'voicemail'
  | 'busy';

export type VoiceId = 'maya' | 'josh' | 'matt' | 'nat';

export type CallSentiment = 'positive' | 'neutral' | 'negative';

export type CustomerInterestLevel = 'high' | 'medium' | 'low' | 'none';

export type CallCategory = 
  | 'successful' 
  | 'partial' 
  | 'callback_needed' 
  | 'wrong_number' 
  | 'not_interested' 
  | 'voicemail' 
  | 'no_answer';

export interface VoiceConfig {
  id: VoiceId;
  name: string;
  agentName: string;
  gender: 'male' | 'female';
}

export interface TranscriptEntry {
  id: number;
  created_at: string;
  text: string;
  user: 'user' | 'assistant';
}

export interface CallAnalysis {
  verifiedAddress: string | null;
  contactName: string | null;
  verifiedEmail: string | null;
  businessConfirmed: boolean;
  outcomeNotes: string | null;
  callSentiment?: CallSentiment;
  customerInterestLevel?: CustomerInterestLevel;
  callCategory?: CallCategory;
  keyPoints?: string[];
  followUpRequired?: boolean;
  followUpReason?: string | null;
}

export interface CallMetadata {
  price: number | null;
  from: string | null;
  to: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string | null;
  localDialing: boolean;
  queueStatus: string | null;
  maxDuration: number | null;
  correctedDuration: number | null;
  batchId: string | null;
  summary: string | null;
  errorMessage: string | null;
  answeredBy: 'human' | 'voicemail' | 'unknown' | null;
  model: string | null;
  language: string | null;
  voicemailDetected: boolean;
}

export interface Contact {
  id: string;
  company_id: string;
  company_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone_number: string;
  original_phone_number: string | null;
  contact_name: string | null;
  email: string | null;
  status: ContactStatus;
  call_outcome: CallOutcome;
  last_call_date: string | null;
  call_attempts: number;
  call_id: string | null;
  call_status: CallStatus | null;
  call_duration: number | null;
  recording_url: string | null;
  transcript_text: string | null;
  transcripts: TranscriptEntry[] | null;
  analysis: CallAnalysis | null;
  call_metadata: CallMetadata | null;
  notes: string | null;
  is_test_call: boolean;
  tags: string[] | null;
  list_id: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ColumnMapping {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  contactName: string | null; // For backward compatibility and full name imports
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phoneNumber: string | null;
  email: string | null;
}

export interface DashboardStats {
  total: number;
  pending: number;
  calling: number;
  verified: number;
  research: number;
  noAnswer: number;
  invalid: number;
  voicemail: number;
  callback: number;
  testCalls: number;
  totalCallDuration: number;
  totalCost: number;
  successRate: number;
  avgCallDuration: number;
}