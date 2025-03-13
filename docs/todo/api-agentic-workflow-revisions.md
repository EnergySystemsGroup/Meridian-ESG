# API Agentic Workflow Revisions Checklist

This document tracks the necessary revisions to the API agentic workflow. This checklist is designed for an AI agent to systematically implement improvements to the system. Each item includes specific, actionable tasks that can be completed programmatically.

_Note: This is an initial version of the checklist. More items will be added as the project evolves._

## Logging and Monitoring Dashboard

- [ ] 🔹 Implement Agent Activity Dashboard with:
  - [ ] 🔹 Filterable views by agent type, date range, and status
  - [ ] 🔹 Performance summary metrics (total runs, success rate, execution time, token usage)
  - [ ] 🔹 Detailed activity log with timestamp, agent, source, status, and duration
- [ ] 🔹 Create API Activity Monitor with:
  - [ ] 🔹 Filterable views by source, date range, and status
  - [ ] 🔹 API health summary (total calls, success rate, average response time)
  - [ ] 🔹 Source health table with status indicators, success percentages, and last check times
- [ ] 🔹 Develop Log Explorer with:
  - [ ] 🔹 Advanced search functionality for logs
  - [ ] 🔹 Filtering by agent type and date range
  - [ ] 🔹 Detailed log entries with timestamp, type, status, and message
  - [ ] 🔹 Export functionality for log results
- [ ] 🔹 Build System Health Overview with:
  - [ ] 🔹 Overall system status indicator
  - [ ] 🔹 Agent performance metrics with health indicators
  - [ ] 🔹 API source health categorized by source type
  - [ ] 🔹 Recent alerts with severity levels and timestamps

## Schema Field Type Analysis

- [x] 🔹 Analyze whether the 'type' field in api_sources table should be converted to an ENUM in the database schema
- [ ] 🔹 Analyze whether the 'priority' field in api_sources table should be converted to an ENUM with predefined priority levels
- [ ] 🔹 Evaluate the necessity of the 'priority' field in api_sources table based on its usage in queries and business logic
- [ ] Assess the impact of converting these fields to ENUMs on the UI components and form validation
- [ ] Recommend optimal approach for type constraints (database ENUM vs. application-level validation)
- [ ] 🔹 Analyze whether 'config_type' in api_source_configurations should be converted to an ENUM to restrict to valid configuration types
- [ ] 🔹 Evaluate the current configuration management UI and propose improvements for easier configuration creation and editing
- [ ] 🔹 Design a user-friendly interface for managing different types of configurations with appropriate validation
- [ ] 🔹 Evaluate adding 'request_body_type' to api_source_configurations to distinguish between query parameters and body parameters, enabling more intelligent API calls without special handling for each API
- [ ] 🔹 Implement a system for dynamic search parameters that can be configured per API source and fed into the agent at runtime, with an admin interface for users to control these parameters
- [ ] 🔹 Standardize response data path and total count path configurations across all API sources to create a consistent interface for the agent to process different API responses
- [ ] 🔹 Simplify the API configuration process by consolidating configuration fields into a more user-friendly format, focusing on expected request body and response mapping, while supporting multi-step API workflows (list/search followed by detail requests)
- [ ] 🔹 Add 'handler_type' field to the api_sources schema to enable the sourceManagerAgent to pass appropriate handler information to the apiHandlerAgent, allowing it to select the correct prompt and processing logic

## API Automation and Triggering

- [ ] 🔹 Analyze optimal frequency patterns for different API source types (federal, state, local, etc.) based on their typical update schedules
- [ ] 🔹 Implement a configurable scheduling system that allows setting different frequencies per API source
- [ ] 🔹 Develop multiple triggering methodologies including:
  - [ ] 🔹 Time-based scheduling (daily, weekly, monthly)
  - [ ] 🔹 Event-based triggers (e.g., when new sources are added)
  - [ ] 🔹 Manual triggers from the admin interface
  - [ ] 🔹 Webhook-based triggers for APIs that support push notifications
