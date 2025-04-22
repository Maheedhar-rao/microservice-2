const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve index.html at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const upload = multer({ storage: multer.memoryStorage() });

const lenderEmails = JSON.parse(fs.readFileSync('./lender-emails.json', 'utf-8'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const sendEmail = async (to, options) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    ...options
  });
};

app.post('/send-email', upload.array('attachments', 25), async (req, res) => {
  try {
    const { businessName, enteredData, selectedOptions } = req.body;
    const userEmail = process.env.EMAIL_USER;
    const selectedLenders = Array.isArray(selectedOptions) ? selectedOptions : [selectedOptions];

    let uploadedFiles = [];
    for (let file of req.files) {
      const filePath = `submissions/${Date.now()}_${file.originalname}`;
      const { error } = await supabase.storage
        .from('Pdf docs/Apps and statements')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) return res.status(500).json({ message: 'Upload failed', error });

      const fileUrl = supabase.storage.from('Pdf docs/Apps and statements').getPublicUrl(filePath);
      uploadedFiles.push({ name: file.originalname, path: fileUrl.publicURL });
    }

    const fileLinks = uploadedFiles.map(f => f.path);

    const { error: insertError } = await supabase
      .from('Live submissions')
      .insert([{
        user_email: userEmail,
        business_name: businessName,
        lender_names: selectedLenders.join(', '),
        lenders_sent_to: selectedLenders,
        docs: fileLinks.join(', '),
        message: enteredData,
        status: 'pending',
        reply_progress: `0/${selectedLenders.length}`
      }]);

    if (insertError) return res.status(500).json({ message: 'Error saving to DB', error: insertError });

    const sendEmailPromises = selectedLenders.map(key => {
      const config = lenderEmails[key];
      if (!config) return;

      return sendEmail(config.to, {
        cc: config.cc,
        subject: `Croc Submissions - Client Name - ${businessName}`,
        text: `${enteredData}\n\nStips Attached:\n${uploadedFiles.map(f => f.name).join('\n')}`,
        attachments: req.files.map(file => ({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype
        }))
      });
    });

    await Promise.all(sendEmailPromises);
    res.json({ message: "Submission successful!" });
  } catch (err) {
    console.error("Error in submission flow:", err);
    res.status(500).json({ message: 'Unexpected error', error: err });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
