// lib/voices/voice-utils.ts

import { BlandVoice, VoiceCategory, VoiceAge, VoiceCharacteristic, VoiceUseCase, VoiceProfile } from './types';
import { BLAND_VOICES } from './bland-voices';

// ── Voice Profile Database ──────────────────────────────────────────
// Complete per-voice metadata based on manual audition (March 2026)
const VOICE_PROFILES: Record<string, VoiceProfile> = {
  // American English
  'ff2c405b-3dba-41e0-9261-bc8ee3f91f46': { age: 'young', characteristics: ['energetic', 'engaging', 'professional'], bestFor: ['lead-qualification', 'sales'] },          // David
  '78982ab1-6a3f-4320-97f5-73bdb853f73d': { age: 'young', characteristics: ['energetic', 'friendly', 'charismatic'], bestFor: ['lead-qualification', 'sales'] },             // Freddie
  'b93a4030-8391-4c54-a35a-7983a3e7a16a': { age: 'mature', characteristics: ['professional', 'warm', 'calm'], bestFor: ['data-validation', 'customer-support'] },            // Keelan
  'db93116d-b24b-48a6-863c-84afed20cac4': { age: 'mature', characteristics: ['warm', 'motherly', 'professional'], bestFor: ['appointment-confirmation', 'customer-support'] },// Maeve
  'bdcad772-f6a8-4b63-95ca-3bae0d92f87e': { age: 'young', characteristics: ['deep', 'fast', 'professional', 'direct'], bestFor: ['lead-qualification', 'sales'] },           // Chris
  '78c8543e-e5fe-448e-8292-20a7b8c45247': { age: 'adult', characteristics: ['energetic', 'friendly', 'fast'], bestFor: ['lead-qualification', 'sales'] },                    // Harper
  '5aff7b0c-92d7-4ce6-a502-39d33a401808': { age: 'young', characteristics: ['cheerful', 'soft', 'professional'], bestFor: ['appointment-confirmation', 'customer-support'] }, // Isabelle
  '6277266e-01eb-44c6-b965-438566ef7076': { age: 'young', characteristics: ['fast', 'direct', 'energetic'], bestFor: ['lead-qualification', 'data-validation'] },             // Alexandra
  'e54a409c-daa9-4ee6-a954-2d81dec3476b': { age: 'adult', characteristics: ['serious', 'calm', 'warm'], bestFor: ['data-validation', 'general'] },                           // Alena
  '35571497-da9d-414b-b1b9-b1e68ef41f97': { age: 'young', characteristics: ['warm', 'soft', 'fast'], bestFor: ['appointment-confirmation', 'customer-support'] },             // Paige
  '070f5aba-ce9d-4a15-ab68-5330695ed1d6': { age: 'young', characteristics: ['slow', 'soft', 'calm'], bestFor: ['appointment-confirmation', 'general'] },                      // Jane
  '37b3f1c8-a01e-4d70-b251-294733f08371': { age: 'adult', characteristics: ['deep', 'narrator', 'authoritative', 'engaging'], bestFor: ['data-validation', 'general'] },      // Ryan
  '90295ec4-f0fe-4783-ab33-8b997ddc3ae4': { age: 'adult', characteristics: ['serious', 'professional', 'authoritative'], bestFor: ['data-validation', 'general'] },           // Mason
  'e1f2a5a4-18e6-4dd6-8dfb-3c24e99d6a06': { age: 'young', characteristics: ['fast', 'energetic', 'direct'], bestFor: ['lead-qualification', 'sales'] },                      // Alexa
  '60fec350-03ff-48fa-9f31-c180f37b1a38': { age: 'adult', characteristics: ['fast', 'direct', 'energetic'], bestFor: ['data-validation', 'general'] },                        // June
  '13843c96-ab9e-4938-baf3-ad53fcee541d': { age: 'young', characteristics: ['professional', 'direct', 'calm'], bestFor: ['data-validation', 'lead-qualification'] },           // Nat
  '1d054475-3908-4f64-9158-9d3911fe9597': { age: 'adult', characteristics: ['warm', 'engaging', 'friendly'], bestFor: ['sales', 'general'] },                                 // Adriana
  '2f9fdbc7-4bf2-4792-8a18-21ce3c93978f': { age: 'young', characteristics: ['serious', 'professional', 'calm'], bestFor: ['data-validation', 'general'] },                    // Maya
  'aec18940-3d5a-4454-acd2-66f685e83b67': { age: 'adult', characteristics: ['slow', 'narrator', 'warm', 'calm'], bestFor: ['appointment-confirmation', 'general'] },          // Martha

  // British English
  '9497013c-c348-485b-9ede-9b6e246c9578': { age: 'young', characteristics: ['soft', 'calm', 'warm'], bestFor: ['appointment-confirmation', 'customer-support'] },              // Emily
  '013813f0-e96f-4c55-8c2c-b36a6d4d7916': { age: 'adult', characteristics: ['friendly', 'professional', 'serious'], bestFor: ['lead-qualification', 'general'] },              // Max
  '4f5222b2-230f-419b-b776-faa063392584': { age: 'young', characteristics: ['energetic', 'cheerful', 'warm'], bestFor: ['lead-qualification', 'sales'] },                       // Trixie
  '27bd6e08-1d57-4ba8-a290-dcd58bfe78f2': { age: 'adult', characteristics: ['serious', 'formal', 'calm'], bestFor: ['data-validation', 'general'] },                           // Violette
  'f380ad98-4ed6-4b9e-a0fa-37ba0ca9f558': { age: 'adult', characteristics: ['professional', 'direct', 'serious'], bestFor: ['data-validation', 'lead-qualification'] },         // Marnie
  'f97aa643-19b2-4a65-8677-b41839be72bc': { age: 'adult', characteristics: ['cheerful', 'friendly', 'professional'], bestFor: ['appointment-confirmation', 'sales'] },          // Oscar
  'ef8a4528-12f1-41d3-b9d9-c6a4a6d4a6df': { age: 'mature', characteristics: ['serious', 'professional', 'authoritative'], bestFor: ['data-validation', 'general'] },           // Henry (female)
  '035117be-dfb1-4f46-92d3-59255ac4d96b': { age: 'young', characteristics: ['serious', 'professional', 'fast'], bestFor: ['lead-qualification', 'data-validation'] },           // Heather
  '1c2e3ee2-9f5e-43e6-b128-a34b0af46b27': { age: 'adult', characteristics: ['cheerful', 'charismatic', 'professional'], bestFor: ['sales', 'lead-qualification'] },             // Lucas
  '8aca12e4-a938-413a-88eb-c756ae91655a': { age: 'adult', characteristics: ['calm', 'soft', 'professional'], bestFor: ['appointment-confirmation', 'customer-support'] },        // Sophie
  'd512400e-a3eb-4c01-9dfb-620be159cf91': { age: 'adult', characteristics: ['cheerful', 'energetic', 'professional'], bestFor: ['lead-qualification', 'sales'] },                // Casey
  '3f222e4d-2624-4bf7-849f-9841ce872015': { age: 'young', characteristics: ['cheerful', 'energetic', 'professional'], bestFor: ['lead-qualification', 'sales'] },                // Clara
  'bc97a31e-b0b8-49e5-bcb8-393fcc6a86ea': { age: 'adult', characteristics: ['deep', 'charismatic', 'elegant', 'professional'], bestFor: ['sales', 'general'] },                 // Willow
  '26b40c81-22af-4ff3-9821-2c8c6fd38c4d': { age: 'mature', characteristics: ['deep', 'slow', 'narrator', 'warm'], bestFor: ['appointment-confirmation', 'general'] },           // Ethan
  '31477d18-71c7-4ee0-b41f-d0714689536d': { age: 'adult', characteristics: ['serious', 'fast', 'direct'], bestFor: ['data-validation', 'lead-qualification'] },                 // Destiny
  '7b05d026-0d58-4d09-9887-dc45b4b12dcb': { age: 'adult', characteristics: ['professional', 'serious', 'calm'], bestFor: ['data-validation', 'general'] },                      // Alyssa
  '955a02fb-57e1-418c-865c-d9c7bf9b209a': { age: 'adult', characteristics: ['serious', 'formal', 'professional'], bestFor: ['data-validation', 'general'] },                    // Brady
  '77a066a7-0a91-4aa8-bf62-4745b00ff167': { age: 'adult', characteristics: ['fast', 'professional', 'serious'], bestFor: ['lead-qualification', 'data-validation'] },            // Pryce
  'be3bffbd-c1f1-49a0-8575-58073bfcf9c4': { age: 'adult', characteristics: ['warm', 'cheerful', 'engaging'], bestFor: ['appointment-confirmation', 'customer-support'] },       // Gabriella
  '922d6173-4567-480c-b9a0-bc7c421ad43d': { age: 'young', characteristics: ['warm', 'friendly', 'calm'], bestFor: ['appointment-confirmation', 'customer-support'] },            // Amelia
  'dac8fda9-5c55-45e5-b378-ebd311dbb311': { age: 'young', characteristics: ['serious', 'slow', 'professional', 'motherly'], bestFor: ['appointment-confirmation', 'general'] },  // Alice
  'd70c223b-c039-4f35-9e93-771b2ca481e1': { age: 'adult', characteristics: ['warm', 'motherly', 'friendly'], bestFor: ['appointment-confirmation', 'customer-support'] },       // Julia
  'a710fd26-0ed7-48e8-86b3-0d4e52d4f500': { age: 'young', characteristics: ['cheerful', 'slow', 'friendly'], bestFor: ['general', 'customer-support'] },                        // Rosalie
  'fd9c6765-a2ce-429a-abc7-00be9d1e3a92': { age: 'adult', characteristics: ['cheerful', 'friendly', 'warm'], bestFor: ['customer-support', 'general'] },                        // Tanner

  // Australian English
  '88831b36-7c85-4879-b6b0-22c2ff9f59d7': { age: 'mature', characteristics: ['serious', 'slow', 'professional', 'narrator'], bestFor: ['data-validation', 'general'] },         // Lucy
  '63092d46-e154-4e8b-96e9-de85245e82ab': { age: 'young', characteristics: ['cheerful', 'friendly', 'professional'], bestFor: ['lead-qualification', 'sales'] },                 // Liam
  '1c1ca816-f457-4dde-a12a-eaf19fb0b523': { age: 'adult', characteristics: ['fast', 'friendly', 'warm'], bestFor: ['lead-qualification', 'customer-support'] },                  // Dave
  '8d398d73-a3a6-472b-aad9-ce61b1563a23': { age: 'adult', characteristics: ['soft', 'warm', 'calm'], bestFor: ['appointment-confirmation', 'customer-support'] },                // Daisy
  '47c02104-7f23-4857-b1a8-e3e939d56642': { age: 'adult', characteristics: ['slow', 'professional', 'motherly'], bestFor: ['appointment-confirmation', 'general'] },             // Ruth

  // European Spanish
  'ecf0f240-3a2a-4d9e-876a-d175108b2e42': { age: 'adult', characteristics: ['warm', 'professional', 'friendly'], bestFor: ['appointment-confirmation', 'general'] },             // Rosa

  // Latin American Spanish
  '642bfa76-18da-4574-857d-4e1a7144db39': { age: 'young', characteristics: ['professional', 'calm', 'direct'], bestFor: ['data-validation', 'general'] },                        // Helena
  '6432587a-1454-4b3f-820a-7a2962124b7c': { age: 'young', characteristics: ['warm', 'cheerful', 'energetic', 'fast'], bestFor: ['lead-qualification', 'sales'] },                // Mariam
};

