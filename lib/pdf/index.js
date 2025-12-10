// Main PDF Document
export { ClientMatchesPDF, ClientMatchesFlatPDF } from './ClientMatchesPDF';

// Components
export { CoverPage } from './components/CoverPage';
export { ClientProfile } from './components/ClientProfile';
export { OpportunityCard } from './components/OpportunityCard';
export { ProjectNeedGroup, GroupHeader, DeadlineGroup, SourceTypeGroup } from './components/ProjectNeedGroup';
export { PageHeader } from './components/PageHeader';
export { PageFooter } from './components/PageFooter';

// Styles
export { styles, colors, getSourceTypeColor, getMatchScoreColors, getUrgencyColors } from './styles/pdfStyles';

// Utilities
export * from './utils/formatters';
export * from './utils/grouping';
