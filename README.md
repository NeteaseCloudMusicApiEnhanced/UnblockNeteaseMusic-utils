# unblockmusic-utils
⚙️A unlock music tool for NeteaseCloudMusicApiEnhanced

## 简介

unblockmusic-utils 是一个用于解锁网易云音乐内容的 API 项目，使用 Express.js 构建，旨在帮助用户绕过地理限制和版权限制，获取更多的音乐资源。

## 功能特性

- 基于 Express.js 的 RESTful API 服务
- 自动尝试多个音源直到找到可用的音乐链接
- 支持 npx 直接运行

## 安装

```bash
# 克隆项目
git clone https://github.com/NeteaseCloudMusicApiEhanced/unblockmusic-utils.git
cd unblockmusic-utils

# 安装依赖
npm install
# 或者使用 pnpm
pnpm install
```

## 使用方法

### 1. 直接运行

```bash
# 使用 npm
npm start

# 使用 pnpm
pnpm start

# 使用 yarn
yarn start
```

### 2. 使用 npx 直接运行（无需安装）

```bash
# 使用默认端口 3000
npx @neteasecloudmusicapienhanced/unblockmusic-utils

# 指定端口
npx @neteasecloudmusicapienhanced/unblockmusic-utils --port 8080

# 显示帮助信息
npx @neteasecloudmusicapienhanced/unblockmusic-utils --help
```

### 3. 开发模式

```bash
# 使用 nodemon 监听文件变化
npm run dev
```

### 4. 作为模块使用

```javascript
const { matchID } = require('@neteasecloudmusicapienhanced/unblockmusic-utils');

// 匹配歌曲 ID
const result = await matchID('歌曲ID', '音源模块名（可选）');
```

## API 接口

### GET /match

获取音乐链接。

参数:
- `id` (必需) - 网易云音乐歌曲 ID
- `source` (可选) - 指定音源模块名称

示例:
```
GET /match?id=123456
GET /match?id=123456&source=cenguigui
```

### POST /match

获取音乐链接（POST 方式）。

参数:
- `id` (必需) - 网易云音乐歌曲 ID
- `source` (可选) - 指定音源模块名称

示例:
```json
{
  "id": "123456",
  "source": "cenguigui"
}
```

### GET /

获取服务器信息和可用端点。

## 音源模块

当前支持以下音源模块：

- **cenguigui** - `https://music.cenguigui.cn/`
- **gdmusic** - `https://music-api.gdstudio.xyz/`
- **qijieya** - `https://api.qijieya.cn/`

系统会自动尝试所有可用模块，直到找到可用的音乐链接。

## 命令行选项

- `--port, -p <端口号>` - 指定服务器端口 (默认: 3000)
- `--help, -h` - 显示帮助信息

## 日志系统

本项目使用彩色日志系统，包含以下日志级别：

- `[INFO]` - 绿色，一般信息
- `[ERROR]` - 红色，错误信息
- `[WARN]` - 黄色，警告信息
- `[DEBUG]` - 蓝色，调试信息

## 环境变量

- `PORT` - 指定服务器端口 (默认: 3000)

## 许可证

MIT