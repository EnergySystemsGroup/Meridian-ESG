/**
 * Pipeline: Analysis Scoring Tests
 *
 * Tests the deterministic scoring algorithms:
 * - Tier scoring based on applicant types
 * - Funding scoring based on amounts
 * - Activity scoring based on project types
 * - Combined relevance scoring
 * - Activity multiplier with calibrated tiers
 *
 * NOTE: Scoring is 100% deterministic and should have exhaustive coverage.
 *
 * Calibration reference: docs/scoring-calibration/calibration-study.md
 * - 23-opportunity blind review against human business judgment
 * - Activity multiplier weak tier: 0.25 → 0.15 (training/research programs score <2)
 * - Project types: Parks/Green Spaces demoted strong→mild, Landscaping strong→weak
 * - Activities: soft/operational (Training, Education, TA, etc.) demoted mild→weak
 */

import { describe, test, expect } from 'vitest';

/**
 * Calculate tier score based on eligible applicant types
 * Higher scores for government/municipal applicants (primary target)
 */
function calculateTierScore(eligibleApplicantTypes = []) {
  if (!eligibleApplicantTypes || eligibleApplicantTypes.length === 0) {
    return 0;
  }

  const tierScores = {
    // Tier 1: Primary targets (highest value)
    'Municipal Government': 10,
    'City Government': 10,
    'County Government': 9,
    'State Government': 9,
    'Tribal Government': 9,

    // Tier 2: Public entities
    'Public Housing Authority': 8,
    'School District': 8,
    'Public School': 8,
    'University': 7,
    'Community College': 7,

    // Tier 3: Utilities and non-profits
    'Utility': 7,
    'Electric Utility': 7,
    'Non-Profit Organization': 6,
    'Non-Profit': 6,

    // Tier 4: Commercial (lower priority)
    'Commercial Entity': 4,
    'Small Business': 5,
    'Business': 4,
  };

  let maxScore = 0;
  for (const applicantType of eligibleApplicantTypes) {
    const normalizedType = applicantType.trim();
    const score = tierScores[normalizedType] || 3; // Default score for unknown types
    maxScore = Math.max(maxScore, score);
  }

  return maxScore;
}

/**
 * Calculate funding score based on award amounts
 * Higher scores for larger funding amounts
 */
function calculateFundingScore(maximumAward = null, totalFunding = null) {
  const amount = maximumAward || totalFunding || 0;

  if (amount <= 0) return 0;
  if (amount < 10000) return 2;
  if (amount < 50000) return 3;
  if (amount < 100000) return 4;
  if (amount < 500000) return 5;
  if (amount < 1000000) return 6;
  if (amount < 5000000) return 7;
  if (amount < 10000000) return 8;
  if (amount < 50000000) return 9;
  return 10;
}

/**
 * Calculate activity score based on project types
 * Higher scores for "hot" activities (construction, implementation)
 */
function calculateActivityScore(eligibleProjectTypes = []) {
  if (!eligibleProjectTypes || eligibleProjectTypes.length === 0) {
    return 0;
  }

  // Hot activities that indicate implementation/construction
  const hotActivities = [
    'Solar', 'Wind', 'Battery Storage', 'EV Charging', 'HVAC',
    'Weatherization', 'Energy Efficiency', 'Building Electrification',
    'Heat Pump', 'LED Lighting', 'Insulation', 'Construction',
    'Installation', 'Implementation', 'Retrofit',
  ];

  // Moderate activities (planning, assessment)
  const moderateActivities = [
    'Energy Audit', 'Assessment', 'Planning', 'Feasibility Study',
    'Technical Assistance', 'Workforce Development', 'Training',
  ];

  let hasHot = false;
  let hasModerate = false;

  for (const projectType of eligibleProjectTypes) {
    const normalized = projectType.toLowerCase();

    if (hotActivities.some(hot => normalized.includes(hot.toLowerCase()))) {
      hasHot = true;
    }
    if (moderateActivities.some(mod => normalized.includes(mod.toLowerCase()))) {
      hasModerate = true;
    }
  }

  if (hasHot) return 10;
  if (hasModerate) return 6;
  if (eligibleProjectTypes.length > 0) return 4;
  return 0;
}

