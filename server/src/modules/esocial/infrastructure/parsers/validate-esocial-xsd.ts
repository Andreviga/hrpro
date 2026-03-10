import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { EsocialDocumentType } from '../../domain/enums/esocial-document-type.enum';
import { EsocialXsdValidationResult } from '../../domain/interfaces/esocial-xsd-validation.interface';

interface ValidateInput {
  xml: string;
  documentType: EsocialDocumentType;
  eventType?: string;
  layoutVersion?: string;
  enabled?: boolean;
}

const listFilesRecursive = (directoryPath: string): string[] => {
  if (!existsSync(directoryPath)) return [];

  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.xsd')) {
      files.push(absolutePath);
    }
  }

  return files;
};

const pickSchemaPath = (params: {
  xsdRootPath: string;
  documentType: EsocialDocumentType;
  eventType?: string;
  layoutVersion?: string;
}): string | undefined => {
  const allFiles = listFilesRecursive(params.xsdRootPath);
  if (allFiles.length === 0) return undefined;

  const layoutToken = String(params.layoutVersion ?? '').toLowerCase();
  const eventToken = String(params.eventType ?? '').toLowerCase();
  const docToken = String(params.documentType ?? '').toLowerCase();

  const ranked = allFiles
    .map((filePath) => {
      const lowered = filePath.toLowerCase();
      let score = 0;
      if (layoutToken && lowered.includes(layoutToken)) score += 3;
      if (eventToken && lowered.includes(eventToken)) score += 4;
      if (docToken && lowered.includes(docToken)) score += 2;
      if (lowered.includes('esocial')) score += 1;
      return { filePath, score };
    })
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.filePath;
};

@Injectable()
export class ValidateEsocialXsdService {
  private readonly logger = new Logger(ValidateEsocialXsdService.name);
  private readonly xsdRootPath = join(__dirname, '..', 'xsd');

  async execute(input: ValidateInput): Promise<EsocialXsdValidationResult> {
    if (!input.enabled) {
      return {
        status: 'skipped',
        errors: ['XSD validation disabled for this import.']
      };
    }

    const schemaPath = pickSchemaPath({
      xsdRootPath: this.xsdRootPath,
      documentType: input.documentType,
      eventType: input.eventType,
      layoutVersion: input.layoutVersion
    });

    if (!schemaPath) {
      return {
        status: 'skipped',
        errors: ['No schema found for this XML type/version.'],
      };
    }

    let validator: any;
    try {
      // Lazy load keeps adapter swappable and avoids hard dependency at startup.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      validator = require('xsd-schema-validator');
    } catch {
      return {
        status: 'skipped',
        schemaPath,
        errors: ['xsd-schema-validator package is not installed.']
      };
    }

    try {
      const result = await new Promise<any>((resolve, reject) => {
        validator.validateXML(input.xml, schemaPath, (error: Error | null, response: any) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(response);
        });
      });

      if (result?.valid) {
        return {
          status: 'validated',
          schemaPath,
          errors: []
        };
      }

      return {
        status: 'failed',
        schemaPath,
        errors: [String(result?.messages ?? 'Unknown XSD validation error')]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`XSD validation failed: ${message}`);
      return {
        status: 'failed',
        schemaPath,
        errors: [message]
      };
    }
  }
}

export const validateEsocialXsd = (service: ValidateEsocialXsdService, input: ValidateInput) => {
  return service.execute(input);
};
