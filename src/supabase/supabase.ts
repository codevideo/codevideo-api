import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');

// for job_counts table

export const incrementJobsInQueue = async () => {
    const { error } = await supabase
    .rpc('increment_jobs_in_queue')
    if (error) {
        throw new Error('Error incrementing jobs in queue');
    }
};

export const decrementJobsInQueue = async () => {
    const { error } = await supabase.rpc('decrement_jobs_in_queue');
    if (error) {
        throw new Error('Error decrementing jobs in queue');
    }
};

export const getJobsInQueue = async (): Promise<number> => {
    const { data, error } = await supabase.from('jobs_in_queue').select('count').match({id: 1})
    if (error) {
        throw new Error('Error getting jobs in queue');
    }
    if (!data) {
        throw new Error('No data found for jobs in queue');
    }
    return data[0].count;
}

// for jobs table

export const addJob = async (guidv4: string, status: 'queued' | 'started' | 'done' | 'error') => {
    const { error } = await supabase.from('jobs').insert({guidv4, status});
    if (error) {
        throw new Error('Error adding job');
    }
}

export const updateJob = async (guidv4: string, status: 'queued' | 'started' | 'done' | 'error') => {
    const { error } = await supabase.from('jobs').update({status}).match({guidv4});
    if (error) {
        throw new Error('Error updating job');
    }
}

export const getJob = async (guidv4: string) => {
    const { data, error } = await supabase.from('jobs').select('id, status').eq('id', guidv4)
    if (error) {
        throw new Error('Error updating job');
    }
    if (!data) {
        throw new Error(`No job found with ${guidv4}`);
    }
    return data[0];
}