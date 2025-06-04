# Funding Opportunity Identification: Strategic Framework

## 1. Comprehensive Funding Source Mapping

### 1.1 Funding Source Categories

#### Federal Agency Programs
- **Department of Energy (DOE)**
  - Building Technologies Office (BTO) grants and cooperative agreements
  - State Energy Program (SEP) formula and competitive grants
  - Better Buildings Initiative technical assistance and recognition programs
  - Energy Efficiency and Conservation Block Grant Program (EECBG)
  - Grid Modernization Initiative funding
  - Federal Energy Management Program (FEMP) assistance

- **Environmental Protection Agency (EPA)**
  - Clean School Bus Program grants
  - Building Performance with ENERGY STAR
  - Indoor Air Quality Tools for Schools
  - Environmental Justice grants
  - Sustainable Materials Management grants

- **Department of Education (ED)**
  - Impact Aid Construction Program
  - School Infrastructure Improvement grants
  - 21st Century Community Learning Centers
  - Innovation and Research grants

- **Federal Emergency Management Agency (FEMA)**
  - Building Resilient Infrastructure and Communities (BRIC)
  - Public Assistance Program for critical infrastructure
  - Hazard Mitigation Grant Program
  
- **Department of Agriculture (USDA)**
  - Rural Development Community Facilities Program
  - Rural Energy for America Program (REAP)
  - Community Facilities Direct Loan & Grant Program

#### State-Level Programs
- **California**
  - California Energy Commission (CEC) grant programs
  - School Energy Efficiency Stimulus (SEES) Program
  - Proposition 39 Clean Energy Jobs Act funding
  - California School Facility Program
  - CalSHAPE (School HVAC and Plumbing Efficiency)
  - California Alternative and Renewable Fuel and Vehicle Technology Program

- **Oregon**
  - Oregon Department of Energy incentives
  - Energy Trust of Oregon rebates and incentives
  - Oregon Clean Energy Fund
  - Oregon School Capital Improvement Matching Program
  - Public Purpose Charge Schools Program

- **Washington**
  - Washington State Energy Program grants
  - Clean Energy Fund grants
  - School Seismic Safety Retrofit Program
  - Energy Efficiency and Solar Grants
  - Washington Department of Commerce Energy Retrofits for Public Buildings

#### Utility Programs
- **Investor-Owned Utilities**
  - Pacific Gas & Electric (CA) rebate and incentive programs
  - Southern California Edison rebate and incentive programs
  - San Diego Gas & Electric rebate and incentive programs
  - Portland General Electric (OR) energy efficiency programs
  - Puget Sound Energy (WA) commercial incentives

- **Municipal Utilities**
  - Los Angeles Department of Water and Power programs
  - Sacramento Municipal Utility District incentives
  - Seattle City Light incentives
  - Eugene Water & Electric Board programs

#### Private Sector and Foundation Funding
- **Corporate Foundations**
  - Google.org Energy Innovation grants
  - Microsoft Climate Innovation Fund
  - Wells Fargo Foundation sustainability grants

- **Private Foundations**
  - Hewlett Foundation Climate Initiative
  - Energy Foundation grants
  - Kresge Foundation Environment Program

### 1.2 Monitoring and Identification Strategy

#### Comprehensive Monitoring Methodology

- **Federal Funding Sources**
  - Grants.gov API integration (API polling on daily schedule)
  - Federal agency RSS feed aggregation (automated feed parsing)
  - Federal Register automated monitoring (API + keyword filtering)
  - Specialized email accounts for agency newsletters (email parsing + keyword extraction)
  - PDF scraping of agency planning documents (document OCR + text analysis)

- **State Funding Sources**
  - State grant portal monitoring (HTML scraping with change detection)
  - State agency webpage monitoring (DOM comparison on key URLs)
  - Automated calendar tracking of state budget cycles (date-based triggers)
  - Legislative appropriation tracking (document parsing + keyword filtering)
  - State agency social media monitoring (API integration with Twitter/LinkedIn)

- **Utility Programs**
  - Utility commission filing monitoring (automated document retrieval)
  - Utility website change detection (scheduled DOM comparison)
  - Energy efficiency program database tracking (API integration where available)
  - Utility newsletter subscription and parsing (email content extraction)
  - Automated call systems for program updates (scheduled reminder system)

- **Private Sector and Foundation Funding**
  - Foundation website monitoring (HTML change detection)
  - Grant database subscriptions (API integration with Foundation Directory)
  - Corporate sustainability page tracking (DOM comparison)
  - ESG report monitoring for funding priorities (PDF parsing + keyword extraction)
  - Scheduled network outreach reminders (CRM integration)

