import { Injectable } from '@nestjs/common';
import { extname } from 'node:path';
import * as XLSX from 'xlsx';

export type UploadDocumentCategory = 'cartao_ponto' | 'rg' | 'cpf' | 'cnh' | 'outros';
export type ExtractionStatus = 'ok' | 'partial' | 'unavailable';

export interface DocumentExtractionResult {
  requestedCategory: UploadDocumentCategory;
  detectedCategory: UploadDocumentCategory;
  status: ExtractionStatus;
  engine: string;
  profile?: {
    ocrProfile: string;
    source: string;
    layoutHint: string | null;
  };
  textPreview: string;
  fullText: string;
  extractedData: Record<string, unknown>;
  warnings: string[];
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff']);
const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.json', '.xml', '.html', '.htm', '.md']);
const EXCEL_EXTENSIONS = new Set(['.xls', '.xlsx', '.xlsm']);

const normalizeCategory = (value?: string): UploadDocumentCategory => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'cartao_ponto') return 'cartao_ponto';
  if (normalized === 'rg') return 'rg';
  if (normalized === 'cpf') return 'cpf';
  if (normalized === 'cnh') return 'cnh';
  return 'outros';
};

const unique = (values: string[]) => Array.from(new Set(values));

const MONTHS_PT: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12
};

const normalizeOcrText = (value: string) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const normalizeOcrDigits = (value: string) =>
  String(value ?? '')
    .replace(/[iIlL|!]/g, '1')
    .replace(/[oODQ]/g, '0')
    .replace(/[sS]/g, '5')
    .replace(/[bB]/g, '8')
    .replace(/[zZ]/g, '2')
    .replace(/[^0-9]/g, '');

const isValidCpf = (digitsOnly: string) => {
  if (!/^\d{11}$/.test(digitsOnly)) return false;
  if (/^(\d)\1{10}$/.test(digitsOnly)) return false;

  const numbers = digitsOnly.split('').map(Number);
  const calc = (slice: number[], factor: number) => {
    const sum = slice.reduce((acc, current, index) => acc + current * (factor - index), 0);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };

  const digit1 = calc(numbers.slice(0, 9), 10);
  const digit2 = calc(numbers.slice(0, 10), 11);
  return digit1 === numbers[9] && digit2 === numbers[10];
};

type TimecardOcrProfileKey = 'timecard_auto' | 'timecard_grid' | 'timecard_dense';

type TimecardOcrProfile = {
  key: TimecardOcrProfileKey;
  psmModes: number[];
  psmBoost: Record<number, number>;
  variantBoost: Record<string, number>;
  minMergeGain: number;
  minDayEntriesTarget: number;
};

type OcrProfileSelectionSource = 'auto' | 'layout_hint' | 'company_override' | 'filename_hint';

const normalizeTimecardProfileKey = (value?: string): TimecardOcrProfileKey | null => {
  const normalized = normalizeOcrText(String(value ?? '')).replace(/\s+/g, '_').trim();
  if (!normalized) return null;

  if (normalized === 'timecard_grid' || normalized === 'grid' || normalized === 'cartao_grid') {
    return 'timecard_grid';
  }
  if (normalized === 'timecard_dense' || normalized === 'dense' || normalized === 'cartao_dense') {
    return 'timecard_dense';
  }
  if (normalized === 'timecard_auto' || normalized === 'auto') {
    return 'timecard_auto';
  }

  return null;
};

const parseCompanyTimecardProfileOverrides = () => {
  const raw = String(process.env.HRPRO_OCR_LAYOUT_OVERRIDES ?? '').trim();
  if (!raw) return {} as Record<string, TimecardOcrProfileKey>;

  const out: Record<string, TimecardOcrProfileKey> = {};

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const [companyId, profileRaw] of Object.entries(parsed ?? {})) {
        const profile = normalizeTimecardProfileKey(profileRaw);
        if (profile && companyId) {
          out[String(companyId).trim()] = profile;
        }
      }
      return out;
    } catch (_error) {
      return out;
    }
  }

  for (const part of raw.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const [companyIdRaw, profileRaw] = token.split(/[:=]/);
    const companyId = String(companyIdRaw ?? '').trim();
    const profile = normalizeTimecardProfileKey(profileRaw);
    if (companyId && profile) {
      out[companyId] = profile;
    }
  }

  return out;
};

