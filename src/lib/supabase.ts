import { createClient } from '@supabase/supabase-js';

// Hardcode for Vercel deployment
const SUPABASE_URL = 'https://hlumwrbidlxepmcvsswe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsdW13cmJpZGx4ZXBtY3Zzc3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDgwMTAsImV4cCI6MjA4NjE4NDAxMH0.LIieVIPxtf2piYo06ZalwvWXdqiFTXDbHeA0TPzs0Fw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const MC_TOKEN = 'xiaobei-mc-2026';
