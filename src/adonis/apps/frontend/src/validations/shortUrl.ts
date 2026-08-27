const ALIAS_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const validateLongUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "URL is required";
  }
  try {
    new URL(trimmed);
    return null;
  } catch {
    return "Invalid URL";
  }
};

export const validateAlias = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 64) {
    return "Alias is too long";
  }
  if (!ALIAS_PATTERN.test(trimmed)) {
    return "Alias may only contain letters, numbers, hyphens, and underscores";
  }
  return null;
};