const COMPANY_TIMECARD_PROFILE_OVERRIDES = parseCompanyTimecardProfileOverrides();

const TIMECARD_OCR_PROFILES: Record<TimecardOcrProfileKey, TimecardOcrProfile> = {
  timecard_auto: {
    key: 'timecard_auto',
    psmModes: [6, 11],
    psmBoost: { 6: 2, 11: 2 },
    variantBoost: {},
    minMergeGain: 2,
    minDayEntriesTarget: 1
  },
  timecard_grid: {
    key: 'timecard_grid',
    psmModes: [6, 4, 11],
    psmBoost: { 6: 4, 4: 2, 11: 1 },
    variantBoost: {
      thresholded: 3,
      'thresholded-hard': 7,
      contrasted: 5
    },
    minMergeGain: 2,
    minDayEntriesTarget: 1
  },
  timecard_dense: {
    key: 'timecard_dense',
    psmModes: [11, 6, 12],
    psmBoost: { 11: 4, 12: 3, 6: 1 },
    variantBoost: {
      enhanced: 4,
      'thresholded-soft': 8,
      'gamma-boost': 5
    },
    minMergeGain: 1,
    minDayEntriesTarget: 2
  }
};

@Injectable()
export class DocumentReaderService {
  async readDocument(params: {
    buffer: Buffer;
    fileName: string;
    mimeType?: string;
    category?: string;
    companyId?: string;
    layoutHint?: string;
  }): Promise<DocumentExtractionResult> {
    const requestedCategory = normalizeCategory(params.category);
    const warnings: string[] = [];

    const textExtraction = await this.extractText({
      buffer: params.buffer,
      fileName: params.fileName,
      mimeType: params.mimeType,
      requestedCategory,
      companyId: params.companyId,
      layoutHint: params.layoutHint,
      warnings
    });

    const text = textExtraction.text.trim();
    const detectedCategory = this.detectCategory(text, requestedCategory);
    const extractedData = this.extractStructuredData(text, detectedCategory);

    const status: ExtractionStatus =
      text.length > 40 ? 'ok' : text.length > 0 ? 'partial' : 'unavailable';

    return {
      requestedCategory,
      detectedCategory,
      status,
      engine: textExtraction.engine,
      profile: textExtraction.profile,
      textPreview: text.slice(0, 2000),
      fullText: text,
      extractedData,
      warnings
    };
  }

