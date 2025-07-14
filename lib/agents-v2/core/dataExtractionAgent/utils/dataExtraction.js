/**
 * Data Extraction Utilities
 * 
 * Functions for extracting data from API responses using configured paths
 */

/**
 * Extract data from response using the configured response path
 */
export function extractDataFromResponse(data, responseConfig) {
  if (!responseConfig?.responseDataPath) {
    return data;
  }
  
  return extractDataByPath(data, responseConfig.responseDataPath);
}

/**
 * Extract data using a dot-notation path
 */
export function extractDataByPath(data, path) {
  if (!path || !data) return data;
  
  const keys = path.split('.');
  let result = data;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return null;
    }
  }
  
  return result;
} 