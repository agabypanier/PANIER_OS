/**
 * database.js - Baz Done SQLite pou GMS/NAVA Bot
 *
 * Jere tout done: kliyan, dokiman, konvèsasyon
 * Itilize sql.js ak PERSISTENCE OTOMATIK (auto-save apre chak operasyon)
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Support cloud persistent volume (/data) or local data folder
const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'bot.db');
const BACKUP_PATH = path.join(DATA_DIR, 'bot.db.backup');

let db = null;

/**
 * Initialize the database
 */
async function initDatabase() {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const SQL = await initSqlJs();

    // Load existing DB or create new
    if (fs.existsSync(DB_PATH)) {
        try {
            const fileBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(fileBuffer);
            console.log('✅ Baz done chaje soti nan bot.db');
        } catch (err) {
            console.warn('⚠️ bot.db korwonpi, eseye backup...');
            if (fs.existsSync(BACKUP_PATH)) {
                const backupBuffer = fs.readFileSync(BACKUP_PATH);
                db = new SQL.Database(backupBuffer);
                console.log('✅ Backup chaje avèk siksè');
            } else {
                db = new SQL.Database();
                console.log('⚠️ Kreye nouvo baz done (pa gen backup)');
            }
        }
    } else {
        db = new SQL.Database();
        console.log('📁 Kreye nouvo baz done...');
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            email TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_number TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL,
            company TEXT NOT NULL,
            client_id INTEGER,
            client_name TEXT NOT NULL,
            items TEXT NOT NULL,
            subtotal REAL NOT NULL,
            tax_rate REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            total REAL NOT NULL,
            currency TEXT DEFAULT 'USD',
            notes TEXT,
            payment_method TEXT,
            status TEXT DEFAULT 'created',
            pdf_path TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            has_image INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )
    `);

    // Create indexes for faster queries
    try {
        db.run(`CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_name)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type, company)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_chat ON conversations(chat_id)`);
    } catch (e) {
        // Indexes may already exist
    }

    // Save immediately after creation
    saveDbToFile();

    // Auto-save every 30 seconds (safety net)
    setInterval(() => {
        saveDbToFile();
    }, 30000);

    console.log('✅ Baz done initialize avèk siksè!');
    return db;
}

/**
 * Save database to file (with backup)
 */
function saveDbToFile() {
    if (!db) return;

    try {
        const data = db.export();
        const buffer = Buffer.from(data);

        // Create backup first
        if (fs.existsSync(DB_PATH)) {
            fs.copyFileSync(DB_PATH, BACKUP_PATH);
        }

        // Write new data
        fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
        console.error('❌ Erè save baz done:', err.toString ? err.toString() : err);
    }
}

/**
 * Close database (final save)
 */
function closeDatabase() {
    if (db) {
        saveDbToFile();
        console.log('💾 Baz done sove anvan fèmeti.');
        db.close();
    }
}

/** Helper: run query and return results as array of objects */
function queryAll(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    } catch (e) {
        console.error('DB query error:', e.message);
        return [];
    }
}

/** Helper: run query and return first row */
function queryOne(sql, params = []) {
    const results = queryAll(sql, params);
    return results.length > 0 ? results[0] : null;
}

/** Helper: run insert/update and return lastInsertRowid */
function runInsert(sql, params = []) {
    db.run(sql, params);
    const row = queryOne('SELECT last_insert_rowid() as id');
    saveDbToFile(); // AUTO-SAVE after every write
    return row ? row.id : null;
}

/** Helper: run update/delete (no return value) */
function runUpdate(sql, params = []) {
    db.run(sql, params);
    saveDbToFile(); // AUTO-SAVE after every write
}

// ==================== DOCUMENT NUMBER ====================

function generateDocNumber(company, type) {
    const prefixes = {
        gms: { invoice: 'GMS-FAK', proforma: 'GMS-PRO', receipt: 'GMS-RES' },
        nava: { invoice: 'NAVA-FAK', proforma: 'NAVA-PRO', receipt: 'NAVA-RES' }
    };

    const prefix = prefixes[company]?.[type] || `${company.toUpperCase()}-DOC`;
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-%`;

    const row = queryOne(
        `SELECT COUNT(*) as count FROM documents WHERE doc_number LIKE ?`,
        [pattern]
    );

    const nextNum = ((row?.count || 0) + 23).toString().padStart(4, '0');
    return `${prefix}-${year}-${nextNum}`;
}

// ==================== CLIENTS ====================

function findOrCreateClient(name, phone, address, email) {
    let client = queryOne(`SELECT * FROM clients WHERE LOWER(name) = LOWER(?)`, [name]);

    if (!client) {
        const id = runInsert(
            `INSERT INTO clients (name, phone, address, email) VALUES (?, ?, ?, ?)`,
            [name, phone || null, address || null, email || null]
        );
        client = queryOne('SELECT * FROM clients WHERE id = ?', [id]);
        console.log(`👤 Nouvo kliyan kreye: ${name}`);
    }
    return client;
}

