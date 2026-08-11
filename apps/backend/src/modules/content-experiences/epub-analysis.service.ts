import { BadRequestException, Injectable } from '@nestjs/common';
import AdmZip = require('adm-zip');
import { posix } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileAssetsService } from '../file-assets/file-assets.service';

export type EpubTocItem = { label: string; href: string; children?: EpubTocItem[] };

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (value && typeof value === 'object' && '#text' in value) return cleanText((value as any)['#text']);
  return '';
}

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveBookHref(opfPath: string, href: string) {
  const [file, fragment] = href.split('#', 2);
  const resolved = posix.normalize(posix.join(posix.dirname(opfPath), decodeURIComponent(file || '')));
  return fragment ? `${resolved}#${fragment}` : resolved;
}

@Injectable()
export class EpubAnalysisService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    trimValues: true,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileAssets: FileAssetsService,
  ) {}

  async analyzeAsset(assetId: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new BadRequestException('EPUB 文件不存在');
    if (!asset.filename.toLowerCase().endsWith('.epub') && !asset.mimeType.includes('epub')) {
      throw new BadRequestException('仅支持 .epub 文件');
    }
    if (asset.size > 100 * 1024 * 1024) throw new BadRequestException('EPUB 文件不能超过 100MB');

    const signed = await this.fileAssets.getPrivateUrlByAssetId(assetId);
    const response = await fetch(signed.url);
    if (!response.ok) throw new BadRequestException(`EPUB 下载失败 (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    if (entries.length === 0 || entries.length > 10_000) throw new BadRequestException('EPUB 文件结构异常');
    if (entries.some((entry) => entry.entryName.startsWith('/') || entry.entryName.split('/').includes('..'))) {
      throw new BadRequestException('EPUB 包含不安全路径');
    }
    const unpackedSize = entries.reduce((sum, entry) => sum + Number(entry.header.size || 0), 0);
    if (unpackedSize > 500 * 1024 * 1024) throw new BadRequestException('EPUB 解压后内容过大');

    const mimetype = zip.getEntry('mimetype')?.getData().toString('utf8').trim();
    if (mimetype && mimetype !== 'application/epub+zip') {
      throw new BadRequestException('不是有效的 EPUB 文件');
    }

    const containerEntry = zip.getEntry('META-INF/container.xml');
    if (!containerEntry) throw new BadRequestException('EPUB 缺少 META-INF/container.xml');
    const container = this.parser.parse(containerEntry.getData().toString('utf8'));
    const rootfile = asArray(container?.container?.rootfiles?.rootfile)[0];
    const opfPath = rootfile?.['full-path'];
    if (!opfPath || typeof opfPath !== 'string') throw new BadRequestException('EPUB 无法定位 OPF');
    const opfEntry = zip.getEntry(opfPath);
    if (!opfEntry) throw new BadRequestException('EPUB OPF 文件不存在');

    const pkg = this.parser.parse(opfEntry.getData().toString('utf8'))?.package;
    if (!pkg) throw new BadRequestException('EPUB OPF 无法解析');
    const manifestItems = asArray<any>(pkg.manifest?.item);
    const manifestById = new Map(manifestItems.map((item) => [String(item.id), item]));
    const spineRefs = asArray<any>(pkg.spine?.itemref);
    const metadata = pkg.metadata ?? {};
    const warnings: string[] = [];

    const scriptedEntries = entries.filter((entry) => {
      if (!/\.(xhtml|html|htm)$/i.test(entry.entryName)) return false;
      return /<script\b/i.test(entry.getData().toString('utf8'));
    });
    if (scriptedEntries.length > 0) warnings.push(`检测到 ${scriptedEntries.length} 个含脚本章节，阅读器将保持脚本禁用`);

    const navItem = manifestItems.find((item) => String(item.properties || '').split(/\s+/).includes('nav'));
    let toc: EpubTocItem[] = navItem ? this.parseHtmlNav(zip, opfPath, navItem.href) : [];
    if (toc.length === 0) {
      const ncxId = pkg.spine?.toc;
      const ncxItem = (ncxId && manifestById.get(String(ncxId)))
        || manifestItems.find((item) => item['media-type'] === 'application/x-dtbncx+xml');
      if (ncxItem) toc = this.parseNcx(zip, opfPath, ncxItem.href);
    }
    if (toc.length === 0) {
      toc = spineRefs
        .map((ref: any, index: number) => manifestById.get(String(ref.idref)) ? { ref, item: manifestById.get(String(ref.idref)), index } : null)
        .filter(Boolean)
        .map(({ item, index }: any) => ({
          label: `第 ${index + 1} 章`,
          href: resolveBookHref(opfPath, String(item.href)),
        }));
      warnings.push('未找到标准目录，已根据阅读顺序生成章节目录');
    }

    const coverId = asArray<any>(metadata.meta).find((item) => item.name === 'cover')?.content;
    const coverItem = coverId
      ? manifestById.get(String(coverId))
      : manifestItems.find((item) => String(item.properties || '').split(/\s+/).includes('cover-image'));

    return {
      asset: { id: asset.id, filename: asset.filename, size: asset.size, mimeType: asset.mimeType },
      metadata: {
        title: cleanText(metadata.title) || asset.filename.replace(/\.epub$/i, ''),
        creator: cleanText(metadata.creator),
        language: cleanText(metadata.language),
        identifier: cleanText(metadata.identifier),
        publisher: cleanText(metadata.publisher),
        description: cleanText(metadata.description),
        coverPath: coverItem?.href ? resolveBookHref(opfPath, String(coverItem.href)) : null,
        opfPath,
        chapterCount: toc.length,
        spineCount: spineRefs.length,
        unpackedSize,
      },
      toc,
      warnings,
    };
  }

  private parseHtmlNav(zip: AdmZip, opfPath: string, rawHref: string): EpubTocItem[] {
    const navPath = resolveBookHref(opfPath, rawHref).split('#')[0];
    const entry = zip.getEntry(navPath);
    if (!entry) return [];
    const html = entry.getData().toString('utf8');
    const navMatch = html.match(/<nav\b[^>]*(?:epub:type|type)=["'][^"']*toc[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i);
    const source = navMatch?.[1] ?? html;
    const result: EpubTocItem[] = [];
    const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorPattern.exec(source))) {
      const label = decodeHtml(match[2]);
      if (label) result.push({ label, href: resolveBookHref(navPath, match[1]) });
    }
    return result;
  }

  private parseNcx(zip: AdmZip, opfPath: string, rawHref: string): EpubTocItem[] {
    const ncxPath = resolveBookHref(opfPath, rawHref).split('#')[0];
    const entry = zip.getEntry(ncxPath);
    if (!entry) return [];
    const parsed = this.parser.parse(entry.getData().toString('utf8'));
    const walk = (points: any[]): EpubTocItem[] => asArray(points).map((point: any) => ({
      label: cleanText(point.navLabel?.text) || '未命名章节',
      href: resolveBookHref(ncxPath, String(point.content?.src || '')),
      ...(point.navPoint ? { children: walk(point.navPoint) } : {}),
    }));
    return walk(parsed?.ncx?.navMap?.navPoint);
  }
}
