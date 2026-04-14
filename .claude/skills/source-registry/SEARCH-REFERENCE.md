# Source Registry — Search Reference Guide

This document contains detailed search strategies, queries, navigation guidance, and
domain knowledge for the source-registry skill. Read this file when you need deep
guidance on HOW to search for funding entities.

**Parent skill**: `.claude/skills/source-registry/SKILL.md`

---

## 1. Strategy 1 — Direct Listing Search

**Goal**: Find comprehensive lists that enumerate all entities of the target type.
**Applies to**: Utility, County, Municipality, Tribal

### For Utilities — search in this order:

1. **Wikipedia state utility lists** — almost every state has one:
   - Search: `"[Full State Name] electric utilities" site:wikipedia.org`
   - These pages typically list IOUs, co-ops, and municipal utilities with service areas
   - Use as a baseline checklist, then verify each entity independently

2. **State-specific utility association pages:**
   - Search: `"[State] electric cooperative association"`, `"[State] municipal utilities association"`
   - Co-ops often have a state association that lists member co-ops
   - Municipal utility associations list city-owned utilities

3. **"List of" queries with variations:**
   - `"list of electric utilities in [State]"`
   - `"[State] investor-owned utilities"` (IOUs — the big ones)
   - `"[State] electric cooperatives"` or `"[State] rural electric cooperatives"`
   - `"[State] municipal electric utilities"`
   - `"[State] gas utilities"` (natural gas — separate from electric)
   - `"[State] water utilities rebates"` (water conservation programs)

4. **Understand utility types** — all are potential funding sources:

   | Type | What It Is | Typical Incentive Programs | How to Find |
   |------|-----------|--------------------------|-------------|
   | **IOU** (Investor-Owned Utility) | Publicly traded, regulated by PUC | Large rebate catalogs, demand response, EE programs | PUC filings, top search results |
   | **Co-op** (Rural Electric Cooperative) | Member-owned, serves rural areas | Smaller rebate programs, often via wholesale provider | State co-op association, NRECA |
   | **Municipal** (City-Owned Utility) | Owned by city/town government | May mirror IOU programs or have unique city programs | City government websites, APPA |
   | **Public Power District** | Regional government-owned (common in NE, WA) | Similar to municipal | State public power association |
   | **Tribal** | Owned by tribal nation/authority | May have unique programs funded by federal tribal grants | BIA, tribal government websites, DOE tribal energy |

### For Tribal Utilities:
- Search: `"[State] tribal utility authority"`, `"[State] tribal electric"`
- Check: Bureau of Indian Affairs (BIA) utility listings
- Search: `"DOE tribal energy" [State]` — DOE has a tribal energy program
- Key entities: Navajo Tribal Utility Authority (NTUA) in AZ/NM/UT, Gila River
  Indian Community utilities, tribal utilities in AK, MT, SD, WI, MN
- Not all states have tribal utilities — check if the state has tribal lands first

### For Counties — Register at the DEPARTMENT Level

The registration unit for counties is the **department or agency**, not the county itself.
"Clark County" is too generic — register "Clark County Department of Environment and
Sustainability" instead. This makes Phase 2 (Program Discovery) much cleaner because
each source maps to one department's programs.

**Step 1 — Find the county and its departments:**
- Search: `"[County Name] county government departments"`, `"[County Name] county grants programs"`
- Navigate to the county government website → find the department directory
- Identify departments that administer funding programs (not just regulatory ones)
- **IMPORTANT: Verify it's a funder, not just a regulator.** Look for "Apply", "Grant
  Application", "Funding Opportunity", "RFP", "NOFA" on the department's pages. If NONE
  of these terms appear, the department is likely regulatory-only — do NOT propose it.

**Step 2 — For each taxonomy category, search for the responsible department:**
- `"[County Name] county sustainability department"` → Sustainability/Environment dept
- `"[County Name] county housing programs grants"` → Housing authority or community dev dept
- `"[County Name] county economic development incentives"` → Economic development office
- `"[County Name] county energy efficiency programs"` → Energy or public works dept
- `"[County Name] county water conservation rebates"` → Water department or utility
- `"[County Name] county community development block grant CDBG"` → Community dev dept
- `"[County Name] county infrastructure grants"` → Public works or planning dept

