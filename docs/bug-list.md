1. 外观主题drawer那边进行背景音效switch,需要设计好 主要是这个背景的声音不能太突兀 没问题了
2. http://localhost:3001/api/v1/manyu/sync/pull 的接口调整一下,很多数据可以通过打包安装的形式 没问题了 还是要检查一下 
http://localhost:3001/api/v1/manyu/sync/pull?compact=true 感觉还是有大量的数据可以优化,而且经过测试发现 就是有很多数据需要好好设计如何同步,尤其是老用户第一次加载,那么数据必然很大,可以采用zip之类的形式
3. http://localhost:3001/api/v1/manyu/sync/push,这边不是合并提交而是请求了好几次...
4.
http://localhost:3001/api/v1/manyu/sync/content/manifest?since=2026-11-11T06:44:16.486Z 和 

http://localhost:3001/api/v1/manyu/sync/pull?cursors=%7B%22expressionItems%22:%222026-11-10T12:38:36.851Z%22,%22sceneProgresses%22:%222026-11-10T03:46:47.774Z%22,%22chunkProgresses%22:null,%22practiceSessions%22:%222026-11-10T12:38:36.956Z%22,%22practiceWarmupRecords%22:%222026-11-07T10:05:39.782Z%22,%22dailyPracticeRuns%22:%222026-11-11T06:12:10.709Z%22,%22topicSessions%22:%222026-10-31T10:51:22.249Z%22,%22deletedExpressionItems%22:null,%22learningNotebooks%22:%222026-10-12T07:49:26.696Z%22,%22learningNotebookItems%22:%222026-11-10T12:38:36.893Z%22,%22deletedLearningNotebooks%22:null,%22deletedLearningNotebookItems%22:%222026-10-12T08:00:16.306Z%22%7D 
过于频繁 这个问题也算是解决了
5.  我的学习库那边就是insight-dialog那边的list应该也是支持无限滚动,尤其是练听力的情况下也是,就是说你一共有200个单词在这个学习本,那么你就应该设计好
6.  批量编辑drawer 那边的border 无, 背景修改,退出引导 那边的border 无, 背景修改, 没问题了
7. 总是有个无指定chunk,应该是一个bug
9. 场景练习需要立绘,轻量剧情包,也需要 立绘,背景,nqtr需要一套故事
10. 离线情况下,用户录音不应该上次cos,也是本地存到文件系统吧?
11. 关于写作包之类的 很多地方border 没有处理样式
13. 离线的情况下,肯定是建议用户不要登出,将会导致所有的数据丢失 没问题了,不过可以弹出 dialog,用户可以选择是否登出
14. 本地学习库那边已经下载学习包展开,话说考虑到以后下载的学习包越来越多,你肯定要加个分页比较好
15. 考虑到你学习计划已完成的学习包(这里的学习包指的是就是所有的包,不特别说明一般统一都是学习包)等,其实都是会下载的,所以他可能会一直留在缓存里?而且考虑到练习记录那边一定要和学习包绑定,否则练习数据丢失
16. 教学文档 pdf 预览 放大还是没有绝对定位好,我滚动还是会变位置