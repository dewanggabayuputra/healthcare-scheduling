export function restoreDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid cached date: ${value}`);
  }

  return date;
}
