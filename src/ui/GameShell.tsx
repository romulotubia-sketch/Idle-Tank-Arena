import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Coins, ShieldAlert, Trophy } from 'lucide-react';
import { soundEffects } from '../audio/soundEffects';
import { BOSS_CONFIG, MAX_SKILL_LEVEL } from '../game/constants';
import { EQUIPMENT_SLOT_META } from '../game/data/equipmentCatalog';
import { GameEngine } from '../game/engine/GameEngine';
import { skillRegistry } from '../game/systems/skills/SkillRegistry';
import {
  AutoForgeSettings,
  EquipmentPreferences,
  EquipmentSlotType,
  GameHudSnapshot,
  SkillId,
  UpgradeId,
  WaveHudEvent,
} from '../game/types';
import { playgamaBridge } from '../platform/playgamaBridge';
import { AutoForgeSettingsModal } from './AutoForgeSettingsModal';
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
import { PauseModal } from './PauseModal';
import {
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
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    engine.isSoundEnabled()
  );
  const [floatingToast, setFloatingToast] = useState<FloatingToast | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [highlightedSlotIndex, setHighlightedSlotIndex] = useState<number | null>(
    null
  );
  const [invalidSlotIndex, setInvalidSlotIndex] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanelId>(null);
  const [autoForgeSettingsOpen, setAutoForgeSettingsOpen] =
    useState<boolean>(false);
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
  const invalidTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    autoForgeSettingsOpenRef.current = autoForgeSettingsOpen;
  }, [autoForgeSettingsOpen]);

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

  const closeActivePanel = useCallback(
    (options?: { blockOnFullForge?: boolean }): boolean => {
      const current = activePanelRef.current;
      if (!current) return true;

      if (current === 'forge') {
        const kept = engine.keepForgedItemInInventory();
        if (kept.reason === 'inventory_full') {
          if (options?.blockOnFullForge) {
            soundEffects.playInvalid();
            showForgeFeedback(
              'Inventory is full! Dismantle this item or open Equipment to free 1 slot.',
              'error'
            );
            return false;
          }
          showNotice(
            'Pending forged item kept safely in Forge (inventory full)',
            'error'
          );
        } else if (kept.success && kept.item) {
          showNotice(`${kept.item.name} added to Equipment Inventory`);
        }
      }

      setAutoForgeSettingsOpen(false);
      setActivePanel(null);
      return true;
    },
    [engine, showForgeFeedback, showNotice]
  );

  const openPanel = useCallback(
    (target: Exclude<ActivePanelId, null | 'settings'>) => {
      const current = activePanelRef.current;
      if (current === target) return;

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

      setAutoForgeSettingsOpen(false);
      setActivePanel(target);
    },
    [engine, showEquipmentFeedback, showNotice]
  );

  const togglePanel = useCallback(
    (target: Exclude<ActivePanelId, null | 'settings'>) => {
      const isCurrentlyOpen = activePanelRef.current === target;
      soundEffects.playClick(isCurrentlyOpen ? 400 : 540);
      if (isCurrentlyOpen) {
        closeActivePanel({ blockOnFullForge: target === 'forge' });
        return;
      }
      openPanel(target);
    },
    [closeActivePanel, openPanel]
  );

  useEffect(() => {
    const unsubscribe = engine.subscribe(setSnapshot);
    void engine.initialize().then(() => {
      const enabled = engine.isSoundEnabled();
      setSoundEnabled(enabled);
      soundEffects.setEnabled(enabled);
    });

    const unsubVis = playgamaBridge.onVisibilityChange((isHidden) => {
      if (isHidden) {
        if (engine.getSnapshot().phase === 'ACTIVE') {
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
          if (autoForgeSettingsOpenRef.current) {
            setAutoForgeSettingsOpen(false);
          } else if (activePanelRef.current) {
            closeActivePanel({
              blockOnFullForge: activePanelRef.current === 'forge',
            });
          } else {
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
      if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current);
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

  // Clear merge selection and close panels when leaving ACTIVE gameplay
  useEffect(() => {
    if (snapshot.phase !== 'ACTIVE') {
      setSelectedSlotIndex(null);
      setInvalidSlotIndex(null);
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

  const triggerInvalidFlash = (slotIndex: number) => {
    setInvalidSlotIndex(slotIndex);
    if (invalidTimerRef.current !== null) {
      window.clearTimeout(invalidTimerRef.current);
    }
    invalidTimerRef.current = window.setTimeout(() => {
      setInvalidSlotIndex(null);
    }, 420);
  };

  const handleStartGame = () => {
    soundEffects.playDeploy();
    setFloatingToast(null);
    setSelectedSlotIndex(null);
    setHighlightedSlotIndex(null);
    setInvalidSlotIndex(null);
    engine.startFromTitle();
  };

  const handleClaimOfflineRewards = () => {
    const res = engine.claimOfflineRewards();
    if (res.success) {
      soundEffects.playWaveClear();
      showNotice(`Claimed +${res.coinsAwarded.toLocaleString()} Offline Coins`);
    }
  };

  const handleOpenSettings = () => {
    soundEffects.playClick(420);
    if (activePanel === 'forge') {
      engine.keepForgedItemInInventory();
    }
    setActivePanel(null);
    engine.setPhase('PAUSED');
  };

  const handleResume = () => {
    soundEffects.playClick(560);
    engine.setPhase('ACTIVE');
  };

  const handleReturnToTitle = () => {
    soundEffects.playClick(380);
    setFloatingToast(null);
    setSelectedSlotIndex(null);
    setHighlightedSlotIndex(null);
    setInvalidSlotIndex(null);
    engine.returnToTitle();
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEffects.setEnabled(next);
    engine.setSoundEnabled(next);
    if (next) {
      soundEffects.playClick(600);
    }
  };

  const handleToggleRangeRing = () => {
    soundEffects.playClick(500);
    engine.toggleRangeRing();
  };

  const handleSummonClick = () => {
    setSelectedSlotIndex(null);
    const res = engine.summonSkill();
    if (!res.success || res.skillId === undefined || res.slotIndex === undefined) {
      if (res.reason === 'insufficient_currency') {
        soundEffects.playClick(280);
        showNotice(`Need ${snapshot.summonCost} Coins to summon`, 'error');
      } else if (res.reason === 'slots_full') {
        soundEffects.playClick(280);
        showNotice('All 6 skill slots are occupied', 'error');
      }
      return;
    }

    soundEffects.playSummon();
    const def = skillRegistry.getDefinition(res.skillId);
    triggerHighlight(res.slotIndex);
    showBanner({
      kind: 'summon',
      skillId: res.skillId,
      name: def?.name ?? res.skillId,
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

    if (selectedSlotIndex === null) {
      if (!tappedSlot.skillId) {
        soundEffects.playClick(360);
        showNotice(`Slot ${slotIndex + 1} is vacant · Tap Summon to fill`);
        return;
      }

      const def = skillRegistry.getDefinition(tappedSlot.skillId);
      const skillName = def?.name ?? tappedSlot.skillId;

      if (tappedSlot.level >= MAX_SKILL_LEVEL) {
        soundEffects.playInvalid();
        triggerInvalidFlash(slotIndex);
        showNotice(`${skillName} Lv.${tappedSlot.level} is already at max level`, 'error');
        return;
      }

      const hasMatch = snapshot.skillSlots.some(
        (other) =>
          other.index !== slotIndex &&
          other.skillId === tappedSlot.skillId &&
          other.level === tappedSlot.level
      );

      soundEffects.playClick(560);
      setSelectedSlotIndex(slotIndex);
      showNotice(
        hasMatch
          ? `Tap matching ${skillName} Lv.${tappedSlot.level} to merge`
          : `Selected ${skillName} Lv.${tappedSlot.level} · Need another Lv.${tappedSlot.level}`
      );
      return;
    }

    if (selectedSlotIndex === slotIndex) {
      soundEffects.playClick(420);
      setSelectedSlotIndex(null);
      showNotice('Selection cancelled');
      return;
    }

    if (!tappedSlot.skillId) {
      soundEffects.playClick(420);
      setSelectedSlotIndex(null);
      showNotice('Selection cancelled');
      return;
    }

    const firstSlot = snapshot.skillSlots[selectedSlotIndex];
    const mergeRes = engine.mergeSkills(selectedSlotIndex, slotIndex);

    if (mergeRes.reason === 'cooldown_locked') {
      return;
    }

    setSelectedSlotIndex(null);

    if (
      mergeRes.success &&
      mergeRes.skillId &&
      mergeRes.targetSlotIndex !== undefined &&
      mergeRes.newLevel !== undefined
    ) {
      soundEffects.playMerge(mergeRes.newLevel);
      const def = skillRegistry.getDefinition(mergeRes.skillId);
      triggerHighlight(mergeRes.targetSlotIndex);
      showBanner({
        kind: 'merge',
        skillId: mergeRes.skillId,
        name: def?.name ?? mergeRes.skillId,
        level: mergeRes.newLevel,
        previousLevel: mergeRes.previousLevel,
        accentColor: def?.accentColor ?? '#34D399',
      });
      return;
    }

    soundEffects.playInvalid();
    triggerInvalidFlash(slotIndex);

    if (mergeRes.reason === 'skill_mismatch') {
      const firstDef = firstSlot?.skillId
        ? skillRegistry.getDefinition(firstSlot.skillId)
        : undefined;
      const secondDef = skillRegistry.getDefinition(tappedSlot.skillId);
      showNotice(
        `Cannot merge ${firstDef?.shortLabel ?? 'skill'} with ${secondDef?.shortLabel ?? 'different skill'}`,
        'error'
      );
    } else if (mergeRes.reason === 'level_mismatch') {
      showNotice(
        `Level mismatch (Lv.${firstSlot?.level ?? '?'} + Lv.${tappedSlot.level}) · Must match`,
        'error'
      );
    } else if (mergeRes.reason === 'max_level') {
      showNotice('Max Level 5 skills cannot merge further', 'error');
    } else {
      showNotice('Select two identical skills of the same level', 'error');
    }
  };

  const handleMergeAreaClick = () => {
    if (selectedSlotIndex !== null) {
      soundEffects.playClick(420);
      setSelectedSlotIndex(null);
      showNotice('Merge selection cancelled');
      return;
    }

    soundEffects.playClick(500);
    const pairReady = engine.skillMerge.hasAvailableMerge(snapshot.skillSlots);
    showNotice(
      pairReady
        ? 'Tap two glowing matching skills to merge!'
        : 'Tap an occupied slot, then an identical match to merge'
    );
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
      showForgeFeedback('Auto Forge enabled', 'success');
    } else if (res.outcome?.stoppedReason && res.outcome.stoppedReason !== 'manual') {
      soundEffects.playInvalid();
    } else {
      soundEffects.playClick(420);
      showForgeFeedback('Auto Forge paused', 'success');
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

  const mergeablePairAvailable = engine.skillMerge.hasAvailableMerge(
    snapshot.skillSlots
  );
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
    <div className="relative flex flex-col w-screen h-dvh bg-[#12161B] text-[#F1F5F9] overflow-hidden">
      <TopHud
        phase={snapshot.phase}
        wave={snapshot.wave}
        boss={snapshot.boss}
        currencies={snapshot.currencies}
        totalSkillFragments={totalSkillFragments}
        onOpenCollection={() => togglePanel('collection')}
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
                    floatingToast.banner.kind === 'merge'
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
                  {floatingToast.banner.kind === 'merge'
                    ? `Merged ${floatingToast.banner.name}`
                    : `Summoned ${floatingToast.banner.name}`}
                </span>
                <span className="font-mono-tabular text-[11px] font-bold text-amber-300 shrink-0">
                  {floatingToast.banner.kind === 'merge' &&
                  floatingToast.banner.previousLevel !== undefined
                    ? `Lv.${floatingToast.banner.previousLevel} → Lv.${floatingToast.banner.level}`
                    : `Lv.${floatingToast.banner.level}`}
                </span>
                {floatingToast.banner.kind === 'summon' &&
                  floatingToast.banner.unlockedNew && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-[10px] font-bold text-emerald-300 leading-none">
                      New
                    </span>
                  )}
                {floatingToast.banner.kind === 'summon' &&
                  floatingToast.banner.fragmentsAwarded !== undefined &&
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
              onDismantleForged={handleDismantleForged}
              onOpenEquipment={() => {
                soundEffects.playClick(540);
                openPanel('equipment');
              }}
              onClose={() => {
                const closed = closeActivePanel({ blockOnFullForge: true });
                if (closed) {
                  soundEffects.playClick(400);
                }
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

        {snapshot.phase === 'TITLE' && (
          <TitleOverlay
            highestWave={snapshot.wave.highestWave}
            onStart={handleStartGame}
          />
        )}

        {snapshot.offlineReward && !snapshot.offlineReward.claimed && (
          <OfflineRewardModal
            reward={snapshot.offlineReward}
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
            soundEnabled={soundEnabled}
            showRangeRing={snapshot.showRangeRing}
            onResume={handleResume}
            onToggleSound={handleToggleSound}
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
        hasVacantSlot={snapshot.hasVacantSkillSlot}
        selectedSlotIndex={selectedSlotIndex}
        highlightedSlotIndex={highlightedSlotIndex}
        invalidSlotIndex={invalidSlotIndex}
        mergeablePairAvailable={mergeablePairAvailable}
        onSummonClick={handleSummonClick}
        onSkillSlotClick={handleSkillSlotClick}
        onMergeAreaClick={handleMergeAreaClick}
      />
    </div>
  );
}