**Step 3 — Register each department that administers programs as its own source:**
- Name: "[County Name] [Department Name]" (e.g., "Clark County Department of Environment and Sustainability")
- Website: the department's specific page/section, not the county homepage
- Sectors: only the taxonomy categories relevant to that department
- Description: what programs this department administers

### For Councils of Governments (COGs) — Register as type='Other'

**What COGs are:** Regional intergovernmental partnerships of cities, towns, and counties.
They act as the middleman between federal/state government and small local governments
that are too small to receive HUD CDBG/HOME funding directly ("non-entitlement communities").

**Why they matter:** In most states, the majority of rural counties and small cities get
their CDBG/HOME money through a COG, not directly from HUD. The COG decides which projects
get funded and awards the grants. If you only register county departments, you miss the
actual decision-maker for rural areas.

**How to find them:**
- Search: `"[State] council of governments"`, `"[State] regional planning organizations"`
- Search: `"[State] CDBG non-entitlement" council of governments`
- Check: National Association of Regional Councils (NARC) member directory
- Check: HUD's list of state CDBG program contacts → they often list the COGs
- Each state typically has 3-15 COGs covering different geographic regions

**When searching for County type, ALSO search for COGs in the same state.**
Propose them as `type='Other'` with a description noting:
- Which counties/cities they serve
- What federal pass-through programs they administer (CDBG, HOME, WIOA, etc.)
- Their official website

**Example COGs (Arizona):**
- NACOG — Northern Arizona Council of Governments (Apache, Coconino, Navajo, Yavapai)
- CAG — Central Arizona Governments (Gila, Pinal)
- SEAGO — Southeastern Arizona Governments Organization (Cochise, Graham, Greenlee, Santa Cruz)
- WACOG — Western Arizona Council of Governments (La Paz, Mohave, Yuma)
- MAG — Maricopa Association of Governments (Maricopa County metro area)

**Common department types that run programs:**
| Department | Typical Programs | Taxonomy Categories |
|-----------|-----------------|-------------------|
| Environment / Sustainability | Climate action, green building | Sustainability, Climate, Environment, Energy |
| Housing Authority / Community Dev | CDBG, HOME, weatherization | Housing, Community Development |
| Economic Development | Business grants, TIF, incentives | Economic Development, Workforce Development |
| Public Works | Infrastructure, energy efficiency | Infrastructure, Energy, Water |
| Planning / Redevelopment | Redevelopment zones, brownfields | Community Development, Environment |
| Health / Human Services | Low-income assistance, LIHEAP | Human Services, Housing |

### For Municipalities — Register at the DEPARTMENT Level

Same approach as counties. Register the **department or office**, not "City of Las Vegas."

**Step 1 — Find the city and its departments:**
- Search: `"[City Name] city government departments"`, `"[City Name] city grants programs"`
- Navigate to the city website → department directory

**Step 2 — Taxonomy-driven department search:**
- `"[City Name] office of sustainability programs"` → Sustainability office
- `"[City Name] housing authority grants"` → Housing department
- `"[City Name] redevelopment agency incentives"` → Redevelopment agency
- `"[City Name] economic development business grants"` → Economic dev office
- `"[City Name] public works energy efficiency"` → Public works dept
- `"[City Name] community development block grant"` → Community development dept

**Step 3 — Register each qualifying department as its own source.**

**Key distinction**: A city may have a municipal utility (register as type='Utility')
AND a sustainability office (register as type='Municipality'). These are different
entities — register both.

---

## 2. Strategy 2 — Regulatory / PUC Databases

**Goal**: Use official state regulatory records as an authoritative source of regulated utilities.
**Applies to**: Utility only

**Key concept**: Every state has a Public Utilities Commission (or equivalent) that regulates
investor-owned utilities. Co-ops and municipal utilities are usually NOT regulated by
the PUC — they're self-governed.

### State PUC Naming Varies

