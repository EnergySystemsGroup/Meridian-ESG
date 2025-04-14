# Duplicate Source Prevention

This document outlines the implementation of duplicate source prevention in the funding intelligence system.

## Overview

To maintain data integrity and prevent duplicate API sources, the system implements several layers of protection:

1. **Database Constraints**: A unique constraint on the `name` and `organization` columns in the `api_sources` table
2. **Fuzzy Matching**: A PostgreSQL function to detect similar sources using text similarity
3. **UI Feedback**: User interface components to warn users when they attempt to create a source similar to an existing one

## Implementation Details

### 1. Database Constraints

The `api_sources` table has a unique constraint on the combination of `name` and `organization` columns:

```sql
ALTER TABLE api_sources
ADD CONSTRAINT api_sources_name_organization_unique
UNIQUE (name, organization);
```

This prevents exact duplicates from being inserted into the database.

### 2. Fuzzy Matching

A PostgreSQL function `check_similar_sources` uses the `similarity` function to detect sources with similar names or organizations:

```sql
CREATE OR REPLACE FUNCTION check_similar_sources(
  p_name TEXT,
  p_organization TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  organization TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.organization,
    GREATEST(
      similarity(s.name, p_name),
      similarity(COALESCE(s.organization, ''), COALESCE(p_organization, ''))
    ) as similarity
  FROM api_sources s
  WHERE
    similarity(s.name, p_name) > 0.6 OR
    similarity(COALESCE(s.organization, ''), COALESCE(p_organization, '')) > 0.8
  ORDER BY similarity DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;
```

This function returns up to 5 similar sources, with a similarity score between 0 and 1.

### 3. API Implementation

The API endpoint for creating new sources (`POST /api/funding/sources`) checks for similar sources before insertion:

```javascript
// Check for similar sources
const { data: similarSources, error: similarError } = await supabase.rpc(
	'check_similar_sources',
	{
		p_name: body.name,
		p_organization: body.organization || null,
	}
);

if (similarError) {
	console.error('Error checking for similar sources:', similarError);
} else if (similarSources && similarSources.length > 0) {
	// Return the similar sources with a 409 Conflict status
	return NextResponse.json(
		{
			error: 'Similar sources already exist',
			similarSources,
		},
		{ status: 409 }
	);
}
```

If similar sources are found, the API returns a 409 Conflict status with details of the similar sources.

### 4. UI Implementation

The UI for creating new sources displays a warning when similar sources are detected:

```jsx
{
	similarSources && (
		<div className='mb-6 p-4 border border-yellow-400 bg-yellow-50 rounded'>
			<h3 className='text-lg font-semibold text-yellow-800 mb-2'>
				Similar Sources Found
			</h3>
			<p className='mb-2'>
				The following similar sources already exist in the database:
			</p>
			<ul className='list-disc pl-5 mb-4'>
				{similarSources.map((source) => (
					<li key={source.id} className='mb-1'>
						<strong>{source.name}</strong>
						{source.organization && ` (${source.organization})`} -<span className='text-sm text-gray-600'>{Math.round(source.similarity * 100)}% similar</span>
					</li>
				))}
			</ul>
			<div className='flex space-x-4'>
				<button
					type='button'
					className='bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded'
					onClick={() => {
						// Force create anyway
						setSimilarSources(null);
						handleSubmit({ preventDefault: () => {} });
					}}>
					Create Anyway
				</button>
				<button
					type='button'
					className='bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded'
					onClick={() => setSimilarSources(null)}>
					Cancel
				</button>
			</div>
		</div>
	);
}
```

This gives users the option to either cancel the creation or proceed anyway.

## Benefits

- **Prevents Accidental Duplicates**: Users are warned when they attempt to create a source similar to an existing one
- **Maintains Data Integrity**: The database constraint ensures that exact duplicates cannot be inserted
- **Flexible Matching**: The fuzzy matching allows for detection of similar sources even with slight variations in name or organization
- **User-Friendly**: The UI provides clear feedback and options when similar sources are detected