// ── Gender overrides (voices whose name doesn't match gender) ───────
const GENDER_OVERRIDES: Record<string, 'male' | 'female'> = {
  'ef8a4528-12f1-41d3-b9d9-c6a4a6d4a6df': 'female', // Henry — female voice despite male name
};

// Helper to determine gender from tags, description, and overrides
export function determineGender(voice: BlandVoice): 'male' | 'female' | 'unknown' {
  // Check overrides first
  if (GENDER_OVERRIDES[voice.id]) return GENDER_OVERRIDES[voice.id];

  const tags = voice.tags.map(t => t.toLowerCase());
  const description = (voice.description || '').toLowerCase();

  if (tags.includes('male') || description.includes(' male')) return 'male';
  if (tags.includes('female') || description.includes('female')) return 'female';
  if (description.includes('woman') || description.includes('women')) return 'female';
  if (description.includes(' man ') || description.includes('gentleman')) return 'male';

  return 'unknown';
}

// Helper to determine language/accent from tags
export function determineCategory(voice: BlandVoice): { language: string; accent: string; country: string } {
  const tags = voice.tags.map(t => t.toLowerCase());
  const description = (voice.description || '').toLowerCase();

  // Latin American Spanish (check before generic spanish)
  if (tags.includes('spanish-latam') || description.includes('latin')) {
    return { language: 'Spanish', accent: 'Latin American', country: 'Latin America' };
  }

  // European Spanish
  if (tags.includes('spanish-european') || description.includes('española')) {
    return { language: 'Spanish', accent: 'European', country: 'Spain' };
  }

  // Generic Spanish fallback (by voice ID for backward compatibility)
  if (tags.includes('spanish') || description.includes('spanish')) {
    if (voice.id === 'ecf0f240-3a2a-4d9e-876a-d175108b2e42') {
      return { language: 'Spanish', accent: 'European', country: 'Spain' };
    }
    if (voice.id === '6432587a-1454-4b3f-820a-7a2962124b7c' || voice.id === '642bfa76-18da-4574-857d-4e1a7144db39') {
      return { language: 'Spanish', accent: 'Latin American', country: 'Latin America' };
    }
    return { language: 'Spanish', accent: 'European', country: 'Spain' };
  }

  // British English
  if (tags.includes('british') || description.includes('british')) {
    return { language: 'English', accent: 'British', country: 'UK' };
  }

  // Australian English
  if (tags.includes('australian') || description.includes('australian')) {
    return { language: 'English', accent: 'Australian', country: 'Australia' };
  }

  // American English (default for english tags)
  if (tags.includes('american') || tags.includes('english') || description.includes('american')) {
    return { language: 'English', accent: 'American', country: 'USA' };
  }

  // Default to English American
  return { language: 'English', accent: 'American', country: 'USA' };
}