| State | PUC Name | Search Term |
|-------|----------|-------------|
| AZ | Arizona Corporation Commission (ACC) | `"Arizona Corporation Commission" regulated utilities` |
| CA | California Public Utilities Commission (CPUC) | `"CPUC regulated utilities list"` |
| TX | Public Utility Commission of Texas (PUCT) | `"PUCT electric utilities"` |
| NY | New York Public Service Commission (PSC) | `"NY PSC electric utilities"` |
| FL | Florida Public Service Commission (FPSC) | `"Florida PSC electric utilities"` |
| CO | Colorado Public Utilities Commission (PUC) | `"Colorado PUC regulated utilities"` |
| GA | Georgia Public Service Commission | `"Georgia PSC electric utilities"` |
| NC | North Carolina Utilities Commission | `"NC utilities commission electric"` |
| Other | Search: `"[State] public utilities commission"` | The name will appear in results |

### How to Use PUC Data:

1. Search: `"[State PUC name] list of regulated utilities"` or `"[State PUC name] electric providers"`
2. Look for a "regulated companies" or "utility directory" page on the PUC website
3. These lists give you the IOUs with certainty — every name on a PUC list is a real, active utility
4. PUC sites often link to each utility's tariff filings which can confirm service territory
5. **PUC lists are incomplete by design** — they only cover IOUs, not co-ops or munis. Don't stop here.

### Docket/Filing Search (advanced):
- Some PUCs have searchable docket databases with energy efficiency program filings
- Search: `"[State PUC] energy efficiency docket"` or `"[State PUC] demand side management filing"`
- These filings often list all utilities required to offer EE programs

---

## 3. Strategy 3 — EIA Federal Database

**Goal**: Use the U.S. Energy Information Administration as ground truth for utility counts.
**Applies to**: Utility only

### EIA Form 861

Form 861 is the authoritative federal dataset of all U.S. electric utilities — every IOU,
co-op, municipal utility, and public power district.

### How to Access:

1. **EIA state electricity profiles** (most practical for LLM agents):
   - URL pattern: `eia.gov/electricity/state/[state abbreviation]/`
   - Example: `eia.gov/electricity/state/az/` for Arizona
   - These pages summarize the state's electric industry and list major utilities
   - Good for quick count validation and finding major entities

2. **EIA-861 data files** (comprehensive but harder to use):
   - Search: `"EIA Form 861" data download`
   - The full dataset is published as downloadable Excel/CSV files
   - Lists EVERY electric utility by state with: name, state, ownership type, customers, MWh
   - **Note**: These are Excel files — use WebFetch on the EIA pages for summary data,
     but the full file download may not be practical for an LLM agent. Use the state
     profiles instead for discovery, and reference the Form 861 count for validation.

3. **Use EIA data primarily for COUNT VALIDATION:**
   - Look up how many electric utilities EIA reports for your target state
   - Compare against your search results from Strategies 1-2
   - If your count is significantly lower, you're missing entities — search deeper

### Not All Utilities Run Incentive Programs

Small co-ops serving <5,000 customers often don't have their own rebate programs
(they pass through wholesale provider programs). Still register all for completeness —
Phase 2 (Program Discovery) will determine which have active programs.

---

## 4. Strategy 4 — Aggregator Sites

**Goal**: Cross-reference findings with curated incentive databases that track who offers programs.
**Applies to**: All funder types

### DSIRE (Database of State Incentives for Renewables and Efficiency)

1. **Programs database**: Navigate to `programs.dsireusa.org` (separate from main dsireusa.org)
2. Use the state selector or URL parameters to filter by state
3. **Key insight**: The "Implementing Sector" field tells you WHO offers each program —
   this is how you discover funding entities from DSIRE
   - Filter by Implementing Sector = "Utility" to find utility-administered programs
   - Filter by Implementing Sector = "State" for state agency programs
   - Filter by Implementing Sector = "Local" for county/city programs
4. Alternative: WebSearch `"DSIRE [State] utility incentives"` — results link to
   DSIRE's state-specific pages
5. For each program found, note the implementing entity — that's a funding source

### EnergySage

1. Search: `"EnergySage [State] utility rebates"` or `"EnergySage [State] solar incentives"`
2. EnergySage maintains lists of utilities offering solar/storage incentives per state
3. Less comprehensive than DSIRE but good for cross-referencing utility names

### ACEEE (American Council for an Energy-Efficient Economy)

1. Search: `"ACEEE [State] utility energy efficiency"` or `"ACEEE state scorecard [State]"`
2. ACEEE tracks which utilities run energy efficiency programs and ranks states
3. Their state scorecards list the major utilities running EE programs

### Aggregator Strengths and Weaknesses by Funder Type

