'use client';

/**
 * Client-Only Wrapper for AddressAutofillInput
 *
 * Prevents SSR errors with Mapbox Search JS library by using dynamic import.
 * The Mapbox library accesses browser APIs (document) during module evaluation,
 * which causes errors during Next.js server-side rendering.
 */

import dynamic from 'next/dynamic';

// Dynamic import with ssr: false to prevent server-side rendering
const AddressAutofillInputCore = dynamic(
  () => import('./address-autofill-input-core'),
  {
    ssr: false,
    loading: () => (
      <input
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        placeholder="Loading address search..."
        disabled
      />
    )
  }
);

export function AddressAutofillInput(props) {
  return <AddressAutofillInputCore {...props} />;
}
