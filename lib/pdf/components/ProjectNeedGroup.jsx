'use client';

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { styles, colors } from '../styles/pdfStyles';
import { OpportunityCard } from './OpportunityCard';
import { sortOpportunities } from '../utils/grouping';

/**
 * Project Need Group Component
 *
 * Renders a group header and all opportunities within that group
 *
 * @param {string} projectNeed - The project need name (group title)
 * @param {Array} opportunities - Array of opportunities in this group
 * @param {string} viewMode - 'summary' or 'detailed'
 * @param {string} sortBy - Sort criteria for opportunities within group
 */
export function ProjectNeedGroup({
  projectNeed,
  opportunities,
  viewMode = 'summary',
  sortBy = 'deadline',
}) {
  if (!opportunities || opportunities.length === 0) return null;

  // Sort opportunities within this group
  const sortedOpportunities = sortOpportunities(opportunities, sortBy);

  return (
    <View>
      {/* Group Header */}
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{projectNeed}</Text>
        <Text style={styles.groupCount}>
          {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'}
        </Text>
      </View>

      {/* Opportunities - each card stays together but collection can wrap */}
      {sortedOpportunities.map((opportunity, index) => (
        <OpportunityCard
          key={opportunity.id || index}
          opportunity={opportunity}
          viewMode={viewMode}
        />
      ))}
    </View>
  );
}

/**
 * Generic Group Header Component
 *
 * Can be used for other grouping types (source type, deadline, etc.)
 */
export function GroupHeader({ title, count, icon }) {
  return (
    <View style={styles.groupHeader}>
      {icon && (
        <Text style={{ marginRight: 6, fontSize: 12 }}>{icon}</Text>
      )}
      <Text style={styles.groupTitle}>{title}</Text>
      <Text style={styles.groupCount}>
        {count} {count === 1 ? 'opportunity' : 'opportunities'}
      </Text>
    </View>
  );
}

/**
 * Deadline Group Component
 *
 * For grouping by deadline urgency
 */
export function DeadlineGroup({
  label,
  urgency,
  opportunities,
  viewMode = 'summary',
  sortBy = 'deadline',
}) {
  if (!opportunities || opportunities.length === 0) return null;

  const sortedOpportunities = sortOpportunities(opportunities, sortBy);

  // Get urgency color
  const urgencyColors = {
    critical: colors.urgencyCritical,
    warning: colors.urgencyWarning,
    normal: colors.urgencyNormal,
    upcoming: colors.federal,
    noDeadline: colors.textMuted,
  };

  const borderColor = urgencyColors[urgency] || colors.textMuted;

  return (
    <View>
      <View
        style={[
          styles.groupHeader,
          { borderLeftWidth: 4, borderLeftColor: borderColor },
        ]}
      >
        <Text style={styles.groupTitle}>{label}</Text>
        <Text style={styles.groupCount}>
          {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'}
        </Text>
      </View>

      {sortedOpportunities.map((opportunity, index) => (
        <OpportunityCard
          key={opportunity.id || index}
          opportunity={opportunity}
          viewMode={viewMode}
        />
      ))}
    </View>
  );
}

/**
 * Source Type Group Component
 *
 * For grouping by source type (Federal, State, etc.)
 */
export function SourceTypeGroup({
  sourceType,
  opportunities,
  viewMode = 'summary',
  sortBy = 'deadline',
}) {
  if (!opportunities || opportunities.length === 0) return null;

  const sortedOpportunities = sortOpportunities(opportunities, sortBy);

  // Get source type color
  const sourceColors = {
    Federal: colors.federal,
    State: colors.state,
    Utility: colors.utility,
    Foundation: colors.foundation,
    Local: colors.textMuted,
    Other: colors.textMuted,
  };

  const borderColor = sourceColors[sourceType] || colors.textMuted;

  return (
    <View>
      <View
        style={[
          styles.groupHeader,
          { borderLeftWidth: 4, borderLeftColor: borderColor },
        ]}
      >
        <Text style={styles.groupTitle}>{sourceType} Opportunities</Text>
        <Text style={styles.groupCount}>
          {opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'}
        </Text>
      </View>

      {sortedOpportunities.map((opportunity, index) => (
        <OpportunityCard
          key={opportunity.id || index}
          opportunity={opportunity}
          viewMode={viewMode}
        />
      ))}
    </View>
  );
}

export default ProjectNeedGroup;
