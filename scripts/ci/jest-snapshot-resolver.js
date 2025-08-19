/**
 * Jest Snapshot Resolver for CI
 * Manages snapshot file locations and naming
 */

const path = require('path');

module.exports = {
  /**
   * Resolve test file path to snapshot path
   */
  resolveSnapshotPath: (testPath, snapshotExtension) => {
    // Place snapshots in a __snapshots__ directory next to test files
    const testDirectory = path.dirname(testPath);
    const testFilename = path.basename(testPath);
    
    // In CI, organize snapshots by environment
    if (process.env.CI) {
      const platform = process.platform;
      const nodeVersion = process.version.split('.')[0];
      
      return path.join(
        testDirectory,
        '__snapshots__',
        `${platform}-node${nodeVersion}`,
        `${testFilename}${snapshotExtension}`
      );
    }
    
    // Default behavior for local development
    return path.join(
      testDirectory,
      '__snapshots__',
      `${testFilename}${snapshotExtension}`
    );
  },

  /**
   * Resolve snapshot path back to test file path
   */
  resolveTestPath: (snapshotPath, snapshotExtension) => {
    const snapshotDirectory = path.dirname(snapshotPath);
    const snapshotFilename = path.basename(snapshotPath, snapshotExtension);
    
    // Handle CI-specific snapshot paths
    if (snapshotPath.includes('__snapshots__')) {
      const parts = snapshotDirectory.split(path.sep);
      const snapshotIndex = parts.lastIndexOf('__snapshots__');
      
      // Reconstruct test directory
      const testDirectory = parts.slice(0, snapshotIndex).join(path.sep);
      
      return path.join(testDirectory, snapshotFilename);
    }
    
    // Fallback
    return snapshotPath.replace(snapshotExtension, '');
  },

  /**
   * Example test path for validation
   */
  testPathForConsistencyCheck: '__tests__/unit/example.test.js',
};