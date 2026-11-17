# How the long version scores you

This covers the 52-question version of Close Enough. The quick quiz has its own page: [METHODOLOGY.md](METHODOLOGY.md). The math lives in [`deep-core.js`](deep-core.js), and if this page and the code ever disagree, the code wins. The tests in [`tests/deep.test.js`](tests/deep.test.js) pin it down.

The quick quiz is unchanged. The long version adds to it and keeps its results in a separate place, because the two are scored on different scales and shouldn't be averaged together.

## What it fixes

The quick quiz has four known soft spots, and the long version goes after each one.

1. **It assumes everyone's rings are in the same order.** Family, then close friends, then friends, coworkers, acquaintances. For plenty of people close friends come before family. The long version asks you to put the rings in your own order first, then uses that order for every "who can" question.
2. **Every touch counts the same.** A handshake and playing with someone's hair weigh equally in the quick quiz. The long version asks how close each kind of touch feels to you and weights your answers by that.
3. **All the questions are hard ones.** Nearly every quick-quiz question is about something guarded, so most people score low on how personal and pile up in The Vault. The long version adds easy questions (who can know what you do for work, who can shake your hand) so the scale has a bottom, a middle and a top.
4. **Nothing checks whether an answer set is any good.** The long version asks two questions twice in different words, includes one attention check, and looks for a few patterns that usually mean someone tapped through.

## The five parts

| Part | Questions | Scored? |
|---|---|---|
| Your circles | 6 | No. They set the quiz up. |
| What counts as close | 9 | No. They become weights. |
| The questions | 32 | Yes. 16 sharing, 16 touch. |
| Checks, mixed into the questions | 3 | No. They grade the run, not you. |
| About you | 2, both optional | No. |

That's 52. Someone who just finished the quick quiz can carry on from their results: their 20 answers come along and they answer the other 32.

### Your circles

The first question is the ranking: tap the five groups in order, closest first. Strangers always stay on the outside. The buttons show up in a random order so nobody is nudged toward the usual one.

The other five ask what the rings mean to you: who "family" mostly means, where a partner fits, how many close friends you have, which ring your closest person at work is really in, and what moves someone from acquaintance to friend. These don't change your score. They're there so the group results can be read properly. If half the people who say "family" mean the family they chose, that matters for what the family ring is measuring.

### What counts as close (the touch ladder)

Nine kinds of touch, each rated from "Nothing to it" (0) to "Very close" (4): a handshake or high five, a pat on the back, a hand on the arm or shoulder, a full hug, a cheek kiss hello, holding hands, a head on a shoulder, playing with hair, and a back rub.

You rate the touch by itself, not who it's with. Every touch question in the scored part is about one of these nine.

### The questions

The quick quiz's 20, word for word, plus 12 new ones.

New sharing questions: who can know what you do for a living, who can follow your personal social media, who hears what you actually did over the weekend, who you'd ask for a ride to the airport at 5am, who knows about the hard stuff going on in your family, and who knows about the thing you're least proud of.

New touch questions: who can shake your hand, who you hug when you say goodbye, whose shoulder you'd put a hand on when they're upset, a close friend falling asleep leaning on you, hugging an acquaintance who's having a rough day, and high-fiving a stranger at a game.

The new touch questions lean toward giving on purpose. The quick quiz has 3 giving questions out of 10. The long version has 7 giving and 9 receiving.

They're shuffled the same way as the quick quiz: a sharing question, then a touch question, with touch alternating between "who can" and "how do you feel".

### The checks

- **Two repeats.** "Who would you vent to about something that's really bothering you?" comes back later as "Who do you go to when you need to get something off your chest?" Same for hugging hello. The original always lands in the first half and the repeat near the end, at least 8 questions apart.
- **One attention check.** "Pick Friends for this one."

### About you

Age range and gender. Both can be skipped. See "What happens to age and gender" below.

## Rings in your own order

In the long version a ring answer is a level from 0 to 6: nobody, then your 1st ring out to your 5th, then strangers. If you put close friends first, then "1st ring" means close friends for you and family is the 2nd.

The score uses the level, which is how far out you went. The table of who gets in uses your order to say which group that is.

One wrinkle: if you carry 20 answers over from the quick quiz and then move the rings around, those 20 were given with the usual order on screen. They're kept as levels, so "two rings out" stays "two rings out". For anyone who keeps the usual order (most people), nothing changes at all.

## How personal

Same as the quick quiz, with 16 questions instead of 10.

```
How personal = round( mean(sharing levels) / 6 × 100 )
```

## How touchy

Every touch answer is scaled to 0 to 1 first, like the quick quiz (ring levels divided by 6, feelings divided by 4). Then each one gets a weight from your own touch ladder:

```
weight = 1 + how close you rated that kind of touch     (so 1 to 5)
How touchy = round( sum(weight × answer) / sum(weight) × 100 )
```

So being open about a touch you rated "Very close" counts five times as much as being open about one you rated "Nothing to it". Someone who lets strangers shake their hand but keeps everything they consider close for a small circle scores lower than the plain average would say, and that's the point.

