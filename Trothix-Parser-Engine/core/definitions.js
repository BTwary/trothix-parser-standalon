export function parseDefinitions(text) {
  const definitions = {};
  
  // NOTE: This is currently a stub. A robust definitions resolver would map 
  // e.g. "Tenant" -> "John Doe" and replace references in the text before regex.
  // For now, it only records existence of terms.
  
  const regex = /\((?:hereinafter referred to as |referred to as |the )?["']?([A-Z][a-zA-Z\s]+)["']?\)/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const term = match[1].trim();
    definitions[term] = true;
  }
  
  return definitions;
}
