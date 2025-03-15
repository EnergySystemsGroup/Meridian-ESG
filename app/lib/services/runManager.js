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
			})
			.select()
			.single();

		if (error) throw error;
		this.runId = data.id;
		return data.id;
	}

	async updateInitialApiCall(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				initial_api_call: stats,
				status: 'processing',
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async updateFirstStageFilter(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				first_stage_filter: stats,
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

		return await this.supabase
			.from('api_source_runs')
			.update({
				status: 'failed',
				error_details: error.toString(),
				completed_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
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
}
