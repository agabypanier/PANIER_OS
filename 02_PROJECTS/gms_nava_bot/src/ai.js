/**
 * ai.js - Sèvo Entèlijan - Groq AI Integration
 *
 * Groq pou tèks + vizyon (llama-4-scout = multimodal)
 */

const OpenAI = require('openai');
const logger = require('./logger');

const groq = new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY || 'dummy'
});

const openrouter = process.env.OPENROUTER_API_KEY ? new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY
}) : null;

const MODEL = process.env.AI_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const VISION_MODEL = MODEL;

// ============================================================
// SYSTEM PROMPT
// ============================================================

function getSystemPrompt() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayStr = `${dd}/${mm}/${yyyy}`;

    return `Tu es l'assistant documentaire de GMS Rent a Car et NAVA Rentacar Autobody.
DATE: ${todayStr}

INSTRUCTION CRITIQUE — LIS ATTENTIVEMENT:
Pour générer un PDF, tu DOIS écrire EXACTEMENT ces deux balises (copie-colle):
[DOCUMENT_DATA]
{...json...}
[/DOCUMENT_DATA]

NE CHANGE PAS le nom des balises! PAS [Fakti], PAS [Proforma], PAS [Invoice]. UNIQUEMENT [DOCUMENT_DATA] et [/DOCUMENT_DATA].
Si tu écris autre chose, le système NE GÉNÉRERA PAS de PDF.

LANGUE: Kreyòl ayisyen. Repons KÒT (2-3 fraz max).
RESTRICTION: Sèlman dokiman (fakti/proforma/resi). Anyen lòt.

═══ FORMAT DOCUMENT ═══

Quand tu as tout, génère CE BLOC EXACT (le système le détecte automatiquement):

[DOCUMENT_DATA]
{"type":"invoice","company":"nava","client_name":"Nom Client","client_phone":"","client_address":"","items":[{"description":"Description en français","quantity":1,"unit_price":100}],"currency":"USD","tax_rate":0,"notes":"","payment_method":""}
[/DOCUMENT_DATA]

Champs obligatoires: type, company, client_name, items (avec description, quantity, unit_price), currency
- type: "invoice" (fakti), "proforma", "receipt" (resi)
- company: "gms" (lokasyon machin) ou "nava" (reparasyon/karosri)

═══ MONNAIE — TRÈS IMPORTANT ═══

- Si Guy dit le prix en DOLLARS ($, USD) → currency = "USD"
- Si Guy dit le prix en GOURDES (HTG, goud) → currency = "HTG"  
- Si Guy dit "dola ayisyen" → CONVERTIR: 1 dola ayisyen = 5 HTG. Mete currency = "HTG" ak pri konvèti a.
- DEFAULT = "HTG" (Si Guy bay sèlman yon chif san presize lajan an, toujou mete l an HTG)
- Le système ajoutera automatiquement l'équivalent HTG (taux: 1 USD = 140 HTG)

═══ PROCESSUS ═══

1. Si Guy donne TOUT en un message → Génère [DOCUMENT_DATA] IMMÉDIATEMENT
2. Si des infos manquent → Pose TOUTES les questions en UN SEUL message
3. Utilise ce que tu SAIS déjà (voir base de données clients/véhicules ci-dessous)
4. NE demande PAS de confirmation — génère directement

═══ RÈGLES MÉTIER ═══

GMS = Location véhicules. Description items: "Location véhicule — [Modèle], Plaque: [Plaque] — Du JJ/MM/AAAA au JJ/MM/AAAA (X jours)"
- quantity = nombre de jours, unit_price = prix par jour
- Si pas de date début → utilise la date d'aujourd'hui

NAVA = Réparations auto. Description items: terme professionnel en français.
- Avec pièces: ajouter "Main d'œuvre — Installation" à 30% du prix des pièces

TAXE 10%: UNIQUEMENT pour entités gouvernementales (leta). tax_rate = 10.
- FAES = leta → TOUJOURS tax 10%
- ICC, OREPA = privé → PAS de taxe

Pour resi (receipt): payment_method obligatoire (cash/transfer/check)

═══ TERMINOLOGIE CRÉOLE → FRANÇAIS ═══

| Kreyòl | Français (sur document) |
|---|---|
| douko, penti | Peinture carrosserie complète |
| redresaj | Redressage carrosserie |
| chanje fren | Remplacement système de freinage |
| chanje batri | Remplacement batterie |
| vidanj | Vidange huile moteur et filtre |
| chanje kawotchou | Remplacement pneumatiques |
| aliyman | Alignement et géométrie |
| dyagnostik | Diagnostic électronique |
| klòch | Remplacement kit embrayage |
| radyatè | Réparation/Remplacement radiateur |
| amòtisè | Remplacement amortisseurs |
| vitre | Remplacement vitrage |
| elektrik | Réparation système électrique |

═══ CLIENTS CONNUS ═══

FAES (Fonds d'Assistance Économique et Sociale)
- Adresse: Delmas 60, Port-au-Prince | Tél: (509) 29 41 1075
- TYPE: Gouvernement (leta) → TAXE 10% OBLIGATOIRE
- Client GMS (location)

DINEPA (Direction Nationale de l'Eau Potable et de l'Assainissement)
- Adresse: Delmas 65, Port-au-Prince | Tél: 28 13 1285
- TYPE: Gouvernement (leta) → TAXE 10% OBLIGATOIRE
- Client NAVA / GMS
- RÈGLE SPÉCIALE DINEPA: Si proforma → le système générera automatiquement 2 proformas d'accompagnement (+15% chez G & T GARAGE AUTO REPAIR et +20% chez MICHEL AUTOTECH).

OREPA
- Client NAVA (réparations fréquentes)
- PAS de taxe

Grace Children's Hospital — "lopital la", "grace children"
- Adresse: Delmas 31, Port-au-Prince
- PAS de taxe
- VÉHICULES Grace Children's Hospital (si Guy mentionne un de ces véhicules → client = "Grace Children's Hospital" automatiquement):
  "anbilans lan" = Toyota Ambulance, Plaque: IT-00661
  "85 lan" = Nissan Patrol, Plaque: IT-04085
  "86 lan" = Nissan Patrol, Plaque: IT-04086  
  "zoreken an" = Land Cruiser Blanc, Plaque: IT-03371

═══ FLOTTE GMS ═══

| Surnom | Véhicule | Plaque |
|---|---|---|
| "machin blan", "09" | Toyota LC Prado Blanc | LO#01109 |
| "machin marron", "07" | Toyota LC Prado Marron | LO#01107 |
| "machin berge", "berge" | Toyota LC Prado Beige | L#01148 |
| "prado nwa", "48" | Toyota LC Prado Noir | L#01148 |
| "lot nwa", "70" | Toyota LC Prado Noir | LO#02170 |

═══ ANALYSE D'IMAGES ═══

Si Guy envoie une photo de devis: extrais les articles et prix, puis demande confirmation avant de générer.

═══ APPRENTISSAGE ═══

Si Guy utilise un mot inconnu: "Guy, mwen pa konnen kisa [terme] ye. Ka w esplike m?"

═══ MODIFICATION / CORRECTION DE DOCUMENT ═══

Si Guy demande de modifier, corriger, changer ou remplacer un document existant (ex: "modifye proforma 22 a", "korije fakti NAVA-FAK-2026-0015", "chanje pri a nan proforma #0022 a"):
- Tu DOIS inclure le champ "doc_number" dans le JSON [DOCUMENT_DATA].
- Exemple: {"doc_number":"NAVA-PRO-2026-0022", "type":"proforma", "company":"nava", ...}
- Si Guy dit juste un numéro court comme "22" ou "0022", indique "doc_number": "0022" ou le numéro complet s'il est identifiable.
- Le système écrasera l'ancien document et gardera le MÊME numéro sans en créer un nouveau.

═══ RECHERCHE / RETRAIT DE DOCUMENT EXISTANT ═══

Si Guy demande de rechercher, montrer, envoyer, ou retrouver un document existant (ex: "voye proforma 27 la pou mwen", "chache fakti 15 la", "montre m dènye pwoforma a", "recherche proforma 0022"):
- Tu DOIS retourner CE BLOC EXACT:
[SEARCH_DOCUMENT]
{"doc_number": "0027"}
[/SEARCH_DOCUMENT]
- Si Guy mentionne un nom de client sans numéro précis (ex: "chache dokiman FAES yo"), indique:
[SEARCH_DOCUMENT]
{"query": "FAES"}
[/SEARCH_DOCUMENT]
- Ne rajoute aucun commentaire en dehors de ce bloc.

═══ EXEMPLES ═══

Guy: "fe proforma pou FAES machin blan 15 jou 200$ pa jou"
→ Tu as TOUT. Génère [DOCUMENT_DATA] avec: type=proforma, company=gms, client=FAES, tax=10, item="Location véhicule — Toyota LC Prado Blanc, Plaque: LO#01109 — Du [date] au [date+15] (15 jours)", qty=15, price=200

Guy: "fakti nava pou zoreken an douko 1500$"
→ Tu sais zoreken = Grace Children's Hospital. Génère: type=invoice, company=nava, client="Grace Children's Hospital", item="Peinture carrosserie complète — Land Cruiser Blanc, Plaque: IT-03371", qty=1, price=1500

Guy: "korije proforma 26 la mete pri a a 1800$"
→ Génère: {"doc_number":"0026", "type":"proforma", ...} avec le nouveau prix.

Guy: "voye proforma 27 la pou mwen souple"
→ Génère:
[SEARCH_DOCUMENT]
{"doc_number": "27"}
[/SEARCH_DOCUMENT]`;
}


