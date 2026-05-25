import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { CreateResourceNodeDto } from './dto/create-resource-node.dto';
import { UpdateResourceNodeDto } from './dto/update-resource-node.dto';
import { MoveResourceNodeDto } from './dto/move-resource-node.dto';
import { Prisma } from '@prisma/client';

const nodeSelect = {
  id: true,
  parentId: true,
  name: true,
  type: true,
  region: true,
  assetId: true,
  url: true,
  description: true,
  mimeType: true,
  fileSize: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ResourceNodeSelect;

type NodeRow = Prisma.ResourceNodeGetPayload<{ select: typeof nodeSelect }>;

export interface TreeNode extends NodeRow {
  children: TreeNode[];
  asset?: { id: string; url: string; filename: string; mimeType: string; size: number } | null;
}

@Injectable()
export class ResourceLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileAssetsService: FileAssetsService,
  ) {}

  /** 获取完整树结构（按 parentId=null 作为根节点递归展开） */
  async getTree(region?: string): Promise<TreeNode[]> {
    const where: Prisma.ResourceNodeWhereInput = {};
    if (region) {
      where.OR = [{ region }, { region: null }];
    }

    const allNodes = await this.prisma.resourceNode.findMany({
      where,
      select: nodeSelect,
      orderBy: { sortOrder: 'asc' },
    });

    const assetIds = [...new Set(allNodes.filter((n) => n.assetId).map((n) => n.assetId!))];
    const assetMap = new Map<string, TreeNode['asset']>();

    await Promise.all(
      assetIds.map(async (assetId) => {
        try {
          const result = await this.fileAssetsService.getAssetLongLivedUrl(assetId);
          const asset = await this.prisma.fileAsset.findUnique({
            where: { id: assetId },
            select: { filename: true, mimeType: true, size: true },
          });
          assetMap.set(assetId, {
            id: assetId,
            url: result.url,
            filename: asset?.filename ?? '',
            mimeType: asset?.mimeType ?? '',
            size: asset?.size ?? 0,
          });
        } catch {
          assetMap.set(assetId, null);
        }
      }),
    );

    const nodesWithAsset: TreeNode[] = allNodes.map((n) => ({
      ...n,
      children: [],
      asset: n.assetId ? (assetMap.get(n.assetId) ?? null) : null,
    }));

    return this.buildTree(nodesWithAsset, null);
  }

  /** 获取单个节点详情 */
  async getNode(id: string): Promise<TreeNode> {
    const node = await this.prisma.resourceNode.findUnique({
      where: { id },
      select: nodeSelect,
    });

    if (!node) {
      throw new NotFoundException('资源节点不存在');
    }

    let asset: TreeNode['asset'] = null;
    if (node.assetId) {
      try {
        const result = await this.fileAssetsService.getAssetLongLivedUrl(node.assetId);
        const fileAsset = await this.prisma.fileAsset.findUnique({
          where: { id: node.assetId },
          select: { filename: true, mimeType: true, size: true },
        });
        asset = {
          id: node.assetId,
          url: result.url,
          filename: fileAsset?.filename ?? '',
          mimeType: fileAsset?.mimeType ?? '',
          size: fileAsset?.size ?? 0,
        };
      } catch {
        asset = null;
      }
    }

    return { ...node, children: [], asset };
  }

  /** 创建节点（文件夹或资源项） */
  async createNode(dto: CreateResourceNodeDto) {
    if (dto.parentId) {
      const parent = await this.prisma.resourceNode.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('父节点不存在');
      }
      if (parent.type !== 'folder') {
        throw new BadRequestException('只能在文件夹下创建节点');
      }
    }

    if (dto.type !== 'folder' && dto.type !== 'video_url') {
      if (!dto.assetId) {
        throw new BadRequestException('文件类型资源必须关联 COS 文件（assetId）');
      }
    }

    if (dto.type === 'video_url' && !dto.url) {
      throw new BadRequestException('视频地址类型必须提供 URL');
    }

    return this.prisma.resourceNode.create({
      data: {
        parentId: dto.parentId ?? null,
        name: dto.name,
        type: dto.type,
        region: dto.region ?? null,
        assetId: dto.assetId ?? null,
        url: dto.url ?? null,
        description: dto.description ?? null,
        mimeType: dto.mimeType ?? null,
        fileSize: dto.fileSize ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
      select: nodeSelect,
    });
  }

  /** 更新节点 */
  async updateNode(id: string, dto: UpdateResourceNodeDto) {
    const node = await this.prisma.resourceNode.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException('资源节点不存在');
    }

    if (dto.type !== undefined && dto.type !== 'folder' && dto.type !== 'video_url') {
      if (!dto.assetId && !node.assetId) {
        throw new BadRequestException('文件类型资源必须关联 COS 文件');
      }
    }

    if (dto.type === 'video_url' && !dto.url && !node.url) {
      throw new BadRequestException('视频地址类型必须提供 URL');
    }

    return this.prisma.resourceNode.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.assetId !== undefined && { assetId: dto.assetId }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.mimeType !== undefined && { mimeType: dto.mimeType }),
        ...(dto.fileSize !== undefined && { fileSize: dto.fileSize }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      select: nodeSelect,
    });
  }

  /** 删除节点（级联删除所有子节点） */
  async deleteNode(id: string) {
    const node = await this.prisma.resourceNode.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException('资源节点不存在');
    }

    const idsToDelete = await this.collectDescendantIds(id);

    await this.prisma.resourceNode.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    return { deleted: idsToDelete.length };
  }

  /** 移动节点到新父节点 */
  async moveNode(id: string, dto: MoveResourceNodeDto) {
    const node = await this.prisma.resourceNode.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException('资源节点不存在');
    }

    if (dto.parentId) {
      const descendants = await this.collectDescendantIds(id);
      if (descendants.includes(dto.parentId)) {
        throw new BadRequestException('不能将节点移动到其子节点下');
      }

      const parent = await this.prisma.resourceNode.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('目标父节点不存在');
      }
      if (parent.type !== 'folder') {
        throw new BadRequestException('只能移动到文件夹下');
      }
    }

    return this.prisma.resourceNode.update({
      where: { id },
      data: {
        parentId: dto.parentId ?? null,
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      select: nodeSelect,
    });
  }

  /** 获取 COS 上传凭证 */
  async getUploadPolicy(filename: string, sha256?: string, mimeType?: string) {
    return this.fileAssetsService.createCosPolicy({
      group: 'library',
      filename,
      sha256,
      mimeType,
    });
  }

  /** 确认 COS 上传完成 */
  async completeUpload(key: string, sha256: string, size: number, filename: string, mimeType?: string) {
    return this.fileAssetsService.completeUpload({
      group: 'library',
      key,
      sha256,
      size,
      filename,
      mimeType,
    });
  }

  /** 获取地区列表 */
  async getRegions() {
    const regions = await this.prisma.resourceNode.findMany({
      where: { region: { not: null } },
      select: { region: true },
      distinct: ['region'],
    });
    return regions.map((r) => r.region).filter(Boolean);
  }

  // ─── 私有方法 ──────────────────────────────────────────────

  private buildTree(nodes: TreeNode[], parentId: string | null): TreeNode[] {
    return nodes
      .filter((n) => n.parentId === parentId)
      .map((n) => ({
        ...n,
        children: this.buildTree(nodes, n.id),
      }));
  }

  private async collectDescendantIds(id: string): Promise<string[]> {
    const result: string[] = [id];
    const children = await this.prisma.resourceNode.findMany({
      where: { parentId: id },
      select: { id: true },
    });

    for (const child of children) {
      const childDescendants = await this.collectDescendantIds(child.id);
      result.push(...childDescendants);
    }

    return result;
  }
}