// Get voice profile (age, characteristics, bestFor)
export function getVoiceProfile(voice: BlandVoice): VoiceProfile {
  return VOICE_PROFILES[voice.id] || {
    age: 'adult',
    characteristics: ['professional'],
    bestFor: ['general'],
  };
}

// Get voice age label
export function getVoiceAge(voice: BlandVoice): VoiceAge {
  return getVoiceProfile(voice).age;
}

// Get best-for use cases
export function getVoiceBestFor(voice: BlandVoice): VoiceUseCase[] {
  return getVoiceProfile(voice).bestFor;
}

// Use case display labels
export const USE_CASE_LABELS: Record<VoiceUseCase, string> = {
  'lead-qualification': 'Lead Qualification',
  'appointment-confirmation': 'Appointments',
  'data-validation': 'Data Validation',
  'customer-support': 'Support',
  'sales': 'Sales',
  'general': 'General',
};

// Age display labels
export const AGE_LABELS: Record<VoiceAge, string> = {
  young: 'Young',
  adult: 'Adult',
  mature: 'Mature',
};

// Get curated voices - one male and one female per language/accent
export function getCuratedVoices(): VoiceCategory[] {
  const categories: Map<string, VoiceCategory> = new Map();

  BLAND_VOICES.forEach(voice => {
    const gender = determineGender(voice);
    if (gender === 'unknown') return;

    const category = determineCategory(voice);
    const key = `${category.language}-${category.accent}`;

    if (!categories.has(key)) {
      categories.set(key, {
        language: category.language,
        accent: category.accent,
        country: category.country,
        voices: { male: [], female: [] }
      });
    }

    const cat = categories.get(key)!;

    if (gender === 'male') {
      if (cat.voices.male.length === 0) {
        cat.voices.male.push(voice);
      } else if (voice.average_rating > cat.voices.male[0].average_rating) {
        cat.voices.male[0] = voice;
      }
    } else if (gender === 'female') {
      if (cat.voices.female.length === 0) {
        cat.voices.female.push(voice);
      } else if (voice.average_rating > cat.voices.female[0].average_rating) {
        cat.voices.female[0] = voice;
      }
    }
  });

  return Array.from(categories.values()).sort((a, b) => {
    if (a.language === 'English' && b.language !== 'English') return -1;
    if (a.language !== 'English' && b.language === 'English') return 1;
    return a.language.localeCompare(b.language);
  });
}

