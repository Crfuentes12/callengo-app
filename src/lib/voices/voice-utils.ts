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
  const name = voice.name.toLowerCase();

  // French accent speaking English (specific voices: Elsa, Pierre)
  if ((tags.includes('french') || description.includes('french')) && (tags.includes('english') || description.includes('accent'))) {
    return { language: 'English', accent: 'French', country: 'France' };
  }

  // German accent speaking English (specific voice: Karl)
  if ((tags.includes('german') || description.includes('german')) && tags.includes('english')) {
    return { language: 'English', accent: 'German', country: 'Germany' };
  }

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

// Generate sample text for a voice based on language and accent
export function getSampleText(voice: BlandVoice): string {
  const category = determineCategory(voice);
  const voiceName = voice.name.replace(/-/g, ' ');

  // Special greetings based on accent
  if (category.accent === 'Australian') {
    return `G'day, how are you? I'm ${voiceName} from Callengo. I'm here to handle your call just like a real person would. I can answer questions, collect important details, and make sure everything gets passed on properly. Take your time and tell me how I can help.`;
  }

  switch (category.language) {
    case 'Spanish':
      return `Hola, ¿cómo estás? Soy ${voiceName} de Callengo. Estoy aquí para atender tu llamada como lo haría una persona real. Puedo responder preguntas, recopilar detalles importantes y asegurarme de que todo se pase correctamente. Tómate tu tiempo y dime cómo puedo ayudarte.`;
    case 'French':
      return `Bonjour, comment allez-vous? Je suis ${voiceName} de Callengo. Je suis là pour gérer votre appel comme le ferait une vraie personne. Je peux répondre aux questions, collecter des détails importants et m'assurer que tout est transmis correctement. Prenez votre temps et dites-moi comment je peux vous aider.`;
    case 'German':
      return `Hallo, wie geht es dir? Ich bin ${voiceName} von Callengo. Ich bin hier, um Ihren Anruf wie eine echte Person zu bearbeiten. Ich kann Fragen beantworten, wichtige Details sammeln und sicherstellen, dass alles ordnungsgemäß weitergegeben wird. Nehmen Sie sich Zeit und sagen Sie mir, wie ich helfen kann.`;
    case 'Italian':
      return `Ciao, come stai? Sono ${voiceName} da Callengo. Sono qui per gestire la tua chiamata proprio come farebbe una persona reale. Posso rispondere a domande, raccogliere dettagli importanti e assicurarmi che tutto venga trasmesso correttamente. Prenditi il tuo tempo e dimmi come posso aiutarti.`;
    case 'Dutch':
      return `Hallo, hoe gaat het? Ik ben ${voiceName} van Callengo. Ik ben hier om uw oproep af te handelen zoals een echte persoon dat zou doen. Ik kan vragen beantwoorden, belangrijke details verzamelen en ervoor zorgen dat alles correct wordt doorgegeven. Neem de tijd en vertel me hoe ik kan helpen.`;
    default:
      // English default
      return `Hi, how are you? I'm ${voiceName} from Callengo. I'm here to handle your call just like a real person would. I can answer questions, collect important details, and make sure everything gets passed on properly. Take your time and tell me how I can help.`;
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

// Determine voice characteristics from description and tags
export function getVoiceCharacteristics(voice: BlandVoice): string[] {
  const characteristics: string[] = [];
  const desc = (voice.description || '').toLowerCase();
  const tags = voice.tags.map(t => t.toLowerCase());

  // Specific voice overrides based on IDs
  const specificCharacteristics: Record<string, string[]> = {
    '9497013c-c348-485b-9ede-9b6e246c9578': ['Young', 'Soft', 'Whispery'], // Emily
    '78982ab1-6a3f-4320-97f5-73bdb853f73d': ['Energetic', 'Cheerful', 'Friendly'], // Freddie
    'b93a4030-8391-4c54-a35a-7983a3e7a16a': ['Mature', 'Professional', 'Warm'], // Keelan
    '4f5222b2-230f-419b-b776-faa063392584': ['Young', 'Energetic', 'Professional'], // Trixie
    '78c8543e-e5fe-448e-8292-20a7b8c45247': ['Energetic', 'Positive', 'Friendly'], // Harper
  };

  if (specificCharacteristics[voice.id]) {
    return specificCharacteristics[voice.id];
  }

  // Professional
  if (desc.includes('professional') || tags.includes('professional')) {
    characteristics.push('Professional');
  }

  // Casual/Friendly
  if (desc.includes('casual') || desc.includes('friendly') || desc.includes('warm')) {
    characteristics.push('Friendly');
  }

  // Young
  if (desc.includes('young') || desc.includes('chirpy')) {
    characteristics.push('Young');
  }

  // Mature/Old
  if (desc.includes('mature') || desc.includes('middle-aged') || desc.includes('old')) {
    characteristics.push('Mature');
  }

  // Warm
  if (desc.includes('warm') || desc.includes('sweet') || desc.includes('kind') || tags.includes('warm')) {
    characteristics.push('Warm');
  }

  // Energetic/Excited
  if (desc.includes('energetic') || desc.includes('excited') || desc.includes('upbeat')) {
    characteristics.push('Energetic');
  }

  // Calm
  if (desc.includes('calm') || desc.includes('soft') || desc.includes('gentle') || desc.includes('relaxed') || tags.includes('calm') || tags.includes('soft')) {
    characteristics.push('Calm');
  }

  // Formal/Authoritative
  if (desc.includes('authoritative') || desc.includes('confident') || desc.includes('measured')) {
    characteristics.push('Formal');
  }

  // Engaging
  if (desc.includes('engaging') || desc.includes('conversational')) {
    characteristics.push('Engaging');
  }

  // Clear/Articulate
  if (desc.includes('clear') || desc.includes('articulate')) {
    characteristics.push('Clear');
  }

  return characteristics.length > 0 ? characteristics : ['Standard'];
}

// Get recommended voices for the 4 main categories
export function getRecommendedVoices(): {
  american: { female: BlandVoice[]; male: BlandVoice[] };
  british: { female: BlandVoice[]; male: BlandVoice[] };
  australian: { female: BlandVoice[]; male: BlandVoice[] };
  spanish: { female: BlandVoice[]; male: BlandVoice[] };
} {
  const recommended = {
    american: { female: [] as BlandVoice[], male: [] as BlandVoice[] },
    british: { female: [] as BlandVoice[], male: [] as BlandVoice[] },
    australian: { female: [] as BlandVoice[], male: [] as BlandVoice[] },
    spanish: { female: [] as BlandVoice[], male: [] as BlandVoice[] },
  };

  // American: Nat and Maya as main females
  const nat = BLAND_VOICES.find(v => v.id === '13843c96-ab9e-4938-baf3-ad53fcee541d');
  const maya = BLAND_VOICES.find(v => v.id === '2f9fdbc7-4bf2-4792-8a18-21ce3c93978f');
  if (nat) recommended.american.female.push(nat);
  if (maya) recommended.american.female.push(maya);

  // American males: Ryan and Matt
  const ryan = BLAND_VOICES.find(v => v.id === '37b3f1c8-a01e-4d70-b251-294733f08371');
  const matt = BLAND_VOICES.find(v => v.id === 'a3d43393-dacb-43d3-91d7-b4cb913a5908');
  if (ryan) recommended.american.male.push(ryan);
  if (matt) recommended.american.male.push(matt);

  // British: Alice and Willow for females (not Emily - too whispery)
  const alice = BLAND_VOICES.find(v => v.id === 'dac8fda9-5c55-45e5-b378-ebd311dbb311');
  const willow = BLAND_VOICES.find(v => v.id === 'bc97a31e-b0b8-49e5-bcb8-393fcc6a86ea');
  if (alice) recommended.british.female.push(alice);
  if (willow) recommended.british.female.push(willow);

  // British males: Max and Oscar
  const max = BLAND_VOICES.find(v => v.id === '013813f0-e96f-4c55-8c2c-b36a6d4d7916');
  const oscar = BLAND_VOICES.find(v => v.id === 'f97aa643-19b2-4a65-8677-b41839be72bc');
  if (max) recommended.british.male.push(max);
  if (oscar) recommended.british.male.push(oscar);

  // Australian: Lucy and Sophie for females
  const lucy = BLAND_VOICES.find(v => v.id === '88831b36-7c85-4879-b6b0-22c2ff9f59d7');
  const sophie = BLAND_VOICES.find(v => v.id === '857ed371-9b28-4006-99da-a28c41c6fa55');
  if (lucy) recommended.australian.female.push(lucy);
  if (sophie) recommended.australian.female.push(sophie);

  // Australian males: Liam and Dave
  const liam = BLAND_VOICES.find(v => v.id === '63092d46-e154-4e8b-96e9-de85245e82ab');
  const dave = BLAND_VOICES.find(v => v.id === '1c1ca816-f457-4dde-a12a-eaf19fb0b523');
  if (liam) recommended.australian.male.push(liam);
  if (dave) recommended.australian.male.push(dave);

  // Spanish: Rosa and Mariam for females (not Helena - too robotic)
  const rosa = BLAND_VOICES.find(v => v.id === 'ecf0f240-3a2a-4d9e-876a-d175108b2e42');
  const mariam = BLAND_VOICES.find(v => v.id === '6432587a-1454-4b3f-820a-7a2962124b7c');
  if (rosa) recommended.spanish.female.push(rosa);
  if (mariam) recommended.spanish.female.push(mariam);

  // Spanish males: Find males from the list (limited options)
  BLAND_VOICES.filter(v => {
    const category = determineCategory(v);
    const gender = determineGender(v);
    return category.language === 'Spanish' && gender === 'male';
  }).slice(0, 2).forEach(v => recommended.spanish.male.push(v));

  return recommended;
}
