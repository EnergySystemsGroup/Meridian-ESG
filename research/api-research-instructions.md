# **Complete API Research Instructions**

## **📋 What Your Dev Assistant Must Research for Every API**

This document provides comprehensive instructions for researching and documenting new API sources for the funding intelligence platform. Follow these steps methodically to ensure we can integrate any API into our automated system.

---

## **1. BASIC API INFORMATION**
**Find and document:**
- **API base URL** (e.g., `https://api.example.com/v1/`)
- **Specific endpoint** for funding/grants/opportunities (e.g., `/search`, `/opportunities`)
- **Organization name** that owns the API
- **API documentation URL** (official docs)
- **Type of organization**: federal, state, local, utility, foundation, private
- **How often they update data**: daily, weekly, monthly, quarterly

---

## **2. AUTHENTICATION REQUIREMENTS**
**Test and document:**
- **No authentication needed** → Just works without any keys
- **API Key required** → Where to get it, how to apply it (header vs query param)
- **OAuth required** → Client ID/secret process
- **Basic authentication** → Username/password

**If authentication is needed:**
- **How to register** for access
- **Where to put the key** (header name, query parameter name)
- **Key format** (Bearer token, simple string, etc.)
- **Does the key expire?** How long does it last?

---

## **3. REQUEST METHOD & STRUCTURE**
**Test both and document which works:**

### **Try GET Request First:**
- Can you get data by just adding parameters to the URL?
- Example: `https://api.example.com/search?keyword=energy&limit=10`

### **Try POST Request:**
- Do you need to send data in the request body?
- What format: JSON, form data, XML?

**Document exactly:**
- **HTTP method**: GET, POST, PUT
- **Required headers**: Content-Type, Accept, Authorization, etc.
- **Example working request** (copy the exact curl command that works)

---

## **4. SEARCH/FILTER PARAMETERS**
**Test and document:**

### **What parameters work for filtering:**
- **Keywords**: `keyword`, `q`, `search`, `term`
- **Status filters**: `status`, `oppStatus`, `state` (active, open, closed, forecasted)
- **Date ranges**: `dateFrom`, `dateTo`, `dateRange`, `postedAfter`
- **Amount filters**: `minAmount`, `maxAmount`, `fundingMin`, `fundingMax`
- **Geographic filters**: `state`, `region`, `zip`, `county`

### **How do multiple keywords work:**
- Comma separated: `energy,solar,building`
- Pipe separated: `energy|solar|building`  
- Space separated: `energy solar building`
- Semicolon separated: `energy;solar;building`

### **Test these energy-related keywords:**
```
energy, solar, building, HVAC, lighting, efficiency, modernization, 
infrastructure, transportation, climate, carbon, battery, construction, 
roof, water, school, mobility
```

---

## **5. PAGINATION INVESTIGATION**
**This is critical - test thoroughly:**

### **Make a request that returns many results, then:**

**Check if pagination parameters work:**
- **Limit/Size**: `limit`, `size`, `rows`, `pageSize`, `count`
- **Offset**: `offset`, `start`, `startRecord`, `startRecordNum`
- **Page**: `page`, `pageNumber`, `pageIndex`
- **Cursor**: `cursor`, `nextToken`, `pageToken`

### **Test these combinations:**
1. `?limit=5&offset=0` then `?limit=5&offset=5`
2. `?limit=5&page=1` then `?limit=5&page=2`
3. `?rows=5&startRecordNum=0` then `?rows=5&startRecordNum=5`

### **For POST requests, test if pagination goes in the body:**
```json
{
  "keyword": "energy",
  "rows": 5,
  "startRecordNum": 0
}
```

### **Document:**
- **Pagination type**: offset, page, or cursor-based
- **Parameter names**: exact names that work
- **Where they go**: URL parameters or request body
- **Maximum page size**: what's the biggest limit they allow?
- **How many pages** should we realistically fetch? (suggest 5-20 max)

---

## **6. RESPONSE STRUCTURE ANALYSIS**
**Make a successful request and examine the JSON response:**

### **Find the data array:**
Where is the list of opportunities/grants located?
- `data` → response.data (array)
- `results` → response.results (array)  
- `opportunities` → response.opportunities (array)
- `data.oppHits` → response.data.oppHits (array)
- `result.records` → response.result.records (array)

### **Find the total count:**
Where is the total number of results?
- `total` → response.total
- `totalCount` → response.totalCount
- `data.hitCount` → response.data.hitCount
- `result.total` → response.result.total
- `meta.totalResults` → response.meta.totalResults

### **Copy an example response** (first 3 records) so we can see the exact structure.

---

## **7. INDIVIDUAL RECORD ANALYSIS**
**Look at one opportunity/grant record and document:**

### **Available fields and their names:**
- **Title**: `title`, `name`, `opportunityTitle`, `grantName`
- **Description**: `description`, `summary`, `details`, `abstract`
- **Agency/Organization**: `agency`, `agencyName`, `organization`, `sponsor`
- **Funding amounts**: `minAward`, `maxAward`, `totalFunding`, `amount`, `budget`
- **Dates**: `openDate`, `closeDate`, `deadlineDate`, `postedDate`, `startDate`, `endDate`
- **Status**: `status`, `opportunityStatus`, `state`
- **Eligibility**: `eligibility`, `eligibleApplicants`, `whoCanApply`
- **URL/Link**: `url`, `link`, `opportunityUrl`, `detailsUrl`
- **ID/Number**: `id`, `opportunityId`, `opportunityNumber`, `grantId`
- **Type/Category**: `type`, `category`, `fundingType`, `programType`

