# Core Data Models for Policy & Funding Intelligence System

This document outlines the core data models for the policy and funding intelligence system, including their properties and relationships. These models will be implemented in Supabase to support the application's functionality.

## 1. Funding Sources

This model represents organizations that provide funding.

**Properties:**

- `id`: UUID (primary key)
- `name`: Text (e.g., "DOE Building Technologies Office")
- `agency_type`: Enum (Federal, State, Utility, Foundation, Other)
- `parent_organization`: UUID (self-reference, optional)
- `jurisdiction`: Text (country, state, or region)
- `website`: Text
- `contact_info`: JSONB (structured contact details)
- `description`: Text
- `tags`: Array of Text
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 2. Funding Programs

This model represents recurring programs offered by funding sources.

**Properties:**

- `id`: UUID (primary key)
- `source_id`: UUID (foreign key to funding_sources)
- `name`: Text (e.g., "Commercial Building Energy Efficiency Grant")
- `description`: Text
- `typical_funding_amount`: Range or JSONB
- `recurrence_pattern`: Text (Annual, Biennial, One-time, etc.)
- `typical_open_month`: Integer
- `typical_close_month`: Integer
- `eligibility_criteria`: JSONB
- `matching_requirements`: Text
- `notes`: Text
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 3. Funding Opportunities

This model represents specific funding rounds or opportunities.

**Properties:**

- `id`: UUID (primary key)
- `program_id`: UUID (foreign key to funding_programs)
- `title`: Text
- `fiscal_year`: Text
- `status`: Enum (Anticipated, Open, Closed, Awarded)
- `open_date`: Timestamp
- `close_date`: Timestamp
- `amount_available`: Numeric
- `minimum_award`: Numeric
- `maximum_award`: Numeric
- `cost_share_required`: Boolean
- `cost_share_percentage`: Numeric
- `application_url`: Text
- `guidelines_url`: Text
- `relevance_score`: Numeric (0-100)
- `notes`: Text
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 4. Legislation

This model tracks bills and regulatory changes.

**Properties:**

- `id`: UUID (primary key)
- `title`: Text
- `summary`: Text
- `full_text`: Text or URL
- `source`: Enum (Federal, State, Local)
- `jurisdiction`: Text (specific state if applicable)
- `bill_number`: Text
- `introduction_date`: Timestamp
- `last_action_date`: Timestamp
- `current_stage`: Enum (Introduced, Committee, Passed, etc.)
- `probability_score`: Numeric (likelihood of passage)
- `sponsors`: JSONB or Array
- `committees`: JSONB or Array
- `funding_implications`: JSONB
- `implementation_timeline`: JSONB
- `relevance_score`: Numeric (0-100)
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 5. Legislation History

This model tracks changes to legislation over time.

**Properties:**

- `id`: UUID (primary key)
- `legislation_id`: UUID (foreign key to legislation)
- `version_date`: Timestamp
- `changes`: JSONB (what changed from previous version)
- `version_text`: Text or URL
- `created_at`: Timestamp

## 6. Clients

This model represents organizations that might benefit from funding.

**Properties:**

- `id`: UUID (primary key)
- `organization_name`: Text
- `organization_type`: Enum (K12, Higher Ed, Municipal, etc.)
- `locations`: JSONB (array of physical locations)
- `contacts`: JSONB (key personnel)
- `service_interests`: Array of Text
- `facility_data`: JSONB (size, building count, systems)
- `tags`: Array of Text
- `notes`: Text
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 7. Opportunity Matches

This model connects clients to relevant funding opportunities.

**Properties:**

- `id`: UUID (primary key)
- `client_id`: UUID (foreign key to clients)
- `opportunity_id`: UUID (foreign key to funding_opportunities)
- `match_score`: Numeric (0-100)
- `potential_project_value`: Numeric
- `qualification_notes`: Text
- `action_status`: Enum (New, Reviewing, Pursuing, etc.)
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 8. Tags

This model provides a standardized taxonomy for classification.

