# Meridian ESG Intelligence Platform - Development Roadmap PRD
*Product Requirements Document - Version 1.0*  
*Date: June 17, 2025*

## Executive Summary

The Meridian ESG Intelligence Platform is transitioning from a v1 agent-based funding opportunity processing system to a more robust v2 architecture that addresses critical performance limitations, introduces proper user management, and implements comprehensive opportunity status tracking. This roadmap outlines the complete transition strategy from current state to full v2 deployment with user management capabilities.

### Key Objectives
1. **Resolve Vercel Timeout Issues**: Migrate processing to Supabase Edge Functions
2. **Complete V2 Agent Architecture**: Implement modular, efficient agent pipeline
3. **Implement User Management**: Lightweight user identification and role-based access
4. **Add Opportunity Status Management**: Hot/Of Interest status tracking with notifications
5. **Prepare for Legislation Tracking**: Establish foundation for future expansion

---

## Current State Analysis

### Technical Architecture Status
- **V1 Agents**: Complete but experiencing Vercel timeout issues
  - `sourceManagerAgent.js` (346 lines) - Working but needs optimization
  - `apiHandlerAgent.js` (2,249 lines) - Monolithic, causes timeouts
  - `detailProcessorAgent.js` (815 lines) - Functional but inefficient
  - `dataProcessorAgent.js` (1,049 lines) - Complex, needs refactoring

- **V2 Agents**: Partially implemented, needs completion
  - `sourceOrchestrator.js` (185 lines) - ✅ Core functionality complete
  - `dataExtractionAgent.js` (11 lines) - ⚠️ Stub only, needs implementation
  - `analysisAgent.js` (435 lines) - ⚠️ Under review, may need adjustments
  - `filterFunction.js` (274 lines) - ✅ Complete
  - `storageAgent/` - ⚠️ Needs implementation

- **Supporting Infrastructure**: 
  - `processCoordinatorV2.js` (223 lines) - ✅ Complete
  - `runManagerV2.js` (584 lines) - ✅ Complete
  - Supabase Edge Function - ✅ Basic structure exists

### Testing Status
- **Unit Tests**: Exist but need revision to match v2 changes
- **Real Data Tests**: Created in `scripts/test/` folder
  - `01-test-source-orchestrator.js` - ✅ Available
  - `02-test-data-extraction-agent.js` - ✅ Available
  - `03-test-analysis-agent.js` - ✅ Available
- **Integration Tests**: Not yet implemented
- **Pipeline Tests**: Not yet implemented

### Current Gaps
1. **Data Extraction Agent**: Only stub implementation exists
2. **Storage Agent**: Not implemented
3. **V2 Pipeline Integration**: Not tested end-to-end
4. **V1/V2 Toggle System**: Not implemented
5. **User Management**: No system exists
6. **Opportunity Status Management**: No system exists
7. **Admin Processing Interface**: Only v1 exists

---

## Product Requirements

### Phase 1: V2 Agent Architecture Completion
**Timeline: Weeks 1-3**

#### 1.1 Complete Data Extraction Agent
**Acceptance Criteria:**
- Implements full data extraction logic from v1 `apiHandlerAgent.js`
- Handles both single-step and two-step API patterns
- Includes proper error handling and retry logic
- Maintains field mapping and taxonomy standardization
- Processes pagination correctly
- Returns standardized opportunity data structure

**Technical Requirements:**
- Extract core functionality from `apiHandlerAgent.js` (2,249 lines)
- Implement modular structure following v2 patterns
- Create separate modules for:
  - API request handling
  - Pagination management
  - Field mapping
  - Error handling
  - Retry logic

#### 1.2 Complete Storage Agent
**Acceptance Criteria:**
- Implements database storage logic from v1 `dataProcessorAgent.js`
- Handles duplicate detection and resolution
- Processes state eligibility mapping
- Manages funding source relationships
- Implements material change detection
- Provides comprehensive metrics tracking

**Technical Requirements:**
- Refactor `dataProcessorAgent.js` (1,049 lines) into modular components
- Create separate modules for:
  - Duplicate detection
  - State eligibility processing
  - Funding source management
  - Change detection
  - Data sanitization

#### 1.3 Finalize Analysis Agent
**Acceptance Criteria:**
- Review and validate current implementation
- Ensure no functionality loss from v1 `detailProcessorAgent.js`
- Implement proper scoring algorithms
- Add content enhancement capabilities
- Maintain compatibility with filtering system