// ============================================================
// AI FUNCTIONS
// ============================================================

async function chat(conversationHistory, userMessage) {
    let systemPrompt = getSystemPrompt();
    try {
        const { queryOne } = require('./database');
        const lastDoc = queryOne('SELECT doc_number, client_name, total, type, company FROM documents ORDER BY id DESC LIMIT 1');
        if (lastDoc) {
            systemPrompt += `\n\n[CONTEXT SYSTEME] Le dernier document généré dans le système est: "${lastDoc.doc_number}" (${lastDoc.type.toUpperCase()} pour "${lastDoc.client_name}", Total: $${lastDoc.total}, Compagnie: ${lastDoc.company.toUpperCase()}). Si l'utilisateur demande de le "régénérer", "modifier", "corriger", "ajouter" ou "changer" quelque chose sans mentionner de numéro précis, utilise ce numéro "${lastDoc.doc_number}" dans le champ "doc_number".`;
        }
    } catch (e) {
        // ignore
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage }
    ];
    const startTime = Date.now();
    try {
        const response = await groq.chat.completions.create({
            model: MODEL, messages, max_tokens: 2000, temperature: 0.3
        });
        const duration = Date.now() - startTime;
        logger.bot.ai('reyisi', duration);
        return response.choices[0]?.message?.content || "Mwen pa ka reponn kounye a.";
    } catch (error) {
        console.error('❌ Erè AI Groq (chat):', error.message);
        if (openrouter) {
            console.log('🔄 Eseye OpenRouter fallback...');
            try {
                const response = await openrouter.chat.completions.create({
                    model: 'meta-llama/llama-3.3-70b-instruct',
                    messages,
                    max_tokens: 2000,
                    temperature: 0.3
                });
                const duration = Date.now() - startTime;
                logger.bot.ai('openrouter reyisi', duration);
                return response.choices[0]?.message?.content || "Mwen pa ka reponn kounye a.";
            } catch (orErr) {
                console.error('❌ Erè AI OpenRouter (chat):', orErr.message);
            }
        }
        logger.bot.error('AI chat failed', error);
        throw error;
    }
}