  private async extractText(params: {
    buffer: Buffer;
    fileName: string;
    mimeType?: string;
    requestedCategory: UploadDocumentCategory;
    companyId?: string;
    layoutHint?: string;
    warnings: string[];
  }): Promise<{
    text: string;
    engine: string;
    profile?: { ocrProfile: string; source: string; layoutHint: string | null };
  }> {
    const extension = extname(params.fileName || '').toLowerCase();

    if (TEXT_EXTENSIONS.has(extension)) {
      return {
        text: params.buffer.toString('utf-8'),
        engine: 'plain-text'
      };
    }

    if (EXCEL_EXTENSIONS.has(extension)) {
      try {
        const workbook = XLSX.read(params.buffer, { type: 'buffer', cellDates: true });
        const sheetNames = workbook.SheetNames.slice(0, 2);
        const lines: string[] = [];

        for (const sheetName of sheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
            header: 1,
            raw: false,
            defval: ''
          });

          lines.push(`## Aba: ${sheetName}`);
          for (const row of rows.slice(0, 120)) {
            const rowText = row
              .map((cell) => String(cell ?? '').trim())
              .filter(Boolean)
              .join(' | ');
            if (rowText) lines.push(rowText);
          }
        }

        return {
          text: lines.join('\n'),
          engine: 'xlsx-parser'
        };
      } catch (error) {
        params.warnings.push('Falha ao ler planilha.');
      }
    }

    if (extension === '.pdf' || String(params.mimeType ?? '').toLowerCase().includes('pdf')) {
      try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = (pdfParseModule as any).default ?? (pdfParseModule as any);
        const parsed = await pdfParse(params.buffer);
        return {
          text: String(parsed?.text ?? ''),
          engine: 'pdf-parse'
        };
      } catch (_error) {
        params.warnings.push('Leitura de PDF não disponível. Instale/valide pdf-parse no servidor.');
      }
    }

    if (IMAGE_EXTENSIONS.has(extension) || String(params.mimeType ?? '').startsWith('image/')) {
      try {
        return this.extractTextFromImage(params.buffer, params.warnings, {
          requestedCategory: params.requestedCategory,
          fileName: params.fileName,
          companyId: params.companyId,
          layoutHint: params.layoutHint
        });
      } catch (_error) {
        params.warnings.push('OCR de imagem não disponível. Instale/valide tesseract.js no servidor.');
      }
    }

    return {
      text: '',
      engine: 'none'
    };
  }

  private resolveTimecardProfile(context: {
    requestedCategory: UploadDocumentCategory;
    companyId?: string;
    fileName?: string;
    layoutHint?: string;
  }) {
    if (context.requestedCategory !== 'cartao_ponto') {
      return {
        profile: TIMECARD_OCR_PROFILES.timecard_auto,
        source: 'auto' as OcrProfileSelectionSource
      };
    }

    const byLayoutHint = normalizeTimecardProfileKey(context.layoutHint);
    if (byLayoutHint) {
      return {
        profile: TIMECARD_OCR_PROFILES[byLayoutHint],
        source: 'layout_hint' as OcrProfileSelectionSource
      };
    }

    const companyOverride = context.companyId
      ? COMPANY_TIMECARD_PROFILE_OVERRIDES[String(context.companyId)]
      : undefined;
    if (companyOverride) {
      return {
        profile: TIMECARD_OCR_PROFILES[companyOverride],
        source: 'company_override' as OcrProfileSelectionSource
      };
    }

    const fileName = normalizeOcrText(context.fileName ?? '');
    if (
      fileName.includes('verso') ||
      fileName.includes('ocorrenc') ||
      fileName.includes('observa') ||
      fileName.includes('justific')
    ) {
      return {
        profile: TIMECARD_OCR_PROFILES.timecard_dense,
        source: 'filename_hint' as OcrProfileSelectionSource
      };
    }
    if (
      fileName.includes('frente') ||
      fileName.includes('espelho') ||
      fileName.includes('cartao') ||
      fileName.includes('ponto')
    ) {
      return {
        profile: TIMECARD_OCR_PROFILES.timecard_grid,
        source: 'filename_hint' as OcrProfileSelectionSource
      };
    }

    return {
      profile: TIMECARD_OCR_PROFILES.timecard_auto,
      source: 'auto' as OcrProfileSelectionSource
    };
  }

  private scoreCandidateByProfile(params: {
    profile: TimecardOcrProfile;
    variantName: string;
    psm: number;
  }) {
    const profileVariantBoost = params.profile.variantBoost[params.variantName] ?? 0;
    const profilePsmBoost = params.profile.psmBoost[params.psm] ?? 0;
    return profileVariantBoost + profilePsmBoost;
  }

  private scoreOcrTextForTimecard(text: string) {
    const base = normalizeOcrText(text);
    const timeWithSeparator = (text.match(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/g) ?? []).length;
    const timeWithNoisySeparator =
      (text.match(/\b([01]?\d|2[0-3])\s*[:;,.%º°hH]\s*([0-5]\d)\b/g) ?? []).length;
    const compactTime = (text.match(/\b[0-2][0-9][0-5][0-9]\b/g) ?? []).length;
    const dayRows = (text.match(/(?:^|\n)\s*\d{1,2}\s*[|\- ]/g) ?? []).length;
    const monthHit = Object.keys(MONTHS_PT).some((monthName) => base.includes(monthName)) ? 1 : 0;
    const keywordHit =
      base.includes('cartao') ||
      base.includes('ponto') ||
      base.includes('jornada') ||
      base.includes('funcionario') ||
      base.includes('colaborador')
        ? 1
        : 0;

    return (
      Math.min(text.length, 2500) * 0.01 +
      timeWithSeparator * 12 +
      timeWithNoisySeparator * 10 +
      compactTime * 5 +
      dayRows * 4 +
      monthHit * 8 +
      keywordHit * 6
    );
  }

  private async extractTextFromImage(
    buffer: Buffer,
    warnings: string[],
    context: {
      requestedCategory: UploadDocumentCategory;
      fileName: string;
      companyId?: string;
      layoutHint?: string;
    }
  ) {
    const tesseractModule = await import('tesseract.js');
    const workerFactory = (tesseractModule as any).createWorker;
    if (typeof workerFactory !== 'function') {
      throw new Error('Tesseract createWorker not available');
    }

    const profileSelection = this.resolveTimecardProfile(context);
    const activeProfile = profileSelection.profile;
    if (context.requestedCategory === 'cartao_ponto' && profileSelection.source !== 'auto') {
      warnings.push(`Perfil OCR aplicado: ${activeProfile.key} (${profileSelection.source}).`);
    }

    const variants: Array<{ name: string; buffer: Buffer }> = [{ name: 'original', buffer }];

    try {
      const sharpModule = await import('sharp');
      const sharpFactory = (sharpModule as any).default ?? (sharpModule as any);
      if (typeof sharpFactory === 'function') {
        const metadata = await sharpFactory(buffer, { failOn: 'none' }).metadata();
        const sourceWidth = Number(metadata.width || 1400);
        const targetWidth = Math.max(1600, Math.min(Math.round(sourceWidth * 1.8), 3000));

        const enhanced = await sharpFactory(buffer, { failOn: 'none' })
          .rotate()
          .grayscale()
          .normalize()
          .resize({ width: targetWidth, fit: 'inside', withoutEnlargement: false })
          .sharpen({ sigma: 1.2, m1: 1, m2: 2 })
          .toBuffer();

        const thresholded = await sharpFactory(enhanced, { failOn: 'none' })
          .threshold(155, { grayscale: true })
          .toBuffer();

        const thresholdedSoft = await sharpFactory(enhanced, { failOn: 'none' })
          .threshold(135, { grayscale: true })
          .toBuffer();

        const thresholdedHard = await sharpFactory(enhanced, { failOn: 'none' })
          .threshold(185, { grayscale: true })
          .toBuffer();

        const contrasted = await sharpFactory(enhanced, { failOn: 'none' })
          .linear(1.25, -18)
          .toBuffer();

        const gammaBoost = await sharpFactory(enhanced, { failOn: 'none' })
          .gamma(1.4)
          .linear(1.15, -12)
          .toBuffer();

        variants.push({ name: 'enhanced', buffer: enhanced });
        variants.push({ name: 'thresholded', buffer: thresholded });
        variants.push({ name: 'thresholded-soft', buffer: thresholdedSoft });
        variants.push({ name: 'thresholded-hard', buffer: thresholdedHard });
        variants.push({ name: 'contrasted', buffer: contrasted });
        variants.push({ name: 'gamma-boost', buffer: gammaBoost });
      }
    } catch (_error) {
      warnings.push('Pré-processamento de imagem indisponível; OCR executado sem melhoria visual.');
    }

    const worker = await workerFactory('por+eng');
    const candidates: Array<{
      variant: string;
      text: string;
      score: number;
      timeMarksCount: number;
      dayEntriesCount: number;
    }> = [];
    const psmModes = activeProfile.psmModes;

    try {
      for (const variant of variants) {
        for (const psm of psmModes) {
          try {
            await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
            const result = await worker.recognize(variant.buffer);
            const text = String(result?.data?.text ?? '');
            const times = this.extractTimeMarks(text);
            const dayEntries = this.extractDayEntries(text);
            const hasMonthYear = this.extractMonthYear(text) ? 1 : 0;
            const score =
              this.scoreOcrTextForTimecard(text) +
              times.length * 18 +
              dayEntries.length * 14 +
              hasMonthYear * 8 +
              this.scoreCandidateByProfile({
                profile: activeProfile,
                variantName: variant.name,
                psm
              });

            candidates.push({
              variant: `${variant.name}-psm${psm}`,
              text,
              score,
              timeMarksCount: times.length,
              dayEntriesCount: dayEntries.length
            });
          } catch (_error) {
            warnings.push(`Falha OCR na variação ${variant.name} (psm ${psm}).`);
          }
        }
      }
    } finally {
      await worker.terminate();
    }

    if (candidates.length === 0) {
      return { text: '', engine: 'tesseract-ocr' };
    }

    const best = candidates.sort((a, b) => b.score - a.score)[0];
    const bestTimeRich = candidates
      .slice()
      .sort(
        (a, b) =>
          b.timeMarksCount + b.dayEntriesCount * 2 - (a.timeMarksCount + a.dayEntriesCount * 2)
      )[0];
    const bestDayRich = candidates
      .filter((candidate) => candidate.dayEntriesCount > 0)
      .sort((a, b) => b.dayEntriesCount - a.dayEntriesCount || b.timeMarksCount - a.timeMarksCount)[0];

    const shouldMergeTimeRichVariant =
      bestTimeRich &&
      bestTimeRich.variant !== best.variant &&
      bestTimeRich.timeMarksCount + bestTimeRich.dayEntriesCount * 2 -
        (best.timeMarksCount + best.dayEntriesCount * 2) >=
        activeProfile.minMergeGain;

    let mergedText =
      shouldMergeTimeRichVariant && bestTimeRich
        ? `${best.text}\n${bestTimeRich.text}`
        : best.text;

    const mergedDayEntries = this.extractDayEntries(mergedText).length;
    const shouldInjectDayRichVariant =
      mergedDayEntries < activeProfile.minDayEntriesTarget &&
      bestDayRich &&
      !mergedText.includes(bestDayRich.text) &&
      bestDayRich.variant !== best.variant;

    if (shouldInjectDayRichVariant && bestDayRich) {
      mergedText = `${mergedText}\n${bestDayRich.text}`;
    }

    return {
      text: mergedText,
      profile: {
        ocrProfile: activeProfile.key,
        source: profileSelection.source,
        layoutHint: context.layoutHint ? String(context.layoutHint) : null
      },
      engine:
        shouldInjectDayRichVariant && bestDayRich
          ? `tesseract-ocr+${best.variant}+${bestDayRich.variant}`
          : shouldMergeTimeRichVariant && bestTimeRich
            ? `tesseract-ocr+${best.variant}+${bestTimeRich.variant}`
            : best.variant.startsWith('original-')
              ? 'tesseract-ocr'
              : `tesseract-ocr+${best.variant}`
    };
  }

  private detectCategory(text: string, requested: UploadDocumentCategory): UploadDocumentCategory {
    if (requested !== 'outros') return requested;
    const base = normalizeOcrText(text);

    if (
      base.includes('cartao de ponto') ||
      base.includes('espelho de ponto') ||
      base.includes('controle de jornada') ||
      base.includes('registro de ponto') ||
      base.includes('batidas')
    ) {
      return 'cartao_ponto';
    }
    if (
      base.includes('carteira nacional de habilitacao') ||
      base.includes('registro cnh') ||
      base.includes('categoria de habilitacao')
    ) {
      return 'cnh';
    }
    if (base.includes('registro geral') || base.includes('identidade') || /\brg\b/.test(base)) {
      return 'rg';
    }
    if (base.includes('cadastro de pessoa fisica') || /\bcpf\b/.test(base)) {
      return 'cpf';
    }

    return 'outros';
  }

  private extractStructuredData(text: string, category: UploadDocumentCategory) {
    const cpfs = this.extractCpfs(text);
    const rgs = this.extractRgs(text);
    const cnhs = this.extractCnhs(text);

    const baseData: Record<string, unknown> = {
      cpfs,
      rgs,
      cnhs
    };

    if (category === 'cartao_ponto') {
      const times = this.extractTimeMarks(text);
      const monthYear = this.extractMonthYear(text);
      const dayEntries = this.extractDayEntries(text);

      const explicitDates = unique(Array.from(text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) ?? []));
      const derivedDates =
        explicitDates.length === 0 && monthYear
          ? unique(
              dayEntries
                .map((entry) => {
                  const day = String(entry.day).padStart(2, '0');
                  const month = String(monthYear.month).padStart(2, '0');
                  return `${day}/${month}/${monthYear.year}`;
                })
                .filter(Boolean)
            )
          : [];

      const dates = explicitDates.length > 0 ? explicitDates : derivedDates;
      const employeeName =
        text.match(/(?:funcion[aá]rio|colaborador|empregado|nome)\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ??
        this.extractLikelyPersonName(text) ??
        null;

      return {
        ...baseData,
        employeeName,
        timeMarks: times.slice(0, 150),
        dates: dates.slice(0, 120),
        totalTimeMarks: times.length,
        totalDates: dates.length,
        totalDayEntries: dayEntries.length,
        dayEntries: dayEntries.slice(0, 60),
        competenceMonth: monthYear?.month ?? null,
        competenceYear: monthYear?.year ?? null,
        periodStart: dates[0] ?? null,
        periodEnd: dates.length > 0 ? dates[dates.length - 1] : null
      };
    }

    if (category === 'rg') {
      const issuer = text.match(/(?:[óo]rg[aã]o emissor|ssp\/?[a-z]{2})\s*[:\-]?\s*([^\n\r]+)/i)?.[1]?.trim();
      return {
        ...baseData,
        mainRg: rgs[0] ?? null,
        issuer: issuer || null
      };
    }

    if (category === 'cpf') {
      return {
        ...baseData,
        mainCpf: cpfs[0] ?? null
      };
    }

    if (category === 'cnh') {
      const validity = text.match(/validade\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ?? null;
      return {
        ...baseData,
        mainCnh: cnhs[0] ?? null,
        validity
      };
    }

    return baseData;
  }

  private extractCpfs(text: string): string[] {
    const regex = /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b|\b\d{11}\b/g;
    const matches = text.match(regex) ?? [];
    return unique(matches.map((value) => value.replace(/\D/g, '')).filter(isValidCpf));
  }

  private extractRgs(text: string): string[] {
    const labelled = Array.from(
      text.matchAll(/(?:\brg\b|registro\s+geral|identidade)\s*[:\-]?\s*([0-9.\-xX]{5,20})/gi)
    ).map((match) => String(match[1] ?? '').trim());

    const generic = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[0-9xX]\b/g) ?? [];

    return unique(
      [...labelled, ...generic]
        .map((value) => value.toUpperCase())
        .map((value) => value.replace(/\s+/g, ''))
        .filter((value) => /^[0-9.\-X]{5,20}$/.test(value))
    );
  }

  private extractCnhs(text: string): string[] {
    const labelled = Array.from(
      text.matchAll(/(?:registro\s*n(?:o|º)?\s*cnh|n(?:o|º)?\s*registro|\bcnh\b)\s*[:\-]?\s*(\d{11})/gi)
    ).map((match) => String(match[1] ?? '').trim());

    if (labelled.length > 0) {
      return unique(labelled);
    }

    const generic = text.match(/\b\d{11}\b/g) ?? [];
    return unique(generic.filter((value) => !isValidCpf(value)));
  }

  private extractMonthYear(text: string) {
    const normalized = normalizeOcrText(text);
    const monthName = Object.keys(MONTHS_PT).find((name) => normalized.includes(name));
    const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);

    if (!monthName || !yearMatch) return null;
    return {
      month: MONTHS_PT[monthName],
      year: Number(yearMatch[0])
    };
  }

  private extractLikelyPersonName(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const candidate = line.includes('|') ? line.split('|').pop() ?? '' : line;
      const cleaned = candidate.replace(/[^A-Za-zÀ-ÿ\s.]/g, ' ').replace(/\s+/g, ' ').trim();
      const normalizedCleaned = normalizeOcrText(cleaned);
      const words = cleaned.split(' ').filter((word) => /^[A-Za-zÀ-ÿ]{2,}$/.test(word));
      const hasFewDigits = (candidate.match(/\d/g) ?? []).length <= 2;
      const hasPipe = line.includes('|');
      const hasForbiddenTerms =
        normalizedCleaned.includes('recebi') ||
        normalizedCleaned.includes('saldo') ||
        normalizedCleaned.includes('observa') ||
        normalizedCleaned.includes('assinatura') ||
        normalizedCleaned.includes('mencionad');

      if (!hasForbiddenTerms && ((hasPipe && words.length >= 2) || words.length >= 3) && hasFewDigits) {
        return words.join(' ');
      }
    }

    return null;
  }

  private extractTimeMarks(text: string) {
    const marks = new Set<string>();

    const addTimeMark = (rawHour: string, rawMinute: string) => {
      const hour = Number(rawHour);
      const minute = Number(rawMinute);
      if (Number.isNaN(hour) || Number.isNaN(minute)) return;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return;
      marks.add(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    };

    for (const match of text.matchAll(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/g)) {
      addTimeMark(String(match[1] ?? ''), String(match[2] ?? ''));
    }

    for (const match of text.matchAll(/\b([01]?\d|2[0-3])\s*[:;,.%º°]\s*([0-5]\d)\b/g)) {
      addTimeMark(String(match[1] ?? ''), String(match[2] ?? ''));
    }

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const normalizedLine = normalizeOcrText(line);
      const lineHasMonthName = Object.keys(MONTHS_PT).some((monthName) => normalizedLine.includes(monthName));
      const tokenCandidates = line.match(/[0-9iIlL|!oODQsSbBzZ]{3,4}/g) ?? [];

      for (const rawToken of tokenCandidates) {
        const token = normalizeOcrDigits(rawToken);
        if (token.length !== 3 && token.length !== 4) continue;

        if (token.length === 4) {
          const asYear = Number(token);
          if (lineHasMonthName && asYear >= 1900 && asYear <= 2100) continue;
        }

        const hour = token.length === 3 ? Number(token.slice(0, 1)) : Number(token.slice(0, 2));
        const minute = Number(token.slice(-2));

        if (Number.isNaN(hour) || Number.isNaN(minute)) continue;
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) continue;

        marks.add(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    }

    return Array.from(marks);
  }

  private extractLikelyDayFromLine(line: string) {
    const compact = String(line ?? '').replace(/\s+/g, ' ').trim();
    if (!compact) return null;

    const startMatch = compact.match(/^\D{0,3}([0-2]?\d|3[0-1])(?:\D|$)/);
    if (startMatch) {
      const day = Number(startMatch[1]);
      if (!Number.isNaN(day) && day >= 1 && day <= 31) return day;
    }

    const pipeMatch = compact.match(/(?:^|\|)\s*([0-2]?\d|3[0-1])\s*(?=\||$)/);
    if (pipeMatch) {
      const day = Number(pipeMatch[1]);
      if (!Number.isNaN(day) && day >= 1 && day <= 31) return day;
    }

    for (const match of compact.matchAll(/\b(\d{1,2})\b/g)) {
      const token = String(match[1] ?? '');
      const day = Number(token);
      const index = Number(match.index ?? 0);
      const nextChar = compact[index + token.length] ?? ' ';

      if (nextChar === ':' || nextChar === 'h' || nextChar === 'H') continue;
      if (index > 6) continue;
      if (Number.isNaN(day) || day < 1 || day > 31) continue;

      return day;
    }

    return null;
  }

  private extractDayEntries(text: string) {
    const byDay = new Map<number, { day: number; times: Set<string>; rawLines: Set<string> }>();

    const appendEntry = (day: number, times: string[], rawLine: string) => {
      const existing = byDay.get(day) ?? {
        day,
        times: new Set<string>(),
        rawLines: new Set<string>()
      };

      for (const time of times) existing.times.add(time);
      existing.rawLines.add(rawLine);
      byDay.set(day, existing);
    };

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const day = this.extractLikelyDayFromLine(line);
      if (day === null) continue;

      const collectedTimes = new Set<string>(this.extractTimeMarks(line));

      if (collectedTimes.size === 0) {
        for (let lookahead = 1; lookahead <= 2; lookahead += 1) {
          const neighbor = lines[index + lookahead];
          if (!neighbor) break;
          if (this.extractLikelyDayFromLine(neighbor) !== null) break;

          for (const time of this.extractTimeMarks(neighbor)) {
            collectedTimes.add(time);
          }
        }
      }

      if (collectedTimes.size === 0) continue;

      appendEntry(day, Array.from(collectedTimes), line);
    }

    return Array.from(byDay.values())
      .sort((a, b) => a.day - b.day)
      .map((entry) => ({
        day: entry.day,
        times: Array.from(entry.times).sort(),
        rawLine: Array.from(entry.rawLines).join(' || ')
      }));
  }
}
