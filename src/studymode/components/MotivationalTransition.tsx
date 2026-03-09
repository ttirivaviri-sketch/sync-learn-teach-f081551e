import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import { Button } from './ui/button';

const QUOTES = [
  {
    text: "You do not rise to the level of your goals. You fall to the level of your systems.",
    tip: "Focus on building a daily study routine, not just big academic goals.",
  },
  {
    text: "Habits are the compound interest of self-improvement.",
    tip: "A little studying every day grows into massive knowledge over time.",
  },
  {
    text: "Success is the product of daily habits—not once-in-a-lifetime transformations.",
    tip: "Small consistent effort beats cramming every time.",
  },
  {
    text: "Every action you take is a vote for the type of person you wish to become.",
    tip: "Every study session is a vote for becoming a knowledgeable person.",
  },
  {
    text: "Small habits don't add up. They compound.",
    tip: "Your daily 30 minutes of study will snowball into mastery.",
  },
  {
    text: "You should be far more concerned with your current trajectory than with your current results.",
    tip: "Keep studying even if grades haven't improved yet.",
  },
  {
    text: "Goals are good for setting direction, but systems are best for making progress.",
    tip: "Build a study system you can repeat every day.",
  },
  {
    text: "The most effective way to change your habits is to focus not on what you want to achieve, but on who you wish to become.",
    tip: "Become the kind of person who studies daily.",
  },
  {
    text: "Environment is the invisible hand that shapes human behavior.",
    tip: "Create a study space that encourages focus.",
  },
  {
    text: "Make it obvious. Make it attractive. Make it easy. Make it satisfying.",
    tip: "The four rules for building good habits like studying.",
  },
  {
    text: "Professionals stick to the schedule; amateurs wait for inspiration.",
    tip: "Show up for your study sessions no matter what.",
  },
  {
    text: "A habit must be established before it can be improved.",
    tip: "Start small — even 10 minutes of study counts.",
  },
  {
    text: "The secret to getting results that last is to never stop making improvements.",
    tip: "Always refine your study techniques.",
  },
  {
    text: "If you get 1% better each day for one year, you'll end up 37 times better.",
    tip: "Tiny daily progress leads to extraordinary results.",
  },
  {
    text: "When nothing seems to help, remember that tiny changes can lead to remarkable results.",
    tip: "Trust the process and keep going.",
  },
];

// Mood-based quote selection: lower mood → more encouraging quotes
function getQuoteForMood(mood: number): typeof QUOTES[number] {
  // Weight toward more encouraging quotes for lower moods
  const encouragingIndices = [0, 4, 5, 13, 14]; // Most encouraging
  const neutralIndices = [1, 2, 6, 7, 11, 12];
  const energeticIndices = [3, 8, 9, 10];

  let pool: number[];
  if (mood <= 2) {
    pool = encouragingIndices;
  } else if (mood <= 3) {
    pool = [...encouragingIndices, ...neutralIndices];
  } else {
    pool = [...neutralIndices, ...energeticIndices];
  }

  const idx = pool[Math.floor(Math.random() * pool.length)];
  return QUOTES[idx];
}

// Artistic background patterns
const BACKGROUNDS = [
  // Deep blue gradient with floating orbs
  {
    bg: 'from-[hsl(220,60%,8%)] via-[hsl(240,50%,15%)] to-[hsl(260,40%,10%)]',
    accent: 'hsl(217, 91%, 60%)',
    orbs: ['hsl(217,91%,60%)', 'hsl(262,83%,58%)', 'hsl(190,80%,50%)'],
  },
  // Warm sunset tones
  {
    bg: 'from-[hsl(20,60%,8%)] via-[hsl(350,40%,12%)] to-[hsl(280,30%,8%)]',
    accent: 'hsl(25, 95%, 53%)',
    orbs: ['hsl(25,95%,53%)', 'hsl(350,70%,50%)', 'hsl(45,90%,55%)'],
  },
  // Emerald dark
  {
    bg: 'from-[hsl(160,40%,5%)] via-[hsl(180,30%,10%)] to-[hsl(200,40%,8%)]',
    accent: 'hsl(142, 76%, 36%)',
    orbs: ['hsl(142,76%,36%)', 'hsl(170,60%,40%)', 'hsl(200,70%,50%)'],
  },
  // Royal purple
  {
    bg: 'from-[hsl(270,50%,8%)] via-[hsl(290,40%,12%)] to-[hsl(310,30%,8%)]',
    accent: 'hsl(262, 83%, 58%)',
    orbs: ['hsl(262,83%,58%)', 'hsl(290,70%,55%)', 'hsl(330,60%,50%)'],
  },
];

