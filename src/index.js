/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// 基础 Clash 配置模板
const CLASH_TEMPLATE = {
	port: 7890,
	socks_port: 7891,
	allow_lan: false,
	mode: "rule",
	log_level: "info",
	external_controller: "127.0.0.1:9090",
	proxies: [],
	proxy_groups: [
		{
			name: "PROXY",
			type: "select",
			proxies: ["auto"]
		}
	],
	rules: [
		"MATCH,PROXY"
	]
};

// 解析 base64 编码的配置
function parseBase64Config(base64Str) {
	try {
		const decoded = atob(base64Str);
		return decoded;
	} catch (error) {
		throw new Error(`解析配置失败: ${error.message}`);
	}
}

// 解析 SS 链接（兼容 justmysocks）
function parseSSLink(ssLink) {
	try {
		ssLink = ssLink.trim().replace(/^['"]|['"]$/g, '');
		// ss://base64(method:password@host:port)#name
		const main = ssLink.replace('ss://', '').split('#');
		const base64Part = main[0];
		const name = main[1] ? decodeURIComponent(main[1]) : 'SS';
		const decoded = atob(base64Part);
		// decoded: method:password@host:port
		const match = decoded.match(/^(.+?):(.+)@(.+):(\d+)$/);
		if (!match) {
			console.log('SS 链接内容格式不匹配:', decoded);
			return null;
		}
		const [_, method, password, host, port] = match;
		return {
			name,
			type: "ss",
			server: host,
			port: parseInt(port),
			cipher: method,
			password: password,
			udp: true
		};
	} catch (error) {
		console.error('解析 SS 链接失败:', error);
		return null;
	}
}

// 解析 VMess 链接（justmysocks）
function parseVMessLink(vmessLink) {
	try {
		vmessLink = vmessLink.trim().replace(/^['"]|['"]$/g, '');
		// vmess://base64(json)
		const base64Part = vmessLink.replace('vmess://', '');
		const decoded = atob(base64Part);
		const config = JSON.parse(decoded);
		return {
			name: config.ps || config.add,
			type: "vmess",
			server: config.add,
			port: parseInt(config.port),
			uuid: config.id,
			alterId: config.aid || 0,
			cipher: "auto",
			udp: true
		};
	} catch (error) {
		console.error('解析 VMess 链接失败:', error);
		return null;
	}
}

// 转换配置
function convertToClash(content) {
	const clashConfig = { ...CLASH_TEMPLATE };
	const proxies = [];
	const lines = content.split('\n')
		.map(line => line.trim())
		.filter(line => line && !line.startsWith('//'));
	
	console.log('解析到的行数:', lines.length);
	console.log('解析到的内容:', lines);
	
	for (const line of lines) {
		let proxy = null;
		if (line.startsWith('ss://')) {
			console.log('处理 SS 链接:', line);
			proxy = parseSSLink(line);
		} else if (line.startsWith('vmess://')) {
			console.log('处理 VMess 链接:', line);
			proxy = parseVMessLink(line);
		}
		if (proxy) {
			console.log('成功解析节点:', proxy);
			proxies.push(proxy);
		}
	}
	
	if (proxies.length > 0) {
		clashConfig.proxies = proxies;
		clashConfig.proxy_groups[0].proxies = proxies.map(p => p.name);
	} else {
		console.log('没有成功解析任何节点');
	}
	
	return clashConfig;
}

// 将 JSON 转换为 YAML
function jsonToYaml(json) {
	const yaml = [];
	
	// 基本配置
	yaml.push(`port: ${json.port}`);
	yaml.push(`socks-port: ${json.socks_port}`);
	yaml.push(`allow-lan: ${json.allow_lan}`);
	yaml.push(`mode: ${json.mode}`);
	yaml.push(`log-level: ${json.log_level}`);
	yaml.push(`external-controller: ${json.external_controller}`);
	yaml.push('');
	
	// 代理配置
	yaml.push('proxies:');
	for (const proxy of json.proxies) {
		yaml.push('  - name: ' + proxy.name);
		yaml.push('    type: ' + proxy.type);
		yaml.push('    server: ' + proxy.server);
		yaml.push('    port: ' + proxy.port);
		if (proxy.type === 'ss') {
			yaml.push('    cipher: ' + proxy.cipher);
			yaml.push('    password: ' + proxy.password);
		} else if (proxy.type === 'vmess') {
			yaml.push('    uuid: ' + proxy.uuid);
			yaml.push('    alterId: ' + proxy.alterId);
			yaml.push('    cipher: ' + proxy.cipher);
		}
		yaml.push('    udp: ' + proxy.udp);
		yaml.push('');
	}
	
	// 代理组配置
	yaml.push('proxy-groups:');
	for (const group of json.proxy_groups) {
		yaml.push('  - name: ' + group.name);
		yaml.push('    type: ' + group.type);
		yaml.push('    proxies:');
		for (const proxy of group.proxies) {
			yaml.push('      - ' + proxy);
		}
		yaml.push('');
	}
	
	// 规则配置
	yaml.push('rules:');
	for (const rule of json.rules) {
		yaml.push('  - ' + rule);
	}
	
	return yaml.join('\n');
}

// 处理订阅链接
async function handleSubscription(url) {
	try {
		console.log('开始获取订阅内容:', url);
		const response = await fetch(url);
		const content = await response.text();
		console.log('获取到的原始内容:', content);
		
		// 尝试解析 base64 编码的内容
		let v2rayConfig;
		try {
			v2rayConfig = parseBase64Config(content);
			console.log('Base64 解码后的内容:', v2rayConfig);
		} catch (e) {
			console.log('Base64 解码失败，使用原始内容');
			v2rayConfig = content;
		}
		
		const clashConfig = convertToClash(v2rayConfig);
		console.log('转换后的 Clash 配置:', JSON.stringify(clashConfig, null, 2));
		
		const yamlConfig = jsonToYaml(clashConfig);
		console.log('最终的 YAML 配置:', yamlConfig);
		
		return new Response(yamlConfig, {
			headers: {
				'content-type': 'text/yaml;charset=UTF-8',
			},
		});
	} catch (error) {
		console.error('处理订阅时出错:', error);
		return new Response(`Error: ${error.message}`, { status: 500 });
	}
}

addEventListener('fetch', event => {
	event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
	const url = new URL(request.url)
	const targetUrl = url.searchParams.get('url')
	
	if (!targetUrl) {
		return new Response('请提供订阅链接，例如：?url=你的订阅链接', {
			status: 400,
			headers: {
				'content-type': 'text/plain;charset=UTF-8'
			}
		})
	}

	try {
		console.log('开始处理请求，目标URL:', targetUrl)
		return await handleSubscription(targetUrl)
	} catch (error) {
		console.error('处理请求时出错:', error)
		return new Response(`Error: ${error.message}`, { status: 500 })
	}
}
