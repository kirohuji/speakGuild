---
key: practice_course-adverbs_副词_方式与评论副词_方式副词
title: 副词·方式与评论副词 - 方式副词
scriptType: practice
---

-> start

=== start ===
#bg: /assets/bg/kitchen.png
#speaker: Emma
#expression: happy
#position: center
#translation: 欢迎来到我的厨房大冒险！今晚我们要挑战的是——我奶奶的秘制红烧肉食谱！
Emma: Welcome to my kitchen adventure! Tonight's challenge — my grandma's secret braised pork recipe!

#speaker: Emma
#expression: default
#translation: 不过老实说……我上次做这个把厨房差点烧了。所以这次我们来分工合作。你看完食谱了吗？
#wait:input
#objective: 用方式副词描述你阅读食谱的方式（carefully/quickly/easily）
#hint: 用 "I read it carefully", "I quickly looked through it", "I can easily follow it" 来描述你看完食谱后的感觉
#chunks: Please read carefully.,He quickly finished his homework.,She easily solved the problem.,She speaks English well.
Emma: But honestly... last time I almost burned the kitchen down. So let's work together. Have you read through the recipe?

*   [I read it carefully. It seems straightforward.] -> prep_work
*   [I quickly looked it over. Looks easy enough!] -> prep_work
*   [I can easily follow it. My grandma taught me a similar dish.] -> prep_work

=== prep_work ===
#speaker: Emma
#expression: thinking
#translation: 好，第一步是切配菜。这个洋葱你得小心切——我上次切得泪流满面的。
Emma: OK, first step is chopping the vegetables. Be careful with the onion — I was crying like a baby last time.

#speaker: Emma
#expression: default
#translation: 我来切肉，你来切蔬菜。记住——怎么做比做什么更重要。**方式**决定一切！
#wait:input
#objective: 用方式副词描述你切菜的方式（carefully/quickly/happily/easily）
#hint: 用 "I'll carefully chop...", "I can quickly dice...", "I happily sliced..." 的方式回答
#chunks: Please read carefully.,He quickly finished his homework.,The children played happily.,She easily solved the problem.,She speaks English well.
Emma: I'll handle the meat, you do the veggies. Remember — how you do it matters more than what you do. **Manner** is everything!

*   [I'll carefully chop the onions into small pieces.] -> cooking_process
*   [I can quickly dice everything. Watch me go!] -> cooking_process
*   [I happily slice the veggies. This is relaxing!] -> cooking_process

=== cooking_process ===
#speaker: Emma
#expression: surprised
#translation: 哇，你刀工不错嘛！比我强多了。我切肉总是很慢，怕切到手。
Emma: Wow, nice knife skills! Way better than mine. I always cut meat really slowly — afraid I'll cut myself.

#speaker: Emma
#expression: default
#translation: 好了，下一步是炒糖色。这个很关键——糖放进去后要不停搅拌。你觉得你做得到吗？
#wait:input
#objective: 用方式副词描述你准备如何完成关键步骤
#hint: 用 "I'll carefully stir...", "I can easily handle this", "Let me quickly mix..." 来描述你的操作方式
#chunks: Please read carefully.,He quickly finished his homework.,She easily solved the problem.,The children played happily.
Emma: Next step is caramelizing the sugar. This is crucial — you need to stir it constantly. Think you can handle it?

*   [I'll carefully stir it until it turns golden brown.] -> taste_test
*   [Let me quickly mix everything before it burns!] -> taste_test
*   [I can easily handle this. I've done it many times.] -> taste_test

=== taste_test ===
#speaker: Emma
#expression: happy
#translation: 闻起来好香啊！你做得比我想象的好太多了。现在到了最重要的环节——试味道！
Emma: Smells amazing! You're doing way better than I expected. Now the most important part — the taste test!

#speaker: Emma
#expression: default
#translation: 帮我尝尝看味道怎么样？顺便用方式副词告诉我——我该怎么说这道菜做得好？
#wait:input
#objective: 用方式副词评价你做的菜（well/happily/carefully）
#hint: 用 "It turned out well", "We cooked it carefully", "The meat is cooked perfectly" 等表达
#chunks: She speaks English well.,The children played happily.,Please read carefully.,She easily solved the problem.
Emma: Give it a try and tell me what you think! And use a manner adverb — how should I describe the result?

*   [It turned out really well! We cooked it carefully and patiently.] -> clean_up
*   [The flavors blend together perfectly. We worked well together!] -> clean_up
*   [Hmm, I think we should have stirred it more carefully. It's a bit burnt.] -> clean_up

=== clean_up ===
#speaker: Emma
#expression: happy
#translation: 不管怎样，这是我做过最成功的一次红烧肉！有你帮忙效率高多了。
Emma: Either way, this is the best braised pork I've ever made! Having you here made it so much easier.

#speaker: Emma
#expression: thinking
#translation: 不过你看这厨房……我们好像把战场打扫一下。到处都是面粉和油渍。
Emma: But look at this kitchen... we should probably clean up. There's flour and grease everywhere.

#speaker: Emma
#expression: default
#translation: 你能帮我快速收拾一下吗？我洗碗，你擦桌子。
#wait:input
#objective: 用方式副词描述你的打扫方式
#hint: 用 "I'll quickly wipe the table", "I can easily clean this up", "Let me carefully put things away"
#chunks: He quickly finished his homework.,She easily solved the problem.,Please read carefully.,The children played happily.
Emma: Help me clean up quickly? I'll wash the dishes, you wipe the counter.

*   [I'll quickly wipe down the counter and put things away.] -> ending
*   [Let me carefully organize all the spices back.] -> ending
*   [I can easily clean this up. Don't worry about it!] -> ending

=== ending ===
#speaker: Emma
#expression: happy
#translation: 搞定！谢谢你的帮忙——你做事又仔细又利索，比我自己做快多了。
Emma: Done! Thanks for your help — you work carefully and quickly. Much faster than when I do it alone.

#speaker: Emma
#expression: thinking
#translation: 对了，我刚刚收到一条消息。我们的共同朋友小玲好像出了点事——我们明天聊聊？
Emma: Oh, I just got a message from a mutual friend. Something happened to Xiaoling — want to grab coffee tomorrow and talk about it?

#speaker: Emma
#expression: default
#translation: 不过今晚先好好享受我们的劳动成果吧！开动啦！
Emma: But for now, let's enjoy the fruits of our labor! Dig in!

#wait

-> END