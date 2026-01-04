'use client';

import React from 'react';
import { Document, Page, View } from '@react-pdf/renderer';
import { styles } from './styles/pdfStyles';
import { CoverPage } from './components/CoverPage';
import { ClientProfile } from './components/ClientProfile';
import { PageHeader } from './components/PageHeader';
import { PageFooter } from './components/PageFooter';
import { OpportunityCard } from './components/OpportunityCard';
import { sortOpportunities } from './utils/grouping';

/**
 * Client Matches PDF Document
 *
 * Main document component that assembles all parts of the PDF
 * Shows all opportunities in a flat list sorted by match score (no grouping)
 *
 * @param {object} client - Client data
 * @param {Array} matches - Array of matched opportunities
 * @param {object} options - Export options
 *   - viewMode: 'summary' | 'detailed' (default: 'summary')
 *   - includeCover: boolean (default: true)
 *   - sortBy: 'deadline' | 'score' | 'amount' (default: 'score')
 */
export function ClientMatchesPDF({ client, matches, options = {} }) {
  const {
    viewMode = 'summary',
    includeCover = true,
    sortBy = 'score',
  } = options;

  // Sort all matches (no grouping to avoid duplicates)
  const sortedMatches = sortOpportunities(matches, sortBy);

  return (
    <Document
      title={`Funding Opportunities - ${client?.name || 'Client'}`}
      author="Meridian ESG"
      subject="Funding Opportunities Report"
      creator="Meridian ESG Platform"
    >
      {/* Cover Page (optional) */}
      {includeCover && (
        <CoverPage client={client} matches={matches} options={options} />
      )}

      {/* Content Pages - wrap allows content to flow across pages */}
      <Page size="LETTER" style={styles.page} wrap>
        {/* Fixed Header */}
        <PageHeader clientName={client?.name} />

        {/* Client Profile - keep together */}
        <View wrap={false}>
          <ClientProfile client={client} />
        </View>

        {/* All Opportunities - flat list sorted by match score */}
        <View>
          {sortedMatches.map((opportunity, index) => (
            <OpportunityCard
              key={opportunity.id || index}
              opportunity={opportunity}
              viewMode={viewMode}
            />
          ))}
        </View>

        {/* Fixed Footer */}
        <PageFooter />
      </Page>
    </Document>
  );
}

/**
 * Flat List PDF Document (no grouping)
 *
 * Alternative layout that shows all opportunities in a flat list
 */
export function ClientMatchesFlatPDF({ client, matches, options = {} }) {
  const {
    viewMode = 'summary',
    includeCover = true,
    sortBy = 'deadline',
  } = options;

  // Sort all matches
  const sortedMatches = sortOpportunities(matches, sortBy);

  return (
    <Document
      title={`Funding Opportunities - ${client?.name || 'Client'}`}
      author="Meridian ESG"
      subject="Funding Opportunities Report"
      creator="Meridian ESG Platform"
    >
      {/* Cover Page (optional) */}
      {includeCover && (
        <CoverPage client={client} matches={matches} options={options} />
      )}

      {/* Content Pages - wrap allows content to flow across pages */}
      <Page size="LETTER" style={styles.page} wrap>
        {/* Fixed Header */}
        <PageHeader clientName={client?.name} />

        {/* Client Profile - keep together */}
        <View wrap={false}>
          <ClientProfile client={client} />
        </View>

        {/* All Opportunities - each card can wrap across pages */}
        <View>
          {sortedMatches.map((opportunity, index) => (
            <OpportunityCard
              key={opportunity.id || index}
              opportunity={opportunity}
              viewMode={viewMode}
            />
          ))}
        </View>

        {/* Fixed Footer */}
        <PageFooter />
      </Page>
    </Document>
  );
}

export default ClientMatchesPDF;
