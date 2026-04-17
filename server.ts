import express, { Request, Response } from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import axios from 'axios';
import { getAIResponse } from './src/services/geminiService';
import admin from 'firebase-admin';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
    // Initialize Firebase Admin 
    initializeApp();
    const db = getFirestore();

    const app = express();
    app.use(express.json());

    // --- API Routes FIRST ---
    const META_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    // 1. WhatsApp Webhook Verification (Meta)
    app.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
        if (req.query['hub.verify_token'] === META_VERIFY_TOKEN) {
            return res.send(req.query['hub.challenge']);
        }
        res.sendStatus(403);
    });

    // 2. Main Webhook Endpoint
    app.post('/api/whatsapp/webhook', async (req: Request, res: Response) => {
        const entry = req.body.entry[0];
        const changes = entry.changes[0].value;
        const recipientNumber = changes.metadata.display_phone_number;
        const message = changes.messages[0].text.body;
        const sender = changes.messages[0].from;

        try {
            const restSnap = await db.collection('restaurants')
                .where('whatsappNumber', '==', recipientNumber)
                .limit(1).get();

            if (restSnap.empty) return res.sendStatus(404);
            const restaurant = { id: restSnap.docs[0].id, ...restSnap.docs[0].data() };

            const menuSnap = await db.collection('restaurants').doc(restaurant.id).collection('menu_items').get();
            const menu = menuSnap.docs.map(d => ({id: d.id, ...d.data()}));

            const responseText = await getAIResponse(restaurant as any, menu as any, [], [], "", [{ role: 'user', text: message }]);

            // 3. Send back via WhatsApp API
            await sendWhatsAppMessage(restaurant.whatsappApiKey, sender, responseText, responseText.includes('[SHOW_MENU_BUTTON]'));
            
            res.sendStatus(200);
        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    });

    // --- Vite Middleware for Development ---
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    const PORT = parseInt(process.env.PORT || '3000', 10);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`SaaS Hybrid Server running on http://0.0.0.0:${PORT}`);
    });
}

// WhatsApp API Sender Helper
async function sendWhatsAppMessage(apiKey: string, to: string, text: string, showButton: boolean) {
    const url = `https://graph.facebook.com/v21.0/me/messages`;
    const payload = showButton ? {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: text.replace('[SHOW_MENU_BUTTON]', '') },
            action: {
                buttons: [{ type: 'reply', reply: { id: 'view_menu', title: '🍽️ View Digital Menu' } }]
            }
        }
    } : {
        messaging_product: 'whatsapp',
        to,
        text: { body: text }
    };

    await axios.post(url, payload, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
}

startServer();
