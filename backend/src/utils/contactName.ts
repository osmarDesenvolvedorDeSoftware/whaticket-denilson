export const isInvalidContactName = (name?: string | null): boolean => {
  if (!name) return true;
  const trimmed = String(name).trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  if (lower.includes("@lid")) return true;

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly && digitsOnly.length === trimmed.length) return true;
  if (digitsOnly.length >= 16 && trimmed.indexOf(" ") === -1) return true;

  return false;
};

type ResolveNameInput = {
  pushName?: string | null;
  integrationName?: string | null;
  profileName?: string | null;
  number?: string | null;
};

export const resolveBestContactName = ({
  pushName,
  integrationName,
  profileName,
  number
}: ResolveNameInput): string => {
  const candidates = [pushName, integrationName, profileName]
    .map(value => (value ? String(value).trim() : ""))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!isInvalidContactName(candidate)) return candidate;
  }

  const fallbackNumber = number ? String(number).replace(/\D/g, "") : "";
  return fallbackNumber ? `Contato ${fallbackNumber}` : "Contato";
};
