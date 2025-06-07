/**
 * DataExtractionAgent V2 - Modular Agent
 * 
 * Handles API data collection, field mapping, and taxonomy standardization.
 * Replaces apiHandlerAgent with direct processing and better error handling.
 * 
 * Exports: extractFromSource(source, processingInstructions, anthropic)
 */

/**
 * Extracts and standardizes data from an API source
 * @param {Object} source - The source object
 * @param {Object} processingInstructions - Instructions from SourceOrchestrator
 * @param {Object} anthropic - Anthropic client instance
 * @returns {Promise<Object>} - Extracted and standardized opportunities
 */
export async function extractFromSource(source, processingInstructions, anthropic) {
  // Input validation first - before accessing properties
  if (!source || !processingInstructions) {
    throw new Error('Source and processing instructions are required');
  }
  
  console.log(`[DataExtractionAgent] 🔄 Starting extraction for: ${source.name}`)
  
  const startTime = Date.now()
  
  try {
    
    // Step 1: Make API calls based on workflow type
    let rawData;
    if (processingInstructions.workflow === 'two_step_api') {
      rawData = await handleTwoStepApi(processingInstructions);
    } else {
      rawData = await handleSingleApi(processingInstructions);
    }
    
    // Step 2: Extract opportunities from raw API response
    const extractedOpportunities = await extractOpportunities(rawData, source, anthropic);
    
    // Step 3: Standardize fields and normalize taxonomies
    const standardizedOpportunities = extractedOpportunities.map(opportunity => 
      standardizeOpportunity(opportunity, source)
    );
    
    const executionTime = Math.max(1, Date.now() - startTime);
    console.log(`[DataExtractionAgent] ✅ Extraction completed in ${executionTime}ms`);
    
    return {
      opportunities: standardizedOpportunities,
      extractionMetrics: {
        totalFound: rawData.totalFound || extractedOpportunities.length,
        successfullyExtracted: standardizedOpportunities.length,
        workflow: processingInstructions.workflow,
        apiCalls: processingInstructions.workflow === 'two_step_api' ? 'multiple' : 'single'
      },
      executionTime
    };
    
  } catch (error) {
    console.error(`[DataExtractionAgent] ❌ Error extracting from source:`, error);
    throw error;
  }
}

/**
 * Handles single API call workflow
 */
async function handleSingleApi(processingInstructions) {
  console.log(`[DataExtractionAgent] 📡 Making single API call to: ${processingInstructions.apiEndpoint}`);
  
  const requestConfig = {
    method: processingInstructions.requestConfig.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...processingInstructions.requestConfig.headers
    }
  };
  
  // Add authentication if required
  if (processingInstructions.authMethod === 'bearer' && processingInstructions.authDetails.token) {
    requestConfig.headers.Authorization = `Bearer ${processingInstructions.authDetails.token}`;
  } else if (processingInstructions.authMethod === 'apikey' && processingInstructions.authDetails.apiKey) {
    const keyHeader = processingInstructions.authDetails.keyHeader || 'X-API-Key';
    requestConfig.headers[keyHeader] = processingInstructions.authDetails.apiKey;
  }
  
  // Add request body for POST/PUT requests
  if (processingInstructions.requestBody && ['POST', 'PUT'].includes(requestConfig.method)) {
    requestConfig.body = JSON.stringify(processingInstructions.requestBody);
  }
  
  // Build URL with query parameters
  const url = new URL(processingInstructions.apiEndpoint);
  if (processingInstructions.queryParameters) {
    Object.entries(processingInstructions.queryParameters).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  const response = await fetch(url.toString(), requestConfig);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Calculate totalFound more accurately
  let totalFound = 0;
  if (Array.isArray(data)) {
    totalFound = data.length;
  } else if (data.results && Array.isArray(data.results)) {
    totalFound = data.results.length;
  } else if (data.items && Array.isArray(data.items)) {
    totalFound = data.items.length;
  } else if (data && Object.keys(data).length > 0) {
    totalFound = 1;
  }
  
  return { data, totalFound };
}

/**
 * Handles two-step API workflow (list then details)
 */
