import * as leoProfanity from 'leo-profanity';

export function generateSlug(name: string): string {
  // Ensure the input is a string and trim whitespace
  if (typeof name !== 'string') {
    throw new Error('Input must be a string');
  }
  const sanitizedInput = name.trim();

  // Configure the profanity filter
  leoProfanity.loadDictionary('en'); // Ensure the dictionary is loaded

  // Replace accented characters with their unaccented counterparts
  const normalized = sanitizedInput
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  // Replace any non-alphanumeric characters (excluding '-') with a hyphen
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace invalid characters
    .replace(/^-+|-+$/g, ''); // Trim leading and trailing hyphens

  // Ensure the slug is not empty
  if (!slug) {
    throw new Error('Generated slug is empty');
  }

  // Split the slug into individual words
  const words = slug.split('-');

  // Check each word for inappropriate content
  words.forEach((word) => {
    if (leoProfanity.check(word)) {
      throw new Error(`The word "${word}" is inappropriate.`);
    }
  });

  return slug;
}
