# Legislative Monitoring Framework: Strategic Plan

## 1. Information Targets by Source

### 1.1 Federal Level

#### Congressional Legislation Monitoring
- **Target Information**:
  - Bills related to energy efficiency, building modernization, clean energy, and school infrastructure
  - Committee hearings schedule for relevant committees (Energy, Education, Appropriations)
  - Funding authorization levels in proposed bills
  - Application timelines and eligibility criteria for funded programs
  - Changes to tax credits or incentives related to energy projects
  - Amendments that modify funding levels or eligibility requirements
  
- **Automation Strategy**:
  - Use Congress.gov API to track energy and infrastructure bills through specific keyword filters (API polling)
  - Monitor key committees: House Energy & Commerce, Senate Energy & Natural Resources, House/Senate Appropriations (HTML scraping + change detection)
  - Set up tracking for bills containing keywords: "energy efficiency," "renewable energy," "school infrastructure," "building modernization" (API + keyword filtering)
  - Flag any bills that move from introduction to committee consideration, as this signals increased likelihood of passage (Status change detection)

#### Federal Agency Grant Monitoring
- **Target Information**:
  - New Notice of Funding Opportunity (NOFO) releases
  - Updates to existing funding programs
  - Changes in program priorities or eligibility requirements
  - Application deadlines and submission requirements
  - Technical assistance webinars and resources
  - Award announcements (to identify successful applicants/strategies)
  
- **Automation Strategy**:
  - Create focused monitoring for these specific DOE programs (RSS feeds + scheduled API calls):
    - Building Technologies Office funding opportunities
    - State Energy Program funding
    - Energy Efficiency and Conservation Block Grant Program
    - Better Buildings Initiative updates
  - Track EPA Clean School Bus Program funding rounds (HTML scraping + change detection)
  - Monitor Department of Education's Impact Aid and 21st Century Schools programs (API polling + email alerts)
  - Set up alerts for any page changes on program-specific URLs containing funding details (DOM comparison)

### 1.2 State Level

#### California
- **Target Information**:
  - Energy Commission funding programs for schools and public buildings
  - Updates to Title 24 building energy standards affecting project requirements
  - School Facility Program funding availability
  - Changes to state incentive programs for solar and storage
  - California Air Resources Board electric vehicle infrastructure programs
  
- **Automation Strategy**:
  - Monitor California Energy Commission solicitations page for new releases (HTML scraping + change detection)
  - Track California Department of Education grants related to school facilities (API integration + email subscription)
  - Set up alerts for California legislative bills with keywords matching our services (API + keyword filtering)
  - Track California Public Utilities Commission proceedings related to energy efficiency programs and incentives (Document scraping + text analysis)

#### Oregon
- **Target Information**:
  - Oregon Department of Energy incentive programs
  - Clean Energy Fund updates and solicitations
  - School capital improvement funding opportunities
  - Changes to Energy Trust of Oregon incentive programs
  
- **Automation Strategy**:
  - Monitor Oregon Department of Energy incentives page for updates (HTML scraping + change detection)
  - Track Oregon Department of Education facility grant programs (Email alerts + RSS feeds)
  - Set up alerts for changes to Energy Trust of Oregon incentive rates for commercial/public buildings (API polling + scheduled comparison)

#### Washington
- **Target Information**:
  - Clean Energy Fund solicitations
  - School Seismic Safety Grant Program updates
  - Energy efficiency incentives through utilities
  - Building electrification programs and requirements
  
- **Automation Strategy**:
  - Monitor Washington State Department of Commerce energy program pages (HTML scraping + change detection)
  - Track Office of Superintendent of Public Instruction grant programs (Email subscription + document analysis)
  - Set up alerts for changes to utility incentive programs for public buildings (Scheduled URL comparison)

### 1.3 Local Level
- **Target Information**:
  - Municipal sustainability program funding
  - Local ordinances affecting building performance requirements
  - County-level infrastructure improvement bonds
  - Local utility rebate programs for energy efficiency
  
- **Automation Strategy**:
  - Develop targeted monitoring for the 15 largest municipal governments in our service area (Web scraping + meeting agenda PDF parsing)
  - Track public meeting agendas for county commissions when discussing infrastructure or sustainability (PDF text analysis + keyword matching)
  - Set up alerts for changes to local utility rebate program pages (Scheduled DOM comparison)

## 2. Information Extraction & Classification Strategy

### 2.1 Key Data Elements to Extract

#### Funding Opportunity Details
- Program name and sponsoring agency/organization
- Total available funding and typical award amounts
- Eligibility requirements (specifically noting public sector/K-12 eligibility)
- Required match amounts (if any)
- Application deadlines (open date, close date)
- Project timeframes (implementation period requirements)
- Eligible technologies and project types
- Evaluation criteria
- Links to program guidelines and application materials

#### Legislative/Policy Updates
- Bill number and title
- Current status in legislative process
- Key provisions affecting energy projects
- Funding authorization levels
- Implementation timelines
- Changes from previous versions (especially funding levels or eligibility)
- Committee assignments and hearing dates
- Likelihood of passage assessment

