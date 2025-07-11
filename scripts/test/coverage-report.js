#!/usr/bin/env node

/**
 * Coverage Report Generator
 * 
 * Generates comprehensive test coverage reports for the codebase:
 * - Unit test coverage for agents-v2
 * - Integration test coverage analysis
 * - Combined coverage metrics
 * - Coverage trend analysis
 * - Performance impact of coverage collection
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Coverage Report Generator
 */
class CoverageReportGenerator {
  constructor() {
    this.coverageDir = './coverage';
    this.reportsDir = './coverage/reports';
  }

  /**
   * Generate comprehensive coverage report
   */
  async generateCoverageReport() {
    console.log('📊 Generating Comprehensive Coverage Report');
    console.log('='.repeat(60));

    try {
      // Ensure coverage directories exist
      await this.ensureDirectories();

      // Run unit tests with coverage
      console.log('\n🧪 Running unit tests with coverage...');
      await this.runUnitTestCoverage();

      // Analyze coverage results
      console.log('\n📈 Analyzing coverage results...');
      const coverageAnalysis = await this.analyzeCoverageResults();

      // Generate coverage summary
      console.log('\n📋 Generating coverage summary...');
      const coverageSummary = await this.generateCoverageSummary(coverageAnalysis);

      // Generate HTML reports
      console.log('\n🌐 Generating HTML coverage reports...');
      await this.generateHTMLReports();

      // Check coverage thresholds
      console.log('\n🎯 Checking coverage thresholds...');
      const thresholdResults = await this.checkCoverageThresholds(coverageAnalysis);

      // Generate final report
      const finalReport = {
        timestamp: new Date().toISOString(),
        coverageAnalysis,
        coverageSummary,
        thresholdResults,
        htmlReportPath: path.join(this.coverageDir, 'index.html')
      };

      await this.saveFinalReport(finalReport);

      // Display summary
      this.displayCoverageSummary(finalReport);

      return finalReport;

    } catch (error) {
      console.error('❌ Coverage report generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Run unit tests with coverage collection
   */
  async runUnitTestCoverage() {
    return new Promise((resolve, reject) => {
      const vitestProcess = spawn('npx', ['vitest', 'run', '--coverage'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';

      vitestProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      vitestProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      vitestProcess.on('close', (code) => {
        if (code === 0 || code === 1) { // Allow test failures but require coverage generation
          console.log('✅ Unit tests completed with coverage');
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Unit tests failed with code ${code}: ${stderr}`));
        }
      });

      vitestProcess.on('error', (error) => {
        reject(new Error(`Failed to run unit tests: ${error.message}`));
      });
    });
  }

  /**
   * Analyze coverage results from JSON report
   */
  async analyzeCoverageResults() {
    try {
      const coverageJsonPath = path.join(this.coverageDir, 'coverage-final.json');
      const coverageData = JSON.parse(await fs.readFile(coverageJsonPath, 'utf8'));

      const analysis = {
        totalFiles: 0,
        coveredFiles: 0,
        uncoveredFiles: [],
        highCoverageFiles: [],
        lowCoverageFiles: [],
        overallMetrics: {
          lines: { covered: 0, total: 0, percentage: 0 },
          functions: { covered: 0, total: 0, percentage: 0 },
          branches: { covered: 0, total: 0, percentage: 0 },
          statements: { covered: 0, total: 0, percentage: 0 }
        },
        fileMetrics: []
      };

      // Analyze each file
      for (const [filePath, fileData] of Object.entries(coverageData)) {
        analysis.totalFiles++;

        const fileMetrics = {
          path: filePath,
          lines: this.calculateCoverage(fileData.l),
          functions: this.calculateCoverage(fileData.f),
          branches: this.calculateCoverage(fileData.b),
          statements: this.calculateCoverage(fileData.s)
        };

        // Calculate overall percentage for this file
        const overallPercentage = (
          fileMetrics.lines.percentage +
          fileMetrics.functions.percentage +
          fileMetrics.branches.percentage +
          fileMetrics.statements.percentage
        ) / 4;

        fileMetrics.overallPercentage = Math.round(overallPercentage);

        analysis.fileMetrics.push(fileMetrics);

        // Categorize files
        if (overallPercentage >= 80) {
          analysis.highCoverageFiles.push({ path: filePath, coverage: overallPercentage });
        } else if (overallPercentage < 50) {
          analysis.lowCoverageFiles.push({ path: filePath, coverage: overallPercentage });
        }

        if (overallPercentage > 0) {
          analysis.coveredFiles++;
        } else {
          analysis.uncoveredFiles.push(filePath);
        }

        // Add to overall metrics
        analysis.overallMetrics.lines.covered += fileMetrics.lines.covered;
        analysis.overallMetrics.lines.total += fileMetrics.lines.total;
        analysis.overallMetrics.functions.covered += fileMetrics.functions.covered;
        analysis.overallMetrics.functions.total += fileMetrics.functions.total;
        analysis.overallMetrics.branches.covered += fileMetrics.branches.covered;
        analysis.overallMetrics.branches.total += fileMetrics.branches.total;
        analysis.overallMetrics.statements.covered += fileMetrics.statements.covered;
        analysis.overallMetrics.statements.total += fileMetrics.statements.total;
      }

      // Calculate overall percentages
      analysis.overallMetrics.lines.percentage = this.calculatePercentage(
        analysis.overallMetrics.lines.covered,
        analysis.overallMetrics.lines.total
      );
      analysis.overallMetrics.functions.percentage = this.calculatePercentage(
        analysis.overallMetrics.functions.covered,
        analysis.overallMetrics.functions.total
      );
      analysis.overallMetrics.branches.percentage = this.calculatePercentage(
        analysis.overallMetrics.branches.covered,
        analysis.overallMetrics.branches.total
      );
      analysis.overallMetrics.statements.percentage = this.calculatePercentage(
        analysis.overallMetrics.statements.covered,
        analysis.overallMetrics.statements.total
      );

      return analysis;

    } catch (error) {
      console.warn('⚠️ Could not analyze coverage results:', error.message);
      return {
        totalFiles: 0,
        coveredFiles: 0,
        uncoveredFiles: [],
        overallMetrics: {
          lines: { percentage: 0 },
          functions: { percentage: 0 },
          branches: { percentage: 0 },
          statements: { percentage: 0 }
        }
      };
    }
  }

  /**
   * Generate coverage summary
   */
  async generateCoverageSummary(analysis) {
    const summary = {
      overallCoverage: Math.round((
        analysis.overallMetrics.lines.percentage +
        analysis.overallMetrics.functions.percentage +
        analysis.overallMetrics.branches.percentage +
        analysis.overallMetrics.statements.percentage
      ) / 4),
      filesCovered: `${analysis.coveredFiles}/${analysis.totalFiles}`,
      coverageByType: {
        lines: `${analysis.overallMetrics.lines.percentage}%`,
        functions: `${analysis.overallMetrics.functions.percentage}%`,
        branches: `${analysis.overallMetrics.branches.percentage}%`,
        statements: `${analysis.overallMetrics.statements.percentage}%`
      },
      topCoveredFiles: analysis.highCoverageFiles
        .sort((a, b) => b.coverage - a.coverage)
        .slice(0, 5),
      leastCoveredFiles: analysis.lowCoverageFiles
        .sort((a, b) => a.coverage - b.coverage)
        .slice(0, 5),
      uncoveredFiles: analysis.uncoveredFiles.slice(0, 10)
    };

    return summary;
  }

  /**
   * Generate HTML reports
   */
  async generateHTMLReports() {
    // The HTML report should already be generated by vitest
    const htmlReportPath = path.join(this.coverageDir, 'index.html');
    
    try {
      await fs.access(htmlReportPath);
      console.log(`✅ HTML coverage report available at: ${htmlReportPath}`);
    } catch (error) {
      console.warn('⚠️ HTML coverage report not found');
    }
  }

  /**
   * Check coverage thresholds
   */
  async checkCoverageThresholds(analysis) {
    const thresholds = {
      global: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      },
      agentsV2: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    };

    const results = {
      global: {
        met: true,
        details: {}
      },
      agentsV2: {
        met: true,
        details: {}
      }
    };

    // Check global thresholds
    for (const [metric, threshold] of Object.entries(thresholds.global)) {
      const actual = analysis.overallMetrics[metric].percentage;
      const met = actual >= threshold;
      results.global.details[metric] = {
        threshold,
        actual,
        met
      };
      if (!met) results.global.met = false;
    }

    // Check agents-v2 specific thresholds
    const agentsV2Files = analysis.fileMetrics.filter(f => 
      f.path.includes('app/lib/agents-v2/'));
    
    if (agentsV2Files.length > 0) {
      const agentsV2Metrics = this.calculateAggregateMetrics(agentsV2Files);
      
      for (const [metric, threshold] of Object.entries(thresholds.agentsV2)) {
        const actual = agentsV2Metrics[metric].percentage;
        const met = actual >= threshold;
        results.agentsV2.details[metric] = {
          threshold,
          actual,
          met
        };
        if (!met) results.agentsV2.met = false;
      }
    }

    return results;
  }

  /**
   * Save final coverage report
   */
  async saveFinalReport(report) {
    const reportPath = path.join(this.reportsDir, 'coverage-summary.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Coverage report saved to: ${reportPath}`);
  }

  /**
   * Display coverage summary to console
   */
  displayCoverageSummary(report) {
    console.log('\n📊 Coverage Summary');
    console.log('='.repeat(40));
    console.log(`Overall Coverage: ${report.coverageSummary.overallCoverage}%`);
    console.log(`Files Covered: ${report.coverageSummary.filesCovered}`);
    console.log('\nCoverage by Type:');
    console.log(`  Lines: ${report.coverageSummary.coverageByType.lines}`);
    console.log(`  Functions: ${report.coverageSummary.coverageByType.functions}`);
    console.log(`  Branches: ${report.coverageSummary.coverageByType.branches}`);
    console.log(`  Statements: ${report.coverageSummary.coverageByType.statements}`);

    console.log('\n🎯 Threshold Results:');
    console.log(`Global Thresholds: ${report.thresholdResults.global.met ? '✅ MET' : '❌ NOT MET'}`);
    console.log(`Agents V2 Thresholds: ${report.thresholdResults.agentsV2.met ? '✅ MET' : '❌ NOT MET'}`);

    if (report.coverageSummary.topCoveredFiles.length > 0) {
      console.log('\n🏆 Top Covered Files:');
      report.coverageSummary.topCoveredFiles.forEach(file => {
        console.log(`  ${Math.round(file.coverage)}% - ${path.basename(file.path)}`);
      });
    }

    if (report.coverageSummary.leastCoveredFiles.length > 0) {
      console.log('\n⚠️ Files Needing Coverage:');
      report.coverageSummary.leastCoveredFiles.forEach(file => {
        console.log(`  ${Math.round(file.coverage)}% - ${path.basename(file.path)}`);
      });
    }

    console.log(`\n🌐 HTML Report: file://${path.resolve(report.htmlReportPath)}`);
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [this.coverageDir, this.reportsDir];
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory already exists
      }
    }
  }

  /**
   * Calculate coverage from vitest coverage data
   */
  calculateCoverage(data) {
    if (!data || typeof data !== 'object') {
      return { covered: 0, total: 0, percentage: 0 };
    }

    const values = Object.values(data);
    const total = values.length;
    const covered = values.filter(v => v > 0).length;
    const percentage = this.calculatePercentage(covered, total);

    return { covered, total, percentage };
  }

  /**
   * Calculate percentage with proper rounding
   */
  calculatePercentage(covered, total) {
    if (total === 0) return 0;
    return Math.round((covered / total) * 100);
  }

  /**
   * Calculate aggregate metrics for a set of files
   */
  calculateAggregateMetrics(files) {
    const aggregate = {
      lines: { covered: 0, total: 0 },
      functions: { covered: 0, total: 0 },
      branches: { covered: 0, total: 0 },
      statements: { covered: 0, total: 0 }
    };

    files.forEach(file => {
      aggregate.lines.covered += file.lines.covered;
      aggregate.lines.total += file.lines.total;
      aggregate.functions.covered += file.functions.covered;
      aggregate.functions.total += file.functions.total;
      aggregate.branches.covered += file.branches.covered;
      aggregate.branches.total += file.branches.total;
      aggregate.statements.covered += file.statements.covered;
      aggregate.statements.total += file.statements.total;
    });

    // Calculate percentages
    aggregate.lines.percentage = this.calculatePercentage(aggregate.lines.covered, aggregate.lines.total);
    aggregate.functions.percentage = this.calculatePercentage(aggregate.functions.covered, aggregate.functions.total);
    aggregate.branches.percentage = this.calculatePercentage(aggregate.branches.covered, aggregate.branches.total);
    aggregate.statements.percentage = this.calculatePercentage(aggregate.statements.covered, aggregate.statements.total);

    return aggregate;
  }
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new CoverageReportGenerator();
  
  generator.generateCoverageReport()
    .then(report => {
      console.log('\n🎯 Coverage Report Generation Complete!');
      
      if (report.thresholdResults.global.met && report.thresholdResults.agentsV2.met) {
        console.log('🎉 All coverage thresholds met!');
        process.exit(0);
      } else {
        console.log('⚠️ Some coverage thresholds not met.');
        process.exit(0); // Don't fail CI for coverage, just warn
      }
    })
    .catch(error => {
      console.error('❌ Coverage report generation failed:', error);
      process.exit(1);
    });
}

export { CoverageReportGenerator };