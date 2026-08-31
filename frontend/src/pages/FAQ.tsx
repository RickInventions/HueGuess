import { useMemo, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Trophy,
  Target,
  Zap,
  Users,
  User,
  UserPlus,
  HelpCircle,
  Award,
  TrendingUp,
  Crown,
  Shield,
  Mail,
  Medal,
  MessageCircle,
  Search,
  X,
  Sliders,
  LogOut,
  Clock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { RANK_LADDER, STARTING_RATING, getRankDivision } from '../lib/ranks'
import { RankBadge } from '../components/ui/RankBadge'

interface FAQItem {
  question: string
  /** Plain text so the search box can match on it. */
  answer: string
  /** Optional rich block rendered under the answer (tables, ladders). */
  extra?: ReactNode
  icon?: ReactNode
}

interface FAQCategory {
  id: string
  name: string
  blurb: string
  icon: ReactNode
  items: FAQItem[]
}

/**
 * The rank ladder, rendered from RANK_LADDER rather than written out in prose.
 *
 * The bands moved once already; deriving the rows means the answer can never
 * drift from what the server actually awards.
 */
function RankLadderTable() {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      {RANK_LADDER.map((band, idx) => {
        const entry = getRankDivision(band.min)
        const top = getRankDivision(band.max)
        return (
          <div
            key={band.tier}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 ${
              idx % 2 === 1 ? 'bg-surface-alt/70' : 'bg-surface'
            }`}
          >
            <RankBadge label={band.tier} size="sm" className="w-[104px] justify-center" />
            <span className="font-mono text-xs text-muted">
              {entry.label} → {top.label}
            </span>
            <span className="ml-auto font-mono text-xs font-semibold text-deep">
              {band.min.toLocaleString()} – {band.max.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Per-difficulty numbers, read straight off the shared difficulty config. */
function DifficultyTable() {
  const rows = [
    { name: 'Easy', memo: '6s', round: '35s', sat: '50–100%', light: '40–70%', threshold: '65%' },
    { name: 'Medium', memo: '4s', round: '30s', sat: '30–100%', light: '25–80%', threshold: '75%' },
    { name: 'Hard', memo: '2s', round: '15s', sat: '15–100%', light: '15–90%', threshold: '80%' },
    { name: 'Extreme', memo: '0.5s', round: '15s', sat: '5–100%', light: '5–95%', threshold: '85%' },
  ]

  return (
    <div className="mt-3 -mx-1 overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="px-2 py-2 font-semibold text-deep">Difficulty</th>
            <th className="px-2 py-2 font-semibold text-deep">Memorize</th>
            <th className="px-2 py-2 font-semibold text-deep">Round</th>
            <th className="px-2 py-2 font-semibold text-deep">Saturation</th>
            <th className="px-2 py-2 font-semibold text-deep">Lightness</th>
            <th className="px-2 py-2 font-semibold text-deep">Break-even</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.name} className={idx % 2 === 1 ? 'bg-surface-alt/70' : ''}>
              <td className="px-2 py-2 font-semibold text-deep">{row.name}</td>
              <td className="px-2 py-2 font-mono text-muted">{row.memo}</td>
              <td className="px-2 py-2 font-mono text-muted">{row.round}</td>
              <td className="px-2 py-2 font-mono text-muted">{row.sat}</td>
              <td className="px-2 py-2 font-mono text-muted">{row.light}</td>
              <td className="px-2 py-2 font-mono font-semibold text-deep">{row.threshold}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Swing per game at each difficulty, from the server's rating curve. */
function PointsTable() {
  const rows = [
    { name: 'Easy', best: '+70', breakEven: '+5', worst: '−20 and below' },
    { name: 'Medium', best: '+110', breakEven: '+20', worst: '−60 and below' },
    { name: 'Hard', best: '+180', breakEven: '+40', worst: '−90 and below' },
    { name: 'Extreme', best: '+400', breakEven: '+25', worst: '−180 and below' },
  ]

  return (
    <div className="mt-3 -mx-1 overflow-x-auto">
      <table className="w-full min-w-[380px] text-left text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="px-2 py-2 font-semibold text-deep">Difficulty</th>
            <th className="px-2 py-2 font-semibold text-deep">At 100%</th>
            <th className="px-2 py-2 font-semibold text-deep">At break-even</th>
            <th className="px-2 py-2 font-semibold text-deep">15% under</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.name} className={idx % 2 === 1 ? 'bg-surface-alt/70' : ''}>
              <td className="px-2 py-2 font-semibold text-deep">{row.name}</td>
              <td className="px-2 py-2 font-mono font-semibold text-success">{row.best}</td>
              <td className="px-2 py-2 font-mono text-muted">{row.breakEven}</td>
              <td className="px-2 py-2 font-mono text-accent">{row.worst}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const faqCategories: FAQCategory[] = [
  {
    id: 'gameplay',
    name: 'Gameplay',
    blurb: 'The basics of a round',
    icon: <Target className="w-5 h-5" />,
    items: [
      {
        question: 'How do I play HueGuess?',
        answer:
          'A colour is shown for a few seconds and then hidden. Recreate it from memory with the Hue, Saturation and Lightness sliders and submit. The closer your colour is to the original, the higher your accuracy.',
        icon: <Target className="w-4 h-4" />,
      },
      {
        question: 'How exactly is accuracy calculated?',
        answer:
          'Your colour is compared to the target on all three HSL channels and the errors are weighted: hue counts for 50%, saturation 25% and lightness 25%. Hue error is measured the short way around the wheel, so 350° and 10° are only 20° apart. A perfect match is 100%.',
        icon: <Sliders className="w-4 h-4" />,
      },
      {
        question: 'What do the difficulty levels mean?',
        answer:
          'Harder difficulties draw from wider saturation and lightness ranges, give you less time to memorize the colour, and pay out far more HuePoints. Break-even is the accuracy you need just to avoid losing points.',
        extra: <DifficultyTable />,
        icon: <Zap className="w-4 h-4" />,
      },
      {
        question: 'Can I play without an account?',
        answer:
          'Yes. Casual mode needs no sign-up at all — pick a difficulty and play. Nothing is saved and it does not touch your rank, so it is the right place to warm up.',
        icon: <User className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'huepoints',
    name: 'HuePoints & Ranks',
    blurb: 'How the ladder works',
    icon: <Trophy className="w-5 h-5" />,
    items: [
      {
        question: 'How are HuePoints calculated?',
        answer:
          'Every difficulty has a break-even accuracy. Beat it and you gain points, scaling up to a maximum at 100%. Fall short and the same line keeps going down into a loss, so a badly missed Extreme round costs far more than a badly missed Easy one. Your HuePoints never drop below 0.',
        extra: <PointsTable />,
        icon: <TrendingUp className="w-4 h-4" />,
      },
      {
        question: 'What are the ranks and their HuePoint ranges?',
        answer:
          'Six tiers split into thirty divisions. Divisions count down as you climb, so Bronze III is the entry rank and Legendary I is the summit.',
        extra: <RankLadderTable />,
        icon: <Crown className="w-4 h-4" />,
      },
      {
        question: 'Which rank do I start on?',
        answer: `New accounts start on ${STARTING_RATING} HuePoints, which puts you in ${getRankDivision(
          STARTING_RATING
        ).label}. From there you climb by beating the break-even accuracy for whichever difficulty you play.`,
        icon: <Medal className="w-4 h-4" />,
      },
      {
        question: 'Why is Bronze I better than Bronze III?',
        answer:
          'Divisions run high-to-low inside every tier, the same way most competitive ladders do. Bronze III is where you begin, Bronze I is the last step before Silver III, and the very top of the ladder is Legendary I.',
        icon: <Crown className="w-4 h-4" />,
      },
      {
        question: 'How do streaks work?',
        answer:
          'Streaks only count on Hard and Extreme. Every game where you clear the break-even accuracy extends the streak; a single game under it resets the streak to zero. Easy and Medium games leave your streak untouched.',
        icon: <Zap className="w-4 h-4" />,
      },
      {
        question: 'What happens if I get 0% accuracy?',
        answer:
          'A 0% happens if you run out of time, reload mid-round, or disconnect. It is treated as a real result: it resets your streak and takes the full loss for that difficulty. Your total can never go below 0 HuePoints, though.',
        icon: <Shield className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'leaderboard',
    name: 'Leaderboard',
    blurb: 'Qualifying, filters and awards',
    icon: <Medal className="w-5 h-5" />,
    items: [
      {
        question: 'How do I get on the leaderboard?',
        answer:
          'Play at least 20 competitive games. The threshold keeps the board to players with a settled rating rather than one lucky round.',
        icon: <Medal className="w-4 h-4" />,
      },
      {
        question: 'What do the All-time, Weekly and Daily filters do?',
        answer:
          'All-time ranks everyone by their current HuePoints. Weekly and Daily only include players who actually played in that window, and rank them on what they did inside it — points gained, games played, accuracy and best streak for the period.',
        icon: <Clock className="w-4 h-4" />,
      },
      {
        question: 'What are the leaderboard awards?',
        answer:
          'Four emblems go to the current leaders: Top Points, Top Accuracy, Most Games and Longest Streak. They are recalculated from live stats, so they change hands as soon as someone overtakes the holder.',
        icon: <Award className="w-4 h-4" />,
      },
      {
        question: 'How often does the leaderboard update?',
        answer:
          'Immediately. Every ranking is read from live stats when you open the page, so a game you just finished is already counted.',
        icon: <TrendingUp className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'challenge',
    name: 'Challenge Mode',
    blurb: 'Playing rooms with friends',
    icon: <Users className="w-5 h-5" />,
    items: [
      {
        question: 'How does Challenge Mode work?',
        answer:
          'Create a room and share the 8-character code, or invite a friend straight from the friends panel. The host sets difficulty, memorize time (0.5–7s), round time (10–40s), room size (2–8 players) and how many rounds to play. Everyone readies up, a 3-2-1 countdown runs, and the best average accuracy across the rounds wins.',
        icon: <Users className="w-4 h-4" />,
      },
      {
        question: 'Does Challenge Mode affect my rank?',
        answer:
          'No. Challenge Mode is completely separate from competitive — no HuePoints are gained or lost, and your streak is untouched. It only counts toward the multiplayer achievements.',
        icon: <Shield className="w-4 h-4" />,
      },
      {
        question: 'Can I leave and rejoin a game?',
        answer:
          'Yes. If you drop out you have 30 seconds to reconnect and your seat is held for you, with a warning shown to the room after 20. Rejoin with the same room code. Any round that finishes while you are away scores 0% for you.',
        icon: <User className="w-4 h-4" />,
      },
      {
        question: 'Where is the leave button?',
        answer:
          'It is the exit icon in the top-right corner of the room, and it always asks for confirmation first. It used to sit under the Ready and Submit buttons, which made it far too easy to hit by accident on a phone.',
        icon: <LogOut className="w-4 h-4" />,
      },
      {
        question: 'Can I chat during a room?',
        answer:
          'Yes, on every screen — the waiting room, during a round, between rounds and on the final results page. You will see who is typing, and a short chime plays for messages that arrive while you are looking elsewhere. You can mute it from the sound toggle.',
        icon: <MessageCircle className="w-4 h-4" />,
      },
      {
        question: 'What happens if the host leaves?',
        answer:
          'Host passes to the next connected player and the game carries on. If everyone leaves, the room closes and its code is released.',
        icon: <Users className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'friends',
    name: 'Friends & Invites',
    blurb: 'Adding people and inviting them in',
    icon: <UserPlus className="w-5 h-5" />,
    items: [
      {
        question: 'How do I add someone as a friend?',
        answer:
          'Open the friends panel from the icon in the top bar, search for their username and send a request. You can also add someone from their profile page, or straight from their card in a room\'s waiting list. They have to accept before you are friends.',
        icon: <UserPlus className="w-4 h-4" />,
      },
      {
        question: 'How do I know I have a friend request?',
        answer:
          'The friends icon in the top bar carries a count of requests waiting on you, and a toast appears the moment one arrives while you are online. Open the panel to accept or decline.',
        icon: <Mail className="w-4 h-4" />,
      },
      {
        question: 'How do I invite a friend to my room?',
        answer:
          'While you are in a room, open the friends panel and press Invite next to anyone online. They get the invite as a notification they can join from directly, so nobody has to copy a code into another app.',
        icon: <Users className="w-4 h-4" />,
      },
      {
        question: 'Why can I not invite a friend?',
        answer:
          'Invites are delivered live, so a friend has to be online to receive one. Offline friends show a grey dot and the Invite button stays disabled. The button is also hidden when you are not currently in a room, or when the room is already full.',
        icon: <Shield className="w-4 h-4" />,
      },
      {
        question: 'How do I remove a friend?',
        answer:
          'From the friends panel, or from their profile page. Removing asks for confirmation first, and it removes the friendship for both of you — you can always send a new request later.',
        icon: <X className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'account',
    name: 'Account & Verification',
    blurb: 'Email, username and passwords',
    icon: <User className="w-5 h-5" />,
    items: [
      {
        question: 'Why do I need to verify my email?',
        answer:
          'Verification gates Competitive Mode, the leaderboard, the Daily Challenge and achievements. It is what stops one person farming a rank across a pile of throwaway accounts.',
        icon: <Mail className="w-4 h-4" />,
      },
      {
        question: 'Can I change my username?',
        answer:
          'Yes, once every 2 days. Open your profile and use the edit icon next to your name. Usernames are 3–30 characters and may contain letters, numbers and underscores.',
        icon: <User className="w-4 h-4" />,
      },
      {
        question: 'I did not receive my verification email',
        answer:
          'Check your spam folder first. If it is not there, open your profile and use "Resend verification", or request a new link from the Verify Email page. Links expire after 24 hours.',
        icon: <Mail className="w-4 h-4" />,
      },
      {
        question: 'How do I reset my password?',
        answer:
          'Use "Forgot password?" on the login page. Enter your email and we will send a reset link, which is valid for 1 hour.',
        icon: <Shield className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'daily',
    name: 'Daily Challenge',
    blurb: 'One colour, everyone, once a day',
    icon: <Target className="w-5 h-5" />,
    items: [
      {
        question: 'What is the Daily Challenge?',
        answer:
          'One colour per day, identical for every player. You get a single attempt, so there is nowhere to hide — everyone is ranked on the same colour.',
        icon: <Target className="w-4 h-4" />,
      },
      {
        question: 'When does the Daily Challenge reset?',
        answer:
          'At midnight UTC. A new colour is drawn and the daily board starts over.',
        icon: <Clock className="w-4 h-4" />,
      },
    ],
  },
  {
    id: 'achievements',
    name: 'Achievements',
    blurb: 'What there is to unlock',
    icon: <Award className="w-5 h-5" />,
    items: [
      {
        question: 'How many achievements are there?',
        answer:
          '17, across six categories: Accuracy (90%, 95%, 99%), Streaks (3, 5, 10), Games Played (10, 50, 100), Ranks (Silver, Gold, Platinum, Diamond), Modes (first Hard, first Extreme, 10 Hard) and Multiplayer (first win, 10 games).',
        icon: <Award className="w-4 h-4" />,
      },
      {
        question: 'Can I see my progress toward one?',
        answer:
          'Yes. The Achievements section on your profile lists locked achievements with how far along you are, next to the ones you have already earned.',
        icon: <Target className="w-4 h-4" />,
      },
      {
        question: 'Do achievements give rewards?',
        answer:
          'They are for bragging rights. Unlocked achievements are shown on your public profile for anyone who looks you up.',
        icon: <Medal className="w-4 h-4" />,
      },
    ],
  },
]

export default function FAQ() {
  const [openCategory, setOpenCategory] = useState<string | null>('gameplay')
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()

  // While a query is active the accordion is replaced by a flat result list, so
  // an answer buried three taps deep is one glance away.
  const results = useMemo(() => {
    if (!query) return []
    return faqCategories.flatMap(category =>
      category.items
        .filter(
          item =>
            item.question.toLowerCase().includes(query) ||
            item.answer.toLowerCase().includes(query)
        )
        .map(item => ({ category, item }))
    )
  }, [query])

  const toggleCategory = (id: string) => setOpenCategory(prev => (prev === id ? null : id))
  const toggleItem = (key: string) => setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-base via-surface to-primary/[0.05] py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 sm:mb-8"
        >
          <div className="inline-flex items-center justify-center p-2 sm:p-3 bg-primary/10 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
            <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-deep mb-3">
            Frequently asked questions
          </h1>
          <p className="text-muted text-sm sm:  max-w-xl mx-auto">
            How scoring, ranks, rooms and friends actually work. Still stuck?{' '}
            <Link to="/support" className="text-primary font-medium hover:underline">
              Contact support
            </Link>
            .
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative mb-5 sm:mb-6"
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search the FAQ…"
            aria-label="Search the FAQ"
            /*   on mobile: anything smaller makes iOS Safari zoom on focus. */
            className="w-full rounded-button border border-border bg-surface py-3 pl-11 pr-11   sm:text-sm text-deep shadow-card placeholder:text-muted focus:border-primary/40 focus:outline-none focus:shadow-glow-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-button p-1.5 text-muted transition-colors hover:bg-surface-alt hover:text-deep cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>

        {query ? (
          /* ── Search results ─────────────────────────────────────────────── */
          <div className="space-y-3">
            <p className="px-1 text-xs text-muted">
              {results.length === 0
                ? 'No matches.'
                : `${results.length} ${results.length === 1 ? 'answer' : 'answers'} for “${search.trim()}”`}
            </p>

            {results.map(({ category, item }) => (
              <div
                key={`${category.id}-${item.question}`}
                className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5"
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                  <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{category.icon}</span>
                  {category.name}
                </div>
                <h3 className="font-heading   font-semibold text-black">{item.question}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.answer}</p>
                {item.extra}
              </div>
            ))}

            {results.length === 0 && (
              <div className="rounded-card border border-border bg-surface p-8 text-center shadow-card">
                <p className="text-sm text-deep">Nothing here matches that.</p>
                <p className="mt-1 text-sm text-muted">
                  Try a different word, or{' '}
                  <Link to="/support" className="text-primary font-medium hover:underline">
                    ask support
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── Category accordion ─────────────────────────────────────────── */
          <div className="space-y-3">
            {faqCategories.map((category, idx) => {
              const isOpen = openCategory === category.id
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx, 6) * 0.04 }}
                  className={`overflow-hidden rounded-card border bg-surface shadow-card transition-colors ${
                    isOpen ? 'border-primary/30' : 'border-border'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-alt sm:px-6 cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`shrink-0 rounded-xl p-2 transition-colors ${
                          isOpen ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {category.icon}
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-heading   sm:text-lg font-semibold text-deep">
                          {category.name}
                        </h2>
                        <p className="truncate text-xs text-muted">
                          {category.blurb} · {category.items.length} answers
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-muted transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-border"
                      >
                        <div className="divide-y divide-border px-2 py-1 sm:px-3">
                          {category.items.map((item, itemIdx) => {
                            const itemKey = `${category.id}-${itemIdx}`
                            const itemOpen = !!openItems[itemKey]
                            return (
                              <div key={itemKey}>
                                <button
                                  type="button"
                                  onClick={() => toggleItem(itemKey)}
                                  aria-expanded={itemOpen}
                                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-alt sm:px-3 cursor-pointer"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    {item.icon && (
                                      <span
                                        className={`shrink-0 transition-colors ${
                                          itemOpen ? 'text-primary' : 'text-muted'
                                        }`}
                                      >
                                        {item.icon}
                                      </span>
                                    )}
                                    <span className="break-words text-sm font-medium text-black">
                                      {item.question}
                                    </span>
                                  </div>
                                  <ChevronDown
                                    className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${
                                      itemOpen ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>

                                <AnimatePresence initial={false}>
                                  {itemOpen && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <div className="px-2 pb-4 pl-2 sm:px-3 sm:pl-10">
                                        <p className="text-sm leading-relaxed text-muted">
                                          {item.answer}
                                        </p>
                                        {item.extra}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Still have questions? */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-8 sm:mt-12"
        >
          <div className="rounded-card border border-border bg-gradient-to-r from-primary/[0.07] via-accent/[0.07] to-primary/[0.07] p-6 text-center shadow-card sm:p-8">
            <h3 className="font-heading text-lg sm:text-xl font-semibold text-deep">
              Still have questions?
            </h3>
            <p className="mx-auto mt-2 mb-5 max-w-md text-sm text-muted">
              If the answer is not here, send it over — we would rather hear about it than have you
              guess.
            </p>
            <Link
              to="/support"
              className="inline-flex items-center justify-center rounded-button bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Contact support
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
