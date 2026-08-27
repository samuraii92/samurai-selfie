const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// 🏦 خزنة الجلسات (تخزن البيانات في الذاكرة الحية)
const sessionVault = {}; 

const server = http.createServer((req, res) => {
    // تفعيل الـ CORS ليسمح للإضافات بالاتصال
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 1. الماستر يطلب إنشاء كود (Create Session)
    if (req.url === '/create-pin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                let pin;
                // توليد كود من 4 أرقام غير مكرر
                do {
                    pin = Math.floor(1000 + Math.random() * 9000).toString();
                } while (sessionVault[pin]);

                // حفظ بيانات الماستر وربطها بالكود (صالح لـ 5 دقائق فقط للأمان)
                sessionVault[pin] = { payload: data.payload, createdAt: Date.now() };
                setTimeout(() => { delete sessionVault[pin]; }, 5 * 60 * 1000); // تدمير ذاتي

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, pin: pin }));
                console.log(`[+] Master generated PIN: ${pin}`);
            } catch (e) {
                res.writeHead(400); res.end();
            }
        });
    } 
    // 2. الكليان يطلب فتح الجلسة باستخدام الكود (Join Session)
    else if (req.url.startsWith('/join-pin') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pin = url.searchParams.get('pin');

        // 🧪 ================= وضع التيست (TEST MODE) ================= 🧪
        if (pin === '0000') {
            // توليد بيانات وهمية تماماً، لكن نستخدم رابط SDK الحقيقي لكي تفتح الكاميرا بنجاح
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
            return; // إنهاء التنفيذ لكي لا يكمل البحث في الخزنة الحقيقية
        }
        // =============================================================

        // البحث في الجلسات الحقيقية
        if (sessionVault[pin]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, payload: sessionVault[pin].payload }));
            console.log(`[>] Client successfully joined using PIN: ${pin}`);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'الكود غير صحيح أو انتهت صلاحيته' }));
        }
    } else {
        res.writeHead(404); res.end();
    }
});

// إعداد الـ WebSocket للتواصل اللحظي
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // إذا أردت بث رسائل الويب سوكيت بين الكليان والماستر
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log("🎯 سيرفر SAMURAI (PIN SYSTEM) يعمل الآن على البورت: " + PORT);
});
