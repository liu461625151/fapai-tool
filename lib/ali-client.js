/**
 * 阿里拍卖 H5 API 客户端
 * 用于Serverless环境，模块级缓存token
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APP_KEY = '12574478';
const API_NAME = 'mtop.taobao.datafront.invoke.auctionwalle';
const API_VERSION = '1.0';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// 加载地区编码
const gb2260Data = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'gb2260.json'), 'utf-8')
);

// 模块级缓存（Serverless函数实例复用时有效）
let tokenCache = null;
let tokenExpireTime = 0;
let cookieStore = {};

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function padCode(code) {
  return (code + '0000').substring(0, 6);
}

/**
 * 省/市/区中文名 → 阿里接受的6位GB2260编码（pre-2013 vintage）
 */
function resolveLocationCode(province, city, district) {
  if (!province) return null;
  const pn = province.replace(/[省市自治区]+$/, '');
  const pMatch = gb2260Data.find(p =>
    p.name.includes(pn) || pn.includes(p.name.replace(/[省市自治区]+$/, ''))
  );
  if (!pMatch) return null;
  if (!city) return padCode(pMatch.code);
  const cn = city.replace(/[市地区州盟自治州]+$/, '');
  const cMatch = (pMatch.children || []).find(c =>
    c.name.includes(cn) || cn.includes(c.name.replace(/[市地区州盟自治州]+$/, ''))
  );
  if (!cMatch) return padCode(pMatch.code);
  if (!district) return padCode(cMatch.code);
  const dn = district.replace(/[区县市旗]+$/, '');
  const dMatch = (cMatch.children || []).find(d =>
    d.name.includes(dn) || dn.includes(d.name.replace(/[区县市旗]+$/, ''))
  );
  if (!dMatch) return padCode(cMatch.code);
  return padCode(dMatch.code);
}

function getAreaTree() {
  return gb2260Data.map(p => ({
    name: p.name,
    children: (p.children || []).map(c => ({
      name: c.name,
      children: (c.children || []).map(d => ({ name: d.name }))
    }))
  }));
}

function saveCookies(setCookieHeaders) {
  (setCookieHeaders || []).forEach(c => {
    const m = c.match(/^([^=]+)=([^;]+)/);
    if (m) cookieStore[m[1]] = m[2];
  });
}

