/**
 * UI Helper functions for consistent visual styling across the application
 */

import { TAXONOMIES } from '@/lib/constants/taxonomies';

/**
 * Returns a consistent color scheme for a given category name
 * @param {string} categoryName - The name of the category
 * @returns {Object} An object with color and bgColor properties
 */
export const getCategoryColor = (categoryName) => {
	// Define a color map for the standard categories from taxonomies
	const categoryColors = {
		// Energy categories with orange-yellow hues
		'Energy Efficiency': { color: '#F57C00', bgColor: '#FFF3E0' },
		'Renewable Energy': { color: '#FF9800', bgColor: '#FFF8E1' },

		// Environmental/Water with blue-green hues
		'Water Conservation': { color: '#0288D1', bgColor: '#E1F5FE' },
		Environmental: { color: '#00796B', bgColor: '#E0F2F1' },
		Sustainability: { color: '#43A047', bgColor: '#E8F5E9' },

		// Infrastructure/Facilities with gray-blue hues
		Infrastructure: { color: '#546E7A', bgColor: '#ECEFF1' },
		Transportation: { color: '#455A64', bgColor: '#E0E6EA' },
		'Facility Improvements': { color: '#607D8B', bgColor: '#F5F7F8' },

		// Education/Development with purple hues
		Education: { color: '#7B1FA2', bgColor: '#F3E5F5' },
		'Research & Development': { color: '#9C27B0', bgColor: '#F5E9F7' },
		'Economic Development': { color: '#6A1B9A', bgColor: '#EFE5F7' },

		// Community/Health with red-pink hues
		'Community Development': { color: '#C62828', bgColor: '#FFEBEE' },
		'Health & Safety': { color: '#D32F2F', bgColor: '#FFEBEE' },
		'Disaster Recovery': { color: '#E53935', bgColor: '#FFEBEE' },

		// Planning with neutral hues
		'Planning & Assessment': { color: '#5D4037', bgColor: '#EFEBE9' },
	};

	// Check if it's one of our standard categories
	if (categoryColors[categoryName]) {
		return categoryColors[categoryName];
	}

	// For non-standard categories, generate a color using the hash function
	let hash = 0;
	for (let i = 0; i < categoryName.length; i++) {
		hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Multiply by a prime number to better distribute the hue values
	const hue = (hash * 13) % 360;

	return {
		color: `hsl(${hue}, 65%, 45%)`,
		bgColor: `hsl(${hue}, 65%, 95%)`,
	};
};

/**
 * Format category name for display - handles "Other: Description" format
 * @param {string} category - The category name
 * @returns {string} Formatted category name
 */
export const formatCategoryForDisplay = (category) => {
	// If the category starts with "Other: ", extract just the description part
	if (category && category.startsWith('Other: ')) {
		return category.substring(7); // Remove "Other: " prefix
	}
	return category;
};

/**
 * Returns a consistent color scheme for a given project type with intuitive color associations
 * @param {string} projectType - The name of the project type
 * @returns {Object} An object with color and bgColor properties
 */
export const getProjectTypeColor = (projectType) => {
	// Define intuitive color mappings based on what people naturally associate with each project type
	const projectTypeColors = {
		// Solar/Renewable Energy - Yellow/Gold
		'Solar Panels': { color: '#F59E0B', bgColor: '#FEF3C7' },
		'Solar Arrays': { color: '#F59E0B', bgColor: '#FEF3C7' },
		'Wind Turbines': { color: '#F59E0B', bgColor: '#FEF3C7' },
		'Geothermal Systems': { color: '#F59E0B', bgColor: '#FEF3C7' },
		'Fuel Cells': { color: '#F59E0B', bgColor: '#FEF3C7' },
		'Cogeneration Systems': { color: '#F59E0B', bgColor: '#FEF3C7' },

		// Water/Wastewater - Blue tones
		'Water Treatment Plants': { color: '#0284C7', bgColor: '#DBEAFE' },
		'Wastewater Treatment Plants': { color: '#0284C7', bgColor: '#DBEAFE' },
		'Water Distribution Systems': { color: '#0284C7', bgColor: '#DBEAFE' },
		'Water Storage Tanks': { color: '#0284C7', bgColor: '#DBEAFE' },
		'Water Reservoirs': { color: '#0284C7', bgColor: '#DBEAFE' },
		'Sewer Systems': { color: '#0284C7', bgColor: '#DBEAFE' },
		'Pump Stations': { color: '#0284C7', bgColor: '#DBEAFE' },
		'Water Meters': { color: '#0284C7', bgColor: '#DBEAFE' },
		'Stormwater Management Systems': { color: '#0284C7', bgColor: '#DBEAFE' },
		'Irrigation Systems': { color: '#0284C7', bgColor: '#DBEAFE' },

		// HVAC/Air Systems - Light blue/sky
		'HVAC Systems': { color: '#0EA5E9', bgColor: '#E0F2FE' },
		'Ventilation Improvements': { color: '#0EA5E9', bgColor: '#E0F2FE' },
		'Air Filtration Systems': { color: '#0EA5E9', bgColor: '#E0F2FE' },
		'Refrigeration Systems': { color: '#0EA5E9', bgColor: '#E0F2FE' },

		// Electrical Systems - Softer amber/gold
		'Electrical Systems': { color: '#D97706', bgColor: '#FEF3C7' },
		'Energy Management Systems': { color: '#D97706', bgColor: '#FEF3C7' },
		'Battery Storage Systems': { color: '#D97706', bgColor: '#FEF3C7' },
		'EV Charging Stations': { color: '#D97706', bgColor: '#FEF3C7' },
		'Microgrids': { color: '#D97706', bgColor: '#FEF3C7' },

		// Building/Construction - Brown/tan
		'Roofing': { color: '#92400E', bgColor: '#FED7AA' },
		'Windows': { color: '#92400E', bgColor: '#FED7AA' },
		'Doors': { color: '#92400E', bgColor: '#FED7AA' },
		'Insulation': { color: '#92400E', bgColor: '#FED7AA' },
		'Exterior Walls': { color: '#92400E', bgColor: '#FED7AA' },
		'Foundation Repair': { color: '#92400E', bgColor: '#FED7AA' },
		'Flooring': { color: '#92400E', bgColor: '#FED7AA' },
		'Weatherization': { color: '#92400E', bgColor: '#FED7AA' },

		// Green Infrastructure/Parks - Green
		'Parks': { color: '#16A34A', bgColor: '#DCFCE7' },
		'Green Spaces': { color: '#16A34A', bgColor: '#DCFCE7' },
		'Playgrounds': { color: '#16A34A', bgColor: '#DCFCE7' },
		'Athletic Fields': { color: '#16A34A', bgColor: '#DCFCE7' },
		'Athletic Courts': { color: '#16A34A', bgColor: '#DCFCE7' },
		'Landscaping': { color: '#16A34A', bgColor: '#DCFCE7' },
		'Green Infrastructure': { color: '#16A34A', bgColor: '#DCFCE7' },
		'Urban Heat Island Mitigation': { color: '#16A34A', bgColor: '#DCFCE7' },

		// IT/Technology - Purple
		'IT Infrastructure': { color: '#9333EA', bgColor: '#F3E8FF' },
		'Networks': { color: '#9333EA', bgColor: '#F3E8FF' },
		'Data Centers': { color: '#9333EA', bgColor: '#F3E8FF' },
		'Telecommunications Equipment': { color: '#9333EA', bgColor: '#F3E8FF' },
		'Broadband Infrastructure': { color: '#9333EA', bgColor: '#F3E8FF' },
		'Computers': { color: '#9333EA', bgColor: '#F3E8FF' },
		'Tablets': { color: '#9333EA', bgColor: '#F3E8FF' },
		'Software Systems': { color: '#9333EA', bgColor: '#F3E8FF' },

		// Fire/Safety Systems - Red/orange
		'Fire Suppression Systems': { color: '#DC2626', bgColor: '#FEE2E2' },
		'Security Systems': { color: '#DC2626', bgColor: '#FEE2E2' },
		'Fire Trucks': { color: '#DC2626', bgColor: '#FEE2E2' },
		'Fire Equipment': { color: '#DC2626', bgColor: '#FEE2E2' },
		'Emergency Alert Systems': { color: '#DC2626', bgColor: '#FEE2E2' },
		'Emergency Operations Centers': { color: '#DC2626', bgColor: '#FEE2E2' },

		// Roads/Transportation - Gray
		'Roads': { color: '#6B7280', bgColor: '#F3F4F6' },
		'Streets': { color: '#6B7280', bgColor: '#F3F4F6' },
		'Bridges': { color: '#6B7280', bgColor: '#F3F4F6' },
		'Sidewalks': { color: '#6B7280', bgColor: '#F3F4F6' },
		'Bike Lanes': { color: '#6B7280', bgColor: '#F3F4F6' },
		'Parking Lots': { color: '#6B7280', bgColor: '#F3F4F6' },
		'Traffic Signals': { color: '#6B7280', bgColor: '#F3F4F6' },

		// Lighting - Softer yellow/amber
		'Lighting Systems': { color: '#D97706', bgColor: '#FEF3C7' },
		'Street Lighting': { color: '#D97706', bgColor: '#FEF3C7' },

		// Plumbing - Blue-green
		'Plumbing Systems': { color: '#0891B2', bgColor: '#CFFAFE' },
		'Fire Hydrants': { color: '#0891B2', bgColor: '#CFFAFE' },
	};

	// Check if it's one of our mapped project types
	if (projectTypeColors[projectType]) {
		return projectTypeColors[projectType];
	}

	// For non-mapped project types, generate a color using the hash function
	let hash = 0;
	for (let i = 0; i < projectType.length; i++) {
		hash = projectType.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Multiply by a prime number to better distribute the hue values
	const hue = (hash * 13) % 360;

	return {
		color: `hsl(${hue}, 65%, 45%)`,
		bgColor: `hsl(${hue}, 65%, 95%)`,
	};
};

/**
 * Prioritize and select top project types based on taxonomy tier order
 * @param {string[]} projectTypes - Array of project type strings
 * @param {number} maxCount - Maximum number of project types to return (default: 3)
 * @returns {string[]} Prioritized array of project types
 */
export const prioritizeProjectTypes = (projectTypes, maxCount = 3) => {
	if (!projectTypes || projectTypes.length === 0) return [];

	// Flatten taxonomy tiers for easy lookup
	const tierMapping = {};

	// Assign tier priorities (lower number = higher priority)
	Object.entries(TAXONOMIES.ELIGIBLE_PROJECT_TYPES.hot).forEach((_, index) => {
		tierMapping[TAXONOMIES.ELIGIBLE_PROJECT_TYPES.hot[index]] = 1;
	});
	Object.entries(TAXONOMIES.ELIGIBLE_PROJECT_TYPES.strong).forEach((_, index) => {
		tierMapping[TAXONOMIES.ELIGIBLE_PROJECT_TYPES.strong[index]] = 2;
	});
	Object.entries(TAXONOMIES.ELIGIBLE_PROJECT_TYPES.mild).forEach((_, index) => {
		tierMapping[TAXONOMIES.ELIGIBLE_PROJECT_TYPES.mild[index]] = 3;
	});
	Object.entries(TAXONOMIES.ELIGIBLE_PROJECT_TYPES.weak).forEach((_, index) => {
		tierMapping[TAXONOMIES.ELIGIBLE_PROJECT_TYPES.weak[index]] = 4;
	});

	// Sort by tier priority first, then alphabetically
	const sortedProjectTypes = [...projectTypes].sort((a, b) => {
		const tierA = tierMapping[a] || 999; // Unknown types get lowest priority
		const tierB = tierMapping[b] || 999;

		if (tierA !== tierB) {
			return tierA - tierB; // Lower tier number = higher priority
		}

		// If same tier, sort alphabetically
		return a.localeCompare(b);
	});

	// Return top maxCount items
	return sortedProjectTypes.slice(0, maxCount);
};
