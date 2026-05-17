const supabaseUrl = 'https://sxcyygkxjysadsmyhijg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4Y3l5Z2t4anlzYWRzbXloaWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDQ2MjksImV4cCI6MjA5NDQyMDYyOX0.FuzzBeROUAH39tu-8vJ9su7WMjeq2F_uzfdcPQ33ufk';

const supabaseClient = supabase.createClient(
  supabaseUrl,
  supabaseKey
);