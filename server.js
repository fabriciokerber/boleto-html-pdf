const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;
const BROWSER_WS_ENDPOINT =
  process.env.BROWSER_WS_ENDPOINT || 'ws://chrome:3000';

app.use(bodyParser.text({ type: '*/*', limit: '10mb' }));
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs')));
app.use('/b', express.static(path.join(__dirname, 'b')));

const pdfDir = path.join(__dirname, 'pdfs');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'boleto-html-pdf',
    browserWsEndpoint: BROWSER_WS_ENDPOINT
  });
});

async function connectWithRetry(retries = 10, delay = 3000) {
  let lastError;

  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`[BROWSER] Tentativa ${i}/${retries} em ${BROWSER_WS_ENDPOINT}`);
      const browser = await puppeteer.connect({
        browserWSEndpoint: BROWSER_WS_ENDPOINT,
        protocolTimeout: 300000
      });
      console.log('[BROWSER] Conectado com sucesso');
      return browser;
    } catch (error) {
      lastError = error;
      console.error(`[BROWSER] Falha na tentativa ${i}:`, error.message);
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

app.post('/gerar-pdf', async (req, res) => {
  const html = req.body;

  if (!html) {
    return res.status(400).json({ erro: 'HTML não enviado no corpo da requisição' });
  }

  let browser;

  try {
    console.log('[PDF] Iniciando geração...');
    browser = await connectWithRetry();

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    const nomeArquivo = `boleto-${Date.now()}.pdf`;
    const caminhoArquivo = path.join(pdfDir, nomeArquivo);

    await page.pdf({
      path: caminhoArquivo,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      }
    });

    const pdfBuffer = fs.readFileSync(caminhoArquivo);
    const base64 = pdfBuffer.toString('base64');
    const url = `${req.protocol}://${req.get('host')}/pdfs/${nomeArquivo}`;

    console.log('[PDF] Gerado com sucesso:', nomeArquivo);

    return res.json({
      base64,
      url
    });
  } catch (error) {
    console.error('[PDF] Erro ao gerar PDF:', error);

    return res.status(500).json({
      erro: 'Falha ao gerar PDF',
      detalhe: error.message
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[PDF] Erro ao fechar browser:', closeError.message);
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`🌐 Browser endpoint configurado: ${BROWSER_WS_ENDPOINT}`);
});
