import { createSupabaseClient } from '@/app/lib/supabase';

export class RunManager {
	constructor(existingRunId) {
		this.supabase = createSupabaseClient();
		this.runId = existingRunId || null;
	}

	async startRun(sourceId) {
		const { data, error } = await this.supabase
			.from('api_source_runs')
			.insert({
				source_id: sourceId,
				status: 'started',
				source_manager_status: 'pending',
				api_handler_status: 'pending',
				detail_processor_status: 'pending',
				data_processor_status: 'pending',
			})
			.select()
			.single();

		if (error) throw error;
		this.runId = data.id;
		return data.id;
	}

	async updateInitialApiCall(stats) {
		if (!this.runId) throw new Error('No active run');

		// Ensure backward compatibility while transitioning from sampleOpportunities to responseSamples
		const processedStats = { ...stats };

		// If we have the new responseSamples field, use it
		if (processedStats.responseSamples) {
			// Keep the field but ensure it's clearly marked as metadata
			processedStats._responseSamplesMetadataOnly = true;
		}
		// If we still have the old sampleOpportunities field, convert it
		else if (processedStats.sampleOpportunities) {
			// Convert to the new format for backward compatibility
			processedStats.responseSamples = processedStats.sampleOpportunities.map(
				(sample, i) => ({
					...sample,
					_metadataOnly: true,
					_debugSample: true,
					_sampleIndex: i,
					_convertedFromLegacyFormat: true,
				})
			);
			processedStats._responseSamplesMetadataOnly = true;

			// Keep the original for backward compatibility but mark it
			processedStats._legacySampleOpportunities =
				processedStats.sampleOpportunities;
			delete processedStats.sampleOpportunities;
		}

		return await this.supabase
			.from('api_source_runs')
			.update({
				initial_api_call: processedStats,
				status: 'processing',
				source_manager_status: 'completed',
				api_handler_status: 'processing',
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async updateFirstStageFilter(stats) {
		if (!this.runId) throw new Error('No active run');

		// Ensure backward compatibility while transitioning from sampleOpportunities to responseSamples
		const processedStats = { ...stats };

		// If we have the new responseSamples field, use it
		if (processedStats.responseSamples) {
			// Keep the field but ensure it's clearly marked as metadata
			processedStats._responseSamplesMetadataOnly = true;
		}
		// If we still have the old sampleOpportunities field, convert it
		else if (processedStats.sampleOpportunities) {
			// Convert to the new format for backward compatibility
			processedStats.responseSamples = processedStats.sampleOpportunities.map(
				(sample, i) => ({
					...sample,
					_metadataOnly: true,
					_debugSample: true,
					_sampleIndex: i,
					_filterStage: 'first',
					_convertedFromLegacyFormat: true,
				})
			);
			processedStats._responseSamplesMetadataOnly = true;

			// Keep the original for backward compatibility but mark it
			processedStats._legacySampleOpportunities =
				processedStats.sampleOpportunities;
			delete processedStats.sampleOpportunities;
		}

		return await this.supabase
			.from('api_source_runs')
			.update({
				first_stage_filter: processedStats,
				api_handler_status: 'completed',
				detail_processor_status: 'processing',
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async updateDetailApiCalls(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				detail_api_calls: stats,
				detail_processor_status: 'completed',
				data_processor_status: 'processing',
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async updateSecondStageFilter(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				second_stage_filter: stats,
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async updateStorageResults(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				storage_results: stats,
				data_processor_status: 'completed',
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async completeRun(totalTime) {
		if (!this.runId) throw new Error('No active run');

		const updateData = {
			status: 'completed',
			completed_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			source_manager_status: 'completed',
			api_handler_status: 'completed',
			detail_processor_status: 'completed',
			data_processor_status: 'completed',
		};

		if (totalTime) {
			updateData.total_processing_time = totalTime;
		}

		return await this.supabase
			.from('api_source_runs')
			.update(updateData)
			.eq('id', this.runId);
	}

	async updateRunError(error) {
		if (!this.runId) throw new Error('No active run');

		const errorDetails =
			error instanceof Error
				? {
						message: error.message,
						stack: error.stack,
						...(error.cause && { cause: String(error.cause) }),
				  }
				: String(error);

		// Get current run to determine which stage failed
		const { data: currentRun } = await this.supabase
			.from('api_source_runs')
			.select('*')
			.eq('id', this.runId)
			.single();

		// Determine which stage failed based on status
		const updateData = {
			status: 'failed',
			error_details: JSON.stringify(errorDetails, null, 2),
			completed_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		// Mark the current stage as failed
		if (currentRun.source_manager_status === 'processing') {
			updateData.source_manager_status = 'failed';
		} else if (currentRun.api_handler_status === 'processing') {
			updateData.api_handler_status = 'failed';
		} else if (currentRun.detail_processor_status === 'processing') {
			updateData.detail_processor_status = 'failed';
		} else if (currentRun.data_processor_status === 'processing') {
			updateData.data_processor_status = 'failed';
		}

		return await this.supabase
			.from('api_source_runs')
			.update(updateData)
			.eq('id', this.runId);
	}

	async updateStageStatus(stage, status) {
		if (!this.runId) throw new Error('No active run');

		const validStages = [
			'source_manager_status',
			'api_handler_status',
			'detail_processor_status',
			'data_processor_status',
		];

		const validStatuses = ['pending', 'processing', 'completed', 'failed'];

		if (!validStages.includes(stage)) {
			throw new Error(
				`Invalid stage: ${stage}. Must be one of: ${validStages.join(', ')}`
			);
		}

		if (!validStatuses.includes(status)) {
			throw new Error(
				`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`
			);
		}

		const updateData = {
			[stage]: status,
			updated_at: new Date().toISOString(),
		};

		// If any stage fails, mark the overall run as failed
		if (status === 'failed') {
			updateData.status = 'failed';
			updateData.completed_at = new Date().toISOString();
		}

		// If all stages are completed, mark the overall run as completed
		if (status === 'completed' && stage === 'data_processor_status') {
			const { data: currentRun } = await this.supabase
				.from('api_source_runs')
				.select(
					'source_manager_status, api_handler_status, detail_processor_status'
				)
				.eq('id', this.runId)
				.single();

			if (
				currentRun.source_manager_status === 'completed' &&
				currentRun.api_handler_status === 'completed' &&
				currentRun.detail_processor_status === 'completed'
			) {
				updateData.status = 'completed';
				updateData.completed_at = new Date().toISOString();
			}
		}

		return await this.supabase
			.from('api_source_runs')
			.update(updateData)
			.eq('id', this.runId);
	}

	async getRun() {
		if (!this.runId) throw new Error('No active run');

		const { data, error } = await this.supabase
			.from('api_source_runs')
			.select('*')
			.eq('id', this.runId)
			.single();

		if (error) throw error;
		return data;
	}

	async getStageStatus(stage) {
		if (!this.runId) throw new Error('No active run');

		const validStages = [
			'source_manager_status',
			'api_handler_status',
			'detail_processor_status',
			'data_processor_status',
		];

		if (!validStages.includes(stage)) {
			throw new Error(
				`Invalid stage: ${stage}. Must be one of: ${validStages.join(', ')}`
			);
		}

		const { data, error } = await this.supabase
			.from('api_source_runs')
			.select(stage)
			.eq('id', this.runId)
			.single();

		if (error) throw error;
		return data[stage];
	}

	async resumeFailedRun() {
		if (!this.runId) throw new Error('No active run');

		// Get the current run state
		const { data: run, error } = await this.supabase
			.from('api_source_runs')
			.select('*')
			.eq('id', this.runId)
			.single();

		if (error) throw error;

		if (run.status !== 'failed') {
			throw new Error('Can only resume failed runs');
		}

		// Determine which stage to resume from
		let resumeStage = null;

		if (run.source_manager_status === 'failed') {
			resumeStage = 'source_manager';
		} else if (run.api_handler_status === 'failed') {
			resumeStage = 'api_handler';
		} else if (run.detail_processor_status === 'failed') {
			resumeStage = 'detail_processor';
		} else if (run.data_processor_status === 'failed') {
			resumeStage = 'data_processor';
		}

		if (!resumeStage) {
			throw new Error('Could not determine which stage to resume from');
		}

		// Update the run status to resume processing
		await this.supabase
			.from('api_source_runs')
			.update({
				status: 'processing',
				error_details: null,
				completed_at: null,
				updated_at: new Date().toISOString(),
				[`${resumeStage}_status`]: 'processing',
			})
			.eq('id', this.runId);

		return {
			runId: this.runId,
			resumeStage,
			message: `Resumed run from ${resumeStage} stage`,
		};
	}
}
