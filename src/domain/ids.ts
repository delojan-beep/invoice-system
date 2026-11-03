const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects anything else in a uuid column, so an id from a URL gets checked first. */
export function isUuid(value: string) {
  return UUID.test(value);
}
