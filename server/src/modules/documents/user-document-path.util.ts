import { join } from 'node:path';

export type UserDocumentType =
  | 'holerite'
  | 'informe'
  | 'informes'
  | 'informe_rendimentos'
  | 'trct'
  | 'termo_quitacao'
  | 'aviso_previo'
  | 'recibo_ferias'
  | 'aviso_ferias'
  | 'rescisao'
  | 'rescisoes'
  | 'documento'
  | 'documentos'
  | string;

const sanitizePathSegment = (value: string) => {
  return String(value ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^\.+$/, 'segment')
    .replace(/\s+/g, '-')
    .slice(0, 120);
};

const resolveTypeFolder = (type: UserDocumentType) => {
  const normalized = String(type ?? '').toLowerCase();

  if (normalized === 'holerite') return 'holerites';
  if (normalized === 'informe' || normalized === 'informes' || normalized === 'informe_rendimentos') {
    return 'informes';
  }
  if (
    normalized === 'trct' ||
    normalized === 'termo_quitacao' ||
    normalized === 'aviso_previo' ||
    normalized === 'recibo_ferias' ||
    normalized === 'aviso_ferias' ||
    normalized === 'rescisao' ||
    normalized === 'rescisoes'
  ) {
    return 'rescisoes';
  }

  return 'documentos';
};

export const getUserDocumentPath = (
  companyId: string,
  userId: string,
  type: UserDocumentType,
  year: number,
  month: number,
  filename: string,
  rootFolder = join(process.cwd(), 'storage')
) => {
  const safeCompanyId = sanitizePathSegment(companyId) || 'company';
  const safeUserId = sanitizePathSegment(userId) || 'user';
  const safeTypeFolder = resolveTypeFolder(type);
  const safeYear = sanitizePathSegment(String(year || new Date().getFullYear()));
  const safeMonth = sanitizePathSegment(String(month || new Date().getMonth() + 1).padStart(2, '0'));
  const safeFilename = sanitizePathSegment(filename) || 'documento.pdf';

  const relativeSegments = ['companies', safeCompanyId, 'users', safeUserId, safeTypeFolder];
  if (safeTypeFolder === 'holerites') {
    relativeSegments.push(safeYear, safeMonth);
  }

  const relativePath = [...relativeSegments, safeFilename].join('/');
  const absolutePath = join(rootFolder, ...relativeSegments, safeFilename);

  return {
    rootFolder,
    relativePath,
    absolutePath,
    folderRelativePath: relativeSegments.join('/'),
    folderAbsolutePath: join(rootFolder, ...relativeSegments),
    typeFolder: safeTypeFolder
  };
};
