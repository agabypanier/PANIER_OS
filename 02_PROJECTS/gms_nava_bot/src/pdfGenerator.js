/**
 * pdfGenerator.js - Jenerasyon PDF Pwofesyonèl
 *
 * Kreye bèl PDF pou fakti, proforma, ak resi
 */

const puppeteer = require('puppeteer');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const OUTPUT_DIR = path.join(__dirname, '..', 'generated_pdfs');

// Company information
const COMPANIES = {
    gms: {
        name: 'GMS Rent a Car',
        address: 'Delmas 55 #20B',
        phone: '(509) 37 04 1104 / 42 84 7749',
        email: 'gmsrentacar12@gmail.com',
        color_primary: '#C62828',
        color_secondary: '#1565C0',
        color_accent: '#0D47A1',
        logo_file: 'gms_logo.png',
        bank_info: 'Compte GMS Rent À CAR — 15 20 10 86 95 — Bank SogeBel (peye pa virman)'
    },
    nava: {
        name: 'NAVA Rentacar Autobody',
        address: 'Delmas 55 #20B',
        phone: '(509) 37 04 1104 / 38 17 0282',
        email: 'navarrenacarautobody@gmail.com',
        color_primary: '#B71C1C',
        color_secondary: '#1A237E',
        color_accent: '#0D47A1',
        logo_file: 'nava_logo.png'
    },
    gt: {
        name: 'G & T GARAGE AUTO REPAIR',
        address: '9, Rue Nina, Delmas 19 (En face Bureau des Mines)',
        phone: '(509) 3558-3758 / 3767-1693',
        email: '',
        color_primary: '#B71C1C',
        color_secondary: '#7B0000',
        color_accent: '#D32F2F',
        logo_file: 'gt_logo.png',
        template: 'gt_proforma'
    },
    michel: {
        name: 'MICHEL AUTOTECH',
        address: 'Delmas 17, Port-au-Prince, Haiti',
        phone: '(509) 38 17 0282',
        email: 'michelMAT15@gmail.com',
        color_primary: '#0d47a1',
        color_secondary: '#0a0a2e',
        color_accent: '#c9a84c',
        logo_file: 'michel_logo.png',
        template: 'michel_proforma'
    }
};

const DOC_TYPE_LABELS = {
    invoice: { title: 'FACTURE', label_fr: 'Facture', label_ht: 'Fakti' },
    proforma: { title: 'PROFORMA', label_fr: 'Proforma', label_ht: 'Pwoforma' },
    receipt: { title: 'REÇU', label_fr: 'Reçu', label_ht: 'Resi' }
};

