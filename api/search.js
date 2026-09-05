/**
 * 搜索法拍房 API
 * GET /api/search?page=1&province=上海&city=上海&district=闵行区&status=0,1&category=206060601
 */

const { searchJudicial } = require('../lib/ali-client');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { page, province, city, district, status, category } = req.query;
    const result = await searchJudicial({
      page: parseInt(page) || 1,
      province: province || '',
      city: city || '',
      district: district || '',
      status: status || '0,1',
      category: category || '206060601'
    });
    res.status(200).json({ success: true, data: result });
  } catch (e) {
    console.error('Search error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
};
