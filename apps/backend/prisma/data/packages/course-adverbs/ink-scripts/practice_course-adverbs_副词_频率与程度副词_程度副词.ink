---
key: practice_course-adverbs_副词_频率与程度副词_程度副词
title: 副词·频率与程度副词 - 程度副词
scriptType: practice
---

-> start

=== start ===
#bg: /assets/bg/shopping_mall.png
#speaker: Emma
#expression: default
#position: center
#translation: 好啦，到商场了！我妹妹的生日就在下周，我需要给她买个礼物。你能帮我参考一下吗？
Emma: Alright, we're at the mall! My sister's birthday is next week, and I need to get her a gift. Can you help me pick something out?

#speaker: Emma
#expression: thinking
#translation: 但她这个人品味很挑剔，所以我得谨慎选。我们先看看那家店的毛衣吧——你觉得那件蓝色的怎么样？
#wait:input
#objective: 用程度副词评价你看到的商品（very/quite/rather/extremely/too）
#hint: 用 "It's very...", "It's quite...", "This is rather...", "It's too..." 来评价商品
#chunks: She is very smart.,The movie is quite good.,It's rather cold today.,That's extremely kind.,This coffee is too hot.
Emma: But she's picky, so I need to be careful. Let's check out that sweater shop first — what do you think of the blue one over there?

*   [It's very nice! The color is quite pretty.] -> clothes_shop
*   [It's rather plain. And the price is too high.] -> clothes_shop
*   [It's too basic. She'd look extremely good in something more stylish.] -> clothes_shop

=== clothes_shop ===
#speaker: Emma
#expression: happy
#translation: 嗯，你说得有道理。再看看别的——那边那家饰品店怎么样？我妹妹很喜欢那些小玩意儿。
Emma: Hmm, good point. Let's look elsewhere — what about that accessory store? My sister loves little trinkets.

#speaker: Shop Assistant
#expression: default
#position: right
#translation: 欢迎光临！这是我们新款的手链系列，需要我介绍一下吗？
Shop Assistant: Welcome! This is our new bracelet collection. Would you like me to show you around?

#speaker: Emma
#expression: default
#translation: 哇，这条手链好好看！你觉得呢？——用程度词帮我描述一下，我好决定买不买。
#wait:input
#objective: 用程度副词评价手链的外观和品质
#hint: 用 "It's very elegant", "The design is quite unique", "It's rather expensive", "It's too delicate" 等表达
#chunks: She is very smart.,The movie is quite good.,It's rather cold today.,That's extremely kind.,This coffee is too hot.
Emma: Wow, this bracelet is lovely! What do you think? — Use degree words to help me decide.

*   [It's very elegant! And the price is quite reasonable.] -> more_shopping
*   [It's rather delicate. The quality looks extremely good.] -> more_shopping
*   [It's too expensive for what it is. Let's keep looking.] -> more_shopping

=== more_shopping ===
#speaker: Emma
#expression: thinking
#translation: 好纠结啊。对了，我们先去喝杯咖啡休息一下吧？那边新开了一家咖啡店。
Emma: Such a hard choice. Hey, let's grab a coffee first? There's a new café over there.

#bg: /assets/bg/cafe.png
#speaker: Emma
#expression: happy
#translation: 哇，他们的拿铁看起来不错。你尝尝看怎么样？
#wait:input
#objective: 用程度副词评价咖啡的口味
#hint: 用 "It's very smooth", "It's quite strong", "It's rather bitter", "It's too sweet" 来描述味道
#chunks: She is very smart.,The movie is quite good.,It's rather cold today.,That's extremely kind.,This coffee is too hot.
Emma: Their latte looks amazing! Give it a taste — how is it?

*   [It's very smooth! The flavor is quite rich.] -> coffee_talk
*   [It's rather bitter. I think it's too strong for me.] -> coffee_talk
*   [It's extremely good! Best coffee I've had in a while.] -> coffee_talk

=== coffee_talk ===
#speaker: Emma
#expression: thinking
#translation: 对了，刚刚说到礼物——我在那家饰品店看到一条围巾，你觉得怎么样？那条灰色的。
Emma: By the way, about the gift — I saw a scarf at that accessory store. What did you think of the gray one?

#speaker: Emma
#expression: default
#translation: 我妹妹是个很讲究的人，我不想买个太普通的。用你的眼光帮我评价一下那条围巾？
#wait:input
#objective: 用程度副词全面评价围巾的各个方面
#hint: 从颜色、材质、款式等方面入手，用 "The material is very soft", "The color is quite versatile", "It's rather stylish", "It's too simple"
#chunks: She is very smart.,The movie is quite good.,It's rather cold today.,That's extremely kind.,This coffee is too hot.
Emma: My sister is very particular. I don't want to get something too ordinary. Give me your honest review of the scarf?

*   [The material is very soft, and the color is quite versatile.] -> final_choice
*   [It's rather stylish. She would look extremely good in it.] -> final_choice
*   [To be honest, it's too simple. Let's find something better.] -> final_choice

=== final_choice ===
#speaker: Emma
#expression: happy
#translation: 好，我决定买那条围巾了！你的评价帮了大忙。说真的，你选东西的眼光很不错诶！
Emma: OK, I'm getting the scarf! Your reviews really helped. Seriously, you have really good taste!

#speaker: Emma
#expression: default
#translation: 今天逛得挺开心的。对了，晚上要不要来我家一起做饭？我奶奶教了我一道新菜谱，但我一个人搞不定。
Emma: Today was fun! Hey, want to come over tonight and cook together? My grandma taught me a new recipe, but I can't manage it alone.

#speaker: Emma
#expression: thinking
#translation: 不过提前说好——我是个相当糟糕的厨师，所以你可能会很"惊喜"哈哈。
Emma: Fair warning though — I'm a rather terrible cook, so you might be extremely... surprised. Ha!

#wait

-> END