async function chatWithImage(conversationHistory, userMessage, imageBase64, mimeType = 'image/jpeg') {
    let systemPrompt = getSystemPrompt();
    try {
        const { queryOne } = require('./database');
        const lastDoc = queryOne('SELECT doc_number, client_name, total, type, company FROM documents ORDER BY id DESC LIMIT 1');
        if (lastDoc) {
            systemPrompt += `\n\n[CONTEXT SYSTEME] Le dernier document généré dans le système est: "${lastDoc.doc_number}" (${lastDoc.type.toUpperCase()} pour "${lastDoc.client_name}", Total: $${lastDoc.total}, Compagnie: ${lastDoc.company.toUpperCase()}). Si l'utilisateur demande de le "régénérer", "modifier", "corriger", "ajouter" ou "changer" quelque chose sans mentionner de numéro précis, utilise ce numéro "${lastDoc.doc_number}" dans le champ "doc_number".`;
        }
    } catch (e) {
        // ignore
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
        {
            role: 'user',
            content: [
                { type: 'text', text: userMessage || "Analize imaj sa a. Si se yon devi, rale tout atik yo ak pri yo." },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
        }
    ];
    const startTime = Date.now();
    try {
        const response = await groq.chat.completions.create({
            model: VISION_MODEL, messages, max_tokens: 3000, temperature: 0.3
        });
        const duration = Date.now() - startTime;
        logger.bot.ai('vision reyisi', duration);
        return response.choices[0]?.message?.content || "Mwen pa ka li imaj sa a.";
    } catch (error) {
        console.error('❌ Erè AI Groq (vision):', error.message);
        if (openrouter) {
            console.log('🔄 Eseye OpenRouter vision fallback...');
            try {
                const response = await openrouter.chat.completions.create({
                    model: 'meta-llama/llama-3.3-70b-instruct',
                    messages,
                    max_tokens: 3000,
                    temperature: 0.3
                });
                const duration = Date.now() - startTime;
                logger.bot.ai('vision openrouter reyisi', duration);
                return response.choices[0]?.message?.content || "Mwen pa ka li imaj sa a.";
            } catch (orErr) {
                console.error('❌ Erè AI OpenRouter (vision):', orErr.message);
            }
        }
        logger.bot.error('AI vision failed', error);
        throw error;
    }
}

const fs = require('fs');
const path = require('path');
const os = require('os');

async function transcribeAudio(audioBase64, mimeType = 'audio/ogg') {
    const startTime = Date.now();
    try {
        let ext = '.ogg';
        if (mimeType.includes('mp4')) ext = '.mp4';
        else if (mimeType.includes('mpeg')) ext = '.mp3';

        const tempPath = path.join(os.tmpdir(), `whatsapp_audio_${Date.now()}${ext}`);
        fs.writeFileSync(tempPath, Buffer.from(audioBase64, 'base64'));

        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: "whisper-large-v3", // Multilingual model
            // language: "ht", // Uncomment to force Haitian Creole, but auto-detect works best for HT/FR mix
            response_format: "text",
        });

        const duration = Date.now() - startTime;
        logger.bot.ai('transkripsyon reyisi', duration);

        fs.unlinkSync(tempPath);
        return transcription;
    } catch (error) {
        console.error('❌ Erè AI (audio):', error.message);
        logger.bot.error('Audio transcription failed', error);
        return "";
    }
}