// Get all voices for a specific category
export function getVoicesByCategory(language: string, accent: string): BlandVoice[] {
  return BLAND_VOICES.filter(voice => {
    const category = determineCategory(voice);
    return category.language === language && category.accent === accent;
  }).sort((a, b) => b.average_rating - a.average_rating);
}

// Generate sample text for a voice based on language and accent
export function getSampleText(voice: BlandVoice): string {
  const category = determineCategory(voice);
  const voiceName = voice.name.replace(/-/g, ' ');

  if (category.accent === 'Australian') {
    return `G'day, how are you? I'm ${voiceName} from Callengo. I'm here to handle your call just like a real person would. I can answer questions, collect important details, and make sure everything gets passed on properly. Take your time and tell me how I can help.`;
  }

  switch (category.language) {
    case 'Spanish':
      return `Hola, ¿cómo estás? Soy ${voiceName} de Callengo. Estoy aquí para atender tu llamada como lo haría una persona real. Puedo responder preguntas, recopilar detalles importantes y asegurarme de que todo se pase correctamente. Tómate tu tiempo y dime cómo puedo ayudarte.`;
    default:
      return `Hi, how are you? I'm ${voiceName} from Callengo. I'm here to handle your call just like a real person would. I can answer questions, collect important details, and make sure everything gets passed on properly. Take your time and tell me how I can help.`;
  }
}

