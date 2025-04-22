const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.static('.'));

// Redirect root to lender.html
app.get('/', (req, res) => {
  res.redirect('/lender.html');
});

// Test SMTP setup with health check
app.get('/health', async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Test Email from Render Server',
      text: 'This is a test email to validate SMTP setup.'
    });

    res.send('✅ Email sent successfully!');
  } catch (err) {
    console.error('❌ SMTP failed:', err);
    res.status(500).send(`Email error: ${err.message}`);
  }
});

const lenderEmails = JSON.parse(fs.readFileSync('./lender-emails.json', 'utf-8'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post('/send-email', upload.array('attachments'), async (req, res) => {
  const { businessName, enteredData } = req.body;
  const selectedOptions = Array.isArray(req.body.selectedOptions) ? req.body.selectedOptions : [req.body.selectedOptions];
  const files = req.files;

  const recipientMap = selectedOptions.map(name => ({ name, email: lenderEmails[name] || null }));
  const successList = recipientMap.filter(e => e.email).map(e => e.name);
  const failList = recipientMap.filter(e => !e.email).map(e => e.name);
  const ccEmails = recipientMap.map(e => e.email).filter(Boolean).join(',');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    console.log('Sending email with:', {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      cc: ccEmails,
      subject: `New Submission - ${businessName}`
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      cc: ccEmails,
      subject: `New Submission - ${businessName}`,
      text: enteredData,
      attachments: files.map(f => ({ filename: f.originalname, content: f.buffer }))
    });
  } catch (err) {
    console.error('🔥 Email failed:', err);
    return res.status(500).json({ message: 'Email failed to send.', error: err.message });
  }

  const { data: maxData } = await supabase
    .from('Live submissions')
    .select('dealid')
    .order('dealid', { ascending: false })
    .limit(1);

  const nextDealId = maxData && maxData[0]?.dealid ? maxData[0].dealid + 1 : 1;

  await supabase.from('Live submissions').insert({
    business_name: businessName,
    lender_names: selectedOptions.join(', '),
    docs: files.map(f => f.originalname).join(', '),
    message: enteredData,
    dealid: nextDealId
  });

  const statusQuery = `?success=${successList.length}&failed=${failList.join('|')}`;
  res.redirect(`/thankyou.html${statusQuery}`);
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