**IMPORTANT:** DSIRE, ACEEE, and EnergySage are built around utility and state-level
energy policy. They have **thin coverage of county and municipal programs** in most states.
Do NOT rely on them as primary sources for County or Municipality funder types.

| Funder Type | Best Aggregator Sources (priority order) | Notes |
|-------------|----------------------------------------|-------|
| **Utility** | DSIRE (primary), EIA/PUC (validation), ACEEE, EnergySage | Strong coverage — DSIRE is comprehensive for utility incentives |
| **State** | DSIRE (Implementing Sector=State), state energy office sites | Good coverage for energy/environment programs |
| **County** | **HUD CDBG/HOME entitlement lists** (hudexchange.info), state housing agency recipient lists, Instrumentl county pages, National Association of Counties | DSIRE is weak for county programs — lead with HUD lists |
| **Municipality** | **League of Cities/Towns** (state chapter), regional water association directories (AMWUA, etc.), city-wide grants index pages, Instrumentl city pages | DSIRE is weak for municipal programs — lead with association directories |
| **Foundation** | Candid/GuideStar, GrantWatch, Instrumentl, state community foundation directories | Foundation databases are the strongest aggregators for this type |
| **Other (COGs)** | HUD state CDBG contacts list, NARC member directory, state COG associations | No single aggregator covers COGs well — use HUD + direct search |

### Key Aggregator Sources for County/Municipality (often missed)

1. **HUD Exchange** (hudexchange.info) — the definitive source for who gets CDBG/HOME
   money directly from HUD. Search: `"hudexchange" CDBG entitlement communities [State]`
2. **State Housing Agency** grant recipient lists — most states publish who received
   CDBG/HOME/ESG/HOPWA allocations. Search: `"[State] department of housing" grant recipients`
3. **Regional water association directories** — in water-heavy states (AZ, NV, NM, CA, TX),
   these list city water conservation offices with rebate programs. Example: AMWUA for
   Arizona yielded 13 water conservation offices in one search.
4. **League of Cities/Towns state chapters** — most states have one. They often maintain
   grant/funding resource directories for their member cities.
5. **Instrumentl** county/city landing pages — better than DSIRE for local government
   programs. Search: `site:instrumentl.com "[County Name]" grants`

### How to Use Aggregator Data:
- Cross-reference: if an entity appears in DSIRE but NOT in your PUC/EIA lists,
  investigate — it might be a co-op, tribal utility, or non-traditional funding source
- For County/Municipality: **start with HUD entitlement lists and association directories**,
  then cross-reference with DSIRE/Instrumentl. Do NOT start with DSIRE alone — you'll
  miss the majority of local government funders.
- Aggregators are especially valuable for non-utility funder types (foundations, state
  agencies) where there's no equivalent of the EIA database

---

## 5. Strategy 5 — State/Federal Agency Search

**Goal**: Find government agencies that administer grant or incentive programs.
**Applies to**: State, Federal, County

### For State Agencies — search these departments:

| Department Type | Search Queries | What They Fund |
|----------------|---------------|----------------|
| Energy Office | `"[State] energy office"`, `"[State] office of energy"` | Weatherization, solar, EE grants |
| Commerce/Economic Dev | `"[State] commerce department grants"`, `"[State] economic development incentives"` | Business energy grants, manufacturing |
| Environment/DEQ | `"[State] department of environmental quality grants"` | Clean energy, emissions reduction |
| Housing Authority | `"[State] housing authority weatherization"`, `"[State] LIHEAP"` | Low-income weatherization, utility assistance |
| Agriculture | `"[State] department of agriculture grants energy"` | Rural energy, agricultural efficiency |
| Transportation | `"[State] department of transportation EV grants"` | EV infrastructure, fleet electrification |
| Public Schools | `"[State] school facilities energy grants"` | K-12 energy efficiency, solar for schools |

**State agency naming patterns:**
- Most states: "Department of [Topic]" or "Office of [Topic]"
- Some states use "Division" or "Bureau" or "Commission"
- Search broadly first: `"[State] government energy grants"` then narrow

### For Federal Agencies (when type = 'Federal'):

