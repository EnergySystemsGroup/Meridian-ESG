# File Architecture Strategy

## Overview
This document defines the standardized file architecture and import conventions for the Meridian ESG Intelligence Platform. It establishes clear guidelines for file organization, naming conventions, and import patterns to ensure consistency and maintainability across the codebase.

## Core Principles
1. **Clarity**: File locations should be predictable and logical
2. **Consistency**: Follow established patterns throughout the codebase
3. **Scalability**: Support growth without major restructuring
4. **Version Support**: Enable gradual V1→V2 migration using in-place versioning

## Directory Structure

### Root-Level Organization
```
meridian-esg/
├── app/                    # Next.js 15 App Router pages and API routes
├── components/             # Reusable UI components
├── lib/                    # Core business logic and utilities
├── contexts/               # React contexts for global state
├── hooks/                  # Custom React hooks
├── utils/                  # Root-level utilities (Supabase clients, etc.)
├── public/                 # Static assets
├── scripts/                # Build and utility scripts
├── supabase/              # Database migrations and edge functions
└── docs/                   # Documentation
```

### Detailed Structure

#### `/app` Directory (Next.js App Router)
```
app/
├── (routes)/              # Grouped routes
│   ├── admin/            # Admin pages
│   ├── dashboard/        # Dashboard pages
│   └── [feature]/        # Feature-specific pages
├── api/                   # API route handlers
│   ├── admin/            # Admin API endpoints
│   ├── funding/          # Funding API endpoints
│   └── [feature]/        # Feature-specific APIs
├── globals.css           # Global styles
└── layout.js             # Root layout
```

#### `/lib` Directory (Business Logic)
```
lib/
├── agents/               # V1 agent implementations
├── agents-v2/            # V2 agent architecture
│   ├── core/            # Core agent implementations
│   ├── optimization/    # Performance optimizations
│   ├── tests/           # Agent test files
│   └── utils/           # Agent-specific utilities
├── services/            # Service layer (coordinators, managers)
├── constants/           # Shared constants and taxonomies
└── utils/               # Shared utility functions
```

#### `/components` Directory
```
components/
├── ui/                  # Base UI components (shadcn/ui)
├── admin/               # Admin-specific components
├── dashboard/           # Dashboard components
├── funding/             # Funding-related components
├── layout/              # Layout components
└── [feature]/           # Feature-specific components
```

## Import Conventions

### Path Alias Configuration
The project uses `@/` as the root path alias, configured in `jsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Standard Import Patterns
```javascript
// ✅ CORRECT - Use @/ prefix for absolute imports
import { processApiSourceV2 } from '@/lib/services/processCoordinatorV2'
import { Button } from '@/components/ui/button'
import { supabase } from '@/utils/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFeatureFlag } from '@/hooks/useFeatureFlag'

// ❌ INCORRECT - Avoid relative imports for cross-directory access
import { Button } from '../../../components/ui/button'
import { processApiSourceV2 } from './lib/services/processCoordinatorV2'
```

### Import Organization Order
1. External packages
2. Next.js specific imports
3. Absolute imports (@/)
4. Relative imports (same directory only)
5. CSS/style imports

Example:
```javascript
// External packages
import { useState, useEffect } from 'react'
import { format } from 'date-fns'

// Next.js imports
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// Absolute imports
import { Button } from '@/components/ui/button'
import { processApiSourceV2 } from '@/lib/services/processCoordinatorV2'
import { supabase } from '@/utils/supabase'

// Relative imports (same directory only)
import { localHelper } from './helper'

