---
tags: [integration, voice, catalog, reference]
aliases: [Voices, Voice Library, Voice Selection]
---

# Voice Catalog

Callengo ships with a curated catalog of **51 AI voices** powered by [[Bland AI]]. The catalog was manually audited in March 2026 — each voice was listened to, evaluated, and labeled with age, tone, characteristics, and recommended use cases.

For the complete reference with every voice listed, see `docs/VOICES.md`.

## Catalog Summary

| Metric | Value |
|--------|-------|
| **Total voices** | 51 |
| **Languages** | 2 (English, Spanish) |
| **Accents** | 5 |
| **Countries** | 5 (USA, UK, Australia, Spain, Latin America) |
| **Gender split** | 13 male, 38 female |
| **Age groups** | 17 young, 26 adult, 8 mature |

## Accent Distribution

| Accent | Flag | Count | Male | Female |
|--------|------|-------|------|--------|
| American English | 🇺🇸 | 18 | 4 | 14 |
| British English | 🇬🇧 | 25 | 7 | 18 |
| Australian English | 🇦🇺 | 5 | 2 | 3 |
| European Spanish (Spain) | 🇪🇸 | 1 | 0 | 1 |
| Mexican Spanish | 🇲🇽 | 2 | 0 | 2 |

## Voice Profile System

Every voice has a **profile** stored in `src/lib/voices/voice-utils.ts` (`VOICE_PROFILES` map) with three dimensions:

### Age
- **Young** — Energetic, modern tone (e.g., Freddie, David, Trixie)
- **Adult** — Balanced, professional presence (e.g., Max, Harper, Willow)
- **Mature** — Seasoned, authoritative warmth (e.g., Keelan, Emily, Lucy)

### Characteristics
Tags describing the voice's personality: Professional, Warm, Energetic, Calm, Friendly, Serious, Direct, Deep, Fast, Slow, Cheerful, Motherly, Narrator, Charismatic, Elegant, Soft, Authoritative, Engaging, Formal.

### Best For (Use Cases)
Each voice is tagged with its ideal scenarios:
- **Lead Qualification** — Persuasive, confident, energetic voices
- **Appointments** — Warm, friendly, reassuring voices
- **Data Validation** — Clear, professional, authoritative voices
- **Customer Support** — Patient, warm, guiding voices
- **Sales** — Charismatic, dynamic, high-energy voices
- **General** — Versatile voices that work across scenarios

## Voice Selection UI

The voice selection modal (`src/components/voice/VoiceSelectionModal.tsx`) offers two modes:

### Top Picks
Curated recommendations organized by accent (American, British, Australian, Spanish Europe, Spanish Latam). Shows the user's favorites section if they've saved any.

### Explore All
Full catalog with **7 filters**: Gender, Age, Language, Accent, Country, Style, and Best For. Each voice card displays the name, accent, gender badge (♀/♂), age badge, characteristic tags, and "Best For" tags.

## Where Voices Appear

- **[[Agent]] Configuration Modal** — Voice selector (required field)
- **Campaign Wizard** — Voice step during campaign creation
- **[[Company]] Settings** — Default voice for new agents (`company_settings.default_voice`)
- **[[User]] Favorites** — `users.fav_voices` JSONB array

## Voice Sample Playback & Caching

Voice samples use [[Bland AI]]'s `/v1/speak` TTS endpoint (per-character billing). Samples are cached globally in **Supabase Storage** (`voice-samples` bucket) — each voice is generated once, then served free forever.

- **Max cost:** ~$1.28 total (51 voices x 250 chars, one-time)
- **Rate limit:** 51 generations per company
- **Cost tracking:** `tts_usage_logs` table → visible in [[Command Center]] → Finances tab
- **Implementation:** `src/lib/bland/tts.ts`

## Technical Files

| File | Purpose |
|------|---------|
| `src/lib/voices/bland-voices.ts` | Static catalog (51 entries) |
| `src/lib/voices/types.ts` | TypeScript types (`BlandVoice`, `VoiceAge`, `VoiceCharacteristic`, `VoiceUseCase`, `VoiceProfile`) |
| `src/lib/voices/voice-utils.ts` | Profile database, gender/category detection, recommended voices, `VOICE_CATALOG_STATS` |
| `src/lib/bland/tts.ts` | TTS generation via /v1/speak, caching, rate limiting, cost logging |
| `src/app/api/voices/sample/route.ts` | API route with cache-first strategy |
| `src/app/api/admin/tts-usage/route.ts` | Admin endpoint for TTS cost data |
| `src/components/voice/VoiceSelector.tsx` | Button that opens the modal |
| `src/components/voice/VoiceSelectionModal.tsx` | Full selection modal |

## Gender & Category Corrections

| Voice | Old Label | Corrected | Reason |
|-------|-----------|-----------|--------|
| Henry | British Male | British **Female** | Voice is clearly female |
| Elena | Spanish (Spain) | **Latin American** Spanish | Uses seseo, Latin American accent |

## Removed Voices (March 2026)

8 voices were removed during the audit: Jen, Tina, Walter, Sammie, Margot, Evelyn (audio not playing), Dorothy (poor quality), Derek (extremely slow).

## Related Notes

- [[Bland AI]] — Voice provider architecture and API
- [[Agent]] — Voice selection in agent configuration
- [[Company]] — Default voice settings
- [[User]] — Favorite voices
- [[Campaign]] — Voice configuration in campaign wizard
