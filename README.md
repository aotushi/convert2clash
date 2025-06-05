# V2ray to Clash 转换器

这是一个 Cloudflare Worker 应用，用于将 V2ray 订阅转换为 Clash 配置。支持 V2ray 和 Shadowsocks 协议的转换，特别优化了对 JustMySocks 服务的支持。

## 功能特点

- 支持 V2ray 订阅链接转换为 Clash 配置
- 支持 Shadowsocks 协议
- 支持 VMess 协议
- 自动处理 base64 编码的配置
- 支持多个节点的转换
- 自动生成 Clash 标准格式的 YAML 配置

## 使用方法

### 1. 部署到 Cloudflare Workers

1. 安装 Wrangler CLI：
   ```bash
   npm install -g wrangler
   ```

2. 登录到 Cloudflare：
   ```bash
   wrangler login
   ```

3. 部署 Worker：
   ```bash
   wrangler publish
   ```

### 2. 使用转换服务

访问转换接口：
```
https://your-worker.workers.dev/convert?url=YOUR_V2RAY_SUBSCRIPTION_URL
```

### 3. 在 Clash 中使用

1. 打开 Clash 客户端
2. 进入配置页面
3. 点击"配置"
4. 在订阅地址中填入 Worker 地址
5. 点击"更新"即可

## 配置说明

### 基础配置

```yaml
port: 7890                    # HTTP 端口
socks-port: 7891             # SOCKS5 端口
allow-lan: false             # 是否允许局域网连接
mode: rule                   # 规则模式
log-level: info             # 日志级别
external-controller: 127.0.0.1:9090  # 外部控制端口
```

### 代理组配置

默认配置包含一个代理组：
```yaml
proxy-groups:
  - name: PROXY
    type: select
    proxies: [auto]  # 自动添加所有节点
```

### 规则配置

默认规则：
```yaml
rules:
  - MATCH,PROXY  # 默认使用代理
```

## 开发说明

### 项目结构

```
convert2clash/
├── src/
│   └── index.js    # Worker 主程序
├── wrangler.toml   # Wrangler 配置文件
└── README.md       # 项目文档
```

### 核心功能

1. 配置解析
   - 支持 base64 解码
   - 支持 SS 协议解析
   - 支持 VMess 协议解析

2. 配置转换
   - JSON 到 YAML 转换
   - 自动生成代理组
   - 保持配置格式规范

3. 错误处理
   - 链接格式验证
   - 配置解析错误处理
   - 友好的错误提示

## 注意事项

1. 确保 V2ray 订阅链接可访问
2. Worker 需要部署在 Cloudflare 上
3. 建议定期更新订阅以获取最新节点
4. 如遇到解析错误，请检查订阅链接格式

## 常见问题

1. Q: 为什么转换后的配置无法使用？
   A: 请检查订阅链接是否可访问，以及格式是否正确。

2. Q: 如何添加自定义规则？
   A: 可以修改 `CLASH_TEMPLATE` 中的 `rules` 数组。

3. Q: 支持哪些协议？
   A: 目前支持 Shadowsocks 和 VMess 协议。

## 更新日志

### v1.0.0
- 初始版本发布
- 支持 SS 和 VMess 协议
- 支持 YAML 格式输出 