**Technical Requirements:**
- Compare functionality with v1 `detailProcessorAgent.js`
- Update prompts and scoring logic as needed
- Ensure proper error handling
- Optimize for performance and token usage

### Phase 2: Real Data Testing & Validation
**Timeline: Weeks 2-4**

#### 2.1 Individual Agent Testing
**Acceptance Criteria:**
- Each v2 agent passes real data tests
- Performance metrics meet or exceed v1 benchmarks
- Error handling works correctly with live APIs
- Data quality and accuracy validated

**Testing Requirements:**
- Update existing test scripts in `scripts/test/`
- Add comprehensive error scenario testing
- Implement performance benchmarking
- Create data quality validation tests
- Test with multiple API source types

#### 2.2 Rewrite Unit Tests
**Acceptance Criteria:**
- All unit tests updated to match v2 implementations
- Test coverage maintains 80%+ coverage
- Mock data reflects real API patterns
- Edge cases properly covered

**Technical Requirements:**
- Update existing unit tests in `app/lib/agents-v2/tests/`
- Add new tests for completed agents
- Implement proper mocking for external dependencies
- Create test data fixtures that match real API responses

### Phase 3: Pipeline Integration & Orchestration
**Timeline: Weeks 4-5**

#### 3.1 End-to-End Pipeline Testing
**Acceptance Criteria:**
- Complete pipeline processes sources successfully
- Process coordinator properly orchestrates all agents
- Edge function integration works correctly
- Run manager tracks all stages properly
- Error handling and recovery mechanisms work

**Technical Requirements:**
- Test complete flow: Source → Data Extraction → Analysis → Filter → Storage
- Validate process coordinator orchestration
- Test Supabase Edge Function integration
- Verify run tracking and metrics collection
- Implement comprehensive error handling

#### 3.2 Performance Validation
**Acceptance Criteria:**
- Processing time 60-80% faster than v1
- Memory usage reduced by 70%
- Token consumption reduced by 15-25%
- No timeout issues in Supabase Edge Functions

**Testing Requirements:**
- Implement performance monitoring
- Compare v1 vs v2 processing times
- Monitor memory and resource usage
- Validate timeout resolution
- Document performance improvements

### Phase 4: V1/V2 Toggle Implementation
**Timeline: Weeks 5-6**

#### 4.1 Feature Flag System
**Acceptance Criteria:**
- Toggle between v1 and v2 processing
- Granular control per source type
- Traffic percentage routing
- Emergency fallback capability
- Admin controls for toggle management

**Technical Requirements:**
- Implement feature flag configuration
- Create routing service for v1/v2 selection
- Add environment variable controls
- Build admin interface for toggle management
- Implement A/B testing infrastructure

#### 4.2 Migration Strategy Implementation
**Acceptance Criteria:**
- Gradual traffic routing from v1 to v2
- Comparison tracking between systems
- Rollback capability maintained
- Performance metrics monitored
- Business continuity ensured

**Implementation Requirements:**
- Follow Strangler Fig pattern from architecture guide
- Start with 5% traffic to v2
- Implement comparison logging
- Monitor performance and accuracy
- Scale to 100% v2 traffic gradually

### Phase 5: Dashboard V2 Implementation
**Timeline: Weeks 6-8**

#### 5.1 Funding-Only Dashboard
**Acceptance Criteria:**
- Remove all legislation-related features
- Focus on funding opportunity display
- Implement new filtering and search capabilities
- Maintain existing functionality for funding data
- Prepare foundation for user management integration

**Technical Requirements:**
- Audit current dashboard for legislation references
- Remove legislation-specific components
- Update navigation and UI elements
- Implement enhanced funding opportunity views
- Prepare user context integration points

#### 5.2 Performance & UX Improvements
**Acceptance Criteria:**
- Faster page load times
- Improved mobile responsiveness
- Better search and filtering performance
- Enhanced data visualization
- Accessibility compliance

**Technical Requirements:**
- Implement lazy loading for opportunity lists
- Optimize database queries
- Add proper caching strategies
- Enhance mobile interface
- Implement accessibility standards

### Phase 6: Admin Processing V2
**Timeline: Weeks 7-9**

