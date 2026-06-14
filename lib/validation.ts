import { MAX_ITEMS } from './config';

export interface VotingInput {
  title: string;
  masterImage: string | null;
  items: { name: string; image: string | null }[];
}

export class ValidationError extends Error {}

/** Parse + validate a voting payload from a request body. Throws ValidationError. */
export function parseVotingInput(body: unknown): VotingInput {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Invalid body');
  }
  const b = body as Record<string, unknown>;

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (title.length === 0) throw new ValidationError('Title is required.');
  if (title.length > 200) throw new ValidationError('Title is too long.');

  const masterImage =
    typeof b.masterImage === 'string' && b.masterImage.length > 0
      ? b.masterImage
      : null;

  if (!Array.isArray(b.items)) throw new ValidationError('Items must be a list.');
  if (b.items.length > MAX_ITEMS) {
    throw new ValidationError(`Too many items (max ${MAX_ITEMS}).`);
  }

  const items = b.items.map((raw, idx) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new ValidationError(`Item ${idx + 1} is invalid.`);
    }
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (name.length === 0) {
      throw new ValidationError(`Item ${idx + 1} needs a name.`);
    }
    if (name.length > 200) {
      throw new ValidationError(`Item ${idx + 1} name is too long.`);
    }
    const image =
      typeof r.image === 'string' && r.image.length > 0 ? r.image : null;
    return { name, image };
  });

  return { title, masterImage, items };
}
