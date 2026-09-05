/**
 * Netlify Serverless Function - 搜索法拍房
 * GET /api/search?page=1&province=上海&city=上海&district=闵行区&status=0,1&category=206060601
 * Version: v2
 */

const { searchJudicial } = require('../../lib/ali-client');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'X-App-Version': 'v2'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    const result = await searchJudicial({
      page: parseInt(params.page) || 1,
      province: params.province || '',
      city: params.city || '',
      district: params.district || '',
      status: params.status || '0,1',
      category: params.category || ''
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: result })
    };
  } catch (e) {
    console.error('Search error:', e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
