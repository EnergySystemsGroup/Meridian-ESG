'use client';

import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles/pdfStyles';

/**
 * Page Header Component
 *
 * Displays on each content page (not cover)
 */
export function PageHeader({ clientName }) {
  return (
    <View style={styles.pageHeader} fixed>
      <Text style={styles.headerLogo}>MERIDIAN ESG</Text>
      <Text style={styles.headerClient}>{clientName || 'Funding Report'}</Text>
    </View>
  );
}

export default PageHeader;