**Properties:**

- `id`: UUID (primary key)
- `category`: Enum (Service Area, Client Type, Geography, Timeline, Custom)
- `value`: Text
- `description`: Text
- `created_at`: Timestamp

## 9. Tagged Items

This model connects tags to various entities.

**Properties:**

- `id`: UUID (primary key)
- `tag_id`: UUID (foreign key to tags)
- `item_type`: Text (e.g., "funding_opportunity", "legislation", "client")
- `item_id`: UUID (foreign key to the respective table)
- `confidence_score`: Numeric (for automated tagging)
- `source`: Enum (Automatic, Manual)
- `created_at`: Timestamp

## 10. Tasks

This model tracks action items related to opportunities.

**Properties:**

- `id`: UUID (primary key)
- `title`: Text
- `description`: Text
- `due_date`: Timestamp
- `assigned_to`: UUID (foreign key to users)
- `status`: Enum (Not Started, In Progress, Completed)
- `priority`: Enum (Low, Medium, High)
- `related_item_type`: Text (e.g., "funding_opportunity", "legislation")
- `related_item_id`: UUID
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 11. Eligible Project Types

This model connects funding opportunities to eligible project types.

**Properties:**

- `id`: UUID (primary key)
- `opportunity_id`: UUID (foreign key to funding_opportunities)
- `project_type`: Enum (Energy_Efficiency, Renewable_Energy, HVAC, Lighting, etc.)
- `created_at`: Timestamp

## 12. Eligible Applicants

This model connects funding opportunities to eligible applicant types.

**Properties:**

- `id`: UUID (primary key)
- `opportunity_id`: UUID (foreign key to funding_opportunities)
- `applicant_type`: Enum (K12, Municipal, County, State, Higher_Ed, etc.)
- `created_at`: Timestamp

## 13. Data Sources

This model tracks where information was collected from.

**Properties:**

- `id`: UUID (primary key)
- `name`: Text
- `url`: Text
- `source_type`: Enum (API, Website, Document, Email)
- `authentication_required`: Boolean
- `authentication_details`: JSONB (encrypted)
- `last_checked`: Timestamp
- `check_frequency`: Text (e.g., "daily", "weekly")
- `created_at`: Timestamp
- `updated_at`: Timestamp

## 14. Scrape Logs

This model logs data collection activities.

**Properties:**

- `id`: UUID (primary key)
- `source_id`: UUID (foreign key to data_sources)
- `start_time`: Timestamp
- `end_time`: Timestamp
- `status`: Enum (Success, Partial, Failed)
- `items_found`: Integer
- `items_added`: Integer
- `items_updated`: Integer
- `error_message`: Text
- `created_at`: Timestamp

## Relationships and Connections

1. **Funding Sources to Funding Programs**: One-to-many (a source can have multiple programs)
2. **Funding Programs to Funding Opportunities**: One-to-many (a program can have multiple opportunities)
3. **Funding Opportunities to Eligible Project Types**: One-to-many
4. **Funding Opportunities to Eligible Applicants**: One-to-many
5. **Legislation to Legislation History**: One-to-many
6. **Legislation to Funding Opportunities**: Many-to-many (through a junction table)
7. **Clients to Opportunity Matches**: One-to-many
8. **Funding Opportunities to Opportunity Matches**: One-to-many
9. **Tags to Tagged Items**: One-to-many
10. **Tasks to Users**: Many-to-one
11. **Data Sources to Scrape Logs**: One-to-many

## Implementation Considerations

1. **Row-Level Security (RLS)**: Implement RLS policies to ensure data security.
2. **Indexing Strategy**: Create indexes on frequently queried fields.
3. **Denormalization**: For performance, consider denormalizing some data.
4. **Audit Logging**: Track changes to critical data.
5. **Migration Strategy**: Design with future changes in mind, allowing for schema evolution.

This model structure provides a foundation for the policy and funding intelligence system. Additional models or properties may be added as the system evolves and new requirements emerge.
