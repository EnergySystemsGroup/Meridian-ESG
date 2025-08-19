# Data Management Architecture: Technical Specifications

## 1. System Overview

### 1.1 Purpose
This specification outlines the technical implementation details for the data management system supporting the public policy and funding intelligence function. The system will collect, classify, store, and visualize legislative and funding data to enable rapid identification and response to opportunities.

### 1.2 System Components
- Data Collection Subsystem
- Classification and Tagging Engine
- Supabase Database
- NextJS Frontend Application
- Visualization Components

## 2. Data Models

### 2.1 Core Data Models

#### Legislation Model
- **Core Properties**:
  - Unique identifier (UUID)
  - Bill title and summary
  - Full text or link to text
  - Source (federal/state/local)
  - Jurisdiction (specific state if applicable)
  - Introduction and last action dates
  - Current stage (introduced, committee, passed, etc.)
  - Probability score (likelihood of passage)
  - Sponsors and committees
  - Version history references
  - Funding implications (estimated amounts, types)
  - Implementation timeline
  - Classification tags
  - Relevance score
  - Timestamps (created/updated)

#### Funding Opportunity Model
- **Core Properties**:
  - Unique identifier (UUID)
  - Program name
  - Source reference (agency/organization)
  - Type (grant, incentive, tax credit, etc.)
  - Total available funding
  - Award range (min/max)
  - Matching requirements (boolean and percentage)
  - Application dates (open/close)
  - Eligibility criteria (structured object)
  - Service categories
  - Geographic scope
  - URLs (announcement, guidelines)
  - Status (upcoming, open, closed, awarded)
  - Related legislation reference
  - Classification tags
  - Relevance score
  - Timestamps (created/updated)

#### Funding Source Model
- **Core Properties**:
  - Unique identifier (UUID)
  - Organization name
  - Type (federal, state, local, utility, foundation, private)
  - Parent organization reference
  - Jurisdiction
  - Website
  - Contact information
  - Tags
  - Timestamps (created/updated)

#### Common Structures
- **Tag Structure**:
  - Category (service area, client type, geography, timeline, custom)
  - Value
  - Confidence score (for automated tagging)
  - Source (automatic or manual)

### 2.2 Supporting Data Models

#### Client Model
- **Core Properties**:
  - Unique identifier (UUID)
  - Organization name
  - Type (K12, higher ed, municipal, etc.)
  - Locations (array of physical locations)
  - Contacts (key personnel)
  - Service interests
  - Facility data (size, building count, systems)
  - Tags
  - Notes
  - Timestamps (created/updated)

#### Opportunity Match Model
- **Core Properties**:
  - Unique identifier (UUID)
  - Client reference
  - Opportunity reference
  - Match score (0-100)
  - Potential project value
  - Qualification notes
  - Action status (new, reviewing, pursuing, etc.)
  - Timestamps (created/updated)

#### Task Model
- **Core Properties**:
  - Unique identifier (UUID)
  - Title and description
  - Due date
  - Assigned person
  - Status and priority
  - Related item reference (type and ID)
  - Timestamps (created/updated)

## 3. Data Collection and Processing

### 3.1 Data Sources for MVP

#### Federal Sources
- **Grants.gov API**
  - API Endpoint: https://www.grants.gov/grantsws/APIAccess
  - Authentication: API Key
  - Poll Frequency: Daily
  - Data to Extract: Opportunity Title, CFDA Numbers, Agency, Close Date, Eligibility, Award Amount
  - Filter Criteria: Energy efficiency, renewable energy, building modernization, education facilities

- **Department of Energy (BTO Website)**
  - URL: https://www.energy.gov/eere/buildings/funding-opportunities
  - Collection Method: HTML Scraping with change detection
  - Poll Frequency: Daily
  - Data to Extract: Funding Opportunity Announcements, Deadlines, Program Guidelines
  - DOM Elements: Funding opportunity cards, deadline dates

#### State Sources (California)
- **California Energy Commission**
  - URL: https://www.energy.ca.gov/funding-opportunities
  - Collection Method: HTML Scraping with change detection
  - Poll Frequency: Daily
  - Data to Extract: Solicitation Title, Release Date, Deadline, Funding Amount
  - DOM Elements: Content rows, title fields, date fields