interface MotivationalTransitionProps {
  mood: number;
  onContinue: () => void;
}

export function MotivationalTransition({ mood, onContinue }: MotivationalTransitionProps) {
  const [quote] = useState(() => getQuoteForMood(mood));
  const [bgTheme] = useState(() => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]);
  const [showTip, setShowTip] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tipTimer = setTimeout(() => setShowTip(true), 2800);
    const readyTimer = setTimeout(() => setReady(true), 3500);
    return () => {
      clearTimeout(tipTimer);
      clearTimeout(readyTimer);
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-gradient-to-br ${bgTheme.bg}`}>
      {/* Floating orbs */}
      {bgTheme.orbs.map((color, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl opacity-20"
          style={{
            background: `radial-gradient(circle, ${color}, transparent 70%)`,
            width: `${300 + i * 100}px`,
            height: `${300 + i * 100}px`,
          }}
          initial={{
            x: i === 0 ? -200 : i === 1 ? 200 : 0,
            y: i === 0 ? -100 : i === 1 ? 100 : -200,
          }}
          animate={{
            x: [i === 0 ? -200 : i === 1 ? 200 : 0, i === 0 ? 100 : i === 1 ? -100 : 150, i === 0 ? -200 : i === 1 ? 200 : 0],
            y: [i === 0 ? -100 : i === 1 ? 100 : -200, i === 0 ? 150 : i === 1 ? -150 : 100, i === 0 ? -100 : i === 1 ? 100 : -200],
          }}
          transition={{
            duration: 12 + i * 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Particle dots */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute w-1 h-1 rounded-full"
          style={{ background: bgTheme.accent, opacity: 0.3 }}
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000) - 500,
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800) - 400,
          }}
          animate={{
            y: [null, Math.random() * -200 - 50],
            opacity: [0.1, 0.6, 0],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-8 text-center">
        {/* Book icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, type: 'spring', bounce: 0.4 }}
          className="mb-8 inline-flex"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${bgTheme.accent}, transparent)`,
              opacity: 0.9,
            }}
          >
            <BookOpen className="w-8 h-8 text-white" />
          </div>
        </motion.div>

        {/* Quote */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <blockquote className="relative">
            <motion.span
              className="absolute -top-8 -left-4 text-6xl font-serif opacity-20"
              style={{ color: bgTheme.accent }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 0.2, x: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              "
            </motion.span>
            <p
              className="text-2xl md:text-3xl lg:text-4xl font-bold leading-relaxed tracking-tight text-white"
              style={{
                textShadow: `0 0 40px ${bgTheme.accent}40`,
              }}
            >
              {quote.text.split(' ').map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block mr-[0.3em]"
                  initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    duration: 0.5,
                    delay: 0.6 + i * 0.06,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  {word}
                </motion.span>
              ))}
            </p>
          </blockquote>
        </motion.div>

        {/* Attribution */}
        <motion.p
          className="mt-6 text-sm tracking-widest uppercase opacity-50 text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 2.2, duration: 0.8 }}
        >
          — James Clear, Atomic Habits
        </motion.p>

        {/* Tip */}
        <AnimatePresence>
          {showTip && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="mt-10 flex items-start gap-3 justify-center"
            >
              <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: bgTheme.accent }} />
              <p className="text-base md:text-lg text-white/70 italic max-w-md text-left">
                {quote.tip}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue button */}
        <AnimatePresence>
          {ready && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-12"
            >
              <Button
                onClick={onContinue}
                size="lg"
                className="rounded-full px-8 py-6 text-lg font-semibold text-white border-0 shadow-xl hover:scale-105 transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${bgTheme.accent}, ${bgTheme.orbs[1]})`,
                  boxShadow: `0 10px 40px -10px ${bgTheme.accent}80`,
                }}
              >
                Begin Study Session
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
