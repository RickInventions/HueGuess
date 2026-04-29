import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Palette, Trophy, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ColorDisplay } from '@/components/ui/ColorDisplay';

function generateRandomVibrantColor() {
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 30) + 70; // 70-100
  const l = Math.floor(Math.random() * 25) + 45; // 45-70
  return { h, s, l };
}

const modes = [
  {
    path: '/casual',
    title: 'Casual',
    description: 'Relax and practice. No pressure.',
    icon: Palette,
    accent: 'border-l-4 border-primary',
    bgAccent: 'bg-primary/5',
  },
  {
    path: '/competitive',
    title: 'Competitive',
    description: 'Test your skills. Climb the ranks.',
    icon: Trophy,
    accent: 'border-l-4 border-accent',
    bgAccent: 'bg-accent/5',
  },
  {
    path: '/challenge',
    title: 'Challenge Friends',
    description: 'Real-time multiplayer. Prove it.',
    icon: Users,
    accent: 'border-l-4 border-transparent',
    bgAccent: 'bg-gradient-to-r from-primary/10 via-accent/10 to-success/10',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const randomColor = useMemo(() => generateRandomVibrantColor(), []);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      {/* Hero */}
      <motion.div
        className="text-center mb-8 sm:mb-12 lg:mb-16 w-full max-w-3xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-hero text-text-deep mb-3 sm:mb-4">
          <span className="block sm:inline">Train your</span>
          <br className="hidden sm:block" />
          <span className="sm:ml-2"> </span>
          <span
            className="transition-colors duration-1000"
            style={{
              color: `hsl(${randomColor.h}, ${randomColor.s}%, ${randomColor.l}%)`,
            }}
          >
            color memory
          </span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-text-muted max-w-md sm:max-w-lg mx-auto px-2">
          See a color. Remember it. Recreate it. Simple, but surprisingly addictive.
        </p>
      </motion.div>
      
      {/* Demo Color */}
      <motion.div
        className="mb-8 sm:mb-12 lg:mb-16"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <ColorDisplay
          color={randomColor}
          size="lg"
          animate
        />
      </motion.div>
      
      {/* Mode Cards */}
      <div className="w-full max-w-lg px-2 sm:px-0 space-y-3 sm:space-y-4">
        {modes.map((mode, i) => (
          <motion.div
            key={mode.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
            className="w-full"
          >
            <Card
              hover
              onClick={() => navigate(mode.path)}
              className={`relative overflow-hidden cursor-pointer ${mode.accent} ${mode.bgAccent} transition-all duration-300 hover:shadow-lg`}
            >
              <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5">
                <div className="p-2.5 sm:p-3 rounded-xl bg-surface-muted flex-shrink-0">
                  <mode.icon className="w-5 h-5 sm:w-6 sm:h-6 text-text-deep" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-heading font-semibold text-text-deep truncate">
                    {mode.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted mt-0.5 sm:mt-1 line-clamp-2">
                    {mode.description}
                  </p>
                </div>
                {/* Arrow indicator for mobile */}
                <div className="flex-shrink-0 opacity-40 sm:opacity-0 group-hover:opacity-40 transition-opacity">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      
      {/* Footer */}
      <motion.p
        className="mt-8 sm:mt-12 lg:mt-16 text-xs sm:text-sm text-text-muted text-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        No sign-up required for casual mode
      </motion.p>
    </div>
  );
}