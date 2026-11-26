import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (import.meta.env.DEV) {
  void Promise.all([
    import('./game/balanceConfig'),
    import('./game/balanceInspector'),
  ]).then(([{ GAME_BALANCE }, { generateBalanceReport }]) => {
    (
      window as unknown as Record<string, unknown>
    ).__IDLE_TANK_BALANCE__ = {
      config: GAME_BALANCE,
      getReport: generateBalanceReport,
    };
  });
}

createRoot(document.getElementById('root')!).render(<App />);