- [ ] 🔹 Create a prioritization algorithm that determines which sources to process first based on last check time, priority, and expected update frequency
- [ ] 🔹 Implement a monitoring system to track successful/failed API calls and adjust frequency accordingly
- [ ] 🔹 Ensure sourceManagerAgent outputs the appropriate information format required by the apiHandlerAgent, with alignment to the final configuration schema design

## Database Schema Improvements

- [ ] Analyze all table names containing "source" or "sources" and propose standardization
- [ ] Generate documentation comments for each table in the schema based on its structure and relationships
- [ ] Verify foreign key constraints between related tables (api_sources, api_source_configurations, etc.)
- [ ] Analyze query patterns from application code and suggest additional indexes
- [ ] Implement data validation constraints for critical fields (e.g., email formats, URL validations)

## API Source Management

- [ ] Enhance error handling in sourceManagerAgent.js to capture and log detailed error information
- [ ] Implement validation functions for API source configurations before processing
- [ ] Add exponential backoff retry logic for failed API requests in apiRequest.js
- [ ] Implement rate limiting middleware for external API calls
- [ ] Create API endpoint for source health metrics and processing status
- [ ] 🔹 Refactor apiHandlerAgent.js to use a generic approach that works with any API source configuration, removing any hardcoded or source-specific logic to improve maintainability and scalability

## Data Processing Improvements

- [ ] Audit all schema definitions in agent files and mark nullable fields appropriately
- [ ] Implement fuzzy matching algorithm for duplicate detection in dataProcessorAgent.js
- [ ] Create a data quality scoring function based on completeness, consistency, and accuracy
- [ ] Develop a queue system for opportunities that need manual review
- [ ] Create data enrichment functions that can pull from multiple configured sources

## UI Enhancements

- [ ] Audit UI components against database schema to ensure all fields are properly represented
- [ ] Develop expanded configuration editor for API sources with JSON schema validation
- [ ] Create visualization components for the data processing pipeline using a flowchart library
- [ ] Implement review/approval interface for processed data with diff highlighting
- [ ] Add advanced filtering and sorting controls to the funding opportunities list view

## Testing and Monitoring

- [ ] Generate test cases for each agent function based on input/output analysis
- [ ] Implement structured logging with severity levels throughout the processing pipeline
- [ ] Add execution time tracking to identify performance bottlenecks
- [ ] Create an alert system for failed processing attempts with notification capabilities
- [ ] Develop a monitoring system for detecting changes in external API responses

## Documentation

- [ ] Generate OpenAPI/Swagger documentation for all API endpoints
- [ ] Create a step-by-step guide for adding new API sources with code examples
- [ ] Generate sequence and flow diagrams of the data processing workflow
- [ ] Compile a library of example configurations for common API sources
- [ ] Create user documentation for the admin interface with screenshots and walkthroughs

## Security Enhancements

- [ ] Audit authentication mechanisms for all API endpoints
- [ ] Implement input validation functions for all user-submitted data
- [ ] Review and enhance encryption for sensitive data like API keys
- [ ] Implement rate limiting middleware for public-facing endpoints
- [ ] Create comprehensive audit logging for administrative actions

## Additional Views and Functions

- [ ] Analyze common query patterns and create database views to simplify them
- [ ] Develop utility functions for data transformation operations
- [ ] Implement materialized views for computationally expensive queries
- [ ] Create database functions for complex data aggregations and transformations
- [ ] Implement scheduled database maintenance tasks (cleanup, optimization)

## AI Agent Specific Tasks

- [ ] Implement self-monitoring capabilities for the AI agent to track its own performance
- [ ] Create a feedback loop mechanism for the AI to learn from successful and failed operations
- [ ] Develop explainability features to document AI decision-making processes
- [ ] Implement progressive enhancement of agent capabilities based on success metrics
- [ ] Create a system for the AI agent to propose schema and code improvements

## Next Steps

1. Prioritize items based on impact and technical dependencies
2. Implement items in order of priority
3. Document changes made and their impact
4. Run automated tests to verify improvements
5. Generate reports on system performance before and after changes
