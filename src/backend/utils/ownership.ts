import { InputError } from "./validate";

type Existsable = { exists(filter: Record<string, unknown>): PromiseLike<unknown> };

/** Keeps `id` only if that document belongs to this user; otherwise null.
 * Used for transactions so an offline entry that points at something since
 * deleted is still saved (just without the link) instead of being lost. */
export async function ownedOrNull(model: Existsable, userId: string, id: string | null): Promise<string | null> {
  if (!id) return null;
  return (await model.exists({ _id: id, userId })) ? id : null;
}

/** Same check, but rejects with a clear message (for things created online). */
export async function mustOwn(
  model: Existsable,
  userId: string,
  id: string | null,
  label: string,
): Promise<string | null> {
  if (!id) return null;
  if (!(await model.exists({ _id: id, userId }))) throw new InputError(`${label} not found`);
  return id;
}
