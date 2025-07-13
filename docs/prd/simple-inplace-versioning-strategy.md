# Simple In-Place Versioning Strategy

## Overview
A lightweight approach to feature flagging that allows versioning any file/component by creating V1/V2 versions and using feature flags to switch between them. No major refactoring required.

## Core Philosophy
- Version only what you're actually changing
- Work with existing codebase structure
- Use feature flags to switch between versions at runtime
- Enable gradual adoption without disrupting existing code

## Patterns

### Pages
When creating a V2 version of a page:
```
app/page.js                 # Feature flag switcher
app/pageV1.jsx             # Current implementation moved here
app/pageV2.jsx             # New V2 implementation
```

Example implementation:
```javascript
// app/page.js
import { useFeatureFlag } from '@/app/hooks/useFeatureFlag'
import HomeV1 from './pageV1'
import HomeV2 from './pageV2'

export default function Home() {
  const useV2 = useFeatureFlag('HOME_DASHBOARD_V2')
  return useV2 ? <HomeV2 /> : <HomeV1 />
}
```

### Components
When creating a V2 version of a component:
```
app/components/RunDetails/
├── index.jsx              # Feature flag switcher  
├── RunDetailsV1.jsx       # Current implementation
└── RunDetailsV2.jsx       # New V2 implementation
```

Example implementation:
```javascript
// app/components/RunDetails/index.jsx
import { useFeatureFlag } from '@/app/hooks/useFeatureFlag'
import RunDetailsV1 from './RunDetailsV1'
import RunDetailsV2 from './RunDetailsV2'

export default function RunDetails(props) {
  const useV2 = useFeatureFlag('RUN_DETAILS_V2')
  return useV2 ? <RunDetailsV2 {...props} /> : <RunDetailsV1 {...props} />
}
```

### Services/Utilities
When creating a V2 version of a service or utility:
```
app/lib/services/
├── processCoordinator.js     # V1 (keep existing)
├── processCoordinatorV2.js   # V2 (keep existing)  
└── index.js                  # Feature flag switcher (new)
```

Example implementation:
```javascript
// app/lib/services/index.js
import { getFeatureFlag } from '@/app/config/feature-flags'
import { processApiSource } from './processCoordinator'
import { processApiSourceV2 } from './processCoordinatorV2'

export const processSource = getFeatureFlag('AGENT_PIPELINE_V2') 
  ? processApiSourceV2 
  : processApiSource
```

## Implementation Requirements

### Feature Flag Infrastructure
1. **Feature Flag Hook**: Create `useFeatureFlag()` hook for React components
2. **Configuration**: Create `config/feature-flags.js` for flag definitions
3. **Environment Variables**: Set up environment-based feature toggles

### Example Feature Flag Setup
```javascript
// app/hooks/useFeatureFlag.js
import { getFeatureFlag } from '@/app/config/feature-flags'

export function useFeatureFlag(flagName) {
  return getFeatureFlag(flagName)
}
```

```javascript
// app/config/feature-flags.js
export const getFeatureFlag = (flagName) => {
  return process.env[`NEXT_PUBLIC_${flagName}`] === 'true'
}
```

## Benefits

1. **No Major Refactoring**: Work with existing codebase structure
2. **Gradual Adoption**: Version only what you're actually changing
3. **Easy Rollback**: Just flip the feature flag
4. **Clear Separation**: V1 and V2 are completely isolated
5. **Future-Proof**: Same pattern works for any number of versions
6. **Testable**: Can test V1 vs V2 independently
7. **Flexible**: Works at any level - pages, components, services, utilities

## Use Cases in Meridian

- **Agent Pipeline**: Already exists (agents vs agents-v2), add feature flag switcher
- **Home Dashboard**: Create V2 with enhanced widgets and features
- **Run Processor Dashboard**: Create V2 components for enhanced V2 pipeline metrics
- **Individual Components**: Version specific UI components as needed

## Best Practices

1. **Start Small**: Version individual components rather than entire features
2. **Keep Imports Clean**: Always import from the index file, not directly from V1/V2
3. **Consistent Naming**: Use clear V1/V2 suffixes
4. **Environment Configuration**: Use environment variables for feature flag control
5. **Documentation**: Document what each version does and why it exists

This strategy allows you to add V2 versions anywhere in your codebase without disrupting the existing structure while maintaining clear separation between versions.