import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { promises as dns } from 'dns';
import { Resend } from 'resend';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Middleware for parsing JSON request bodies
app.use(express.json({ limit: '2mb' }));

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_XiUfBYg4_XrrGfKsN3yxXGcLwcGjxPhqx';
const TARGET_EMAIL = 'reckd.007@gmail.com';
const resend = new Resend(RESEND_API_KEY);

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Resend Email Endpoint
app.post('/api/contact', async (req: Request, res: Response) => {
  try {
    const { name, email, topic, subject, message } = req.body || {};

    const cleanName = typeof name === 'string' && name.trim() ? name.trim() : 'Anonymous User';
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    const cleanTopic = typeof topic === 'string' && topic.trim() ? topic.trim() : (typeof subject === 'string' && subject.trim() ? subject.trim() : 'General Inquiry');
    const cleanMessage = typeof message === 'string' ? message.trim() : '';

    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!cleanMessage) {
      return res.status(400).json({ success: false, error: 'Message content cannot be empty.' });
    }

    if (cleanMessage.length > 3000) {
      return res.status(400).json({ success: false, error: 'Message exceeds maximum length of 3000 characters.' });
    }

    const submissionTime = new Date().toUTCString();
    const safeName = escapeHtml(cleanName);
    const safeEmail = escapeHtml(cleanEmail);
    const safeTopic = escapeHtml(cleanTopic);
    const safeMessage = escapeHtml(cleanMessage);

    const emailSubject = `[Reckd] ${cleanTopic}: from ${cleanName}`;

    const textBody = `[Reckd Contact Form Submission]
--------------------------------------------------
Sender Name:  ${cleanName}
Email:        ${cleanEmail}
Inquiry Type: ${cleanTopic}
Submitted At: ${submissionTime}

Message:
${cleanMessage}

--------------------------------------------------
Reply directly to this email to contact ${cleanName} (${cleanEmail}).
`;

    const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0a09; color: #f4f4f5; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.6); }
    .header { background: #1c1917; border-bottom: 1px solid #27272a; padding: 24px 28px; }
    .badge { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 9999px; background: rgba(255, 107, 0, 0.15); color: #ff6b00; border: 1px solid rgba(255, 107, 0, 0.3); }
    .title { font-size: 20px; font-weight: 800; color: #ffffff; margin: 12px 0 4px 0; }
    .subtitle { font-size: 13px; color: #a1a1aa; margin: 0; }
    .body-content { padding: 28px; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table td { padding: 9px 0; font-size: 13px; vertical-align: top; border-bottom: 1px solid #27272a; }
    .table-lbl { color: #71717a; width: 130px; font-weight: 600; }
    .table-val { color: #f4f4f5; font-weight: 500; }
    .table-val a { color: #ff6b00; text-decoration: none; }
    .msg-title { font-size: 12px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .msg-box { background: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 18px; font-size: 14px; line-height: 1.65; color: #e4e4e7; white-space: pre-wrap; word-break: break-word; }
    .action-row { margin-top: 24px; }
    .reply-btn { display: inline-block; padding: 11px 22px; background: #ff6b00; color: #ffffff; font-weight: 700; font-size: 13px; text-decoration: none; border-radius: 10px; }
    .footer { padding: 16px 28px; background: #09090b; border-top: 1px solid #27272a; font-size: 11px; color: #71717a; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Reckd Platform</span>
      <h1 class="title">New Contact Submission</h1>
      <p class="subtitle">A visitor sent a message through Reckd's Contact Us portal.</p>
    </div>
    <div class="body-content">
      <table class="table">
        <tr>
          <td class="table-lbl">From Name:</td>
          <td class="table-val">${safeName}</td>
        </tr>
        <tr>
          <td class="table-lbl">Email Address:</td>
          <td class="table-val"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
        </tr>
        <tr>
          <td class="table-lbl">Inquiry Topic:</td>
          <td class="table-val"><strong style="color: #ff8533;">${safeTopic}</strong></td>
        </tr>
        <tr>
          <td class="table-lbl">Timestamp:</td>
          <td class="table-val">${submissionTime}</td>
        </tr>
      </table>

      <div class="msg-title">User Message</div>
      <div class="msg-box">${safeMessage}</div>

      <div class="action-row">
        <a href="mailto:${safeEmail}?subject=Re:%20${encodeURIComponent(emailSubject)}" class="reply-btn">
          Reply to ${safeName}
        </a>
      </div>
    </div>
    <div class="footer">
      Sent to <strong>${TARGET_EMAIL}</strong> via Resend integration.
    </div>
  </div>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: 'Reckd <onboarding@resend.dev>',
      to: [TARGET_EMAIL],
      replyTo: cleanEmail,
      subject: emailSubject,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      console.error('[Resend Error]:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to dispatch email via Resend.',
      });
    }

    return res.status(200).json({
      success: true,
      messageId: data?.id,
      message: 'Email delivered successfully to reckd.007@gmail.com',
    });
  } catch (err: any) {
    console.error('[Server Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An unexpected server error occurred.',
    });
  }
});

// Alias for convenience
app.post('/api/send-email', (req, res) => {
  // redirect or forward to contact handler
  (app as any)._router.handle({ ...req, url: '/api/contact' }, res);
});

// 3. Website Detector endpoint
app.post('/api/detect-website', async (req: Request, res: Response) => {
  try {
    const { url } = req.body || {};
    let targetUrl = (url || '').trim();
    if (!targetUrl) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const parsedUrl = new URL(targetUrl);
    const hostname = parsedUrl.hostname;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const [fetchResult, ipv6Result, txtResult, dmarcResult] = await Promise.allSettled([
      fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 AI-Detector/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      }),
      dns.resolve6(hostname).catch(() => [] as string[]),
      dns.resolveTxt(hostname).catch(() => [] as string[][]),
      dns.resolveTxt(`_dmarc.${hostname}`).catch(() => [] as string[][]),
    ]);
    clearTimeout(timeoutId);

    if (fetchResult.status !== 'fulfilled') {
      throw fetchResult.reason;
    }

    const response = fetchResult.value;
    const text = await response.text();
    const headersObj: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      headersObj[key.toLowerCase()] = val;
    });

    const ipv6Addrs = ipv6Result.status === 'fulfilled' ? ipv6Result.value : [];
    const txtRecords = txtResult.status === 'fulfilled' ? txtResult.value.flat() : [];
    const dmarcRecords = dmarcResult.status === 'fulfilled' ? dmarcResult.value.flat() : [];

    const spfRecord =
      txtRecords.find((r) => typeof r === 'string' && r.toLowerCase().startsWith('v=spf1')) || null;
    const dmarcRecord =
      dmarcRecords.find((r) => typeof r === 'string' && r.toLowerCase().startsWith('v=dmarc1')) || null;

    return res.status(200).json({
      success: true,
      status: response.status,
      finalUrl: response.url,
      headers: headersObj,
      dns: {
        hasIpv6: Array.isArray(ipv6Addrs) && ipv6Addrs.length > 0,
        ipv6Count: Array.isArray(ipv6Addrs) ? ipv6Addrs.length : 0,
        hasSpf: !!spfRecord,
        spf: spfRecord,
        hasDmarc: !!dmarcRecord,
        dmarc: dmarcRecord,
      },
      html: text.slice(0, 1500000),
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: err.message || 'Failed to fetch target website',
    });
  }
});

// ----------------------------------------------------
// VITE OR STATIC SERVING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
