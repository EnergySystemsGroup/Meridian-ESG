# Taxonomy Review Scratchpad

## Purpose
Track all decisions made during the project types and activities taxonomy cleanup.
This document is the source of truth for what changed, why, and what data migration is needed.

## Business Context
Meridian is a funding intelligence platform for **energy services general contractors (ESCOs/GCs)**.
The clients are entities that need building/facility work: K-12 schools, hospitals, local governments, etc.
The GC's core work is **physical construction, renovation, and installation of building systems and energy infrastructure**.

Programs that fund research, conservation, public health, or other non-construction domains are out of scope
even if they incidentally mention building-related keywords.

## Review Phases
1. **Project Types** (current focus) — remove, narrow, re-tier, add subcategories
2. **Activities** — same treatment, after project types are settled
3. **Data cleanup** — re-process existing opportunities against new taxonomy
4. **Re-run matching** — verify improved match quality

---

## Phase 1: Project Types — Consolidated Decisions Log

Legend: **[P]** = parent with subcategories | **[SUB]** = subcategory (indented under parent) | **NEW** = proposed addition | **NARROW** = renamed | **RE-TIER** = moved tiers | **REMOVE** = delete

---

### HOT TIER — Building Systems

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 1 | **[P]** HVAC Systems | Existing hot | KEEP hot | Core GC. Parent of 3 subcategories. |
| 2 | ↳ **[SUB]** Heat Pump Systems | **NEW** | ADD hot | IRA 25C rebates, DOE deployment. #1 electrification measure. |
| 3 | ↳ **[SUB]** Boiler Systems | **NEW** | ADD strong | DOE heating programs, state boiler replacement grants. |
| 4 | ↳ **[SUB]** Chiller Systems | **NEW** | ADD strong | DOE chiller replacement, utility optimization rebates. |
| 4b | ↳ **[SUB]** Building Air Filtration Systems | Was mild (Air Filtration Systems) | **NARROW + RE-TIER → hot (sub)** | Matches CDC/industrial. GC: building HVAC filtration. Post-COVID relevance. Core HVAC work. |
| 5 | **[P]** Lighting Systems | Existing hot | KEEP hot | Core GC. Parent of 2 subcategories. |
| 6 | ↳ **[SUB]** LED Lighting Upgrades | **NEW** | ADD hot | Utility per-fixture rebates, DOE Better Buildings. #1 ESCO measure by volume. |
| 6b | ↳ **[SUB]** Street Lighting | Was mild | **RE-TIER → strong (sub)** | LED street lighting conversions are bread-and-butter ESCO. |
| 7 | **[P]** Electrical Systems | Existing hot | KEEP hot | Core GC. Parent of 2 subcategories. |
| 8 | ↳ **[SUB]** EV Charging Stations | Existing hot | KEEP hot | Already exists. NEVI, utility make-ready, IRA 30C. |
| 9 | ↳ **[SUB]** Electrical Panel Upgrades | **NEW** | ADD hot | IRA electrification, state panel upgrade programs. |
| 9b | ~~Emergency Backup Power Systems~~ | — | **MOVED** | → See Energy Infrastructure, now standalone next to Battery Storage Systems. |
| 10 | Plumbing Systems | Existing hot | KEEP hot | Core GC. No subcategories needed. |
| 11 | Fire Suppression Systems | Existing hot | **RE-TIER → strong** | Sprinklers, fire alarm systems. Important but not core ESCO revenue. |
| 12 | Elevators | Existing hot | **RE-TIER → strong** | Elevator modernization. Important but specialized. |
| 13 | Lifts | Existing hot | **RE-TIER → strong** | Wheelchair/platform lifts. Important but specialized. |
| 14 | Security Systems | Existing hot | KEEP hot | Access control, intrusion detection. |
| 15 | Communication Systems | Existing hot | **NARROW + RE-TIER → strong** | → **Intercom Systems**. Matches telecom/cellular. GC: intercoms, PA, nurse call, clock/bell systems. |
| 16 | Building Automation Systems | Existing hot | **NARROW** hot | → **Building Controls**. Consolidates BAS/BMS + thermostats, DDC, pneumatic-to-digital. Broader and clearer. AI will still catch "BAS" references. |
| 17 | Refrigeration Systems | Existing hot | KEEP hot | Walk-in coolers, commercial refrigeration. |
| 19 | Water Heater Systems | **NEW** | ADD hot | Heat pump water heaters — major electrification measure. |

