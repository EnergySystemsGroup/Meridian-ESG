// Test script for the prioritization function
const { calculateSourcePriority } = require('../lib/utils/prioritization');

// Test with a source that was checked 12 hours ago (daily frequency)
const source1 = {
	update_frequency: 'daily',
	last_checked: new Date(Date.now() - 12 * 60 * 60 * 1000),
};
console.log(
	'Daily source checked 12 hours ago:',
	calculateSourcePriority(source1)
);

// Test with a source that was checked 24 hours ago (daily frequency)
const source2 = {
	update_frequency: 'daily',
	last_checked: new Date(Date.now() - 24 * 60 * 60 * 1000),
};
console.log(
	'Daily source checked 24 hours ago:',
	calculateSourcePriority(source2)
);

// Test with a source that was checked 3 days ago (weekly frequency)
const source3 = {
	update_frequency: 'weekly',
	last_checked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
};
console.log(
	'Weekly source checked 3 days ago:',
	calculateSourcePriority(source3)
);

// Test with a source that was checked 15 days ago (monthly frequency)
const source4 = {
	update_frequency: 'monthly',
	last_checked: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
};
console.log(
	'Monthly source checked 15 days ago:',
	calculateSourcePriority(source4)
);

// Test with a source that has never been checked
const source5 = {
	update_frequency: 'daily',
	last_checked: null,
};
console.log('Source never checked:', calculateSourcePriority(source5));
