# API Source Configuration Guide

This document provides a comprehensive guide to the API source configuration system in the funding intelligence platform. It explains the different configuration types, their purpose, and how to use them effectively.

## Overview

The API source configuration system allows for flexible and standardized configuration of various API sources. Each API source can have multiple configuration types, each serving a specific purpose in the API integration process.

## Configuration Types

The system supports the following configuration types:

### 1. Query Parameters (`query_params`)

Query parameters are sent in the URL query string when making API requests.

**Example:**

```json
{
	"rows": 100,
	"oppStatuses": "forecasted,posted",
	"dateRange": "56"
}
```

### 2. Request Body (`request_body`)

Request body parameters are sent in the body of POST or PUT requests.

**Example:**

```json
{
	"searchTerm": "energy",
	"filters": {
		"category": "renewable",
		"minAmount": 50000
	}
}
```

### 3. Request Configuration (`request_config`)

Request configuration specifies the HTTP method and headers for API requests.

**Example:**

```json
{
	"method": "POST",
	"headers": {
		"Content-Type": "application/json",
		"Accept": "application/json"
	}
}
```

### 4. Pagination Configuration (`pagination_config`)

Pagination configuration specifies how to handle paginated API responses.

**Example:**

```json
{
	"enabled": true,
	"type": "offset",
	"limitParam": "rows",
	"offsetParam": "startRecordNum",
	"pageSize": 100,
	"maxPages": 5,
	"responseDataPath": "oppHits",
	"totalCountPath": "hitCount"
}
```

The system supports three pagination types:

- **Offset-based**: Uses limit and offset parameters
- **Page-based**: Uses limit and page parameters
- **Cursor-based**: Uses limit and cursor parameters

### 5. Detail Configuration (`detail_config`)

Detail configuration specifies how to fetch detailed information for each item returned by the main API.

**Example:**

```json
{
	"enabled": true,
	"endpoint": "https://api.grants.gov/v1/api/fetchOpportunity",
	"method": "POST",
	"headers": {
		"Content-Type": "application/json"
	},
	"idField": "id",
	"idParam": "opportunityId"
}
```

### 6. Response Mapping (`response_mapping`)

Response mapping specifies how to map API response fields to standard funding opportunity fields.

**Example:**

```json
{
	"title": "title",
	"description": "description",
	"fundingType": "type",
	"agency": "agency.name",
	"totalFunding": "totalFunding",
	"minAward": "minAward",
	"maxAward": "maxAward",
	"openDate": "startDate",
	"closeDate": "endDate",
	"eligibility": "eligibility",
	"url": "url"
}
```

## Handler Types

The system supports different handler types for processing API sources:

1. **Standard**: Regular API with JSON response
2. **Document**: Document-based API (PDFs, etc.)
3. **State Portal**: State portal websites requiring special handling

## Best Practices

### Query Parameters vs. Request Body

- Use query parameters for GET requests
- Use request body for POST/PUT requests with complex data structures

### Pagination

- Always specify the response data path to ensure the system can extract the data correctly
- Set a reasonable page size and max pages to avoid overwhelming the API

### Detail Configuration

- Use detail configuration for APIs that require a two-step process (list/search followed by detail)
- Make sure the ID field and parameter names are correct

### Response Mapping

- Use dot notation for nested fields (e.g., "data.title")
- Map as many fields as possible to ensure comprehensive data extraction

## Examples

### Example 1: Grants.gov API

```json
{
	"query_params": {
		"rows": 100,
		"oppStatuses": "forecasted,posted",
		"dateRange": "56",
		"searchOnly": false,
		"resultType": "json"
	},
	"request_config": {
		"method": "POST",
		"headers": {
			"Content-Type": "application/json"
		}
	},
	"pagination_config": {
		"enabled": true,
		"type": "offset",
		"limitParam": "rows",
		"offsetParam": "startRecordNum",
		"pageSize": 100,
		"maxPages": 5,
		"responseDataPath": "oppHits",
		"totalCountPath": "hitCount"
	},
	"detail_config": {
		"enabled": true,
		"endpoint": "https://api.grants.gov/v1/api/fetchOpportunity",
		"method": "POST",
		"headers": {
			"Content-Type": "application/json"
		},
		"idField": "id",
		"idParam": "opportunityId"
	}
}
```

### Example 2: Simple REST API

```json
{
	"query_params": {
		"limit": 50,
		"status": "active"
	},
	"request_config": {
		"method": "GET",
		"headers": {
			"Content-Type": "application/json",
			"Authorization": "Bearer {token}"
		}
	},
	"pagination_config": {
		"enabled": true,
		"type": "page",
		"limitParam": "limit",
		"pageParam": "page",
		"pageSize": 50,
		"maxPages": 10,
		"responseDataPath": "data.items",
		"totalCountPath": "data.total"
	},
	"response_mapping": {
		"title": "name",
		"description": "description",
		"fundingType": "type",
		"agency": "provider.name",
		"totalFunding": "budget.total",
		"minAward": "budget.minAward",
		"maxAward": "budget.maxAward",
		"openDate": "dates.start",
		"closeDate": "dates.end",
		"eligibility": "eligibility",
		"url": "links.details"
	}
}
```

## Troubleshooting

### Common Issues

1. **API returns empty results**:

   - Check query parameters and request body
   - Verify the API endpoint is correct
   - Check authentication details

2. **Pagination not working**:

   - Verify the response data path and total count path
   - Check the pagination type and parameter names

3. **Detail requests failing**:

   - Verify the ID field and parameter names
   - Check the detail endpoint URL

4. **Data not being extracted correctly**:
   - Check the response mapping fields
   - Verify the dot notation for nested fields
