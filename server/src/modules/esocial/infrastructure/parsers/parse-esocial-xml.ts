import { Inject, Injectable } from '@nestjs/common';
import { stripNamespaces } from '../../utils/strip-namespaces';
import { detectDocumentType, EsocialDocumentDetectionResult } from './detect-esocial-document-type';
import { XmlParserAdapter } from './xml-parser.adapter';

export interface ParsedEsocialXml {
  parsed: unknown;
  rawParsed: unknown;
  detection: EsocialDocumentDetectionResult;
}

@Injectable()
export class ParseEsocialXmlService {
  constructor(
    @Inject('XML_PARSER_ADAPTER')
    private readonly parserAdapter: XmlParserAdapter
  ) {}

  execute(xml: string): ParsedEsocialXml {
    const rawParsed = this.parserAdapter.parse(xml);
    const parsed = stripNamespaces(rawParsed);
    const detection = detectDocumentType(parsed);

    return {
      parsed,
      rawParsed,
      detection
    };
  }
}

export const parseXml = (xml: string, parserAdapter: XmlParserAdapter): ParsedEsocialXml => {
  const service = new ParseEsocialXmlService(parserAdapter);
  return service.execute(xml);
};
