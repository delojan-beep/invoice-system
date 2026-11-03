/**
 * The code the next new employee will get, for showing on the form. The
 * database gives the real one on save (private.give_employee_code), using the
 * same rule: one above the highest E-number in use.
 */
export function nextEmployeeCode(codes: (string | null)[]) {
  const numbers = codes.map((code) => (code && /^E\d+$/.test(code) ? Number(code.slice(1)) : 0));
  return `E${String(Math.max(0, ...numbers) + 1).padStart(3, "0")}`;
}
