# ELIGIBLE_PROJECT_TYPES — Subcategory Analysis

## Purpose

Determine which parent terms in the taxonomy need **subcategories** based on one test:

> "Do funding programs specifically fund distinct subcategories within this parent term, where matching on the parent alone would be too broad?"

The user is an energy services general contractor (ESCO/GC). Clients are K-12 schools, hospitals, local governments, higher education, etc. The funding landscape includes federal grants (DOE, EPA, USDA, HUD, ED), state programs (CEC, CPUC, OPSC), utility rebates (PG&E, SCE, SoCalGas), and tax credits (IRA/BIL provisions like 179D, 30C, 45L).

**Note:** This analysis uses the *post-scratchpad* taxonomy (incorporating proposed removals, narrowings, re-tierings, and additions from `scratchpad.md`).

---

## HOT Tier Analysis

### Building Systems — Core Business

**HVAC Systems** — **Subcategories proposed**

HVAC is the single broadest parent in the taxonomy. Funders routinely draw lines within HVAC:

| Subcategory | Tier | Funding Example | Why Parent Is Too Broad |
|-------------|------|-----------------|------------------------|
| Heat Pump Systems | hot | IRA heat pump rebate programs (25C), DOE Residential Cold Climate Heat Pump Challenge, utility heat pump incentives (PG&E Advanced HVAC program) | A client seeking heat pump deployment funding would get swamped by generic HVAC maintenance and replacement results. Heat pumps are the #1 electrification measure with dedicated funding streams. |
| Boiler Systems | strong | DOE Heating Equipment Replacement programs, state boiler replacement grants (MA Clean Energy Center), school modernization programs that specifically fund boiler replacement | Boiler replacement/conversion is a distinct project scope from rooftop unit replacement or ductwork. Many school facility programs specifically call out boiler replacement. |
| Chiller Systems | strong | DOE Federal Energy Management chiller replacement programs, utility chiller optimization rebates, state energy efficiency programs targeting cooling plant upgrades | Chiller projects are capital-intensive and separately scoped from air-handling or distribution work. Utility rebates often have separate chiller-specific incentive tiers. |

