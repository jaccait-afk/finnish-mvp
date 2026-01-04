export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Generate a simple token
    const token = 'token_' + Math.random().toString(36).substr(2, 9);
    res.status(200).json({ token });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
}

