import YAML from 'yaml';

/**
 * Converts a JSON string to a YAML string.
 * @param jsonString - The JSON string to convert
 * @returns The YAML string representation
 */
export function jsonToYaml(jsonString: string): string {
  const data = JSON.parse(jsonString);
  return YAML.stringify(data, {
    lineWidth: 0,
    // CRITICAL: Disable YAML anchors/aliases for duplicate objects.
    // When enabled (default), the YAML library creates anchors (&anchor) for the first
    // occurrence of an object and aliases (*anchor) for subsequent identical objects.
    // This causes a serious bug: when parsed back, ALL aliases resolve to the SAME
    // JavaScript object instance, causing entity data corruption where multiple
    // entities share the same component data.
    aliasDuplicateObjects: false,
  });
}

/**
 * Converts a YAML string to a JSON string.
 * @param yamlString - The YAML string to convert
 * @returns The JSON string representation
 */
export function yamlToJson(yamlString: string): string {
  const data = YAML.parse(yamlString);
  return JSON.stringify(data);
}

/**
 * Checks if a file path has a YAML extension.
 * @param path - The file path to check
 * @returns true if the file has a .yaml or .yml extension
 */
export function isYamlFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml');
}

/**
 * Checks if a file path has a JSON extension.
 * @param path - The file path to check
 * @returns true if the file has a .json extension
 */
export function isJsonFile(path: string): boolean {
  return path.toLowerCase().endsWith('.json');
}
