'use client';

import React from 'react';
import { Page, View, Text, Image } from '@react-pdf/renderer';
import { getLogoBase64 } from '../utils/assets';
import { styles } from '../styles/pdfStyles';
import { formatDate, formatCurrency, calculateTotalFunding } from '../utils/formatters';

/**
 * Cover Page for Client Matches PDF
 *
 * Displays:
 * - Meridian branding
 * - Client name and details
 * - Summary statistics
 * - Generation date
 */
export function CoverPage({ client, matches, options = {} }) {
  const { min, max } = calculateTotalFunding(matches);
  const totalMatches = matches?.length || 0;

  // Count opportunities closing within 30 days
  const urgentCount = (matches || []).filter((m) => {
    if (!m.close_date) return false;
    const days = Math.ceil(
      (new Date(m.close_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days >= 0 && days <= 30;
  }).length;

  const logoBase64 = getLogoBase64();

  return (
    <Page size="LETTER" style={styles.coverPage}>
      {/* ESG Logo - Top Left Corner */}
      {logoBase64 && <Image src={logoBase64} style={styles.coverLogoImage} />}

      {/* Brand Title */}
      <Text style={styles.coverLogo}>MERIDIAN</Text>
      <Text style={styles.coverSubtitle}>Policy & Funding Intelligence</Text>

      {/* Main Title */}
      <Text style={styles.coverTitle}>FUNDING OPPORTUNITIES REPORT</Text>

      {/* Divider */}
      <View style={styles.coverDivider} />

      {/* Client Info */}
      <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>Prepared for</Text>
      <Text style={styles.coverClientName}>{client?.name || 'Client'}</Text>
      <Text style={styles.coverClientInfo}>
        {client?.type || ''}
        {client?.city || client?.state_code
          ? ` | ${[client?.city, client?.state_code].filter(Boolean).join(', ')}`
          : ''}
      </Text>

      {/* DAC Badge */}
      {client?.dac && (
        <View
          style={{
            marginTop: 10,
            backgroundColor: '#7C3AED',
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 4,
            alignSelf: 'center',
          }}
        >
          <Text style={{ fontSize: 9, color: 'white', fontWeight: 'bold' }}>
            Disadvantaged Community
          </Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.coverStats}>
        <View style={styles.coverStatBox}>
          <Text style={styles.coverStatValue}>{totalMatches}</Text>
          <Text style={styles.coverStatLabel}>Total Matches</Text>
        </View>

        <View style={styles.coverStatBox}>
          <Text style={styles.coverStatValue}>
            {max > 0 ? formatCurrency(max, true) : 'N/A'}
          </Text>
          <Text style={styles.coverStatLabel}>Funding Available</Text>
        </View>

        {urgentCount > 0 && (
          <View style={[styles.coverStatBox, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.coverStatValue, { color: '#D97706' }]}>{urgentCount}</Text>
            <Text style={styles.coverStatLabel}>Closing in 30 Days</Text>
          </View>
        )}
      </View>

      {/* Date */}
      <Text style={styles.coverDate}>Generated on {formatDate(new Date(), 'long')}</Text>
    </Page>
  );
}

export default CoverPage;
