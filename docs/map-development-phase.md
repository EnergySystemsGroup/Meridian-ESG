# Map Development Phase Instructions

## Overview

We need to enhance our funding opportunity map to properly display geographic eligibility data. The current implementation shows a US state map with color coding based on funding amounts, but we need to improve how we handle eligibility data and provide better filtering and visualization options.

## Database Changes

We've added new tables to track geographic eligibility:

1. `states` - Reference table for all US states
2. `counties` - Reference table for counties
3. `opportunity_state_eligibility` - Junction table linking opportunities to eligible states
4. `opportunity_county_eligibility` - Junction table for county-level eligibility
5. Added `is_national` flag to `funding_opportunities` table

## Development Tasks

### 1. API Endpoints for Map Data

Create the following API endpoints:

```
GET /api/map/funding-by-state
- Returns aggregated funding data by state
- Includes: total opportunities, total funding amount
- Supports filtering by: status, funding source, min/max amount

GET /api/map/opportunities/:stateCode
- Returns opportunities eligible for a specific state
- Includes national opportunities + state-specific ones
- Supports filtering by: status, funding source, min/max amount
```

### 2. Map Visualization Enhancements

Modify the existing map component to:

- Use a color gradient based on opportunity count or total funding (user-selectable)
- Add numeric indicators showing opportunity count on each state
- Implement hover tooltips showing state name, opportunity count, and total funding
- Add a legend explaining the color scale
- Improve the state selection behavior

### 3. Opportunity List Improvements

When a state is selected:

- Group opportunities by category (Federal, State, Local)
- Show a summary count at the top (e.g., "15 opportunities available")
- Implement pagination or virtualized scrolling to handle long lists
- Add quick filters specific to the selected state's opportunities
- Include a "View All" option that opens a modal with more detailed filtering

### 4. Filtering Capabilities

Add the following filter options:

- Funding source type (Federal, State, Local, Private)
- Opportunity status (Open, Upcoming, Closed)
- Funding amount range
- Application deadline range
- Toggle to show/hide national opportunities

### 5. Visual Indicators

Implement visual cues to distinguish:

- National opportunities vs. state-specific ones
- High-value vs. low-value opportunities
- Upcoming deadlines vs. longer-term opportunities

### 6. Performance Optimization

Ensure the map performs well by:

- Implementing proper data loading states
- Using efficient rendering techniques for the state map
- Caching API responses where appropriate
- Lazy loading opportunity details

### 7. Responsive Design

Ensure the map and opportunity list work well on:

- Desktop (side-by-side layout)
- Tablet (adaptable layout)
- Mobile (stacked layout with collapsible sections)

## Technical Requirements

1. Use React with Next.js for all components
2. Implement proper TypeScript typing
3. Use TailwindCSS for styling
4. Ensure accessibility compliance
5. Write unit tests for key functionality
6. Document the API endpoints and component props

## Deliverables

1. API endpoints for map data
2. Enhanced map visualization component
3. Improved opportunity list component
4. Comprehensive filtering system
5. Responsive design implementation
6. Documentation and tests

This development should transform our basic map into a powerful tool for visualizing and accessing funding opportunities based on geographic eligibility.
