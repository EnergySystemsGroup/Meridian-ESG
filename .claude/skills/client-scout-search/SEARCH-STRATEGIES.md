# Client Scout Search — Search Strategies Reference

This document contains detailed search strategies, query templates, and navigation
guidance for each source-type wave. Read this file before executing any searches.

**Parent skill**: `.claude/skills/client-scout-search/SKILL.md`

---

## 0. Content Retrieval Standard

Same protocol as the extraction skill. Follow this for ALL URL fetching:

### HTML Pages
1. WebFetch(url) — check if content is substantive
2. If empty/garbled/JS-rendered → Playwright (`browser_navigate` + `browser_snapshot`)

### PDF Documents
```bash
curl -sL -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "PDF_URL" | python3 -c "
import sys, fitz
doc = fitz.open(stream=sys.stdin.buffer.read(), filetype='pdf')
for page in doc[:20]: print(page.get_text())
"
```
- ALWAYS include User-Agent header (many gov sites block bare curl)
- Check Content-Length first — skip if > 10MB
- Extract first 20 pages only for large PDFs
- If curl gets 403 after User-Agent: try temp file approach
- If still blocked: use Playwright as final fallback

### Login-Gated Pages
Flag as "requires login, could not crawl" — skip entirely.

---

## 1. Utility Wave Strategies

**Goal**: Find rebate/incentive programs from the client's specific utilities.

You will receive the exact utility names (e.g., "Southern California Edison",
"Southern California Gas Company"). These are the client's actual utilities
resolved from their coverage areas.

### Strategy 1.1 — Direct Utility Website Crawl

1. **Navigate to the utility's website** (provided in your prompt or search for it)
2. **Find their rebates/incentives section**:
   - Look for nav links: "Rebates", "Incentives", "Savings", "Programs", "Business Solutions"
   - Try common URL patterns: `/business/rebates`, `/commercial/incentives`, `/savings-and-rebates`
3. **For each project need in your chunk**, scan the program listings:
   - Does the utility offer a rebate for HVAC? For lighting? For solar?
   - Check program eligibility — does it cover commercial/institutional customers?
   - Check applicant types — does it accept schools, governments, businesses?
4. **Follow program links 1-2 levels deep** to get details (title, URL, funding type, status)

### Strategy 1.2 — Targeted Web Search

For each project need in your chunk, execute these queries:

```
"[utility_name]" "[project_need]" rebate
"[utility_name]" "[project_need]" incentive program
"[utility_name]" commercial "[project_need]" program
"[utility_name]" business rebate "[project_need]"
```

Examples:
```
"Southern California Edison" "HVAC" rebate
"Southern California Edison" commercial "solar" incentive program
"SoCalGas" "water heating" rebate program
```

### Strategy 1.3 — DSIRE Lookup

Search DSIRE (Database of State Incentives for Renewables & Efficiency):

1. WebSearch: `site:dsireusa.org "[utility_name]"`
2. Or navigate: `https://www.dsireusa.org/` → search by utility name or state
3. DSIRE lists utility-specific programs that may not appear on the utility's own site
4. Cross-reference against findings from Strategy 1.1

### Strategy 1.4 — Third-Party Implementer Check

Many utility programs are administered by third parties. Check for:
- CLEAResult, ICF, Franklin Energy, Ecology Action, Resource Innovations
- Search: `"[utility_name]" "[project_need]" site:clearesult.com` (or other implementer domains)
- These implementer sites sometimes list programs not prominently featured on the utility site

### Strategy 1.5 — DAC-Specific (if client.dac = true)

Additional searches for disadvantaged community programs:
```
"[utility_name]" disadvantaged community program
"[utility_name]" low-income "[project_need]"
"[utility_name]" equity program "[project_need]"
"[utility_name]" environmental justice
```

---

## 2. County/City Wave Strategies

**Goal**: Find local government grants and programs from the client's county and city.

### Strategy 2.1 — County Government Website

1. **Navigate to the county government website**
2. **Identify relevant departments**: Sustainability, Environment, Housing, Economic Development, Public Works, Community Development
3. **For each department**, check for grant/incentive programs related to your project needs
4. **Search for specific programs**:
   ```
   "[county_name]" grant "[project_need]"
   "[county_name]" sustainability program "[project_need]"
   "[county_name]" green building incentive
   ```

### Strategy 2.2 — City Government Website

1. **Navigate to the city government website**
2. **Check for**: sustainability programs, green business programs, permit fee waivers, development incentives
3. **Search**:
   ```
   "[city_name]" city grant "[project_need]"
   "City of [city_name]" incentive program "[project_need]"
   "[city_name]" green building program
   ```

### Strategy 2.3 — Regional Programs

Some programs are administered at the regional level (e.g., air quality management districts,
metropolitan planning organizations, regional water boards):

```
"[county_name]" region grant "[project_need]"
"[county_name]" air quality district incentive
"[county_name]" water board rebate
```

### Strategy 2.4 — CDBG and Federal Pass-Through

Counties and cities often administer federal pass-through grants (CDBG, EECBG, etc.):
```
"[county_name]" CDBG "[project_need]"
"[county_name]" "Energy Efficiency Conservation Block Grant"
"[city_name]" federal grant "[project_need]"
```

---

## 3. State Wave Strategies

**Goal**: Find state-level programs matching the client's type and project needs.

### Strategy 3.1 — State Energy Office

Every state has an energy office or commission. Search their programs:
```
"[state_name]" energy commission "[project_need]" grant
"[state_name]" energy office incentive "[project_need]"
"[state_name]" "[project_need]" rebate program
```

### Strategy 3.2 — State Agency Programs

