import { useNavigate } from 'react-router';
import {
  Heart, Users, Bell, Gift, Award, Crown, Settings, Moon, Sun, Info, Mail, FileText, Shield, LogOut, Trophy,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { isPro } from '../../config/plans';
import { Row, Group, versionLine } from './AppProfilePage';
import './AppPages.css';

/** Settings & more — everything that isn't part of the daily flow. */
export default function AppMenuPage() {
  const { profile, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const dark = theme !== 'light';

  return (
    <div className="app-page">
      <Group title="Account">
        <Row to="/dashboard/settings" icon={Settings} label="Account settings" />
        <Row to="/dashboard/subscription" icon={Crown} label="Plan" hint={isPro(profile) ? 'Pro' : 'Free'} />
        <Row icon={dark ? Moon : Sun} label="Appearance" hint={dark ? 'Dark' : 'Light'} onClick={() => setTheme(dark ? 'light' : 'dark')} />
      </Group>
      <Group title="Activity">
        <Row to="/notifications" icon={Bell} label="Notifications" />
        <Row to="/dashboard/wishlist" icon={Heart} label="Wishlist" />
        <Row to="/dashboard/following" icon={Users} label="Following" />
        <Row to="/rewards" icon={Gift} label="Rewards" />
        <Row to="/dashboard/badges" icon={Award} label="Badges" />
        <Row to="/best-sellers" icon={Trophy} label="Top creators" />
      </Group>
      <Group title="About">
        <Row to="/about" icon={Info} label="About Nothi" />
        <Row to="/contact" icon={Mail} label="Contact & help" />
        <Row to="/terms" icon={FileText} label="Terms" />
        <Row to="/privacy" icon={Shield} label="Privacy" />
      </Group>
      <Group>
        <Row icon={LogOut} label="Sign out" danger onClick={async () => { await logout(); navigate('/', { replace: true }); }} />
      </Group>
      <p className="app-version">{versionLine}</p>
    </div>
  );
}
