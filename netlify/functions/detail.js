/**
 * Netlify Serverless Function - 获取法拍房详情（看样时间等）
 * GET /api/detail?itemId=xxx
 * 
 * 使用Puppeteer（无头浏览器）在Netlify函数中直接渲染页面
 * 不需要用户注册任何第三方服务，完全免费
 */

// 从HTML中提取看样时间
function extractSampleTime(html) {
  if (!html) return '';
  
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  
  // 在"看样"关键词附近查找日期
  const sampleIdx = text.indexOf('看样');
  if (sampleIdx >= 0) {
    const nearby = text.substring(Math.max(0, sampleIdx - 100), Math.min(text.length, sampleIdx + 300));
    const dates = findDates(nearby);
    if (dates.length >= 2) {
      return dates[0] + ' 至 ' + dates[1];
    }
  }
  
  // 在"展示"关键词附近查找日期
  const displayIdx = text.indexOf('展示');
  if (displayIdx >= 0) {
    const nearby = text.substring(Math.max(0, displayIdx - 100), Math.min(text.length, displayIdx + 300));
    const dates = findDates(nearby);
    if (dates.length >= 2) {
      return dates[0] + ' 至 ' + dates[1];
    }
  }
  
  // 查找所有日期范围
  const allDates = findDates(text);
  for (let i = 0; i < allDates.length - 1; i++) {
    const date1Idx = text.indexOf(allDates[i]);
    const date2Idx = text.indexOf(allDates[i + 1]);
    if (date1Idx >= 0 && date2Idx >= 0) {
      const between = text.substring(date1Idx + allDates[i].length, date2Idx);
      if (between.match(/至|到|—|-|~|到/) && between.length < 50) {
        return allDates[i] + ' 至 ' + allDates[i + 1];
      }
    }
  }
  
  return '';
}

function findDates(text) {
  const dates = [];
  const patterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：时](\d{1,2})分?)?/g,
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s*(\d{1,2})[:：](\d{1,2}))?/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let dateStr = match[1] + '年' + match[2] + '月' + match[3] + '日';
      if (match[4]) {
        dateStr += ' ' + match[4] + ':' + (match[5] || '00');
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

  let browser = null;
  
  try {
    const params = event.queryStringParameters || {};
    const itemId = params.itemId;
    
    if (!itemId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '缺少itemId参数' })
      };
    }
    
    // 动态导入ES Module
    const puppeteer = await import('puppeteer-core');
    const chromium = await import('@sparticuz/chromium');
    
    // 启动Puppeteer
    browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
      ignoreHTTPSErrors: true,
    });
    
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 拦截图片、CSS等资源，加快加载速度
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    const url = 'https://sf-item.taobao.com/sf_item/' + itemId + '.htm';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    
    await page.waitForTimeout(3000);
    
    const html = await page.content();
    const sampleTime = extractSampleTime(html);
    
    await browser.close();
    browser = null;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          itemId: itemId,
          sampleTime: sampleTime,
          pageSize: html.length,
          source: 'puppeteer'
        }
      })
    };
  } catch (e) {
    console.error('Detail error:', e.message);
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: e.message })
    };
  }
};
