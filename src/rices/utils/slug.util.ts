export function generateSlug(name: string): string {
  // Ensure the input is a string and trim whitespace
  if (typeof name !== 'string') {
    throw new Error('Input must be a string');
  }
  const sanitizedInput = name.trim();

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

  return slug;
}
