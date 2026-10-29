/** Small helpers shared by the delivery/settings/users/account tests. */
export function formData(values: Record<string, string | boolean | number | (string | number)[] | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === false) continue;
    if (Array.isArray(value)) for (const v of value) fd.append(key, String(v));
    else fd.set(key, value === true ? "on" : String(value));
  }
  return fd;
}

export const words = (n: number, seed = "local") =>
  Array.from({ length: n }, (_, i) => `${seed}${i % 37} detail${(i * 7) % 53}`).join(" ");
