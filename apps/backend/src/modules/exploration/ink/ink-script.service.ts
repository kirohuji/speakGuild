import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class InkScriptService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取 Ink 编译后的 JSON（前端 inkjs 直接加载）
   */
  async getByKey(key: string) {
    return this.prisma.inkScript.findUnique({
      where: { key },
      select: {
        id: true,
        key: true,
        title: true,
        scriptType: true,
        inkJson: true,
        version: true,
      },
    });
  }

  /**
   * 获取脚本中声明的变量列表
   */
  async getVariables(key: string) {
    const script = await this.prisma.inkScript.findUnique({
      where: { key },
      select: { declaredVariables: true },
    });
    return script?.declaredVariables ?? {};
  }

  /**
   * 按关联类型获取 Ink 脚本
   */
  async findByEpisode(episodeId: string) {
    return this.prisma.inkScript.findFirst({
      where: { episodeId, scriptType: 'episode' },
      select: { id: true, key: true, inkJson: true },
    });
  }

  async findByLocation(locationId: string) {
    return this.prisma.inkScript.findMany({
      where: { locationId },
      select: { id: true, key: true, title: true, scriptType: true },
    });
  }
}
