import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Payslip } from './payslip-data.builder';
import { renderPayslipHtml } from './payslip-template';

type BrowserLike = {
  newPage: (options?: Record<string, unknown>) => Promise<{
    setContent: (html: string, options?: Record<string, unknown>) => Promise<void>;
    pdf: (options?: Record<string, unknown>) => Promise<Buffer>;
    close: () => Promise<void>;
  }>;
  close: () => Promise<void>;
};

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<Record<string, any>>;

@Injectable()
export class PayslipPdfService {
  async generatePayslipPdf(payslip: Payslip): Promise<Buffer> {
    const html = renderPayslipHtml(payslip);
    return this.generatePdfFromHtml(html);
  }

  private async generatePdfFromHtml(html: string): Promise<Buffer> {
    const playwright = await this.loadPlaywright();
    let browser: BrowserLike | null = null;
    let page: Awaited<ReturnType<BrowserLike['newPage']>> | null = null;

    try {
      browser = (await playwright.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })) as BrowserLike;

      page = await browser.newPage({ locale: 'pt-BR' });
      await page.setContent(html, { waitUntil: 'networkidle' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      });

      return Buffer.from(pdf);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown HTML to PDF error';
      throw new InternalServerErrorException(`Failed to generate payslip PDF: ${message}`);
    } finally {
      if (page) {
        await page.close().catch(() => undefined);
      }
      if (browser) {
        await browser.close().catch(() => undefined);
      }
    }
  }

  private async loadPlaywright() {
    try {
      return await dynamicImport('playwright');
    } catch (_error) {
      throw new InternalServerErrorException(
        'Playwright is required for payslip PDF generation. Install with: npm --prefix server install playwright'
      );
    }
  }
}