/**
 * Calculate combined relevance score
 */
function calculateRelevanceScore(opportunity) {
  const tierScore = calculateTierScore(opportunity.eligible_applicant_types);
  const fundingScore = calculateFundingScore(
    opportunity.maximum_award,
    opportunity.total_funding_available
  );
  const activityScore = calculateActivityScore(opportunity.eligible_project_types);

  // Weighted average: tier (40%), funding (30%), activity (30%)
  const weighted = (tierScore * 0.4) + (fundingScore * 0.3) + (activityScore * 0.3);

  return Math.round(weighted * 10) / 10; // Round to 1 decimal
}

/**
 * Taxonomy-based tier scoring (mirrors production scoringAnalyzer.js)
 * Returns score based on highest matching tier: 3=hot, 2=strong, 1=mild, 0=weak/none
 */
function calculateTaxonomyTierScore(values, taxonomy) {
  if (!values || values.length === 0) return 0;
  if (values.some(v => taxonomy.hot.includes(v))) return 3;
  if (values.some(v => taxonomy.strong.includes(v))) return 2;
  if (values.some(v => taxonomy.mild.includes(v))) return 1;
  return 0;
}

/**
 * Activity multiplier (mirrors production scoringAnalyzer.js)
 * Calibrated values: hot=1.0, strong=0.75, mild=0.5, weak=0.15
 */
function calculateActivityMultiplier(activities, taxonomy) {
  if (!activities || activities.length === 0) return 0.15;
  if (activities.some(a => taxonomy.hot.includes(a))) return 1.0;
  if (activities.some(a => taxonomy.strong.includes(a))) return 0.75;
  if (activities.some(a => taxonomy.mild.includes(a))) return 0.5;
  return 0.15;
}

// Simplified taxonomy subsets for testing the taxonomy-based scoring
const ACTIVITIES_TAXONOMY = {
  hot: ['New Construction', 'Renovation', 'Installation', 'Replacement', 'Upgrade', 'Repair', 'Modernization', 'Infrastructure Development'],
  strong: ['Design', 'Architecture', 'Engineering', 'Planning', 'Feasibility Studies', 'Project Management'],
  mild: ['Equipment Purchase', 'Materials Purchase', 'Land Acquisition'],
  weak: ['Training', 'Education', 'Technical Assistance', 'Capacity Building', 'Community Outreach', 'Research', 'Program Administration', 'Staffing', 'Personnel', 'Program Operations', 'Service Delivery'],
};

const PROJECT_TYPES_TAXONOMY = {
  hot: ['HVAC Systems', 'Lighting Systems', 'Electrical Systems', 'Solar Panels', 'Insulation', 'Weatherization', 'EV Charging Stations'],
  strong: ['Water Treatment Plants', 'Classrooms', 'Playgrounds', 'Athletic Fields', 'Community Centers', 'Libraries', 'Museums'],
  mild: ['Parks', 'Green Spaces', 'Roads', 'Bridges', 'Street Lighting', 'Air Filtration Systems'],
  weak: ['Landscaping', 'Medical Equipment', 'Affordable Housing Units', 'Wetland Restoration', 'Wildlife Habitat'],
};

