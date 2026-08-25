export const extractContactFrequency = (messageText) => {
  const match = messageText.match(
    /(?:CONTACT|MONITOR)\s+.+?\s+(?:ON\s+)?(\d{3}\.\d{1,3})(?:\s*MHZ)?/i,
  );
  if (match) {
    const freq = parseFloat(match[1]);
    if (freq >= 118.0 && freq <= 136.99) return freq;
  }

  const atMatch = messageText.match(/@(\d{3}\.\d{1,3})@/);
  if (atMatch) {
    const freq = parseFloat(atMatch[1]);
    return freq >= 118.0 && freq <= 136.99 ? freq : null;
  }

  return null;
};
