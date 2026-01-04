export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, answers } = req.body;
  
  // Mock diagnostic results
  res.status(200).json({
    overall: 65,
    cases: {
      illative: 45,
      inessive: 72,
      elative: 58,
      adessive: 68,
      ablative: 52
    }
  });
}

