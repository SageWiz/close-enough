# How Close Enough scores you

This is the plain-English version of the math in [`quiz-core.js`](quiz-core.js). If the two ever disagree, the code wins, and the tests in [`tests/scoring.test.js`](tests/scoring.test.js) pin it down.

## The two things it measures

**How personal** (the X axis) is how far out your circle goes when it comes to sharing things about yourself: who can see you cry, who knows where you live, who gets the honest answer.

**How touchy** (the Y axis) is how comfortable you are with physical contact, and with whom.

Each axis gets 10 questions.

## Question order

Everyone gets a different order. Each time the quiz starts, it shuffles the questions but keeps the same rhythm: a sharing question, then a touch question, and the touch questions alternate between "who can" and "how do you feel". So the order is random, but nobody gets five touch questions in a row.

Shuffling keeps any one question from always coming first, when people are still warming up, or last, when they're rushing to finish. The order has no effect on the score, since every answer is scored the same wherever it appears. Each saved response records the order that person saw, so position effects can be checked later.

## The two kinds of questions

**Ring questions** ask "who can...?" and you pick the widest ring you'd be okay with. Picking a ring includes everyone inside it.

| Answer | Value |
|---|---|
| Nobody | 0 |
| Family | 1 |
| Close friends | 2 |
| Friends | 3 |
| Coworkers | 4 |
| Acquaintances | 5 |
| Strangers | 6 |

**Feeling questions** describe a situation with a specific person in it, and you say how you feel about it.

| Answer | Value |
|---|---|
| Hard no | 0 |
| Rather not | 1 |
| Depends | 2 |
| Fine by me | 3 |
| Love it | 4 |

All 10 sharing questions are ring questions. The 10 touch questions are split: 5 ring questions ("Who can hug you hello?") and 5 feeling questions ("Someone you met an hour ago at a party hugs you goodbye.").

## How personal

Average your 10 sharing answers, divide by 6 (the widest ring), and turn it into a percentage.

```
How personal = round( mean(sharing answers) / 6 × 100 )
```

So answering "Friends" (3) to everything gives 50%. "Strangers" to everything gives 100%.

## How touchy

The touch section mixes two scales (0 to 6 and 0 to 4), so each answer is first scaled to a number between 0 and 1: ring answers are divided by 6, feeling answers by 4. Then all 10 are averaged.

```
How touchy = round( mean( ring answers / 6, feeling answers / 4 ) × 100 )
```

Every touch question counts the same, whichever kind it is.

## Where you land

Your two scores become a dot on the chart, and the dot's corner is your result:

| | Less personal (under 50) | More personal (50 and up) |
|---|---|---|
| **More touchy (50 and up)** | Warm Once You're In | Hugs Hello |
| **Less touchy (under 50)** | The Vault | Open Book, Hands Off |

If both scores are within 8 points of 50 (so 42 to 58 on both), the result is **Right Down the Middle** instead. A dot sitting almost on the center lines doesn't really belong to any corner.

## Who gets in

For each ring, this counts how many of the questions you let that ring in on. Sharing uses the 10 sharing questions, touch uses the 5 touch ring questions.

```
Who gets in (ring k) = round( number of answers ≥ k / number of questions × 100 )
```

Family is ring 1, so it's the share of questions you didn't answer "Nobody" to. Strangers is ring 6, so it's the share you answered "Strangers" to.

## Where your line usually sits

The results page says something like "For sharing, your line usually sits at friends." That's the median of your ring answers. With an even number of answers, it takes the lower of the two middle values, so it leans toward the more guarded answer rather than inventing a half-ring.

## Giving vs. receiving

Three of the feeling questions are about you reaching out (touching a friend's arm, going in for the hug first, rubbing a friend's back). Those make up **giving**.

**Receiving** is everything that's done to you: the 5 touch ring questions plus the 2 feeling questions where someone else starts it (the party hug and the coworker's pat on the back). Same 0 to 1 scaling as above, then averaged.

## A worked example

Say someone answers:

- Sharing: 2, 2, 3, 4, 2, 1, 3, 1, 4, 2 (average 2.4)
- Touch rings: 5, 2, 3, 4, 1
- Touch feelings: 3, 4, 3, 4, 3 (in quiz order: party hug, touch arm, coworker pat, first hug, back rub)

Then:

- How personal = 2.4 / 6 = 0.40, so **40%**
- How touchy = mean(5/6, 2/6, 3/6, 4/6, 1/6, 3/4, 4/4, 3/4, 4/4, 3/4) = 0.675, so **68%**
- 40 is more than 8 away from 50, so they're in **Warm Once You're In**
- Who gets in, sharing: Family 100%, Close friends 80%, Friends 40%, Coworkers 20%, Acquaintances 0%, Strangers 0%
- Receiving 57%, giving 92%

## What the stats page adds

The [stats page](dashboard.html) groups everyone who left "add my answers" checked. A few choices worth knowing about:

- **First tries only.** On by default. Each browser counts its own finishes, and only first finishes are included, so one person retaking it a few times doesn't pull the averages toward their answers.
- **Sources.** The link tag (`?ref=instagram`) is saved as-is. "No tag" means a plain link. Sources with fewer than 20 responses are marked as rough, since a handful of people can swing an average a lot.
- **Rushed runs.** Finishes under 45 seconds are hidden by default. Twenty questions in under 45 seconds is a little over 2 seconds each, which usually means tapping through without reading. You can switch the filter off.
- **Typical answer.** Per question, the stats page uses the ordinary median. The coloured bar shows the full spread, so you can see when a "typical" answer hides a big split.
- **Most split.** Questions are ranked by the standard deviation of their answers, after scaling to 0 to 1.
- **Seconds per question.** The median time the question was on screen before it was answered, including any time spent after coming back to it. Because the order is shuffled, a question isn't slower just because it always came first.
- **Finish rate.** Finished quizzes divided by started quizzes, counting only people who had the box checked when they started. It follows the time, device and source filters, and counts retakes and rushed runs, since those still finished.

## Known limits

- **The rings are assumed to nest.** The quiz treats Coworkers as further out than Friends, and Friends as further out than Close friends. For most people that's true. For someone whose best friend is a coworker, it's a judgment call, which is why the ring guide says to go with where someone usually sits.
- **Every question weighs the same.** "Who can see you cry?" and "Who can know where you live?" count equally, even though most people would say they aren't equally personal.
- **The sample picks itself.** Results only include people who found the quiz, finished it, and left the box checked. It says something about them, not about everyone.
- **Retakes are only caught on the same browser.** Someone who retakes it in a private window or on another device looks like a new person.
