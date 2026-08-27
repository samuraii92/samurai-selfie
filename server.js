const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// 🏦 خزنة الجلسات الحية
const sessionVault = {}; 

// توليد معرف جلسة عشوائي وقصير (مثل: 8X2F9A)
const generateSessionId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 1. الماستر يطلب إنشاء رابط الجلسة
    if (req.url === '/create-session' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const sessionId = generateSessionId();
                
                // حفظ الجلسة في الذاكرة لمدة 10 دقائق
                sessionVault[sessionId] = { payload: data.payload, createdAt: Date.now() };
                setTimeout(() => { delete sessionVault[sessionId]; }, 10 * 60 * 1000);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, session: sessionId }));
                console.log(`[+] Master Link Generated for Session: ${sessionId}`);
            } catch (e) {
                res.writeHead(400); res.end();
            }
        });
    } 
    // 2. الكليان (الإضافة) تطلب سحب البيانات برقم الجلسة
    else if (req.url.startsWith('/get-session') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = url.searchParams.get('session');

        if (sessionVault[sessionId]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, payload: sessionVault[sessionId].payload }));
            console.log(`[>] Client Extension Intercepted Data for: ${sessionId}`);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Session Expired' }));
        }
    } 
    // 3. صفحة وهمية (في حال فتح العميل الرابط ولم تكن إضافتك مفعلة لديه)
    else if (req.url.startsWith('/client')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <body style="background:#050505; color:#fff; text-align:center; font-family:sans-serif; padding-top:20vh;">
                <h1 style="color:#ff003c; font-size: 40px; letter-spacing: 2px;">⚠️ SAMURAI EXTENSION REQUIRED</h1>
                <p style="color:#94a3b8; font-size: 18px;">لم يتم العثور على إضافة الحماية في متصفحك. الرجاء تثبيتها والمحاولة مجدداً.</p>
            </body>
        `);
    } else {
        res.writeHead(404); res.end();
    }
});

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // يمكنك لاحقاً إضافة بث رسائل التزامن بين الماستر والكليان هنا
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log("🎯 سيرفر SAMURAI (MAGIC LINK) يعمل الآن على البورت: " + PORT);
});
