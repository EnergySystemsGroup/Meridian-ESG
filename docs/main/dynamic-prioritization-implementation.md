# Dynamic Prioritization Implementation

This document outlines the implementation of a dynamic prioritization system for API sources in the funding intelligence system. The system replaces the static `priority` field with a dynamic calculation based on update frequency and last checked time.

## Overview

The dynamic prioritization system calculates a priority score for each API source based on:

- The source's update frequency (hourly, daily, weekly, monthly)
- The time elapsed since the source was last checked
- Whether the source has ever been checked before

Sources that have never been checked receive the highest priority. For sources that have been checked before, the priority is calculated as a ratio of elapsed time to expected interval, ensuring that sources that are more overdue for checking receive higher priority.

## Implementation Details

### 1. Database Changes

- Removed the `priority` field from the `api_sources` table
- Created a new SQL function `calculate_source_priority` that calculates a dynamic priority score
- Updated the `get_next_api_source_to_process` function to use the dynamic priority calculation
- Updated the `active_api_sources_with_config` view to remove the `priority` field

### 2. JavaScript Implementation

Created a new utility module `prioritization.js` with functions:

- `calculateSourcePriority`: Calculates a priority score for a single source
- `sortSourcesByPriority`: Sorts an array of sources by their calculated priority

### 3. UI Changes

- Removed the `priority` field from the source creation form
- Removed the `priority` field from the source update form

### 4. API Changes

- Removed the `priority` field from the source creation API endpoint
- Removed the `priority` field from the source update API endpoint

### 5. Agent Changes

- Removed the `priority` field from the `sourceManagerAgent` schema and response

## Priority Calculation Logic

The priority score is calculated as follows:

1. If a source has never been checked (`last_checked` is null), it receives a priority score of 100 (highest).
2. For sources that have been checked before:
   - Calculate the elapsed time since the last check in hours
   - Determine the expected interval based on the update frequency:
     - Hourly: 1 hour
     - Daily: 24 hours
     - Weekly: 168 hours (7 days)
     - Monthly: 720 hours (30 days)
     - Default: 24 hours (if update frequency is not specified)
   - Calculate the priority score as: `(elapsed_hours / expected_interval) * 10`
   - Ensure the score is between 1 and 100

This calculation ensures that sources are prioritized based on how overdue they are relative to their expected update frequency.

## Benefits

- **Automated Prioritization**: No need for manual priority assignment
- **Dynamic Adjustment**: Priority automatically adjusts as time passes
- **Frequency-Aware**: Takes into account the different update frequencies of different sources
- **Self-Healing**: Sources that have been neglected will automatically rise in priority

## Migration Path

1. Created migration scripts to:

   - Remove the `priority` field from the `api_sources` table
   - Create the `calculate_source_priority` function
   - Update the `get_next_api_source_to_process` function

2. Updated all code references to the `priority` field:
   - Removed from UI forms
   - Removed from API endpoints
   - Removed from agent schemas

## Testing

To test the dynamic prioritization system:

1. Run the migration scripts to update the database schema
2. Verify that sources are processed in the expected order
3. Check that sources with different update frequencies are prioritized correctly
4. Confirm that sources that have never been checked receive highest priority
