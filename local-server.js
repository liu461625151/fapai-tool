/**
 * 本地测试服务器
 * 运行: node local-server.js
 * 访问: http://localhost:3000
 */

const express = require('express');
const path = require('path');
const searchHandler = require('./api/search');
const areasHandler = require('./api/areas');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/search', (req, res) => searchHandler(req, res));
app.get('/api/areas', (req, res) => areasHandler(req, res));

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  法拍房信息查询工具（本地测试版）');
  console.log('  访问地址: http://localhost:' + PORT);
  console.log('  数据来源: 阿里拍卖 (sf.taobao.com)');
  console.log('========================================');
});