// Styles
import styles from './styles.module.css'
```

## Versioning Strategy

Following the [Simple In-Place Versioning Strategy](./simple-inplace-versioning-strategy.md):

### File Naming Convention
```
ComponentName/
├── index.jsx           # Feature flag switcher
├── ComponentNameV1.jsx # V1 implementation
└── ComponentNameV2.jsx # V2 implementation
```

### Service Versioning
```
lib/services/
├── processCoordinator.js    # V1 service
├── processCoordinatorV2.js  # V2 service
└── index.js                 # Feature flag switcher (when needed)
```

## File Naming Conventions

### React Components
- **Format**: PascalCase with `.jsx` extension
- **Examples**: `OpportunityCard.jsx`, `RunDetailsModal.jsx`

### JavaScript Modules
- **Format**: camelCase with `.js` extension
- **Examples**: `processCoordinator.js`, `anthropicClient.js`

### Test Files
- **Format**: Same name as source + `.test.js`
- **Location**: Adjacent to source file or in `tests/` subdirectory
- **Examples**: `storageAgent.test.js`, `processCoordinatorV2.test.js`

### API Routes (Next.js)
- **Format**: Always `route.js`
- **Location**: Within API directory structure
- **Versioned Routes**: `routeV1.js`, `routeV2.js` with `route.js` as switcher

## Migration Guidelines

### Current State
The codebase has recently undergone refactoring from `app/lib` to `lib`. Some duplicates may exist during transition.

### Migration Steps
1. **Consolidate Duplicates**: Remove `/app/lib/` duplicates, keep `/lib/`
2. **Update Imports**: Change all imports to use `@/lib/` pattern
3. **Verify Tests**: Ensure all tests pass with new import paths
4. **Clean Build**: Delete `.next` and rebuild to verify

### Import Update Example
```javascript
// Before
import { processApiSource } from '../../../app/lib/services/processCoordinator'
import { Button } from '../components/ui/button'

// After
import { processApiSource } from '@/lib/services/processCoordinator'
import { Button } from '@/components/ui/button'
```

## Best Practices

### Do's
- ✅ Always use `@/` prefix for cross-directory imports
- ✅ Keep related files close together
- ✅ Use index files for clean exports from directories
- ✅ Place tests adjacent to source files
- ✅ Follow established naming conventions

### Don'ts
- ❌ Don't use relative imports across directories
- ❌ Don't mix V1 and V2 code in the same file
- ❌ Don't create deeply nested directory structures (max 3-4 levels)
- ❌ Don't put business logic in `/app` directory
- ❌ Don't duplicate code between `/app/lib` and `/lib`

## Directory-Specific Guidelines

### `/app` Directory
- Only Next.js pages and API routes
- No business logic or utilities
- Use for routing and page composition only

### `/lib` Directory
- All business logic and core functionality
- Shared utilities and services
- Agent implementations

### `/components` Directory
- Reusable UI components only
- No business logic or API calls
- Props-driven, presentational components

### `/utils` Directory (Root-Level)
- Framework-specific utilities (Supabase clients)
- Environment configuration helpers
- Third-party service wrappers

## Future Considerations

### Potential Enhancements
1. **TypeScript Migration**: Add `.ts`/`.tsx` extensions when migrating
2. **Monorepo Structure**: Consider workspace organization if adding packages
3. **Module Aliases**: Add more specific aliases (`@lib/`, `@components/`) if needed
4. **Build Optimization**: Implement barrel exports for tree-shaking

### Scalability Path
As the project grows:
1. Consider feature-based organization within `/lib`
2. Implement stricter module boundaries
3. Add architectural decision records (ADRs) for major changes
4. Create automated checks for import conventions

## Enforcement

### Linting Rules
Configure ESLint to enforce import patterns:
```javascript
// eslint.config.mjs additions
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: ['../../../*', '../../*/*/*']
    }]
  }
}
```

### Code Review Checklist
- [ ] All imports use `@/` prefix for cross-directory access
- [ ] File naming follows conventions
- [ ] Versioned files follow V1/V2 pattern
- [ ] No duplicate code between `/app/lib` and `/lib`
- [ ] Tests are co-located with source files

## References
- [Simple In-Place Versioning Strategy](./simple-inplace-versioning-strategy.md)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Project Architecture Overview](../main/api-integration-agent-architecture.md)