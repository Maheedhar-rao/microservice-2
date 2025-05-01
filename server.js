const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser'); 
const jwt = require('jsonwebtoken');           
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cookieParser()); 

app.use(express.static(path.join(__dirname, 'public')));

function authenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    console.log('No token found');
    return res.redirect('https://login.croccrm.com/login.html');
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('Invalid token:', err.message);
      return res.redirect('https://login.croccrm.com/login.html');
    }
    req.user = decoded;
    next();
  });
}


app.get('/', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/lender.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'lender.html'));
});

app.get('/thankyou.html', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'thankyou.html'));
});


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

  const recipientMap = selectedOptions.map(name => {
    const match = lenderEmails.emails.find(e =>
      e.business_name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    return {
      name,
      email: match?.email || null
    };
  });

  const successList = recipientMap.filter(e => e.email).map(e => e.name);
  const failList = recipientMap.filter(e => !e.email).map(e => e.name);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  for (const { name, email } of recipientMap) {
    if (!email) continue;

    const parts = email.split(',').map(e => e.trim());
    const to = [parts[0], process.env.EMAIL_USER];; 
    const cc = parts.slice(1);                    

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        cc,
        subject: `New Submission - Pathway Catalyst - ${businessName}`,
        text: `${enteredData}
        ​---
This email is confidential. Please do not forward or duplicate its contents without permission.
ref: ${Math.random().toString(36).slice(2)}`,
        attachments: files.map(f => ({
          filename: f.originalname,
          content: f.buffer
        }))
      });
      await new Promise(r => setTimeout(r, 250));
      console.log(`✅ Email sent to ${to[0]} (cc: ${cc.join(', ')})`);
    } catch (error) {
      console.error(`🔥 Failed to send email to ${to[0]}:`, error);
    }
  }

  // Supabase file upload
  const BUCKET = 'Pdf docs';
  const FOLDER = 'Apps and statements';
  const uploadedFiles = [];

  for (const file of files) {
    const filePath = `${FOLDER}/${Date.now()}_${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      uploadedFiles.push(urlData.publicUrl);
    } else {
      console.error('❌ File upload failed:', uploadError);
    }
  }

  const { data: maxData, error: fetchError } = await supabase
    .from('Live submissions')
    .select('dealid')
    .order('dealid', { ascending: false })
    .limit(1);

  if (fetchError) {
    console.error('❌ Fetching max dealid failed:', fetchError);
    return res.redirect('/thankyou.html?success=0&failed=dealid');
  }

  const nextDealId = maxData && maxData[0]?.dealid ? maxData[0].dealid + 1 : 1;

  const { error: insertError, data: inserted } = await supabase.from('Live submissions').insert([{
    business_name: businessName,
    lender_names: selectedOptions.join(', '),
    docs: uploadedFiles.join(', '),
    message: enteredData,
    dealid: nextDealId,
  }]);

  if (insertError) {
    console.error('❌ DB insert failed:', insertError);
    return res.status(500).json({ message: 'DB insert failed', error: insertError.message });
  }

  console.log('✅ Supabase submission recorded:', inserted);

  const statusQuery = `?success=${successList.length}&failed=${failList.join('|')}`;
  res.redirect(`/thankyou.html${statusQuery}`);
});

app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
