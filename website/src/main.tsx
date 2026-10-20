import '@fontsource-variable/figtree';
import '@fontsource-variable/figtree/wght-italic.css';
import './site.css';
import { MotionConfig } from 'motion/react';
import { StrictMode, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { usePath } from './lib/router';
import { AccountLayout } from './pages/account/AccountLayout';
import { Overview } from './pages/account/Overview';
import { Profile } from './pages/account/Profile';
import { Settings } from './pages/account/Settings';
import { Subscription } from './pages/account/Subscription';
import { Team } from './pages/account/Team';
import { Download } from './pages/Download';
import { Home } from './pages/Home';
import { Login, Signup } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Pricing } from './pages/Pricing';

const PAGES: Record<string, { title: string; page: () => ReactNode }> = {
  '/': { title: 'XavierOS – AI-rådgiveren til Microsoft Advertising', page: () => <Home /> },
  '/priser': { title: 'Priser – XavierOS', page: () => <Pricing /> },
  '/download': { title: 'Hent XavierOS til Windows', page: () => <Download /> },
  '/login': { title: 'Log ind – XavierOS', page: () => <Login /> },
  '/opret': { title: 'Opret virksomhed – XavierOS', page: () => <Signup /> },
};

const ACCOUNT: Record<string, { title: string; page: () => ReactNode }> = {
  '/konto': { title: 'Min konto', page: () => <Overview /> },
  '/konto/profil': { title: 'Profil', page: () => <Profile /> },
  '/konto/abonnement': { title: 'Abonnement', page: () => <Subscription /> },
  '/konto/team': { title: 'Team', page: () => <Team /> },
  '/konto/indstillinger': { title: 'Indstillinger', page: () => <Settings /> },
};

function Site() {
  const path = usePath();
  const account = ACCOUNT[path];
  const route = PAGES[path];
  useEffect(() => {
    document.title = account ? `${account.title} – XavierOS` : (route?.title ?? 'Ikke fundet – XavierOS');
  }, [account, route]);

  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <div className="min-h-[70vh]">{account ? <AccountLayout>{account.page()}</AccountLayout> : route ? route.page() : <NotFound />}</div>
      <Footer />
    </MotionConfig>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Site />
  </StrictMode>,
);