- **California Department of Education**
  - URL: https://www.cde.ca.gov/fg/fo/af/
  - Collection Method: HTML Scraping with change detection
  - Poll Frequency: Weekly
  - Data to Extract: Funding Profile, Application Due Date, Available Funding
  - DOM Elements: Table rows, funding page elements

### 3.2 Data Collection Implementation

#### API Collection Module
- **Grants.gov Integration Process**:
  1. Create a scheduled API call using environment variables for authentication
  2. Set query parameters to filter for relevant grants (energy, education CFDAs)
  3. Process each opportunity in the response
  4. Transform data to match our funding opportunity model
  5. Check for duplicates in the database
  6. Insert new opportunities or update existing ones
  7. Record statistics about the collection process
  8. Trigger the classification process for new items

#### Web Scraping Module
- **HTML Scraping Process**:
  1. Use a headless browser (Puppeteer) to load the target page
  2. Wait for dynamic content to render
  3. Extract structured data using DOM selectors
  4. Clean and normalize the extracted data
  5. Compare with previous scrape results to identify changes
  6. Process only new or changed content
  7. Transform data to match our models
  8. Save to database and trigger classification

#### Change Detection System
- **Tracking Changes Process**:
  1. Generate a hash of the content for each monitored page/section
  2. Compare with previously stored hash
  3. When changes detected, run the extraction process
  4. Store both the raw HTML and the structured data
  5. Log changes for audit purposes
  6. Generate alerts for significant changes

### 3.3 Classification and Tagging Engine

#### Automated Classification Process
- **Classification Workflow**:
  1. Receive new or updated content from collection systems
  2. Pre-process text (normalize, tokenize, remove stopwords)
  3. Apply keyword-based classification rules
  4. Use regular expressions to extract structured information (dates, amounts)
  5. Apply NLP techniques for entity recognition and topic modeling
  6. Calculate relevance score based on alignment with company services
  7. Generate confidence scores for each applied tag
  8. Flag low-confidence classifications for human review
  9. Save classification results to the database

#### Classification Rules Engine
- **Rule Structure**:
  - Keyword sets for each service category
  - Phrase patterns for eligibility criteria
  - Entity recognition patterns for organizations and locations
  - Regular expressions for extracting dates and currency amounts
  - Scoring formulas for relevance calculation

#### Relevance Scoring Algorithm
- **Scoring Factors**:
  - Keyword density and location in text
  - Explicit mentions of target client types
  - Funding amount and match requirements
  - Geographic applicability
  - Application timeline
  - Service category alignment
  - Historical success with similar opportunities

## 4. Supabase Database Implementation

### 4.1 Database Schema
- **Core Tables**:
  - legislation
  - funding_opportunities
  - funding_sources
  - clients
  - opportunity_matches
  - tasks
  - tags
  - users

- **Relationship Tables**:
  - legislation_funding_links
  - opportunity_tags
  - client_tags
  - opportunity_documents

- **Reference Tables**:
  - service_categories
  - client_types
  - geographic_regions
  - funding_types
  - legislation_stages

### 4.2 Data Access Patterns
- **Common Queries**:
  - Get open funding opportunities
  - Find opportunities matching a specific client
  - Get legislation by stage and relevance
  - Find opportunities by service category
  - Search across all content by keyword
  - Get upcoming deadlines
  - Find opportunities by geographic eligibility

- **Performance Considerations**:
  - Create indexes on frequently queried fields
  - Use denormalized data for common access patterns
  - Implement caching for frequently accessed data
  - Use pagination for large result sets
  - Create materialized views for complex reports

### 4.3 Security Implementation
- **Row-Level Security**:
  - Define policies based on user roles
  - Restrict sensitive data access
  - Implement audit logging for all modifications

- **API Security**:
  - Implement proper authentication for all API routes
  - Rate limiting for public endpoints
  - Input validation and sanitization
  - CORS configuration

## 5. Visualization and User Interface

### 5.1 Map View Implementation

#### Map Component Structure
- **Base Map Layer**:
  - Use Mapbox or Leaflet for rendering
  - Include state and county boundaries
  - Add zooming and panning controls
  - Implement responsive sizing

- **Data Visualization Layers**:
  - Choropleth layer for funding density
  - Marker layer for specific opportunities
  - Client location layer
  - Heat map for funding concentration

