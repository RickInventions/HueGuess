import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Send, 
  Bug, 
  Lightbulb, 
  Star, 
  MessageCircle, 
  CheckCircle,
  AlertCircle,
  Mail,
  MessageSquare,
  Link
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { feedback } from '../lib/api'
import { toast } from 'sonner'

type FeedbackType = 'bug' | 'feature' | 'review' | 'other'

interface FeedbackOption {
  type: FeedbackType
  label: string
  icon: React.ReactNode
  placeholder: string
  color: string
}

const feedbackOptions: FeedbackOption[] = [
  {
    type: 'bug',
    label: 'Bug Report',
    icon: <Bug className="w-5 h-5" />,
    placeholder: 'What happened? Please include steps to reproduce if possible...',
    color: 'text-red-500 bg-red-500/10'
  },
  {
    type: 'feature',
    label: 'Feature Request',
    icon: <Lightbulb className="w-5 h-5" />,
    placeholder: 'What feature would you like to see? How would it improve HueGuess?...',
    color: 'text-yellow-500 bg-yellow-500/10'
  },
  {
    type: 'review',
    label: 'Review',
    icon: <Star className="w-5 h-5" />,
    placeholder: 'Share your experience with HueGuess. What do you love? What could be better?...',
    color: 'text-purple-500 bg-purple-500/10'
  },
  {
    type: 'other',
    label: 'Other',
    icon: <MessageCircle className="w-5 h-5" />,
    placeholder: 'Anything else you\'d like to tell us?...',
    color: 'text-primary bg-primary/10'
  }
]

export default function Support() {
  const { user } = useAuth()
  const [selectedType, setSelectedType] = useState<FeedbackType>('other')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contactEmail, setContactEmail] = useState(user?.email || '')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedOption = feedbackOptions.find(opt => opt.type === selectedType)!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Please enter a title')
      return
    }
    if (!description.trim()) {
      setError('Please enter a description')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      await feedback.submit(
        selectedType,
        title.trim(),
        description.trim(),
        contactEmail || undefined
      )
      setSubmitted(true)
      toast.success('Feedback submitted! Thank you for helping improve HueGuess.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit feedback'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h2 className="font-heading text-2xl font-semibold mb-2">Thank you!</h2>
          <p className="text-muted mb-6">
            Your feedback has been submitted. We appreciate your input and will review it shortly.
          </p>
          <Button onClick={() => setSubmitted(false)}>Submit another</Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-2">
            Feedback & Support
          </h1>
          <p className="text-muted">
            Help us improve HueGuess by reporting bugs or suggesting features.
            Every piece of feedback is read and appreciated.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Feedback Type Selection */}
              <div>
                <label className="block text-sm font-medium text-deep mb-3">
                  What type of feedback?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {feedbackOptions.map((option) => (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => setSelectedType(option.type)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        selectedType === option.type
                          ? `${option.color} border-current`
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {option.icon}
                        <span className="text-xs font-medium">{option.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-deep mb-2">
                  Title <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Brief summary of your feedback"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                  className="w-full px-4 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
                />
                <p className="text-xs text-muted mt-1">
                  {title.length}/200 characters
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-deep mb-2">
                  Description <span className="text-accent">*</span>
                </label>
                <textarea
                  placeholder={selectedOption.placeholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  required
                  className="w-full px-4 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow resize-none"
                />
              </div>

              {/* Contact Email (Optional) */}
              <div>
                <label className="block text-sm font-medium text-deep mb-2">
                  <Mail className="w-3 h-3 inline mr-1" />
                  Contact Email <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="We'll only use this to follow up about your feedback"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-button bg-surface-alt border border-border text-deep placeholder:text-muted focus:outline-none focus:shadow-glow-primary transition-shadow"
                />
                <p className="text-xs text-muted mt-1">
                  If you'd like us to follow up, leave your email. We won't spam you.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" fullWidth loading={loading} icon={<Send className="w-4 h-4" />}>
                Submit Feedback
              </Button>
            </form>
          </Card>

          {/* Alternative Contact */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted">
              Prefer to reach out directly? Email us at{' '}
              <a href="mailto:support@hueguess.com" className="text-primary hover:underline">
                support@hueguess.com
              </a>
            </p>
            <p className="text-xs text-muted mt-2">
              <Link to="/faq" className="text-primary hover:underline">
                ← Back to FAQ
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}