// Get language code for Bland AI API
export function getLanguageCode(voice: BlandVoice): string {
  const category = determineCategory(voice);
  switch (category.language) {
    case 'Spanish':
      return 'ESP';
    default:
      return 'ENG';
  }
}

// Search voices
export function searchVoices(query: string): BlandVoice[] {
  const lowerQuery = query.toLowerCase();
  return BLAND_VOICES.filter(voice => {
    const profile = getVoiceProfile(voice);
    return (
      voice.name.toLowerCase().includes(lowerQuery) ||
      (voice.description || '').toLowerCase().includes(lowerQuery) ||
      voice.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      profile.characteristics.some(c => c.includes(lowerQuery)) ||
      profile.bestFor.some(u => USE_CASE_LABELS[u].toLowerCase().includes(lowerQuery))
    );
  });
}

// Determine voice characteristics from the profile database
export function getVoiceCharacteristics(voice: BlandVoice): string[] {
  const profile = VOICE_PROFILES[voice.id];
  if (profile) {
    return profile.characteristics.map(c => c.charAt(0).toUpperCase() + c.slice(1));
  }

  // Fallback: derive from description/tags (for any future voices not yet profiled)
  const characteristics: string[] = [];
  const desc = (voice.description || '').toLowerCase();
  const tags = voice.tags.map(t => t.toLowerCase());

  if (desc.includes('professional') || tags.includes('professional')) characteristics.push('Professional');
  if (desc.includes('friendly') || desc.includes('warm')) characteristics.push('Friendly');
  if (desc.includes('young') || desc.includes('chirpy')) characteristics.push('Young');
  if (desc.includes('mature') || desc.includes('old')) characteristics.push('Mature');
  if (desc.includes('warm') || desc.includes('sweet') || tags.includes('warm')) characteristics.push('Warm');
  if (desc.includes('energetic') || desc.includes('excited')) characteristics.push('Energetic');
  if (desc.includes('calm') || desc.includes('soft') || desc.includes('gentle')) characteristics.push('Calm');
  if (desc.includes('engaging') || desc.includes('conversational')) characteristics.push('Engaging');

  return characteristics.length > 0 ? characteristics : ['Standard'];
}

