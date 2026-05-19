import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronDown, 
  Trophy, 
  Target, 
  Zap, 
  Users, 
  User, 
  HelpCircle,
  Award,
  TrendingUp,
  Crown,
  Shield,
  Mail,
  Medal
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Link } from 'react-router-dom'

interface FAQItem {
  question: string
  answer: string
  icon?: React.ReactNode
}

interface FAQCategory {
  name: string
  icon: React.ReactNode
  items: FAQItem[]
}

export default function FAQ() {
  const [openCategory, setOpenCategory] = useState<string | null>('gameplay')
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  const toggleCategory = (categoryId: string) => {
    setOpenCategory(openCategory === categoryId ? null : categoryId)
  }

  const toggleItem = (itemKey: string) => {
    setOpenItems(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))
  }

  const faqCategories: FAQCategory[] = [
    {
      name: 'Gameplay',
      icon: <Target className="w-5 h-5" />,
      items: [
        {
          question: 'How do I play HueGuess?',
          answer: 'Memorize the displayed color for a few seconds, then use the HSL (Hue, Saturation, Lightness) sliders to recreate it. The closer your guess, the higher your accuracy percentage!',
          icon: <Target className="w-4 h-4" />
        },
        {
          question: 'What do the difficulty levels mean?',
          answer: 'Higher difficulties have stricter color ranges (saturation/lightness), shorter memorization time (CT), and higher multipliers. Easy: 6s CT, 50-100% saturation. Extreme: 0.5s CT, 5-100% saturation. The multiplier affects how many HuePoints you gain/lose.',
          icon: <Zap className="w-4 h-4" />
        },
        {
          question: 'Can I play without an account?',
          answer: 'Yes! Casual mode is completely free and requires no sign-up. Just click "Casual" and start playing immediately. Your progress won\'t be saved, but it\'s great for practice.',
          icon: <User className="w-4 h-4" />
        }
      ]
    },
    {
      name: 'Competitive & Scoring',
      icon: <Trophy className="w-5 h-5" />,
      items: [
        {
          question: 'How are HuePoints calculated?',
          answer: 'Your accuracy is compared to the expected accuracy for your current rank. Score better than expected → gain points. Score worse → lose points. Difficulty affects how many points you gain/lose (Easy: 0.8x, Medium: 1.0x, Hard: 1.2x, Extreme: 1.5x K-factor).',
          icon: <TrendingUp className="w-4 h-4" />
        },
        {
          question: 'What are the rank thresholds?',
          answer: 'Bronze: 0-299 HuePoints, Silver: 300-699, Gold: 700-1399, Platinum: 1400-2499, Diamond: 2500+. The higher your rank, the harder it is to gain points because expected accuracy increases with rank.',
          icon: <Crown className="w-4 h-4" />
        },
        {
          question: 'How do streaks work?',
          answer: 'Streaks count only on Hard & Extreme modes where you don\'t get a negative score (accuracy below threshold). A single negative score resets your entire streak! Easy and Medium games don\'t affect streaks.',
          icon: <Zap className="w-4 h-4" />
        },
        {
          question: 'What happens if I get 0% accuracy?',
          answer: '0% accuracy can happen if you timeout, reload the page during a round, or disconnect. It counts as a negative game, resets your streak, and significantly reduces your HuePoints.',
          icon: <Shield className="w-4 h-4" />
        }
      ]
    },
    {
      name: 'Leaderboard',
      icon: <Medal className="w-5 h-5" />,
      items: [
        {
          question: 'How do I qualify for the leaderboard?',
          answer: 'You need at least 20 competitive games played. This ensures the leaderboard reflects consistent and dedicated players. Once qualified, you\'ll appear on the global leaderboard.',
          icon: <Medal className="w-4 h-4" />
        },
        {
          question: 'What are the leaderboard awards?',
          answer: 'Emblems for Top Points (🏆), Top Accuracy (🎯), Most Games Played (📊), and Longest Streak (🔥). Top 10 players in any category get a special badge displayed on their profile!',
          icon: <Award className="w-4 h-4" />
        },
        {
          question: 'How often is the leaderboard updated?',
          answer: 'The leaderboard updates in real-time as games are played. Daily and weekly filters show performance within those time periods.',
          icon: <TrendingUp className="w-4 h-4" />
        }
      ]
    },
    {
      name: 'Challenge Mode (Multiplayer)',
      icon: <Users className="w-5 h-5" />,
      items: [
        {
          question: 'How does multiplayer work?',
          answer: 'Create or join a room with an 8-digit code (e.g., "A1B2C3D4"). The host configures round time, color time, difficulty, and max players (2-4). All players ready up, then compete in rounds. Best average accuracy wins!',
          icon: <Users className="w-4 h-4" />
        },
        {
          question: 'Can I leave and rejoin a game?',
          answer: 'Yes! If you disconnect during waiting or results, you can rejoin within 30 seconds. During active rounds, you\'ll get 0% for that round but can continue playing.',
          icon: <User className="w-4 h-4" />
        },
        {
          question: 'Does Challenge Mode affect my rank?',
          answer: 'No! Challenge Mode is separate from competitive ranking. No HuePoints are gained or lost. It\'s purely for fun and practice with friends.',
          icon: <Shield className="w-4 h-4" />
        },
        {
          question: 'What happens if the host leaves?',
          answer: 'If the host disconnects, host status transfers to the next connected player. If only one player remains, the room dissolves automatically.',
          icon: <Users className="w-4 h-4" />
        }
      ]
    },
    {
      name: 'Account & Verification',
      icon: <User className="w-5 h-5" />,
      items: [
        {
          question: 'Why do I need to verify my email?',
          answer: 'Email verification is required for Competitive Mode, Leaderboards, Daily Challenge, and Achievements to ensure fair play and prevent duplicate accounts.',
          icon: <Mail className="w-4 h-4" />
        },
        {
          question: 'Can I change my username?',
          answer: 'Yes, once every 2 days. Go to your Profile page and click the edit icon next to your username. Usernames must be 3-30 characters and can only contain letters, numbers, and underscores.',
          icon: <User className="w-4 h-4" />
        },
        {
          question: 'I didn\'t receive my verification email',
          answer: 'Check your spam folder. If it\'s not there, go to Profile and click "Resend verification" or use the link on the Verify Email page. The link expires in 24 hours.',
          icon: <Mail className="w-4 h-4" />
        },
        {
          question: 'How do I reset my password?',
          answer: 'Click "Forgot password?" on the login page. Enter your email, and we\'ll send a reset link that expires in 1 hour.',
          icon: <Shield className="w-4 h-4" />
        }
      ]
    },
    {
      name: 'Daily Challenge',
      icon: <Target className="w-5 h-5" />,
      items: [
        {
          question: 'What is the Daily Challenge?',
          answer: 'One fixed color per day, same for all players. Everyone competes for the best accuracy on that specific color. You can only submit once, so make it count!',
          icon: <Target className="w-4 h-4" />
        },
        {
          question: 'When does the Daily Challenge reset?',
          answer: 'The challenge resets at midnight UTC every day. A new color is generated, and leaderboards refresh for the new day.',
          icon: <TrendingUp className="w-4 h-4" />
        }
      ]
    },
    {
      name: 'Achievements',
      icon: <Award className="w-5 h-5" />,
      items: [
        {
          question: 'How many achievements are there?',
          answer: '17 achievements across 6 categories: Accuracy (90%, 95%, 99%), Streaks (3, 5, 10), Games Played (10, 50, 100), ELO Ranks (Silver, Gold, Platinum, Diamond), Modes (First Hard, First Extreme, 10 Hard), and Multiplayer (First Win, 10 Games).',
          icon: <Award className="w-4 h-4" />
        },
        {
          question: 'Can I see my achievement progress?',
          answer: 'Yes! Go to your Profile page and view the Achievements section. Locked achievements show your current progress toward unlocking them.',
          icon: <Target className="w-4 h-4" />
        },
        {
          question: 'Do achievements give any rewards?',
          answer: 'Achievements are for prestige and bragging rights! They display on your profile and unlock special badges that others can see.',
          icon: <Medal className="w-4 h-4" />
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="inline-flex items-center justify-center p-2 sm:p-3 bg-primary/10 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
            <HelpCircle className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-3 sm:mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-muted text-base sm:text-lg max-w-2xl mx-auto px-2">
            Everything you need to know about HueGuess. Can't find what you're looking for? 
            <Link to="/support" className="text-primary hover:underline ml-1">Contact support</Link>
          </p>
        </motion.div>

        {/* FAQ Categories */}
        <div className="space-y-3 sm:space-y-4">
          {faqCategories.map((category, idx) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="overflow-hidden">
                <button
                  onClick={() => toggleCategory(category.name.toLowerCase())}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-surface-alt transition-colors"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-primary shrink-0">{category.icon}</div>
                    <h2 className="font-heading text-lg sm:text-xl font-semibold text-left">
                      {category.name}
                    </h2>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 sm:w-5 sm:h-5 text-muted transition-transform duration-200 shrink-0 ${
                      openCategory === category.name.toLowerCase() ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {openCategory === category.name.toLowerCase() && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border"
                    >
                      <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
                        {category.items.map((item, itemIdx) => {
                          const itemKey = `${category.name}-${itemIdx}`
                          return (
                            <div key={itemIdx} className="border-b border-border/50 last:border-0">
                              <button
                                onClick={() => toggleItem(itemKey)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between hover:bg-surface-alt rounded-lg transition-colors gap-2"
                              >
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                  {item.icon && (
                                    <div className="text-muted shrink-0">{item.icon}</div>
                                  )}
                                  <span className="font-medium text-left text-sm sm:text-base break-words">
                                    {item.question}
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted transition-transform duration-200 shrink-0 ${
                                    openItems[itemKey] ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                              <AnimatePresence>
                                {openItems[itemKey] && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <div className="px-3 sm:px-4 pb-3 sm:pb-4 text-muted leading-relaxed text-sm sm:text-base">
                                      {item.answer}
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
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Still have questions? */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 sm:mt-12 text-center"
        >
          <Card className="p-6 sm:p-8 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
            <h3 className="font-heading text-lg sm:text-xl font-semibold mb-2">
              Still have questions?
            </h3>
            <p className="text-muted text-sm sm:text-base mb-4">
              Can't find the answer you're looking for? Please reach out to our support team.
            </p>
            <Link to="/support">
              <button className="px-5 sm:px-6 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors text-sm sm:text-base">
                Contact Support
              </button>
            </Link>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}