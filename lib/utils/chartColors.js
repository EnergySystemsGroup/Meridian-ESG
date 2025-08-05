/**
 * Centralized color palette for charts throughout the application
 * Ensures consistent theming and accessibility compliance
 */

// Primary color palette for charts
export const chartColors = {
  // Primary colors for single-series charts
  primary: '#8884d8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  
  // Multi-series color palette (accessibility-friendly)
  series: [
    '#22c55e', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#3b82f6', // Blue
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#ec4899', // Pink
  ],
  
  // Performance-specific colors
  performance: {
    excellent: '#22c55e', // Green (≥95%)
    good: '#84cc16',      // Lime (80-94%)
    warning: '#f59e0b',   // Amber (60-79%)
    poor: '#ef4444',      // Red (<60%)
  },
  
  // SLA compliance colors
  sla: {
    compliant: '#22c55e',    // Green (≥90%)
    warning: '#f59e0b',      // Amber (70-89%)
    nonCompliant: '#ef4444', // Red (<70%)
  },
  
  // Status colors for pipeline runs
  status: {
    completed: '#22c55e',
    processing: '#f59e0b',
    failed: '#ef4444',
    started: '#3b82f6',
  },
  
  // Background colors for charts
  background: {
    grid: '#f0f0f0',
    tooltip: '#ffffff',
    tooltipBorder: '#e5e7eb',
  },
  
  // Text colors
  text: {
    primary: '#374151',
    secondary: '#6b7280',
    muted: '#9ca3af',
  }
};

/**
 * Get color by index for multi-series charts
 * @param {number} index - The series index
 * @returns {string} The color hex code
 */
export function getSeriesColor(index) {
  return chartColors.series[index % chartColors.series.length];
}

/**
 * Get performance color based on percentage
 * @param {number} percentage - The performance percentage (0-100)
 * @returns {string} The color hex code
 */
export function getPerformanceColor(percentage) {
  if (percentage >= 95) return chartColors.performance.excellent;
  if (percentage >= 80) return chartColors.performance.good;
  if (percentage >= 60) return chartColors.performance.warning;
  return chartColors.performance.poor;
}

/**
 * Get SLA compliance color based on percentage
 * @param {number} percentage - The SLA compliance percentage (0-100)
 * @returns {string} The color hex code
 */
export function getSLAColor(percentage) {
  if (percentage >= 90) return chartColors.sla.compliant;
  if (percentage >= 70) return chartColors.sla.warning;
  return chartColors.sla.nonCompliant;
}

/**
 * Get status color for pipeline runs
 * @param {string} status - The run status
 * @returns {string} The color hex code
 */
export function getStatusColor(status) {
  return chartColors.status[status] || chartColors.text.secondary;
}