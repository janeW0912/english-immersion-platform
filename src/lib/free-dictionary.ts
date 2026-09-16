/** Types aligned with https://dictionaryapi.dev/ response (subset). */

export type DictionaryDefinition = {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
};

export type DictionaryMeaning = {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
};

export type DictionaryEntry = {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: DictionaryMeaning[];
  source: "free-dictionary-api.dev";
};

function pickAudio(phonetics: { audio?: string }[] | undefined): string | undefined {
  if (!phonetics?.length) return undefined;
  const withAudio = phonetics.find((p) => p.audio?.trim());
  return withAudio?.audio;
}

export function parseFreeDictionaryResponse(
  raw: unknown,
  requestedWord: string,
): DictionaryEntry | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0] as Record<string, unknown>;
  const word = typeof first.word === "string" ? first.word : requestedWord;
  const phonetic =
    typeof first.phonetic === "string"
      ? first.phonetic
      : Array.isArray(first.phonetics)
        ? (first.phonetics as { text?: string }[]).find((p) => p.text)?.text
        : undefined;
  const audioUrl = pickAudio(
    Array.isArray(first.phonetics)
      ? (first.phonetics as { audio?: string }[])
      : undefined,
  );

  const meaningsRaw = first.meanings;
  if (!Array.isArray(meaningsRaw)) return null;

  const meanings: DictionaryMeaning[] = meaningsRaw.map((m) => {
    const mr = m as Record<string, unknown>;
    const partOfSpeech =
      typeof mr.partOfSpeech === "string" ? mr.partOfSpeech : "—";
    const defs = Array.isArray(mr.definitions) ? mr.definitions : [];
    const definitions: DictionaryDefinition[] = defs.map((d) => {
      const dr = d as Record<string, unknown>;
      return {
        definition:
          typeof dr.definition === "string" ? dr.definition : String(dr.definition ?? ""),
        example: typeof dr.example === "string" ? dr.example : undefined,
        synonyms: Array.isArray(dr.synonyms)
          ? (dr.synonyms as string[]).slice(0, 8)
          : undefined,
        antonyms: Array.isArray(dr.antonyms)
          ? (dr.antonyms as string[]).slice(0, 6)
          : undefined,
      };
    });
    return { partOfSpeech, definitions };
  }).filter((m) => m.definitions.length > 0);

  if (!meanings.length) return null;

  return {
    word,
    phonetic,
    audioUrl,
    meanings,
    source: "free-dictionary-api.dev",
  };
}