### HOT TIER — Building Envelope

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 20 | Roofing | Existing hot | KEEP hot | Core building envelope. |
| 21 | Windows | Existing hot | KEEP hot | Core building envelope. |
| 22 | Doors | Existing hot | KEEP hot | Core building envelope. |
| 23 | Insulation | Existing hot | KEEP hot | Core building envelope. |
| 24 | Exterior Walls | Existing hot | KEEP hot | Core building envelope. |
| 25 | Siding | Existing hot | KEEP hot | Core building envelope. |
| 26 | Foundation Repair | Existing hot | KEEP hot | Core building envelope. |
| 27 | Weatherization | Existing hot | KEEP hot | Major DOE/utility program area. |
| 28 | Flooring | Existing hot | KEEP hot | Core building envelope. |

### HOT TIER — Energy Infrastructure

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 29 | Solar Panels | Existing hot | **NARROW** hot | → **Solar Panel Systems**. Consolidates Solar Panels + Solar Arrays into one term. No funder distinguishes between them. |
| 30 | Solar Arrays | Existing hot | **REMOVE (merged)** | Consolidated into "Solar Panel Systems" above. |
| 31 | Wind Turbines | Existing hot | KEEP hot | On-site wind for facilities. |
| 32 | Battery Storage Systems | Existing hot | KEEP hot | Core energy infrastructure. |
| 32b | Emergency Backup Power Systems | Was mild | **RE-TIER → strong** | Generators, UPS, ATS. Sits alongside Battery Storage — both are about power availability. Different funding lane (FEMA, hospital preparedness) but same domain. |
| 33 | Geothermal Systems | Existing hot | KEEP hot | Core energy infrastructure. |
| 34 | Energy Management Systems | Existing hot | **REMOVE** | Too broad — matches any energy program. Actual GC work (submetering) is never funded standalone; always part of HVAC/lighting projects. |
| 35 | Microgrids | Existing hot | KEEP hot | Core energy infrastructure. |
| 36 | Fuel Cells | Existing hot | KEEP hot | Core energy infrastructure. |
| 37 | Cogeneration Systems | Existing hot | **RE-TIER → strong** | CHP (Combined Heat & Power). Legitimate but niche — hospitals, universities, large municipal. |

### STRONG TIER — Water Infrastructure

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 38 | **[P]** Drinking Water Infrastructure | **NEW** (replaces Water Treatment Plants, Water Distribution Systems, Pump Stations) | ADD strong | Consolidates clean water side. Parent of 2 subcategories. **AI guidance note needed:** "Municipal and facility water treatment, distribution, and piping. Excludes dams, reservoirs, and heavy civil impoundment projects." |
| 39 | ↳ **[SUB]** Water Metering Systems | Existing strong (was Water Meters) | **NARROW** strong | Smart meters, AMI deployments. Specifically funded by utilities and state programs. |
| 40 | ↳ **[SUB]** Water Storage Tanks | Existing strong | KEEP strong | Team has specifically requested this. Funded separately in capital improvement programs. |
| 41 | **[P]** Wastewater Infrastructure | **NEW** (replaces Wastewater Treatment Plants) | ADD strong | Consolidates wastewater side. Parent of 1 subcategory. |
| 42 | ↳ **[SUB]** Sewer Systems | Existing strong | KEEP strong | Sewer line replacement/rehabilitation has dedicated funding (EPA, state aging infrastructure). |
| 43 | Stormwater Infrastructure | Existing strong (was Stormwater Management Systems) | **NARROW** strong | Renamed for consistency with Drinking Water/Wastewater naming. Standalone — no subcategories. |
| 46 | Water Reservoirs | Existing strong | **REMOVE** | Heavy civil/dam engineering, not GC scope. Guidance note on Drinking Water Infrastructure will exclude dams/reservoirs. |
| 47 | Irrigation Systems | Existing strong | **MOVED** | → See Grounds & Site Work. Now "Landscape Irrigation Systems" as subcategory of Landscaping. |
| 48 | Fire Hydrants | Existing strong | **RE-TIER → mild** | Municipal water system, not primary GC. |