| Agency | Abbreviation | What They Fund |
|--------|-------------|----------------|
| Department of Energy | DOE | EERE grants, weatherization, grid modernization |
| Environmental Protection Agency | EPA | Environmental justice, clean energy, brownfields |
| USDA Rural Development | USDA-RD | Rural energy efficiency (REAP), rural utilities |
| Department of Housing and Urban Dev | HUD | Green building, weatherization, housing EE |
| Small Business Administration | SBA | Small business energy loans |
| Department of Transportation | DOT | EV infrastructure (NEVI), transit electrification |
| Department of Interior | DOI | Tribal energy, public lands renewable energy |
| Economic Development Administration | EDA | Clean energy manufacturing, community development |

### Evaluation:
- Must have at least one page describing grants, incentives, or rebate programs
- A department that only regulates (like a PUC) is NOT a funding source unless it
  also administers programs
- Look for: "apply for funding", "grant application", "incentive program", "rebate available"

---

## 6. Strategy 6 — Foundation Databases

**Goal**: Find philanthropic organizations funding clean energy and sustainability.
**Applies to**: Foundation only

### Search Approach:

1. **Foundation directories:**
   - Search: `"[State] community foundation grants energy"`, `"[State] environmental foundation"`
   - Check: `candid.org` (formerly GuideStar/Foundation Center) — search by state and focus area

2. **Climate/energy-specific foundations:**
   - Search: `"clean energy foundation grants [State]"`, `"climate foundation [State]"`
   - National foundations with state programs: Bloomberg Philanthropies, Kresge Foundation,
     Energy Foundation, Barr Foundation
   - Search: `"[State] clean energy fund"` — many states have quasi-governmental clean energy
     funds that operate like foundations

3. **Utility foundations** (often overlooked):
   - Many large utilities have affiliated foundations
   - Search: `"[Utility Name] foundation"`, `"[Utility Name] charitable giving energy"`

4. **CDFIs and Green Banks:**
   - Search: `"CDFI [State] clean energy"`, `"green bank [State]"`
   - Green banks and CDFIs provide financing that overlaps with traditional incentives

### Evaluation:
- Must actively make grants (not just an endowment)
- Must fund energy, environment, sustainability, or related sectors
- Note if invitation-only vs open application
- Note if only funds nonprofits vs also businesses/governments

---

## 7. Strategy 7 — Taxonomy-Driven Search

**Goal**: Search for funding sources by taxonomy category rather than entity type.
Catches sources that type-based searches miss — like a water district that doesn't
show up in a "county government" search but appears in a "water conservation programs" search.
**Applies to**: All funder types, but especially valuable for County, Municipality, State, Foundation

### How It Works

Instead of searching "who are the counties in [State]?", search "who funds [category]
programs in [State]?" For each relevant taxonomy category, run targeted searches:

### Search Queries by Taxonomy Category

| Category | Search Queries |
|----------|---------------|
| Energy | `"[State] energy efficiency grants"`, `"[State] energy rebate programs"`, `"[State] renewable energy incentives"` |
| Sustainability | `"[State] sustainability grants local government"`, `"[State] green building incentives"` |
| Water | `"[State] water conservation rebates"`, `"[State] water efficiency programs"`, `"[State] water utility rebates"` |
| Housing | `"[State] affordable housing grants"`, `"[State] weatherization assistance program"`, `"[State] CDBG entitlement communities"` |
| Infrastructure | `"[State] infrastructure grants local"`, `"[State] public works grants"` |
| Community Development | `"[State] community development grants"`, `"[State] CDBG recipients"`, `"[State] neighborhood revitalization grants"` |
| Economic Development | `"[State] economic development incentives"`, `"[State] business grants local government"`, `"[State] redevelopment agency"` |
| Climate | `"[State] climate action grants"`, `"[State] climate resilience funding"`, `"[State] greenhouse gas reduction programs"` |
| Environment | `"[State] environmental remediation grants"`, `"[State] brownfield grants"`, `"[State] environmental justice funding"` |
| Transportation | `"[State] EV charging incentives"`, `"[State] transportation electrification grants"`, `"[State] fleet electrification"` |
| Agriculture | `"[State] agricultural energy efficiency"`, `"[State] farm energy grants"`, `"[State] USDA REAP"` |

### What to Extract

For each search result, identify the **administering entity** — the department, agency,
or organization that runs the program. That entity is the funding source to register.