function searchClients(query) {
    return queryAll(`SELECT * FROM clients WHERE name LIKE ? LIMIT 10`, [`%${query}%`]);
}

// ==================== DOCUMENTS ====================

function saveDocument(docData) {
    const client = findOrCreateClient(docData.client_name, docData.client_phone, docData.client_address);
    let docNumber = docData.doc_number;
    let existingDoc = null;

    if (docNumber) {
        existingDoc = getDocumentByNumber(docNumber);
        if (!existingDoc) {
            const cleanNum = docNumber.replace(/[^0-9]/g, '');
            if (cleanNum) {
                const paddedNum = cleanNum.padStart(4, '0');
                existingDoc = queryOne(
                    'SELECT * FROM documents WHERE doc_number LIKE ? ORDER BY id DESC LIMIT 1',
                    [`%-${paddedNum}`]
                );
            }
        }
    }

    if (existingDoc) {
        docNumber = existingDoc.doc_number;
        runQuery(
            `UPDATE documents 
             SET type = ?, company = ?, client_id = ?, client_name = ?, items = ?, 
                 subtotal = ?, tax_rate = ?, tax_amount = ?, total = ?, currency = ?, 
                 notes = ?, payment_method = ?, pdf_path = ?, updated_at = CURRENT_TIMESTAMP
             WHERE doc_number = ?`,
            [
                docData.type || existingDoc.type,
                docData.company || existingDoc.company,
                client.id,
                docData.client_name,
                JSON.stringify(docData.items),
                docData.subtotal,
                docData.tax_rate || 0,
                docData.tax_amount || 0,
                docData.total,
                docData.currency || 'USD',
                docData.notes || null,
                docData.payment_method || null,
                docData.pdf_path || null,
                docNumber
            ]
        );
        console.log(`✏️ Dokiman modifye (ekraze ansyen an): ${docNumber}`);
        return getDocumentByNumber(docNumber);
    } else {
        if (!docNumber) {
            docNumber = generateDocNumber(docData.company, docData.type);
        }
        const id = runInsert(
            `INSERT INTO documents (doc_number, type, company, client_id, client_name, items, subtotal, tax_rate, tax_amount, total, currency, notes, payment_method, pdf_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                docNumber, docData.type, docData.company, client.id, docData.client_name,
                JSON.stringify(docData.items), docData.subtotal, docData.tax_rate || 0,
                docData.tax_amount || 0, docData.total, docData.currency || 'USD',
                docData.notes || null, docData.payment_method || null, docData.pdf_path || null
            ]
        );
        const doc = queryOne('SELECT * FROM documents WHERE id = ?', [id]);
        console.log(`📄 Dokiman sere: ${docNumber}`);
        return doc;
    }
}

function getDocumentByNumber(docNumber) {
    return queryOne('SELECT * FROM documents WHERE doc_number = ?', [docNumber]);
}

function searchDocuments(query) {
    return queryAll(
        `SELECT * FROM documents WHERE client_name LIKE ? OR doc_number LIKE ? OR notes LIKE ? ORDER BY created_at DESC LIMIT 20`,
        [`%${query}%`, `%${query}%`, `%${query}%`]
    );
}

function getRecentDocuments(company, type, limit = 10) {
    let sql = 'SELECT * FROM documents WHERE 1=1';
    const params = [];
    if (company) { sql += ' AND company = ?'; params.push(company); }
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return queryAll(sql, params);
}

function getDocumentStats() {
    return queryAll(`
        SELECT company, type, COUNT(*) as count, SUM(total) as total_amount, currency
        FROM documents
        WHERE created_at >= date('now', 'start of month', 'localtime')
        GROUP BY company, type, currency
    `);
}

function updateDocumentPdfPath(docId, pdfPath) {
    runUpdate('UPDATE documents SET pdf_path = ? WHERE id = ?', [pdfPath, docId]);
}

// ==================== CONVERSATIONS ====================

function saveMessage(chatId, role, content, hasImage = false) {
    runInsert(
        `INSERT INTO conversations (chat_id, role, content, has_image) VALUES (?, ?, ?, ?)`,
        [chatId, role, content, hasImage ? 1 : 0]
    );
}

function getConversationHistory(chatId, limit = 12) {
    return queryAll(
        `SELECT role, content, created_at FROM conversations WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?`,
        [chatId, limit]
    ).reverse();
}

function clearConversation(chatId) {
    runUpdate('DELETE FROM conversations WHERE chat_id = ?', [chatId]);
}

module.exports = {
    initDatabase,
    closeDatabase,
    findOrCreateClient, searchClients,
    saveDocument, getDocumentByNumber, searchDocuments,
    getRecentDocuments, getDocumentStats, updateDocumentPdfPath,
    saveMessage, getConversationHistory, clearConversation,
    generateDocNumber
};
