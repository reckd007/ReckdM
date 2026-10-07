import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { promises as dns } from 'dns';
import { Resend } from 'resend';
import { defineConfig, Plugin } from 'vite';

function websiteDetectorPlugin(): Plugin {
  return {
    name: 'website-detector-api',
    configureServer(server) {
      server.middlewares.use('/api/contact', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const reqData = JSON.parse(body || '{}');
            const cleanName = typeof reqData.name === 'string' && reqData.name.trim() ? reqData.name.trim() : 'Anonymous User';
            const cleanEmail = typeof reqData.email === 'string' ? reqData.email.trim() : '';
            const cleanTopic = typeof reqData.topic === 'string' && reqData.topic.trim() ? reqData.topic.trim() : (typeof reqData.subject === 'string' && reqData.subject.trim() ? reqData.subject.trim() : 'General Inquiry');
            const cleanMessage = typeof reqData.message === 'string' ? reqData.message.trim() : '';

            if (!cleanEmail) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Email address is required.' }));
              return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(cleanEmail)) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Please provide a valid email address.' }));
              return;
            }

            if (!cleanMessage) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Message content cannot be empty.' }));
              return;
            }

            const resendApiKey = process.env.RESEND_API_KEY || 're_XiUfBYg4_XrrGfKsN3yxXGcLwcGjxPhqx';
            const resend = new Resend(resendApiKey);

            const emailSubject = `[Reckd] ${cleanTopic}: from ${cleanName}`;
            const submissionTime = new Date().toUTCString();

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

            const escapeH = (s: string) =>
              String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

            const htmlBody = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0c0a09;color:#f4f4f5;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:16px;padding:24px;">
    <div style="font-size:12px;color:#ff6b00;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Reckd Contact Portal</div>
    <h2 style="color:#ffffff;margin:8px 0 16px;">New Message from ${escapeH(cleanName)}</h2>
    <p style="font-size:13px;color:#a1a1aa;margin:4px 0;"><strong>Sender:</strong> ${escapeH(cleanName)} &lt;${escapeH(cleanEmail)}&gt;</p>
    <p style="font-size:13px;color:#a1a1aa;margin:4px 0;"><strong>Inquiry Type:</strong> <span style="color:#ff8533;">${escapeH(cleanTopic)}</span></p>
    <p style="font-size:13px;color:#a1a1aa;margin:4px 0;"><strong>Submitted:</strong> ${submissionTime}</p>
    <div style="margin:20px 0;padding:16px;background:#09090b;border:1px solid #27272a;border-radius:12px;font-size:14px;line-height:1.6;color:#e4e4e7;white-space:pre-wrap;">${escapeH(cleanMessage)}</div>
    <a href="mailto:${escapeH(cleanEmail)}?subject=Re:%20${encodeURIComponent(emailSubject)}" style="display:inline-block;padding:10px 20px;background:#ff6b00;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;">Reply to ${escapeH(cleanName)}</a>
  </div>
</body>
</html>`;

            const { data, error } = await resend.emails.send({
              from: 'Reckd <onboarding@resend.dev>',
              to: ['reckd.007@gmail.com'],
              replyTo: cleanEmail,
              subject: emailSubject,
              text: textBody,
              html: htmlBody,
            });

            if (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: error.message || 'Failed to send email via Resend' }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, messageId: data?.id }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message || 'Internal server error' }));
          }
        });
      });

      server.middlewares.use('/api/detect-website', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            let targetUrl = (data.url || '').trim();
            if (!targetUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'URL is required' }));
              return;
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
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 AI-Detector/1.0',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

            // DNS facts
            const ipv6Addrs = ipv6Result.status === 'fulfilled' ? ipv6Result.value : [];
            const txtRecords = txtResult.status === 'fulfilled' ? txtResult.value.flat() : [];
            const dmarcRecords = dmarcResult.status === 'fulfilled' ? dmarcResult.value.flat() : [];

            const spfRecord = txtRecords.find((r) => typeof r === 'string' && r.toLowerCase().startsWith('v=spf1')) || null;
            const dmarcRecord = dmarcRecords.find((r) => typeof r === 'string' && r.toLowerCase().startsWith('v=dmarc1')) || null;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
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
              })
            );
          } catch (err: any) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: err.message || 'Failed to fetch target website',
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), websiteDetectorPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
