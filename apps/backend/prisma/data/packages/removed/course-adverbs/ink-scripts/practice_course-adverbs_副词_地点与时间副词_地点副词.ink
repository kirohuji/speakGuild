---
key: practice_course-adverbs_副词_地点与时间副词_地点副词
title: 副词·地点与时间副词 - 地点副词
scriptType: practice
---

-> start

=== start ===
#bg: /assets/bg/office_lobby.png
#speaker: Tom
#expression: default
#position: center
#translation: 嘿！我在楼下大厅等你半天了。你刚才在哪儿？
Tom: Hey! I've been waiting for you downstairs in the lobby for ages. Where were you?

#speaker: User
#expression: default
#translation: 抱歉！我在楼上找了你一圈。
User: Sorry! I've been looking everywhere for you upstairs.
#objective: 用 everywhere / upstairs / downstairs 描述方位
#hint: 用 "I've been looking everywhere...", "I was upstairs...", "I waited downstairs..."
#chunks: I've been looking everywhere for my keys.,She's waiting downstairs in the lobby.,The meeting is upstairs on the third floor.
#wait:input
-> find_place

=== find_place ===
#speaker: Tom
#expression: happy
#translation: 没关系！对了，附近有没有好的咖啡店？我想找个安静的地方聊聊天。
Tom: No worries! By the way, is there a good coffee shop nearby? I want to go somewhere quiet to talk.

#speaker: Tom
#expression: default
#translation: 这附近我哪儿都找不到好咖啡店——你知道附近有吗？
Tom: I can't find a good coffee shop anywhere around here — do you know if there's one nearby?
#objective: 用 nearby / somewhere / anywhere / nowhere 描述地点
#hint: 用 "Is there a ___ nearby?", "Let's go somewhere...", "I can't find ___ anywhere"
#chunks: Is there a grocery store nearby?,Let's go somewhere quiet to talk.,I can't find my phone anywhere.,There's nowhere to park around here.
#wait:input
-> weather_part

=== weather_part ===
#speaker: Tom
#expression: thinking
#translation: 哦，下雨了！我们进去吧。对了，你一直想出国留学，现在怎么样了？
Tom: Oh, it's raining! Let's go inside. By the way, you've always wanted to study abroad — how's that going?
#objective: 用 inside / outside / abroad 描述空间
#hint: 用 "Let's go inside", "study abroad", "play outside"
#chunks: It's raining let's go inside.,She's always wanted to study abroad.,The kids are playing outside in the yard.
#wait:input
-> ending

=== ending ===
#speaker: Tom
#expression: happy
#translation: 太好了！希望你能实现。我们去找个安静的地方继续聊吧。
Tom: That's great! I hope you make it happen. Let's find somewhere quiet and continue our chat.
#chunks: Let's go somewhere quiet to talk.
-> END
