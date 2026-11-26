import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Coins, ShieldAlert, Trophy } from 'lucide-react';
import { soundEffects } from '../audio/soundEffects';
import { BOSS_CONFIG, MAX_SKILL_LEVEL } from '../game/constants';
import { EQUIPMENT_SLOT_META } from '../game/data/equipmentCatalog';
import { GameEngine } from '../game/engine/GameEngine';
import { skillRegistry } from '../game/systems/skills/SkillRegistry';
import {
  AutoForgeSettings,
  AutoUpgradeSettings,
  EquipmentPreferences,
  EquipmentSlotType,
  GameHudSnapshot,
  GraphicsQuality,
  SkillId,
  UpgradeId,
  WaveHudEvent,
} from '../game/types';
import { playgamaBridge } from '../platform/playgamaBridge';
import { AutoForgeSettingsModal } from './AutoForgeSettingsModal';
import { AutoUpgradeSettingsModal } from './AutoUpgradeSettingsModal';
import { BattlefieldCanvas } from './BattlefieldCanvas';
import {
  ActionBannerInfo,
  BottomHud,
  renderSkillIcon,
  StatusNoticeInfo,
} from './BottomHud';
import { ActivePanelId, BattlefieldNav } from './components/BattlefieldNav';
import { DefeatOverlay } from './DefeatOverlay';
import { EquipmentFeedbackInfo, EquipmentModal } from './EquipmentModal';
import { ForgeFeedbackInfo, ForgeModal } from './ForgeModal';
import { OfflineRewardModal } from './OfflineRewardModal';
import { PauseModal, PauseModalMode } from './PauseModal';
import { PendingSkillsModal } from './PendingSkillsModal';
import {
  getSkillRarityStyles,
  SkillCollectionFeedbackInfo,
  SkillCollectionModal,
} from './SkillCollectionModal';
import { TankUpgradePanel, UpgradeFeedbackInfo } from './TankUpgradePanel';
import { TitleOverlay } from './TitleOverlay';
import { TopHud } from './TopHud';

type FloatingToastPayload =
  | { type: 'wave'; event: WaveHudEvent }
  | { type: 'action'; banner: ActionBannerInfo }
  | { type: 'notice'; notice: StatusNoticeInfo };

type FloatingToast = FloatingToastPayload & { id: number };

