/** Gabungkan class CSS secara aman (tanpa dependensi eksternal). */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
