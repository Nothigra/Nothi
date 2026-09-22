import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Zap, Shield, Flame, Lock, Gift, Check, ChevronRight, ChevronLeft, Calendar, ShoppingBag, Package, Star, MessageSquare, Award, Crown, Trophy, Medal } from 'lucide-react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Link } from 'react-router';
import { BADGE_CATALOG } from '../api/gamificationApi';
import { useGamification } from '../context/GamificationContext';
import { useAuth } from '../context/AuthContext';
import { getSellerSalesCount } from '../api/productApi';
import BadgeIcon from '../components/common/BadgeIcon';
import './RewardsPage.css';

const getSalesTier = (sales) => {
  if (sales >= 100) return { name: "Platinum Seller", color: "var(--color-platinum)", icon: <Crown size={40} color="var(--color-platinum)" strokeWidth={1.5} />, next: null };
  if (sales >= 50) return { name: "Gold Seller", color: "var(--color-gold)", icon: <Trophy size={40} color="var(--color-gold)" strokeWidth={1.5} />, next: 100 };
  if (sales >= 10) return { name: "Silver Seller", color: "var(--color-silver)", icon: <Medal size={40} color="var(--color-silver)" strokeWidth={1.5} />, next: 50 };
  return { name: "Bronze Seller", color: "var(--color-bronze)", icon: <Award size={40} color="var(--color-bronze)" strokeWidth={1.5} />, next: 10 };
};

const getRankInfo = (level) => {
  if (level < 1) level = 1;
  const rankIndex = Math.min(Math.floor((level - 1) / 3), 9);
  const subLevel = ((level - 1) % 3) + 1;
  
  const ranks = [
    { name: 'Novice', color: 'var(--rank-novice-bg)' },
    { name: 'Apprentice', color: 'var(--rank-apprentice-bg)' },
    { name: 'Creator', color: 'var(--rank-creator-bg)' },
    { name: 'Craftsman', color: 'var(--rank-craftsman-bg)' },
    { name: 'Expert', color: 'var(--rank-expert-bg)' },
    { name: 'Master', color: 'var(--rank-master-bg)' },
    { name: 'Grandmaster', color: 'var(--rank-grandmaster-bg)' },
    { name: 'Epic', color: 'var(--rank-epic-bg)' },
    { name: 'Mythic', color: 'var(--rank-mythic-bg)' },
    { name: 'Legend', color: 'var(--rank-legend-bg)' }
  ];

  return {
    ...ranks[rankIndex],
    subLevel,
    subLevelStr: 'I'.repeat(subLevel)
  };
};

