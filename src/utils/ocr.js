import { createWorker } from 'tesseract.js';

const matchFirst = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return '';
};

const matchLineValue = (text, patterns) => {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }
  return matchFirst(text, patterns);
};

const normalizeDate = (value) => {
  if (!value) return '';
  const cleaned = value.trim().replace(/\./g, '-').replace(/\//g, '-').replace(/\s+/g, ' ');
  const parts = cleaned.split('-').map((item) => item.trim().padStart(2, '0'));
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return cleaned;
};

const normalizeAmount = (value) => {
  if (!value) return '';
  const cleaned = value.replace(/[\s\u00A0]/g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
  return cleaned;
};

const extractDuration = (text, startDate, endDate) => {
  const durationMatch = matchFirst(text, [
    /DUR[ÉE]E?\s*[:\-]?\s*(\d+)\s*(mois|ans|jours?)/i,
    /(\d+)\s*(mois|ans|jours?)(?=\s+(?:de|du|pour))/i,
  ]);
  if (durationMatch) {
    return durationMatch;
  }
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      const months = Math.round(diffDays / 30);
      if (months >= 12 && months % 12 === 0) {
        return `${months / 12} an${months / 12 > 1 ? 's' : ''}`;
      }
      if (months >= 1) {
        return `${months} mois`;
      }
      return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    }
  }
  return '';
};

const extractLieu = (text) => {
  return summarizeField(text, [
    /ADRESSE DU SI[EÈ]GE\s*[:\-]?\s*([^\r\n]+)/i,
    /ADRESSE\s*[:\-]?\s*([^\r\n]+)/i,
    /NOM DU SITE\s*[:\-]?\s*([^\r\n]+)/i,
    /SITE(?:\s+À\s+PROT[EÈ]GER)?\s*[:\-]?\s*([^\r\n]+)/i,
    /LIEU\s*[:\-]?\s*([^\r\n]+)/i,
  ]);
};

const extractConditions = (text) => {
  const condition = summarizeField(text, [
    /CONDITIONS\s*[:\-]?\s*([^\r\n]+)/i,
    /CLAUSES SP[ÉE]CIFIQUES\s*[:\-]?\s*([^\r\n]+)/i,
    /CLAUSES\s*[:\-]?\s*([^\r\n]+)/i,
  ]);
  return condition;
};

const summarizeField = (text, patterns) => {
  const value = matchLineValue(text, patterns);
  return value || matchFirst(text, patterns);
};

export function summarizeContractText(text) {
  if (!text) return '';
  const normalized = text.replace(/\r/g, '\n');
  const title = normalized.split(/\n/).find((line) => line.trim().length > 10) || '';
  const objet = summarizeField(normalized, [
    /OBJET(?:\s+DE(?:\s+LA)?)?(?:\s+CONSULTATION)?\s*[:\-]?\s*([^\r\n]+)/i,
    /OBJET(?:\s+DU)?(?:\s+MARCH[ÉE])?\s*[:\-]?\s*([^\r\n]+)/i,
    /DESCRIPTION\s*[:\-]?\s*([^\r\n]+)/i,
  ]);
  const reference = summarizeField(normalized, [
    /R[ÉE]F[ÉE]RENCE(?:\s+L[ÉE]GALE)?\s*[:\-]?\s*([^\r\n]+)/i,
    /R[ÉE]F\s*[:\-]?\s*([^\r\n]+)/i,
  ]);
  const dateSignature = summarizeField(normalized, [
    /DATE DE SIGNATURE\s*[:\-]?\s*([^\r\n]+)/i,
    /SIGNATURE\s*[:\-]?\s*([^\r\n]+)/i,
  ]);
  const dateDebut = summarizeField(normalized, [
    /DATE DE D[ÉE]BUT\s*[:\-]?\s*([^\r\n]+)/i,
    /DEBUT\s*[:\-]?\s*([^\r\n]+)/i,
  ]);
  const dateFin = summarizeField(normalized, [
    /DATE DE FIN\s*[:\-]?\s*([^\r\n]+)/i,
    /FIN\s*[:\-]?\s*([^\r\n]+)/i,
  ]);
  const montantTotal = summarizeField(normalized, [
    /MONTANT GLOBAL(?:\s*\(DZD\))?\s*[:\-]?\s*([^\r\n]+)/i,
    /MONTANT\s*[:\-]?\s*([^\r\n]+)/i,
  ]);
  const creePar = summarizeField(normalized, [
    /SAISI(?:E)?\s*PAR\s*(?:\(TRAÇABILIT[ÉE]\))?\s*[:\-]?\s*([^\r\n]+)/i,
    /SAISI PAR\s*[:\-]?\s*([^\r\n]+)/i,
  ]);

  const lieu = extractLieu(normalized);
  const conditions = extractConditions(normalized);
  const duree = extractDuration(normalized, dateDebut, dateFin);

  const parts = [];
  if (title) parts.push(`Titre : ${title.trim()}`);
  if (objet) parts.push(`Objet : ${objet}`);
  if (reference) parts.push(`Réf. : ${reference}`);
  if (dateSignature) parts.push(`Signature : ${dateSignature}`);
  if (dateDebut) parts.push(`Début : ${dateDebut}`);
  if (dateFin) parts.push(`Fin : ${dateFin}`);
  if (duree) parts.push(`Durée : ${duree}`);
  if (montantTotal) parts.push(`Montant : ${montantTotal}`);
  if (lieu) parts.push(`Lieu : ${lieu}`);
  if (conditions) parts.push(`Conditions : ${conditions}`);
  if (creePar) parts.push(`Saisi par : ${creePar}`);

  if (parts.length === 0) {
    return normalized.split('\n').slice(0, 5).join(' ').trim();
  }
  return parts.join('\n');
}