Search across relevant state agencies:
```
"[state_name]" department of education grant "[project_need]"   (if client is K-12)
"[state_name]" environmental agency "[project_need]" program
"[state_name]" public utilities commission "[project_need]"
"[state_name]" housing finance authority "[project_need]"
```

Tailor agency searches to the client type:
- **K-12 Schools**: state education department, school facility programs
- **Local Governments**: state infrastructure bank, revolving loan funds
- **Nonprofits**: state community development programs
- **Businesses**: state economic development incentives

### Strategy 3.3 — DSIRE State Filter

```
site:dsireusa.org "[state_name]" "[project_need]"
```

DSIRE has comprehensive state-level program listings. Filter by the client's state
and look for programs matching the project needs.

### Strategy 3.4 — State-Specific Known Programs

Some states have well-known flagship programs. Search for these:
```
"[state_name]" clean energy fund "[project_need]"
"[state_name]" green bank "[project_need]"
"[state_name]" PACE program "[project_need]"
"[state_name]" property assessed clean energy
```

### Strategy 3.5 — DAC-Specific (if client.dac = true)

```
"[state_name]" environmental justice grant "[project_need]"
"[state_name]" disadvantaged community "[project_need]"
"[state_name]" equity program energy
```

---

## 4. Federal Wave Strategies

**Goal**: Find federal programs matching the client's type and project needs.

### Strategy 4.1 — Grants.gov Search

```
site:grants.gov "[project_need]" "[client_type_keyword]"
grants.gov "[project_need]" open funding opportunity
```

Note: Grants.gov has many expired listings. Verify status before reporting.

### Strategy 4.2 — Department of Energy (DOE)

```
site:energy.gov "[project_need]" funding "[client_type_keyword]"
"Department of Energy" "[project_need]" grant program
DOE "[project_need]" technical assistance program
```

Key DOE offices:
- Office of Energy Efficiency & Renewable Energy (EERE)
- Office of State and Community Energy Programs
- Loan Programs Office

### Strategy 4.3 — EPA

```
site:epa.gov "[project_need]" grant "[client_type_keyword]"
EPA "[project_need]" funding program
"Environmental Protection Agency" "[project_need]"
```

Key EPA programs:
- Environmental Justice grants
- Clean Air Act grants
- Water infrastructure funding (DWSRF, CWSRF)

### Strategy 4.4 — USDA (if applicable)

For rural clients or agriculture-related needs:
```
site:usda.gov "[project_need]" grant
USDA rural energy program
"Rural Energy for America Program" REAP
```

### Strategy 4.5 — IRA / Bipartisan Infrastructure Law Programs

Recent federal legislation created many new programs:
```
"Inflation Reduction Act" "[project_need]" "[client_type_keyword]"
"IRA" direct pay "[project_need]"
"Bipartisan Infrastructure Law" "[project_need]" grant
```

### Strategy 4.6 — Federal Aggregator Sites

- **CleanEnergy.gov**: Federal clean energy program finder
- **Energycommunities.gov**: For energy community designations
- **WhiteHouse.gov/cleanenergy**: Federal program announcements

---

## 5. Foundation Wave Strategies

**Goal**: Find private foundation and nonprofit grants matching the client's sector.

### Strategy 5.1 — Foundation Directories

```
site:candid.org "[project_need]" grant "[client_type_keyword]"
"foundation grant" "[project_need]" "[client_type_keyword]"
```

### Strategy 5.2 — Sector-Specific Foundations

Tailor to client type:

**K-12 Schools**:
```
"school" "green building" foundation grant
"K-12" "[project_need]" foundation funding
"education" "sustainability" grant "[project_need]"
"school facilities" grant "[project_need]"
```

**Local Governments**:
```
"local government" "sustainability" foundation grant
"municipal" "[project_need]" foundation funding
"Bloomberg Philanthropies" "[project_need]"    (known municipal funder)
```

**Nonprofits**:
```
"nonprofit" "[project_need]" foundation grant
"community development" "[project_need]" funding
```

### Strategy 5.3 — Climate/Energy Foundations

Major climate and energy funders:
```
"Kresge Foundation" "[project_need]"
"Barr Foundation" "[project_need]"
"Energy Foundation" grant "[project_need]"
"Bloomberg" environment "[project_need]"
"McKnight Foundation" "[project_need]"
"Heising-Simons Foundation" "[project_need]"
```

### Strategy 5.4 — Corporate/Utility Foundations

Many utilities have affiliated foundations:
```
"[utility_name] foundation" grant
"[state_name]" utility foundation "[project_need]"
```

---

## 6. Cross-Wave Tips

### Query Formulation Best Practices

- **Quote exact phrases**: `"solar panels"` not `solar panels`
- **Use the client type keyword**: "school", "government", "commercial", "nonprofit"
- **Include "program" or "grant" or "rebate"**: Filters out news/blog results
- **Try both formal and informal names**: "HVAC Systems" and also "heating cooling rebate"
- **Use project need synonyms**: "Solar Panels" → also try "photovoltaic", "solar PV", "solar installation"

### Recognizing Real Programs vs Noise

**Real program indicators**:
- "Apply now", "Application deadline", "How to apply"
- Specific dollar amounts ("up to $50,000", "$0.10/kWh")
- Eligibility requirements listed
- Application forms or portals linked
- PDF guidelines or handbooks available

**Noise indicators**:
- News articles about legislation ("bill passed" without an actual program page)
- Blog posts summarizing programs (find the original source instead)
- Expired programs with no indication of future rounds
- General information pages without application details

### Rate Limiting

- 2-3 second pause between fetches to the same domain
- Don't hammer a single website with 20 requests in a row
- If you get rate-limited (429), wait 10 seconds and retry once