#### Continuous Monitoring Approach
- **Annual Funding Cycles**
  - Calendar of recurring programs based on historical patterns (Excel database)
  - Automated reminders 60/90/120 days before anticipated opening dates
  - Tracking of appropriations that signal funding availability
  
- **New Announcement Detection**
  - API connections to Grants.gov and relevant state grant portals
  - Automated webpage monitoring for announcement pages (change detection)
  - Email subscriptions to funding newsletters with automated processing
  - RSS feed aggregation from key funding sources

- **Pre-Announcement Intelligence**
  - Network contact monitoring for early intelligence
  - Agency planning document review
  - Budget allocation tracking
  - Meeting minutes from key funding agencies

#### Comprehensive Funding Database Management
- **Database Structure in Supabase**
  - Funding program master list (persistent programs)
  - Active funding opportunities (current application rounds)
  - Historical awards data (patterns of funding)
  - Source and agency contact information
  
- **Information Capture Requirements**
  - Standardized fields for all opportunities
  - Document repository for guidelines and applications
  - Tracking of changes between funding rounds
  - Tagging system for service type matching

## 2. Funding Opportunity Qualification Framework

### 2.1 Opportunity Assessment Criteria

#### Primary Qualification Factors
- **Client Type Eligibility**
  - Explicit eligibility for K-12 schools
  - Eligibility for local/municipal governments
  - Eligibility for state government facilities
  - Special district eligibility

- **Project Type Alignment**
  - Energy efficiency improvements
  - HVAC system upgrades
  - Lighting retrofits
  - Building envelope improvements
  - Renewable energy installations
  - Battery storage systems
  - EV charging infrastructure
  - Water conservation measures
  - Building controls and automation

- **Funding Parameters**
  - Minimum/maximum award amounts
  - Cost-share/matching requirements
  - Allowable use of funds
  - Disallowed expenses
  - Administrative cost limitations

- **Geographic Restrictions**
  - State-specific availability
  - Regional limitations
  - Urban/rural designations
  - Environmental justice community preferences

#### Secondary Assessment Factors
- **Implementation Timeline**
  - Project completion deadlines
  - Expenditure requirements
  - Performance period length
  - Extension availability

- **Application Complexity**
  - Technical requirements (audits, engineering studies)
  - Stakeholder engagement requirements
  - Historical performance documentation
  - Certification requirements

- **Reporting Requirements**
  - Energy savings measurement and verification
  - Financial reporting complexity
  - Ongoing compliance obligations
  - Post-implementation monitoring

### 2.2 Opportunity-Client Matching System

#### Matching Algorithm Components
- **Client Profile Database Fields**
  - Facility types and counts
  - Geographic locations
  - Energy consumption patterns
  - Previous energy improvements
  - Financial capacity (for matching funds)
  - Specific facility needs and priorities

- **Scoring Methodology**
  - Weighted match score based on eligibility factors
  - Prioritization based on client strategic importance
  - Factoring of application competitiveness
  - Timeline alignment with client planning cycles

#### Match Processing Workflow
1. New opportunity initial screening
2. Preliminary client match identification
3. Detailed qualification assessment
4. Client-specific opportunity summary creation
5. Sales team notification with prioritized outreach list

## 3. Application Timeline Management

### 3.1 Critical Path Timeline Elements

#### Pre-Application Phase
- **Announcement Date**
  - Initial funding opportunity announcement
  - Notice of intent to release funding

- **Information Sessions**
  - Technical assistance webinars
  - Application workshops
  - Q&A session dates

- **Letter of Intent Deadlines**
  - Intent to apply submissions
  - Pre-application qualifications

#### Application Development Phase
- **Required Assessments**
  - Energy audits
  - Engineering studies
  - Financial analyses

- **Stakeholder Approvals**
  - Board meetings/approval dates
  - Required public hearings
  - Partner commitment deadlines

- **Technical Requirements**
  - Data collection periods
  - Baseline establishment
  - Technical review periods

#### Submission Phase
- **Registration Requirements**
  - System for Award Management (SAM) registration
  - Grants.gov registration
  - State portal registrations

- **Application Components**
  - Technical narrative deadlines
  - Budget development
  - Support documentation

- **Final Submission**
  - Hard deadlines
  - Electronic submission requirements
  - Mail/delivery requirements

### 3.2 Timeline Management System

#### Automation and Tracking
- **Calendar Integration**
  - Google Calendar/Outlook shared calendars
  - Automated reminder system
  - Milestone tracking

- **Task Assignment System**
  - Role-specific task assignments
  - Dependency management
  - Critical path identification

- **Deadline Buffer Management**
  - Internal deadlines (7-10 days prior to actual)
  - Contingency planning
  - Escalation procedures

