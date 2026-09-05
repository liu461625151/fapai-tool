/**
 * Netlify Serverless Function - 获取法拍房详情（看样时间等）
 * GET /api/detail?itemId=xxx&browserlessToken=xxx
 * 
 * 使用Browserless无头浏览器服务渲染页面，提取看样时间
 */

const https = require('https');

// 调用Browserless渲染页面
async function fetchViaBrowserless(itemId, token) {
  return new Promise((resolve, reject) => {
    const url = `https://sf-item.taobao.com/sf_item/${itemId}.htm`;
    const postData = JSON.stringify({
      url: url,
      waitFor: 3000, // 等待3秒让页面渲染
      gotoOptions: { waitUntil: 'networkidle2' }
    });
    
    const options = {
      hostname: 'chrome.browserless.io',
      path: `/content?token=${encodeURIComponent(token)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(body);
        } else {
          reject(new Error(`Browserless返回 ${res.statusCode}: ${body.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Browserless请求超时')); });
    req.write(postData);
    req.end();
  });
}

// 从HTML中提取看样时间
function extractSampleTime(html) {
  if (!html) return '';
  
  // 移除HTML标签，获取纯文本
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  
  // 方法1：在"看样"关键词附近查找日期
  const sampleIdx = text.indexOf('看样');
  if (sampleIdx >= 0) {
    const nearby = text.substring(Math.max(0, sampleIdx - 100), Math.min(text.length, sampleIdx + 300));
    const dates = findDates(nearby);
    if (dates.length >= 2) {
      return `${dates[0]} 至 ${dates[1]}`;
    }
  }
  
  // 方法2：查找"展示"关键词附近的日期
  const displayIdx = text.indexOf('展示');
  if (displayIdx >= 0) {
    const nearby = text.substring(Math.max(0, displayIdx - 100), Math.min(text.length, displayIdx + 300));
    const dates = findDates(nearby);
    if (dates.length >= 2) {
      return `${dates[0]} 至 ${dates[1]}`;
    }
  }
  
  // 方法3：查找所有日期范围，返回第一个
  const allDates = findDates(text);
  for (let i = 0; i < allDates.length - 1; i++) {
    // 检查两个日期之间是否有连接词
    const date1Idx = text.indexOf(allDates[i]);
    const date2Idx = text.indexOf(allDates[i + 1]);
    if (date1Idx >= 0 && date2Idx >= 0) {
      const between = text.substring(date1Idx + allDates[i].length, date2Idx);
      if (between.match(/至|到|—|-|~|到/) && between.length < 50) {
        return `${allDates[i]} 至 ${allDates[i + 1]}`;
      }
    }
  }
  
  return '';
}

// 从文本中查找所有日期
function findDates(text) {
  const dates = [];
  const patterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：时](\d{1,2})分?)?/g,
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s*(\d{1,2})[:：](\d{1,2}))?/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let dateStr = `${match[1]}年${match[2]}月${match[3]}日`;
      if (match[4]) {
        dateStr += ` ${match[4]}:${match[5] || '00'}`;
      }
      if (!dates.includes(dateStr)) {
        dates.push(dateStr);
      }
    }
  }
  
  return dates;
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
    const browserlessToken = params.browserlessToken || '';
    
    if (!itemId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少itemId参数' })
      };
    }
    
    if (!browserlessToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少Browserless API Token，请先在设置中配置' })
      };
    }
    
    // 使用Browserless渲染页面
    const html = await fetchViaBrowserless(itemId, browserlessToken);
    
    if (!html || html.length < 5000) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ success: false, error: '页面渲染失败或内容过少，请检查Browserless Token是否正确' })
      };
    }
    
    const sampleTime = extractSampleTime(html);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          itemId: itemId,
          sampleTime: sampleTime,
          pageSize: html.length,
          source: 'browserless'
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