// Get recommended voices for the 5 main categories
export function getRecommendedVoices(): {
  american: { female: BlandVoice[]; male: BlandVoice[] };
  british: { female: BlandVoice[]; male: BlandVoice[] };
  australian: { female: BlandVoice[]; male: BlandVoice[] };
  'spanish-europe': { female: BlandVoice[]; male: BlandVoice[] };
  'spanish-latam': { female: BlandVoice[]; male: BlandVoice[] };
} {
  const findVoice = (id: string) => BLAND_VOICES.find(v => v.id === id);

  return {
    american: {
      female: [findVoice('78982ab1-6a3f-4320-97f5-73bdb853f73d')!, findVoice('b93a4030-8391-4c54-a35a-7983a3e7a16a')!, findVoice('5aff7b0c-92d7-4ce6-a502-39d33a401808')!].filter(Boolean), // Freddie, Keelan, Isabelle
      male: [findVoice('ff2c405b-3dba-41e0-9261-bc8ee3f91f46')!, findVoice('37b3f1c8-a01e-4d70-b251-294733f08371')!, findVoice('bdcad772-f6a8-4b63-95ca-3bae0d92f87e')!].filter(Boolean),   // David, Ryan, Chris
    },
    british: {
      female: [findVoice('bc97a31e-b0b8-49e5-bcb8-393fcc6a86ea')!, findVoice('4f5222b2-230f-419b-b776-faa063392584')!, findVoice('f380ad98-4ed6-4b9e-a0fa-37ba0ca9f558')!].filter(Boolean), // Willow, Trixie, Marnie
      male: [findVoice('013813f0-e96f-4c55-8c2c-b36a6d4d7916')!, findVoice('f97aa643-19b2-4a65-8677-b41839be72bc')!, findVoice('1c2e3ee2-9f5e-43e6-b128-a34b0af46b27')!].filter(Boolean),   // Max, Oscar, Lucas
    },
    australian: {
      female: [findVoice('88831b36-7c85-4879-b6b0-22c2ff9f59d7')!, findVoice('8d398d73-a3a6-472b-aad9-ce61b1563a23')!].filter(Boolean), // Lucy, Daisy
      male: [findVoice('63092d46-e154-4e8b-96e9-de85245e82ab')!, findVoice('1c1ca816-f457-4dde-a12a-eaf19fb0b523')!].filter(Boolean),     // Liam, Dave
    },
    'spanish-europe': {
      female: [findVoice('ecf0f240-3a2a-4d9e-876a-d175108b2e42')!].filter(Boolean), // Rosa
      male: [],
    },
    'spanish-latam': {
      female: [findVoice('6432587a-1454-4b3f-820a-7a2962124b7c')!, findVoice('642bfa76-18da-4574-857d-4e1a7144db39')!].filter(Boolean), // Mariam, Helena
      male: [],
    },
  };
}

// ── Catalog Stats ───────────────────────────────────────────────────
export const VOICE_CATALOG_STATS = {
  totalVoices: 51,
  languages: 2,           // English, Spanish
  accents: 5,             // American, British, Australian, European Spanish, Latin American Spanish
  countries: 5,           // USA, UK, Australia, Spain, Latin America
  genders: { male: 13, female: 38 },
  ageGroups: { young: 17, adult: 26, mature: 8 },
} as const;
