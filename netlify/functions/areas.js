/**
 * Netlify Serverless Function - 获取地区树
 * GET /api/areas
 */

const { getAreaTree } = require('../../lib/ali-client');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const data = getAreaTree();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data })
    };
  } catch (e) {
    console.error('Areas error:', e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