### 2.2 Categorization Taxonomy
All captured information will be classified using the following tagging system to enable filtering and matching to client needs:

#### Primary Service Categories
- Energy Efficiency Retrofits
- HVAC Modernization
- Building Envelope Improvements
- Lighting Upgrades
- Renewable Energy Installation
- Battery Storage
- EV Charging Infrastructure
- Water Conservation
- Building Automation & Controls

#### Client Type Eligibility
- K-12 Schools
- Community Colleges
- Universities
- Municipal Government
- County Government
- State Facilities
- Federal Facilities
- Hospitals
- Special Districts

#### Geography
- Federal (nationwide)
- California (statewide)
- Oregon (statewide)
- Washington (statewide)
- Regional (specific regions within states)
- Local (specific municipalities/counties)

#### Funding Mechanism
- Grant
- Rebate/Incentive
- Tax Credit
- Low-Interest Loan
- Loan Guarantee
- Bond Authority
- Performance Contract

#### Timeline Urgency
- Immediate (< 30 days to deadline)
- Near-term (30-90 days to deadline)
- Medium-term (3-6 months to deadline)
- Long-term (6+ months to deadline)
- Continuous (ongoing program)

## 3. Automation Technical Strategy

### 3.0 Key API and Data Sources for Funding Opportunities

#### Federal Funding Sources
- **DOE Building Technologies Office**
  - Funding page: https://www.energy.gov/eere/buildings/funding-opportunities
  - Data to monitor: FOA numbers, application deadlines, eligible technologies
  - Specific programs: Better Buildings Initiative, Building Energy Codes

- **DOE State Energy Program**
  - Funding page: https://www.energy.gov/eere/wipo/state-energy-program
  - Data to monitor: Formula grant allocations, competitive solicitations

- **EPA Clean School Bus Program**
  - Program page: https://www.epa.gov/cleanschoolbus
  - Data to monitor: Funding rounds, allocation by state, application windows

- **Department of Education**
  - Impact Aid page: https://oese.ed.gov/offices/office-of-formula-grants/impact-aid-program/
  - School Facility program: https://oese.ed.gov/offices/office-of-formula-grants/school-facilities/

#### State Funding Sources
- **California Energy Commission**
  - Funding page: https://www.energy.ca.gov/funding-opportunities
  - School programs: https://www.energy.ca.gov/programs-and-topics/programs/school-energy-efficiency-stimulus-sees-program
  - Data to monitor: Program guideline changes, application deadlines, funding allocations

- **California School Facility Program**
  - Program page: https://www.dgs.ca.gov/OPSC/Programs
  - Data to monitor: Funding cycles, eligibility updates, application windows

- **Oregon Department of Energy**
  - Incentives page: https://www.oregon.gov/energy/Incentives/
  - Schools program: https://www.oregon.gov/energy/energy-oregon/pages/schools-energy-efficiency.aspx
  - Data to monitor: Incentive rates, eligibility criteria, program deadlines

- **Washington Clean Energy Fund**
  - Program page: https://www.commerce.wa.gov/growing-the-economy/energy/clean-energy-fund/
  - Data to monitor: Funding rounds, eligibility updates, application deadlines

### 3.1 NextJS Web Application Architecture

#### Frontend Dashboard Components
- Funding opportunity browser with filtering by all taxonomy categories
- Legislative tracking board showing bill status and importance 
- Calendar view of upcoming deadlines and key dates
- Alert configuration panel for personalized notifications
- Client matching tool to identify opportunities for specific clients

#### Backend Services (API Routes)
- Authentication and user management
- Funding opportunity database access
- Legislative tracking data access
- Alert system management
- Client matching algorithm
- Data synchronization with scraped sources

#### External API Integration Points
- **Grants.gov API**
  - Endpoint: https://www.grants.gov/grantsws/APIAccess
  - Data to extract: CFDA numbers, opportunity titles, agency codes, close dates, eligibility information
  - Filter criteria: Category filters for energy, infrastructure, education, and environmental categories
  
- **Congress.gov API**
  - Endpoint: https://api.congress.gov/v3/
  - Data to extract: Bill text, sponsors, committee referrals, legislative actions, bill status
  - Filter criteria: Energy, infrastructure, climate, school, building committees and keywords
  
- **Federal Register API**
  - Endpoint: https://www.federalregister.gov/api/v1/
  - Data to extract: Proposed rules, notices, executive orders related to energy policy
  - Filter criteria: Energy efficiency, school infrastructure, sustainability keywords
  
- **California Energy Commission API**
  - Endpoint: https://www.energy.ca.gov/resources/data-feeds
  - Data to extract: Funding opportunity notices, solicitation updates, program changes
  
- **Oregon Legislative API**
  - Endpoint: https://api.oregonlegislature.gov/
  - Data to extract: Bill information, committee schedules, legislative updates
  
- **RSS Feed Aggregation Points**
  - DOE: https://www.energy.gov/feeds
  - EPA: https://www.epa.gov/newsreleases/search/rss
  - California Energy Commission: https://www.energy.ca.gov/rss.xml
  - Oregon Department of Energy: https://www.oregon.gov/energy/About/Pages/RSS.aspx
  - Energy Star: https://www.energystar.gov/feeds/

