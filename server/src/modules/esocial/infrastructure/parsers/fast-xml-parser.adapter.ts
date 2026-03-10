import { Injectable } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { XmlParserAdapter } from './xml-parser.adapter';

@Injectable()
export class FastXmlParserAdapter implements XmlParserAdapter {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
    allowBooleanAttributes: true
  });

  parse(xml: string): unknown {
    const validation = XMLValidator.validate(xml);
    if (validation !== true) {
      throw new Error(`Malformed XML: ${validation.err.msg}`);
    }

    return this.parser.parse(xml);
  }
}
