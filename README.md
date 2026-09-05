# 法拍房信息查询工具 - Vercel 一键部署版

实时从阿里拍卖获取司法拍卖房产数据，支持按地区、时间、状态等多维度筛选。部署后得到公开网址，分享给朋友即可使用。

---

## 🚀 快速部署（约3分钟，零代码基础）

### 第一步：注册 GitHub 账号（如已有可跳过）

1. 打开 https://github.com
2. 点击右上角「Sign up」注册账号
3. 用邮箱注册，设置用户名和密码
4. 注册完成后登录

### 第二步：创建新仓库并上传代码

1. 登录 GitHub 后，点击右上角「+」→「New repository」
2. Repository name 填写：`fapai-tool`（或任意你喜欢的名字）
3. 选择「Public」（公开，Vercel免费版需要）
4. 勾选「Add a README file」
5. 点击「Create repository」
6. 创建完成后，点击「Add file」→「Upload files」
7. 把本项目的所有文件和文件夹拖拽上传（包括 api/、lib/、public/、package.json、vercel.json）
8. 点击底部「Commit changes」

### 第三步：注册 Vercel 账号

1. 打开 https://vercel.com
2. 点击「Sign Up」→ 选择「Continue with GitHub」
3. 授权 Vercel 访问你的 GitHub 账号
4. 注册完成后进入 Vercel 控制台

### 第四步：导入项目并部署

1. 在 Vercel 控制台，点击「Add New...」→「Project」
2. 在「Import Git Repository」中找到你刚创建的 `fapai-tool` 仓库
3. 点击「Import」
4. 配置页面保持默认即可，直接点击「Deploy」
5. 等待约1-2分钟，部署完成后会显示祝贺页面

### 第五步：获取公开网址并分享

1. 部署完成后，点击「Continue to Dashboard」
2. 在项目概览页面可以看到你的网址，格式如：`https://fapai-tool.vercel.app`
3. 把这个网址分享给朋友，他们打开就能直接使用！

---

## 📱 使用方法

1. 打开部署后的网址
2. 选择省份、城市、区县（如：上海市 → 上海市 → 闵行区）
3. 选择房产类型（住宅用房/别墅/商铺/全部）
4. 选择拍卖状态和时间范围
5. 点击「查询并加载数据」
6. 查看表格中的法拍房信息，点击「详情」查看完整信息
7. 点击「去竞拍」跳转到阿里拍卖原始页面
8. 如需更多数据，点击「加载更多」

---

## 💰 费用说明

- **Vercel 个人版完全免费**
- 免费额度：每月 100GB 带宽、1000 次 Serverless 函数调用、6000 次构建分钟数
- 对于法拍房中介日常使用完全足够
- 如超出额度，Vercel会提醒，不会自动扣费

---

## 🔧 本地测试（可选）

如果你想在自己电脑上先测试再部署：

```bash
# 安装依赖
npm install express

# 启动本地服务器
node local-server.js

# 浏览器访问 http://localhost:3000
```

---

## 📊 数据来源

数据实时来自阿里拍卖（淘宝司法拍卖）平台：
- 官网：https://sf.taobao.com
- 通过阿里H5 mtop API获取，与移动端数据一致
- 拍卖列表数据为公开信息，无需登录

---

## ⚠️ 注意事项

1. 阿里API每页返回10条数据，点击「加载更多」获取后续页面
2. 时间范围、关键词、价格、面积筛选在已加载数据上本地过滤
3. 如遇数据获取失败，刷新页面重试即可
4. 本工具仅用于数据查询和整理，竞拍操作请在阿里拍卖官方平台完成
5. 数据仅供参考，具体以阿里拍卖官方公告为准

---

## 🆘 常见问题

**Q: 部署后打开网址显示错误怎么办？**
A: 检查是否所有文件都上传到了GitHub，特别是 api/、lib/、public/ 文件夹和 vercel.json 文件。

**Q: 朋友打不开网址怎么办？**
A: Vercel部署的网址是公开的，任何人都能访问。如果打不开，可能是网络问题，建议换个网络试试。

**Q: 数据加载很慢怎么办？**
A: 数据从阿里拍卖实时获取，首次加载可能需要2-5秒，请耐心等待。

**Q: 可以修改网站名字吗？**
A: 可以。在Vercel项目设置中可以修改域名，也可以绑定自己的域名。

---

## 📁 项目结构

```
fapai-tool/
├── api/                    # Serverless API函数
│   ├── search.js          # 搜索法拍房API
│   └── areas.js           # 获取地区列表API
├── lib/                    # 公共库
│   ├── ali-client.js      # 阿里拍卖API客户端
│   └── gb2260.json        # 地区编码数据
├── public/                 # 前端静态文件
│   └── index.html         # 主页面
├── package.json            # 项目配置
├── vercel.json             # Vercel部署配置
├── local-server.js         # 本地测试服务器
└── README.md               # 说明文档
```
