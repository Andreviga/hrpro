import { Injectable } from '@nestjs/common';
import { EsocialRepository } from '../../infrastructure/repositories/esocial.repository';
import { DEFAULT_ESOCIAL_MESSAGE_CATALOG } from '../../infrastructure/catalog/default-esocial-message-catalog';

interface CatalogEntry {
  code: string;
  officialDescription: string;
  probableCause?: string | null;
  suggestedAction?: string | null;
  category?: string | null;
}

@Injectable()
export class EsocialMessageCatalogService {
  constructor(private readonly repository: EsocialRepository) {}

  async enrichOccurrences<T extends { code?: string }>(occurrences: T[]) {
    const codes = [...new Set(occurrences.map((item) => item.code).filter((code): code is string => Boolean(code)))];
    const catalogRows = (await this.repository.findCatalogByCodes(codes)) as CatalogEntry[];
    const catalogByCode = new Map<string, CatalogEntry>(catalogRows.map((row) => [row.code, row]));

    return occurrences.map((occurrence) => {
      const catalog = occurrence.code ? catalogByCode.get(occurrence.code) : undefined;
      return {
        ...occurrence,
        officialCatalogDescription: catalog?.officialDescription,
        probableCause: catalog?.probableCause,
        suggestedAction: catalog?.suggestedAction,
        category: catalog?.category
      };
    });
  }

  async syncDefaultCatalog() {
    return this.repository.syncCatalog(DEFAULT_ESOCIAL_MESSAGE_CATALOG);
  }

  async syncCatalog(entries: Array<{
    code: string;
    officialDescription: string;
    humanExplanation?: string;
    probableCause?: string;
    suggestedAction?: string;
    category?: string;
  }>) {
    return this.repository.syncCatalog(entries);
  }
}
