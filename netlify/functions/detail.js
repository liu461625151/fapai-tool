/**
 * Netlify Serverless Function - 获取法拍房详情（看样时间等）
 * GET /api/detail?itemId=xxx&cookie=xxx
 */

const https = require('https');
const crypto = require('crypto');

// 从Cookie中提取_m_h5_tk
function extractToken(cookie) {
  if (!cookie) return '';
  const match = cookie.match(/_m_h5_tk=([^;]+)/);
  if (match) {
    return match[1].split('_')[0];
  }
  return '';
}

// 调用H5 API获取详情
async function fetchDetailViaH5Api(itemId, cookie) {
  const token = extractToken(cookie);
  if (!token) {
    throw new Error('Cookie中缺少_m_h5_tk，请确保已登录淘宝');
  }
  
  const appKey = '12574478';
  const t = Date.now();
  
  // 尝试多个可能的详情API名称
  const apiNames = [
    'auctionwalle.page.getDetail',
    'auctionwalle.item.getDetail',
    'auctionwalle.detail.get',
    'auctionwalle.page.getItemDetail',
    'auctionwalle.item.detail'
  ];
  
  for (const apiName of apiNames) {
    try {
      const data = JSON.stringify({
        dfApp: 'auctionwalle',
        dfApiName: apiName,
        dfVariables: JSON.stringify({
          itemId: itemId,
          pageSpmb: 'sf-detail'
        })
      });
      
      const sign = crypto.createHash('md5').update(token + '&' + t + '&' + appKey + '&' + data).digest('hex');
      
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'h5api.m.taobao.com',
          path: '/h5/mtop.taobao.datafront.invoke.auctionwalle/1.0/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Referer': 'https://h5.m.taobao.com/'
          }
        };
        
        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', d => body += d);
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('API请求超时')); });
        req.write('data=' + encodeURIComponent(data) + '&t=' + t + '&sign=' + sign + '&appKey=' + appKey);
        req.end();
      });
      
      if (result.status === 200) {
        const json = JSON.parse(result.body);
        if (json.data && json.data.data && !json.data.data.includes('无法获取接口配置信息')) {
          return json.data;
        }
      }
    } catch (e) {
      // 继续尝试下一个API
    }
  }
  
  throw new Error('所有详情API均调用失败');
}

// 直接请求详情页（带完整请求头）
async function fetchDetailPage(itemId, cookie) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sf-item.taobao.com',
      path: `/sf_item/${itemId}.htm`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie || '',
        'Referer': 'https://sf.taobao.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
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
    
    // 方法1：尝试H5 API获取详情
    try {
      const detailData = await fetchDetailViaH5Api(itemId, cookie);
      const detailStr = JSON.stringify(detailData);
      const sampleTime = extractSampleTime(detailStr);
      if (sampleTime) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: { itemId, sampleTime, source: 'h5_api' }
          })
        };
      }
    } catch (e) {
      // H5 API失败，继续尝试直接请求页面
    }
    
    // 方法2：直接请求详情页
    const { status, body } = await fetchDetailPage(itemId, cookie);
    
    if (status === 302 || body.includes('login.taobao.com') || body.length < 5000) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'cookie已过期或无效，请重新登录淘宝并更新cookie（建议使用一键导入书签）' })
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
          pageSize: body.length,
          source: 'page'
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
