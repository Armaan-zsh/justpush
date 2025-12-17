// Vercel Serverless API - Add Pushup Entry
// POST /api/add with { date, count, password }

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { date, count, password } = req.body;

    // Check password (stored in Vercel environment variable)
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Wrong password' });
    }

    // Validate input
    if (!date || typeof count !== 'number' || count < 0) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    // Insert or update in Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/pushups`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ date, count })
        });

        if (!response.ok) {
            const error = await response.text();
            return res.status(500).json({ error: `Database error: ${error}` });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