function getCookieString() {
  return Object.entries(cookieStore).map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * Bootstrap: 获取 _m_h5_tk cookie
 */
function bootstrapToken() {
  return new Promise((resolve, reject) => {
    if (tokenCache && Date.now() < tokenExpireTime) {
      return resolve(tokenCache);
    }
    const t = Date.now().toString();
    const params = new URLSearchParams({
      jsv: '2.7.5', appKey: APP_KEY, t: t,
      sign: '0'.repeat(32),
      api: API_NAME, v: API_VERSION,
      type: 'originaljson', dataType: 'json'
    });
    const options = {
      hostname: 'h5api.m.taobao.com',
      path: `/h5/${API_NAME}/${API_VERSION}/?${params.toString()}`,
      method: 'GET',
      headers: { 'User-Agent': MOBILE_UA, 'Accept': 'application/json' }
    };
    const req = https.request(options, (res) => {
      saveCookies(res.headers['set-cookie']);
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const tkFull = cookieStore['_m_h5_tk'];
        if (tkFull && tkFull.includes('_')) {
          tokenCache = tkFull.split('_')[0];
          tokenExpireTime = Date.now() + 25 * 60 * 1000;
          resolve(tokenCache);
        } else {
          reject(new Error('Failed to obtain _m_h5_tk cookie'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Bootstrap timeout')); });
    req.end();
  });
}

function callMtop(data, retryCount = 0) {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await bootstrapToken();
      const t = Date.now().toString();
      const dataStr = JSON.stringify(data);
      const sign = md5(`${token}&${t}&${APP_KEY}&${dataStr}`);
      const params = new URLSearchParams({
        jsv: '2.7.5', appKey: APP_KEY, t: t, sign: sign,
        api: API_NAME, v: API_VERSION,
        type: 'originaljson', dataType: 'json'
      });
      const postData = `data=${encodeURIComponent(dataStr)}`;
      const cookieStr = getCookieString();
      const options = {
        hostname: 'h5api.m.taobao.com',
        path: `/h5/${API_NAME}/${API_VERSION}/?${params.toString()}`,
        method: 'POST',
        headers: {
          'User-Agent': MOBILE_UA,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Cookie': cookieStr,
          'Referer': 'https://sf.taobao.com/'
        }
      };
      const req = https.request(options, (res) => {
        saveCookies(res.headers['set-cookie']);
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            const ret0 = (json.ret || [''])[0];
            if ((ret0.includes('TOKEN_EMPTY') || ret0.includes('TOKEN_EXPIRED') ||
                 ret0.includes('Sign Error') || ret0.includes('ILLEGAL_REQUEST')) && retryCount < 1) {
              tokenCache = null;
              delete cookieStore['_m_h5_tk'];
              delete cookieStore['_m_h5_tk_enc'];
              return callMtop(data, retryCount + 1).then(resolve).catch(reject);
            }
            resolve(json);
          } catch (e) {
            reject(new Error('JSON parse error: ' + body.substring(0, 200)));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('API call timeout')); });
      req.write(postData);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

function formatItem(item) {
  const em = item.extraMap || {};
  const startPriceWan = item.displayInitialPrice ||
    (item.initialPrice ? (item.initialPrice / 1000000).toFixed(2) : '0');
  const currentPriceWan = item.displayCurrentPrice ||
    (item.currentPrice ? (item.currentPrice / 1000000).toFixed(2) : '0');
  const bailWan = em.bail ? (em.bail / 1000000).toFixed(2) : '0';
  let evalPriceWan = '';
  if (em.consulteUnitPrice && em.hArea) {
    evalPriceWan = ((em.consulteUnitPrice * em.hArea / 100) / 10000).toFixed(2);
  }
  const area = em.hArea ? (em.hArea / 100).toFixed(2) : '';
  let statusText = '即将开始', statusClass = 'upcoming';
  if (item.status === 'ongoing' || item.statusOrder === 0) {
    statusText = '正在拍卖'; statusClass = 'active';
  } else if (item.status === 'ended' || item.statusOrder === 2) {
    statusText = '已结束'; statusClass = 'ended';
  }
  const startTime = item.startTime ? new Date(item.startTime) : null;
  const endTime = item.endTime ? new Date(item.endTime) : null;
  function formatDate(d) {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  }
  let discountTag = '';
  if (item.tags && item.tags.length > 0) {
    const dt = item.tags.find(t => t.alias && t.alias.includes('低于评估价'));
    if (dt) discountTag = dt.alias;
  }
  return {
    id: item.itemId,
    title: item.title || em.reTitle || '',
    address: item.title || '',
    province: '', city: '', district: '',
    locationCode: item.locationCode,
    area: area,
    startPrice: startPriceWan,
    currentPrice: currentPriceWan,
    evalPrice: evalPriceWan,
    deposit: bailWan,
    status: statusClass,
    statusText: statusText,
    court: item.shopName || '',
    round: item.circ ? `第${item.circ}次拍卖` : '',
    category: em.fcatV4ButtomName || '',
    community: em.hCellName || '',
    startTime: formatDate(startTime),
    endTime: formatDate(endTime),
    startTimeTs: item.startTime,
    endTimeTs: item.endTime,
    bidCount: item.bidCnt || 0,
    subscribeCount: item.subscribeCnt || 0,
    viewCount: item.pv || 0,
    picUrl: item.picURL ? `https://${item.picURL}` : '',
    coordinate: item.coordinate || [],
    tags: (item.tags || []).map(t => t.alias).filter(Boolean),
    discountTag: discountTag,
    detailUrl: `https://sf-item.taobao.com/sf_item/${item.itemId}.htm`
  };
}

/**
 * 搜索司法拍卖房产
 */
async function searchJudicial({ page = 1, province = '', city = '', district = '', status = '0,1', category = '206060601' }) {
  const locationCode = resolveLocationCode(province, city, district);
  const locationCodes = locationCode ? [locationCode] : [];
  const filters = { sort: '501', statusOrders: status.split(',') };
  if (category) filters.fcatV4Ids = [category];
  if (locationCodes.length > 0) filters.locationCodes = locationCodes;
  const filtersStr = JSON.stringify(filters);
  const dfVariables = {
    page: page,
    pageSpmb: 'sf-home',
    pageSpmcs: 'searchlistsf-items',
    context: {
      '_c_searchlistsf-items': filtersStr,
      prov: province, city: city, locationCode: locationCode || '',
      userInfo: JSON.stringify({ prov: province, city: city, locationCode: locationCode || '' }),
      piPageType: 'original'
    }
  };
  const data = {
    dfApp: 'auctionwalle',
    dfApiName: 'auctionwalle.page.getScenes',
    dfVariables: JSON.stringify(dfVariables),
    dfUniqueId: 'sf-home_searchlistsf-items',
    dfVariablesRecover: '{}'
  };
  const result = await callMtop(data);
  const scenes = result?.data?.data?.scenes || [];
  const sl = scenes[0]?.schemeList?.[0] || {};
  const items = sl.contentList || [];
  const total = sl.totalCount || 0;
  const formattedItems = items.map(formatItem);
  return {
    total: total,
    page: page,
    pageSize: items.length,
    items: formattedItems,
    locationCode: locationCode
  };
}

module.exports = {
  searchJudicial,
  getAreaTree,
  resolveLocationCode
};