export function GameShell() {
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new GameEngine();
  }
  const engine = engineRef.current;

  const [snapshot, setSnapshot] = useState<GameHudSnapshot>(() =>
    engine.getSnapshot()
  );
  const [pauseModalMode, setPauseModalMode] = useState<PauseModalMode>('pause');
  const [floatingToast, setFloatingToast] = useState<FloatingToast | null>(null);
  const [highlightedSlotIndex, setHighlightedSlotIndex] = useState<number | null>(
    null
  );
  const [upgradedSlotIndex, setUpgradedSlotIndex] = useState<number | null>(
    null
  );
  const [activePanel, setActivePanel] = useState<ActivePanelId>(null);
  const [autoForgeSettingsOpen, setAutoForgeSettingsOpen] =
    useState<boolean>(false);
  const [skillModal, setSkillModal] = useState<
    'pending' | 'auto_upgrade_settings' | null
  >(null);
  const [focusedPendingSkillId, setFocusedPendingSkillId] =
    useState<SkillId | null>(null);
  const [upgradeFeedback, setUpgradeFeedback] =
    useState<UpgradeFeedbackInfo | null>(null);
  const [equipmentFeedback, setEquipmentFeedback] =
    useState<EquipmentFeedbackInfo | null>(null);
  const [forgeFeedback, setForgeFeedback] =
    useState<ForgeFeedbackInfo | null>(null);
  const [collectionFeedback, setCollectionFeedback] =
    useState<SkillCollectionFeedbackInfo | null>(null);
  const [highlightedUpgradeId, setHighlightedUpgradeId] =
    useState<UpgradeId | null>(null);
  const [highlightedCollectionSkillId, setHighlightedCollectionSkillId] =
    useState<SkillId | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const toastCounterRef = useRef<number>(0);
  const highlightTimerRef = useRef<number | null>(null);
  const upgradeSlotTimerRef = useRef<number | null>(null);
  const upgradeFeedbackTimerRef = useRef<number | null>(null);
  const equipmentFeedbackTimerRef = useRef<number | null>(null);
  const forgeFeedbackTimerRef = useRef<number | null>(null);
  const collectionFeedbackTimerRef = useRef<number | null>(null);
  const upgradeHighlightTimerRef = useRef<number | null>(null);
  const collectionHighlightTimerRef = useRef<number | null>(null);
  const lastSeenWaveEventIdRef = useRef<number>(0);
  const lastSeenAutoForgeEventIdRef = useRef<number>(0);
  const activePanelRef = useRef<ActivePanelId>(null);
  const autoForgeSettingsOpenRef = useRef<boolean>(false);
  const skillModalRef = useRef<'pending' | 'auto_upgrade_settings' | null>(null);

  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    autoForgeSettingsOpenRef.current = autoForgeSettingsOpen;
  }, [autoForgeSettingsOpen]);

  useEffect(() => {
    skillModalRef.current = skillModal;
  }, [skillModal]);

  useEffect(() => {
    engine.setForgePanelOpen(
      snapshot.phase === 'ACTIVE' &&
        activePanel === 'forge' &&
        !autoForgeSettingsOpen
    );
  }, [engine, snapshot.phase, activePanel, autoForgeSettingsOpen]);

  const showToast = useCallback(
    (toast: FloatingToastPayload, durationMs = 1850) => {
      toastCounterRef.current += 1;
      const id = toastCounterRef.current;
      setFloatingToast({ ...toast, id });
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setFloatingToast((curr) => (curr && curr.id === id ? null : curr));
      }, durationMs);
    },
    []
  );

  const showNotice = useCallback(
    (text: string, tone: 'info' | 'error' = 'info') => {
      showToast({ type: 'notice', notice: { text, tone } }, 1750);
    },
    [showToast]
  );

  const showBanner = useCallback(
    (banner: ActionBannerInfo) => {
      showToast({ type: 'action', banner }, 1850);
    },
    [showToast]
  );

  const showUpgradeFeedback = useCallback(
    (text: string, tone: 'success' | 'error') => {
      setUpgradeFeedback({ text, tone });
      if (upgradeFeedbackTimerRef.current !== null) {
        window.clearTimeout(upgradeFeedbackTimerRef.current);
      }
      upgradeFeedbackTimerRef.current = window.setTimeout(() => {
        setUpgradeFeedback(null);
      }, 1600);
    },
    []
  );

  const showEquipmentFeedback = useCallback(
    (text: string, tone: 'success' | 'error') => {
      setEquipmentFeedback({ text, tone });
      if (equipmentFeedbackTimerRef.current !== null) {
        window.clearTimeout(equipmentFeedbackTimerRef.current);
      }
      equipmentFeedbackTimerRef.current = window.setTimeout(() => {
        setEquipmentFeedback(null);
      }, 1800);
    },
    []
  );

  const showForgeFeedback = useCallback(
    (text: string, tone: 'success' | 'error') => {
      setForgeFeedback({ text, tone });
      if (forgeFeedbackTimerRef.current !== null) {
        window.clearTimeout(forgeFeedbackTimerRef.current);
      }
      forgeFeedbackTimerRef.current = window.setTimeout(() => {
        setForgeFeedback(null);
      }, 2000);
    },
    []
  );

  const showCollectionFeedback = useCallback(
    (text: string, tone: 'success' | 'error') => {
      setCollectionFeedback({ text, tone });
      if (collectionFeedbackTimerRef.current !== null) {
        window.clearTimeout(collectionFeedbackTimerRef.current);
      }
      collectionFeedbackTimerRef.current = window.setTimeout(() => {
        setCollectionFeedback(null);
      }, 1800);
    },
    []
  );

  const closeActivePanel = useCallback((): boolean => {
    const current = activePanelRef.current;
    if (!current) return true;

    if (current === 'forge') {
      const kept = engine.keepForgedItemInInventory();
      if (kept.reason === 'inventory_full') {
        showNotice(
          'Pending forged item kept safely in Forge (inventory full)',
          'error'
        );
      } else if (kept.success && kept.item) {
        showNotice(`${kept.item.name} added to Equipment Inventory`);
      }
    }

    setAutoForgeSettingsOpen(false);
    setSkillModal(null);
    setActivePanel(null);
    return true;
  }, [engine, showNotice]);

  const openPanel = useCallback(
    (target: Exclude<ActivePanelId, null | 'settings'>) => {
      const current = activePanelRef.current;
      if (current === target && skillModalRef.current === null) return;

      if (current === 'forge') {
        const kept = engine.keepForgedItemInInventory();
        if (target === 'equipment') {
          if (kept.success && kept.item) {
            showEquipmentFeedback(
              `Saved ${kept.item.name} to Equipment Inventory`,
              'success'
            );
          } else if (kept.reason === 'inventory_full') {
            showEquipmentFeedback(
              'Pending forged item waiting in Forge — free 1 slot here to claim it',
              'error'
            );
          }
        } else if (kept.reason === 'inventory_full') {
          showNotice(
            'Pending forged item kept safely in Forge (inventory full)',
            'error'
          );
        }
      }

      setSkillModal(null);
      setAutoForgeSettingsOpen(false);
      setActivePanel(target);
    },
    [engine, showEquipmentFeedback, showNotice]
  );

  const openSkillModal = useCallback(
    (mode: 'pending' | 'auto_upgrade_settings', focusSkillId: SkillId | null = null) => {
      if (activePanelRef.current === 'forge') {
        engine.keepForgedItemInInventory();
      }
      setAutoForgeSettingsOpen(false);
      setActivePanel(null);
      setFocusedPendingSkillId(focusSkillId);
      setSkillModal(mode);
    },
    [engine]
  );

  const togglePanel = useCallback(
    (target: Exclude<ActivePanelId, null | 'settings'>) => {
      const isCurrentlyOpen = activePanelRef.current === target;
      soundEffects.playClick(isCurrentlyOpen ? 400 : 540);
      if (isCurrentlyOpen) {
        closeActivePanel();
        return;
      }
      openPanel(target);
    },
    [closeActivePanel, openPanel]
  );

  useEffect(() => {
    const unsubscribe = engine.subscribe(setSnapshot);
    void engine.initialize();

    const unsubVis = playgamaBridge.onVisibilityChange((isHidden) => {
      if (isHidden) {
        if (engine.getSnapshot().phase === 'ACTIVE') {
          setPauseModalMode('pause');
          engine.setPhase('PAUSED');
        } else {
          void engine.persist();
        }
      }
    });

    const onPageHide = () => {
      void engine.persist();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const currentPhase = engine.getSnapshot().phase;
        if (currentPhase === 'ACTIVE') {
          if (skillModalRef.current) {
            setSkillModal(null);
          } else if (autoForgeSettingsOpenRef.current) {
            setAutoForgeSettingsOpen(false);
          } else if (activePanelRef.current) {
            closeActivePanel();
          } else {
            setPauseModalMode('pause');
            engine.setPhase('PAUSED');
          }
        } else if (currentPhase === 'PAUSED') {
          engine.setPhase('ACTIVE');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      unsubscribe();
      unsubVis();
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      window.removeEventListener('keydown', onKeyDown);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
      if (upgradeSlotTimerRef.current !== null) window.clearTimeout(upgradeSlotTimerRef.current);
      if (upgradeFeedbackTimerRef.current !== null) window.clearTimeout(upgradeFeedbackTimerRef.current);
      if (equipmentFeedbackTimerRef.current !== null) window.clearTimeout(equipmentFeedbackTimerRef.current);
      if (forgeFeedbackTimerRef.current !== null) window.clearTimeout(forgeFeedbackTimerRef.current);
      if (collectionFeedbackTimerRef.current !== null) window.clearTimeout(collectionFeedbackTimerRef.current);
      if (upgradeHighlightTimerRef.current !== null) window.clearTimeout(upgradeHighlightTimerRef.current);
      if (collectionHighlightTimerRef.current !== null) window.clearTimeout(collectionHighlightTimerRef.current);
    };
  }, [closeActivePanel, engine]);

  // Trigger brief wave completion or boss encounter notification when WaveSystem emits one
  useEffect(() => {
    const evt = snapshot.waveEvent;
    if (!evt) {
      lastSeenWaveEventIdRef.current = 0;
      setFloatingToast((curr) => (curr?.type === 'wave' ? null : curr));
      return;
    }
    if (evt.id !== lastSeenWaveEventIdRef.current && snapshot.phase === 'ACTIVE') {
      lastSeenWaveEventIdRef.current = evt.id;
      showToast({ type: 'wave', event: evt }, 2000);
    }
  }, [snapshot.waveEvent, snapshot.phase, showToast]);

  // Trigger brief notifications for background or foreground Auto Forge events
  useEffect(() => {
    const evt = snapshot.forge.autoForge.lastEvent;
    if (!evt) {
      lastSeenAutoForgeEventIdRef.current = 0;
      return;
    }
    if (evt.id !== lastSeenAutoForgeEventIdRef.current && snapshot.phase === 'ACTIVE') {
      lastSeenAutoForgeEventIdRef.current = evt.id;
      const isStopError =
        evt.kind === 'stopped' &&
        evt.stopReason !== null &&
        evt.stopReason !== 'manual';

      if (activePanelRef.current === 'forge' && !autoForgeSettingsOpenRef.current) {
        showForgeFeedback(evt.message, isStopError ? 'error' : 'success');
      } else {
        showNotice(evt.message, isStopError ? 'error' : 'info');
      }
    }
  }, [
    snapshot.forge.autoForge.lastEvent,
    snapshot.phase,
    showForgeFeedback,
    showNotice,
  ]);

  // Close modals and panels when leaving ACTIVE gameplay
  useEffect(() => {
    if (snapshot.phase !== 'ACTIVE') {
      setSkillModal(null);
      setAutoForgeSettingsOpen(false);
      setActivePanel(null);
      setUpgradeFeedback(null);
      setEquipmentFeedback(null);
      setForgeFeedback(null);
      setCollectionFeedback(null);
    }
  }, [snapshot.phase]);

  const triggerHighlight = (slotIndex: number) => {
    setHighlightedSlotIndex(slotIndex);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedSlotIndex(null);
    }, 850);
  };

  const triggerUpgradeHighlight = (slotIndex: number) => {
    setUpgradedSlotIndex(slotIndex);
    if (upgradeSlotTimerRef.current !== null) {
      window.clearTimeout(upgradeSlotTimerRef.current);
    }
    upgradeSlotTimerRef.current = window.setTimeout(() => {
      setUpgradedSlotIndex(null);
    }, 950);
  };

  const handleStartGame = () => {
    soundEffects.playDeploy();
    setFloatingToast(null);
    setHighlightedSlotIndex(null);
    setUpgradedSlotIndex(null);
    setSkillModal(null);
    engine.startFromTitle();
  };

  const handleClaimOfflineRewards = () => {
    const res = engine.claimOfflineRewards();
    if (res.success) {
      soundEffects.playWaveClear();
      showNotice(`Claimed +${res.coinsAwarded.toLocaleString()} Offline Coins`);
    }
  };

  const handleTogglePause = () => {
    const currentPhase = engine.getSnapshot().phase;
    if (currentPhase === 'PAUSED') {
      soundEffects.playClick(560);
      engine.setPhase('ACTIVE');
      return;
    }
    if (currentPhase !== 'ACTIVE') return;
    soundEffects.playClick(420);
    if (activePanel === 'forge') {
      engine.keepForgedItemInInventory();
    }
    setSkillModal(null);
    setAutoForgeSettingsOpen(false);
    setActivePanel(null);
    setPauseModalMode('pause');
    engine.setPhase('PAUSED');
  };

  const handleOpenSettings = () => {
    soundEffects.playClick(420);
    if (activePanel === 'forge') {
      engine.keepForgedItemInInventory();
    }
    setSkillModal(null);
    setAutoForgeSettingsOpen(false);
    setActivePanel(null);
    setPauseModalMode('settings');
    if (engine.getSnapshot().phase !== 'PAUSED') {
      engine.setPhase('PAUSED');
    }
  };

  const handleResume = () => {
    soundEffects.playClick(560);
    engine.setPhase('ACTIVE');
  };

  const handleReturnToTitle = () => {
    soundEffects.playClick(380);
    setFloatingToast(null);
    setHighlightedSlotIndex(null);
    setUpgradedSlotIndex(null);
    setSkillModal(null);
    engine.returnToTitle();
  };

  const handleToggleSound = () => {
    const next = !snapshot.settings.soundEnabled;
    engine.setSoundEnabled(next);
    if (next) {
      soundEffects.playClick(600);
    }
  };

  const handleChangeSoundVolume = (volume: number) => {
    engine.setSoundVolume(volume);
  };

  const handleToggleMusic = () => {
    const next = !snapshot.settings.musicEnabled;
    soundEffects.playClick(next ? 580 : 400);
    engine.setMusicEnabled(next);
  };

  const handleChangeMusicVolume = (volume: number) => {
    engine.setMusicVolume(volume);
  };

  const handleChangeGraphicsQuality = (quality: GraphicsQuality) => {
    soundEffects.playClick(520);
    engine.setGraphicsQuality(quality);
  };

  const handleToggleRangeRing = () => {
    soundEffects.playClick(500);
    engine.toggleRangeRing();
  };

  const handleSummonClick = () => {
    const res = engine.summonSkill();
    if (!res.success || res.skillId === undefined) {
      if (res.reason === 'insufficient_currency') {
        soundEffects.playClick(280);
        showNotice(`Need ${snapshot.summonCost} Coins to summon`, 'error');
      }
      return;
    }

    const def = skillRegistry.getDefinition(res.skillId);
    const skillName = def?.name ?? res.skillId;

    if (res.outcome === 'upgraded' && res.slotIndex !== undefined) {
      const nextLv = res.level ?? 2;
      soundEffects.playSkillUpgrade(nextLv);
      triggerUpgradeHighlight(res.slotIndex);
      showBanner({
        kind: 'upgrade',
        skillId: res.skillId,
        name: skillName,
        rarity: def?.rarity,
        level: nextLv,
        previousLevel: res.previousLevel,
        accentColor: def?.accentColor ?? '#34D399',
        fragmentsAwarded: res.fragmentsAwarded,
      });
      return;
    }

    if (res.outcome === 'pending_choice') {
      soundEffects.playSummon();
      openSkillModal('pending', res.skillId);
      showBanner({
        kind: 'summon',
        skillId: res.skillId,
        name: skillName,
        rarity: def?.rarity,
        level: 1,
        accentColor: def?.accentColor ?? '#38BDF8',
        unlockedNew: res.unlockedNew,
        fragmentsAwarded: res.fragmentsAwarded,
      });
      return;
    }

    if (
      res.outcome === 'overflow_fragments' ||
      res.outcome === 'overflow_coins' ||
      res.outcome === 'stored_pending'
    ) {
      soundEffects.playUpgrade();
      if (res.slotIndex !== undefined) {
        triggerHighlight(res.slotIndex);
      }
      showBanner({
        kind: 'overflow',
        skillId: res.skillId,
        name: skillName,
        rarity: def?.rarity,
        level: res.level ?? MAX_SKILL_LEVEL,
        accentColor: def?.accentColor ?? '#F59E0B',
        overflowFragments: res.overflowFragments,
        overflowCoins: res.overflowCoins,
        fragmentsAwarded: res.fragmentsAwarded,
      });
      return;
    }

    // Default: equipped into vacant slot
    soundEffects.playSummon();
    if (res.slotIndex !== undefined) {
      if (res.autoUpgrades && res.autoUpgrades.length > 0) {
        const lastAuto = res.autoUpgrades[res.autoUpgrades.length - 1];
        soundEffects.playSkillUpgrade(lastAuto.newLevel);
        triggerUpgradeHighlight(res.slotIndex);
      } else {
        triggerHighlight(res.slotIndex);
      }
    }
    showBanner({
      kind: 'summon',
      skillId: res.skillId,
      name: skillName,
      rarity: def?.rarity,
      level: res.level ?? 1,
      accentColor: def?.accentColor ?? '#F59E0B',
      unlockedNew: res.unlockedNew,
      fragmentsAwarded: res.fragmentsAwarded,
    });
  };

  const handleSkillSlotClick = (slotIndex: number) => {
    if (snapshot.phase !== 'ACTIVE') return;

    const tappedSlot = snapshot.skillSlots[slotIndex];
    if (!tappedSlot) return;

    if (!tappedSlot.skillId) {
      soundEffects.playClick(420);
      if (snapshot.pendingSkillCount > 0) {
        openSkillModal('pending', snapshot.pendingSkills[0]?.skillId ?? null);
      } else {
        showNotice(`Slot ${slotIndex + 1} is vacant · Tap Summon to fill`);
      }
      return;
    }

    const def = skillRegistry.getDefinition(tappedSlot.skillId);
    const skillName = def?.name ?? tappedSlot.skillId;
    const pendingForSlot = snapshot.pendingSkills.find(
      (p) => p.skillId === tappedSlot.skillId
    );

    soundEffects.playClick(520);
    if (pendingForSlot && pendingForSlot.copies > 0) {
      openSkillModal('pending', tappedSlot.skillId);
      return;
    }

    showNotice(
      tappedSlot.level >= MAX_SKILL_LEVEL
        ? `${skillName} · Max Lv.${MAX_SKILL_LEVEL}`
        : `${skillName} · Lv.${tappedSlot.level} / ${MAX_SKILL_LEVEL} (duplicates upgrade automatically)`
    );
  };

  const handleEquipPendingToSlot = (slotIndex: number, skillId: SkillId) => {
    const res = engine.equipPendingSkillToSlot(slotIndex, skillId);
    if (!res.success) {
      soundEffects.playInvalid();
      return;
    }
    const def = skillRegistry.getDefinition(skillId);
    const skillName = def?.name ?? skillId;
    if (res.autoUpgrades && res.autoUpgrades.length > 0) {
      const last = res.autoUpgrades[res.autoUpgrades.length - 1];
      soundEffects.playSkillUpgrade(last.newLevel);
      triggerUpgradeHighlight(slotIndex);
      showBanner({
        kind: 'upgrade',
        skillId,
        name: skillName,
        previousLevel: 1,
        level: last.newLevel,
        accentColor: def?.accentColor ?? '#34D399',
      });
    } else {
      soundEffects.playEquip();
      triggerHighlight(slotIndex);
      showNotice(`Equipped ${skillName} Lv.1 into Slot ${slotIndex + 1}`);
    }
    setSkillModal(null);
  };

  const handleApplyPendingUpgrade = (skillId: SkillId) => {
    const res = engine.applyPendingSkillUpgrade(skillId);
    if (
      res.success &&
      res.slotIndex !== undefined &&
      res.newLevel !== undefined
    ) {
      const def = skillRegistry.getDefinition(skillId);
      soundEffects.playSkillUpgrade(res.newLevel);
      triggerUpgradeHighlight(res.slotIndex);
      showBanner({
        kind: 'upgrade',
        skillId,
        name: def?.name ?? skillId,
        previousLevel: res.previousLevel,
        level: res.newLevel,
        accentColor: def?.accentColor ?? '#34D399',
      });
      return;
    }
    soundEffects.playInvalid();
  };

  const handleConvertPendingOverflow = (skillId: SkillId) => {
    const res = engine.convertPendingOverflow(skillId);
    if (res.convertedCopies > 0) {
      soundEffects.playUpgrade();
      showNotice(`Converted into +${res.fragmentsAwarded} Skill Fragments`);
    }
  };

  const handleDiscardPendingSkill = (skillId: SkillId) => {
    const removed = engine.discardPendingSkill(skillId);
    if (removed > 0) {
      soundEffects.playClick(380);
      showNotice('Removed pending skill from queue');
    }
  };

  const handleToggleAutoUpgrade = () => {
    const res = engine.toggleAutoUpgrade();
    if (res.enabled) {
      soundEffects.playUpgrade();
      if (res.upgrades.length > 0) {
        const last = res.upgrades[res.upgrades.length - 1];
        triggerUpgradeHighlight(last.slotIndex);
        soundEffects.playSkillUpgrade(last.newLevel);
        showNotice(
          `Auto Upgrade ON · Upgraded ${res.upgrades.length} ${
            res.upgrades.length === 1 ? 'skill' : 'skills'
          }`
        );
      } else {
        showNotice('Auto Upgrade enabled');
      }
    } else {
      soundEffects.playClick(420);
      showNotice('Auto Upgrade paused (direct summon duplicates still upgrade)');
    }
  };

  const handleSaveAutoUpgradeSettings = (next: AutoUpgradeSettings) => {
    const res = engine.updateAutoUpgradeSettings(next);
    soundEffects.playUpgrade();
    if (res.upgrades.length > 0) {
      const last = res.upgrades[res.upgrades.length - 1];
      triggerUpgradeHighlight(last.slotIndex);
      soundEffects.playSkillUpgrade(last.newLevel);
    }
    showNotice('Auto Upgrade settings saved');
  };

  const handleResetAutoUpgradeSettings = () => {
    soundEffects.playClick(440);
    return engine.resetAutoUpgradeSettings();
  };

  const handleStartForge = () => {
    const res = engine.startForge();
    if (res.success) {
      soundEffects.playForgeStart();
      setForgeFeedback(null);
      return;
    }

    soundEffects.playInvalid();
    if (res.reason === 'auto_forge_active') {
      showForgeFeedback(
        'Turn off Auto Forge before starting a manual forge',
        'error'
      );
    } else if (res.reason === 'inventory_full') {
      showForgeFeedback(
        'Equipment inventory is full — dismantle unused gear first',
        'error'
      );
    } else if (res.reason === 'insufficient_currency') {
      showForgeFeedback(
        `Need ${res.costCoins ?? snapshot.forge.costCoins} Coins to forge`,
        'error'
      );
    } else if (res.reason === 'result_pending') {
      showForgeFeedback('Resolve your newly forged item first', 'error');
    }
  };

  const handleToggleAutoForge = () => {
    const res = engine.toggleAutoForge();
    if (res.enabled) {
      soundEffects.playForgeStart();
      if (!res.outcome?.processedItem) {
        showForgeFeedback('Auto Forge enabled', 'success');
      }
    } else if (res.outcome?.stoppedReason && res.outcome.stoppedReason !== 'manual') {
      soundEffects.playInvalid();
    } else {
      soundEffects.playClick(420);
    }
  };

  const handleSaveAutoForgeSettings = (next: AutoForgeSettings) => {
    soundEffects.playUpgrade();
    engine.updateAutoForgeSettings(next);
    showForgeFeedback('Auto Forge settings saved', 'success');
  };

  const handleResetAutoForgeSettings = () => {
    soundEffects.playClick(440);
    return engine.resetAutoForgeSettings();
  };

  const handleEquipForged = () => {
    const res = engine.equipForgedItem();
    if (res.success && res.equipResult?.item) {
      soundEffects.playEquip();
      const item = res.equipResult.item;
      showForgeFeedback(
        res.equipResult.replacedItem
          ? `Equipped ${item.name} (replaced ${res.equipResult.replacedItem.name})`
          : `Equipped ${item.name}!`,
        'success'
      );
      return;
    }
    soundEffects.playInvalid();
    if (res.reason === 'inventory_full') {
      showForgeFeedback(
        'Inventory full — cannot return replaced gear to bag. Free 1 slot or Dismantle.',
        'error'
      );
    }
  };

  const handleKeepForged = () => {
    const res = engine.keepForgedItemInInventory();
    if (res.success && res.item) {
      soundEffects.playClick(560);
      showForgeFeedback(
        `Saved ${res.item.name} to Equipment Inventory`,
        'success'
      );
      return;
    }
    soundEffects.playInvalid();
    if (res.reason === 'inventory_full') {
      showForgeFeedback(
        'Inventory full — dismantle unused gear or this item first',
        'error'
      );
    }
  };

  const handleDismantleForged = () => {
    const res = engine.dismantleForgedItem();
    if (res.success && res.dismantledItem && res.coinsAwarded !== undefined) {
      soundEffects.playDismantle();
      showForgeFeedback(
        `Dismantled ${res.dismantledItem.name} for +${res.coinsAwarded} Coins`,
        'success'
      );
      return;
    }
    soundEffects.playInvalid();
  };

  const handleEquipItem = (uid: string, expectedSlot?: EquipmentSlotType) => {
    const res = engine.equipItem(uid, expectedSlot);
    if (res.success && res.item) {
      soundEffects.playEquip();
      const slotLabel =
        EQUIPMENT_SLOT_META.find((m) => m.slot === res.item!.slot)?.label ??
        res.item.slot;
      showEquipmentFeedback(
        res.replacedItem
          ? `Equipped ${res.item.name} (replaced ${res.replacedItem.name})`
          : `Equipped ${res.item.name} to ${slotLabel}`,
        'success'
      );
      return;
    }

    soundEffects.playInvalid();
    if (res.reason === 'slot_mismatch') {
      showEquipmentFeedback('Cannot equip item into a mismatched slot', 'error');
    }
  };

  const handleUnequipSlot = (slot: EquipmentSlotType) => {
    const res = engine.unequipEquipmentSlot(slot);
    if (res.success && res.item) {
      soundEffects.playUnequip();
      showEquipmentFeedback(`Unequipped ${res.item.name}`, 'success');
      return;
    }
    soundEffects.playInvalid();
    if (res.reason === 'inventory_full') {
      showEquipmentFeedback(
        'Inventory is full — dismantle unused gear before unequipping',
        'error'
      );
    }
  };

  const handleToggleEquipmentLock = (uid: string) => {
    const res = engine.toggleEquipmentLock(uid);
    if (res.success && res.item) {
      soundEffects.playClick(res.item.locked ? 620 : 440);
      showEquipmentFeedback(
        res.item.locked
          ? `Locked ${res.item.name}`
          : `Unlocked ${res.item.name}`,
        'success'
      );
    }
  };

  const handleChangeEquipmentPreferences = (
    partial: Partial<EquipmentPreferences>
  ) => {
    soundEffects.playClick(480);
    engine.setEquipmentPreferences(partial);
  };

  const handleDismantleEquipmentItem = (uid: string) => {
    const res = engine.dismantleEquipmentItem(uid);
    if (res.success && res.dismantledItem && res.coinsAwarded !== undefined) {
      soundEffects.playDismantle();
      showEquipmentFeedback(
        `Dismantled ${res.dismantledItem.name} for +${res.coinsAwarded} Coins`,
        'success'
      );
      return;
    }
    soundEffects.playInvalid();
    if (res.reason === 'locked') {
      showEquipmentFeedback('Locked items cannot be dismantled', 'error');
    } else if (res.reason === 'equipped') {
      showEquipmentFeedback('Equipped items cannot be dismantled', 'error');
    }
  };

  const handleBulkDismantleEquipment = (uids: string[]) => {
    const res = engine.bulkDismantleEquipment(uids);
    if (res.success) {
      soundEffects.playDismantle();
      showEquipmentFeedback(
        `Dismantled ${res.dismantledCount} ${
          res.dismantledCount === 1 ? 'item' : 'items'
        } for +${res.coinsAwarded} Coins`,
        'success'
      );
      return;
    }
    soundEffects.playInvalid();
    showEquipmentFeedback(
      'No unlocked, unequipped items selected for dismantling',
      'error'
    );
  };

  const handlePurchaseUpgrade = (upgradeId: UpgradeId) => {
    const res = engine.purchaseTankUpgrade(upgradeId);
    if (res.reason === 'cooldown_locked') return;

    if (res.success && res.entry) {
      soundEffects.playUpgrade();
      setHighlightedUpgradeId(upgradeId);
      if (upgradeHighlightTimerRef.current !== null) {
        window.clearTimeout(upgradeHighlightTimerRef.current);
      }
      upgradeHighlightTimerRef.current = window.setTimeout(() => {
        setHighlightedUpgradeId(null);
      }, 650);
      showUpgradeFeedback(
        `${res.entry.label} upgraded to Lv.${res.entry.level}`,
        'success'
      );
      return;
    }

    soundEffects.playInvalid();
    if (res.reason === 'insufficient_currency' && res.entry) {
      showUpgradeFeedback(
        `Need ${res.entry.nextCost} Coins for ${res.entry.label}`,
        'error'
      );
    } else if (res.reason === 'max_level' && res.entry) {
      showUpgradeFeedback(`${res.entry.label} is already maxed`, 'error');
    }
  };

  const handleUpgradeSkillCollection = (skillId: SkillId) => {
    const res = engine.upgradeSkillCollection(skillId);
    if (res.reason === 'cooldown_locked') return;

    const def = skillRegistry.getDefinition(skillId);
    const skillName = def?.name ?? skillId;

    if (res.success && res.newLevel !== undefined) {
      soundEffects.playUpgrade();
      setHighlightedCollectionSkillId(skillId);
      if (collectionHighlightTimerRef.current !== null) {
        window.clearTimeout(collectionHighlightTimerRef.current);
      }
      collectionHighlightTimerRef.current = window.setTimeout(() => {
        setHighlightedCollectionSkillId(null);
      }, 650);
      showCollectionFeedback(
        `${skillName} upgraded to Collection Lv.${res.newLevel}!`,
        'success'
      );
      return;
    }

    soundEffects.playInvalid();
    if (res.reason === 'not_unlocked') {
      showCollectionFeedback(
        `Summon ${skillName} first to unlock permanent upgrades`,
        'error'
      );
    } else if (res.reason === 'insufficient_fragments' && res.entry?.nextUpgradeCost) {
      showCollectionFeedback(
        `Need ${res.entry.nextUpgradeCost} ${def?.shortLabel ?? skillName} Fragments`,
        'error'
      );
    } else if (res.reason === 'max_level') {
      showCollectionFeedback(`${skillName} is already at max collection level`, 'error');
    }
  };

  const hasAffordableUpgrade = snapshot.upgrades.some(
    (entry) => !entry.isMaxed && snapshot.currencies.gold >= entry.nextCost
  );
  const hasAffordableCollectionUpgrade = snapshot.skillCollection.some(
    (entry) => entry.canUpgrade
  );
  const totalSkillFragments = snapshot.skillCollection.reduce(
    (sum, entry) => sum + entry.fragments,
    0
  );
  const equippedCount = EQUIPMENT_SLOT_META.filter(
    (meta) => snapshot.equipmentSlots[meta.slot] !== null
  ).length;

  return (
    <div
      data-graphics={snapshot.settings.graphicsQuality}
      className="relative flex flex-col w-screen h-dvh bg-[#12161B] text-[#F1F5F9] overflow-hidden"
    >
      <TopHud
        phase={snapshot.phase}
        wave={snapshot.wave}
        boss={snapshot.boss}
        currencies={snapshot.currencies}
        totalSkillFragments={totalSkillFragments}
        activeBoost={snapshot.monetization.activeBoost}
        onOpenCollection={() => togglePanel('collection')}
        onTogglePause={handleTogglePause}
        onOpenSettings={handleOpenSettings}
      />

      <main className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        <BattlefieldCanvas
          engine={engine}
          tank={snapshot.tank}
          phase={snapshot.phase}
          activePanel={activePanel}
          forgeStatus={snapshot.forge.status}
          autoForgeEnabled={snapshot.forge.autoForge.enabled}
          equippedCount={equippedCount}
          unlockedSkillCount={snapshot.unlockedSkillCount}
          hasAffordableUpgrade={hasAffordableUpgrade}
          hasAffordableCollectionUpgrade={hasAffordableCollectionUpgrade}
          onToggleUpgrades={() => togglePanel('upgrades')}
          onToggleEquipment={() => togglePanel('equipment')}
          onToggleForge={() => togglePanel('forge')}
          onToggleCollection={() => togglePanel('collection')}
        />

        {/* Single Unified, Non-Stacking Floating Battlefield Notification (Top-Center) */}
        {floatingToast && snapshot.phase === 'ACTIVE' && (
          <div
            key={floatingToast.id}
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute top-11 sm:top-2 landscape:top-2 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100%-16px)] animate-toast-in"
          >
            {floatingToast.type === 'wave' && (
              <div
                className={`flex items-center gap-2 bg-[#12171E]/95 border rounded-lg px-3 py-1 shadow-xl whitespace-nowrap ${
                  floatingToast.event.kind === 'boss_spawn'
                    ? 'border-rose-500/80 text-rose-100'
                    : 'border-emerald-400/80 text-emerald-100'
                }`}
              >
                {floatingToast.event.kind === 'boss_spawn' ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-400/55 text-[10px] font-extrabold text-rose-200 uppercase tracking-wider shrink-0">
                      Boss Incoming
                    </span>
                    <span className="text-xs font-bold text-white truncate">
                      {floatingToast.event.bossName ?? BOSS_CONFIG.name} · Wave{' '}
                      {floatingToast.event.wave}
                    </span>
                  </>
                ) : (
                  <>
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-white truncate">
                      {floatingToast.event.isBossWave
                        ? `Boss Defeated · Wave ${floatingToast.event.wave}`
                        : `Wave ${floatingToast.event.wave} Cleared`}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-mono-tabular text-xs font-bold text-amber-300 shrink-0">
                      <Coins className="w-3 h-3 shrink-0" />+
                      {floatingToast.event.rewardGold}
                    </span>
                  </>
                )}
              </div>
            )}

            {floatingToast.type === 'action' && (
              <div
                className="flex items-center gap-2 bg-[#12171E]/95 border rounded-lg px-3 py-1 shadow-xl whitespace-nowrap"
                style={{
                  borderColor:
                    floatingToast.banner.kind === 'upgrade'
                      ? '#34D399'
                      : floatingToast.banner.accentColor,
                }}
              >
                {renderSkillIcon(
                  floatingToast.banner.skillId,
                  floatingToast.banner.accentColor,
                  'w-3.5 h-3.5 shrink-0'
                )}
                <span className="text-xs font-bold text-white truncate">
                  {floatingToast.banner.kind === 'upgrade'
                    ? `Upgraded ${floatingToast.banner.name}`
                    : floatingToast.banner.kind === 'overflow'
                      ? `${floatingToast.banner.name} Max`
                      : `Summoned ${floatingToast.banner.name}`}
                </span>
                {floatingToast.banner.rarity && (
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[9px] font-bold leading-none shrink-0 ${
                      getSkillRarityStyles(floatingToast.banner.rarity).badgeClass
                    }`}
                  >
                    {getSkillRarityStyles(floatingToast.banner.rarity).label}
                  </span>
                )}
                <span className="font-mono-tabular text-[11px] font-bold text-amber-300 shrink-0">
                  {floatingToast.banner.kind === 'upgrade' &&
                  floatingToast.banner.previousLevel !== undefined
                    ? `Lv.${floatingToast.banner.previousLevel} → Lv.${floatingToast.banner.level}`
                    : `Lv.${floatingToast.banner.level}`}
                </span>
                {floatingToast.banner.unlockedNew && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-[10px] font-bold text-emerald-300 leading-none">
                    New
                  </span>
                )}
                {floatingToast.banner.overflowFragments !== undefined &&
                  floatingToast.banner.overflowFragments > 0 && (
                    <span className="font-mono-tabular text-[11px] font-bold text-sky-300 shrink-0">
                      +{floatingToast.banner.overflowFragments} Overflow Frags
                    </span>
                  )}
                {floatingToast.banner.overflowCoins !== undefined &&
                  floatingToast.banner.overflowCoins > 0 && (
                    <span className="font-mono-tabular text-[11px] font-bold text-amber-300 shrink-0">
                      +{floatingToast.banner.overflowCoins} Refund
                    </span>
                  )}
                {floatingToast.banner.fragmentsAwarded !== undefined &&
                  floatingToast.banner.fragmentsAwarded > 0 && (
                    <span className="font-mono-tabular text-[11px] font-bold text-sky-300 shrink-0">
                      +{floatingToast.banner.fragmentsAwarded} Frags
                    </span>
                  )}
              </div>
            )}

            {floatingToast.type === 'notice' && (
              <div
                className={`bg-[#12171E]/95 border text-xs font-medium px-3 py-1 rounded-lg shadow-lg whitespace-nowrap truncate ${
                  floatingToast.notice.tone === 'error'
                    ? 'border-rose-500/75 text-rose-200'
                    : 'border-amber-500/55 text-amber-100'
                }`}
              >
                {floatingToast.notice.text}
              </div>
            )}
          </div>
        )}

        {/* Unified Single-Panel Management (Never stacks) */}
        {snapshot.phase === 'ACTIVE' && activePanel === 'upgrades' && (
          <TankUpgradePanel
            upgrades={snapshot.upgrades}
            goldBalance={snapshot.currencies.gold}
            feedback={upgradeFeedback}
            highlightedUpgradeId={highlightedUpgradeId}
            onPurchaseUpgrade={handlePurchaseUpgrade}
            onClose={() => {
              soundEffects.playClick(400);
              closeActivePanel();
            }}
          />
        )}

        {snapshot.phase === 'ACTIVE' && activePanel === 'equipment' && (
          <EquipmentModal
            equipmentSlots={snapshot.equipmentSlots}
            ownedItems={snapshot.equipmentInventory}
            equipmentBonuses={snapshot.equipmentBonuses}
            tankStats={snapshot.tank.stats}
            inventoryCapacity={snapshot.equipmentCapacity}
            unequippedCount={snapshot.equipmentUnequippedCount}
            preferences={snapshot.equipmentPreferences}
            feedback={equipmentFeedback}
            onEquipItem={handleEquipItem}
            onUnequipSlot={handleUnequipSlot}
            onToggleLock={handleToggleEquipmentLock}
            onChangePreferences={handleChangeEquipmentPreferences}
            onDismantleItem={handleDismantleEquipmentItem}
            onBulkDismantle={handleBulkDismantleEquipment}
            onPreviewTankStats={(item) => engine.previewEquipTankStats(item)}
            onOpenForge={() => {
              soundEffects.playClick(540);
              openPanel('forge');
            }}
            onClose={() => {
              soundEffects.playClick(400);
              closeActivePanel();
            }}
          />
        )}

        {snapshot.phase === 'ACTIVE' &&
          activePanel === 'forge' &&
          !autoForgeSettingsOpen && (
            <ForgeModal
              forge={snapshot.forge}
              goldBalance={snapshot.currencies.gold}
              equipmentSlots={snapshot.equipmentSlots}
              inventoryCapacity={snapshot.equipmentCapacity}
              unequippedCount={snapshot.equipmentUnequippedCount}
              feedback={forgeFeedback}
              onStartForge={handleStartForge}
              onToggleAutoForge={handleToggleAutoForge}
              onOpenAutoForgeSettings={() => {
                soundEffects.playClick(520);
                setAutoForgeSettingsOpen(true);
              }}
              onEquipForged={handleEquipForged}
              onKeepForged={handleKeepForged}
              onDismantleForged={handleDismantleForged}
              onOpenEquipment={() => {
                soundEffects.playClick(540);
                openPanel('equipment');
              }}
              onClose={() => {
                soundEffects.playClick(400);
                closeActivePanel();
              }}
            />
          )}

        {snapshot.phase === 'ACTIVE' &&
          activePanel === 'forge' &&
          autoForgeSettingsOpen && (
            <AutoForgeSettingsModal
              settings={snapshot.forge.autoForge.settings}
              onSaveSettings={handleSaveAutoForgeSettings}
              onResetSettings={handleResetAutoForgeSettings}
              onClose={() => {
                soundEffects.playClick(420);
                setAutoForgeSettingsOpen(false);
              }}
            />
          )}

        {snapshot.phase === 'ACTIVE' && activePanel === 'collection' && (
          <SkillCollectionModal
            entries={snapshot.skillCollection}
            unlockedCount={snapshot.unlockedSkillCount}
            totalFragments={totalSkillFragments}
            feedback={collectionFeedback}
            highlightedSkillId={highlightedCollectionSkillId}
            getBonusPreviewRows={(skillId) =>
              engine.skillCollection.getBonusPreviewRows(skillId)
            }
            getComputedBonuses={(skillId) =>
              engine.skillCollection.getComputedBonuses(skillId)
            }
            onUpgradeSkill={handleUpgradeSkillCollection}
            onClose={() => {
              soundEffects.playClick(400);
              closeActivePanel();
            }}
          />
        )}

        {snapshot.phase === 'ACTIVE' && skillModal === 'pending' && (
          <PendingSkillsModal
            skillSlots={snapshot.skillSlots}
            pendingSkills={snapshot.pendingSkills}
            focusedSkillId={focusedPendingSkillId}
            autoUpgradeEnabled={snapshot.autoUpgrade.enabled}
            onEquipToSlot={handleEquipPendingToSlot}
            onApplyUpgrade={handleApplyPendingUpgrade}
            onConvertOverflow={handleConvertPendingOverflow}
            onDiscardPending={handleDiscardPendingSkill}
            onClose={() => {
              soundEffects.playClick(400);
              setSkillModal(null);
            }}
          />
        )}

        {snapshot.phase === 'ACTIVE' &&
          skillModal === 'auto_upgrade_settings' && (
            <AutoUpgradeSettingsModal
              enabled={snapshot.autoUpgrade.enabled}
              totalAutoUpgrades={snapshot.autoUpgrade.totalAutoUpgrades}
              settings={snapshot.autoUpgrade.settings}
              onToggleEnabled={handleToggleAutoUpgrade}
              onSaveSettings={handleSaveAutoUpgradeSettings}
              onResetSettings={handleResetAutoUpgradeSettings}
              onClose={() => {
                soundEffects.playClick(400);
                setSkillModal(null);
              }}
            />
          )}

        {snapshot.phase === 'TITLE' && (
          <TitleOverlay
            highestWave={snapshot.wave.highestWave}
            onStart={handleStartGame}
          />
        )}

        {snapshot.offlineReward && !snapshot.offlineReward.claimed && (
          <OfflineRewardModal
            reward={snapshot.offlineReward}
            offlineBonusPreview={snapshot.monetization.offlineBonusPreview}
            onClaim={handleClaimOfflineRewards}
          />
        )}

        {snapshot.saveNotice && (
          <div
            role="alert"
            className={`absolute top-2 left-1/2 -translate-x-1/2 z-50 w-[min(calc(100%-16px),28rem)] rounded-lg border px-3 py-2 shadow-2xl flex flex-col gap-1.5 ${
              snapshot.saveNotice.kind === 'corrupt_unrecoverable'
                ? 'bg-rose-950/95 border-rose-500/70 text-rose-100'
                : 'bg-[#18202A]/95 border-amber-500/60 text-amber-100'
            }`}
          >
            <div className="flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span className="leading-snug">{snapshot.saveNotice.message}</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              {snapshot.saveNotice.kind === 'corrupt_unrecoverable' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playClick(460);
                      void engine.retrySaveRecovery();
                    }}
                    className="px-2.5 py-1 rounded bg-[#202934] hover:bg-[#2B3746] border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap cursor-pointer"
                  >
                    Retry Recovery
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playClick(400);
                      engine.dismissSaveNotice({ overwriteCorruptWithFresh: true });
                    }}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-[11px] font-bold text-slate-950 whitespace-nowrap cursor-pointer"
                  >
                    Start Fresh Save
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playClick(460);
                    engine.dismissSaveNotice();
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-[11px] font-bold text-slate-950 whitespace-nowrap cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        {snapshot.phase === 'PAUSED' && (
          <PauseModal
            mode={pauseModalMode}
            waveNumber={snapshot.wave.currentWave}
            summonCost={snapshot.summonCost}
            forgeStatus={snapshot.forge.status}
            autoForgeEnabled={snapshot.forge.autoForge.enabled}
            settings={snapshot.settings}
            monetization={snapshot.monetization}
            onChangeMode={(nextMode) => {
              soundEffects.playClick(500);
              setPauseModalMode(nextMode);
            }}
            onResume={handleResume}
            onToggleSound={handleToggleSound}
            onChangeSoundVolume={handleChangeSoundVolume}
            onToggleMusic={handleToggleMusic}
            onChangeMusicVolume={handleChangeMusicVolume}
            onChangeGraphicsQuality={handleChangeGraphicsQuality}
            onToggleRangeRing={handleToggleRangeRing}
            onReturnToTitle={handleReturnToTitle}
          />
        )}

        {snapshot.phase === 'DEFEAT' && (
          <DefeatOverlay
            wave={snapshot.wave.currentWave}
            recovery={snapshot.recovery}
          />
        )}
      </main>

      {/* Dedicated Portrait Nav Strip (< sm portrait) so Joystick never collides with Nav */}
      {snapshot.phase === 'ACTIVE' && (
        <div className="block sm:hidden landscape:hidden">
          <BattlefieldNav
            layout="bar"
            activePanel={activePanel}
            forgeStatus={snapshot.forge.status}
            autoForgeEnabled={snapshot.forge.autoForge.enabled}
            equippedCount={equippedCount}
            unlockedSkillCount={snapshot.unlockedSkillCount}
            hasAffordableUpgrade={hasAffordableUpgrade}
            hasAffordableCollectionUpgrade={hasAffordableCollectionUpgrade}
            onToggleCollection={() => togglePanel('collection')}
            onToggleForge={() => togglePanel('forge')}
            onToggleEquipment={() => togglePanel('equipment')}
            onToggleUpgrades={() => togglePanel('upgrades')}
          />
        </div>
      )}

      <BottomHud
        phase={snapshot.phase}
        skillSlots={snapshot.skillSlots}
        goldBalance={snapshot.currencies.gold}
        summonCost={snapshot.summonCost}
        pendingSkillCount={snapshot.pendingSkillCount}
        autoUpgradeEnabled={snapshot.autoUpgrade.enabled}
        highlightedSlotIndex={highlightedSlotIndex}
        upgradedSlotIndex={upgradedSlotIndex}
        onSummonClick={handleSummonClick}
        onSkillSlotClick={handleSkillSlotClick}
        onOpenPendingSkills={() => {
          soundEffects.playClick(520);
          if (skillModal === 'pending') {
            setSkillModal(null);
          } else {
            openSkillModal('pending', snapshot.pendingSkills[0]?.skillId ?? null);
          }
        }}
        onToggleAutoUpgrade={handleToggleAutoUpgrade}
        onOpenAutoUpgradeSettings={() => {
          soundEffects.playClick(520);
          if (skillModal === 'auto_upgrade_settings') {
            setSkillModal(null);
          } else {
            openSkillModal('auto_upgrade_settings');
          }
        }}
      />
    </div>
  );
}
