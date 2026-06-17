---
key: practice_course-adverbs_副词_频率与程度副词_程度副词
title: 副词·频率与程度副词 - 程度副词
scriptType: practice
---

-> start

=== start ===
#bg: /assets/bg/mountain_trail.png
#speaker: Emma
#expression: happy
#position: center
#translation: 终于到山脚下了！我听说这条徒步路线的风景特别美。准备好了吗？
Emma: We finally made it to the trailhead! I've heard this hiking route has incredibly beautiful scenery. Ready to go?

#speaker: Emma
#expression: thinking
#translation: 不过我刚看了下天气预报——今天山顶可能会有点热。你看看这条山路，觉得难度怎么样？
#wait:input
#objective: 用程度副词评价眼前的山路和天气情况
#hint: 用 "The trail looks very steep", "It's quite hot today", "The path seems rather rocky", "It's extremely beautiful here" 来描述
#chunks: The view is very beautiful.,The trail looks quite steep.,It's rather hot today.,The path is extremely long.,This backpack is too heavy.
Emma: But I checked the weather — it might get quite hot at the summit. Take a look at this trail — what do you think of the conditions?

*   [The view is very beautiful! Let's go for it.] -> trail_scene
*   [It's quite hot already. The trail looks rather steep.] -> trail_scene
*   [The scenery is extremely stunning! A bit of heat won't stop us.] -> trail_scene

=== trail_scene ===
#speaker: Emma
#expression: happy
#translation: 走了二十分钟，回头看——哇，山下的景色太壮观了！你看那边那片树林，颜色真漂亮。
Emma: Twenty minutes in and look back — wow, the view is breathtaking! Check out that forest down there, the colors are gorgeous.

#speaker: Emma
#expression: thinking
#translation: 还有那些野花，我从来没见过这种颜色！你觉得这片景色怎么样？用程度词帮我描述一下。
#wait:input
#objective: 用程度副词评价你看到的自然景色——山林、野花、天空
#hint: 用 "The forest is very dense", "The flowers are quite colorful", "The sky is extremely clear", "The air is rather fresh" 等表达
#chunks: The lake is very calm.,The flowers are quite colorful.,The forest looks rather mysterious.,The sky is extremely clear today.,The wind is too strong.
Emma: And look at those wildflowers — I've never seen such colors! What do you think of this view? Use degree words to describe it!

*   [The forest is very lush, and the air is extremely fresh!] -> weather_change
*   [The flowers are quite beautiful, but the sun is rather strong.] -> weather_change
*   [This place is too beautiful! The colors are extremely vibrant.] -> weather_change

=== weather_change ===
#speaker: Emma
#expression: surprised
#translation: 等等，你看那边的云！刚才还晴空万里，现在天突然阴下来了。这山里的天气变得真快。
Emma: Wait, look at those clouds! It was perfectly clear a moment ago, now it's getting dark. The weather in the mountains changes so fast.

#speaker: Emma
#expression: default
#translation: 风也大起来了，我感觉有点凉。你觉得这天怎么样？咱们要不要找个地方避一避？
#wait:input
#objective: 用程度副词描述天气的突然变化和你的感受
#hint: 用 "It's getting very cold", "The wind is quite strong now", "The temperature dropped rather quickly", "The clouds are extremely dark" 来描述
#chunks: This coffee is too hot.,That's extremely dark.,It's rather cold today.,She is very smart.,The wind is quite strong.
Emma: The wind is picking up too, I'm getting chilly. What do you think of this weather change? Should we find shelter?

*   [It's getting very cold! Let's find shelter quickly.] -> picnic
*   [The wind is quite strong, but I think it'll pass rather soon.] -> picnic
*   [The clouds are extremely dark — we should head down now.] -> picnic

=== picnic ===
#bg: /assets/bg/mountain_cabin.png
#speaker: Emma
#expression: happy
#translation: 呼，还好前面有个小木屋可以躲雨。雨来得快去得也快——看，天又快晴了！
Emma: Phew, lucky there's a cabin here! The rain came and went fast — look, it's clearing up already!

#speaker: Emma
#expression: default
#translation: 既然都在这里了，不如吃点东西？我带了自制三明治和水果。尝尝看怎么样？
#wait:input
#objective: 用程度副词评价 Emma 做的野餐食物——味道、口感、分量
#hint: 用 "The sandwich is very tasty", "The fruit is quite sweet", "This is rather filling", "The bread is too dry", "It's extremely delicious!" 等表达
#chunks: The sandwich is very tasty.,This fruit is quite sweet.,The bread is rather dry.,The juice is extremely refreshing.,This salad is too salty.
Emma: Since we're here, how about a snack? I brought homemade sandwiches and fruit. Give them a try — what do you think?

*   [The sandwich is very tasty! The fruit is quite sweet too.] -> sunset_view
*   [The bread is rather dry, but the fruit is extremely refreshing.] -> sunset_view
*   [Everything is very fresh! This is quite a nice picnic spot.] -> sunset_view

=== sunset_view ===
#bg: /assets/bg/mountain_sunset.png
#speaker: Emma
#expression: happy
#translation: 雨停了，我们出来看看吧！天哪——你看那边的日落。整个天空都是橙红色的。太美了！
Emma: Rain's gone, come outside! Oh wow — look at that sunset. The whole sky is orange and red. It's magnificent!

#speaker: Emma
#expression: thinking
#translation: 我真不知道该用什么词来形容了。你能用程度副词帮我描述一下这日落吗？我想记住这一刻。
#wait:input
#objective: 用程度副词全面评价日落的景象——颜色、氛围、感受
#hint: 从色彩、氛围、心情等角度入手，用 "The colors are very warm", "The sky is quite dramatic", "It's rather peaceful here", "This is extremely romantic"
#chunks: The sunset is very warm and golden.,The sky is quite dramatic tonight.,The view is rather peaceful.,This moment is extremely special.,The stars are too faint to see yet.
Emma: I don't even have the words. Can you describe this sunset for me using degree adverbs? I want to remember this moment forever.

*   [The colors are very warm! The whole sky looks quite dramatic.] -> ending
*   [It's rather peaceful up here. This view is extremely special.] -> ending
*   [The sunset is too beautiful for words. I'm very grateful we came.] -> ending

=== ending ===
#speaker: Emma
#expression: happy
#translation: 你说得太好了！这一趟真的太值得了。有你在真是太好了——你总能发现事物的美好之处。
Emma: Perfectly said! This hike was so worth it. I'm really glad you came — you always notice the beauty in everything.

#speaker: Emma
#expression: default
#translation: 对了，下周末我奶奶要教我做一种新菜。上次那道红烧肉你做得特别棒——要不要一起来？
Emma: Oh, my grandma is teaching me a new recipe next weekend. You were amazing with that braised pork last time — want to join?

#speaker: Emma
#expression: thinking
#translation: 不过先别急着答应……我是个相当糟糕的厨师，你可能会很"惊喜"哈哈。
Emma: But don't say yes too quickly... I'm a rather terrible cook, so you might be extremely... surprised. Ha!

#wait

-> END