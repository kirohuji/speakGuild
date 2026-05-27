"""
漫语町（ManYu）— 软件著作权流程图/架构图生成器
生成符合中国版权保护中心要求的 9 张专业技术示意图
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import fontManager, FontProperties
from matplotlib.patches import FancyBboxPatch
import os

FONT_PATH = r'C:\Windows\Fonts\msyhbd.ttc'
if os.path.exists(FONT_PATH):
    fontManager.addfont(FONT_PATH)
FP = FontProperties(family='Microsoft YaHei', size=10.5)
FP_S = FontProperties(family='Microsoft YaHei', size=8.5)
FP_XS = FontProperties(family='Microsoft YaHei', size=7.5)
FP_T = FontProperties(family='Microsoft YaHei', size=14.5, weight='bold')

DIR = r'C:\Users\z1309\Desktop\work\speakGuild\docs\软件著作权\diagrams'
os.makedirs(DIR, exist_ok=True)

C = {'bg': '#f2f4f8', 'web': '#dbeafe', 'webB': '#3b82f6', 'ios': '#ccfbf1', 'iosB': '#14b8a6',
     'gw': '#e0e7ff', 'gwB': '#6366f1', 'core': '#fef3c7', 'coreB': '#f59e0b',
     'ext': '#fce7f3', 'extB': '#ec4899', 'data': '#d1fae5', 'dataB': '#10b981',
     'arr': '#94a3b8', 'game': '#ede7f6', 'gameB': '#7c3aed'}

def bx(ax, x, y, w, h, t, f=None, e=None, fs=9, b=False):
    r = FancyBboxPatch((x-w/2, y-h/2), w, h, boxstyle="round,pad=0.12", facecolor=f or C['core'], edgecolor=e or C['coreB'], linewidth=1.6)
    ax.add_patch(r); ax.text(x, y, t, ha='center', va='center', fontproperties=FP_S, fontweight='bold' if b else 'normal')

def ar(ax, x1, y1, x2, y2, s='->', c=None):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle=s, color=c or C['arr'], lw=1.3))

def da(ax, x1, y1, x2, y2):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle='->', color=C['arr'], lw=0.8, linestyle='dashed'))

def axs(ax, t):
    ax.set_xlim(0, 10); ax.set_ylim(0, 10); ax.axis('off'); ax.set_facecolor(C['bg'])
    ax.set_title(t, fontproperties=FP_T, pad=14, color='#1e293b')

def sv(n):
    plt.savefig(os.path.join(DIR, n), dpi=180, bbox_inches='tight', facecolor=C['bg']); plt.close(); print(f'  ✓ {n}')

def d1():
    """系统总体架构图 — 四层架构 + 游戏化学习引擎"""
    fig, ax = plt.subplots(figsize=(10.5, 7.5)); axs(ax, '系统总体架构图')
    ax.text(0.1, 8.2, '客户端层', fontproperties=FP_S, color='#475569', va='center')
    bx(ax, 2.5, 8.8, 3.5, 1.0, 'Web 浏览器\nReact 19 + TypeScript SPA', C['web'], C['webB'], b=True)
    bx(ax, 5.8, 8.8, 3.0, 1.0, 'iOS 原生应用\nCapacitor 8 打包', C['ios'], C['iosB'], b=True)
    ax.text(0.1, 6.0, '接入层', fontproperties=FP_S, color='#475569', va='center')
    bx(ax, 5.0, 6.3, 8.0, 0.9, 'Nginx 反向代理  |  CDN 加速  |  SSL 终端', C['gw'], C['gwB'], b=True)
    for x in [3.0, 5.8]: ar(ax, x, 8.3, x, 6.8)
    ax.text(0.1, 4.0, '服务层', fontproperties=FP_S, color='#475569', va='center')
    bx(ax, 5.0, 4.2, 8.0, 1.3, 'NestJS API 服务  ·  25 个业务模块\nRESTful + SSE  ·  Ink 互动剧本引擎  ·  ValidationPipe', C['core'], C['coreB'], b=True)
    ar(ax, 5.0, 5.8, 5.0, 4.9)
    ax.text(0.1, 2.0, '数据层', fontproperties=FP_S, color='#475569', va='center')
    bx(ax, 2.5, 2.2, 3.2, 1.0, 'PostgreSQL 16\nPrisma 6 ORM  ·  35+ 个模型', C['data'], C['dataB'], b=True)
    ar(ax, 3.0, 3.5, 2.5, 2.7)
    bx(ax, 7.0, 2.0, 3.0, 2.2, '外部服务\n━━━━━━\nDeepSeek AI (评分/教学)\nMiniMax / Cartesia (TTS)\n腾讯云 COS (对象存储)\nWhisper (语音转文字)', C['ext'], C['extB'], fs=8)
    da(ax, 5.0, 3.5, 7.0, 3.5); da(ax, 4.0, 2.7, 5.5, 2.7)
    sv('01-architecture.png')

def d2():
    """核心业务流程图 — 加入场景化学习和探险"""
    fig, ax = plt.subplots(figsize=(10.5, 8)); axs(ax, '核心业务流程图')
    # 上排：入门流程
    for t, x in [('用户注册/登录\n(Better Auth)', 2.0), ('题库绑定\n(省份×语种)', 5.0), ('新手上路\n(Onboarding)', 8.0)]:
        bx(ax, x, 8.2, 2.6, 1.0, t, C['web'], C['webB'])
    ar(ax, 3.3, 8.2, 3.7, 8.2); ar(ax, 6.3, 8.2, 6.7, 8.2)

    # 中排左：场景化学习
    bx(ax, 2.0, 6.0, 2.6, 1.0, '场景化学习\nScene 驱动 + 词汇/语块', C['game'], C['gameB'])
    ar(ax, 8.0, 7.7, 3.3, 6.5)
    bx(ax, 2.0, 4.0, 2.6, 1.0, '互动剧本\nInk 剧情 + NPC 对话', C['game'], C['gameB'])
    ar(ax, 2.0, 5.5, 2.0, 4.5)

    # 中排右：传统练习
    bx(ax, 5.5, 6.0, 2.6, 1.0, '口语练习\n播放 TTS + 参考答案', C['core'], C['coreB'])
    da(ax, 3.3, 6.0, 4.2, 6.0)
    bx(ax, 5.5, 4.0, 2.6, 1.0, 'AI 反馈\nDeepSeek 多维评分', C['ext'], C['extB'])
    ar(ax, 5.5, 5.5, 5.5, 4.5)
    bx(ax, 5.5, 2.0, 2.6, 1.0, '收藏 / 生词本\n学习档案', C['gw'], C['gwB'])
    ar(ax, 5.5, 3.5, 5.5, 2.5)

    # 下排
    bx(ax, 8.5, 6.0, 2.2, 1.0, '模拟考试\n标准/强化卷', C['web'], C['webB'])
    da(ax, 8.0, 7.0, 8.5, 6.5)
    bx(ax, 8.5, 4.0, 2.2, 1.0, '自动评分\n薄弱点分析', C['data'], C['dataB'])
    ar(ax, 8.5, 5.5, 8.5, 4.5)
    bx(ax, 8.5, 2.0, 2.2, 1.0, '场景探险\nGameMap + Location', C['game'], C['gameB'])
    ar(ax, 3.3, 4.0, 7.6, 2.0)

    sv('02-business-flow.png')

def d3():
    """后端模块结构图 — 25 个模块四层分类"""
    fig, ax = plt.subplots(figsize=(10.5, 8.5)); axs(ax, '后端模块结构图')
    bx(ax, 5.0, 9.2, 9.0, 0.7, 'NestJS Application (app.module.ts)', '#eff6ff', '#2563eb', b=True)

    # 核心学习层
    ax.text(0.2, 8.0, '核心学习', fontproperties=FP_S, color='#475569')
    for x, t in [(1.4, 'Practice\n练习'), (3.0, 'MockExam\n模考'), (4.6, 'PracticeAI\nAI评分'), (6.2, 'TTS\n语音'), (7.8, 'QuestionBank\n题库'), (9.4, 'Chunk\n语块')]:
        bx(ax, x, 7.0, 1.3, 1.2, t, C['core'], C['coreB'], fs=8); da(ax, 5.0, 8.8, x, 7.6)

    # 游戏化层
    ax.text(0.2, 5.8, '游戏化引擎', fontproperties=FP_S, color='#475569')
    for x, t in [(1.4, 'Scene\n场景'), (3.0, 'Script\n剧本'), (4.6, 'Exploration\n探索'), (6.2, 'Learning\n学习'), (7.8, 'Level\n等级'), (9.4, 'Expression\n表达')]:
        bx(ax, x, 4.8, 1.3, 1.2, t, C['game'], C['gameB'], fs=8)

    # 运营支撑层
    ax.text(0.2, 3.6, '运营支撑', fontproperties=FP_S, color='#475569')
    for x, t in [(1.4, 'Membership\n会员'), (3.0, 'Pay\n支付'), (4.6, 'Coupon\n优惠券'), (6.2, 'Referral\n邀请'), (7.8, 'Notification\n通知'), (9.4, 'Feedback\n反馈')]:
        bx(ax, x, 2.6, 1.3, 1.2, t, C['data'], C['dataB'], fs=8)

    # 管理&公共服务层
    ax.text(0.2, 1.4, '管理&公共', fontproperties=FP_S, color='#475569')
    for x, t in [(1.4, 'Admin\n管理'), (3.0, 'Auth\n认证'), (4.6, 'FileAssets\n文件'), (6.2, 'ResourceLib\n资料库'), (7.8, 'Achievement\n成就'), (9.4, 'Leaderboard\n排行')]:
        bx(ax, x, 0.6, 1.3, 1.0, t, C['web'], C['webB'], fs=8)

    sv('03-module-structure.png')

def d4():
    """数据库核心模型关系图 — 新增游戏化相关模型"""
    fig, ax = plt.subplots(figsize=(10.5, 8)); axs(ax, '数据库核心模型关系图')
    bx(ax, 5.0, 8.0, 2.8, 1.0, 'User\n用户表 (核心)', '#dbeafe', '#2563eb', b=True)

    # 学习行为相关
    for t, x, l in [('PracticeRecord\n练习记录', 1.5, '← 1:N'), ('DailyActivity\n每日活跃', 3.8, '← 1:N'), ('VocabularyWord\n生词本', 6.0, '← 1:N'), ('FavoriteQuestion\n收藏', 8.5, '← 1:N')]:
        bx(ax, x, 5.8, 1.8, 1.0, t, '#fef3c7', '#d97706', fs=8); ar(ax, 5.0, 7.5, x+0.5, 6.3); ax.text(x, 5.3, l, fontproperties=FP_XS, color='#94a3b8', ha='center')

    # 游戏化模型
    for t, x in [('UserSceneProgress\n场景进度', 1.5), ('UserChunkProgress\n语块掌握', 3.8), ('ExplorationRecord\n对话记录', 6.0), ('ScriptRecord\n剧本记录', 8.5)]:
        bx(ax, x, 3.8, 1.8, 1.0, t, C['game'], C['gameB'], fs=8); ar(ax, 5.0, 7.0, x+0.5, 4.3)

    # 会员支付
    bx(ax, 1.5, 1.5, 2.2, 1.0, 'Order\n订单', '#fce7f3', '#ec4899', fs=8)
    bx(ax, 4.5, 1.5, 2.2, 1.0, 'UserMembership\n会员状态', '#ede7f6', '#7c3aed', fs=8)
    ar(ax, 1.5+0.5, 3.3, 1.5+0.5, 2.0); ar(ax, 4.5+0.5, 3.3, 4.5+0.5, 2.0)

    # 内容模型
    bx(ax, 7.5, 1.5, 2.5, 0.8, 'Scene + Chunk + Script\n场景/语块/剧本体系', C['data'], C['dataB'], fs=8)

    sv('04-database-er.png')

def d5():
    """API 请求处理流程图"""
    fig, ax = plt.subplots(figsize=(10.5, 8)); axs(ax, 'API 请求处理流程图')
    bs = [('① 客户端请求\nAxios + Bearer Token', 1.5, 7.5, C['web'], C['webB']),
          ('② Nginx 反向代理\n路由分发 + SSL', 3.5, 6.0, C['gw'], C['gwB']),
          ('③ AuthGuard 鉴权\nrequireAuthSession', 5.5, 4.5, C['core'], C['coreB']),
          ('④ ValidationPipe\nclass-validator 校验', 7.5, 3.0, C['data'], C['dataB']),
          ('⑤ Service → Prisma\n业务逻辑 + 数据操作', 9.5, 1.5, '#fce7f3', '#ec4899')]
    for t, x, y, f, e in bs:
        bx(ax, x, y, 2.5, 1.1, t, f, e, fs=9, b=True)
    for i in range(len(bs)-1):
        ar(ax, bs[i][1]+1.5, bs[i][2]-0.3, bs[i+1][1]-1.5, bs[i+1][2]+0.3)

    # SSE 流式分支
    da(ax, 7.5, 4.5, 9.5, 4.5)
    bx(ax, 9.5, 4.5, 2.2, 0.8, 'SSE 流式响应\nAI 反馈逐 token 推送', C['ext'], C['extB'], fs=8)

    bx(ax, 1.5, 2.0, 3.5, 1.0, '响应封装 TransformInterceptor\n统一 {code, message, data}', '#dbeafe', '#2563eb', fs=8)
    bx(ax, 1.5, 0.5, 3.5, 0.8, '异常处理 AllExceptionsFilter\n全局错误格式化', '#fce7f3', '#e11d48', fs=8)
    ar(ax, 4.5, 2.0, 7.5, 1.5); ar(ax, 3.0, 1.5, 3.0, 0.8)
    sv('05-api-flow.png')

def d6():
    fig, ax = plt.subplots(figsize=(10.5, 7.5)); axs(ax, '部署架构图')
    bx(ax, 5.0, 8.8, 9.0, 0.7, 'GitHub Actions CI/CD  →  自动化测试  →  Docker 多阶段构建  →  推送镜像', '#e0e7ff', '#6366f1', b=True)
    ar(ax, 5.0, 8.4, 5.0, 7.5)
    bx(ax, 5.0, 6.8, 4.5, 1.2, '云服务器 (Docker Compose)\nNginx  ·  NestJS API  ·  PostgreSQL', '#fef3c7', '#f59e0b', b=True)
    bx(ax, 9.0, 7.5, 2.5, 1.0, '腾讯云 COS\n音频/图片/文件', '#ccfbf1', '#14b8a6')
    ar(ax, 7.2, 7.0, 7.8, 7.5)
    bx(ax, 9.0, 5.0, 2.5, 1.8, '外部 API 服务\nDeepSeek AI\nMiniMax / Cartesia TTS', '#fce7f3', '#ec4899', fs=8)
    da(ax, 6.5, 6.5, 7.8, 6.0)
    bx(ax, 1.5, 7.5, 2.5, 1.2, '用户终端\nWeb / iOS', '#dbeafe', '#2563eb', b=True)
    ar(ax, 2.8, 7.5, 3.5, 7.0)
    bx(ax, 1.5, 4.5, 2.5, 1.8, 'Docker\nRegistry\n镜像仓库', C['data'], C['dataB'])
    ar(ax, 2.8, 5.5, 4.0, 6.5)
    sv('06-deployment.png')

def d7():
    """TTS 语音合成与缓存流程图"""
    fig, ax = plt.subplots(figsize=(10.5, 7)); axs(ax, 'TTS 语音合成与缓存流程图')
    for t, x, y, f, e in [('① 用户点击播放', 1.5, 7.5, C['web'], C['webB']),
                           ('② 计算配置哈希\nSHA1(provider+model\n+voice+text+params)', 3.5, 7.5, C['gw'], C['gwB']),
                           ('③ 查 QuestionAudio\n数据库缓存表', 5.5, 7.5, C['data'], C['dataB']),
                           ('④ 判断命中\n是 → 返回 COS URL\n否 → 调用 TTS API', 7.5, 7.5, C['core'], C['coreB']),
                           ('⑤ 上传至 COS\n记录缓存条目', 9.5, 7.5, '#fce7f3', '#ec4899')]:
        bx(ax, x, y, 1.8, 1.3, t, f, e, fs=7.5)
    for i in range(4):
        ar(ax, 1.5+2.0*(i+1)-1.2, 7.5, 1.5+2.0*(i+1)+0.2, 7.5)

    # 厂商切换
    bx(ax, 5.5, 4.5, 2.5, 1.0, '多厂商抽象层\nMiniMax / Cartesia\n策略模式切换', C['ext'], C['extB'], fs=8)
    da(ax, 7.5, 6.5, 6.5, 5.0)

    ax.text(5.0, 2.8, '缓存策略：同一题目 + 同一 TTS 配置只调用一次 API\n后续直接读取 COS 缓存 → 响应时间 < 500ms', fontproperties=FP_S,
            ha='center', va='center', bbox=dict(boxstyle='round', facecolor='#fef3c7', edgecolor='#f59e0b'))
    sv('07-tts-flow.png')

def d8():
    """支付与会员开通流程图"""
    fig, ax = plt.subplots(figsize=(10.5, 7)); axs(ax, '支付与会员开通流程图')
    for t, x, y, f, e in [('用户选择套餐\n标准/进阶+月/年', 1.5, 7.5, C['web'], C['webB']),
                           ('创建订单\nOrder(status=pending)', 3.5, 7.5, C['gw'], C['gwB']),
                           ('扫码支付\n支付宝 / 微信', 5.5, 7.5, C['core'], C['coreB']),
                           ('异步回调\n签名验证 + 状态更新', 7.5, 7.5, C['data'], C['dataB']),
                           ('开通/延长会员\n$transaction 原子操作', 9.5, 7.5, '#fce7f3', '#ec4899')]:
        bx(ax, x, y, 1.8, 1.2, t, f, e, fs=8)
    for i in range(4):
        ar(ax, 1.5+2.0*(i+1)-1.2, 7.5, 1.5+2.0*(i+1)+0.2, 7.5)
    ax.text(5.0, 4.5, '事务保障：Order + UserMembership 在同一个 Prisma $transaction 中执行\n失败自动回滚，确保支付数据一致性', fontproperties=FP_S,
            ha='center', va='center', bbox=dict(boxstyle='round', facecolor='#dbeafe', edgecolor='#3b82f6'))
    sv('08-payment-flow.png')

def d9():
    """场景化学习与探险流程图 — 新增 (替代管理后台图)"""
    fig, ax = plt.subplots(figsize=(10.5, 7.5)); axs(ax, '场景化学习与探险流程图')
    # 入口
    bx(ax, 5.0, 8.5, 3.0, 0.8, '进入场景学习', '#e0e7ff', '#6366f1', b=True)

    # 第一排：场景选择
    bx(ax, 2.0, 6.5, 2.5, 1.0, '浏览场景\n按类别/等级解锁', C['game'], C['gameB'])
    bx(ax, 5.5, 6.5, 2.5, 1.0, '场景详情\n词汇 + 语块 + 训练', C['game'], C['gameB'])
    bx(ax, 9.0, 6.5, 2.0, 1.0, '场景探险\nGameMap', C['ext'], C['extB'])
    ar(ax, 5.0, 8.0, 2.0, 7.0); ar(ax, 5.0, 8.0, 5.5, 7.0); da(ax, 5.0, 8.0, 9.0, 7.0)

    # 第二排：学习路径
    bx(ax, 2.0, 4.5, 2.0, 1.0, '词汇学习\nVocabulary', C['data'], C['dataB'])
    bx(ax, 4.2, 4.5, 2.0, 1.0, '语块练习\nChunk 三阶段', C['core'], C['coreB'])
    bx(ax, 6.4, 4.5, 2.0, 1.0, '训练主题\nTrainingTopic', C['gw'], C['gwB'])
    bx(ax, 8.6, 4.5, 2.0, 1.0, '互动剧本\nInk Script', C['ext'], C['extB'])
    for i in range(3):
        ar(ax, 2.0+2.2*(i+1)-1.3, 4.5, 2.0+2.2*(i+1)+0.3, 4.5)

    # 第三排：效果
    bx(ax, 2.0, 2.5, 2.0, 1.0, 'NPC 对话\n自由练习', C['game'], C['gameB'])
    bx(ax, 4.2, 2.5, 2.0, 1.0, '掌握度追踪\nactivated→output', C['core'], C['coreB'])
    bx(ax, 6.4, 2.5, 2.0, 1.0, '经验值 + 升级\nLevel 系统', C['data'], C['dataB'])
    bx(ax, 8.6, 2.5, 2.0, 1.0, '成就解锁\nAchievement', C['web'], C['webB'])
    for i in range(3):
        ar(ax, 2.0+2.2*(i+1)-1.3, 2.5, 2.0+2.2*(i+1)+0.3, 2.5)

    # 连接线
    da(ax, 2.0, 5.5, 2.0, 5.0); da(ax, 5.5, 5.5, 5.5, 5.0)

    sv('09-scene-learning-flow.png')

if __name__ == '__main__':
    print('Drawing 9 diagrams...')
    d1(); d2(); d3(); d4(); d5(); d6(); d7(); d8(); d9()
    print(f'All done in {DIR}')