async function handleTwoStepApi(processingInstructions) {
  console.log(`[DataExtractionAgent] 🔄 Starting two-step API process`);
  
  // Step 1: Get list of opportunity IDs
  const listData = await handleSingleApi({
    ...processingInstructions,
    apiEndpoint: processingInstructions.apiEndpoint // List endpoint
  });
  
  // Extract IDs from list response
  const opportunities = Array.isArray(listData.data) ? listData.data : 
                      listData.data.results || listData.data.items || [listData.data];
  
  const ids = opportunities.map(item => item.id || item.ID || item.opportunity_id).filter(Boolean);
  
  if (ids.length === 0) {
    console.warn(`[DataExtractionAgent] ⚠️ No IDs found in list response`);
    return { data: [], totalFound: 0 };
  }
  
  console.log(`[DataExtractionAgent] 📋 Found ${ids.length} opportunity IDs`);
  
  // Step 2: Fetch details for each ID
  const detailEndpoint = processingInstructions.detailConfig.endpoint;
  const detailedOpportunities = [];
  
  for (const id of ids.slice(0, 50)) { // Limit to 50 for safety
    try {
      const detailUrl = detailEndpoint.replace('{id}', id);
      const fullDetailUrl = detailUrl.startsWith('http') ? detailUrl : 
                           `${new URL(processingInstructions.apiEndpoint).origin}${detailUrl}`;
      
      const detailData = await handleSingleApi({
        ...processingInstructions,
        apiEndpoint: fullDetailUrl,
        requestBody: null // Usually GET for detail calls
      });
      
      detailedOpportunities.push(detailData.data);
    } catch (error) {
      console.warn(`[DataExtractionAgent] ⚠️ Failed to fetch detail for ID ${id}:`, error.message);
      // Continue with other IDs
    }
  }
  
  console.log(`[DataExtractionAgent] ✅ Successfully fetched ${detailedOpportunities.length} detailed opportunities`);
  
  return { 
    data: detailedOpportunities, 
    totalFound: ids.length,
    successfullyFetched: detailedOpportunities.length 
  };
}

/**
 * Extracts opportunities from raw API data using AI
 */
async function extractOpportunities(rawData, source, anthropic) {
  console.log(`[DataExtractionAgent] 🤖 Using AI to extract opportunities from raw data`);
  
  const prompt = `Extract funding opportunities from this API response data.

SOURCE: ${source.name}
API RESPONSE DATA:
${JSON.stringify(rawData.data, null, 2)}

Extract each opportunity with these exact fields:
- id: Unique identifier from API
- title: Opportunity name/title
- description: Detailed description
- totalFundingAvailable: Total funding pool (number or null)
- minimumAward: Minimum award amount (number or null)  
- maximumAward: Maximum award amount (number or null)
- openDate: Application open date (ISO format or null)
- closeDate: Application deadline (ISO format or null)
- eligibleApplicants: Array of who can apply
- eligibleProjectTypes: Array of project types funded
- eligibleLocations: Array of geographic restrictions
- fundingType: "grant", "loan", "tax_credit", etc.
- url: Application or info URL
- status: "open", "upcoming", "closed"
- categories: Array of funding categories
- isNational: true if nationwide, false if geographic restrictions

Return a JSON array of opportunities. If no opportunities found, return empty array.`;

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }]
  });
  
  const responseText = response.content[0].text;
  
  try {
    // Try to parse JSON response
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const opportunities = JSON.parse(cleanedResponse);
    
    if (!Array.isArray(opportunities)) {
      throw new Error('Response is not an array');
    }
    
    console.log(`[DataExtractionAgent] ✅ Extracted ${opportunities.length} opportunities`);
    return opportunities;
    
  } catch (parseError) {
    console.error(`[DataExtractionAgent] ❌ Failed to parse AI response:`, parseError);
    console.log('Raw response:', responseText);
    
    // Return empty array if parsing fails
    return [];
  }
}

/**
 * Standardizes an opportunity's fields and normalizes taxonomies
 */