describe('Pipeline: Analysis Scoring', () => {

  describe('Tier Score Calculation', () => {
    test('municipal government gets highest score', () => {
      const score = calculateTierScore(['Municipal Government']);
      expect(score).toBe(10);
    });

    test('city government gets highest score', () => {
      const score = calculateTierScore(['City Government']);
      expect(score).toBe(10);
    });

    test('county government gets high score', () => {
      const score = calculateTierScore(['County Government']);
      expect(score).toBe(9);
    });

    test('state government gets high score', () => {
      const score = calculateTierScore(['State Government']);
      expect(score).toBe(9);
    });

    test('tribal government gets high score', () => {
      const score = calculateTierScore(['Tribal Government']);
      expect(score).toBe(9);
    });

    test('public entities get medium-high score', () => {
      expect(calculateTierScore(['Public Housing Authority'])).toBe(8);
      expect(calculateTierScore(['School District'])).toBe(8);
      expect(calculateTierScore(['University'])).toBe(7);
    });

    test('utilities get medium score', () => {
      expect(calculateTierScore(['Utility'])).toBe(7);
      expect(calculateTierScore(['Electric Utility'])).toBe(7);
    });

    test('non-profits get medium score', () => {
      expect(calculateTierScore(['Non-Profit Organization'])).toBe(6);
      expect(calculateTierScore(['Non-Profit'])).toBe(6);
    });

    test('commercial entities get lower score', () => {
      expect(calculateTierScore(['Commercial Entity'])).toBe(4);
      expect(calculateTierScore(['Small Business'])).toBe(5);
    });

    test('multiple applicant types returns highest', () => {
      const score = calculateTierScore([
        'Commercial Entity', // 4
        'Municipal Government', // 10
        'Non-Profit', // 6
      ]);
      expect(score).toBe(10);
    });

    test('unknown applicant type gets default score', () => {
      const score = calculateTierScore(['Unknown Entity Type']);
      expect(score).toBe(3);
    });

    test('empty array returns 0', () => {
      expect(calculateTierScore([])).toBe(0);
    });

    test('null returns 0', () => {
      expect(calculateTierScore(null)).toBe(0);
    });

    test('undefined returns 0', () => {
      expect(calculateTierScore(undefined)).toBe(0);
    });
  });

  describe('Funding Score Calculation', () => {
    test.each([
      [0, 0],
      [5000, 2],
      [10000, 3],
      [50000, 4],
      [100000, 5],
      [500000, 6],
      [1000000, 7],
      [5000000, 8],
      [10000000, 9],
      [50000000, 10],
      [100000000, 10],
    ])('$%d returns score %d', (amount, expected) => {
      expect(calculateFundingScore(amount)).toBe(expected);
    });

    test('uses maximum_award first', () => {
      const score = calculateFundingScore(1000000, 5000000);
      expect(score).toBe(7); // Based on maximum_award
    });

    test('falls back to total_funding', () => {
      const score = calculateFundingScore(null, 5000000);
      expect(score).toBe(8); // Based on total_funding
    });

    test('null values return 0', () => {
      expect(calculateFundingScore(null, null)).toBe(0);
    });

    test('negative values return 0', () => {
      expect(calculateFundingScore(-100000)).toBe(0);
    });
  });

  describe('Activity Score Calculation', () => {
    test('solar projects get hot score', () => {
      const score = calculateActivityScore(['Solar']);
      expect(score).toBe(10);
    });

    test('wind projects get hot score', () => {
      const score = calculateActivityScore(['Wind']);
      expect(score).toBe(10);
    });

    test('battery storage gets hot score', () => {
      const score = calculateActivityScore(['Battery Storage']);
      expect(score).toBe(10);
    });

    test('EV charging gets hot score', () => {
      const score = calculateActivityScore(['EV Charging']);
      expect(score).toBe(10);
    });

    test('weatherization gets hot score', () => {
      const score = calculateActivityScore(['Weatherization']);
      expect(score).toBe(10);
    });

    test('energy efficiency gets hot score', () => {
      const score = calculateActivityScore(['Energy Efficiency']);
      expect(score).toBe(10);
    });

    test('planning activities get moderate score', () => {
      const score = calculateActivityScore(['Energy Audit']);
      expect(score).toBe(6);
    });

    test('assessment activities get moderate score', () => {
      const score = calculateActivityScore(['Feasibility Study']);
      expect(score).toBe(6);
    });

    test('training activities get moderate score', () => {
      const score = calculateActivityScore(['Workforce Development']);
      expect(score).toBe(6);
    });

    test('hot activities override moderate', () => {
      const score = calculateActivityScore(['Planning', 'Solar Installation']);
      expect(score).toBe(10);
    });

    test('case insensitive matching', () => {
      expect(calculateActivityScore(['SOLAR'])).toBe(10);
      expect(calculateActivityScore(['solar installation'])).toBe(10);
      expect(calculateActivityScore(['Solar PV'])).toBe(10);
    });

    test('unknown project types get base score', () => {
      const score = calculateActivityScore(['Unknown Category']);
      expect(score).toBe(4);
    });

    test('empty array returns 0', () => {
      expect(calculateActivityScore([])).toBe(0);
    });

    test('null returns 0', () => {
      expect(calculateActivityScore(null)).toBe(0);
    });
  });

  describe('Combined Relevance Score', () => {
    test('calculates weighted average', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government'], // tier: 10
        maximum_award: 5000000, // funding: 8
        eligible_project_types: ['Solar'], // activity: 10
      };

      const score = calculateRelevanceScore(opp);

      // (10 * 0.4) + (8 * 0.3) + (10 * 0.3) = 4 + 2.4 + 3 = 9.4
      expect(score).toBe(9.4);
    });

    test('handles missing fields gracefully', () => {
      const opp = {
        title: 'Test Grant',
        // No scoring fields
      };

      const score = calculateRelevanceScore(opp);

      expect(score).toBe(0);
    });

    test('partial data still calculates', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government'], // tier: 10
        // No funding or project types
      };

      const score = calculateRelevanceScore(opp);

      // (10 * 0.4) + (0 * 0.3) + (0 * 0.3) = 4
      expect(score).toBe(4);
    });

    test('score is rounded to 1 decimal', () => {
      const opp = {
        eligible_applicant_types: ['Non-Profit Organization'], // tier: 6
        maximum_award: 100000, // funding: 5
        eligible_project_types: ['Energy Audit'], // activity: 6
      };

      const score = calculateRelevanceScore(opp);

      // (6 * 0.4) + (5 * 0.3) + (6 * 0.3) = 2.4 + 1.5 + 1.8 = 5.7
      expect(score).toBe(5.7);
    });

    test('maximum possible score is 10', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government'], // 10
        maximum_award: 100000000, // 10
        eligible_project_types: ['Solar'], // 10
      };

      const score = calculateRelevanceScore(opp);

      // (10 * 0.4) + (10 * 0.3) + (10 * 0.3) = 10
      expect(score).toBe(10);
    });

    test('minimum score is 0', () => {
      const opp = {};

      const score = calculateRelevanceScore(opp);

      expect(score).toBe(0);
    });
  });

  describe('Real-World Scoring Examples', () => {
    test('federal solar grant for cities', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government', 'County Government', 'Tribal Government'],
        maximum_award: 10000000,
        eligible_project_types: ['Solar PV Installation', 'Battery Storage', 'Grid Modernization'],
      };

      const score = calculateRelevanceScore(opp);

      // tier: 10, funding: 9 ($10M), activity: 10 (Solar)
      // (10 * 0.4) + (9 * 0.3) + (10 * 0.3) = 4 + 2.7 + 3 = 9.7
      expect(score).toBe(9.7);
    });

    test('small utility rebate program', () => {
      const opp = {
        eligible_applicant_types: ['Commercial Entity'],
        maximum_award: 25000,
        eligible_project_types: ['LED Lighting'],
      };

      const score = calculateRelevanceScore(opp);

      // tier: 4, funding: 3 ($25k), activity: 10 (LED=hot)
      // (4 * 0.4) + (3 * 0.3) + (10 * 0.3) = 1.6 + 0.9 + 3 = 5.5
      expect(score).toBe(5.5);
    });

    test('planning-only grant', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government'],
        maximum_award: 100000,
        eligible_project_types: ['Energy Audit', 'Feasibility Study'],
      };

      const score = calculateRelevanceScore(opp);

      // High tier (10), medium funding (5), moderate activity (6)
      // (10 * 0.4) + (5 * 0.3) + (6 * 0.3) = 4 + 1.5 + 1.8 = 7.3
      expect(score).toBeCloseTo(7.3, 1);
    });

    test('workforce development grant', () => {
      const opp = {
        eligible_applicant_types: ['Non-Profit Organization', 'Community College'],
        maximum_award: 500000,
        eligible_project_types: ['Workforce Development', 'Training'],
      };

      const score = calculateRelevanceScore(opp);

      // tier: 7 (Community College), funding: 6 ($500k), activity: 6 (moderate)
      // (7 * 0.4) + (6 * 0.3) + (6 * 0.3) = 2.8 + 1.8 + 1.8 = 6.4
      expect(score).toBe(6.4);
    });
  });

  describe('Score Invariants', () => {
    test('tier score is always 0-10', () => {
      const testCases = [
        [],
        ['Municipal Government'],
        ['Unknown Type'],
        ['A', 'B', 'C', 'D', 'E'],
      ];

      testCases.forEach(types => {
        const score = calculateTierScore(types);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      });
    });

    test('funding score is always 0-10', () => {
      const amounts = [0, 100, 10000, 1000000, 999999999];

      amounts.forEach(amount => {
        const score = calculateFundingScore(amount);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      });
    });

    test('activity score is always 0-10', () => {
      const testCases = [
        [],
        ['Solar'],
        ['Unknown'],
        ['Planning', 'Solar', 'Wind'],
      ];

      testCases.forEach(types => {
        const score = calculateActivityScore(types);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      });
    });

    test('relevance score is always 0-10', () => {
      const testCases = [
        {},
        { eligible_applicant_types: ['Municipal Government'] },
        { maximum_award: 1000000 },
        {
          eligible_applicant_types: ['Municipal Government'],
          maximum_award: 100000000,
          eligible_project_types: ['Solar'],
        },
      ];

      testCases.forEach(opp => {
        const score = calculateRelevanceScore(opp);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      });
    });
  });

  // New tests: Taxonomy-based scoring (mirrors production scoringAnalyzer.js)
  describe('Taxonomy Tier Scoring', () => {
    test('hot project type returns 3', () => {
      expect(calculateTaxonomyTierScore(['HVAC Systems'], PROJECT_TYPES_TAXONOMY)).toBe(3);
      expect(calculateTaxonomyTierScore(['Solar Panels'], PROJECT_TYPES_TAXONOMY)).toBe(3);
    });

    test('strong project type returns 2', () => {
      expect(calculateTaxonomyTierScore(['Community Centers'], PROJECT_TYPES_TAXONOMY)).toBe(2);
      expect(calculateTaxonomyTierScore(['Playgrounds'], PROJECT_TYPES_TAXONOMY)).toBe(2);
      expect(calculateTaxonomyTierScore(['Athletic Fields'], PROJECT_TYPES_TAXONOMY)).toBe(2);
    });

    test('Parks and Green Spaces are now mild (score=1), not strong', () => {
      // Calibration finding: Parks scored 4.5 by human vs algo 8.0 (#15 GCA G26)
      expect(calculateTaxonomyTierScore(['Parks'], PROJECT_TYPES_TAXONOMY)).toBe(1);
      expect(calculateTaxonomyTierScore(['Green Spaces'], PROJECT_TYPES_TAXONOMY)).toBe(1);
    });

    test('Landscaping is now weak (score=0)', () => {
      expect(calculateTaxonomyTierScore(['Landscaping'], PROJECT_TYPES_TAXONOMY)).toBe(0);
    });

    test('highest match wins — HVAC + Parks → 3 (hot)', () => {
      expect(calculateTaxonomyTierScore(['Parks', 'HVAC Systems'], PROJECT_TYPES_TAXONOMY)).toBe(3);
    });

    test('empty array returns 0', () => {
      expect(calculateTaxonomyTierScore([], PROJECT_TYPES_TAXONOMY)).toBe(0);
    });
  });

  describe('Activity Multiplier (Calibrated)', () => {
    test('construction activities get 1.0x', () => {
      expect(calculateActivityMultiplier(['Installation', 'Renovation'], ACTIVITIES_TAXONOMY)).toBe(1.0);
      expect(calculateActivityMultiplier(['New Construction'], ACTIVITIES_TAXONOMY)).toBe(1.0);
      expect(calculateActivityMultiplier(['Modernization'], ACTIVITIES_TAXONOMY)).toBe(1.0);
    });

    test('design/engineering activities get 0.75x', () => {
      expect(calculateActivityMultiplier(['Design', 'Engineering'], ACTIVITIES_TAXONOMY)).toBe(0.75);
      expect(calculateActivityMultiplier(['Planning'], ACTIVITIES_TAXONOMY)).toBe(0.75);
    });

    test('equipment/procurement activities get 0.5x', () => {
      expect(calculateActivityMultiplier(['Equipment Purchase'], ACTIVITIES_TAXONOMY)).toBe(0.5);
      expect(calculateActivityMultiplier(['Land Acquisition'], ACTIVITIES_TAXONOMY)).toBe(0.5);
    });

    test('training/soft activities get 0.15x (was 0.5x before calibration)', () => {
      // Calibration: Arts Ed Partnership scored 5.0 (should be ~1), human gave 1.0
      // With 0.15x: base 10 × 0.15 = 1.5 (much closer to human score)
      expect(calculateActivityMultiplier(['Training'], ACTIVITIES_TAXONOMY)).toBe(0.15);
      expect(calculateActivityMultiplier(['Education'], ACTIVITIES_TAXONOMY)).toBe(0.15);
      expect(calculateActivityMultiplier(['Technical Assistance'], ACTIVITIES_TAXONOMY)).toBe(0.15);
      expect(calculateActivityMultiplier(['Capacity Building'], ACTIVITIES_TAXONOMY)).toBe(0.15);
      expect(calculateActivityMultiplier(['Community Outreach'], ACTIVITIES_TAXONOMY)).toBe(0.15);
    });

    test('research/admin activities get 0.15x', () => {
      expect(calculateActivityMultiplier(['Research'], ACTIVITIES_TAXONOMY)).toBe(0.15);
      expect(calculateActivityMultiplier(['Program Administration'], ACTIVITIES_TAXONOMY)).toBe(0.15);
    });

    test('highest match wins — Training + Installation → 1.0x (hot)', () => {
      // Confirmed: user said "it doesn't matter if it includes research if it also funds HVAC installation"
      expect(calculateActivityMultiplier(['Training', 'Installation'], ACTIVITIES_TAXONOMY)).toBe(1.0);
    });

    test('empty/null activities default to 0.15x', () => {
      expect(calculateActivityMultiplier([], ACTIVITIES_TAXONOMY)).toBe(0.15);
      expect(calculateActivityMultiplier(null, ACTIVITIES_TAXONOMY)).toBe(0.15);
    });

    test('training-only program with perfect base score falls below filter', () => {
      // Base score of 10 × 0.15 = 1.5, which is below the <2 filter threshold
      const baseScore = 10;
      const multiplier = calculateActivityMultiplier(['Training'], ACTIVITIES_TAXONOMY);
      const finalScore = Math.round(baseScore * multiplier * 10) / 10;
      expect(finalScore).toBe(1.5);
      expect(finalScore).toBeLessThan(2); // Below filter threshold
    });
  });

  describe('LLM Scoring Adjustment', () => {
    /**
     * Compute adjustedScore from finalScore + llmAdjustment, clamped to [0, 10]
     * Mirrors parallelCoordinator.js mergeAnalysisResults()
     */
    function computeAdjustedScore(finalScore, llmAdjustment) {
      const adj = llmAdjustment || 0;
      return Math.round(
        Math.max(0, Math.min(10, finalScore + adj)) * 10
      ) / 10;
    }

    test('zero adjustment returns finalScore unchanged', () => {
      expect(computeAdjustedScore(7.5, 0)).toBe(7.5);
      expect(computeAdjustedScore(3.0, 0)).toBe(3.0);
      expect(computeAdjustedScore(10.0, 0)).toBe(10.0);
    });

    test('positive adjustment increases score', () => {
      expect(computeAdjustedScore(5.0, 2)).toBe(7.0);
      expect(computeAdjustedScore(7.0, 3)).toBe(10.0);
    });

    test('negative adjustment decreases score', () => {
      expect(computeAdjustedScore(9.0, -3)).toBe(6.0);
      expect(computeAdjustedScore(7.5, -2)).toBe(5.5);
    });

    test('adjustedScore is clamped to 0 (no negative scores)', () => {
      expect(computeAdjustedScore(1.0, -3)).toBe(0);
      expect(computeAdjustedScore(0.5, -2)).toBe(0);
      expect(computeAdjustedScore(0, -1)).toBe(0);
    });

    test('adjustedScore is clamped to 10 (no scores above 10)', () => {
      expect(computeAdjustedScore(9.0, 3)).toBe(10.0);
      expect(computeAdjustedScore(10.0, 2)).toBe(10.0);
      expect(computeAdjustedScore(8.5, 3)).toBe(10.0);
    });

    test('null/undefined adjustment treated as 0', () => {
      expect(computeAdjustedScore(7.5, null)).toBe(7.5);
      expect(computeAdjustedScore(7.5, undefined)).toBe(7.5);
    });

    test('preserves decimal precision after adjustment', () => {
      expect(computeAdjustedScore(5.5, 1)).toBe(6.5);
      expect(computeAdjustedScore(3.3, -1)).toBe(2.3);
    });

    test('Bucket B calibration cases produce expected scores', () => {
      // #1 Charge Ready: det 7.5, adj -3 → 4.5 (human: 5.0)
      expect(computeAdjustedScore(7.5, -3)).toBe(4.5);

      // #17 Capital Improvements PHAs: det 7.5, adj -2 → 5.5 (human: 5.0)
      expect(computeAdjustedScore(7.5, -2)).toBe(5.5);

      // #21 Charge Ready Transport: det 7.5, adj -3 → 4.5 (human: 5.0)
      expect(computeAdjustedScore(7.5, -3)).toBe(4.5);

      // #23 Community Noise Mitigation: det 10.0, adj -3 → 7.0 (human: 6.0)
      expect(computeAdjustedScore(10.0, -3)).toBe(7.0);
    });

    test('filter uses adjustedScore with fallback to finalScore', () => {
      /**
       * Mirrors filterFunction.js: scoring.adjustedScore ?? scoring.finalScore ?? 0
       */
      function getFilterScore(scoring) {
        return scoring.adjustedScore ?? scoring.finalScore ?? 0;
      }

      // New format: uses adjustedScore
      expect(getFilterScore({ adjustedScore: 4.5, finalScore: 7.5 })).toBe(4.5);

      // adjustedScore of 0 must NOT fall through to finalScore
      expect(getFilterScore({ adjustedScore: 0, finalScore: 7.5 })).toBe(0);

      // Legacy format: falls back to finalScore
      expect(getFilterScore({ finalScore: 7.5 })).toBe(7.5);

      // Missing both: returns 0
      expect(getFilterScore({})).toBe(0);
    });

    test('dataSanitizer uses adjustedScore for relevance_score', () => {
      /**
       * Mirrors dataSanitizer.js: scoring.adjustedScore ?? scoring.finalScore ?? scoring.overallScore
       */
      function getRelevanceScore(scoring) {
        return scoring.adjustedScore ?? scoring.finalScore ?? scoring.overallScore;
      }

      // New format
      expect(getRelevanceScore({ adjustedScore: 6.0, finalScore: 9.0 })).toBe(6.0);

      // adjustedScore of 0 must NOT fall through
      expect(getRelevanceScore({ adjustedScore: 0, finalScore: 9.0 })).toBe(0);

      // Legacy format
      expect(getRelevanceScore({ finalScore: 9.0, overallScore: 8.0 })).toBe(9.0);

      // Very old format
      expect(getRelevanceScore({ overallScore: 8.0 })).toBe(8.0);
    });
  });
});
