const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// 🏦 خزنة الجلسات (لتخزين بيانات الكاميرا برقم PIN)
const sessionVault = {}; 

// ===============================================
// إعداد السيرفر والمسارات (HTTP Server Setup)
// ===============================================

const server = http.createServer((req, res) => {
    // إعدادات الـ CORS للسماح بالإضافة بالاتصال بحرية
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { 
        res.writeHead(204); 
        res.end(); 
        return; 
    }

    // 1. مسار الواجهة البسيط (للتأكد أن السيرفر يعمل)
    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1 style="color: #00ff9d; text-align: center; font-family: monospace; margin-top: 50px; background: #050505; padding: 20px;">🎯 SAMURAI LIVENESS SERVER IS RUNNING...</h1>');
    } 
    
    // 2. الماستر يطلب إنشاء كود PIN جديد
    else if (req.url === '/create-pin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                let pin;
                
                // توليد رقم 4 خانات عشوائي غير مستخدم حالياً ولا يساوي 0000
                do {
                    pin = Math.floor(1000 + Math.random() * 9000).toString();
                } while (sessionVault[pin] || pin === '0000');

                // حفظ البيانات في الذاكرة الحية وتدميرها بعد 5 دقائق 
                sessionVault[pin] = { payload: data.payload, createdAt: Date.now() };
                setTimeout(() => { delete sessionVault[pin]; }, 5 * 60 * 1000); 

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, pin: pin }));
                console.log(`[+] Master generated PIN: ${pin}`);
            } catch (e) {
                res.writeHead(400); 
                res.end(JSON.stringify({ success: false, error: "Bad Request" }));
            }
        });
    }
    
    // 3. الكليان يطلب فتح الجلسة باستخدام الـ PIN
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
    
    // 4. استقبال التحديثات من الكليان (عبر fetch POST) وإعادة بثها للماستر (عبر WebSocket)
    else if (req.method === 'POST' && req.url === '/') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // بث الرسالة لجميع المتصلين بالويب سوكيت (الماستر سيستقبلها)
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
            // إعادة بث الرسالة لجميع الأطراف المرتبطة
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
    console.log(`🎯 سيرفر SAMURAI LIVENESS (PIN SYSTEM) يعمل الآن بنجاح على البورت: ${PORT}`);
});