// Register Handlebars helpers
Handlebars.registerHelper('formatMoney', function (amount, currency) {
    const num = parseFloat(amount) || 0;
    let symbol = '$';
    if (typeof currency === 'string') {
        const c = currency.trim().toUpperCase();
        if (c === 'HTG' || c.startsWith('HTG') || c.includes('GOURD')) {
            symbol = 'HTG ';
        } else if (c === 'USD' || c === '$') {
            symbol = '$';
        } else {
            symbol = `${currency.trim()} `;
        }
    }
    return `${symbol}${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
});

Handlebars.registerHelper('formatDate', function (dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const months = ['Janvye', 'Fevriye', 'Mas', 'Avril', 'Me', 'Jen',
        'Jiyè', 'Out', 'Septanm', 'Oktòb', 'Novanm', 'Desanm'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
});

Handlebars.registerHelper('inc', function (value) {
    return parseInt(value) + 1;
});

/**
 * Get logo as base64 data URI
 */
function getLogoBase64(company) {
    const logoPath = path.join(ASSETS_DIR, COMPANIES[company].logo_file);
    if (fs.existsSync(logoPath)) {
        const data = fs.readFileSync(logoPath);
        const ext = path.extname(logoPath).slice(1);
        return `data:image/${ext};base64,${data.toString('base64')}`;
    }
    return null;
}

/**
 * Generate HTML from template and data
 */
function renderTemplate(docData, overrideTemplateName) {
    const templateName = overrideTemplateName || docData.type;
    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template pa jwenn: ${templatePath}`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    const company = COMPANIES[docData.company];
    const docType = DOC_TYPE_LABELS[docData.type];

    const isHtg = docData.currency && docData.currency.trim().toUpperCase().startsWith('HTG');

    const templateData = {
        ...docData,
        company_name: company.name,
        company_address: company.address,
        company_phone: company.phone,
        company_email: company.email,
        color_primary: company.color_primary,
        color_secondary: company.color_secondary,
        color_accent: company.color_accent,
        logo_base64: getLogoBase64(docData.company),
        doc_title: docType.title,
        doc_label: docType.label_fr,
        bank_info: company.bank_info || null,
        date_formatted: Handlebars.helpers.formatDate(),
        currency_symbol: isHtg ? 'HTG ' : '$',
        show_htg: !isHtg,
        total_htg: docData.total_htg || 0,
        subtotal_htg: docData.subtotal_htg || 0,
        tax_amount_htg: docData.tax_amount_htg || 0,
        htg_rate: 140
    };

    return template(templateData);
}

/**
 * Generate PDF from document data
 */
async function generatePDF(docData, templateName) {
    const os = require('os');
    const isCloud = process.platform === 'linux' && fs.existsSync('/data');

    let baseGuyDir;
    if (isCloud) {
        // On Railway/cloud: save PDFs under /data/GUY
        baseGuyDir = '/data/GUY';
    } else {
        // On Windows local: save in OneDrive/Documents/GUY
        const userHome = os.homedir();
        baseGuyDir = path.join(userHome, 'OneDrive', 'Documents', 'GUY');
        if (!fs.existsSync(path.join(userHome, 'OneDrive', 'Documents'))) {
            baseGuyDir = path.join(userHome, 'Documents', 'GUY');
        }
    }

    // Safety: If GUY exists as a file, remove it
    if (fs.existsSync(baseGuyDir) && fs.statSync(baseGuyDir).isFile()) {
        fs.unlinkSync(baseGuyDir);
    }

    // Determine subfolder: GMS, NAVA, or DINEPA Companion
    let companyFolder;
    if (docData.company === 'gt' || docData.company === 'michel') {
        companyFolder = path.join('NAVA', 'DINEPA Companion');
    } else {
        companyFolder = (docData.company || 'gms').toUpperCase();
    }

    // Determine subfolder: Proforma, Fakti, or Resi
    let typeFolder = 'Fakti';
    if (docData.type === 'proforma') {
        typeFolder = 'Proforma';
    } else if (docData.type === 'receipt') {
        typeFolder = 'Resi';
    } else if (docData.type === 'invoice') {
        typeFolder = 'Fakti';
    }

    const targetDir = path.join(baseGuyDir, companyFolder, typeFolder);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Also ensure local backup directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const html = renderTemplate(docData, templateName);
    const fileName = `${docData.doc_number || 'document'}.pdf`;
    const filePath = path.join(targetDir, fileName);
    const backupFilePath = path.join(OUTPUT_DIR, fileName);

    let browser;
    try {
        logger.info('🖨️ Ap kreye PDF...');

        const launchOptions = {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        };

        if (!isCloud) {
            // Windows: try Chrome/Edge local installs
            const possibleExecutablePaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
            ];
            for (const exePath of possibleExecutablePaths) {
                if (fs.existsSync(exePath)) {
                    launchOptions.executablePath = exePath;
                    break;
                }
            }
        }
        // On cloud (Linux): puppeteer uses its bundled Chromium automatically

        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        await page.pdf({
            path: filePath,
            format: 'Letter',
            printBackground: true,
            margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' }
        });

        logger.bot.pdf('kreye', filePath);
        console.log(`📄 PDF kreye: ${filePath}`);
        
        try {
            fs.copyFileSync(filePath, backupFilePath);
        } catch (e) {
            // Ignore backup copy error
        }

        return filePath;
    } catch (error) {
        console.error('❌ Erè kreye PDF:', error.message);
        logger.bot.error('PDF generation failed', error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}
/**
 * Generate 2 companion proformas (+15% and +20%) for DINEPA requests
 */
async function generateDinepaCompanionProformas(docData) {
    const isDinepa = (docData.client_name || '').toUpperCase().includes('DINEPA');
    const isProforma = docData.type === 'proforma';

    if (!isDinepa || !isProforma) {
        return [];
    }

    logger.info('📊 DINEPA Proforma detekte! Ap genere 2 proforma akonpayman (+15% & +20%)...');

    // 1. Companion 1: G & T GARAGE AUTO REPAIR (+15%)
    const docData15 = createMarkupDocData(docData, 'gt', 15, 'GT');
    const pdfPath15 = await generatePDF(docData15, 'gt_proforma');

    // 2. Companion 2: MICHEL AUTOTECH (+20%)
    const docData20 = createMarkupDocData(docData, 'michel', 20, 'MICHEL');
    const pdfPath20 = await generatePDF(docData20, 'michel_proforma');

    return [
        {
            companyName: 'G & T GARAGE AUTO REPAIR',
            markup: '+15%',
            docNumber: docData15.doc_number,
            total: docData15.total,
            currency: docData15.currency,
            pdfPath: pdfPath15
        },
        {
            companyName: 'MICHEL AUTOTECH',
            markup: '+20%',
            docNumber: docData20.doc_number,
            total: docData20.total,
            currency: docData20.currency,
            pdfPath: pdfPath20
        }
    ];
}

function createMarkupDocData(baseDocData, companyKey, markupPercent, prefix) {
    const factor = 1 + (markupPercent / 100);
    const newItems = baseDocData.items.map(item => {
        const origPrice = parseFloat(item.unit_price) || 0;
        const newPrice = Math.round(origPrice * factor);
        const qty = parseFloat(item.quantity) || 1;
        const total = qty * newPrice;
        return {
            ...item,
            unit_price: newPrice,
            total: total
        };
    });

    let subtotal = 0;
    newItems.forEach(it => subtotal += it.total);

    const taxRate = parseFloat(baseDocData.tax_rate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    const htgRate = 140;

    return {
        ...baseDocData,
        company: companyKey,
        doc_number: `${prefix}-${baseDocData.doc_number}`,
        items: newItems,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total: total,
        subtotal_htg: subtotal * htgRate,
        tax_amount_htg: taxAmount * htgRate,
        total_htg: total * htgRate
    };
}

module.exports = { generatePDF, generateDinepaCompanionProformas, COMPANIES, DOC_TYPE_LABELS };
