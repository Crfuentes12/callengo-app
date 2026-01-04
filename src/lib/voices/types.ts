// lib/voices/types.ts

export interface BlandVoice {
  id: string;
  name: string;
  description: string | null;
  public: boolean;
  ratings: number;
  tags: string[];
  user_id: string | null;
  total_ratings: number;
  average_rating: number;
  consistency?: number;
  expressiveness?: number;
}

export interface VoiceCategory {
  language: string;
  accent: string;
  country: string;
  voices: {
    male: BlandVoice[];
    female: BlandVoice[];
  };
}

export interface VoiceSample {
  voiceId: string;
  audioUrl: string;
  loading: boolean;
  error: string | null;
}
