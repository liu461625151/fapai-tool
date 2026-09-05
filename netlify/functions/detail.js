/**
 * Netlify Serverless Function - 获取法拍房详情（看样时间等）
 * GET /api/detail?itemId=xxx&cookie=xxx
 */

const https = require('https');

function fetchDetailPage(itemId, cookie) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sf-item.taobao.com',
      path: `/sf_item/${itemId}.htm`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie || '',
        'Referer': 'https://sf.taobao.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('请求超时')); });
    req.end();
  });
}

function extractSampleTime(html) {
  if (!html) return '';
  
  // 移除HTML标签
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  
  // 匹配看样时间的多种格式
  const patterns = [
    /(?:咨询[、,，]?\s*展示看样|看样|展示)的?时间[与和及]?方式[^。]*?自\s*(\d{4}年\d{1,2}月\d{1,2}日)\s*起?\s*(?:至|到|—|-|~)\s*(\d{4}年\d{1,2}月\d{1,2}日(?:\d{1,2}时)?)/,
    /自\s*(\d{4}年\d{1,2}月\d{1,2}日)\s*起?\s*(?:至|到|—|-|~)\s*(\d{4}年\d{1,2}月\d{1,2}日(?:\d{1,2}时)?)\s*止?[^。]*?看样/,
    /看样[^。]*?(\d{4}年\d{1,2}月\d{1,2}日)\s*(?:至|到|—|-|~)\s*(\d{4}年\d{1,2}月\d{1,2}日)/,
    /(\d{4}年\d{1,2}月\d{1,2}日)\s*(?:至|到|—|-|~)\s*(\d{4}年\d{1,2}月\d{1,2}日)[^。]*?(?:看样|展示)/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return `${match[1]} 至 ${match[2]}`;
    }
  }
  
  // 尝试匹配更简单的格式
  const simpleMatch = text.match(/(\d{4}年\d{1,2}月\d{1,2}日)\s*(?:至|到|—|-|~)\s*(\d{4}年\d{1,2}月\d{1,2}日(?:\d{1,2}时)?)/);
  if (simpleMatch && text.includes('看样')) {
    return `${simpleMatch[1]} 至 ${simpleMatch[2]}`;
  }
  
  return '';
}

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
    const params = event.queryStringParameters || {};
    const itemId = params.itemId;
    const cookie = params.cookie || '';
    
    if (!itemId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少itemId参数' })
      };
    }
    
    if (!cookie) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少淘宝登录cookie，请先在设置中配置' })
      };
    }
    
    const { status, body } = await fetchDetailPage(itemId, cookie);
    
    if (status === 302 || body.includes('login.taobao.com') || body.length < 5000) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'cookie已过期或无效，请重新登录淘宝并更新cookie' })
      };
    }
    
    const sampleTime = extractSampleTime(body);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          itemId: itemId,
          sampleTime: sampleTime,
          pageSize: body.length
        }
      })
    };
  } catch (e) {
    console.error('Detail error:', e.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
