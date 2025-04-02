const express = require('express');
const bodyParser = require('body-parser');
const pdf = require('html-pdf');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;

// Middleware
app.use(bodyParser.text({ type: '*/*', limit: '10mb' })); // recebe o HTML como texto
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs'))); // servir os PDFs via URL
app.use('/b', express.static(path.join(__dirname, 'b'))); // servir os PDFs via URL

// Garante que a pasta exista
const pdfDir = path.join(__dirname, 'pdfs');
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir);

// Rota principal
app.post('/gerar-pdf', async (req, res) => {
  const html = req.body;

  if (!html) {
    return res.status(400).json({ erro: 'HTML não enviado no corpo da requisição' });
  }

  const nomeArquivo = `boleto-${Date.now()}.pdf`;
  const caminhoArquivo = path.join(pdfDir, nomeArquivo);

  const options = {
    format: 'A4',
    printBackground: true,
    border: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm',
    },
    timeout: 30000,
  };

  pdf.create(html, options).toFile(caminhoArquivo, (err, result) => {
    if (err) {
      console.error('Erro ao gerar PDF:', err);
      return res.status(500).json({ erro: 'Falha ao gerar PDF' });
    }

    const pdfBuffer = fs.readFileSync(caminhoArquivo);
    const base64 = pdfBuffer.toString('base64');
    const url = `${req.protocol}://${req.get('host')}/pdfs/${nomeArquivo}`;

    res.json({
      base64,
      url
    });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