function standardizeOpportunity(opportunity, source) {
  return {
    // Core identification
    id: opportunity.id || `${source.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: opportunity.title || 'Untitled Opportunity',
    description: opportunity.description || '',
    
    // Funding details
    totalFundingAvailable: parseAmount(opportunity.totalFundingAvailable),
    minimumAward: parseAmount(opportunity.minimumAward),
    maximumAward: parseAmount(opportunity.maximumAward),
    
    // Dates
    openDate: standardizeDate(opportunity.openDate),
    closeDate: standardizeDate(opportunity.closeDate),
    
    // Eligibility (normalized)
    eligibleApplicants: normalizeApplicantTypes(opportunity.eligibleApplicants),
    eligibleProjectTypes: normalizeProjectTypes(opportunity.eligibleProjectTypes),
    eligibleLocations: normalizeLocations(opportunity.eligibleLocations),
    
    // Classification
    fundingType: normalizeFundingType(opportunity.fundingType),
    status: normalizeStatus(opportunity.status),
    categories: normalizeCategories(opportunity.categories),
    
    // Metadata
    url: opportunity.url || '',
    isNational: Boolean(opportunity.isNational),
    
    // Source tracking
    sourceId: source.id,
    sourceName: source.name
  };
}

/**
 * Parse monetary amounts safely
 */
function parseAmount(amount) {
  if (!amount) return null;
  
  const numericAmount = typeof amount === 'string' ? 
    parseFloat(amount.replace(/[$,]/g, '')) : 
    parseFloat(amount);
    
  return isNaN(numericAmount) ? null : numericAmount;
}

/**
 * Standardize date formats
 */
function standardizeDate(date) {
  if (!date) return null;
  
  try {
    const parsedDate = new Date(date);
    return isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Normalize applicant types to standard taxonomy
 */
function normalizeApplicantTypes(applicants) {
  if (!Array.isArray(applicants)) return [];
  
  const mapping = {
    'k-12': 'School Districts',
    'school': 'School Districts', 
    'schools': 'School Districts',
    'municipal': 'Municipal Government',
    'city': 'Municipal Government',
    'county': 'County Government',
    'state': 'State Government',
    'nonprofit': 'Nonprofit Organizations',
    'university': 'Higher Education',
    'college': 'Higher Education'
  };
  
  return applicants.map(applicant => {
    const normalized = applicant.toLowerCase();
    return mapping[normalized] || applicant;
  });
}

/**
 * Normalize project types to standard taxonomy
 */
function normalizeProjectTypes(projectTypes) {
  if (!Array.isArray(projectTypes)) return [];
  
  const mapping = {
    'hvac': 'HVAC',
    'lighting': 'Lighting',
    'solar': 'Solar',
    'energy efficiency': 'Energy Efficiency',
    'building envelope': 'Building Envelope',
    'roofing': 'Roofing',
    'windows': 'Windows',
    'insulation': 'Insulation'
  };
  
  return projectTypes.map(type => {
    const normalized = type.toLowerCase();
    return mapping[normalized] || type;
  });
}

/**
 * Normalize locations to state codes
 */
function normalizeLocations(locations) {
  if (!Array.isArray(locations)) return [];
  
  const stateMapping = {
    'california': 'CA',
    'oregon': 'OR', 
    'washington': 'WA',
    'texas': 'TX',
    'florida': 'FL',
    'new york': 'NY'
    // Add more as needed
  };
  
  return locations.map(location => {
    const normalized = location.toLowerCase();
    return stateMapping[normalized] || location;
  });
}

/**
 * Normalize funding types
 */
function normalizeFundingType(fundingType) {
  if (!fundingType) return 'grant';
  
  const normalized = fundingType.toLowerCase();
  if (normalized.includes('loan')) return 'loan';
  if (normalized.includes('tax') || normalized.includes('credit')) return 'tax_credit';
  if (normalized.includes('rebate')) return 'rebate';
  return 'grant';
}

/**
 * Normalize status values
 */
function normalizeStatus(status) {
  if (!status) return 'unknown';
  
  const normalized = status.toLowerCase();
  if (normalized.includes('open') || normalized.includes('active')) return 'open';
  if (normalized.includes('closed') || normalized.includes('expired')) return 'closed';
  if (normalized.includes('upcoming') || normalized.includes('pending')) return 'upcoming';
  return 'unknown';
}

/**
 * Normalize categories
 */
function normalizeCategories(categories) {
  if (!Array.isArray(categories)) return [];
  
  const mapping = {
    'energy': 'Energy',
    'infrastructure': 'Infrastructure', 
    'environment': 'Environmental',
    'education': 'Education',
    'transportation': 'Transportation'
  };
  
  return categories.map(category => {
    const normalized = category.toLowerCase();
    return mapping[normalized] || category;
  });
} 