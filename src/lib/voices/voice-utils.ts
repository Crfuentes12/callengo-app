// lib/voices/voice-utils.ts

import { BlandVoice, VoiceCategory } from './types';
import { BLAND_VOICES } from './bland-voices';

// Helper to determine gender from tags and description
export function determineGender(voice: BlandVoice): 'male' | 'female' | 'unknown' {
  const tags = voice.tags.map(t => t.toLowerCase());
  const description = (voice.description || '').toLowerCase();
  const name = voice.name.toLowerCase();

  if (tags.includes('male') || description.includes(' male')) return 'male';
  if (tags.includes('female') || description.includes('female')) return 'female';

  // Check description for gender indicators
  if (description.includes('woman') || description.includes('women')) return 'female';
  if (description.includes(' man ') || description.includes('gentleman')) return 'male';

  return 'unknown';
}

// Helper to determine language/accent from tags
export function determineCategory(voice: BlandVoice): { language: string; accent: string; country: string } {
  const tags = voice.tags.map(t => t.toLowerCase());
  const description = (voice.description || '').toLowerCase();

  // British English
  if (tags.includes('british') || description.includes('british')) {
    return { language: 'English', accent: 'British', country: 'UK' };
  }

  // Australian English
  if (tags.includes('australian') || description.includes('australian')) {
    return { language: 'English', accent: 'Australian', country: 'Australia' };
  }

  // American English
  if (tags.includes('american') || tags.includes('english') || description.includes('american')) {
    return { language: 'English', accent: 'American', country: 'USA' };
  }

  // Spanish
  if (tags.includes('spanish') || description.includes('spanish')) {
    return { language: 'Spanish', accent: 'Spanish', country: 'Spain' };
  }

  // French
  if (tags.includes('french') || description.includes('french')) {
    return { language: 'French', accent: 'French', country: 'France' };
  }

  // German
  if (tags.includes('german') || description.includes('german')) {
    return { language: 'German', accent: 'German', country: 'Germany' };
  }

  // Italian
  if (tags.includes('italian') || description.includes('italian')) {
    return { language: 'Italian', accent: 'Italian', country: 'Italy' };
  }

  // Dutch
  if (tags.includes('dutch') || description.includes('dutch')) {
    return { language: 'Dutch', accent: 'Dutch', country: 'Netherlands' };
  }

  // Filipino/Philippines
  if (tags.includes('filipino') || tags.includes('phillipines') || description.includes('filipino') || description.includes('philippines')) {
    return { language: 'English', accent: 'Filipino', country: 'Philippines' };
  }

  // Indian
  if (tags.includes('indian') || description.includes('indian')) {
    return { language: 'English', accent: 'Indian', country: 'India' };
  }

  // South African
  if (tags.includes('south_african') || tags.includes('south african') || description.includes('south african')) {
    return { language: 'English', accent: 'South African', country: 'South Africa' };
  }

  // Default to English American
  return { language: 'English', accent: 'American', country: 'USA' };
}

// Get curated voices - one male and one female per language/accent
export function getCuratedVoices(): VoiceCategory[] {
  const categories: Map<string, VoiceCategory> = new Map();

  // Only use high-rated voices for curation
  const qualityVoices = BLAND_VOICES.filter(v =>
    v.average_rating >= 4 &&
    v.total_ratings >= 4 &&
    v.description !== null
  );

  qualityVoices.forEach(voice => {
    const gender = determineGender(voice);
    if (gender === 'unknown') return;

    const category = determineCategory(voice);
    const key = `${category.language}-${category.accent}`;

    if (!categories.has(key)) {
      categories.set(key, {
        language: category.language,
        accent: category.accent,
        country: category.country,
        voices: {
          male: [],
          female: []
        }
      });
    }

    const cat = categories.get(key)!;

    // Only add if we don't have one yet, or if this one has better rating
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

  // Sort by language name
  return Array.from(categories.values()).sort((a, b) => {
    // Prioritize English
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
  }).sort((a, b) => {
    // Sort by rating
    return b.average_rating - a.average_rating;
  });
}

// Generate sample text for a voice based on language
export function getSampleText(voice: BlandVoice): string {
  const category = determineCategory(voice);
  const voiceName = voice.name.replace(/-/g, ' ');

  switch (category.language) {
    case 'Spanish':
      return `Hola, ¿cómo estás? Soy ${voiceName} de Callengo.`;
    case 'French':
      return `Bonjour, comment allez-vous? Je suis ${voiceName} de Callengo.`;
    case 'German':
      return `Hallo, wie geht es dir? Ich bin ${voiceName} von Callengo.`;
    case 'Italian':
      return `Ciao, come stai? Sono ${voiceName} da Callengo.`;
    case 'Dutch':
      return `Hallo, hoe gaat het? Ik ben ${voiceName} van Callengo.`;
    default:
      return `Hello, how are you? I'm ${voiceName} from Callengo.`;
  }
}

// Get language code for Bland AI API
export function getLanguageCode(voice: BlandVoice): string {
  const category = determineCategory(voice);

  switch (category.language) {
    case 'Spanish':
      return 'ESP';
    case 'French':
      return 'FRE';
    case 'German':
      return 'GER';
    case 'Italian':
      return 'ITA';
    case 'Dutch':
      return 'DUT';
    default:
      return 'ENG';
  }
}

// Search voices
export function searchVoices(query: string): BlandVoice[] {
  const lowerQuery = query.toLowerCase();
  return BLAND_VOICES.filter(voice => {
    return (
      voice.name.toLowerCase().includes(lowerQuery) ||
      (voice.description || '').toLowerCase().includes(lowerQuery) ||
      voice.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  });
}