### 3.3 Timeline Monitoring Methodology

- **Deadline Tracking Automation**
  - Database-driven deadline notification system (automated escalating alerts)
  - Calendar API integration for team visibility (CalDAV/iCal feed generation)
  - Progressive reminder system (90/60/30/14/7/3/1 days before deadlines)
  - After-hours notification system for imminent deadlines (SMS + email)

- **Application Progress Monitoring**
  - Component completion tracking (percentage-based dashboard)
  - Bottleneck identification system (dependency visualization)
  - Daily status update automation (progress report generation)
  - Traffic light system for at-risk application components (visual monitoring)

- **External Timeline Changes**
  - Agency update monitoring for deadline extensions (website scraping)
  - Q&A document tracking for clarifications (PDF comparison)
  - Amendment notification system (email filtering + forwarding)
  - Funding agency social media monitoring (API integration for announcements)

## 4. Funding Opportunity Analysis and Prioritization

### 4.1 Opportunity Evaluation Matrix

#### Strategic Value Criteria
- **Funding Amount Range**
  - Small: <$100,000
  - Medium: $100,000-$1,000,000
  - Large: $1,000,000+

- **Competition Level**
  - High: National competitive
  - Medium: State competitive
  - Low: Formula/non-competitive

- **Company Service Alignment**
  - High: Direct match to core services
  - Medium: Partial alignment
  - Low: Requires partnership/new capability

- **Client Development Value**
  - Strategic client acquisition opportunity
  - Existing client relationship strengthening
  - New market/sector entry potential

#### Resource Requirement Assessment
- **Application Development Effort**
  - Level of effort (staff hours)
  - Technical expertise requirements
  - External support needs

- **Implementation Complexity**
  - Technical difficulty
  - Timeline constraints
  - Reporting burden

- **Financial Considerations**
  - Cost-share requirements
  - Cash flow implications
  - Long-term financial commitments

### 4.2 Prioritization Framework

#### Priority Categorization
- **Tier 1 (Highest Priority)**
  - Strong alignment with core services
  - Significant funding amounts
  - Strong client match potential
  - Reasonable application effort
  - High probability of success

- **Tier 2 (Medium Priority)**
  - Good alignment with services
  - Moderate funding amounts
  - Some strong client matches
  - Moderate application complexity
  - Moderate competition level

- **Tier 3 (Lower Priority)**
  - Partial alignment with services
  - Smaller funding amounts
  - Limited client matches
  - High application complexity
  - Intense competition

#### Resource Allocation Guidelines
- **Tier 1 Opportunities**
  - Full team support
  - Dedicated grant specialist
  - Senior management involvement
  - Client co-development

- **Tier 2 Opportunities**
  - Standard application team
  - Template-based approach
  - Selective client engagement

- **Tier 3 Opportunities**
  - Minimal resource investment
  - Partner-led applications
  - Template-only approach

## 5. Funding Trends Analysis and Forecasting

### 5.1 Historical Pattern Analysis

#### Pattern Identification Methodology
- **Program Recurrence Tracking**
  - Annual funding cycles
  - Biennial patterns
  - Periodic reauthorizations

- **Funding Level Trends**
  - Increasing/decreasing allocation patterns
  - Shifts in funding priorities
  - Changes in eligible activities

- **Competitive Dynamics**
  - Application volume trends
  - Success rate patterns
  - Award size changes

#### Data Aggregation Approach
- **Internal Application History**
  - Success/failure analysis
  - Scoring feedback review
  - Competitive positioning assessment

- **Public Award Information**
  - FOIA requests for application scores
  - Analysis of awarded projects
  - Identification of successful approaches

- **Agency Strategic Planning**
  - Multi-year plans review
  - Budget justification documents
  - Research priority documents

### 5.2 Predictive Funding Models

#### Forecasting Components
- **Scheduled Program Predictions**
  - Calendar of anticipated announcements
  - Funding level projections
  - Application requirement predictions

- **Policy-Driven Forecasts**
  - Legislative impact analysis
  - Administrative priority assessment
  - Regulatory change implications

- **Budget-Based Predictions**
  - Appropriations tracking
  - Agency budget allocation monitoring
  - Continuing resolution impacts

#### Opportunity Pipeline Development
- **12-Month Funding Outlook**
  - Near-certain opportunities (announced/recurring)
  - High-probability opportunities (budget allocated)
  - Possible opportunities (policy signals)

- **Long-Range Planning (24-36 months)**
  - Macro funding trends
  - Policy direction shifts
  - New program development
  
## 6. Implementation Strategy

### 6.1 Supabase Database Schema for Funding Opportunities

