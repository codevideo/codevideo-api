import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '');

// for jobs table

export const addJobToSupabase = async (id: string, status: 'queued' | 'started' | 'done' | 'error') => {
    const { error } = await supabase.from('jobs').insert({id, status});
    if (error) {
        throw new Error('Error adding to job table: ' + JSON.stringify(error));
    }
}

export const updateJobInSupabase = async (guidv4: string, status: 'queued' | 'started' | 'done' | 'error') => {
    const { error } = await supabase.from('jobs').update({status}).match({id: guidv4});
    if (error) {
        throw new Error('Error updating job table: ' + JSON.stringify(error));
    }
}

// sort by created_at and return the first one
export const getNextJobFromSupabase = async () => {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at').limit(1)
    if (error) {
        throw new Error('Error getting next job: ' + JSON.stringify(error));
    }
    return data;
}

export const getJobByIdFromSupabase = async (guidv4: string) => {
    const { data, error } = await supabase.from('jobs').select('id, status').eq('id', guidv4)
    if (error) {
        throw new Error('Error updating job table: ' + JSON.stringify(error));
    }
    if (!data) {
        throw new Error(`No job found with ${guidv4}`);
    }
    return data[0];
}