**Note:** Heat Pump Systems, Boiler Systems, and Chiller Systems are already proposed as new standalone terms in the scratchpad (additions #1, #10, #11). This analysis confirms they should exist but frames them as HVAC subcategories rather than independent terms. The implementation decision (flat list vs. parent-child) is separate from the taxonomy question.

---

**Lighting Systems** — **Subcategories proposed**

| Subcategory | Tier | Funding Example | Why Parent Is Too Broad |
|-------------|------|-----------------|------------------------|
| LED Lighting Upgrades | hot | Utility LED rebate programs (virtually every IOU has one), DOE Better Buildings lighting retrofits, 179D tax deduction for lighting upgrades | LED retrofits are the #1 ESCO measure by volume. Utility rebates specifically target LED conversions with per-fixture incentives. A client doing an LED retrofit doesn't need results about emergency lighting or theatrical lighting systems. |

**Note:** LED Lighting Upgrades is already proposed as addition #2 in the scratchpad. This confirms it as a Lighting subcategory.

---

**Plumbing Systems** — **No subcategories needed**

Funders don't distinguish below this level for building plumbing. Water heater systems (proposed addition #5 in scratchpad) are sometimes lumped with plumbing but are more accurately an electrification/energy measure. No funder says "we specifically fund pipe replacement" vs. "fixture replacement."

---

**Electrical Systems** — **Subcategories proposed**

| Subcategory | Tier | Funding Example | Why Parent Is Too Broad |
|-------------|------|-----------------|------------------------|
| EV Charging Infrastructure | hot | NEVI Formula Program, utility make-ready programs (PG&E EV Charge Network, SCE Charge Ready), IRA 30C Alternative Fuel Vehicle Refueling Property Credit | Already exists as "EV Charging Stations" at hot tier — effectively already a subcategory. A client needing EV charging doesn't want generic electrical panel or wiring results. |
| Electrical Panel Upgrades | hot | IRA electrification-ready provisions, state panel upgrade programs (CA, NY), utility service upgrade incentives to support heat pump/EV load | Panel/service upgrades are a specific electrification prerequisite with dedicated funding. Distinct from general electrical work (wiring, outlets, conduit). |

**Note:** EV Charging Stations already exists as a separate hot-tier term. Electrical Panel Upgrades is proposed addition #4 in the scratchpad. This analysis reframes them as Electrical Systems subcategories.

---

**Fire Suppression Systems** — **No subcategories needed**

Funders don't distinguish between sprinkler systems, fire alarm systems, and suppression agents at the grant/rebate level. All funded as part of fire/life safety scope.

---

**Elevators / Lifts** — **No subcategories needed**

Elevator modernization is funded as a single category. No funder separates "traction elevator" from "hydraulic elevator" at the program level.

---

**Security Systems** — **No subcategories needed**

Access control, intrusion detection, and video surveillance are funded together under security modernization. No distinct subcategory funding streams.

---

**Building Communication Systems** (narrowed from Communication Systems) — **No subcategories needed**

Building intercoms, PA systems, nurse call systems — all funded as a package in facility modernization. No funder targets one but not the others.

---

**Building Automation Systems** — **No subcategories needed**

BAS/BMS/EMS are funded as integrated systems. Building Controls (proposed addition #3) is broader and complementary, not a subcategory. No funder distinguishes "DDC controls" from "building automation" at the program level.

---

**Refrigeration Systems** — **No subcategories needed**

Walk-in coolers, commercial refrigeration, cold storage — all funded under refrigeration efficiency. No distinct subcategory funding streams.

---

### Building Envelope — Core Business

**Roofing** — **No subcategories needed**

Cool roofs are sometimes separately targeted (Cool Roof and Pavement Systems is proposed as a narrowing of Urban Heat Island Mitigation), but standard roofing replacement/repair is funded as one category. The cool roof angle is handled by the separate term.

---

**Windows / Doors / Insulation / Exterior Walls / Siding / Foundation Repair / Flooring** — **No subcategories needed** for any of these

Funders don't subdivide below these levels. Weatherization programs bundle them. Individual material types (e.g., "double-pane windows" vs. "triple-pane") are specification details, not funding categories.

---

**Weatherization** — **No subcategories needed**

Weatherization is itself a bundled program type (DOE WAP, utility weatherization programs). Subcategories would be the individual envelope measures (insulation, air sealing, windows) which already exist as separate parent terms.

---

### Energy Infrastructure — Core Business

**Solar Panels / Solar Arrays** — **No subcategories needed**

Solar is solar. Funders don't distinguish rooftop from ground-mount at the program eligibility level (they may have different interconnection rules, but the funding program is the same). Community solar is a different business model, not a GC project type.

---

**Wind Turbines** — **No subcategories needed**

On-site/distributed wind is a niche category. No funder separates small wind from medium wind for facility-scale applications.

---

**Battery Storage Systems** — **No subcategories needed**

Battery storage (SGIP, IRA 48E, utility demand response programs) is funded as one category. No funder distinguishes lithium-ion from flow batteries at the program level.

---

**EV Charging Stations** — **No subcategories needed** (already effectively a subcategory of Electrical Systems)

Already specific enough. Fleet vs. public charging is a use-case distinction, not a project type distinction from the GC's perspective.

---

**Geothermal Systems** — **No subcategories needed**

Ground-source heat pumps are funded as one category. No funder separates closed-loop from open-loop at the program eligibility level.

---

**Energy Management Systems** — **No subcategories needed**

EMS/EMIS is funded as one category. Submetering, demand response hardware, and energy dashboards are components, not separately funded project types.

---

**Microgrids / Fuel Cells / Cogeneration Systems** — **No subcategories needed** for any of these

Each is already specific enough. No funder subdivides further.

---

## STRONG Tier Analysis

### Water Infrastructure

**Water Treatment Plants / Wastewater Treatment Plants / Water Distribution Systems / Sewer Systems / Stormwater Management Systems / Water Storage Tanks / Pump Stations** — **No subcategories needed** for any of these

Water/wastewater funding (EPA SRF, USDA Water & Waste Disposal, state revolving funds) targets these at the facility/system level. No funder draws lines within "water treatment" that a GC would need to match on.

---

### Technology & Infrastructure

**Building IT Infrastructure / Structured Cabling Systems / Data Centers / Building Telecommunications Infrastructure** — **No subcategories needed** for any of these (all already narrowed in scratchpad)

These terms have already been narrowed to building-specific scope. No further subdivision needed.

---

### Facility Types — School/Education

**Classroom Facilities / Laboratory Facilities / Computer Lab Facilities / Cafeteria Facilities / Kitchen Facilities / Gymnasium Facilities / Media Center Facilities / Vocational Facilities / CTE Facilities** — **No subcategories needed** for any of these

These ARE the subcategories of "school facilities." They're already at the right granularity. No funder distinguishes within "classroom facilities" (e.g., no one funds "science classrooms" separately from "math classrooms").

---

### Facilities & Grounds

**Playgrounds / Athletic Fields / Athletic Courts / Community Center Facilities / Library Facilities / Museum Facilities / Theater Facilities / Auditorium Facilities / Fencing / Gates / Pavilions / Outdoor Shelters** — **No subcategories needed** for any of these

Each is already specific enough. These are the granular facility types that funding programs target.

---

### Proposed Additions (strong tier from scratchpad)

**Indoor Air Quality Systems / ADA Accessibility Improvements / Asbestos Abatement / Lead Paint Remediation / Building Envelope Improvements / Variable Frequency Drives / Energy Audits** — **No subcategories needed** for any of these

All are already at the right specificity level. Energy Audits in particular is a single service type. VFDs are a specific equipment category. IAQ is narrow enough.

---

### Re-tiered to Strong

**Street Lighting / Emergency Backup Power Systems / Building Air Filtration Systems / Hospital Facilities / Landscaping / Clinics / Health Centers / Student Housing** — **No subcategories needed** for any of these

All at the right granularity for matching.

---

## MILD Tier Analysis

**Parks** — **No subcategories needed**

Park facility construction (restrooms, pavilions, lighting) is funded as site-level scope. No funder specifically targets "park restrooms" vs. "park lighting" as separate program categories.

---

**Transportation Infrastructure (Roads, Streets, Bridges, Sidewalks, Walkways, Bike Lanes, Bike Paths, Parking Lots, Parking Structures, Traffic Signals, Bus Stops, Bus Shelters, Rail Infrastructure, Pedestrian Crossings, Fleet Vehicles)** — **No subcategories needed**

These are already individual transportation subcategories. No further subdivision needed.

---

**Public Safety Infrastructure (Fire Stations, Police Stations, Emergency Operations Centers, 911 Centers, Dispatch Centers, Correctional Facilities, Security Cameras, Building Surveillance Systems)** — **No subcategories needed**

Each is already a specific facility or system type.

---

**Climate Resilience & Adaptation (Flood Barriers, Cooling Centers, Warming Centers, Drought Mitigation Systems, Wildfire Prevention Infrastructure, Green Stormwater Infrastructure, Cool Roof and Pavement Systems, Building Decontamination Systems, Building Ventilation Improvements)** — **No subcategories needed**

All already narrowed to appropriate specificity in the scratchpad revisions.

---

**Proposed Additions (mild tier from scratchpad)**

**Electric Vehicle Fleet Infrastructure / Demolition / Modular/Portable Buildings** — **No subcategories needed**

All are specific enough.

---

## WEAK Tier Analysis

The weak tier contains facility types (housing, healthcare, economic development), environmental terms, and disaster preparedness items. **No subcategories needed for any weak-tier term.** Rationale:

- Weak-tier terms are already low-signal. Subcategorizing them would add complexity with minimal matching benefit.
- Funders that target these areas (e.g., HUD for housing, FEMA for disaster prep) use the parent-level terms.
- A GC selecting weak-tier terms for matching is already casting a wide net by definition.

---

## Summary Table: Proposed Subcategories

| # | Parent Term | Subcategory | Tier | Concrete Funding Example | Already in Scratchpad? |
|---|-------------|-------------|------|--------------------------|----------------------|
| 1 | HVAC Systems | Heat Pump Systems | hot | IRA 25C heat pump rebates, DOE Heat Pump Deployment programs, utility heat pump incentives | Yes (addition #1) |
| 2 | HVAC Systems | Boiler Systems | strong | DOE heating equipment programs, state boiler replacement grants, school modernization programs | Yes (addition #10) |
| 3 | HVAC Systems | Chiller Systems | strong | DOE chiller replacement programs, utility chiller optimization rebates | Yes (addition #11) |
| 4 | Lighting Systems | LED Lighting Upgrades | hot | Utility LED per-fixture rebates, DOE Better Buildings, 179D lighting component | Yes (addition #2) |
| 5 | Electrical Systems | EV Charging Infrastructure | hot | NEVI Formula Program, utility make-ready programs, IRA 30C tax credit | Yes (existing term "EV Charging Stations") |
| 6 | Electrical Systems | Electrical Panel Upgrades | hot | IRA electrification provisions, state panel upgrade programs, utility service upgrade incentives | Yes (addition #4) |

**Total: 6 subcategories proposed** (all of which are already captured in the scratchpad as standalone additions or existing terms).

---

## Key Finding

The current taxonomy — especially after the scratchpad revisions — is already at the right granularity for most terms. The scratchpad additions (#1-5, #10, #11) effectively created the subcategories that were missing. This analysis confirms those additions are justified from a funding-specificity perspective and identifies the parent-child relationships:

- **HVAC Systems** is the only parent that truly needs multiple subcategories (heat pumps, boilers, chillers) because funders routinely target these as distinct equipment categories with separate incentive tiers.
- **Lighting Systems** benefits from one subcategory (LED upgrades) because utility rebates specifically target LED conversions.
- **Electrical Systems** benefits from two subcategories (EV charging, panel upgrades) because both have dedicated federal/state/utility funding streams.
- **All other parents** (90+ terms) are at the correct granularity — funders don't draw lines below their current level.

## Implementation Note

Whether these subcategories are implemented as:
- **Flat list entries** (current approach — Heat Pump Systems as a standalone term alongside HVAC Systems), or
- **Hierarchical parent-child relationships** (Heat Pump Systems as a child of HVAC Systems in the data model)

...is an architecture decision, not a taxonomy decision. The flat list approach works fine for matching as long as both parent and subcategory terms are in the taxonomy. The scratchpad already ensures this.

No new terms need to be added beyond what the scratchpad already proposes.