Example: Searching "Nevada water conservation rebates" might surface:
- Southern Nevada Water Authority (a special district — register as type='Other')
- Las Vegas Valley Water District (register as type='Utility')
- Truckee Meadows Water Authority (register as type='Utility')
These wouldn't necessarily show up in a "Nevada county government" search.

### When to Use

- **Always use as a supplementary strategy** alongside type-based strategies (1-6)
- Especially valuable after type-based strategies have been exhausted, to find entities
  that don't fit neatly into one funder type
- For County and Municipality searches: run taxonomy-driven queries for each major county/city
  to find departments that administer programs
- For Foundation searches: taxonomy queries often find foundations that don't appear in
  foundation directories

### Integration with Other Strategies

Strategy 7 is a **cross-cutting strategy** that supplements all others. When running
as an Agent Team teammate, weave taxonomy-driven searches into your assigned strategy
group. For example:
- "direct" teammate: use taxonomy queries to find county/city departments
- "aggregator" teammate: use taxonomy queries to find foundations and special districts
- "regulatory" teammate: use taxonomy queries to find state agencies by program area

---

## 8. Catalog URL Discovery — Detailed Guidance (formerly Section 7)

This section expands on SKILL.md Step 3 with detailed URL evaluation and navigation.

### What Makes a Good Catalog URL

| Good (register these) | Bad (skip these) |
|----------------------|------------------|
| Page listing multiple programs with links to each | Generic "sustainability" landing page |
| "Rebates & Incentives" page with program cards/tiles | Press release about a single program |
| PDF catalog listing all available programs | Blog post mentioning programs in passing |
| Third-party portal showing available rebates | Login page with no public program info |
| "Programs for Businesses" overview page | Utility's main homepage (too generic) |
| DSIRE page listing this source's programs | Rate schedule / tariff page |

### Third-Party Implementer Portals

Some utilities outsource program delivery to third parties. The incentive catalog may
live on the implementer's site:

- Common implementers: CLEAResult, ICF, Franklin Energy, Willdan, TRC, APTIM
- Search: `"[Source Name] rebates" -site:[source domain]`
- Look for domains like: `savings.utilityname.com`, `utilityname.programname.com`
- These are VALID catalog URLs — register them with label "Third-party program portal ([name])"

### Holding Company vs Operating Company

Some utilities are subsidiaries:
- Pinnacle West Capital → Arizona Public Service (APS)
- Fortis Inc → UniSource Energy → Tucson Electric Power (TEP)
- Exelon → ComEd, PECO, BGE, Pepco, etc.

Register the **operating utility** (the one that serves customers and runs rebate programs),
not the parent holding company.

---

## 9. Iterative Deepening Techniques

When initial searches return fewer entities than expected, apply these secondary
techniques before finishing:

1. **Broaden search terms**: Try `"[State] energy companies"` instead of just
   `"electric utilities"`. Try `"[State] power companies"` or `"[State] energy providers"`.

2. **Check wholesale/G&T providers**: Generation and Transmission cooperatives (G&T co-ops)
   like Arizona Electric Power Cooperative (AEPCO), Tri-State G&T, Basin Electric often list
   their member distribution co-ops on their websites. These member lists are excellent for
   finding small rural co-ops.

3. **Use NRECA Co-op Locator**: The National Rural Electric Cooperative Association maintains
   a state-by-state co-op directory at `electric.coop`. Search `"NRECA cooperative locator"`
   or navigate to their member directory. This is one of the most complete sources for
   electric cooperatives in any state.

4. **Search by service territory**: `"[City/Region] electric provider"` — useful for finding
   small municipal utilities that don't appear in statewide searches. Try major cities and
   regional names.

5. **Check utility association membership lists**:
   - APPA (American Public Power Association) — public/municipal utilities
   - NRECA — electric cooperatives
   - EEI (Edison Electric Institute) — investor-owned utilities
   - AGA (American Gas Association) — gas utilities
   All maintain member directories searchable by state.

6. **State energy office utility lists**: Many state energy offices maintain their own lists
   of utilities operating in the state. Search: `"[State] energy office utility list"` or
   `"[State] residential utility consumer office"`.

7. **Try alternate spellings**: "Electricity" vs "Electric", "Power" vs "Energy",
   "Utility" vs "Provider" vs "Company" vs "Service".