const CountdownTimer = ({ lastClaimedDate, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!lastClaimedDate) return;

    const calculateTimeLeft = () => {
      const claimTime = new Date(lastClaimedDate).getTime();
      const nextClaimTime = claimTime + 24 * 60 * 60 * 1000;
      const now = Date.now();
      const difference = nextClaimTime - now;

      if (difference <= 0) {
        return null;
      }

      const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const m = Math.floor((difference / 1000 / 60) % 60);
      const s = Math.floor((difference / 1000) % 60);

      return h + 'h ' + m + 'm ' + s + 's';
    };

    const initial = calculateTimeLeft();
    if (!initial) {
      onComplete();
      return;
    }
    setTimeLeft(initial);

    const timer = setInterval(() => {
      const left = calculateTimeLeft();
      if (!left) {
        clearInterval(timer);
        onComplete();
      } else {
        setTimeLeft(left);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastClaimedDate, onComplete]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center justify-center gap-sm text-sm font-bold text-secondary bg-bg-card p-sm rounded-lg border border-border mt-sm">
      <Lock size={18} /> Next reward in {timeLeft}
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
const RewardsPage = () => {
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { gamificationState, isLoading, hasUnclaimedReward, claimReward, refreshState, markXpSeen } = useGamification();
  const [isClaiming, setIsClaiming] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [liveSalesCount, setLiveSalesCount] = useState(0);
  
  // Framer Motion spring for animated XP
  const animatedXP = useSpring(0, { bounce: 0, duration: 800 });
  const displayXP = useTransform(animatedXP, (value) => Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  const [fillLevel, setFillLevel] = useState(0);

  // Timeline Scroll State
  const timelineRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (timelineRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = timelineRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [gamificationState]);

  const scrollTimelineLeft = () => {
    if (timelineRef.current) {
      const amount = window.innerWidth > 768 ? 400 : 250;
      timelineRef.current.scrollBy({ left: -amount, behavior: 'smooth' });
    }
  };

  const scrollTimelineRight = () => {
    if (timelineRef.current) {
      const amount = window.innerWidth > 768 ? 400 : 250;
      timelineRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };


  useEffect(() => {
    if (user?.id) {
      getSellerSalesCount(user.id).then(setLiveSalesCount).catch(console.error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (gamificationState) {
      animatedXP.set(gamificationState.xp);
      setFillLevel((gamificationState.xp / gamificationState.nextLevelXP) * 100);
    }
  }, [gamificationState, animatedXP]);

  useEffect(() => {
    if (gamificationState?.xp > 0 && typeof markXpSeen === 'function') {
      markXpSeen();
    }
  }, [gamificationState?.xp, markXpSeen]);

  const handleClaim = async () => {
    if (!hasUnclaimedReward) return;
    setIsClaiming(true);
    try {
      await claimReward();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } catch (e) {
      console.error(e);
      // Optional: alert user if they already claimed
    } finally {
      setIsClaiming(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="page-container flex-center min-h-[50vh]">
        <div className="loader spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page-container flex-center flex-col min-h-[60vh] text-center gap-md px-lg">
        <Gift size={48} className="text-tertiary mb-sm" />
        <h1 className="text-2xl font-bold">Sign in to see your Rewards</h1>
        <p className="text-secondary max-w-sm">
          Track your XP, level up, and unlock badges once you're signed in.
        </p>
        <Link to="/login" className="btn btn-primary mt-md">
          Sign In
        </Link>
      </div>
    );
  }

  if (!gamificationState) return null;

  const { level, nextLevelXP, unlockedBadges, lastClaimedDate } = gamificationState;
  const rankInfo = getRankInfo(level);
  
  const isClaimed = !hasUnclaimedReward && lastClaimedDate;

  const handleCountdownComplete = () => {
    refreshState();
  };

  const salesTier = getSalesTier(liveSalesCount);

  // Define milestones for the timeline
  const milestones = [
    { level: 1, title: 'Journey Begins', desc: 'Welcome to the marketplace', type: 'start' },
    { level: 5, title: 'Bronze Border', desc: 'Unlock the Bronze profile frame', type: 'frame', color: 'var(--rank-apprentice-bg)' },
    { level: 10, title: 'Rising Star', desc: 'Unlock Silver frame + Badge', type: 'badge', color: 'var(--rank-expert-bg)', badgeId: 'level_10' },
    { level: 20, title: 'Elite Status', desc: 'Unlock Gold frame + Badge', type: 'badge', color: 'var(--rank-master-bg)', badgeId: 'level_20' },
    { level: 30, title: 'The Legend', desc: 'Unlock Diamond frame + Badge', type: 'badge', color: 'var(--rank-legend-bg)', badgeId: 'level_30' }
  ];

  return (
    <div className="page-container pb-2xl overflow-x-hidden">
      
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 flex-center">
          <div className="absolute inset-0 bg-accent/20 animate-pulse"></div>
          <div className="text-6xl animate-bounce">?? +150 XP ??</div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative mb-xl flex flex-col items-center justify-center text-center py-xl">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/10 to-transparent rounded-3xl -z-10"></div>
        <h1 className="text-4xl md:text-5xl font-black mb-sm bg-clip-text text-transparent bg-gradient-to-r from-accent to-purple-500">
          Rewards & Progression
        </h1>
        <p className="text-secondary max-w-lg">
          Level up your profile, unlock exclusive badges, and track your sales tier in real-time.
        </p>
      </div>

      {/* TOP METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md mb-xl max-w-6xl mx-auto z-10 relative">
        
        {/* Animated Total XP Display */}
        <div className="w-full card-elevated p-lg flex flex-col items-center justify-center bg-bg-secondary">
          <span className="text-sm font-bold text-secondary uppercase tracking-wider mb-xs">Total Experience</span>
          <motion.div className="text-5xl font-black text-accent flex items-baseline gap-xs">
            <motion.span>{displayXP}</motion.span>
            <span className="text-xl text-text-secondary font-bold">XP</span>
          </motion.div>
        </div>

        {/* Level Progress Card */}
        <div className="w-full card-elevated p-lg flex flex-col justify-center gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-md">
              <div className="rank-badge-shield shadow-lg" style={{ background: rankInfo.color }}>
                <span className="rank-title">{rankInfo.name}</span>
                <span className="rank-sublevel">{rankInfo.subLevelStr}</span>
              </div>
              <div>
                <div className="text-sm text-secondary uppercase tracking-wider font-bold">Level {level}</div>
                <div className="text-lg font-bold">{rankInfo.name} {rankInfo.subLevelStr}</div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-secondary text-sm block">To Level {level + 1}</span>
              <span className="text-xl font-bold">{nextLevelXP - gamificationState.xp} XP</span>
            </div>
          </div>
          
          <div className="progress-container mt-xs">
            <div className="progress-track" style={{ height: '8px' }}>
              <motion.div 
                className="progress-fill shadow-glow"
                initial={{ width: 0 }}
                animate={{ width: fillLevel + '%' }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>

        {/* Sales Tier Card */}
        <div 
          className="w-full card-elevated p-lg flex flex-col justify-center gap-md transition-all duration-500"
          style={{ 
            borderColor: salesTier.color, 
            boxShadow: 'inset 0 0 20px -10px ' + salesTier.color + ', 0 4px 20px -5px ' + salesTier.color + '40'
          }}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-md">
              <div className="text-4xl drop-shadow-md">{salesTier.icon}</div>
              <div>
                <div className="text-sm text-secondary uppercase tracking-wider font-bold">Sales Tier</div>
                <div className="text-lg font-black" style={{ color: salesTier.color, textShadow: '0 0 10px ' + salesTier.color + '40' }}>
                  {salesTier.name}
                </div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-3xl font-black">{liveSalesCount}</span>
              <span className="text-secondary text-xs uppercase font-bold tracking-wider">Total Sales</span>
            </div>
          </div>
          
          {salesTier.next && (
            <div className="progress-container mt-xs">
              <div className="progress-track" style={{ height: '8px', background: 'var(--color-bg)' }}>
                <motion.div 
                  className="progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: ((liveSalesCount / salesTier.next) * 100) + '%' }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  style={{ background: salesTier.color, boxShadow: '0 0 10px ' + salesTier.color }}
                />
              </div>
              <div className="text-right w-full mt-xs block">
                <span className="text-xs text-secondary font-medium">{salesTier.next - liveSalesCount} sales to next tier</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* SECONDARY ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md mb-2xl max-w-6xl mx-auto">
        
        {/* Daily Reward Card */}
        <div className="w-full card-elevated p-lg flex flex-col items-center text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-lg opacity-10 group-hover:opacity-20 transition-opacity">
            <Gift size={100} />
          </div>
          <div className="bg-bg p-md rounded-full mb-md relative z-10 shadow-lg border border-border">
            <Gift className={isClaimed ? "text-secondary" : "text-accent animate-pulse"} size={32} />
          </div>
          <h2 className="text-2xl font-black mb-xs relative z-10">Daily Reward</h2>
          <p className="text-secondary mb-lg relative z-10">Claim your free 150 XP every 24 hours.</p>
          
          {isClaimed ? (
            <CountdownTimer lastClaimedDate={lastClaimedDate} onComplete={handleCountdownComplete} />
          ) : (
            <button 
              className="btn btn-claim-animated w-full py-md text-lg rounded-xl transition-all hover:-translate-y-1 relative z-10"
              onClick={handleClaim}
              disabled={isClaiming}
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
            >
              {isClaiming ? <span className="flex-center gap-xs"><div className="loader spin w-4 h-4 border-2"></div> Claiming...</span> 
               : 'Claim 150 XP'}
            </button>
          )}
        </div>

        {/* Ways to Earn XP */}
        <div className="w-full card-elevated p-lg">
          <h3 className="font-bold text-lg mb-md flex items-center gap-sm"><Star className="text-accent"/> Ways to Earn XP</h3>
          <ul className="flex flex-col gap-md">
            <li className="flex justify-between items-center text-sm p-sm bg-bg-secondary rounded-lg">
              <span className="flex items-center gap-sm text-secondary font-medium"><Calendar size={18}/> Daily login</span>
              <span className="font-bold text-accent">+150 XP</span>
            </li>
            <li className="flex justify-between items-center text-sm p-sm bg-bg-secondary rounded-lg">
              <span className="flex items-center gap-sm text-secondary font-medium"><Package size={18}/> Complete a sale</span>
              <span className="font-bold text-accent">+300 XP</span>
            </li>
            <li className="flex justify-between items-center text-sm p-sm bg-bg-secondary rounded-lg">
              <span className="flex items-center gap-sm text-secondary font-medium"><ShoppingBag size={18}/> Make a purchase</span>
              <span className="font-bold text-accent">+100 XP</span>
            </li>
            <li className="flex justify-between items-center text-sm p-sm bg-bg-secondary rounded-lg">
              <span className="flex items-center gap-sm text-secondary font-medium"><Zap size={18}/> Publish new product</span>
              <span className="font-bold text-accent">+150 XP</span>
            </li>
          </ul>
        </div>
      </div>

      {/* VISUAL TIMELINE CENTERPIECE */}
      <div className="max-w-6xl mx-auto w-full mb-xl">
        <div className="text-center mb-xl px-md">
          <h2 className="text-3xl font-black mb-sm bg-clip-text text-transparent bg-gradient-to-r from-text-primary to-text-secondary">The Road to Legend</h2>
          <p className="text-secondary">Track your upcoming milestones and unlocked rewards.</p>
        </div>
        
        <div className="relative group">
          {/* Navigation Arrows (Desktop) */}
          <button 
            onClick={scrollTimelineLeft} 
            disabled={!canScrollLeft}
            className={`hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 p-4 rounded-full bg-bg-card shadow-2xl border-2 border-border transition-all duration-300 ${canScrollLeft ? 'opacity-100 hover:scale-110 hover:border-accent cursor-pointer' : 'opacity-0 pointer-events-none'}`}
            aria-label="Scroll left"
          >
            <ChevronLeft size={32} className="text-primary" />
          </button>
          <button 
            onClick={scrollTimelineRight} 
            disabled={!canScrollRight}
            className={`hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 p-4 rounded-full bg-bg-card shadow-2xl border-2 border-border transition-all duration-300 ${canScrollRight ? 'opacity-100 hover:scale-110 hover:border-accent cursor-pointer' : 'opacity-0 pointer-events-none'}`}
            aria-label="Scroll right"
          >
            <ChevronRight size={32} className="text-primary" />
          </button>

          {/* Navigation Arrows (Mobile) */}
          <button 
            onClick={scrollTimelineLeft} 
            disabled={!canScrollLeft}
            className={`md:hidden absolute left-1 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-bg-card shadow-xl border border-border transition-all duration-300 ${canScrollLeft ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'}`}
            aria-label="Scroll left"
          >
            <ChevronLeft size={24} className="text-primary" />
          </button>
          <button 
            onClick={scrollTimelineRight} 
            disabled={!canScrollRight}
            className={`md:hidden absolute right-1 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-bg-card shadow-xl border border-border transition-all duration-300 ${canScrollRight ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'}`}
            aria-label="Scroll right"
          >
            <ChevronRight size={24} className="text-primary" />
          </button>

          {/* Horizontal Battle Pass Track */}
          <div 
            ref={timelineRef}
            onScroll={checkScroll}
            className="relative py-md overflow-x-auto snap-x snap-mandatory scrollbar-hide" 
            style={{ scrollBehavior: 'smooth' }}
          >
          <div className="timeline-track-inner" style={{ paddingBottom: '2rem' }}>
            
            {/* Horizontal Track Line */}
            <div className="absolute top-1/2 left-32 md:left-40 right-32 md:right-40 h-2 bg-border -translate-y-1/2 z-0">
              <div 
                className="h-full bg-accent transition-all duration-1000 rounded-full" 
                style={{ 
                  width: Math.min(100, Math.max(0, (level / 30) * 100)) + '%',
                  boxShadow: '0 0 10px var(--color-accent)'
                }}
              ></div>
            </div>

            {/* Nodes Sequence */}
            <div className="flex gap-0 relative z-10">
              {milestones.map((m, idx) => {
                const isPassed = level >= m.level;
                const isCurrent = level >= m.level && (idx === milestones.length - 1 || level < milestones[idx + 1].level);
                
                let badgeAsset = null;
                if (m.badgeId) {
                  badgeAsset = BADGE_CATALOG.find(b => b.id === m.badgeId);
                }

                // Alternating layout logic
                const isTop = idx % 2 === 0;

                return (
                  <div key={m.level} className={`flex flex-col items-center justify-center relative w-[280px] md:w-[320px] snap-center shrink-0 ${isPassed ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                    
                    {/* Top Card */}
                    <div className={`h-40 w-full flex items-end justify-center pb-md px-sm ${isTop ? 'visible' : 'invisible'}`}>
                      <div className="card-elevated p-md w-full border-2 transition-all duration-300 relative group flex flex-col items-center text-center" style={{ borderColor: isCurrent ? 'var(--color-accent)' : 'transparent' }}>
                        <div className="flex justify-center items-center gap-sm mb-xs w-full">
                          {badgeAsset && isPassed && <img src={badgeAsset.imageUrl} alt="Badge" className="w-8 h-8 object-contain drop-shadow-md absolute -top-4 -right-2" />}
                          <span className="text-xs font-bold px-xs py-[2px] rounded-sm uppercase tracking-widest bg-bg-secondary text-secondary">Level {m.level}</span>
                        </div>
                        <h4 className="font-black text-lg leading-tight whitespace-normal break-words text-center px-1" style={{ color: m.color || 'var(--color-text-primary)', minWidth: '100%' }}>{m.title}</h4>
                        <p className="text-xs text-secondary mt-xs line-clamp-2">{m.desc}</p>
                      </div>
                    </div>

                    {/* The Node */}
                    <div 
                      className="w-12 h-12 rounded-full border-4 flex flex-col items-center justify-center z-10 transition-all duration-500 my-2 shrink-0"
                      style={{ 
                        boxShadow: isCurrent ? '0 0 0 4px var(--color-bg), 0 0 15px var(--color-accent)' : (isPassed ? '0 0 10px var(--color-accent)' : 'none'),
                        borderColor: isPassed ? 'var(--color-accent)' : 'var(--color-border)',
                        backgroundColor: isPassed ? 'var(--color-bg)' : 'var(--color-bg-secondary)'
                      }}
                    >
                      {isPassed ? <Check size={20} className="text-accent" /> : <Lock size={16} className="text-tertiary" />}
                    </div>

                    {/* Bottom Card */}
                    <div className={`h-40 w-full flex items-start justify-center pt-md px-sm ${!isTop ? 'visible' : 'invisible'}`}>
                      <div className="card-elevated p-md w-full border-2 transition-all duration-300 relative group flex flex-col items-center text-center" style={{ borderColor: isCurrent ? 'var(--color-accent)' : 'transparent' }}>
                        <div className="flex justify-center items-center gap-sm mb-xs w-full">
                          {badgeAsset && isPassed && <img src={badgeAsset.imageUrl} alt="Badge" className="w-8 h-8 object-contain drop-shadow-md absolute -bottom-4 -right-2" />}
                          <span className="text-xs font-bold px-xs py-[2px] rounded-sm uppercase tracking-widest bg-bg-secondary text-secondary">Level {m.level}</span>
                        </div>
                        <h4 className="font-black text-lg leading-tight whitespace-normal break-words text-center px-1" style={{ color: m.color || 'var(--color-text-primary)', minWidth: '100%' }}>{m.title}</h4>
                        <p className="text-xs text-secondary mt-xs line-clamp-2">{m.desc}</p>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      </div>
      {/* View All Badges Link */}
      <div className="flex justify-center mt-xl max-w-4xl mx-auto">
        <Link 
          to="/dashboard/badges"
          className="btn btn-outline py-md px-xl rounded-xl flex justify-center items-center gap-sm bg-bg-card hover:bg-bg-secondary transition-colors w-full md:w-auto"
        >
          <Award size={18} /> View Complete Badge Collection <ChevronRight size={18} />
        </Link>
      </div>

    </div>
  );
};

export default RewardsPage;