### STRONG TIER — Technology & Infrastructure

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 49 | IT Infrastructure | Existing strong | **NARROW + RE-TIER → mild** | → **Building IT Infrastructure**. Merges with Networks (#50). GC: cable, racks, server rooms, structured cabling. |
| 50 | Networks | Existing strong | **REMOVE (merged)** | Consolidated into "Building IT Infrastructure" above. |
| 51 | Data Centers | Existing strong | KEEP strong | GCs build data center facilities. |
| 52 | Telecommunications Equipment | Existing strong | **REMOVE (redundant)** | Already covered by "Intercom Systems" (#15). |
| 53 | Broadband Infrastructure | Existing strong | **RE-TIER → mild** | Fiber buildout is telecom/ISP work. |
| 54 | Manufacturing Equipment | Existing strong | **REMOVE** | CNC machines — not building systems. |
| 55 | Agricultural Equipment | Existing strong | **REMOVE** | Tractors/harvesters — completely outside GC scope. |

### STRONG TIER — Facility Types

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 56 | Classroom Facilities | Existing strong | KEEP strong | Generic school facility catch-all. Covers labs, media centers, auditoriums, etc. |
| 57 | Laboratory Facilities | Existing strong | **REMOVE (redundant)** | Just "school renovation" in practice. Covered by Classroom Facilities. |
| 58 | Computer Lab Facilities | Existing strong | **REMOVE (redundant)** | Same. Increasingly irrelevant as schools move to 1:1 devices. |
| 59 | Cafeteria Facilities | Existing strong | **REMOVE (redundant)** | Dining side of Kitchen Facilities. Funders bundle them together. |
| 60 | Kitchen Facilities | Existing strong | KEEP strong | Has its own funding lane (CDE kitchen infrastructure grants). |
| 61 | Gymnasium Facilities | Existing strong | KEEP strong | Called out in school bond measures. Team may search specifically. |
| 62 | Media Center Facilities | Existing strong | **REMOVE (redundant)** | Just part of school renovation. Covered by Classroom Facilities. |
| 63 | Vocational Facilities | Existing strong | **REMOVE (redundant)** | CTE vs K-12 is an applicant type distinction, not project type. |
| 64 | CTE Facilities | Existing strong | **REMOVE (redundant)** | Same as Vocational Facilities. |
| 65 | Community Center Facilities | Existing strong | KEEP strong | Has own funding lane (CDBG, state community development). |
| 66 | Library Facilities | Existing strong | KEEP strong | State library construction grants, bond measures. |
| 67 | Museum Facilities | Existing strong | **REMOVE (redundant)** | Museum grants fund programming, not GC building work. Covered by general facility funding. |
| 68 | Theater Facilities | Existing strong | **REMOVE (redundant)** | Same as Museum. NEA funds programming, not construction. |
| 69 | Auditorium Facilities | Existing strong | **REMOVE (redundant)** | Part of school or community center projects. Not independently funded. |
| 69b | Healthcare Facilities | **NEW** (consolidates Hospital Facilities, Clinics, Health Centers) | ADD strong | Captures "funding for building work at healthcare settings." |
| 69c | Student Housing | Was weak | **RE-TIER → strong** | Dorm construction; higher ed is core client. |
| 69d | ADA Accessibility Improvements | **NEW** | ADD strong | Ramps, restrooms, door automation. Federal/state ADA compliance programs. |

### STRONG TIER — Grounds & Site Work

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 70 | Playgrounds | Existing strong | KEEP strong | School playground installation. |
| 71 | Athletic Fields | Existing strong | KEEP strong | Turf, grading, drainage, lighting. |
| 72 | Athletic Courts | Existing strong | KEEP strong | School/community courts. |
| 73 | Fencing | Existing strong | **NARROW** strong | → **Perimeter Fencing**. Consolidates Fencing + Gates. School security fencing, CDBG facility fencing. |
| 74 | Gates | Existing strong | **REMOVE (merged)** | Consolidated into "Perimeter Fencing" above. |
| 75 | Pavilions | Existing strong | **REMOVE (merged)** | Covered by "Shade Structures" below. |
| 76 | Shelters | Existing strong | **NARROW** strong | → **Shade Structures**. School/park shade canopies, outdoor covers. Has specific heat resilience funding in CA/Southwest. Absorbs Pavilions. |
| 76b | **[P]** Landscaping | Was weak | **RE-TIER → strong** | Routine site work in every school/facility project. Parent of 1 subcategory. |
| 76c | ↳ **[SUB]** Landscape Irrigation Systems | Was strong (Irrigation Systems) | **NARROW → strong (sub)** | Sprinkler zones, drip lines, controllers. **AI guidance:** "Facility landscape irrigation only. Not agricultural." |
| 76d | Recreational Park Facilities | Was mild (Parks) | **NARROW → mild** | Local/neighborhood park construction. **AI guidance:** "Restrooms, lighting, paths, splash pads at local parks. Excludes state/regional land acquisition, conservation, habitat restoration." |


### STRONG TIER — Environmental Remediation

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 85 | Asbestos Abatement | **NEW** | ADD strong | EPA programs, state school facility programs. Prerequisite to renovation. |
| 86 | Lead Paint Remediation | **NEW** | ADD strong | EPA/HUD dedicated programs for schools and public housing. |

### STRONG TIER — Other additions

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 87 | Energy Audits | **NEW** | **REMOVE from project types** | This is an activity, not a project type. Flagged for Phase 2 (activities review). |

### Removed from proposed additions

| # | Term | Decision | Notes |
|---|------|----------|-------|
| — | Indoor Air Quality Systems | **REMOVE (redundant)** | Covered by Building Air Filtration Systems (HVAC sub) + Building Ventilation Improvements (mild). |
| — | Building Envelope Improvements | **REMOVE (redundant)** | Specific envelope terms already in hot: Roofing, Windows, Insulation, etc. |
| — | Variable Frequency Drives | **REMOVE (redundant)** | Always part of broader HVAC projects. Never independently funded. |
| — | ADA Accessibility Improvements | **MOVED** | → See Facility Types section (#69d). |

### MILD TIER — Transportation

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 93 | Roads | Existing mild | KEEP mild | Site roads for campuses. |
| 94 | Streets | Existing mild | KEEP mild | Site roads. |
| 95 | Bridges | Existing mild | KEEP mild | Pedestrian bridges, small spans. |
| 96 | Sidewalks | Existing mild | KEEP mild | Site work. |
| 97 | Walkways | Existing mild | KEEP mild | Site work. |
| 98 | Bike Lanes | Existing mild | KEEP mild | Transportation infrastructure. |
| 99 | Bike Paths | Existing mild | KEEP mild | Transportation infrastructure. |
| 100 | Parking Lots | Existing mild | KEEP mild | Paving, lighting, EV charging. |
| 101 | Parking Structures | Existing mild | KEEP mild | Facility construction. |
| 102 | Traffic Signals | Existing mild | KEEP mild | Transportation infrastructure. |
| 103 | Bus Stops | Existing mild | KEEP mild | Transportation infrastructure. |
| 104 | Bus Shelters | Existing mild | KEEP mild | Small structure construction. |
| 105 | Rail Infrastructure | Existing mild | KEEP mild | Tangential but possible. |
| 106 | Pedestrian Crossings | Existing mild | KEEP mild | Transportation infrastructure. |
| 107 | Fleet Vehicles | Existing mild | KEEP mild | Electric fleet conversions. |
| 108 | Airports | Existing mild | KEEP mild | Terminal/hangar facility work. |

### MILD TIER — Public Safety

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 109 | Fire Stations | Existing mild | KEEP mild | GCs build/renovate fire stations. |
| 110 | Police Stations | Existing mild | KEEP mild | Facility construction. |
| 111 | Emergency Operations Centers | Existing mild | KEEP mild | Facility construction. |
| 112 | 911 Centers | Existing mild | KEEP mild | Facility build-outs. |
| 113 | Dispatch Centers | Existing mild | KEEP mild | Facility build-outs. |
| 114 | Correctional Facilities | Existing mild | KEEP mild | Large facility projects. |
| 115 | Security Cameras | Existing mild | **REMOVE (redundant)** | Already covered by Security Systems (hot, #14). |
| 116 | Surveillance Systems | Existing mild | **REMOVE (redundant)** | Already covered by Security Systems (hot, #14). |

### MILD TIER — Climate Resilience

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 117 | Flood Barriers | Existing mild | KEEP mild | Climate resilience construction. |
| 118 | **[P]** Heat Resilience Infrastructure | **NEW** (replaces Urban Heat Island Mitigation) | ADD mild | Cool roofs, splash pads, cool pavements, misting systems. **AI guidance:** "Physical construction for heat mitigation. Excludes planning studies and urban forestry." Parent of 1 subcategory. |
| 118b | ↳ **[SUB]** Cooling Centers | Existing mild | KEEP mild (sub) | Specifically funded as standalone facilities. |
| 119 | Warming Centers | Existing mild | KEEP mild | Cold resilience — standalone, not under heat resilience. |
| 120 | Drought Mitigation Systems | Existing mild | **REMOVE** | Too vague — matches ag/policy programs. Covered by Plumbing Systems and Drinking Water Infrastructure. |
| 121 | Wildfire Prevention Infrastructure | Existing mild | **REMOVE** | Too broad — matches CalFire forestry. Covered by Building Envelope terms and Landscaping. |
| 122 | Green Infrastructure | Existing mild | **NARROW** mild | → **Urban Greening**. Green roofs, urban tree canopy, tree planting, urban gardens. **AI guidance:** "Green roofs, tree canopy, tree planting, urban gardens at facilities/communities. Excludes rural forestry, wetland restoration, habitat conservation." |
| 123 | Urban Heat Island Mitigation | Existing mild | **REMOVE (merged)** | Consolidated into Heat Resilience Infrastructure above. |
| 124 | Decontamination Systems | Existing mild | **REMOVE** | Extremely niche. Always part of larger hospital/lab renovation. Covered by Healthcare Facilities + building system terms. |
| 125 | Ventilation Improvements | Existing mild | **REMOVE** | Just HVAC work. Covered by HVAC Systems (hot) and Building Air Filtration Systems (hot sub). |

### MILD TIER — Demoted from strong

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 126 | Water Reservoirs | Was strong | **REMOVE** | Already removed earlier. Heavy civil/dam engineering. |
| 127 | Irrigation Systems | Was strong | **MOVED** | Already handled — now "Landscape Irrigation Systems" under Landscaping in Grounds & Site Work. |
| 128 | Fire Hydrants | Was strong | **RE-TIER → mild** | Cities may need funding for these. Keep as standalone mild. No duplicate exists. |
| 129 | Broadband Infrastructure | Was strong | **REMOVE** | Covered by Building IT Infrastructure (mild). Fiber buildout is telecom/ISP work. |

### MILD TIER — New additions

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 130 | Electric Vehicle Fleet Infrastructure | **NEW** | **NARROW** mild | → **EV Fleet**. Tangential — not direct GC work, but school bus/municipal fleet electrification grants lead to depot electrical, charging infrastructure, and facility work for the GC. Door-opener. |
| 131 | Demolition | **NEW** | **REMOVE** | Always part of larger project, never funded standalone. |
| 132 | Modular/Portable Buildings | **NEW** | **REMOVE** | Construction method, not a project type. |

### WEAK TIER — Kept

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 133 | Kitchen Equipment | Existing weak | KEEP weak | Commercial kitchen projects (weak signal). |
| 143 | Brownfield Remediation | Existing weak | KEEP weak | EPA brownfield grants. GC does demolition, excavation, containment. Door-opener to construction on cleaned sites. |
| 147 | Industrial Parks | Existing weak | KEEP weak | Site development. |

### WEAK TIER — Removed

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 134 | Computers | Existing weak | **REMOVE** | Equipment procurement. School tech bonds not GC scope. |
| 135 | Affordable Housing Units | Existing weak | **REMOVE** | Residential — not core GC scope. |
| 136 | Homeless Shelters | Existing weak | **REMOVE** | Too niche. Building systems work captured by other terms. |
| 137 | Transitional Housing | Existing weak | **REMOVE** | Same. |
| 138 | Senior Housing | Existing weak | **REMOVE** | Same. |
| 139 | Emergency Rooms | Existing weak | **REMOVE** | Covered by Healthcare Facilities. |
| 140 | Mental Health Facilities | Existing weak | **REMOVE** | Too niche. |
| 141 | Rehabilitation Centers | Existing weak | **REMOVE** | Too niche. |
| 142 | Erosion Control | Existing weak | **REMOVE** | Specialized environmental work. |
| 143 | Brownfield Remediation | Existing weak | **MOVED** | Kept — see Weak Tier Kept section. |
| 144 | Recycling Facilities | Existing weak | **REMOVE** | Too niche. |
| 145 | Business Incubators | Existing weak | **REMOVE** | Too niche. |
| 146 | Co-working Spaces | Existing weak | **REMOVE** | Too niche. |
| 148 | Commercial Kitchens | Existing weak | **REMOVE** | Covered by Kitchen Facilities (strong) + Kitchen Equipment (weak). |
| 149 | Food Banks | Existing weak | **REMOVE** | Too niche. |
| 150 | Food Processing Facilities | Existing weak | **REMOVE** | Too niche. |
| 151 | Workforce Development Centers | Existing weak | **REMOVE** | Too niche. |
| 152 | Job Training Facilities | Existing weak | **REMOVE** | Too niche. |
| 153 | Conference Centers | Existing weak | **REMOVE** | Too niche. |
| 154 | Emergency Shelters | Existing weak | **REMOVE** | Too niche. |
| 155 | Emergency Supplies Storage | Existing weak | **REMOVE** | Too niche. |
| 156 | Emergency Communication Systems | Existing weak | **REMOVE** | Too niche. |
| 157 | Backup Water Systems | Existing weak | **REMOVE** | Covered by Drinking Water Infrastructure. |

### WEAK TIER — Demoted from mild

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| 158 | Emergency Alert Systems | Was mild | **REMOVE** | Equipment procurement. |
| 159 | Ports | Was mild | **RE-TIER → weak** | Keep — heavy civil but GC-adjacent. |
| 160 | Harbors | Was mild | **RE-TIER → weak** | Keep — same as Ports. |
| 161 | Runways | Was mild | **REMOVE** | FAA-specialized, not GC scope. |
| 162 | Seawalls | Was mild | **REMOVE** | Marine/coastal civil engineering. |
| 163 | Levees | Was mild | **REMOVE** | Heavy civil/Army Corps territory. |
| 164 | Storm Surge Protection | Was mild | **REMOVE** | Same as Seawalls/Levees. |

### REMOVED — Out of domain (29 terms)

| # | Term | Was Tier | Why Remove |
|---|------|----------|------------|
| R1 | Fire Trucks | mild | **KEEP → weak**. Vehicle procurement but tangential — door-opener for fire station facility work. |
| R2 | Fire Equipment | mild | Equipment procurement; fire suppression in hot. |
| R3 | Personal Protective Equipment | mild | PPE procurement. |
| R4 | Safety Equipment | mild | Equipment procurement. |
| R5 | Hazmat Equipment | mild | Specialized equipment procurement. |
| R6 | Biosafety Equipment | mild | BSL lab equipment. |
| R7 | Radiation Detection Equipment | mild | Homeland security equipment. |
| R8 | Climate Monitoring Equipment | mild | Weather stations/sensors. |
| R9 | Green Spaces | mild | Matches ecological conservation; false positive factory. |
| R10 | Laboratory Equipment | weak | 169 opps, never matched; largest noise source. |
| R11 | Tablets | weak | Pure device procurement. |
| R12 | Software Systems | weak | No construction relevance. |
| R13 | Office Equipment | weak | Printers, desks, copiers. |
| R14 | Medical Equipment | weak | MRI machines, surgical tools. |
| R15 | Ambulances | weak | **KEEP → weak**. Vehicle procurement but tangential — door-opener for healthcare/emergency facility work. |
| R16 | Emergency Vehicles | weak | Vehicle procurement. |
| R17 | Disaster Response Equipment | weak | FEMA equipment procurement. |
| R18 | Mobile Command Centers | weak | Vehicle procurement. |
| R19 | Emergency Medical Supplies | weak | Supply procurement. |
| R20 | Search and Rescue Equipment | weak | Equipment procurement. |
| R21 | Wetland Restoration | weak | Ecological conservation. |
| R22 | Forest Management | weak | Forestry. |
| R23 | Wildlife Habitat | weak | Conservation biology. |
| R24 | Air Quality Monitoring | weak | EPA surveillance, not construction. |
| R25 | Composting Systems | weak | Agricultural/waste management. |
| R26 | Farmers Markets | weak | Events/programs; structures covered by Pavilions. |
| R27 | Tourism Infrastructure | weak | Matches marketing/visitor programs; too vague. |
| R28 | Manufacturing Equipment | strong | CNC machines; not building systems. |
| R29 | Agricultural Equipment | strong | Tractors/harvesters; outside GC scope. |

---

## Phase 2: Activities

### Decisions Log

| Term | Current Tier | Decision | New Term / New Tier | Rationale |
|------|-------------|----------|-------------------|-----------|
### STRONG TIER — Supporting activities

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| A11 | Site Preparation | Existing strong | KEEP strong | Supporting construction. |
| A12 | Maintenance | Existing strong | KEEP strong | Ongoing facility maintenance contracts. |
| A13 | Demolition | Existing strong | KEEP strong | Precursor to new construction. |
| A14 | Removal | Existing strong | KEEP strong | Abatement, tank removal, etc. |
| A15 | Design | Existing strong | KEEP strong | Professional service. |
| A16 | Architecture | Existing strong | KEEP strong | Professional service. |
| A17 | Engineering | Existing strong | KEEP strong | Professional service. |
| A18 | Planning | Existing strong | KEEP strong | Professional service. |
| A19 | Feasibility Studies | Existing strong | KEEP strong | Professional service. |
| A20 | Environmental Assessment | Existing strong | KEEP strong | Professional service. |
| A21 | Consulting Services | Existing strong | KEEP strong | Professional service. |
| A22 | Project Management | Existing strong | KEEP strong | Professional service. |

### MILD TIER — Kept

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| A23 | Equipment Purchase | Existing mild | KEEP mild | Consolidates all procurement. Covers fire trucks, materials, technology, everything. |
| A24 | Inspection | Existing mild | KEEP mild | Tangential but useful to know. |
| A25 | Testing | Existing mild | KEEP mild | Tangential but useful to know. |

### MILD TIER — Removed

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| A26 | Materials Purchase | Existing mild | **REMOVE (merged)** | Covered by Equipment Purchase. |
| A27 | Supplies Purchase | Existing mild | **REMOVE (merged)** | Covered by Equipment Purchase. |
| A28 | Vehicle Purchase | Existing mild | **REMOVE (merged)** | Covered by Equipment Purchase. |
| A29 | Technology Purchase | Existing mild | **REMOVE (merged)** | Covered by Equipment Purchase. |
| A30 | Software Purchase | Existing mild | **REMOVE (merged)** | Covered by Equipment Purchase. |
| A31 | Land Acquisition | Existing mild | **RE-TIER → weak** | Consolidates property transactions (Property Purchase, Right-of-Way, Easements). Tangential but relevant to park/facility projects. |
| A32 | Property Purchase | Existing mild | **REMOVE** | Same. |
| A33 | Right-of-Way Acquisition | Existing mild | **REMOVE** | Same. |
| A34 | Easements | Existing mild | **REMOVE** | Same. |

### WEAK TIER — Kept

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| A31 | Land Acquisition | Was mild | **RE-TIER → weak** | Consolidates property transactions. Tangential but relevant to park/facility projects. |
| A35 | Program Operations | Existing weak | KEEP weak | Utility/client may use. |
| A36 | Service Delivery | Existing weak | KEEP weak | Utility/client may use. |
| A37 | Staffing | Existing weak | KEEP weak | Utility/client may use. |
| A38 | Training | Existing weak | KEEP weak | Utility/client may use. |
| A39 | Technical Assistance | Existing weak | KEEP weak | Utility/client may use. |
| A40 | Community Outreach | Existing weak | KEEP weak | Utility/client may use. |
| A41 | Marketing | Existing weak | KEEP weak | Utility/client may use. |
| A42 | Research | Existing weak | KEEP weak | Useful to know if program is research-focused. |
| A43 | Pilot Programs | Existing weak | KEEP weak | Could lead to full-scale GC work. |
| A44 | Program Administration | Existing weak | KEEP weak | Utility/client may use. |
| A45 | Reporting | Existing weak | KEEP weak | Utility/client may use. |
| A46 | Permits | Existing weak | KEEP weak | GCs pull permits. |
| A47 | Fees | Existing weak | KEEP weak | Part of project cost. |
| A48 | Insurance | Existing weak | KEEP weak | Part of project cost. |
| A49 | Legal Services | Existing weak | KEEP weak | Part of project cost. |

### WEAK TIER — Removed

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| A50 | Personnel | Existing weak | **REMOVE** | Redundant with Staffing. |
| A51 | Education | Existing weak | **REMOVE** | Ambiguous — could match education sector programs. |
| A52 | Capacity Building | Existing weak | **REMOVE** | Vague bureaucratic term. |
| A53 | Communications | Existing weak | **REMOVE** | Too vague. |
| A54 | Data Collection | Existing weak | **REMOVE** | Research activity, not GC-relevant. |
| A55 | Data Analysis | Existing weak | **REMOVE** | Same. |
| A56 | Evaluation | Existing weak | **REMOVE** | Same. |
| A57 | Demonstration Projects | Existing weak | **REMOVE** | "Demonstration" causes substring matching issues with research programs. |
| A58 | Grant Management | Existing weak | **REMOVE** | Admin overhead, not useful signal. |
| A59 | Monitoring | Existing weak | **REMOVE** | Too vague — matches environmental/public health monitoring. |
| A60 | Compliance Activities | Existing weak | **REMOVE** | Admin overhead. |

### HOT TIER — Core revenue activities (drives matching)

| # | Term | Status | Decision | Notes |
|---|------|--------|----------|-------|
| A1 | New Construction | Existing hot | KEEP hot | Core GC activity. |
| A2 | Renovation | Existing hot | KEEP hot | Core GC activity. |
| A3 | Modernization | Existing hot | KEEP hot | Core GC activity. |
| A4 | Installation | Existing hot | KEEP hot | Core GC activity. |
| A5 | Replacement | Existing hot | KEEP hot | Core GC activity. |
| A6 | Upgrade | Existing hot | KEEP hot | Core GC activity. |
| A7 | Repair | Existing hot | KEEP hot | Core GC activity. |
| A8 | Infrastructure Development | Existing hot | **REMOVE** | Too broad — matches research infrastructure, IT, conservation. Already covered by the other 7 hot terms. Causes false positives via substring match with "Development." |
| A9 | Retrofit | **NEW** | ADD hot | ESCOs use this constantly. DOE weatherization retrofits, energy efficiency retrofits. Distinct from renovation. |
| A10 | Energy Audits | **NEW** | ADD hot | Flagged from Phase 1. Gateway to ESCO contracts. Distinct from Feasibility Studies (audit = "what to fix and how much savings" vs. feasibility = "should we do this?"). |

---

## Data Migration Notes
*(After taxonomy is finalized, document which opportunities need re-tagging and how)*

---

## Matching Algorithm Changes
*(Substring fix, score threshold, etc. — tracked separately from taxonomy)*
