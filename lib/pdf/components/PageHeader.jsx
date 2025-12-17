'use client';

import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { styles } from '../styles/pdfStyles';
import { getLogoBase64 } from '../utils/assets';

/**
 * Page Header Component
 *
 * Displays on each content page (not cover)
 */
export function PageHeader({ clientName }) {
  const logoBase64 = getLogoBase64();

  return (
    <View style={styles.pageHeader} fixed>
      {logoBase64 && <Image src={logoBase64} style={styles.headerLogoImage} />}
      <Text style={styles.headerClient}>{clientName || 'Funding Report'}</Text>
    </View>
  );
}

export default PageHeader;
