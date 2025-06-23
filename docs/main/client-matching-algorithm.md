# Client-Opportunity Matching Algorithm

This document outlines the algorithm used to match clients with funding opportunities in our platform.

## Overview

The matching system automatically identifies relevant funding opportunities for specific clients based on eligibility criteria and alignment with client needs. The algorithm produces a match score (0-100) representing how well an opportunity fits a particular client.

## Matching Process

The matching process follows a two-stage approach:

1. **Binary Eligibility Check**: Determine if the client meets basic eligibility requirements
2. **Fit Scoring**: For eligible opportunities, calculate how well they align with client needs

## Stage 1: Binary Eligibility Checks

These checks are pass/fail gates. If a client fails any of these checks, the match score is automatically 0.

### Geographic Eligibility

Determines if the client is in an eligible location:

| Condition                                               | Result |
| ------------------------------------------------------- | ------ |
| Client location not in eligible areas                   | FAIL   |
| Client location explicitly excluded                     | FAIL   |
| Client in eligible area (state, county, etc.)           | PASS   |
| Opportunity is national with no geographic restrictions | PASS   |

### Applicant Type Eligibility

Determines if the client's organization type is eligible:

| Condition                                         | Result |
| ------------------------------------------------- | ------ |
| Client type not listed in eligible applicants     | FAIL   |
| Client type explicitly excluded                   | FAIL   |
| Client type matches an eligible category          | PASS   |
| Client type falls under broader eligible category | PASS   |

## Stage 2: Weighted Scoring Components

If a client passes all binary eligibility checks, we calculate a weighted score based on three factors:

### 1. Project Type Alignment (50% of total score)

Measures how well the opportunity's eligible project types match the client's interests:

```javascript
function calculateProjectAlignment(client, opportunity) {
	const clientProjectTypes = new Set(client.projectTypes);
	const opportunityProjectTypes = new Set(opportunity.projectTypes);

	// Handle edge cases
	if (clientProjectTypes.size === 0 || opportunityProjectTypes.size === 0)
		return 0.5;

	// Calculate matching percentage
	let matchingTypes = 0;
	for (const type of opportunityProjectTypes) {
		if (clientProjectTypes.has(type)) {
			matchingTypes++;
		}
	}

	return matchingTypes / opportunityProjectTypes.size;
}
```

### 2. Funding Amount Fit (30% of total score)

Evaluates how well the funding amount aligns with the client's typical project scale:

| Condition                                             | Score |
| ----------------------------------------------------- | ----- |
| Minimum award > client's maximum project budget       | 0.0   |
| Maximum award < client's minimum project budget       | 0.0   |
| Award range partially overlaps client's budget range  | 0.5   |
| Award range fully encompasses client's typical budget | 1.0   |

### 3. Timeline Compatibility (20% of total score)

Assesses whether the application timeline aligns with client readiness:

| Condition                     | Score |
| ----------------------------- | ----- |
| Application due in <14 days   | 0.0   |
| Application due in 15-30 days | 0.3   |
| Application due in 31-90 days | 0.7   |
| Application due in >90 days   | 1.0   |

## Bonus Points

Additional points (up to 10%) may be added for special circumstances:

- Client is in a priority area specifically mentioned (+5%)
- Client has successfully received similar funding in the past (+3%)
- Client has unique characteristics that align with program priorities (+2%)

## Final Score Calculation

```javascript
function calculateMatchScore(client, opportunity) {
	// Stage 1: Binary eligibility checks
	if (
		!isGeographicallyEligible(client, opportunity) ||
		!isEligibleApplicantType(client, opportunity)
	) {
		return {
			score: 0,
			eligible: false,
			reason: 'Client does not meet basic eligibility requirements',
		};
	}

	// Stage 2: Calculate weighted scores
	const projectAlignmentScore =
		calculateProjectAlignment(client, opportunity) * 0.5;
	const fundingFitScore = calculateFundingFit(client, opportunity) * 0.3;
	const timelineScore =
		calculateTimelineCompatibility(client, opportunity) * 0.2;

	// Apply any bonus points
	const bonusPoints = calculateBonusPoints(client, opportunity);

	// Calculate final score (base 100)
	const totalScore = Math.min(
		100,
		(projectAlignmentScore + fundingFitScore + timelineScore) * 100 +
			bonusPoints
	);

	return {
		score: Math.round(totalScore),
		eligible: true,
		components: {
			projectAlignment: projectAlignmentScore * 100,
			fundingFit: fundingFitScore * 100,
			timeline: timelineScore * 100,
			bonus: bonusPoints,
		},
	};
}
```

## Project Type Taxonomy

The system uses a standardized taxonomy of project types to enable matching:

- Building Envelope
- HVAC Systems
- Lighting
- Roofing
- Flooring
- Windows
- Solar/Renewable Energy
- Energy Management Systems
- Water Conservation
- Electrical Systems
- Plumbing
- Security Systems
- ADA Compliance
- Asbestos/Lead Abatement
- Technology Infrastructure
- Outdoor Facilities

## Implementation Notes

### Project Type Extraction

For funding opportunities, project types are extracted through:

1. AI analysis of opportunity description text
2. Human review/confirmation of extracted types
3. Storage as structured data with the opportunity

### Client Project Type Collection

Client project types are collected through:

1. Multi-select interface during client onboarding
2. Regular updates during client check-ins
3. Storage as an array of standardized project types

### Match Recalculation Triggers

Match scores are recalculated when:

- New funding opportunities are added
- Client profiles are updated
- Opportunity details change (deadlines, eligibility, etc.)
- Periodically to account for timeline changes

## Score Interpretation

| Score Range | Interpretation                  |
| ----------- | ------------------------------- |
| 90-100      | Excellent match - high priority |
| 75-89       | Strong match - recommended      |
| 50-74       | Moderate match - consider       |
| 25-49       | Weak match - low priority       |
| 1-24        | Poor match - not recommended    |
| 0           | Not eligible                    |
