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
#translation: 欢迎！今晚我们一起跟着食谱做菜。我仔细地看了食谱，也快速地准备食材了！
Emma: Welcome! Let's follow the recipe together tonight. I carefully read the recipe and I quickly prepare the ingredients!

#speaker: Emma
#expression: thinking
#translation: 你呢？你怎么准备的？仔细看食谱了吗？
Emma: How did you prepare? Did you carefully read the recipe too?
#objective: 用方式副词说明你如何准备食谱
#hint: 用 "I carefully read...", "I quickly prepare...", "I easily follow..."
#chunks: I carefully read the recipe.,I quickly prepare the ingredients.,I easily follow each step.
#wait:input
-> prep_work

=== prep_work ===
#speaker: Emma
#expression: default
#translation: 太好了！现在来切食材——大蒜、洋葱、胡萝卜。我不擅长切菜，你来指挥！
Emma: Great! Now let's chop the ingredients — garlic, onions, carrots. I'm not great at chopping. You instruct me!
#objective: 用方式副词下达切菜指令
#hint: 用 "carefully chop...", "quickly slice...", "happily help..."
#chunks: I carefully read the recipe.,I easily follow each step.,She happily helps me in the kitchen.,I carefully follow the recipe.
#wait:input
-> cooking_process

=== cooking_process ===
#speaker: Emma
#expression: surprised
#translation: 油在冒烟！快搅拌酱汁！味道融合着呢，但我们得快速搅拌！
Emma: The oil is smoking! Stir the sauce quickly! The flavors blend together but we need to stir fast!
#chunks: Stir it quickly before it burns!,Turn down the heat carefully.,Add some water slowly.,Mix the sugar constantly.
#objective: 紧急情况用方式副词给指令
#hint: 用 "Stir it quickly!", "Add water slowly!", "Mix it constantly!"
#wait:input
-> after_crisis

=== after_crisis ===
#speaker: Emma
#expression: happy
#translation: 呼——救回来了！但为什么会这样？我搞砸了哪一步？我仔细跟着食谱但还是搅拌太慢了。
Emma: Phew — saved! But why did that happen? I carefully follow the recipe but I stirred too slowly.
#objective: 用方式副词分析问题
#hint: 用 "too slowly", "too quickly", "not carefully"
#chunks: You stirred too slowly so the sugar burned.,I carefully follow the recipe.,I easily follow each step.
#wait:input
-> taste_test

=== taste_test ===
#speaker: Emma
#expression: happy
#translation: 来尝尝！味道融合得好吗？我们合作得很好！
Emma: Now taste it! The flavors blend together — do they work? We work together well!
#objective: 用方式副词评价菜品
#hint: 用 "perfectly", "beautifully", "well"
#chunks: The meat is cooked perfectly.,The flavors blend together beautifully.,We work together well.
#wait:input
-> clean_up

=== clean_up ===
#speaker: Emma
#expression: happy
#translation: 好吃！但厨房一团糟。我来快速洗碗，你仔细擦柜台。分配任务吧！
Emma: Delicious! But the kitchen is a mess. I'll quickly wash the dishes. You carefully clean the counter. Assign the tasks!
#objective: 用方式副词分配清洁任务
#hint: 用 "I'll quickly...", "You carefully...", "Let me thoroughly..."
#chunks: I'll quickly wipe the counter.,I carefully read the recipe.,I quickly prepare the ingredients.
#wait:input
-> ending

=== ending ===
#speaker: Emma
#expression: happy
#translation: 搞定！总结一下：我仔细看食谱，她快乐地帮我，我轻松跟着每一步，我们合作得很好！味道融合得很美！
Emma: Summary — I carefully read the recipe, She happily helps me in the kitchen, I easily follow each step, and We work together well! The flavors blend together beautifully!

#speaker: Emma
#expression: default
#translation: 她英语说得也很好——下次叫她一起来！
Emma: She speaks English well too — let's invite her next time!

#wait

-> END