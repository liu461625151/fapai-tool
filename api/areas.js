/**
 * 获取地区树 API
 * GET /api/areas
 */

const { getAreaTree } = require('../lib/ali-client');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const data = getAreaTree();
    res.status(200).json({ success: true, data });
  } catch (e) {
    console.error('Areas error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};
