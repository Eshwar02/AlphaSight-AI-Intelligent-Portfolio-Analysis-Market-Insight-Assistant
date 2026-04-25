'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { TrendingUp, BarChart3, Globe, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WelcomeScreenProps {
  onSendPrompt: (prompt: string) => void;
}

const suggestions = [
  {
    icon: TrendingUp,
    label: 'Analyze Apple (AAPL)',
    prompt: 'Analyze Apple stock',
    description: 'Price action, fundamentals & outlook',
  },
  {
    icon: BarChart3,
    label: 'Reliance deep dive',
    prompt: 'Reliance Industries deep dive',
    description: 'Comprehensive analysis of RIL',
  },
  {
    icon: Globe,
    label: 'US market outlook',
    prompt: "What's happening in US markets today?",
    description: 'Indices, sectors & macro trends',
  },
  {
    icon: ArrowLeftRight,
    label: 'Compare TCS vs Infosys',
    prompt: 'Compare TCS vs Infosys',
    description: 'Head-to-head IT sector comparison',
  },
];

const greetings = [
  "Hello {name}, ready to dive into the markets?",
  "Welcome back {name}, what's on your mind today?",
  "Hey {name}, let's analyze some stocks!",
  "Good to see you {name}, how can I assist with your portfolio?",
  "Hi {name}, excited to help with your financial queries!",
  "Greetings {name}, shall we explore market insights?",
  "Hey there {name}, what's your investment question?",
  "Welcome {name}, let's make some smart investment decisions!",
  "Hello again {name}, ready for market analysis?",
  "Hi {name}, let's uncover some stock opportunities!",
];

export function WelcomeScreen({ onSendPrompt }: WelcomeScreenProps) {
  const storedName = typeof window !== 'undefined' ? localStorage.getItem('userName') : null;
  const initialGreeting = storedName ? `Hello ${storedName}, ready to dive into the markets?` : "Hello, how can I help you today?";
  const [greeting, setGreeting] = useState(initialGreeting);
  const [name, setName] = useState(storedName || "");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/user/memory');
        if (res.ok) {
          const data = await res.json();
          const userName = data.memory?.name || "";
          setName(userName);

          // Get last greeting from localStorage
          const lastGreeting = localStorage.getItem('lastGreeting');
          let availableGreetings = greetings.filter(g => g !== lastGreeting);
          if (availableGreetings.length === 0) availableGreetings = greetings;

          const randomGreeting = availableGreetings[Math.floor(Math.random() * availableGreetings.length)];
          const personalized = userName ? randomGreeting.replace('{name}', userName) : "Hello, how can I help you today?";
          setGreeting(personalized);

          // Store name and greeting
          if (userName) localStorage.setItem('userName', userName);
          localStorage.setItem('lastGreeting', randomGreeting);
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      }
    };

    fetchUserData();
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-16 sm:pb-16">
      {/* Brand mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="mb-5"
      >
        <Image src="/logo.svg" alt="AlphaSight" width={40} height={40} />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="mb-8 text-center hero-title text-gray-100"
      >
        {greeting}
      </motion.h1>


    </div>
  );
}