- **Interaction Handlers**:
  - Click handlers for states and regions
  - Hover effects for tooltips
  - Filter controls for data layers
  - Legend with color scale information

#### State Detail Panel
When a user clicks on a state (e.g., California):
- **Panel Content**:
  - State summary statistics
  - Funding breakdown by type
  - Top opportunities list
  - Recent legislation affecting the state
  - Client matches in the region

- **Filtering Options**:
  - By funding type (federal, state, local, utility)
  - By service category
  - By status (open, upcoming, closed)
  - By client type eligibility

- **Drilling Down**:
  - County-level detail option
  - City-specific programs
  - Links to specific opportunity details

### 5.2 Dashboard View Implementation

#### Dashboard Component Structure
- **Summary Metrics Section**:
  - Total funding available
  - Open opportunities count
  - Average match requirement
  - Upcoming deadlines
  - Key legislation status

- **Funding Distribution Charts**:
  - Pie chart of funding by category
  - Bar chart of funding by source
  - Timeline chart of application deadlines
  - Trend chart of funding over time

- **Opportunity Table**:
  - Sortable columns
  - Quick filtering
  - Status indicators
  - Match score visualization
  - Action buttons

- **Activity Feed**:
  - Recent system updates
  - New opportunities
  - Legislation status changes
  - Upcoming deadlines

### 5.3 Timeline View Implementation

#### Timeline Component Structure
- **Horizontal Timeline Display**:
  - Scrollable timeline with months/quarters
  - Color-coded events by type
  - Category filtering system
  - Zoom controls for time scale

- **Event Types**:
  - Legislation milestones
  - Funding open/close dates
  - Application deadlines
  - Anticipated program launches

- **Event Cards**:
  - Title and brief description
  - Visual indicator of type
  - Date information
  - Quick action buttons
  - Expansion for details

- **Timeline Filters**:
  - Date range selection
  - Event type toggles
  - Service category filters
  - Relevance threshold slider

### 5.4 Integration Points

#### Salesforce CRM Integration
- **Data Synchronization**:
  - Client record synchronization
  - Opportunity sharing
  - Activity logging
  - Task assignment

- **Implementation Approach**:
  - Use Salesforce API for bi-directional sync
  - Implement webhooks for real-time updates
  - Create mapping between data models
  - Develop conflict resolution strategy

#### Email Notification System
- **Notification Types**:
  - New opportunity alerts
  - Deadline reminders
  - Legislation updates
  - Match recommendations

- **Delivery Mechanism**:
  - SendGrid or similar email service
  - Templated emails with dynamic content
  - User preference management
  - Click tracking for engagement metrics

## 6. Implementation Roadmap

### 6.1 MVP Phase (Weeks 1-6)
- **Week 1-2: Foundation**
  - Set up Supabase database with core tables
  - Create NextJS project structure
  - Implement basic authentication
  - Set up development environment

- **Week 3-4: Data Collection**
  - Implement Grants.gov API integration
  - Build DOE website scraper
  - Create California data sources scrapers
  - Develop basic classification system

- **Week 5-6: Basic Visualization**
  - Implement map view with state selection
  - Create simple dashboard with key metrics
  - Build basic timeline display
  - Develop opportunity detail view

### 6.2 Enhancement Phase (Weeks 7-10)
- **Week 7-8: Advanced Classification**
  - Improve automated tagging accuracy
  - Implement relevance scoring algorithm
  - Add manual classification interface
  - Develop client matching logic

- **Week 9-10: Visualization Enhancement**
  - Add filtering capabilities to all views
  - Implement drill-down functionality on map
  - Create advanced dashboard components
  - Develop interactive timeline features

### 6.3 Integration Phase (Weeks 11-12)
- **Week 11: Notification System**
  - Implement email notifications
  - Create in-app alerts
  - Develop personalized digest system
  - Build user preference management

- **Week 12: CRM Integration**
  - Develop Salesforce connection
  - Implement bi-directional sync
  - Create client matching workflow
  - Build reporting integration

### 6.4 Future Enhancements (Post-MVP)
- Machine learning classification improvements
- Mobile application development
- Advanced predictive analytics
- Additional data sources integration
- Expanded geographic coverage
- Document processing capabilities