const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// 🏦 خزنة الجلسات (لتخزين بيانات الكاميرا برقم PIN)
const sessionVault = {}; 

// 🎯 واجهة رادار السنايبر (لعرض الضربات الناجحة 200 OK)
const dashboardHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎯 NINJA SNIPER RADAR</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&family=Tajawal:wght@400;700&display=swap');
        
        body { 
            background-color: #050505; color: #10b981; 
            font-family: 'Tajawal', sans-serif; 
            padding: 40px 20px; margin: 0;
            background-image: radial-gradient(circle at top, #0f172a 0%, #050505 100%);
            min-height: 100vh;
        }
        h1 { 
            color: #38bdf8; text-align: center; 
            padding-bottom: 10px; font-size: 28px;
            text-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
            margin-bottom: 5px;
        }
        .subtitle {
            text-align: center; color: #94a3b8; font-size: 14px; 
            margin-bottom: 40px; font-family: 'JetBrains Mono', monospace;
        }
        .log-container { display: flex; flex-direction: column; gap: 25px; max-width: 850px; margin: 0 auto; }
        .minute-group { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: slideIn 0.4s ease-out; }
        .minute-header { background: linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0) 100%); padding: 15px 20px; border-bottom: 1px solid rgba(16, 185, 129, 0.2); display: flex; justify-content: space-between; align-items: center; }
        .minute-title { font-size: 20px; font-weight: bold; color: #10b981; display: flex; align-items: center; gap: 10px; }
        .minute-title span { font-family: 'JetBrains Mono', monospace; background: #10b981; color: #050505; padding: 2px 10px; border-radius: 6px; }
        .hit-count { font-size: 13px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: bold; }
        .logs-wrapper { padding: 15px; display: grid; gap: 10px; }
        .log-card { background: rgba(0, 0, 0, 0.4); border-right: 4px solid #38bdf8; padding: 12px 20px; border-radius: 6px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s; }
        .log-card:hover { transform: translateX(-5px); background: rgba(56, 189, 248, 0.05); border-color: #10b981; }
        .log-info { display: flex; align-items: center; gap: 10px; color: #cbd5e1; font-size: 14px; }
        .time-details { display: flex; align-items: center; gap: 15px; }
        .time-badge { font-family: 'JetBrains Mono', monospace; color: #ffffff; font-size: 22px; text-shadow: 0 0 10px rgba(56, 189, 248, 0.8); letter-spacing: 1px; }
        .micro-badge { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #facc15; background: rgba(250, 204, 21, 0.1); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(250, 204, 21, 0.3); }
        .pulse { animation: pulse 1s ease-out; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(56, 189, 248, 0); } 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <h1><i class="fa-solid fa-crosshairs"></i> رادار الاختراق (200 OK)</h1>
    <div class="subtitle">Microsecond Precision Logs | NINJA HYPER-DRIVE</div>
    
    <div id="logs" class="log-container">
        <div id="waiting" style="text-align:center; color:#475569; font-family: 'Tajawal'; margin-top: 60px; font-size: 18px;">
            <i class="fa-solid fa-satellite-dish fa-spin" style="font-size: 30px; margin-bottom: 15px; display: block; color: #10b981;"></i> 
            الرادار يعمل... في انتظار رصد أول ضربة ناجحة.
        </div>
    </div>

    <script>
        const wsUrl = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host;
        let ws;
        
        function connect() {
            ws = new WebSocket(wsUrl);
            ws.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.action === 'NEW_SUCCESS_LOG') {
                    
                    const waitingMsg = document.getElementById('waiting');
                    if (waitingMsg) waitingMsg.remove();
                    
                    const timeMatch = data.time.match(/^(\\d{2}):(\\d{2}\\.\\d{3})\\s+\\(Micro:\\s+(\\d{3})\\)$/);
                    let minute = "00"; let secMs = data.time; let micro = "000";

                    if (timeMatch) { minute = timeMatch[1]; secMs = timeMatch[2]; micro = timeMatch[3]; } 
                    else {
                        const parts = data.time.split(':');
                        if (parts.length > 1) { minute = parts[0]; secMs = parts.slice(1).join(':'); }
                    }

                    const groupId = 'group-' + minute;
                    let groupEl = document.getElementById(groupId);
                    
                    if (!groupEl) {
                        groupEl = document.createElement('div'); groupEl.id = groupId; groupEl.className = 'minute-group';
                        groupEl.innerHTML = 
                            '<div class="minute-header"><div class="minute-title"><i class="fa-regular fa-clock"></i> دقيقة <span>' + minute + '</span></div><div class="hit-count" id="count-' + minute + '"><i class="fa-solid fa-bolt"></i> 0 ضربات</div></div><div class="logs-wrapper" id="wrapper-' + minute + '"></div>';
                        document.getElementById('logs').prepend(groupEl);
                    }

                    const wrapper = document.getElementById('wrapper-' + minute);
                    const logCard = document.createElement('div'); logCard.className = 'log-card pulse';
                    logCard.innerHTML = '<div class="log-info"><i class="fa-solid fa-check-double" style="color:#10b981;"></i> Slot Request</div><div class="time-details"><span class="time-badge">' + secMs + '</span>' + (micro !== "000" ? '<span class="micro-badge">μs: ' + micro + '</span>' : '') + '</div>';
                    wrapper.prepend(logCard);
                    
                    const countEl = document.getElementById('count-' + minute);
                    const hitCount = wrapper.children.length;
                    countEl.innerHTML = '<i class="fa-solid fa-bolt"></i> ' + hitCount + (hitCount === 1 ? ' ضربة' : ' ضربات');
                }
            };
            ws.onclose = () => setTimeout(connect, 2000);
        }
        connect();
    </script>
</body>
</html>`;

// ===============================================
// إعداد السيرفر والمسارات (HTTP Server Setup)
// ===============================================

const server = http.createServer((req, res) => {
    // إعدادات الـ CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 1. عرض لوحة السنايبر
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(dashboardHTML);
    } 
    // 2. السنايبر يرسل ضربة ناجحة
    else if (req.url === '/log-success' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.time) {
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ action: 'NEW_SUCCESS_LOG', time: data.time }));
                        }
                    });
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400); res.end();
            }
        });
    }
    // 3. الماستر يطلب إنشاء كود PIN جديد
    else if (req.url === '/create-pin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                let pin;
                // توليد رقم 4 خانات عشوائي غير مستخدم حالياً
                do {
                    pin = Math.floor(1000 + Math.random() * 9000).toString();
                } while (sessionVault[pin]);

                // حفظ البيانات في الذاكرة الحية وتدميرها بعد 5 دقائق
                sessionVault[pin] = { payload: data.payload, createdAt: Date.now() };
                setTimeout(() => { delete sessionVault[pin]; }, 5 * 60 * 1000); 

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, pin: pin }));
                console.log(`[+] Master generated PIN: ${pin}`);
            } catch (e) {
                res.writeHead(400); res.end();
            }
        });
    }
    // 4. الكليان يطلب فتح الجلسة باستخدام الـ PIN
    else if (req.url.startsWith('/join-pin') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pin = url.searchParams.get('pin');

        // 🧪 ----- وضع الاختبار (0000 TEST MODE) ----- 🧪
        if (pin === '0000') {
            const testPayload = {
                user_id: "TEST_USER_9999",
                transaction_id: "TEST_TRANS_9999",
                ip_address: "127.0.0.1",
                plugin_liveness_url: "https://web-sdk.prod.cdn.spain.ozforensics.com/blsinternational/plugin_liveness.php",
                challenge_url: "https://www.blsspainmorocco.net/MAR/appointment/livenessrequest",
                selfie_code: "0000",
                check_id: "TEST_CHECK_9999"
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, payload: testPayload }));
            console.log(`[🧪 TEST MODE] Client successfully joined using TEST PIN: 0000`);
            return;
        }

        // 🔒 ----- البحث في الجلسات الحقيقية ----- 🔒
        if (sessionVault[pin]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, payload: sessionVault[pin].payload }));
            console.log(`[>] Client successfully joined using PIN: ${pin}`);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'الكود غير صحيح أو انتهت صلاحيته' }));
        }
    }
    // مسار تبادل التحديثات للكاميرا (إذا تم إرسالها للرابط المباشر)
    else if (req.method === 'POST' && req.url === '/') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // تبث الرسالة للجميع (من الممكن تحديد الجلسة لاحقاً)
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400); res.end();
            }
        });
    }
    else {
        res.writeHead(404); res.end();
    }
});

// ===============================================
// إعداد سيرفر الويب سوكيت (WebSocket Server)
// ===============================================
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // إعادة بث الرسالة لجميع الأطراف المرتبطة بنفس الجلسة
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (e) {
            console.error("WebSocket Message Error:", e);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎯 سيرفر SAMURAI COMMAND CENTER يعمل الآن بنجاح على البورت: ${PORT}`);
});
