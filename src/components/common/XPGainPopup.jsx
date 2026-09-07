import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGamification } from '../../context/GamificationContext';
import { Zap, Trophy } from 'lucide-react';
import './XPGainPopup.css';

export default function XPGainPopup() {
  const { gamificationState } = useGamification();
  const [popupQueue, setPopupQueue] = useState([]);
  
  const prevXpRef = useRef(gamificationState?.xp);
  const prevLevelRef = useRef(gamificationState?.level);

  useEffect(() => {
    console.log("[XPGainPopup] MOUNTED. Initial ref:", prevXpRef.current);
    return () => console.log("[XPGainPopup] UNMOUNTED");
  }, []);

  // We use a queue in case multiple XP bumps happen quickly.
  // We'll show them sequentially or stacked. Here we just show the active one.
  const activePopup = popupQueue.length > 0 ? popupQueue[0] : null;

  useEffect(() => {
    console.log("XPGainPopup gamificationState changed:", gamificationState?.xp, "prev:", prevXpRef.current);
    if (!gamificationState) return;

    if (prevXpRef.current !== undefined && gamificationState.xp > prevXpRef.current) {
      console.log("XPGainPopup DETECTED GAIN!", gamificationState.xp - prevXpRef.current);
      const delta = gamificationState.xp - prevXpRef.current;
      const didLevelUp = gamificationState.level > prevLevelRef.current;
      const newLevel = gamificationState.level;

      const newPopup = {
        id: Date.now(),
        delta,
        didLevelUp,
        newLevel
      };

      setPopupQueue(prev => [...prev, newPopup]);
    } else if (prevXpRef.current !== undefined && gamificationState.xp < prevXpRef.current) {
      console.warn("XPGainPopup DETECTED LOSS!", prevXpRef.current - gamificationState.xp);
    }
    
    prevXpRef.current = gamificationState.xp;
    prevLevelRef.current = gamificationState.level;
  }, [gamificationState]);

  // Handle popup duration
  useEffect(() => {
    console.log("XPGainPopup activePopup changed:", activePopup);
    if (activePopup) {
      const timer = setTimeout(() => {
        setPopupQueue(prev => prev.slice(1));
      }, 2500); // Show for 2.5 seconds
      return () => clearTimeout(timer);
    }
  }, [activePopup]);

  return (
    <AnimatePresence>
      {activePopup && (
        <motion.div
          key={activePopup.id}
          className={`xp-gain-popup ${activePopup.didLevelUp ? 'level-up' : ''}`}
          initial={{ opacity: 0, y: 30, x: "-50%", scale: 0.9 }}
          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
          exit={{ opacity: 0, y: -20, x: "-50%", scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {activePopup.didLevelUp ? (
            <>
              <div className="xp-gain-icon-wrapper">
                <Trophy size={24} className="text-warning" />
              </div>
              <div className="xp-gain-content">
                <span className="xp-gain-title">Level Up!</span>
                <span className="xp-gain-value">You are now Level {activePopup.newLevel}</span>
              </div>
            </>
          ) : (
            <>
              <div className="xp-gain-icon-wrapper">
                <Zap size={24} className="text-accent" />
              </div>
              <div className="xp-gain-content">
                <span className="xp-gain-title">XP Gained</span>
                <span className="xp-gain-value">+{Math.round(activePopup.delta)} XP</span>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
