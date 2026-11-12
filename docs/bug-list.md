1. 外观主题drawer那边进行背景音效switch,需要设计好
2. 首页特殊广播重叠弹出,以及特殊弹窗是无背景png,但是你封面还是要有背景
3. 会员模式下安装的学习包,如果是过了会员也应该锁住
4. http://localhost:3001/api/v1/manyu/sync/pull 的接口调整一下,很多数据可以通过打包安装的形式
5. 首页用户drawer的加载也是,没必要整个加载中
6. 我的学习库那边,每次切换过去会有 http://localhost:5173/#/expressions 是不是没有进行离线缓存,而且感觉没有做用户隔离
7.
http://localhost:3001/api/v1/manyu/sync/content/manifest?since=2026-11-11T06:44:16.486Z 和 

http://localhost:3001/api/v1/manyu/sync/pull?cursors=%7B%22expressionItems%22:%222026-11-10T12:38:36.851Z%22,%22sceneProgresses%22:%222026-11-10T03:46:47.774Z%22,%22chunkProgresses%22:null,%22practiceSessions%22:%222026-11-10T12:38:36.956Z%22,%22practiceWarmupRecords%22:%222026-11-07T10:05:39.782Z%22,%22dailyPracticeRuns%22:%222026-11-11T06:12:10.709Z%22,%22topicSessions%22:%222026-10-31T10:51:22.249Z%22,%22deletedExpressionItems%22:null,%22learningNotebooks%22:%222026-10-12T07:49:26.696Z%22,%22learningNotebookItems%22:%222026-11-10T12:38:36.893Z%22,%22deletedLearningNotebooks%22:null,%22deletedLearningNotebookItems%22:%222026-10-12T08:00:16.306Z%22%7D 
过于频繁
8. 我的学习库那边就是insight-dialog那边的list应该也是支持无限滚动,尤其是练听力的情况下也是
9. 批量编辑drawer 那边的border 无, 背景修改
10.总是有个无指定chunk,应该是一个bug
11. 添加学习包drawer 那个也没有用户隔离,学习包里面的以收录也没有用户隔离,也有可能是我强制切换的原因
12. 我的学习库学习本滑动还是有闪一下的问题,可能只有web端,ios端要多测试
13. 学习本的统计和学习本的内容不一致,这个是严重bug,是不是这个我的学习库接口没有根据用户返回?
14. 管理学习本drawer border 去了,背景没有修改,删除也是
15. 后台用户管理 用户详情 dialog 知识点对齐,那边显示练了64道题目,但是移动端是没有,而且也没有显示用户的学习库的绑定情况,也就是那边需要更新最新数据,就是知识点的练习也没有对齐,AI 用量统计 也要重新计算,知识点练习应该是同步了,只是还没有设计的这么详细
16. 学习统计drawer 那边最好加个今日练习时长
17. 设备账户的登录统计也要检测是否是对的
18. 学习计划那边知识点练习那边有个评分字段,这个是应该需要的,眼睛这个icon也不需要
19. 之后会给所有的单词/句块/句块 进行 例句的tts 配音,有 通过tts(minimax,或者hume ai/entts),entts 之后应该在大模型配置那边接上
20. 场景练习需要立绘,轻量剧情包,也需要 立绘,背景,nqtr需要一套故事
21. 需要检查所有的学习包,对应的单词/句型/句块,知识点练习,文档
22. 离线情况下,用户录音不应该上次cos,也是本地存到文件系统吧?
23. 我会发现练习记录(学习计划/今日任务)用户录音丢失
24. app bridge 计算错误
25. 有一些页面的懒加载和sleton加载可以不需要
26. 打卡默认可以不显示,
27. 可以增加一个功能就是,insight-dialog重新生成,在移动端,更新到后端,然后前端对应的离线缓存也更新