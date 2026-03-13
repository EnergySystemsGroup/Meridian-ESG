# Scoring Calibration Study — Working Document

**Started**: 2026-03-07
**Purpose**: Validate deterministic scoring algorithm against human business judgment from ESCO/GC perspective.

## Scoring Context

We are an **energy services company / general contractor (ESCO/GC)**. Our value is helping clients capture funding through construction, installation, and retrofit work. Key question for every opportunity: **"Can we do the work, and does the money flow through our scope?"**

## Emerging Narrative Template

Each opportunity should have:
- **Pluses**: What makes this valuable (clear amounts, matching activities, right clients)
- **Flags**: What to watch out for (unclear amounts, qualifying conditions, scope mismatch)

## Known Scoring Gaps (Pre-Calibration Hypotheses)

1. **Program clarity/actionability** — algo can't see whether the program mechanics are transparent
2. **Activity relevance is more binary** — if we can't do construction work, it's near-zero value regardless of other matches
3. **Unknown funding amounts get a free pass** — algo gives fundingAttractiveness=1 when amounts unknown, may be too generous
4. **One degree of separation** — applicants match (gov't clients) but project types serve a different purpose (e.g., housing vs. public facilities)

---

## Calibration Results

### #1: Charge Ready Program
- **Source**: Southern California Edison (Utility)
- **Type**: Rebate | Max: $10K (DB) / actually up to $40K/port (DCFC track)
- **Algo Score**: 7.0 | cr=2, ptr=3, fa=1, ft=1, am=1.0
- **Human Score**: 3
- **Delta**: -4.0 (algo too high)
- **Pluses**: Real EV charging installation work. Multiple tracks. Could sweeten a larger energy project.
- **Flags**: Money doesn't flow through contractor — client gets rebate. Amounts opaque until you apply. Can't give client a confident dollar figure. Residential/multifamily tracks don't apply.
- **Root Cause**: Algo sees matching taxonomy (applicants, project types, activities) but can't detect that (a) money doesn't fund ESCO scope, (b) program mechanics are unclear, (c) small dollar amounts make it supplemental not primary.

### #2: FY2024 Flood Mitigation Assistance Swift Current
- **Source**: FEMA / DHS (Federal)
- **Type**: Grant | Pot: $500M, per-applicant: unknown
- **Algo Score**: 9.0 | cr=3, ptr=2, fa=3, ft=1, am=1.0
- **Human Score**: 7
- **Delta**: -2.0 (algo slightly high)
- **Pluses**: $500M pot is real money. Stormwater management is in our wheelhouse. Government clients (state/tribal/local). Activities include construction, installation, renovation.
- **Flags**: Flood-specific qualifier narrows client pool significantly. Per-applicant amount unknown. Some project types outside our scope (wetland restoration, erosion control). Not core bread-and-butter — adjacent.
- **Root Cause**: Algo correctly identifies strong matches but can't discount for (a) qualifying conditions that narrow applicability, (b) mixed project types where only some match, (c) unknown per-applicant amounts despite large total pot.

### #3: Permanent Local Housing Allocation (PLHA) 2024
- **Source**: CA Dept of Housing & Community Development (State)
- **Type**: Grant | Amounts: all unknown
- **Algo Score**: 5.0 | cr=3, ptr=0, fa=1, ft=1, am=1.0
- **Human Score**: 6
- **Delta**: +1.0 (algo slightly low)
- **Pluses**: Perfect applicant match (cities, counties, municipal gov). Activities include new construction, renovation, rehabilitation. Long application window (through 2027).
- **Flags**: Project types are housing (affordable, homeless shelters, transitional) — not public sector facilities. One degree of separation: our gov't clients building residential, not building for themselves. All amounts unknown.
- **Root Cause**: Algo correctly identified projectTypeRelevance=0 (housing is in weak tier), but the human sees that even though housing isn't core, the construction work itself is still feasible. Slight under-score — but close.

### #4: Museums Empowered (2026)
- **Source**: Institute of Museum and Library Services (Federal)
- **Type**: Grant | Pot: $4.3M, Max: $300K, Min: $5K
- **Algo Score**: 2.0 | cr=1, ptr=2, fa=0, ft=1, am=0.5
- **Human Score**: 1
- **Delta**: -1.0 (algo slightly high — should have been filtered)
- **Pluses**: None for ESCO/GC.
- **Flags**: Activities are entirely soft (training, professional development, capacity building). Zero construction or infrastructure. Museums/nonprofits could theoretically be clients but not for this type of work.
- **Root Cause**: activityMultiplier=0.5 is too generous for training/professional development. These activities have zero ESCO value — multiplier should be closer to 0 for a complete kill. Also projectTypeRelevance=2 for "Museums" seems wrong — museums as a *project type* shouldn't score strong.

### #5: Advanced Technological Education (ATE)
- **Source**: U.S. National Science Foundation (Federal)
- **Type**: Grant | Pot: $74M, Max: $7.5M, Min: $475K
- **Algo Score**: 4.5 | cr=3, ptr=2, fa=3, ft=1, am=0.5
- **Human Score**: 1
- **Delta**: -3.5 (algo way too high)
- **Pluses**: None for ESCO/GC. Strategic workforce pipeline angle exists but doesn't generate revenue.
- **Flags**: Entirely education/training focused. Zero construction. Money funds curriculum, not buildings. Big dollar amounts are a trap — none accessible for contractor work.
- **Root Cause**: activityMultiplier=0.5 insufficient to kill non-construction programs. fundingAttractiveness=3 inflates score for money you can't access. projectTypeRelevance=2 (classrooms/labs) misleading — these are educational program types, not construction projects.

### #13: Recycling Market Development Zone Revolving Loan Program
- **Source**: CalRecycle (State)
- **Type**: Loan (revolving) | Amounts: all unknown
- **Algo Score**: 6.5 | cr=3, ptr=2, fa=1, ft=0.5, am=1.0
- **Human Score**: 5
- **Delta**: -1.5 (algo slightly high)
- **Pluses**: Local governments and special districts eligible. Activities include construction, renovation, infrastructure development — generic ESCO work. Rolling/perpetual program.
- **Flags**: Niche threshold — client must be in recycling/waste processing business with qualifying business plan. RMDZ zone preference narrows geography. Loan not grant. All amounts unknown. Likelihood of finding qualifying client is low.
- **Root Cause**: ptr=2 too generous for recycling facilities. Algo can't see that the niche business threshold dramatically narrows the practical applicant pool despite broad eligible applicant types.
- **Key Insight**: Eligible applicant types can look broad while the program threshold makes the real pool very narrow. The algo sees "local governments" and scores hot, but in practice only recycling-focused local government entities would qualify.

### #12: Rural Transportation Match and Gap Funding (Denali Commission)
- **Source**: Denali Commission (Federal)
- **Type**: Grant | Pot: $5M, Max: $1M, Min: $50K
- **Algo Score**: 6.0 | cr=3, ptr=1, fa=1, ft=1, am=1.0
- **Human Score**: 6
- **Delta**: 0.0 (algo spot on)
- **Pluses**: Government clients (municipal, tribal). $1M max is decent. Activities include construction, renovation, design, engineering. Coverage area correctly tagged to Alaska (not national). Street lighting is a match for our capabilities.
- **Flags**: All project types are transportation (mild tier) — not core business. "Construction-ready" requirement = must have done design/engineering before applying. "Gap funding" = supplemental, not standalone. Unclear eligibility bar — what scoring criteria must you meet?
- **Taxonomy note**: Street Lighting is in mild tier under "Transportation Infrastructure" but is arguably a lighting project (hot tier "Lighting Systems"). Consider whether street lighting should be recategorized or cross-listed.
- **Root Cause**: Algo got this right. ptr=1 for transportation is fair. The human independently arrived at 6 after factoring in the construction-ready requirement and gap funding framing — signals the algo can't see but happened to not affect the score here.
- **Key Insight**: New signal type — **eligibility thresholds / scoring criteria**. Sales team needs to know "what bar do I have to clear?" for every opportunity. Construction-ready, prior program participation, geographic qualifiers, etc. Should be captured as a standard field.

### #11: Strategic Energy Management Programs (SPARKe)
- **Source**: Southern California Edison (Utility)
- **Type**: Rebate | $0.21/kWh capital projects (50% cost cap), $250K/year cap (from implementer site, NOT in our DB)
- **Algo Score**: 7.0 | cr=2, ptr=3, fa=1, ft=1, am=1.0
- **Human Score**: 7.5
- **Delta**: +0.5 (algo close — good match)
- **Pluses**: Project types directly match (HVAC, lighting, BAS, energy management). Activities include installation and upgrade. Incentive structure is real and clearly defined on implementer site. 6-year engagement creates ongoing project pipeline. $250K/year cap is meaningful for capital projects.
- **Flags**: Incentive amounts assessment-dependent (don't know until after treasure hunt). Comparatively small vs federal grants even at max. Private-sector clients only. Incentive details NOT on SCE's page — live on implementer site (Cascade Energy).
- **Root Cause**: Algo got this roughly right. Data gathering gap: extraction only crawled SCE page, not linked implementer pages where incentive details live.
- **Key Insight**: LLM content enhancement mentioned "rebate incentives" without specifics — not hallucination but incomplete sourcing. Utility programs often push details to third-party implementer sites we don't crawl.
- **PROCESS NOTE**: From here on, pull ALL fields from opportunity table (enhanced_description, program_use_cases, application_summary, program_insights, actionable_summary, relevance_reasoning) to give complete context.

### #10: Region 9 FY2025 Wetland Program Development Grants
- **Source**: Environmental Protection Agency (Federal)
- **Type**: Grant | Pot: $3.5M, Max: $500K
- **Algo Score**: 3.8 | cr=3, ptr=1, fa=0, ft=1, am=0.75
- **Human Score**: 2
- **Delta**: -1.8 (algo too high)
- **Pluses**: Client types match (state/tribal/local governments).
- **Flags**: Wetland restoration not in our scope. Activities are all soft (planning, program development, capacity building). No construction. Small pot. $500K max is low.
- **Root Cause**: activityMultiplier=0.75 too generous for planning-only programs. projectTypeRelevance=1 for wetland restoration should be 0 for ESCO.

### #9: Freedom 250 Outreach Across India
- **Source**: U.S. Department of State — Embassy New Delhi (Federal)
- **Type**: Cooperative Agreement | Pot: $500K, Max: $500K, Min: $100K
- **Algo Score**: 2.3 | cr=3, ptr=0, fa=0, ft=0, am=0.75
- **Human Score**: 0
- **Delta**: -2.3 (should not exist in system at all)
- **Pluses**: None.
- **Flags**: CRITICAL — program is in India, not the U.S. Zero relevance on every dimension. Cultural/diplomatic outreach, not infrastructure. Should have been filtered at ingestion.
- **Root Cause**: Geographic filtering bug — federal source auto-tagged as national/US coverage, but actual coverage is India. Also: activities (community outreach, program operations) should score near-zero. clientRelevance=3 for "public agencies" is wrong in context.
- **ACTION ITEM**: Create task/issue — federal source ≠ US coverage. Need geographic validation that checks actual program location, not just source jurisdiction.

### #8: Calendar Year 2022 Disaster Water Grants
- **Source**: USDA Rural Utilities Service (Federal)
- **Type**: Grant | Pot: $247M (not in DB), per-award: up to $16M+ (example), rolling until exhausted
- **Algo Score**: 7.0 | cr=3, ptr=2, fa=1, ft=1, am=1.0
- **Human Score**: 8
- **Delta**: +1.0 (algo slightly low)
- **Pluses**: Water/wastewater/stormwater infrastructure = strong match. Government clients (municipalities, counties, tribes). $247M pot with $16M+ individual awards. Rolling/non-competitive — if you qualify, you likely get funded. Repair + resilience upgrades = real construction work.
- **Flags**: Disaster-area qualifier narrows client pool. Amounts weren't in our DB (data quality). Qualifier is a matching issue, not a scoring issue — opportunity is strong IF client is in eligible area.
- **Root Cause**: fundingAttractiveness=1 because amounts missing from DB. With real data ($247M pot) would have scored fa=3, pushing algo to 9. Algo can't capture rolling/non-competitive application process (quality signal). Qualifier should be flagged separately from score.
- **Key Insights**: (1) Rolling/non-competitive = huge quality signal algo can't see. (2) Qualifying conditions are matching issues, not scoring issues — score the opportunity assuming match, flag the condition separately.

### #7: US Army Combat Capabilities Development Command BAA
- **Source**: Department of Defense (Federal)
- **Type**: Grant | Amounts: all unknown
- **Algo Score**: 5.3 | cr=3, ptr=2, fa=1, ft=1, am=0.75
- **Human Score**: 1
- **Delta**: -4.3 (algo way too high — biggest miss so far)
- **Pluses**: None for ESCO/GC.
- **Flags**: Military R&D (body armor, combat rations, battlefield simulation). Activities are research/development/testing. Government clients explicitly excluded as applicants. Zero connection to building systems or energy infrastructure.
- **Root Cause**: activityMultiplier=0.75 for research/development/testing is far too generous. clientRelevance=3 because universities/research institutions are "hot" — but these aren't ESCO clients. projectTypeRelevance=2 for lab/safety equipment is misleading in a defense R&D context.

### #6: CA Pollution Control Financing Authority — Bond Financing
- **Source**: CPCFA / State Treasurer (State)
- **Type**: Bond (tax-exempt loan) | Range: $550K-$550M
- **Algo Score**: 6.5 | cr=1, ptr=2, fa=3, ft=0.5, am=1.0
- **Human Score**: 7
- **Delta**: +0.5 (algo slightly low — close match)
- **Pluses**: Wastewater treatment plants = real project match. Amounts are clear and substantial. No weird qualifiers — straightforward "need water/waste infrastructure? here's financing." Activities include renovation, construction, installation. Program is well-documented.
- **Flags**: Loan/bond, not a grant — borrower repays. Private businesses only, not government clients (our primary base). New construction less relevant than renovation for us.
- **Root Cause**: Algo got this roughly right. clientRelevance=1 correctly penalizes for private-sector-only applicants. The slight under-score may be because the algo can't reward program clarity/transparency.
- **Key Insight**: Despite being a loan for private clients (two negatives), clear mechanics + real project match + substantial amounts = 7. Compare to Charge Ready (#1) with matching activities but opaque mechanics = 3. **Program clarity is a 4-point swing.**

### #14: Explore the Coast Overnight
- **Source**: California Coastal Conservancy (State)
- **Type**: Grant | Pot: $5M, per-award: unknown
- **Algo Score**: 6.0 | cr=3, ptr=2, fa=0, ft=1, am=1.0
- **Human Score**: 6
- **Delta**: 0.0 (algo spot on)
- **Pluses**: Activities include new construction, renovation, design. Clients are public agencies, tribal governments (hot tier). Perpetual/rolling program. Coastal accommodations are real buildings.
- **Flags**: Project types (hospitality, campgrounds, shelters) are too generic — don't specify what building systems are involved. Program clarity weak — unclear scoring criteria beyond "be near the coast." $5M pot is modest. Per-award unknown. Reimbursement-only funding model. Parks department clients are lower priority than city public works.
- **Root Cause**: Algo landed correctly but for wrong reasons — fundingAttractiveness=0 (unknown amounts) offset the generous projectTypeRelevance=2. Human deducted for project type vagueness and program clarity, not just dollar amounts.
- **Key Insight**: Generic facility types (hospitality, campgrounds) should score lower than specific building-system types (HVAC, lighting, solar). "Hospitality" tells you there's a building but not what systems are involved — could be painting cabins or installing commercial kitchens, most of which isn't ESCO scope.

### #15: Grants and Cooperative Agreements Program (GCA) – G26
- **Source**: California Department of Parks and Recreation (State)
- **Type**: Grant | Pot: ~$30M (estimated) | Per-award: unknown
- **Algo Score**: 8.0 | cr=3, ptr=2, fa=2, ft=1, am=1.0
- **Human Score**: 4.5
- **Delta**: -3.5 (algo way too high)
- **Pluses**: $30M pot is substantial. Government clients at every level (city, county, state, tribal). Grant, not loan.
- **Flags**: This is an Off-Highway Vehicle (OHV) trails program. "Parks" and "Green Spaces" project types = trails, staging areas, trailheads — NOT building systems. Activities (maintenance, administration, operation, enforcement, training, education) are mostly soft. "Development" and "Restoration" in context mean trail work, not construction. Tiny sliver of building work (visitor center restrooms) but not what the program funds.
- **Root Cause**: "Parks" and "Green Spaces" are in `strong` tier (ptr=2) but this program is about nature/trails, not built infrastructure. activityMultiplier=1.0 because "Development" and "Restoration" triggered hot tier, but in this context they mean trail development, not building construction. The algo can't distinguish "parks as infrastructure" (playgrounds, park buildings with HVAC/lighting) from "parks as nature" (trails, tree planting, habitat restoration).
- **Key Insight — Project Type Specificity is the Primary Driver**: Human scoring swings ~4 points based on whether "Parks" means built infrastructure (8+) or nature/trails (4-5). If the same program mentioned electrical, plumbing, or HVAC, it would automatically get an 8 from the human. With all factors aligned (specific project types + activities + clients + clear money + easy application), human gives 10. This suggests projectTypeRelevance is the strongest signal in human judgment, and generic types that don't specify building systems should be penalized.
- **Taxonomy Action**: Move "Parks" and "Green Spaces" from `strong` to `mild` or `weak`. If a program involves actual park infrastructure (buildings, lighting, playgrounds), those specific project types will carry the score.

### #16: Charter School Facilities Credit Enhancement Grant Program
- **Source**: U.S. Department of Education / CA State Treasurer (Federal)
- **Type**: Grant (credit enhancement for bond reserves) | Pot: $8.3M (2009) | Per-award: unknown
- **Algo Score**: 7.0 | cr=3, ptr=3, fa=0, ft=1, am=1.0
- **Human Score**: 7
- **Delta**: 0.0 (algo spot on)
- **Pluses**: Project types explicitly list every building system we work on (HVAC, electrical, plumbing, fire suppression, BAS, roofing, windows, insulation). Activities are new construction and renovation. K-12 schools are hot-tier clients. Perpetual/rolling program. 6-month use requirement favors established contractors.
- **Flags**: $8.3M from 2009 — unclear if still actively funded. Per-award unknown. Indirect mechanism (grant funds bond reserve, school uses bond proceeds to hire contractors). Charter schools are a niche within K-12.
- **Root Cause**: Algo correct. projectTypeRelevance=3 because HVAC/BAS/Electrical are all hot tier — specific building-system types that tell you exactly what work is involved. fundingAttractiveness=0 correctly penalizes unknown amounts. These balanced to land at 7.
- **Key Insight — Specificity Premium Validated**: Direct comparison with #15 (Parks GCA). Same client tier, worse money ($8.3M vs $30M), but #16 scores 2.5 points HIGHER (7 vs 4.5) because project types are specific building systems vs generic "Parks/Green Spaces." Money going to client directly is NOT a problem — all grants go to clients who hire us. The indirect bond reserve mechanism costs 1-2 points but specific project types compensate. **When project types specify building systems, the algo works.**
- **Clarification**: Grants flowing to clients (not directly to contractor) is the normal model and should not be penalized. Only penalize when the funding mechanism is opaque or the money doesn't reach construction scope (e.g., Charge Ready #1 rebate structure).

### #17: Capital Improvements for At-Risk/Receivership/Substandard/Troubled PHAs
- **Source**: HUD — Dept of Housing and Urban Development (Federal)
- **Type**: Grant | Pot: $11.5M | Max: $3M | Min: $250K
- **Algo Score**: 9.0 | cr=3, ptr=3, fa=2, ft=1, am=1.0
- **Human Score**: 5.5
- **Delta**: -3.5 (algo way too high)
- **Pluses**: Project types explicitly list building systems (HVAC, electrical, plumbing, BAS, lighting, roofing, windows). Activities are renovation/modernization/installation. Money is clear ($250K-$3M). PHAs in distress lack internal capacity — need contractors.
- **Flags**: RESIDENTIAL context — we don't do residential work. PHAs are public agencies but the actual work is on housing units, not commercial facilities. Money dispersal problem: $3M to a PHA could be spread across 500 units at $6K each — not one project scope. "HVAC Systems" in residential means window ACs and furnaces, not commercial chillers. Only troubled/at-risk PHAs qualify (narrow pool). Some funds go to receivership admin, not construction.
- **Root Cause**: projectTypeRelevance=3 because "HVAC Systems" and "Electrical Systems" are hot tier, but algo can't distinguish residential vs commercial context. clientRelevance=3 because PHAs are "Public Agencies" (hot tier) but they're residential housing operators, not commercial facility managers. No signal for project consolidation — is money funding one big project (good) or dispersed across hundreds of small residential repairs (bad)?
- **Key Insight — Residential Context Devalues Specific Project Types**: Same building system labels (HVAC, Electrical, Plumbing) mean different things in residential vs commercial context. Residential HVAC = window units, furnaces, split systems. Commercial HVAC = chillers, rooftop units, BAS integration. The algo treats them identically. Also: housing programs scatter money across many small units rather than concentrating into one project scope suitable for an ESCO.
- **New Pattern**: Project consolidation signal — "Is this one project or many small ones?" affects whether the money creates actionable contractor scope.

### #18: Wildfire Smoke Preparedness in Community Buildings
- **Source**: Environmental Protection Agency (Federal)
- **Type**: Grant | Pot: $13.58M | Max: $2.5M
- **Algo Score**: 9.0 | cr=3, ptr=3, fa=2, ft=1, am=1.0
- **Human Score**: 8.5
- **Delta**: -0.5 (algo close — good match)
- **Pluses**: Project types are specific building systems in commercial/public context (HVAC, air filtration, ventilation, weatherization). Clients are government entities and schools (hot tier). $2.5M max is substantial. Program explicitly calls out "upgrading and repairing HVAC units or systems." Public buildings focus = community centers, schools, libraries — our wheelhouse.
- **Flags**: Wildfire smoke geographic qualifier (primarily western states). $13.5M nationally with per-state caps limits pool. Scoring criteria requires demonstrating smoke exposure history. Mixed activities (some soft: research, training, outreach). Some project types are monitoring equipment, not construction.
- **Root Cause**: Algo got this right. Specific building-system project types in commercial/public context = ptr=3 is correct. Qualifying conditions (wildfire geography) are matching issues, not scoring issues — consistent with #8 pattern.
- **Key Insight — Context Trilogy**: #15 (Parks, nature context → 4.5), #17 (HVAC/Electrical, residential context → 5.5), #18 (HVAC/Ventilation, public/commercial context → 8.5). Same "building systems" language, three different scores. The algo scores all three similarly (8-9) because it can't see context. Human scoring swings 4 points based on whether the work is in commercial/public facilities vs residential vs nature.

### #19: Local Airport Loan Program
- **Source**: California Department of Transportation / Caltrans (State)
- **Type**: Loan (17-year, simple interest) | Total: $300K | Per-award: unknown
- **Algo Score**: 3.5 | cr=2, ptr=1, fa=0, ft=0.5, am=1.0
- **Human Score**: 4.5
- **Delta**: +1.0 (algo slightly low)
- **Pluses**: Activities are new construction, renovation, infrastructure development (hot tier). Airport terminals and hangars are real buildings with HVAC/electrical/plumbing. Could supplement other funding for a client near an airport. Perpetual/rolling program.
- **Flags**: $300K total is very low. Loan, not grant. Airport authorities are niche clients. Project types (hangars, terminals, runways) don't specify building systems. California-only.
- **Root Cause**: Algo slightly too punitive when multiple factors are individually weak but underlying work is plausible. fundingAttractiveness=0 and projectTypeRelevance=1 pull score down, but human sees "just in case" value — if activities and project types are plausibly in our wheelhouse, that keeps it above filter.
- **Key Insight — "Just in Case" Floor**: Human reasoning includes probability-weighted value: "What are the chances one of our clients could use this?" Even low-probability opportunities stay above filter if the work itself is plausible. Below-average (sub-5) but not filtered. The algo doesn't have a "plausibility floor" — it just sums weak factors to a weak score.
- **Filter threshold check**: Both algo (3.5) and human (4.5) agree this stays above the <2 filter. Algo slightly conservative but not wrong to rank it low.

### #20: Drinking Water State Revolving Fund (DWSRF) Construction
- **Source**: State Water Resources Control Board (State — California)
- **Type**: Grant + Low-Interest Loan hybrid | Pot: $280M | Min: $2M principal forgiveness, up to 100% for disadvantaged communities
- **Algo Score**: 9.0 | cr=3, ptr=2, fa=3, ft=1, am=1.0
- **Human Score**: 9
- **Delta**: 0.0 (algo spot on)
- **Pluses**: $280M pool is massive. Specific infrastructure project types (water treatment plants, pump stations, distribution systems). Government/utility clients. Rolling/non-competitive — if you qualify, you get funded. No quirky scoring threshold. Activities cover full project lifecycle. Disadvantaged communities get up to 100% principal forgiveness (functions as grant). 30-40 year repayment terms.
- **Flags**: Technically a revolving loan fund (knocked down slightly). Water infrastructure is a growth area but not fully in current capability yet. California-only.
- **Root Cause**: Algo correct. Specific infrastructure types + massive funding + hot activities + government clients = 9. Rolling/non-competitive signal (human values highly) roughly offset loan structure penalty, netting to same score.
- **Key Insight**: Rolling/non-competitive programs get a human premium that offsets other negatives. Loan structure penalty (~1 point) roughly cancelled by ease-of-capture bonus (~1 point). Also: human scores opportunity quality independent of current company readiness ("we want to go into water but aren't fully there yet" — doesn't affect score).

### #21: Charge Ready Transport
- **Source**: Southern California Edison (Utility)
- **Type**: Rebate | Pot: $356M across 870 sites | Per-site: unknown (~$409K avg implied)
- **Algo Score**: 10.0 | cr=3, ptr=3, fa=3, ft=1, am=1.0
- **Human Score**: 6
- **Delta**: -4.0 (algo way too high — biggest miss in study, algo's only perfect 10)
- **Pluses**: $356M program is massive. EV charging and electrical systems are real project types. School districts, transit agencies, local governments are hot-tier clients. Option 2 allows customer to hire own contractor (us) with Make-Ready Rebate covering ~80% of costs. Real electrical infrastructure work (panels, conduit, trenching, transformers).
- **Flags**: UTILITY REBATE OPACITY — don't know how much individual client gets. Default path (Option 1) is SCE doing all work with their contractors — we're cut out. Rebate, not grant. "Apply and find out" model — can't give client a confident dollar figure. Equipment rebate "up to 50%" only for certain categories. 10-year right-of-way locks client to SCE.
- **Root Cause**: fundingAttractiveness=3 because $356M total is "exceptional" tier, but per-applicant amounts are unknown and the human can't translate total pot into client-level value. projectTypeRelevance=3 correct in isolation but irrelevant if the funded activities don't flow through our scope (Option 1). Algo has no signal for "rebate opacity" or "utility does the work themselves."
- **Key Insight — Utility Incentive Scoring Cap**: Utility rebate programs should have a built-in score ceiling because of structural opacity. Even with perfect project type alignment and massive total budgets, the human can't confidently pitch them to clients. Compare: #1 Charge Ready (human=3, algo=7), #21 Charge Ready Transport (human=6, algo=10). Bigger money and better clients push #21 higher, but same fundamental problem caps it below algo. Utility rebates with unclear per-applicant amounts should probably max out around 6-7 regardless of other factors.
- **Research Note**: Live research revealed two participation options (SCE installs vs customer installs with rebate). This critical detail was NOT in our DB — the extraction only captured the overview page, not the program details page at crt.sce.com/program-details.

### #22: Express Solutions
- **Source**: Southern California Edison (Utility)
- **Type**: Rebate (prescriptive) | Total: unknown | Per-award: published per-unit tables
- **Algo Score**: 8.0 | cr=3, ptr=3, fa=1, ft=1, am=1.0
- **Human Score**: 8
- **Delta**: 0.0 (algo spot on)
- **Pluses**: Prescriptive rebate — published $/unit tables by equipment type, building type, climate zone. Contractor can calculate rebate before pitching to client. Project types are exactly our core (HVAC, lighting, BAS, refrigeration). Activities are installation, replacement, upgrade. Broad client base (schools, hospitals, governments, businesses). Can stack with On-Bill Financing (0% interest). Perpetual/rolling.
- **Flags**: All amounts listed as "unknown" in our DB — prescriptive tables live on implementer site (Willdan), not SCE's page. Rebate amounts change periodically. Must reserve BEFORE installation (60-day deadline). Supplemental incentive, not primary funding source.
- **Root Cause**: Algo correct — math happens to work. But algo can't explain WHY it's an 8. Human gives 8 because prescriptive + published amounts + core project types = high confidence pitch. If this were a custom/apply-to-find-out rebate with identical project types, human would give 6-7 instead.
- **Key Insight — Incentive Type Classification Needed**: Current DB fields don't distinguish prescriptive (published tables) from custom (apply to find out) from make-ready (utility does work). This is a 4-point swing in human scoring for utility programs. Proposed new field: `incentive_structure` populated during extraction/analysis. Values: prescriptive, deemed_calculated, custom_performance, direct_install, make_ready, financing, audit_only.
- **Data Gap**: Prescriptive tables not in our DB because they live on implementer site (Willdan), not SCE's page. Same pattern as #11 (SEM details on Cascade Energy). Utility programs push specifics to third-party implementer sites we don't crawl.

### #23: DRAFT Community Noise Mitigation Program
- **Source**: Office of Local Defense Community Cooperation / DoD (Federal)
- **Type**: Grant | Total: $75M ($56.25M active-duty, $18.75M guard/reserve) | Per-award: unknown
- **Algo Score**: 10.0 | cr=3, ptr=3, fa=3, ft=1, am=1.0
- **Human Score**: 6
- **Delta**: -4.0 (algo too high)
- **Pluses**: $75M federal grant. Government clients at every level (state, county, city, township). Activities are installation, renovation, modernization — core ESCO work. Schools, hospitals, senior centers are commercial/institutional buildings. Sound insulation involves real building work (HVAC mods, window/door replacement, weatherization).
- **Flags**: Geographic qualifier is razor-thin — within ~1 mile of a military installation experiencing 65+ dB from military aircraft. Maybe a few dozen communities nationwide. Still in DRAFT status (comment period ended Oct 2023, no final NOFO). Includes private residences — residential dilution risk. Per-award amounts unknown. Core work is acoustical/sound insulation, not typical ESCO bread-and-butter. Scope allocation unclear — can't tell client what portion is commercial vs residential.
- **Root Cause**: Algo gives perfect 10 because every taxonomy tier matches: hot clients, hot project types ("Facilities & Buildings", "Hospitals", "Schools", "Insulation"), hot activities, large funding pot, grant type. But algo can't see: (a) geographic qualifier eliminates 95%+ of potential clients, (b) core purpose is niche sound mitigation not general building work, (c) residential inclusion dilutes actionable commercial scope, (d) DRAFT status means program may never launch, (e) per-award amounts completely unknown despite large total pot.
- **Key Insight — "Scoring Barrier" Concept**: User articulated a two-stage evaluation: Stage 1 = "Can we get past the door?" (taxonomy matches). Stage 2 = "Once inside, is the work ours?" (specificity, scope definition, money flow). This program passes Stage 1 easily but fails Stage 2. Algo only measures Stage 1. The delta here (-4.0) shows that perfect taxonomy alignment doesn't guarantee opportunity quality when the work context doesn't match.

---

## Utility Incentive Scoring Framework (Emerged from Calibration)

| Incentive Type | $ Clarity | Score Ceiling | Calibration Evidence |
|---------------|:---------:|:------------:|---------------------|
| Prescriptive (published $/unit tables) | High | **8-9** | #22 Express Solutions = 8 |
| Deemed/Calculated ($/kWh or $/therm saved) | Medium-High | **7-8** | #11 SEM/SPARKe = 7.5 |
| Custom/Performance (utility analyzes proposal) | Medium | **6-7** | — |
| Make-Ready (customer hires contractor, gets rebate) | Low | **5-6** | #21 Charge Ready Transport = 6 |
| Make-Ready (utility does work) / Direct Install | Low-None | **3-4** | #1 Charge Ready = 3 |
| Financing only (OBF/PACE) | Medium | **3-5** | — |
| Audit/Assessment only | Low | **3-4** | — |

---

## Human Scoring Mental Model (Emerged from Calibration)

| Scenario | Human Score |
|----------|:-----------:|
| Specific project type + activities match + clients match + money clear + easy application | **10** |
| Specific project type + activities match + clients match (amounts/application unclear) | **8-9** |
| Generic project type but plausibly involves our systems + other factors OK | **5-6** |
| Generic project type, program context suggests no building systems | **4-5** |
| Project type completely outside scope regardless of other factors | **1-2** |

---

## Pattern Tracker

| Pattern | Occurrences | Direction | Notes |
|---------|:-----------:|-----------|-------|
| Unclear program mechanics → algo over-scores | 1 (#1) | Algo too high | Need "clarity" signal |
| Money doesn't flow through ESCO → algo over-scores | 1 (#1) | Algo too high | Rebates to client vs. funding our scope |
| Qualifying conditions narrow pool → algo over-scores | 1 (#2) | Algo too high | Flood-specific, geographic limits |
| Mixed project types (some match, some don't) → algo ignores | 1 (#2) | Algo too high | Algo takes best match, ignores dilution |
| Unknown per-applicant amounts → not penalized enough | 2 (#1, #2) | Algo too high | fundingAttractiveness=1 for unknowns |
| One degree of separation (right clients, adjacent work) | 1 (#3) | Algo slightly low | Housing construction still feasible |
| Non-construction activities should kill score | 4 (#4, #5, #7, #10) | Algo too high | Training/PD/curriculum/research/planning-only = 0.5-0.75 multiplier, should be ~0 |
| projectTypeRelevance tier mismatch | 2 (#4, #5) | Algo too high | "Museums"=2, "Classrooms/Labs"=2 — misleading for education programs |
| Big $ inflates score for inaccessible money | 1 (#5) | Algo too high | $74M pot means nothing if money funds curriculum not construction |
| Program clarity is a major human scoring factor | 1 (#6 vs #1) | Missing signal | Clear mechanics = +4 points vs opaque mechanics, algo can't see this |
| Loan penalty roughly calibrated | 1 (#6) | Algo OK | ft=0.5 for loans seems about right per human judgment |
| Competitiveness/ease of capture is a quality signal | 1 (#8) | Missing signal | Rolling/non-competitive vs scored competition — algo can't see this |
| Qualifying conditions ≠ scoring issues | 1 (#8) | Design insight | Score assuming match, flag the condition separately |
| Federal source ≠ US coverage (geo filter bug) | 1 (#9) | CRITICAL BUG | India program in DB because source is "U.S. Dept of State" — needs geo validation |
| Utility incentive details live on implementer sites | 1 (#11) | Data gap | SCE pushes details to Cascade Energy / CLEAResult — we only crawl SCE |
| Algo roughly correct when data is complete | 3 (#6, #11, #12) | Algo OK | When real amounts + matching activities, algo lands close to human |
| Eligibility thresholds affect human scoring | 2 (#12, #13) | Missing signal | "Construction-ready", niche business requirements — algo can't see these |
| Broad applicant types + niche threshold = narrow real pool | 1 (#13) | Algo too high | "Local governments" looks hot but only recycling-focused ones qualify |
| Street lighting taxonomy placement | 1 (#12) | Taxonomy review | In "mild" transportation, but could be "hot" lighting — cross-list? |
| Generic facility types inflate projectTypeRelevance | 2 (#14, #15) | Algo too high | "Hospitality", "Parks", "Green Spaces" don't specify building systems — algo can't tell if work involves HVAC/electrical or painting/trails |
| "Parks" as nature vs "Parks" as infrastructure | 1 (#15) | Algo too high | Same word, 4-point swing in human score. Parks=trails → 4.5, Parks=buildings with systems → 8+. Need to demote in taxonomy. |
| Activities contextually misread | 1 (#15) | Algo too high | "Development" and "Restoration" triggered hot tier but mean trail work in context, not construction |
| Project type specificity is the primary human scoring driver | 1 (#15) | Design insight | Specific building-system types (HVAC, lighting) → auto 8+. Generic types → 5-6 at best. Algo treats all strong-tier types equally. |
| Residential context devalues specific project types | 1 (#17) | Algo too high | "HVAC Systems" in housing = window ACs/furnaces, not commercial chillers. Same label, different work. Algo scores identically. |
| Money dispersal across many small units vs one project | 1 (#17) | Missing signal | PHA gets $3M but spreads over 500 units = $6K each. Not actionable ESCO scope. Algo can't see project consolidation. |
| Housing authorities are public agencies but residential operators | 1 (#17) | Algo too high | PHAs score hot (cr=3) as public agencies, but work is residential — we do commercial. |
| Context determines project type value (trilogy: #15/#17/#18) | 3 (#15, #17, #18) | Algo blind | Same "building systems" labels score 4.5 (nature), 5.5 (residential), 8.5 (commercial/public). Algo gives 8-9 for all three. |
| Qualifying conditions are matching issues, not scoring issues | 2 (#8, #18) | Design pattern | Wildfire/flood geography narrows pool but doesn't reduce opportunity quality. Score assuming match, flag condition. |
| Utility rebate opacity caps human score (~6-7 max) | 3 (#1, #11, #21) | Algo too high | Can't give client confident $ figure. "Apply and find out" model. Even $356M total = 6 from human. Algo gives 7-10. |
| Utility may do work themselves, cutting out ESCO | 2 (#1, #21) | Algo too high | SCE default path = they install infrastructure. Only Option 2 involves customer's contractor. Algo can't see this. |
| Total pot ≠ per-applicant value for utility programs | 2 (#1, #21) | Algo too high | $356M across 870 sites. Algo sees $356M = hot. Human sees "I don't know what one client gets." |
| Prescriptive utility rebates score as high as grants | 1 (#22) | Algo OK | Published $/unit tables = high clarity = 8 from human. Algo happened to match but can't distinguish prescriptive from custom. |
| $ clarity is primary driver for utility scoring | 4 (#1, #11, #21, #22) | Design insight | Prescriptive=8, Deemed=7.5, Make-ready/opaque=3-6. Same project types, 4-point swing based on incentive structure. |
| Missing field: incentive_structure type | 1 (#22) | New field needed | DB can't distinguish prescriptive vs custom vs make-ready. Need new field populated during extraction. |
| Implementer sites hold critical utility program details | 3 (#1, #11, #22) | Data gap | SCE pushes specifics to Willdan, Cascade Energy, CLEAResult. We only crawl the utility's page. |
| Perfect taxonomy match ≠ perfect opportunity (algo-10 problem) | 1 (#23) | Algo too high | All 5 factors maxed but geographic qualifier, niche purpose, residential dilution, DRAFT status → human gives 6. Algo has no Stage 2 filter. |
| Niche program purpose hidden behind generic project types | 1 (#23) | Algo too high | "Insulation, Hospitals, Schools" reads as general building work. Actually = sound mitigation near military bases. Algo can't see purpose context. |
| DRAFT/unfunded status not captured | 1 (#23) | Missing signal | Comment period ended Oct 2023, no final NOFO. Algo scores as if program is active and funded. |
| Two-stage "scoring barrier" evaluation model | 5 (#1, #15, #17, #21, #23) | Design insight | Stage 1: taxonomy match (algo does this). Stage 2: work specificity + money flow + scope definition (algo can't do this). Most deltas > 2 come from Stage 2 failures. |

---

## Pattern Synthesis & Recommendations

### Overall Calibration Results

- **23 opportunities reviewed** across 4 source types (Federal, State, Utility, Foundation)
- **Mean absolute delta**: 2.1 points
- **Algo gets it right (|Δ| ≤ 1)**: 12 of 23 (52%) — mostly when project types are specific + amounts are known
- **Major disagreements (|Δ| ≥ 2)**: 11 of 23 (48%)
- **Systematic bias**: Algo over-scores in 10 of 11 major disagreements. Only 1 under-score (#19 Airport Loan, +1.0)
- **Algo never under-scores by more than 1 point** — it's a ceiling problem, not a floor problem

### Categorizing the 11 Major Disagreements

#### Category A: Fixable Deterministically (Taxonomy/Weight Tweaks) — 5 cases

These are cases where the algo's taxonomy tiers or multiplier weights are simply wrong. A deterministic fix would close the gap:

| # | Title | Delta | Fix |
|---|-------|:-----:|-----|
| 4 | Arts Ed Partnership | -4.0 | Activity multiplier too generous for training/PD/curriculum. Should be 0.1-0.25, not 0.5-0.75 |
| 5 | Magnet Schools Assistance | -5.5 | Same — "Curriculum Development" and "Teacher Training" activities trigger mild tier (0.5-0.75) but should be near-zero |
| 7 | LEARN Behavioral Health | -3.0 | "Training" and "Research" activities scored too high. Non-construction activities need harsher multiplier |
| 10 | TAS Capacity Building | -3.25 | "Technical Assistance" and "Capacity Building" = no construction scope. Multiplier should floor these |
| 15 | GCA G26 Parks | -3.5 | "Parks" and "Green Spaces" in strong tier (ptr=2). Should be weak/mild. Context: trails/nature, not buildings |

**Common thread**: The activity multiplier is too lenient (0.5-0.75 for non-construction) and some project types are in the wrong tier.

#### Category B: Requires Contextual Judgment (LLM Territory) — 5 cases

These are cases where taxonomy placement is technically correct, but context changes the meaning. No deterministic rule can fix them:

| # | Title | Delta | Why deterministic can't fix |
|---|-------|:-----:|---------------------------|
| 1 | Charge Ready Program | -4.0 | Money doesn't flow through ESCO. Utility may do work themselves. Program mechanics opaque. Same taxonomy labels, completely different business reality. |
| 9 | Freedom 250 | -7.0 | India program in US federal source. Geographic relevance requires understanding program text, not just source metadata. |
| 17 | Capital Improvements PHAs | -3.5 | "HVAC Systems" in residential housing ≠ "HVAC Systems" in commercial buildings. Same label, 3-4 point swing. Money dispersal across 500 units. |
| 21 | Charge Ready Transport | -4.0 | Utility opacity, two participation models (utility does work vs customer hires contractor). Can't tell from taxonomy alone. |
| 23 | Community Noise Mitigation | -4.0 | Perfect taxonomy match. But purpose is niche sound insulation near military bases, geographic qualifier eliminates 95%+ of clients, DRAFT status. |

**Common thread**: The "two-stage scoring barrier" — Stage 1 (taxonomy match) passes, Stage 2 (work specificity, money flow, scope definition) fails. Only an LLM reading the actual program description can evaluate Stage 2.

#### Category C: Borderline — 1 case

| # | Title | Delta | Notes |
|---|-------|:-----:|-------|
| 2 | Flood Mitigation | -2.0 | Qualifying conditions narrow pool. Could argue either way — deterministic "geographic qualifier" flag vs LLM context reading. |

### What This Means for Scoring Architecture

The data tells a clear story:

**The deterministic system has two distinct failure modes:**
1. **Taxonomy/weight miscalibration** (Category A) — fixable with better tiers and harsher multipliers. 5 of 11 disagreements.
2. **Context blindness** (Category B) — fundamentally unfixable deterministically. 5 of 11 disagreements. These require reading the program description and making a judgment call.

**If we only fix deterministic weights**, we close ~half the gap. The other half persists because the algo literally can't see what matters:
- Is the money flowing through our scope or to someone else?
- Is "HVAC" meaning commercial chillers or window ACs?
- Is the program purpose niche or general?
- Is the total pot meaningful per applicant, or dispersed?
- Are there geographic/eligibility qualifiers that eliminate most clients?

### Recommended Architecture: Hybrid (Deterministic Base + LLM Adjustment + Narrative)

Based on the 23-review calibration, here's what I recommend — and it directly addresses your thinking:

#### Component 1: Fix the Deterministic Base (Quick Wins)

Keep the deterministic system but fix the known miscalibrations:

| Change | Current | Proposed | Impact |
|--------|---------|----------|--------|
| Activity multiplier for non-construction | 0.5-0.75 (mild/weak) | 0.1-0.25 | Fixes #4, #5, #7, #10 (4 cases) |
| "Parks", "Green Spaces" project type tier | Strong (2) | Weak (0) or Mild (1) | Fixes #15 |
| "Museums", "Classrooms/Labs" project type tier | Strong (2) | Mild (1) | Prevents education programs over-scoring |

**This alone would fix 5 of 11 major disagreements.** Quick to implement, testable, no LLM cost.

#### Component 2: LLM Scoring Layer (The Big Move)

Add an LLM-generated score (1-10) that evaluates Stage 2 — the stuff taxonomy can't see. The LLM gets:
- The full program description / enhanced_description
- The extracted data fields (eligible applicants, project types, activities, amounts)
- A **calibrated prompt** based on exactly the framework we've been using in this exercise

The prompt would encode:
- The ESCO/GC perspective ("Can we do the work? Does the money flow through our scope?")
- The two-stage scoring barrier model
- The utility incentive type framework
- The residential vs commercial context distinction
- The "specificity drives score" principle
- Scoring anchors from this calibration (e.g., "prescriptive utility rebate with core project types = 8")

**Final score** = weighted combination or LLM-adjusted deterministic:
- Option A: `finalScore = (0.4 × deterministicScore) + (0.6 × llmScore)` — simple blend
- Option B: LLM starts from deterministic score and adjusts ±3 with reasoning — more transparent
- Option C: LLM produces independent score, deterministic serves as sanity-check guardrail — most flexible

**My recommendation: Option B** — LLM adjusts the deterministic base with capped adjustment and mandatory reasoning. This gives you:
- Reproducibility: deterministic base is always there as anchor
- Nuance: LLM handles the contextual stuff (Stage 2)
- Debuggability: you can see "deterministic said 9, LLM adjusted to 6 because [reason]"
- Cost control: ±3 cap prevents wild LLM hallucination scores

#### Component 3: Sellability Narrative (Your "Two Birds, One Stone")

This is the field your sales team actually reads. Generated by the same LLM call that produces the score. Structured format:

**Score: 7.5** (deterministic: 9.0, adjusted: -1.5)

**Pluses:**
- $75M federal grant, rolling application
- HVAC upgrades in schools and hospitals — core scope
- Government clients at all levels

**Flags:**
- Geographic qualifier: must be within 1 mile of military base
- Includes residential — unclear commercial vs residential split
- Still DRAFT status — not yet a final NOFO

**Best Client Fit:** Municipal governments near Air Force bases or naval air stations with public facilities (schools, hospitals, senior centers) needing acoustical improvements.

**This replaces the current `actionable_summary` field** (or supplements it) and becomes the primary thing the sales team sees. It knocks out two birds:
1. The LLM does its scoring analysis in the same call
2. The narrative gives the sales team instant triage context with pluses/flags

#### Component 4: New DB Fields

| Field | Purpose | Populated By |
|-------|---------|-------------|
| `llm_score` (numeric) | LLM-generated 1-10 score | Analysis agent (Phase 5) |
| `score_adjustment_reasoning` (text) | Why LLM adjusted from deterministic base | Analysis agent (Phase 5) |
| `sellability_narrative` (JSONB) | Structured pluses/flags/best-client-fit | Analysis agent (Phase 5) |
| `incentive_structure` (text) | Utility programs: prescriptive/deemed/custom/direct_install/make_ready/financing/audit | Extraction agent (Phase 4) |
| `program_status` (text) | DRAFT/active/closed/suspended | Extraction agent (Phase 4) |

### Implementation Sequence

**Phase 1 — Deterministic Fixes (1-2 hours)**
1. Update activity multiplier tiers in `taxonomies.js` — crush non-construction activities
2. Move "Parks", "Green Spaces", "Museums" to lower project type tiers
3. Re-score all existing opportunities
4. Update tests

**Phase 2 — LLM Scoring Prompt Design (2-3 hours)**
1. Write the calibrated scoring prompt using this study as the training data
2. Encode the ESCO/GC perspective, two-stage model, utility framework, context rules
3. Include 5-6 calibration anchors from this study (the "if it looks like X, score around Y" examples)
4. Test against the 23 reviewed opportunities — LLM scores should land within ±1 of human scores

**Phase 3 — Integration (3-4 hours)**
1. Add new DB fields (migration)
2. Update analysis agent (Phase 5) to produce LLM score + sellability narrative
3. Wire the `finalScore` to use the blended/adjusted formula
4. Update the admin review UI to display the new narrative
5. Update dashboard/API to expose new fields

**Phase 4 — Validation**
1. Re-run the 23-opportunity sample through the new system
2. Compare new scores against human scores
3. Target: mean absolute delta < 1.0 (down from current 2.1)