#### 6.1 V2 Admin Run Processing
**Acceptance Criteria:**
- Admin can trigger v2 processing runs
- Run monitoring and status tracking
- Error handling and recovery options
- Performance metrics display
- Source configuration management

**Technical Requirements:**
- Build admin interface for v2 run management
- Implement run scheduling capabilities
- Add comprehensive monitoring dashboard
- Create error investigation tools
- Build source configuration interface

#### 6.2 Source Management V2
**Acceptance Criteria:**
- CRUD operations for funding sources
- API configuration management
- Testing and validation tools
- Performance monitoring per source
- Bulk operations support

**Technical Requirements:**
- Build source management interface
- Implement configuration validation
- Add API testing capabilities
- Create performance monitoring tools
- Build bulk operation workflows

### Phase 7: User Management System
**Timeline: Weeks 8-10**

#### 7.1 Lightweight User Identification
**Acceptance Criteria:**
- No traditional authentication required
- Pre-populated user database
- Client-side token storage
- Simple user selection interface
- Admin user management capabilities

**Technical Requirements:**
- Implement user identification system per specifications
- Create user selection interface
- Build token management system
- Add admin user management panel
- Implement role-based permissions

#### 7.2 User Activity Tracking
**Acceptance Criteria:**
- Track user interactions with opportunities
- Log favorite actions and status changes
- Provide user activity dashboards
- Enable user-specific filtering
- Support user analytics

**Technical Requirements:**
- Create user actions tracking system
- Build activity logging infrastructure
- Implement user-specific data views
- Add analytics and reporting capabilities
- Create user activity dashboards

### Phase 8: Opportunity Status Management
**Timeline: Weeks 9-11**

#### 8.1 Three-Status System Implementation
**Acceptance Criteria:**
- None/Hot/Of Interest status management
- Admin-only Hot status designation
- User favoriting triggers Of Interest status
- Status change tracking and logging
- Visual status indicators in UI

**Technical Requirements:**
- Implement database schema for status management
- Create status change logic and validation
- Build status tracking and logging
- Add UI components for status display
- Implement status-based filtering

#### 8.2 Hot Board & Of Interest Board
**Acceptance Criteria:**
- Hot Board as primary sales interface
- Combined Hot + Of Interest opportunities
- Visual distinction between status types
- Action buttons for status changes
- Team collaboration features

**Technical Requirements:**
- Build Hot Board interface
- Create Of Interest Board
- Implement status-based filtering
- Add collaborative features
- Build action tracking system

#### 8.3 Notification System
**Acceptance Criteria:**
- Email notifications for Hot opportunities
- Territory-based routing
- Deadline reminders
- Status change notifications
- Configurable notification preferences

**Technical Requirements:**
- Implement email notification system
- Create notification templates
- Build territory-based routing logic
- Add notification preference management
- Implement notification scheduling

---

## Technical Architecture

### V2 Agent Pipeline Architecture
```
Source Orchestrator → Data Extraction Agent → Analysis Agent → Filter Function → Storage Agent
```

### Data Flow Structure
1. **Source Orchestrator**: API configuration and request coordination
2. **Data Extraction Agent**: Raw data collection and standardization  
3. **Analysis Agent**: Content enhancement and systematic scoring
4. **Filter Function**: Threshold-based filtering (no AI)
5. **Storage Agent**: Database storage with deduplication

### User Management Architecture
- **No Authentication**: Simple user selection system
- **Client-Side Tokens**: localStorage-based user identification
- **Pre-populated Users**: Admin-managed user database
- **Role-Based Access**: Admin vs Sales user permissions

### Status Management Architecture
- **Three-Status System**: None/Hot/Of Interest
- **Action Tracking**: Complete audit trail of status changes
- **Notification System**: Email-based alerts and reminders
- **Board Interfaces**: Status-specific opportunity views

---

## Database Schema Changes

### New Tables Required

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  role VARCHAR CHECK (role IN ('admin', 'sales')) DEFAULT 'sales',
  territory VARCHAR,
  specialization VARCHAR,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### User Actions Table  
```sql
CREATE TABLE user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  action_type VARCHAR CHECK (action_type IN ('favorite', 'unfavorite', 'set_hot', 'remove_hot')),
  timestamp TIMESTAMP DEFAULT NOW(),
  notes TEXT
);
```

#### Favorites Table
```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, opportunity_id)
);
```