```
Table: funding_sources
- id: uuid (primary key)
- name: text (e.g., "DOE Building Technologies Office")
- agency_type: enum (Federal, State, Utility, Foundation, Other)
- state: text (if applicable)
- website: text
- contact_info: jsonb
- created_at: timestamp
- updated_at: timestamp

Table: funding_programs
- id: uuid (primary key)
- source_id: uuid (foreign key to funding_sources)
- name: text (e.g., "Commercial Building Energy Efficiency Grant")
- description: text
- typical_funding_amount: range
- recurrence_pattern: text (Annual, Biennial, One-time, etc.)
- typical_open_month: int
- typical_close_month: int
- eligibility_criteria: jsonb
- matching_requirements: text
- notes: text
- created_at: timestamp
- updated_at: timestamp

Table: funding_opportunities
- id: uuid (primary key)
- program_id: uuid (foreign key to funding_programs)
- title: text
- fiscal_year: text
- status: enum (Anticipated, Open, Closed, Awarded)
- open_date: timestamp
- close_date: timestamp
- amount_available: numeric
- minimum_award: numeric
- maximum_award: numeric
- cost_share_required: boolean
- cost_share_percentage: numeric
- application_url: text
- guidelines_url: text
- notes: text
- created_at: timestamp
- updated_at: timestamp

Table: eligible_project_types
- id: uuid (primary key)
- opportunity_id: uuid (foreign key to funding_opportunities)
- project_type: enum (Energy_Efficiency, Renewable_Energy, HVAC, Lighting, etc.)
- created_at: timestamp

Table: eligible_applicants
- id: uuid (primary key)
- opportunity_id: uuid (foreign key to funding_opportunities)
- applicant_type: enum (K12, Municipal, County, State, Higher_Ed, etc.)
- created_at: timestamp

Table: client_opportunity_matches
- id: uuid (primary key)
- client_id: uuid (foreign key to clients table)
- opportunity_id: uuid (foreign key to funding_opportunities)
- match_score: numeric (0-100)
- notes: text
- created_at: timestamp
- updated_at: timestamp

Table: opportunity_tasks
- id: uuid (primary key)
- opportunity_id: uuid (foreign key to funding_opportunities)
- title: text
- description: text
- due_date: timestamp
- assigned_to: uuid (foreign key to users)
- status: enum (Not_Started, In_Progress, Completed)
- created_at: timestamp
- updated_at: timestamp
```

### 6.2 NextJS API Routes for Funding Management

```
// Funding Sources
GET /api/funding/sources - List all funding sources
GET /api/funding/sources/:id - Get details for specific source
POST /api/funding/sources - Create new funding source
PUT /api/funding/sources/:id - Update funding source

// Funding Programs
GET /api/funding/programs - List all programs
GET /api/funding/programs/:id - Get program details
GET /api/funding/sources/:id/programs - Get programs for specific source
POST /api/funding/programs - Create new program
PUT /api/funding/programs/:id - Update program

// Funding Opportunities
GET /api/funding/opportunities - List all opportunities (with filter params)
GET /api/funding/opportunities/:id - Get opportunity details
GET /api/funding/opportunities/open - Get currently open opportunities
GET /api/funding/opportunities/upcoming - Get soon-to-open opportunities
POST /api/funding/opportunities - Create new opportunity
PUT /api/funding/opportunities/:id - Update opportunity

// Client Matching
GET /api/funding/matches/client/:id - Get opportunities matching a client
POST /api/funding/matches/generate - Generate matches for all clients
PUT /api/funding/matches/:id - Update match details

// Timeline and Tasks
GET /api/funding/tasks/upcoming - Get upcoming tasks
GET /api/funding/tasks/user/:id - Get tasks for specific user
POST /api/funding/tasks - Create new task
PUT /api/funding/tasks/:id - Update task
```

### 6.3 Implementation Phases

#### Phase 1: Foundation (Weeks 1-4)
- Set up Supabase database schema
- Implement core NextJS application framework
- Create basic CRUD operations for funding sources and programs
- Develop initial dashboard views

#### Phase 2: Data Population (Weeks 5-8)
- Develop automated data collection from key sources
- Populate database with federal funding sources
- Add state-level programs for California
- Create initial client matching algorithm

#### Phase 3: Enhancement (Weeks 9-12)
- Add Oregon and Washington funding sources
- Implement notification system
- Develop timeline management features
- Create reporting and analytics capabilities

#### Phase 4: Expansion and Integration (Weeks 13-16)
- Integrate with Salesforce CRM
- Expand to utility and foundation funding sources
- Implement advanced opportunity matching
- Develop forecasting capabilities