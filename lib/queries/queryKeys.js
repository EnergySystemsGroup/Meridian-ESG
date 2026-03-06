export const queryKeys = {
	funding: {
		all: ['funding'],
		list: (filters) => ['funding', 'list', filters],
		detail: (id) => ['funding', 'detail', id],
		sources: {
			all: ['funding', 'sources'],
			list: (filters) => ['funding', 'sources', 'list', filters],
			detail: (id) => ['funding', 'sources', 'detail', id],
		},
		projectTypeSummary: (filters) => ['funding', 'projectTypeSummary', filters],
		coverageCounts: (filters) => ['funding', 'coverageCounts', filters],
		totalAvailable: ['funding', 'totalAvailable'],
	},

	projectTypes: {
		all: ['projectTypes'],
		list: (filters) => ['projectTypes', 'list', filters],
	},

	categories: {
		all: ['categories'],
		list: () => ['categories', 'list'],
	},

	clients: {
		all: ['clients'],
		list: () => ['clients', 'list'],
		detail: (id) => ['clients', 'detail', id],
		hiddenMatches: (id) => ['clients', 'hiddenMatches', id],
	},

	clientMatching: {
		all: ['clientMatching'],
		matches: (clientId) => ['clientMatching', 'matches', clientId],
		summary: () => ['clientMatching', 'summary'],
		topMatches: () => ['clientMatching', 'topMatches'],
	},

	dashboard: {
		all: ['dashboard'],
		counts: (type) => ['dashboard', 'counts', type],
		deadlines: (type, limit) => ['dashboard', 'deadlines', type, limit],
	},

	map: {
		all: ['map'],
		fundingByState: (filters) => ['map', 'fundingByState', filters],
		national: (filters) => ['map', 'national', filters],
		opportunities: (filters) => ['map', 'opportunities', filters],
		opportunitiesByState: (stateCode, filters) => ['map', 'opportunitiesByState', stateCode, filters],
		coverageAreas: (stateCode, filters) => ['map', 'coverageAreas', stateCode, filters],
		opportunitiesByArea: (areaId, filters) => ['map', 'opportunitiesByArea', areaId, filters],
		scopeBreakdown: (stateCode, filters) => ['map', 'scopeBreakdown', stateCode, filters],
	},

	admin: {
		all: ['admin'],
		review: (filters) => ['admin', 'review', filters],
		systemConfig: (key) => ['admin', 'systemConfig', key],
	},

	users: {
		all: ['users'],
		list: () => ['users', 'list'],
	},
};