### Opportunity Table Updates
```sql
ALTER TABLE funding_opportunities ADD COLUMN status VARCHAR CHECK (status IN ('none', 'hot', 'of_interest')) DEFAULT 'none';
ALTER TABLE funding_opportunities ADD COLUMN status_changed_by UUID REFERENCES users(id);
ALTER TABLE funding_opportunities ADD COLUMN status_changed_at TIMESTAMP;
ALTER TABLE funding_opportunities ADD COLUMN hot_designated_by UUID REFERENCES users(id);
ALTER TABLE funding_opportunities ADD COLUMN hot_designated_at TIMESTAMP;
```

---

## Success Metrics

### Technical Performance Metrics
- **Processing Speed**: 60-80% improvement over v1
- **Memory Usage**: 70% reduction in memory consumption
- **Token Efficiency**: 15-25% reduction in AI token usage
- **Error Rate**: <5% error rate in production
- **Timeout Resolution**: Zero timeout issues in Supabase Edge Functions

### User Adoption Metrics
- **Daily Active Users**: Track team member engagement
- **Opportunity Interaction Rate**: Percentage of opportunities receiving user action
- **Hot Board Usage**: Daily active users on Hot Board interface
- **Notification Engagement**: Email open and click-through rates
- **Status Change Frequency**: User engagement with status management

### Business Impact Metrics
- **Opportunity Response Time**: Time from publication to client contact
- **Client Contact Rate**: Increase in funding-related client communications
- **Hot Opportunity Conversion**: Percentage of hot opportunities pursued
- **Revenue Attribution**: Revenue tied to funding-based projects
- **Team Efficiency**: Reduction in time spent on opportunity management

---

## Risk Mitigation

### Technical Risks
- **V2 Agent Completion**: Staggered development and testing approach
- **Data Migration**: Comprehensive backup and rollback procedures
- **Performance Degradation**: Feature flag system for immediate rollback
- **Integration Issues**: Isolated testing at each integration point

### Business Risks
- **Service Disruption**: Strangler Fig pattern ensures zero downtime
- **Data Loss**: Comprehensive backup strategy and data validation
- **User Adoption**: Simple, intuitive interfaces with minimal training required
- **Functionality Regression**: Comprehensive testing and comparison validation

### Operational Risks
- **Complexity Management**: Modular architecture with clear documentation
- **Team Coordination**: Clear milestone definitions and deliverable tracking
- **Timeline Delays**: Buffer time built into each phase
- **Resource Constraints**: Prioritized feature development with MVP approach

---

## Implementation Timeline

### Phase 1-2: Foundation (Weeks 1-4)
- Complete v2 agent architecture
- Implement real data testing
- Validate individual agent performance
- Update unit test suites

### Phase 3-4: Integration (Weeks 4-6)  
- End-to-end pipeline testing
- V1/V2 toggle implementation
- Performance validation
- Migration strategy execution

### Phase 5-6: Interface (Weeks 6-9)
- Dashboard v2 implementation
- Admin processing v2
- Source management improvements
- Performance optimizations

### Phase 7-8: User Experience (Weeks 8-11)
- User management system
- Opportunity status management
- Notification system
- Board interfaces (Hot/Of Interest)

### Deployment Strategy
Following the Strangler Fig pattern:
1. **Week 5**: 5% traffic to v2
2. **Week 6**: 25% traffic to v2
3. **Week 7**: 50% traffic to v2
4. **Week 8**: 90% traffic to v2
5. **Week 9**: 100% traffic to v2

---

## Conclusion

This roadmap provides a comprehensive path from the current v1 system to a fully-featured v2 platform with user management and opportunity status tracking. The phased approach ensures business continuity while systematically addressing technical debt and adding new capabilities.

The key to success lies in:
- **Gradual Migration**: Strangler Fig pattern prevents service disruption
- **Comprehensive Testing**: Real data validation at every stage
- **User-Centric Design**: Simple, intuitive interfaces requiring minimal training
- **Performance Focus**: Measurable improvements in speed and efficiency
- **Business Value**: Clear connection between technical improvements and business outcomes

Upon completion, the platform will provide a robust foundation for:
- Efficient funding opportunity processing
- Team collaboration and opportunity management
- Scalable architecture for future legislation tracking
- Data-driven insights for business development

This transformation positions Meridian ESG Intelligence Platform as a market-leading solution for ESG funding and compliance intelligence. 