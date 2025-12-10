import { StyleSheet } from '@react-pdf/renderer';

/**
 * PDF Styles for Client Matches Export
 *
 * Color scheme matches the UI:
 * - Source Type Badges: Federal (blue), State (green), Utility (orange), Foundation (purple)
 * - Match Scores: High (purple), Medium (orange), Low (gray)
 * - Deadline Urgency: Critical (red), Warning (yellow), Normal (green)
 */

// Color constants
export const colors = {
  // Brand
  primary: '#1E3A8A', // deep blue
  secondary: '#6B7280', // gray

  // Source Types
  federal: '#3B82F6',    // blue
  state: '#22C55E',      // green
  utility: '#F59E0B',    // orange
  foundation: '#8B5CF6', // purple
  other: '#6B7280',      // gray

  // Match Scores
  scoreHigh: '#9333EA',    // purple (60%+)
  scoreMedium: '#F59E0B',  // orange (30-59%)
  scoreLow: '#6B7280',     // gray (<30%)

  // Urgency
  urgencyCritical: '#EF4444', // red (<14 days)
  urgencyWarning: '#F59E0B',  // yellow (14-30 days)
  urgencyNormal: '#22C55E',   // green (30+ days)

  // UI
  white: '#FFFFFF',
  lightGray: '#F3F4F6',
  mediumGray: '#E5E7EB',
  darkGray: '#374151',
  text: '#111827',
  textMuted: '#6B7280',

  // DAC
  dac: '#7C3AED',
};

// Get source type color
export const getSourceTypeColor = (sourceType) => {
  const type = (sourceType || '').toLowerCase();
  if (type.includes('federal')) return colors.federal;
  if (type.includes('state')) return colors.state;
  if (type.includes('utility')) return colors.utility;
  if (type.includes('foundation')) return colors.foundation;
  return colors.other;
};

// Get match score colors
export const getMatchScoreColors = (score) => {
  if (score >= 60) return { bg: colors.scoreHigh, text: colors.white };
  if (score >= 30) return { bg: colors.scoreMedium, text: colors.white };
  return { bg: colors.scoreLow, text: colors.white };
};

// Get urgency colors
export const getUrgencyColors = (daysRemaining) => {
  if (daysRemaining === null) return { border: colors.mediumGray, text: colors.textMuted };
  if (daysRemaining < 0) return { border: colors.scoreLow, text: colors.textMuted };
  if (daysRemaining < 14) return { border: colors.urgencyCritical, text: colors.urgencyCritical };
  if (daysRemaining <= 30) return { border: colors.urgencyWarning, text: colors.urgencyWarning };
  return { border: colors.urgencyNormal, text: colors.urgencyNormal };
};

// Main stylesheet
export const styles = StyleSheet.create({
  // Page layout
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
  },

  // Cover page
  coverPage: {
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  coverLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 60,
    textAlign: 'center',
  },
  coverTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  coverDivider: {
    width: 100,
    height: 3,
    backgroundColor: colors.primary,
    marginTop: 30,
    marginBottom: 30,
  },
  coverClientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  coverClientInfo: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  coverStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 50,
  },
  coverStatBox: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: colors.lightGray,
    borderRadius: 6,
    minWidth: 120,
    marginHorizontal: 15,
  },
  coverStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  coverStatLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
  },
  coverDate: {
    marginTop: 60,
    fontSize: 10,
    color: colors.textMuted,
  },

  // Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
    marginBottom: 20,
  },
  headerLogo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },
  headerClient: {
    fontSize: 9,
    color: colors.textMuted,
  },

  // Page footer
  pageFooter: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.mediumGray,
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: colors.textMuted,
  },
  pageNumber: {
    fontSize: 8,
    color: colors.textMuted,
  },

  // Client profile section
  clientProfile: {
    backgroundColor: colors.lightGray,
    padding: 15,
    borderRadius: 6,
    marginBottom: 20,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  clientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  clientType: {
    fontSize: 10,
    color: colors.textMuted,
  },
  clientLocation: {
    fontSize: 10,
    color: colors.textMuted,
    marginRight: 10,
  },
  dacBadge: {
    fontSize: 8,
    backgroundColor: colors.dac,
    color: colors.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  projectNeedsLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.darkGray,
    marginTop: 10,
    marginBottom: 6,
  },
  projectNeedsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  projectNeedBadge: {
    fontSize: 8,
    backgroundColor: colors.mediumGray,
    color: colors.darkGray,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  budgetText: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 8,
  },

  // Group header
  groupHeader: {
    backgroundColor: colors.lightGray,
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
    marginTop: 16,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
  },
  groupCount: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 8,
  },

  // Summary view card (compact) - FIXED LAYOUT
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 4,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryTitleSection: {
    flex: 1,
    marginRight: 10,
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 2,
  },
  summaryScoreSection: {
    alignItems: 'flex-end',
  },
  summaryAgency: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 6,
  },
  summaryInfoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  summaryInfoItem: {
    fontSize: 9,
    color: colors.darkGray,
    marginRight: 15,
  },
  summaryMeta: {
    fontSize: 8,
    color: colors.textMuted,
    marginBottom: 2,
  },
  summaryDeadline: {
    fontSize: 9,
    marginTop: 4,
  },

  // Detailed view card
  detailedCard: {
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 6,
    marginBottom: 15,
    borderLeftWidth: 4,
  },
  detailedHeader: {
    backgroundColor: colors.lightGray,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailedHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  detailedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailedTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 2,
  },
  detailedAgency: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
  },
  detailedBody: {
    padding: 12,
  },
  detailedKeyFacts: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  detailedFactItem: {
    flex: 1,
  },
  detailedLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailedValue: {
    fontSize: 10,
    color: colors.text,
  },
  detailedSection: {
    marginTop: 10,
  },
  detailedSectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.darkGray,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailedSectionText: {
    fontSize: 9,
    color: colors.text,
    lineHeight: 1.5,
  },

  // Badges - FIXED SIZING
  sourceTypeBadge: {
    fontSize: 7,
    fontWeight: 'bold',
    color: colors.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
  },
  scoreBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    textAlign: 'center',
  },
  statusBadge: {
    fontSize: 7,
    fontWeight: 'bold',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    textTransform: 'uppercase',
  },

  // Matched needs
  matchedNeedsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  matchedNeedBadge: {
    fontSize: 7,
    backgroundColor: '#EFF6FF', // light blue (bg-blue-50)
    color: '#2563EB',           // blue (text-blue-600)
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 4,
    marginBottom: 4,
  },

  // URL link
  urlText: {
    fontSize: 8,
    color: colors.federal,
    marginTop: 10,
  },

  // Urgency border colors (applied via style prop)
  urgencyBorderCritical: {
    borderLeftColor: colors.urgencyCritical,
  },
  urgencyBorderWarning: {
    borderLeftColor: colors.urgencyWarning,
  },
  urgencyBorderNormal: {
    borderLeftColor: colors.urgencyNormal,
  },
  urgencyBorderNone: {
    borderLeftColor: colors.mediumGray,
  },
});

export default styles;
