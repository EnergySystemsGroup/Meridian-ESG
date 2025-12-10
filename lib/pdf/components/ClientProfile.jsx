'use client';

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { styles, colors } from '../styles/pdfStyles';

/**
 * Client Profile Section for PDF
 *
 * Displays client information in a styled box
 */
export function ClientProfile({ client }) {
  if (!client) return null;

  const projectNeeds = client.project_needs || [];
  const location = [client.city, client.state_code].filter(Boolean).join(', ');

  return (
    <View style={styles.clientProfile}>
      {/* Client Name */}
      <Text style={styles.clientName}>{client.name}</Text>

      {/* Type, Location, DAC */}
      <View style={styles.clientMeta}>
        {client.type && <Text style={styles.clientType}>{client.type}</Text>}
        {client.type && location && (
          <Text style={{ fontSize: 10, color: colors.textMuted, marginHorizontal: 4 }}>|</Text>
        )}
        {location && <Text style={styles.clientLocation}>{location}</Text>}
        {client.dac && <Text style={styles.dacBadge}>DAC</Text>}
      </View>

      {/* Project Needs */}
      {projectNeeds.length > 0 && (
        <View>
          <Text style={{ fontSize: 8, color: colors.textMuted, marginBottom: 4 }}>
            PROJECT FOCUS:
          </Text>
          <View style={styles.projectNeedsContainer}>
            {projectNeeds.map((need, index) => (
              <Text key={index} style={styles.projectNeedBadge}>
                {need}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Budget if specified */}
      {client.budget && (
        <Text
          style={{
            fontSize: 9,
            color: colors.textMuted,
            marginTop: 8,
          }}
        >
          Budget Range: {formatBudgetTier(client.budget)}
        </Text>
      )}
    </View>
  );
}

/**
 * Format budget value/tier for display
 */
function formatBudgetTier(budget) {
  if (typeof budget === 'string') {
    const tierMap = {
      small: 'Small (< $100K)',
      medium: 'Medium ($100K - $500K)',
      large: 'Large ($500K - $5M)',
      very_large: 'Very Large (> $5M)',
    };
    return tierMap[budget.toLowerCase()] || budget;
  }

  if (typeof budget === 'number') {
    if (budget >= 1000000) {
      return `$${(budget / 1000000).toFixed(1)}M`;
    }
    if (budget >= 1000) {
      return `$${(budget / 1000).toFixed(0)}K`;
    }
    return `$${budget}`;
  }

  return 'Not specified';
}

export default ClientProfile;
