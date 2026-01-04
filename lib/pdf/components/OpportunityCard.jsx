'use client';

import React from 'react';
import { View, Text, Link } from '@react-pdf/renderer';
import { styles, colors, getSourceTypeColor, getMatchScoreColors, getUrgencyColors } from '../styles/pdfStyles';
import {
  formatFundingRange,
  formatDeadline,
  formatMatchScore,
  formatSourceType,
  formatStatus,
  formatCostShare,
  truncateText,
} from '../utils/formatters';

/**
 * Opportunity Card Component
 *
 * Renders a single opportunity in either summary or detailed view
 *
 * @param {object} opportunity - The opportunity data
 * @param {string} viewMode - 'summary' or 'detailed'
 */
export function OpportunityCard({ opportunity, viewMode = 'summary' }) {
  if (!opportunity) return null;

  // Extract data with fallbacks
  const title = opportunity.title || 'Untitled Opportunity';
  const agencyName = opportunity.agency_name || opportunity.source_name || '';
  // Pass both source_type and agency_name to derive source type if source_type is missing
  const sourceType = formatSourceType(opportunity.source_type, agencyName);
  // Score comes directly from the match object (from client-matching API), fallback to relevance_score
  const score = opportunity.score ?? opportunity.relevance_score ?? 0;
  const status = opportunity.status || 'open';

  // Funding
  const minAmount = opportunity.minimum_award || opportunity.min_amount || 0;
  const maxAmount = opportunity.maximum_award || opportunity.max_amount || 0;
  const fundingRange = formatFundingRange(minAmount, maxAmount);

  // Deadline
  const deadlineInfo = formatDeadline(opportunity.close_date);
  const urgencyColors = getUrgencyColors(deadlineInfo.daysRemaining);

  // Cost share
  const costShare = formatCostShare(
    opportunity.cost_share_required,
    opportunity.cost_share_percentage
  );

  // Matched needs
  const matchedNeeds = opportunity.matchDetails?.matchedProjectNeeds || [];

  // Colors
  const sourceColor = getSourceTypeColor(sourceType);
  const scoreColors = getMatchScoreColors(score);
  const statusInfo = formatStatus(status);

  // Content fields
  const programOverview = opportunity.program_overview || opportunity.description || '';
  const applicationSummary = opportunity.application_summary || '';
  const programInsights = opportunity.program_insights || '';
  const eligibleApplicants = opportunity.eligible_applicants || [];
  const url = opportunity.url || '';

  // Get urgency border style
  const getUrgencyBorderStyle = () => {
    if (deadlineInfo.daysRemaining === null) return styles.urgencyBorderNone;
    if (deadlineInfo.urgency === 'critical') return styles.urgencyBorderCritical;
    if (deadlineInfo.urgency === 'warning') return styles.urgencyBorderWarning;
    return styles.urgencyBorderNormal;
  };

  if (viewMode === 'summary') {
    return (
      <View style={[styles.summaryCard, getUrgencyBorderStyle()]} wrap={false}>
        {/* Header row with title and score */}
        <View style={styles.summaryHeader}>
          <View style={styles.summaryTitleSection}>
            {/* Source badge on its own line */}
            <View style={styles.summaryBadgeRow}>
              <Text style={[styles.sourceTypeBadge, { backgroundColor: sourceColor }]}>
                {sourceType.toUpperCase()}
              </Text>
            </View>
            {/* Title on next line */}
            <Text style={styles.summaryTitle}>{truncateText(title, 70)}</Text>
          </View>

          {/* Score on the right */}
          <View style={styles.summaryScoreSection}>
            <Text style={[styles.scoreBadge, { backgroundColor: scoreColors.bg, color: scoreColors.text }]}>
              {formatMatchScore(score)}
            </Text>
            <Text style={[styles.summaryDeadline, { color: urgencyColors.text }]}>
              {deadlineInfo.text}
            </Text>
          </View>
        </View>

        {/* Agency */}
        <Text style={styles.summaryAgency}>{agencyName}</Text>

        {/* Info row: Funding | Cost Share | Eligibility */}
        <View style={styles.summaryInfoRow}>
          <Text style={styles.summaryInfoItem}>{fundingRange}</Text>
          {costShare !== 'None required' && (
            <Text style={styles.summaryInfoItem}>Cost Share: {costShare}</Text>
          )}
        </View>

        {/* Program Overview - full text */}
        {programOverview && (
          <Text style={styles.summaryMeta}>
            {programOverview}
          </Text>
        )}

        {/* Matched needs badges */}
        {matchedNeeds.length > 0 && (
          <View style={styles.matchedNeedsContainer}>
            {matchedNeeds.slice(0, 4).map((need, idx) => (
              <Text key={idx} style={styles.matchedNeedBadge}>
                {need}
              </Text>
            ))}
            {matchedNeeds.length > 4 && (
              <Text style={[styles.matchedNeedBadge, { backgroundColor: '#E5E7EB', color: '#374151' }]}>
                +{matchedNeeds.length - 4} more
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  // Detailed view - wrap={false} prevents cards from straddling pages
  return (
    <View style={[styles.detailedCard, getUrgencyBorderStyle()]} wrap={false}>
      {/* Header */}
      <View style={styles.detailedHeader}>
        <View style={styles.detailedHeaderLeft}>
          {/* Source badge */}
          <View style={styles.detailedBadgeRow}>
            <Text style={[styles.sourceTypeBadge, { backgroundColor: sourceColor }]}>
              {sourceType.toUpperCase()}
            </Text>
          </View>
          {/* Title */}
          <Text style={styles.detailedTitle}>{title}</Text>
          {/* Agency */}
          <Text style={styles.detailedAgency}>{agencyName}</Text>
        </View>

        {/* Score badge */}
        <Text style={[styles.scoreBadge, { backgroundColor: scoreColors.bg, color: scoreColors.text }]}>
          {formatMatchScore(score)}
        </Text>
      </View>

      {/* Body */}
      <View style={styles.detailedBody}>
        {/* Key facts row */}
        <View style={styles.detailedKeyFacts}>
          <View style={styles.detailedFactItem}>
            <Text style={styles.detailedLabel}>Funding</Text>
            <Text style={[styles.detailedValue, { fontWeight: 'bold', color: colors.primary }]}>
              {fundingRange}
            </Text>
          </View>
          <View style={styles.detailedFactItem}>
            <Text style={styles.detailedLabel}>Deadline</Text>
            <Text style={[styles.detailedValue, { color: urgencyColors.text }]}>
              {deadlineInfo.text}
            </Text>
          </View>
          <View style={styles.detailedFactItem}>
            <Text style={styles.detailedLabel}>Status</Text>
            <Text style={[styles.detailedValue, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>
        </View>

        {/* Program Overview - full text */}
        {programOverview && (
          <View style={styles.detailedSection}>
            <Text style={styles.detailedSectionTitle}>Program Overview</Text>
            <Text style={styles.detailedSectionText}>
              {programOverview}
            </Text>
          </View>
        )}

        {/* Why You Match */}
        {matchedNeeds.length > 0 && (
          <View style={styles.detailedSection}>
            <Text style={styles.detailedSectionTitle}>Why You Match</Text>
            <View style={styles.matchedNeedsContainer}>
              {matchedNeeds.map((need, idx) => (
                <Text key={idx} style={styles.matchedNeedBadge}>
                  {need}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Program Insights */}
        {programInsights && (
          <View style={styles.detailedSection}>
            <Text style={styles.detailedSectionTitle}>Program Insights</Text>
            <Text style={styles.detailedSectionText}>
              {programInsights}
            </Text>
          </View>
        )}

        {/* URL */}
        {url && (
          <Text style={styles.urlText}>
            {truncateText(url, 80)}
          </Text>
        )}
      </View>
    </View>
  );
}

export default OpportunityCard;