### **Note the data format:**
- Are dates in ISO format, MM/DD/YYYY, or something else?
- Are amounts numbers or strings with dollar signs?
- Are there nested objects (like `agency.name`)?

---

## **8. MULTI-STEP PROCESS CHECK**
**Very important - test this:**

### **Does the main search give you everything?**
- Are descriptions complete or truncated?
- Are all the details present or just summaries?

### **Is there a separate "details" endpoint?**
- Look for a detail URL in each record
- Test if you can get more information by calling a second API with the ID
- Example: `/opportunity/details/{id}` or `/fetchOpportunity`

### **If details endpoint exists, document:**
- **Detail endpoint URL**: exact URL pattern
- **HTTP method**: GET or POST
- **ID field name**: what field from the main response contains the ID?
- **ID parameter name**: what parameter name does the detail endpoint expect?
- **Headers needed**: same as main request or different?

---

## **9. ERROR HANDLING & LIMITS**
**Test edge cases:**

### **Rate limits:**
- Make several rapid requests - do you get blocked?
- Any error messages about rate limits?
- Any headers showing limits (X-RateLimit-Remaining, etc.)?

### **Invalid requests:**
- What happens with bad parameters?
- What's the error response format?
- Where are error messages located in the response?

### **Empty results:**
- What does the response look like when no results are found?
- Is it an empty array or a different structure?

---

## **10. PRACTICAL TESTING**
**Do these real-world tests:**

### **Search for actual energy funding:**
Try searches for:
- "solar energy grants"
- "building efficiency"
- "HVAC modernization"
- "infrastructure funding"

### **Verify the results make sense:**
- Are these actually funding opportunities?
- Are they current/recent?
- Do they relate to energy/infrastructure?

---

## **11. SPECIAL REQUIREMENTS**
**Document any quirks:**

### **Geographic restrictions:**
- Is this API only for certain states/regions?
- Any geographic filtering options?

### **Applicant restrictions:**
- Who can apply? (nonprofits, businesses, individuals, governments)
- Are there size restrictions (small business, etc.)?

### **Data freshness:**
- When was the data last updated?
- How current are the opportunities?

---

## **12. FINAL DELIVERABLE**
**Provide a working example:**

### **Complete curl command that works:**
```bash
curl -X POST "https://api.example.com/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "keyword": "energy",
    "status": "open",
    "rows": 10,
    "startRecordNum": 0
  }'
```

### **Sample response snippet** showing the structure

### **Summary of findings** with all the configuration details needed

---

## **📊 Configuration Mapping Reference**

Use this template to organize your findings into our database configuration format:

### **API Source Information:**
```json
{
  "name": "API Name",
  "organization": "Organization Name", 
  "type": "federal|state|local|utility|foundation|private",
  "url": "https://main-website.com",
  "api_endpoint": "https://api.example.com/endpoint",
  "api_documentation_url": "https://docs.example.com",
  "auth_type": "none|apikey|oauth|basic",
  "auth_details": {},
  "update_frequency": "daily|weekly|monthly",
  "handler_type": "standard|document|statePortal"
}
```

### **Configuration Types:**

#### **query_params:**
```json
{
  "keyword": "energy",
  "status": "open", 
  "limit": "10"
}
```

#### **request_config:**
```json
{
  "method": "GET|POST",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

#### **request_body:**
```json
{
  "searchTerm": "energy",
  "oppStatuses": "open|forecasted"
}
```

#### **pagination_config:**
```json
{
  "enabled": true,
  "type": "offset|page|cursor",
  "limitParam": "limit|rows|size",
  "offsetParam": "offset|start|startRecordNum", 
  "pageParam": "page|pageNumber",
  "pageSize": 10,
  "maxPages": 5,
  "paginationInBody": true|false
}
```

#### **response_config:**
```json
{
  "responseDataPath": "data.results",
  "totalCountPath": "data.total"
}
```

#### **detail_config:**
```json
{
  "enabled": true,
  "endpoint": "https://api.example.com/details",
  "method": "GET|POST",
  "headers": {},
  "idField": "id",
  "idParam": "opportunityId"
}
```

#### **response_mapping:**
```json
{
  "title": "title",
  "description": "description",
  "agency": "agency.name",
  "minAward": "funding.min",
  "maxAward": "funding.max",
  "openDate": "dates.open",
  "closeDate": "dates.close",
  "url": "detailUrl"
}
```

---

**🎯 The goal is to gather enough information so we can plug this API into our automated system without any guesswork!**

## **Notes for Implementation**

- Test everything with actual API calls
- Copy/paste exact working examples
- Document any unusual patterns or requirements
- Note any regional/geographic restrictions
- Identify the best keywords for energy/infrastructure funding
- Test pagination thoroughly - this is often the trickiest part
- Verify data freshness and update patterns 