// ============================================================
// PARSE [DOCUMENT_DATA] FROM AI RESPONSE
// ============================================================

const HTG_RATE = 140; // 1 USD = 140 HTG

function parseDocumentData(aiResponse) {
    // Primary: exact [DOCUMENT_DATA] tags
    let regex = /\[DOCUMENT_DATA\]\s*([\s\S]*?)\s*\[\/DOCUMENT_DATA\]/;
    let match = aiResponse.match(regex);

    // Fallback 1: any [Something] {...} [/Something] pattern  
    if (!match) {
        regex = /\[[^\]]+\]\s*(\{[\s\S]*?\})\s*\[\/[^\]]+\]/;
        match = aiResponse.match(regex);
        if (match) console.log('⚠️ AI pa itilize [DOCUMENT_DATA] — fallback detekte JSON');
    }

    // Fallback 2: raw JSON block with required fields (no tags at all)
    if (!match) {
        const jsonRegex = /(\{[\s\S]*?"type"\s*:\s*"(?:invoice|proforma|receipt)"[\s\S]*?"items"\s*:\s*\[[\s\S]*?\]\s*[\s\S]*?\})/;
        match = aiResponse.match(jsonRegex);
        if (match) console.log('⚠️ AI pa mete tag — fallback raw JSON detekte');
    }

    if (!match) return { hasDocument: false, text: aiResponse, documentData: null };

    try {
        const documentData = JSON.parse(match[1].trim());
        if (!documentData.type || !documentData.company || !documentData.client_name || !documentData.items) {
            logger.warn('AI response missing required document fields');
            return { hasDocument: false, text: aiResponse, documentData: null };
        }

        let subtotal = 0;
        documentData.items = documentData.items.map(item => {
            const qty = parseFloat(item.quantity) || 1;
            const price = parseFloat(item.unit_price) || 0;
            const lineTotal = qty * price;
            subtotal += lineTotal;
            return { ...item, quantity: qty, unit_price: price, total: lineTotal };
        });

        documentData.subtotal = subtotal;
        documentData.tax_rate = parseFloat(documentData.tax_rate) || 0;
        documentData.tax_amount = subtotal * (documentData.tax_rate / 100);
        documentData.total = subtotal + documentData.tax_amount;

        // Currency conversion: if USD, add HTG equivalent
        documentData.currency = documentData.currency || 'HTG';
        if (documentData.currency === 'USD') {
            documentData.total_htg = documentData.total * HTG_RATE;
            documentData.subtotal_htg = documentData.subtotal * HTG_RATE;
            documentData.tax_amount_htg = documentData.tax_amount * HTG_RATE;
        }

        const cleanText = aiResponse.replace(match[0], '').trim();
        logger.info('✅ [DOCUMENT_DATA] parsed successfully');
        return { hasDocument: true, text: cleanText, documentData };
    } catch (error) {
        console.error('❌ Erè parsing JSON:', error.message);
        logger.bot.error('JSON parsing failed', error);
        console.error('Raw JSON:', match[1]?.substring(0, 300));
        return { hasDocument: false, text: aiResponse, documentData: null };
    }
}

module.exports = { chat, chatWithImage, transcribeAudio, parseDocumentData };