### 3.2 Supabase Data Architecture

#### Database Tables
- `funding_opportunities` - All identified funding sources with detailed metadata
- `legislation` - Tracked bills and regulatory changes
- `legislation_history` - Historical versions of tracked legislation for change detection
- `funding_sources` - Master list of agencies, organizations, and programs that offer funding
- `clients` - Client information for matching to opportunities
- `alerts` - System-generated alerts and their status
- `users` - System users and their notification preferences
- `scrape_logs` - Logs of data collection activities

#### Supabase Functions
- Daily aggregation of new opportunities
- Automatic categorization of new content using taxonomy
- Client-opportunity matching scoring algorithm
- Deadline approaching notification triggers
- Change detection between legislation versions

### 3.3 Data Collection Automation

#### API Integration Strategy
We'll use MCP (Model Context Protocol) to manage the integration of various data sources. This approach will:

1. **Federal Grant API Monitoring**:
   - Connect to grants.gov API (https://www.grants.gov/grantsws/APIAccess) to extract only energy, infrastructure, and education grants
   - Use specific CFDA numbers relevant to our services: 
     - 81.041 (State Energy Program)
     - 81.086 (Conservation Research and Development)
     - 81.087 (Renewable Energy Research and Development)
     - 84.401 (Impact Aid School Construction)
   - Filter results to include only opportunities eligible for public entities
   - Extract key fields: applicationCloseDate, opportunityTitle, opportunityNumber, agencyCode, fundingInstrumentType
   - Parse application deadlines and funding levels into structured data
   - Push results to our Supabase database through custom API

2. **Web Content Monitoring**:
   - Create MCP flows to check specific pages on agency websites daily
   - Configure content extraction for specific HTML elements containing funding details
   - Implement change detection to identify when content is updated
   - For pages with predictable structure:
     - Extract specific tables or lists containing program information
     - Parse into structured data with program details
   - For less structured pages:
     - Capture full content and detect changes
     - Flag for manual review when changes occur

3. **Document Processing**:
   - Set up MCP flows to download PDF documents from monitored sites
   - Extract key information using AI-based document processing
   - Pull out deadlines, eligibility criteria, and funding amounts
   - Match to existing programs or create new entries

4. **Email Subscription Aggregation**:
   - Create dedicated email account for newsletter subscriptions
   - Subscribe to all relevant agency newsletters and updates
   - Use MCP to process incoming emails
   - Extract links to funding announcements and program updates
   - Check links against existing database to identify new information

### 3.4 Information Processing Workflows

#### Funding Opportunity Processing
1. New opportunity identified through automated monitoring
2. Initial metadata extracted (title, source, deadline, etc.)
3. MCP workflow applies preliminary categorization based on keywords
4. Relevant text sections extracted for detailed analysis
5. Structured data pushed to Supabase database
6. Automated notifications sent to team based on opportunity relevance
7. Manual review flag set for high-value opportunities

#### Legislative Update Processing
1. Bill movement detected through automated monitoring
2. Current version downloaded and compared to previous version
3. Significant changes detected and highlighted
4. Funding implications extracted from text
5. Probability of passage updated based on current status
6. Alerts generated for bills meeting threshold criteria

## 4. Alert and Notification Strategy

### 4.1 Notification Categories

#### Immediate Alerts (Push Notifications & Email)
- New high-value funding opportunities matching our services
- Imminent application deadlines (within 30 days)
- Significant changes to tracked legislation
- New funding announcements from priority agencies

#### Daily Digest (Email Only)
- Summary of new funding opportunities
- Legislative updates
- Upcoming deadlines
- Recently added documents and resources

#### Weekly Strategic Briefing (Dashboard & Email)
- Funding landscape overview
- Legislative trends
- Upcoming opportunities requiring preparation
- Success rate metrics on applications

### 4.2 Alert Relevance Scoring
All alerts will be assigned a relevance score (1-100) based on:
- Match to company service offerings (0-25 points)
- Funding amount available (0-20 points)
- Client type alignment (0-20 points)
- Geographic relevance (0-15 points)
- Timeline urgency (0-20 points)

Only alerts scoring above 50 will trigger immediate notifications.

## 5. Implementation Roadmap

### Phase 1: Core Infrastructure (Month 1)
- Set up NextJS application framework
- Configure Supabase database schema
- Create initial MCP workflows for highest-priority sources
- Implement basic dashboard for viewing collected data

### Phase 2: Automated Collection (Months 2-3)
- Implement federal source monitoring
- Set up state-level monitoring for California
- Create document processing workflows
- Develop automated categorization

### Phase 3: Intelligence Enhancement (Months 3-4)
- Add Oregon and Washington monitoring
- Implement legislative change detection
- Develop client matching algorithm
- Create notification system

### Phase 4: Expansion (Months 5-6)
- Add local government monitoring
- Implement advanced reporting
- Develop trend analysis
- Create forecasting tools for future funding
