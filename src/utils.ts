export const sanitizeString = (name: string, doubleEscape = false) => {
  return name.replace(/"/g, doubleEscape ? '\\\\\\"' : '\\"').trim();
};
