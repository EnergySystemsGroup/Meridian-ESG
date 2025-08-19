# Policy & Funding Intelligence Sources

## 1. Legislation Sources

### 1.1 Federal Legislation

#### Congress.gov API
- **URL**: https://api.congress.gov/v3/
- **Authentication**: API Key (request at https://api.congress.gov/sign-up/)
- **Automation Methodology**: API polling (daily)
- **Data Focus**: Bills, resolutions, committee activities
- **Key Parameters**:
  - `bill.subject`: "Energy", "Infrastructure", "Education", "Building", "Transportation"
  - `bill.policyArea`: "Energy", "Education", "Public Lands and Natural Resources", "Transportation and Public Works"
  - `committee.name`: "Energy and Commerce", "Education and Labor", "Natural Resources", "Transportation and Infrastructure"
  - `congress`: Current congress number (118th as of 2023)
  - `billType`: "hr", "s", "hjres", "sjres" (House/Senate bills and joint resolutions)
- **Key Search Terms**:
  - Energy efficiency
  - Building performance
  - School infrastructure
  - Energy management
  - Renewable energy
  - Building modernization
  - Electric vehicle
  - Energy storage
  - Climate resilience
  - Grid modernization

#### Federal Register API
- **URL**: https://www.federalregister.gov/api/v1/
- **Authentication**: None required
- **Automation Methodology**: API polling (daily)
- **Data Focus**: Proposed rules, notices, executive orders
- **Key Parameters**:
  - `conditions[agencies][]`: "Department of Energy", "Environmental Protection Agency", "Department of Education", "Department of Transportation"
  - `conditions[type][]`: "PRORULE", "RULE", "NOTICE"
  - `conditions[significant]`: "1" (for significant regulatory actions)
  - `conditions[topics][]`: "Energy", "Environment", "Education", "Science and Technology"
- **Key Search Terms**:
  - Energy conservation
  - Building energy codes
  - Energy efficiency standards
  - Building performance standards
  - School facilities
  - Public building efficiency
  - Energy improvement program
  - Zero emissions buildings
  - Clean energy requirements
  - Climate resilience

#### GovInfo API
- **URL**: https://api.govinfo.gov/
- **Authentication**: API Key required
- **Automation Methodology**: API polling (weekly)
- **Data Focus**: Congressional documents, Federal Register, committee reports
- **Key Parameters**:
  - `collection`: "BILLS", "CRPT", "FR", "BUDGET"
  - `congressNumber`: Current congress
  - `dateIssued`: Range parameters for recency
- **Key Search Terms**:
  - Similar to Congress.gov terms above
  - Budget appropriations
  - Energy program funding
  - Infrastructure investment

### 1.2 California State Legislation

#### California Legislative Information API
- **URL**: https://leginfo.legislature.ca.gov/faces/billSearchClient.xhtml (web interface)
- **URL for Scraping**: https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Bills, committee analyses, votes, status
- **Scraping Strategy**:
  - Parse search results pages
  - Extract bill details from individual bill pages
  - Track status changes
- **Key Search Terms**:
  - Energy efficiency
  - Building standards
  - Title 24
  - School facility modernization
  - Public buildings
  - Climate adaptation
  - Electric vehicle infrastructure
  - Clean energy
  - Carbon reduction
  - Energy conservation
  - Green building
  - School energy efficiency
  - Zero net energy
  - Building decarbonization
  - Clean school bus

#### California Energy Commission Docket System
- **URL**: https://efiling.energy.ca.gov/Lists/DocketLog.aspx
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Energy regulations, proceedings, building standards updates
- **Key Parameters/Filters**:
  - Docket number (for building standards: "23-BSTD-01" for 2025 standards)
  - Year: Current year
  - Subject area: "Building Standards", "Energy Efficiency"
- **Key Search Terms**:
  - Building Energy Efficiency Standards
  - Title 24
  - Energy Code
  - BSTD (Building Standards)
  - Building decarbonization
  - Load management standards
  - Energy Commission proceedings

#### California Public Utilities Commission (CPUC) Proceedings
- **URL**: https://apps.cpuc.ca.gov/apex/f?p=401:1:0
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Energy efficiency proceedings, utility programs, rate cases
- **Key Parameters/Filters**:
  - Proceeding type: "Rulemaking" (R.)
  - Industry: "Energy", "Electric", "Gas"
- **Key Search Terms**:
  - Energy efficiency
  - Demand response
  - Building decarbonization
  - Customer programs
  - Energy savings
  - Energy Storage
  - School energy efficiency
  - Public building programs

### 1.3 Local Legislation (California)

#### City of Los Angeles Council File Management System
- **URL**: https://cityclerk.lacity.org/lacityclerkconnect/
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: City ordinances, motions, policies related to buildings and energy
- **Key Search Terms**:
  - Building energy
  - Energy efficiency
  - Climate change
  - Green building
  - Building electrification
  - Building performance standards
  - Public buildings
  - School buildings
  - Municipal buildings

#### City of San Francisco Legistar
- **URL**: https://sfgov.legistar.com/Legislation.aspx
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: City ordinances, regulations, building codes
- **Key Search Terms**:
  - Energy code
  - Building standards
  - Climate action
  - Electrification
  - Building performance
  - School facilities
  - Public buildings

#### City of Sacramento Legistar
- **URL**: https://sacramento.granicus.com/ViewPublisher.php?view_id=21
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: City council actions, building codes, climate policies
- **Key Search Terms**:
  - Building energy
  - Climate action
  - Energy efficiency
  - Building electrification
  - Building performance
  - Municipal buildings

## 2. Funding Sources

### 2.1 Federal Funding

#### Grants.gov API
- **URL**: https://www.grants.gov/web/grants/learn-grants/grant-api.html
- **Authentication**: API Key required
- **Automation Methodology**: API polling (daily)
- **Data Focus**: Federal grant opportunities across all agencies
- **Key Parameters**:
  - `keyword`: Energy efficiency terms (listed below)
  - `agencyCode`: "DOE", "EPA", "ED", "DOT", "USDA"
  - `cfda`: 
    - 81.041 (State Energy Program)
    - 81.086 (Conservation Research and Development)
    - 81.087 (Renewable Energy Research and Development)
    - 81.119 (State Energy Program Special Projects)
    - 84.401 (Impact Aid School Construction)
  - `oppStatus`: "posted", "forecasted"
- **Key Search Terms**:
  - Energy efficiency
  - Building modernization
  - Renewable energy
  - School facility
  - Building retrofit
  - Energy conservation
  - Clean energy
  - Electric vehicle
  - Building performance
  - Energy management
  - HVAC modernization
  - Infrastructure improvement
  - Energy savings
  - Energy storage
  - School building

#### Department of Energy Funding Portal
- **URL**: https://www.energy.gov/eere/buildings/funding-opportunities
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: BTO grants, loans, financing opportunities
- **Scraping Strategy**:
  - Monitor "Open Opportunities" section
  - Track "Upcoming Opportunities" section
  - Parse FOA announcement documents
- **Key DOM Elements**:
  - Funding opportunity cards
  - Deadline indicators
  - FOA numbers
  - Award amounts

#### EPA Clean School Bus Program
- **URL**: https://www.epa.gov/cleanschoolbus/clean-school-bus-program
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: School bus electrification funding
- **Scraping Strategy**:
  - Monitor "Funding" tab for new rounds
  - Track rebate vs. grant offerings
  - Parse program updates
  - Monitor webinar announcements

#### Department of Education Impact Aid Program
- **URL**: https://oese.ed.gov/offices/office-of-formula-grants/impact-aid-program/
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: School construction and facility funding
- **Key Sections to Monitor**:
  - Section 7007 Construction program
  - Emergency grants
  - Discretionary construction grants

### 2.2 California State Funding

#### California Energy Commission Funding
- **URL**: https://www.energy.ca.gov/funding-opportunities
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Energy efficiency, renewables, research grants
- **Key Parameters/DOM Elements**:
  - Funding category selectors
  - Status filters (Open, Upcoming, Closed)
  - Grant amount indicators
  - Deadline information
- **Key Programs to Track**:
  - School Energy Efficiency Stimulus (SEES)
  - Food Production Investment Program
  - Clean Transportation Program
  - Energy Conservation Assistance Act (ECAA)
  - Building Initiative for Low-Emissions Development (BUILD)

#### California Department of Education Facilities Funding
- **URL**: https://www.cde.ca.gov/fg/fo/af/
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: School facility funding
- **Key Programs to Track**:
  - School Facility Program
  - Deferred Maintenance Program
  - Career Technical Education Facilities Program
  - Charter School Facilities Program
  - Full-Day Kindergarten Facilities Grant Program

#### California State Water Resources Control Board
- **URL**: https://www.waterboards.ca.gov/water_issues/programs/grants_loans/
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Water efficiency funding relevant to buildings
- **Key Programs to Track**:
  - Water Recycling Funding Program
  - Clean Water State Revolving Fund
  - Water System Efficiency funding

#### California Strategic Growth Council
- **URL**: https://sgc.ca.gov/programs/
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Sustainable community funding
- **Key Programs to Track**:
  - Transformative Climate Communities
  - Affordable Housing and Sustainable Communities
  - Climate Change Research Program

### 2.3 California Utility Incentive Programs

#### Pacific Gas & Electric (PG&E)
- **URL**: https://www.pge.com/en_US/small-medium-business/save-energy-and-money/energy-efficiency-rebates/energy-efficiency-rebates.page
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Energy efficiency rebates and incentives
- **Key Programs to Track**:
  - Business Energy Efficiency Programs
  - Custom Retrofit Incentives
  - New Construction Incentives
  - Retrocommissioning Program
  - Savings By Design

#### Southern California Edison (SCE)
- **URL**: https://www.sce.com/business/tools-incentives
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Energy efficiency incentives
- **Key Programs to Track**:
  - Express Solutions
  - Customized Solutions
  - New Construction
  - Retrocommissioning
  - Schools Energy Efficiency Program

#### Southern California Gas Company (SoCalGas)
- **URL**: https://www.socalgas.com/for-your-business/energy-savings
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Gas efficiency programs
- **Key Programs to Track**:
  - Energy Efficiency Rebates
  - Energy Efficiency Calculated Incentive Program
  - On-Bill Financing
  - Food Service Equipment Rebates

#### Sacramento Municipal Utility District (SMUD)
- **URL**: https://www.smud.org/en/Business-Solutions-and-Rebates
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Electric efficiency rebates
- **Key Programs to Track**:
  - Complete Energy Solutions
  - Custom Incentives
  - Express Energy Solutions
  - Advanced Lighting Solutions

### 2.4 California Local Funding

#### Los Angeles Department of Water and Power
- **URL**: https://www.ladwp.com/ladwp/faces/ladwp/commercial/c-savemoney/c-sm-rebatesandprograms
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Energy and water efficiency incentives
- **Key Programs to Track**:
  - Commercial Direct Install
  - Custom Performance Program
  - Commercial Lighting Incentive Program
  - Commercial HVAC Optimization Program

#### Bay Area Air Quality Management District
- **URL**: https://www.baaqmd.gov/funding-and-incentives
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Clean air and energy incentives
- **Key Programs to Track**:
  - Climate Tech Finance
  - Clean Cars for All
  - Charge! Program (EV infrastructure)

#### City of San Francisco Department of Environment
- **URL**: https://sfenvironment.org/buildings-environments/green-building/financing
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Green building incentives
- **Key Programs to Track**:
  - Commercial PACE Financing
  - BayREN Business Programs
  - Energy Upgrade California

#### City of Los Angeles Sustainability Programs
- **URL**: https://www.lamayor.org/sustainability
- **Authentication**: None required
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Municipal building and energy programs
- **Key Programs to Track**:
  - Green New Deal programs
  - Building Forward LA
  - Resilient Los Angeles initiatives

## 3. Industry/Advocacy Sources for Early Intelligence

### 3.1 Industry Associations

#### American Council for an Energy-Efficient Economy (ACEEE)
- **URL**: https://www.aceee.org/
- **RSS Feed**: https://www.aceee.org/feed
- **Automation Methodology**: RSS feed monitoring
- **Data Focus**: Policy updates, program analysis, research
- **Key Topics to Track**:
  - Building efficiency policies
  - Energy efficiency programs
  - Local policy scorecards
  - Utility program developments

#### U.S. Green Building Council (USGBC)
- **URL**: https://www.usgbc.org/
- **RSS Feed**: https://www.usgbc.org/rss.xml
- **Automation Methodology**: RSS feed monitoring
- **Data Focus**: Green building policies, incentives
- **Key Topics to Track**:
  - LEED incentives
  - Policy developments
  - State and local action
  - School buildings initiatives

#### Alliance to Save Energy
- **URL**: https://www.ase.org/
- **RSS Feed**: https://www.ase.org/blog/feed
- **Automation Methodology**: RSS feed monitoring
- **Data Focus**: Energy efficiency policy
- **Key Topics to Track**:
  - Federal energy efficiency policy
  - State policy trends
  - BuildingAction Coalition updates
  - Energy efficiency program funding

### 3.2 Research Organizations

#### Lawrence Berkeley National Laboratory
- **URL**: https://buildings.lbl.gov/
- **Automation Methodology**: HTML scraping with change detection
- **Data Focus**: Building technology research, program evaluation
- **Key Topics to Track**:
  - Building technology assessments
  - Program evaluations
  - New research funding
  - Technical resource publications

#### Rocky Mountain Institute (RMI)
- **URL**: https://rmi.org/our-work/buildings/
- **RSS Feed**: https://rmi.org/feed/
- **Automation Methodology**: RSS feed monitoring
- **Data Focus**: Building decarbonization, policy innovation
- **Key Topics to Track**:
  - Building electrification initiatives
  - Policy innovation
  - New program designs
  - Retrofit acceleration

## 4. Extraction Strategy Standardization

### 4.1 Standard Data Elements for Legislation

- Bill number/identifier
- Title
- Sponsors/authors
- Introduction date
- Current status
- Last action date
- Committee assignments
- Scheduled hearings
- Full text URL
- Summary text
- Relevant sections related to:
  - Funding appropriations
  - Program authorizations
  - Building requirements
  - Energy standards
  - Implementation timelines

### 4.2 Standard Data Elements for Funding

- Program name
- Funding source/agency
- Total funding available
- Individual award ranges
- Application open date
- Application deadline
- Eligibility requirements
- Matching fund requirements
- Project timeframes
- Technology/measure eligibility
- Program guidelines URL
- Contact information
- Information sessions/webinars
- Related legislation (if applicable)

### 4.3 Search Term Groups for Comprehensive Coverage

#### Energy Efficiency Terms
- Energy efficiency
- Energy conservation
- Energy management
- Energy savings
- Building performance
- High-performance building
- Energy reduction
- Energy optimization
- Weatherization
- Insulation
- Building envelope
- Energy audit
- Retrocommissioning
- Energy Star
- Green building

#### HVAC & Mechanical Terms
- HVAC modernization
- HVAC replacement
- HVAC efficiency
- Heating systems
- Cooling systems
- Ventilation improvement
- Air quality
- Heat pumps
- Geothermal heating
- Boiler replacement
- Chiller efficiency
- Variable frequency drive
- Building controls
- Building automation
- Energy management system

#### Renewable Energy Terms
- Solar energy
- Solar photovoltaic
- Solar thermal
- Wind energy
- Geothermal energy
- Renewable energy
- Clean energy
- Distributed generation
- Microgrids
- Battery storage
- Energy storage
- Net zero energy
- Zero net energy
- Carbon neutral
- Emissions reduction

#### Electrification Terms
- Building electrification
- Electric vehicle charging
- EV infrastructure
- Fleet electrification
- Electric school bus
- Transportation electrification
- Fossil fuel reduction
- Natural gas reduction
- Heat pump water heater
- Electric heating
- All-electric building
- Beneficial electrification

#### Building Types & Sectors
- School buildings
- K-12 facilities
- Educational facilities
- Public buildings
- Municipal buildings
- Government facilities
- Commercial buildings
- Institutional buildings
- Healthcare facilities
- Community buildings
- Libraries
- Recreation centers
- Administrative buildings
- Campus buildings
- District energy

#### Water Efficiency Terms
- Water conservation
- Water efficiency
- Drought resilience
- Water recycling
- Greywater systems
- Rainwater harvesting
- Low-flow fixtures
- Water management
- Irrigation efficiency
- Water heating efficiency
- Water-energy nexus