export async function recognizeDocument(file, onProgress) {
  if (!file) {
    throw new Error('Aucun fichier sélectionné.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Seules les images peuvent être traitées pour l’instant.');
  }

  let worker = null;
  try {
    console.log('[OCR] Création du worker...');
    worker = await createWorker({ 
      logger: (m) => {
        console.log('tesseract:', m);
        if (onProgress) onProgress(m);
      }
    });
    
    console.log('[OCR] Chargement des langues (ara+fra+eng)...');
    // Ajouter l'arabe, le français, et l'anglais pour meilleure reconnaissance
    await worker.loadLanguage('ara+fra+eng');
    
    console.log('[OCR] Initialisation...');
    await worker.initialize('ara+fra+eng');
    
    console.log('[OCR] Reconnaissance en cours avec meilleure segmentation...');
    // PSM 3 = Full page of text avec auto-rotation
    const { data } = await worker.recognize(file, {
      tessedit_pagesegmode: 3,
      tessedit_ocr_engine_mode: 1,
    });
    
    let text = data.text || '';
    // Nettoyer les caractères mal encodés tout en gardant les accents
    text = text
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')  // Enlever les contrôles
      .replace(/[^\w\s\-.,;:()'"\/àâäéèêëïîôöüûçœæÀÂÄÉÈÊËÏÎÔÖÜÛÇŒÆ]/gu, '')  // Garder lettres accents et ponctuation
      .replace(/\s+/g, ' ')  // Normaliser les espaces
      .trim();
    
    console.log('[OCR] Texte extrait (nettoyé):', text.slice(0, 150));
    return text;
  } catch (err) {
    console.error('[OCR] Erreur:', err);
    throw new Error(`Erreur OCR: ${err.message}`);
  } finally {
    if (worker) {
      console.log('[OCR] Terminaison du worker...');
      try {
        await worker.terminate();
        console.log('[OCR] Worker terminé.');
      } catch (termErr) {
        console.warn('[OCR] Erreur lors de la terminaison:', termErr.message);
      }
    }
  }
}

export function parseRecruitmentData(text) {
  if (!text) return {};
  const normalized = text.replace(/\r/g, '\n');

  return {
    nom: matchFirst(normalized, [
      /NOM\s*[:\-]?\s*([A-ZÀ-ÿ\s'\-]{2,})/i,
      /NOM DE FAMILLE\s*[:\-]?\s*([A-ZÀ-ÿ\s'\-]{2,})/i,
      /FAMILY NAME\s*[:\-]?\s*([A-ZÀ-ÿ\s'\-]{2,})/i,
    ]),
    prenom: matchFirst(normalized, [
      /PR[EÉ]NOM\s*[:\-]?\s*([A-ZÀ-ÿ\s'\-]{2,})/i,
      /GIVEN NAME\s*[:\-]?\s*([A-ZÀ-ÿ\s'\-]{2,})/i,
    ]),
    dateNaissance: normalizeDate(matchFirst(normalized, [
      /DATE DE NAISSANCE\s*[:\-]?\s*([0-9]{2}[\/\-.][0-9]{2}[\/\-.][0-9]{4})/i,
      /NE(E)? LE\s*[:\-]?\s*([0-9]{2}[\/\-.][0-9]{2}[\/\-.][0-9]{4})/i,
      /(\d{4}-\d{2}-\d{2})/,
    ])),
    numCin: matchFirst(normalized, [
      /N[°º]?\s*CIN\s*[:\-]?\s*([A-Z0-9\-]{4,})/i,
      /CIN\s*[:\-]?\s*([A-Z0-9\-]{4,})/i,
      /ID N[°º]?\s*[:\-]?\s*([A-Z0-9\-]{4,})/i,
    ]),
    telephone: matchFirst(normalized, [
      /(0[5-7]\d{8})/,
      /TELEPHONE\s*[:\-]?\s*(0[5-7]\d{8})/i,
      /PHONE\s*[:\-]?\s*(0[5-7]\d{8})/i,
    ]),
    wilaya: matchFirst(normalized, [
      /WILAYA\s*[:\-]?\s*([A-ZÀ-ÿ0-9\s'\-]+)/i,
      /R[ÉE]SIDENCE\s*[:\-]?\s*([A-ZÀ-ÿ0-9\s'\-]+)/i,
    ]),
  };
}

export function parseContractData(text) {
  if (!text) return {};
  const normalized = text.replace(/\r/g, '\n');

  return {
    nouveauClient: matchLineValue(normalized, [
      /NOM DU CLIENT\s*[:\-]?\s*([^\r\n]+)/i,
      /RAISON SOCIALE\s*[:\-]?\s*([^\r\n]+)/i,
      /CLIENT\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    adresseSiege: matchLineValue(normalized, [
      /ADRESSE DU SI[EÈ]GE\s*[:\-]?\s*([^\r\n]+)/i,
      /ADRESSE\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    contactNom: matchLineValue(normalized, [
      /CONTACT(?:\s*\(Nom\))?\s*[:\-]?\s*([^\r\n]+)/i,
      /RESPONSABLE\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    contactTel: matchLineValue(normalized, [
      /TELEPHONE\s*[:\-]?\s*(0[5-7][0-9]{8})/i,
      /T[ÉE]L[ÉE]PHONE\s*[:\-]?\s*(0[5-7][0-9]{8})/i,
      /(0[5-7][0-9]{8})/,
    ]),
    rc: matchLineValue(normalized, [
      /RC\s*[:\-]?\s*([^\r\n]+)/i,
      /REGISTRE DE COMMERCE\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    nif: matchLineValue(normalized, [
      /NIF\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    nis: matchLineValue(normalized, [
      /NIS\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    art: matchLineValue(normalized, [
      /ART\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    nouveauSite: matchLineValue(normalized, [
      /SITE(?:\s+À\s+PROT[EÈ]GER)?\s*[:\-]?\s*([^\r\n]+)/i,
      /NOM DU SITE\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    lieu: extractLieu(normalized),
    objet: matchLineValue(normalized, [
      /OBJET(?:\s+DE(?:\s+LA)?)?(?:\s+CONSULTATION)?\s*[:\-]?\s*([^\r\n]+)/i,
      /OBJET(?:\s+DU)?(?:\s+MARCH[ÉE])?\s*[:\-]?\s*([^\r\n]+)/i,
      /DESCRIPTION\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    duree: extractDuration(normalized, normalizeDate(matchLineValue(normalized, [
      /DATE DE D[ÉE]BUT\s*[:\-]?\s*([^\r\n]+)/i,
      /D[ÉE]BUT\s*[:\-]?\s*([^\r\n]+)/i,
    ])), normalizeDate(matchLineValue(normalized, [
      /DATE DE FIN\s*[:\-]?\s*([^\r\n]+)/i,
      /FIN\s*[:\-]?\s*([^\r\n]+)/i,
    ]))),
    conditions: extractConditions(normalized),
    reference: matchLineValue(normalized, [
      /R[ÉE]F[ÉE]RENCE(?:\s+L[ÉE]GALE)?\s*[:\-]?\s*([^\r\n]+)/i,
      /R[ÉE]F\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    dateSignature: normalizeDate(matchLineValue(normalized, [
      /DATE DE SIGNATURE\s*[:\-]?\s*([^\r\n]+)/i,
      /SIGNATURE\s*[:\-]?\s*([^\r\n]+)/i,
    ])),
    dateDebut: normalizeDate(matchLineValue(normalized, [
      /DATE DE D[ÉE]BUT\s*[:\-]?\s*([^\r\n]+)/i,
      /D[ÉE]BUT\s*[:\-]?\s*([^\r\n]+)/i,
    ])),
    dateFin: normalizeDate(matchLineValue(normalized, [
      /DATE DE FIN\s*[:\-]?\s*([^\r\n]+)/i,
      /FIN\s*[:\-]?\s*([^\r\n]+)/i,
    ])),
    montantTotal: normalizeAmount(matchLineValue(normalized, [
      /MONTANT GLOBAL\s*(?:\(DZD\))?\s*[:\-]?\s*([^\r\n]+)/i,
      /MONTANT\s*[:\-]?\s*([^\r\n]+)\s*DA/i,
      /MONTANT TOTAL\s*[:\-]?\s*([^\r\n]+)/i,
    ])),
    clauses: matchLineValue(normalized, [
      /CLAUSES SP[ÉE]CIFIQUES\s*[:\-]?\s*([^\r\n]+)/i,
      /CLAUSES\s*[:\-]?\s*([^\r\n]+)/i,
    ]),
    creePar: matchLineValue(normalized, [
      /SAISI(?:E)?\s*PAR\s*(?:\(TRAÇABILIT[ÉE]\))?\s*[:\-]?\s*([^\r\n]+)/i,
      /SAISI PAR\s*[:\-]?\s*([^\r\n]+)/i,
      /SAISI(?:E)? PAR\s*[:\-]?\s*([^\r\n]+)/i,
      /SAISI(?:E)?\s*PAR\s*\-\s*([^\r\n]+)/i,
    ]),
  };
}

export async function extractRecruitmentDataWithClaude(text) {
  const apiUrl = import.meta.env.VITE_CLAUDE_API_URL;
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('Claude API non configurée. Ajoutez VITE_CLAUDE_API_URL et VITE_CLAUDE_API_KEY.');
  }

  const prompt = `Tu es un assistant d'extraction de documents. Reçois du texte OCR issu d'un document d'identité ou d'une fiche de recrutement. ` +
    `Retourne uniquement un objet JSON avec ces clés : nom, prenom, dateNaissance, numCin, telephone, wilaya. ` +
    `Si une donnée est absente, renvoie une chaîne vide pour cette clé.`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ prompt, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Erreur Claude : ${response.status} ${response.statusText} ${body}`);
  }

  const data = await response.json();
  const raw = data.output_text || data.text || data.response || JSON.stringify(data);
  try {
    return JSON.parse(raw);
  } catch {
    return { raw: raw.slice(0, 1000) };
  }
}

const findDeepSeekValue = (source, candidates) => {
  if (!source || typeof source !== 'object') return '';
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(source, candidate) && source[candidate] != null) {
      return String(source[candidate]).trim();
    }
  }
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === 'object') {
      const nested = findDeepSeekValue(value, candidates);
      if (nested) return nested;
    }
  }
  return '';
};

const normalizeDeepSeekResponse = (payload) => {
  let data = payload;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = { raw: data };
    }
  }
  if (data?.output_text) {
    try {
      data = JSON.parse(data.output_text);
    } catch {
      data = { raw: data.output_text };
    }
  }
  if (data?.text) {
    try {
      data = JSON.parse(data.text);
    } catch {
      data = data;
    }
  }
  if (data?.result) data = data.result;
  if (data?.data) data = data.data;
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    data = data[0];
  }

  return {
    nom: findDeepSeekValue(data, ['nom', 'name', 'lastName', 'lastname', 'familyName', 'nom_client', 'nom_de_famille']),
    prenom: findDeepSeekValue(data, ['prenom', 'firstName', 'firstname', 'givenName', 'given_name', 'prénom']),
    dateNaissance: findDeepSeekValue(data, ['dateNaissance', 'birthDate', 'date_naissance', 'dob', 'dateOfBirth']),
    numCin: findDeepSeekValue(data, ['numCin', 'cin', 'idNumber', 'id_number', 'numeroCin', 'numero_cin']),
    telephone: findDeepSeekValue(data, ['telephone', 'phone', 'telephoneNumber', 'phone_number', 'mobile']),
    wilaya: findDeepSeekValue(data, ['wilaya', 'province', 'region', 'state', 'ville']),
  };
};

export async function extractRecruitmentDataWithDeepSeek(text, fallbackOcrData = null) {
  const apiUrl = import.meta.env.VITE_DEEPSEEK_API_URL;
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

  if (!apiUrl) {
    throw new Error('DeepSeek API non configurée. Ajoutez VITE_DEEPSEEK_API_URL.');
  }

  const payload = {
    source: 'ocr',
    schema: {
      nom: 'string',
      prenom: 'string',
      dateNaissance: 'string',
      numCin: 'string',
      telephone: 'string',
      wilaya: 'string',
    },
    input: text,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Erreur DeepSeek : ${response.status} ${response.statusText} ${body}`);
  }

  const raw = await response.json();
  let result = normalizeDeepSeekResponse(raw);

  // Fallback sur les données OCR parsées si les champs sont vides
  if (fallbackOcrData && typeof fallbackOcrData === 'object') {
    result = {
      nom: result.nom || fallbackOcrData.nom || '',
      prenom: result.prenom || fallbackOcrData.prenom || '',
      dateNaissance: result.dateNaissance || fallbackOcrData.dateNaissance || '',
      numCin: result.numCin || fallbackOcrData.numCin || '',
      telephone: result.telephone || fallbackOcrData.telephone || '',
      wilaya: result.wilaya || fallbackOcrData.wilaya || '',
    };
  }

  return result;
}