Rate everything the same and all the weights are equal, which gives the plain average. The plain average is saved too, as `touchy_raw`, so the two can always be compared.

Worked example: say you're wide open on the 5 hug questions (all 1.0) and closed on the other 11 (all 0). The plain average is 5/16, so 31%. If you rated hugs "Very close" and everything else "Nothing to it", the weights are 5 and 1, and the score is 25/36, so 69%. If you rated them the other way around it drops to 5/60, so 8%.

## The margin ("give or take")

Each score comes with a margin. It answers: if you'd been asked a different set of similar questions, how far could the score have moved?

It's the standard error of your (weighted) average across questions, widened to cover 90% of cases:

```
margin = round( 1.645 × standard error × 100 )
```

On the chart it's the shaded area around your dot. This margin is deliberately on the wide side, because it counts the fact that some questions are just harder than others as if it were noise. Once enough people have taken the long version, the stats page shows a tighter one worked out from the whole group.

## Where you land

Same four corners and the same "Right Down the Middle" band (within 8 points of the center on both axes) as the quick quiz. What changes is where the center is.

- Until 30 people have taken the long version, the center lines sit at 50 and 50.
- After that, they sit at the typical person: the median of first tries with no flags.

This is the fix for everyone landing in The Vault. "Guarded" should mean more guarded than most people, not below an arbitrary halfway mark on a scale built mostly from hard questions.

It does mean a result name can change as more people take it. Your percentages never change. The saved `quadrant` column records where you'd land against the fixed 50 lines, and the stats page re-centers everyone against the current typical person.

## Compared with everyone

Two comparisons show up on the results page when there's enough data (30 people):

- **Long version:** your percentile on each axis among long-version first tries with no flags.
- **Quick-quiz scale:** your 20 quick-quiz answers scored with the quick quiz's own math, compared with everyone who's taken either version. This is how long-version results stay comparable with the quick quiz.

A percentile here is the share of people who scored below you, with ties counted as half.

## The breakdowns

Plain averages (no weights), as percentages:

- **How deep the sharing goes:** surface stuff (5 questions), personal stuff (6), the heavy stuff (5).
- **Telling vs letting in:** telling people things (9) vs letting them into your space or stuff (7).
- **Touch:** receiving (9) vs giving (7), and saying hello (8) vs comfort and affection (8).

Which question sits where is listed at the top of `deep-core.js`.

## When a run gets flagged

A flagged run still gets its results. It's marked on the stats page and left out of the group numbers by default, and anyone can switch that filter off.

| Flag | What triggers it |
|---|---|
| Missed the attention check | Any answer other than Friends |
| Repeats didn't match | One repeated question answered 3 or more rings apart, or both averaging 2 or more apart |
| Same answer nearly every time | 90% or more of the 24 "who can" answers are the same ring |
| Easy and hard flipped | "Least proud of" answered 2 or more rings wider than "what you do for work", or hair 2 or more wider than a handshake |
| Too fast | Under 2.25 seconds per question, the same pace the quick quiz treats as rushed |

## What the stats page checks

The long version has its own stats page, [deep.html](deep.html). Besides where everyone landed, it grades the quiz itself:

- **Do the questions hang together?** Cronbach's alpha for each axis. Roughly: under 0.6 is weak, 0.7 is fine, 0.8 is good, and over 0.9 suggests some questions are repeating each other.
- **Margin on a score.** The group version: the spread of scores times the square root of (1 minus alpha).
- **Old questions vs new ones.** The correlation between people's average on the quick quiz's questions and their average on the new ones. If the new questions measure the same thing, this is high.
- **Personal vs touchy.** The correlation between the two axes. If it's very high, the chart is really one axis drawn twice.
- **How the scores spread out.** A histogram per axis with its skew. Near 0 is even. Above 1 means most people are piled at the low end.
- **Pull, per question.** How well each question tracks the rest of its axis with itself left out. Under 0.20 means the question isn't adding much and is a candidate to reword or cut.

These need at least 10 responses to show and a lot more to trust.

## What happens to age and gender

Answers plus an age range and a gender could point at one person in a small group of friends. So those two are stored in columns the public can't read. The stats page gets them only as group averages, only for groups of at least 5 people, through a database function that enforces the minimum itself. They're not in the CSV download.

## Known limits

- **It isn't a validated psychological scale.** It borrows the standard tools (reliability checks, repeated questions, an attention check, percentiles) but nobody has tested it against other measures or a representative sample.
- **The sample picks itself**, and so far it's mostly one region. "More personal than 60% of people" means 60% of the people who found this quiz.
- **A partner sits inside family.** The partner question shows how many people that's true for, but the ring answers can't separate "my partner" from "my parents".
- **Feeling questions name a ring.** "A coworker pats you on the back" means something different to someone who ranked coworkers second than to someone who ranked them last. The answer is taken as given.
- **Sharing has no ladder.** Touch is weighted by what each kind means to you. Sharing questions all count the same.
- **Carried-over answers** were given before the person set their own ring order (see above).
- **Result names depend on who else has taken it** once the center lines move.
