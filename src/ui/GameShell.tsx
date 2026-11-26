import { useEffect, useRef, useState } from 'react';
import { Coins, ShieldAlert, Trophy } from 'lucide-react';
import { soundEffects } from '../audio/soundEffects';
import { BOSS_CONFIG, MAX_SKILL_LEVEL } from '../game/constants';
import { EQUIPMENT_SLOT_META } from '../game/data/equipmentCatalog';
import { GameEngine } from '../game/engine/GameEngine';
import { skillRegistry } from '../game/systems/skills/SkillRegistry';
import {
  EquipmentPreferences,
  EquipmentSlotType,
  GameHudSnapshot,
  SkillId,
  UpgradeId,
  WaveHudEvent,
} from '../game/types';
import { playgamaBridge } from '../platform/playgamaBridge';
import { BattlefieldCanvas } from './BattlefieldCanvas';
import { ActionBannerInfo, BottomHud, StatusNoticeInfo } from './BottomHud';
import { DefeatOverlay } from './DefeatOverlay';
import { EquipmentFeedbackInfo, EquipmentModal } from './EquipmentModal';
import { ForgeFeedbackInfo, ForgeModal } from './ForgeModal';
import { PauseModal } from './PauseModal';
import {
  SkillCollectionFeedbackInfo,
  SkillCollectionModal,
} from './SkillCollectionModal';
import { TankUpgradePanel, UpgradeFeedbackInfo } from './TankUpgradePanel';
import { TitleOverlay } from './TitleOverlay';
import { TopHud } from './TopHud';

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
  const [statusNotice, setStatusNotice] = useState<StatusNoticeInfo | null>(null);
  const [actionBanner, setActionBanner] = useState<ActionBannerInfo | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [highlightedSlotIndex, setHighlightedSlotIndex] = useState<number | null>(
    null
  );
  const [invalidSlotIndex, setInvalidSlotIndex] = useState<number | null>(null);
  const [waveBanner, setWaveBanner] = useState<WaveHudEvent | null>(null);
  const [upgradesOpen, setUpgradesOpen] = useState<boolean>(false);
  const [equipmentOpen, setEquipmentOpen] = useState<boolean>(false);
  const [forgeOpen, setForgeOpen] = useState<boolean>(false);
  const [collectionOpen, setCollectionOpen] = useState<boolean>(false);
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

  const noticeTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const invalidTimerRef = useRef<number | null>(null);
  const waveBannerTimerRef = useRef<number | null>(null);
  const upgradeFeedbackTimerRef = useRef<number | null>(null);
  const equipmentFeedbackTimerRef = useRef<number | null>(null);
  const forgeFeedbackTimerRef = useRef<number | null>(null);
  const collectionFeedbackTimerRef = useRef<number | null>(null);
  const upgradeHighlightTimerRef = useRef<number | null>(null);
  const collectionHighlightTimerRef = useRef<number | null>(null);
  const lastSeenWaveEventIdRef = useRef<number>(0);
  const upgradesOpenRef = useRef<boolean>(false);
  const equipmentOpenRef = useRef<boolean>(false);
  const forgeOpenRef = useRef<boolean>(false);
  const collectionOpenRef = useRef<boolean>(false);

  useEffect(() => {
    upgradesOpenRef.current = upgradesOpen;
  }, [upgradesOpen]);

  useEffect(() => {
    equipmentOpenRef.current = equipmentOpen;
  }, [equipmentOpen]);

  useEffect(() => {
    forgeOpenRef.current = forgeOpen;
  }, [forgeOpen]);

  useEffect(() => {
    collectionOpenRef.current = collectionOpen;
  }, [collectionOpen]);

  useEffect(() => {
    const unsubscribe = engine.subscribe(setSnapshot);
    void engine.initialize().then(() => {
      const enabled = engine.isSoundEnabled();
      setSoundEnabled(enabled);
      soundEffects.setEnabled(enabled);
    });

    const unsubVis = playgamaBridge.onVisibilityChange((isHidden) => {
      if (isHidden && engine.getSnapshot().phase === 'ACTIVE') {
        engine.setPhase('PAUSED');
      }
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const currentPhase = engine.getSnapshot().phase;
        if (currentPhase === 'ACTIVE') {
          if (forgeOpenRef.current) {
            const kept = engine.keepForgedItemInInventory();
            if (kept.reason === 'inventory_full') {
              showForgeFeedback(
                'Inventory is full! Dismantle the forged item or free a slot in Equipment first.',
                'error'
              );
              return;
            }
            setForgeOpen(false);
          } else if (collectionOpenRef.current) {
            setCollectionOpen(false);
          } else if (equipmentOpenRef.current) {
            setEquipmentOpen(false);
          } else if (upgradesOpenRef.current) {
            setUpgradesOpen(false);
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
      window.removeEventListener('keydown', onKeyDown);
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
      if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
      if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current);
      if (waveBannerTimerRef.current !== null) window.clearTimeout(waveBannerTimerRef.current);
      if (upgradeFeedbackTimerRef.current !== null) window.clearTimeout(upgradeFeedbackTimerRef.current);
      if (equipmentFeedbackTimerRef.current !== null) window.clearTimeout(equipmentFeedbackTimerRef.current);
      if (forgeFeedbackTimerRef.current !== null) window.clearTimeout(forgeFeedbackTimerRef.current);
      if (collectionFeedbackTimerRef.current !== null) window.clearTimeout(collectionFeedbackTimerRef.current);
      if (upgradeHighlightTimerRef.current !== null) window.clearTimeout(upgradeHighlightTimerRef.current);
      if (collectionHighlightTimerRef.current !== null) window.clearTimeout(collectionHighlightTimerRef.current);
    };
  }, [engine]);

  // Trigger brief wave completion or boss encounter notification when WaveSystem emits one
  useEffect(() => {
    const evt = snapshot.waveEvent;
    if (!evt) {
      lastSeenWaveEventIdRef.current = 0;
      setWaveBanner(null);
      return;
    }
    if (evt.id !== lastSeenWaveEventIdRef.current && snapshot.phase === 'ACTIVE') {
      lastSeenWaveEventIdRef.current = evt.id;
      setWaveBanner(evt);
      if (waveBannerTimerRef.current !== null) {
        window.clearTimeout(waveBannerTimerRef.current);
      }
      waveBannerTimerRef.current = window.setTimeout(() => {
        setWaveBanner(null);
      }, 2100);
    }
  }, [snapshot.waveEvent, snapshot.phase]);

  // Clear merge selection and close drawers when leaving ACTIVE gameplay
  useEffect(() => {
    if (snapshot.phase !== 'ACTIVE') {
      setSelectedSlotIndex(null);
      setInvalidSlotIndex(null);
      setUpgradesOpen(false);
      setEquipmentOpen(false);
      setForgeOpen(false);
      setCollectionOpen(false);
      setUpgradeFeedback(null);
      setEquipmentFeedback(null);
      setForgeFeedback(null);
      setCollectionFeedback(null);
    }
  }, [snapshot.phase]);

  const showNotice = (text: string, tone: 'info' | 'error' = 'info') => {
    setStatusNotice({ text, tone });
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setStatusNotice(null);
    }, 1800);
  };

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

  const showBanner = (banner: ActionBannerInfo) => {
    setStatusNotice(null);
    setActionBanner(banner);
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setActionBanner(null);
    }, 1800);
  };

  const handleStartGame = () => {
    soundEffects.playDeploy();
    setActionBanner(null);
    setSelectedSlotIndex(null);
    setHighlightedSlotIndex(null);
    setInvalidSlotIndex(null);
    engine.restartBattle();
  };

  const handleOpenSettings = () => {
    soundEffects.playClick(420);
    engine.setPhase('PAUSED');
  };

  const handleResume = () => {
    soundEffects.playClick(560);
    engine.setPhase('ACTIVE');
  };

  const handleRestartBattle = () => {
    soundEffects.playDeploy();
    setActionBanner(null);
    setSelectedSlotIndex(null);
    setHighlightedSlotIndex(null);
    setInvalidSlotIndex(null);
    engine.restartBattle();
  };

  const handleReturnToTitle = () => {
    soundEffects.playClick(380);
    setActionBanner(null);
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

    // 1. No slot selected yet -> select an occupied slot (< Max Lv.5) for merging
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
          ? `Tap matching ${skillName} Lv.${tappedSlot.level} to merge · Tap again to cancel`
          : `Selected ${skillName} Lv.${tappedSlot.level} · Need another Lv.${tappedSlot.level} to merge`
      );
      return;
    }

    // 2. Tapping the already-selected slot cancels selection
    if (selectedSlotIndex === slotIndex) {
      soundEffects.playClick(420);
      setSelectedSlotIndex(null);
      showNotice('Selection cancelled');
      return;
    }

    // 3. Tapping a vacant slot while one is selected cancels selection cleanly
    if (!tappedSlot.skillId) {
      soundEffects.playClick(420);
      setSelectedSlotIndex(null);
      showNotice('Selection cancelled');
      return;
    }

    // 4. Second occupied slot tapped -> validate & merge via SkillMergeSystem
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

    // 5. Invalid merge combination -> visual shake + clear explanation
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
        ? 'Tap two glowing matching skills to merge them!'
        : 'Tap any occupied skill slot, then tap an identical match to merge'
    );
  };

  const showUpgradeFeedback = (
    text: string,
    tone: 'success' | 'error'
  ) => {
    setUpgradeFeedback({ text, tone });
    if (upgradeFeedbackTimerRef.current !== null) {
      window.clearTimeout(upgradeFeedbackTimerRef.current);
    }
    upgradeFeedbackTimerRef.current = window.setTimeout(() => {
      setUpgradeFeedback(null);
    }, 1600);
  };

  const showEquipmentFeedback = (
    text: string,
    tone: 'success' | 'error'
  ) => {
    setEquipmentFeedback({ text, tone });
    if (equipmentFeedbackTimerRef.current !== null) {
      window.clearTimeout(equipmentFeedbackTimerRef.current);
    }
    equipmentFeedbackTimerRef.current = window.setTimeout(() => {
      setEquipmentFeedback(null);
    }, 1800);
  };

  const showForgeFeedback = (
    text: string,
    tone: 'success' | 'error'
  ) => {
    setForgeFeedback({ text, tone });
    if (forgeFeedbackTimerRef.current !== null) {
      window.clearTimeout(forgeFeedbackTimerRef.current);
    }
    forgeFeedbackTimerRef.current = window.setTimeout(() => {
      setForgeFeedback(null);
    }, 2000);
  };

  const showCollectionFeedback = (
    text: string,
    tone: 'success' | 'error'
  ) => {
    setCollectionFeedback({ text, tone });
    if (collectionFeedbackTimerRef.current !== null) {
      window.clearTimeout(collectionFeedbackTimerRef.current);
    }
    collectionFeedbackTimerRef.current = window.setTimeout(() => {
      setCollectionFeedback(null);
    }, 1800);
  };

  const handleToggleUpgrades = () => {
    soundEffects.playClick(upgradesOpen ? 400 : 540);
    if (forgeOpen) {
      const kept = engine.keepForgedItemInInventory();
      if (kept.reason === 'inventory_full') {
        showNotice('Pending forged item kept safely in Forge (inventory full)', 'error');
      }
      setForgeOpen(false);
    }
    setEquipmentOpen(false);
    setCollectionOpen(false);
    setUpgradesOpen((prev) => !prev);
  };

  const handleToggleEquipment = () => {
    soundEffects.playClick(equipmentOpen ? 400 : 540);
    if (forgeOpen) {
      const kept = engine.keepForgedItemInInventory();
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
      setForgeOpen(false);
    }
    setUpgradesOpen(false);
    setCollectionOpen(false);
    setEquipmentOpen((prev) => !prev);
  };

  const handleToggleForge = () => {
    soundEffects.playClick(forgeOpen ? 400 : 540);
    if (forgeOpen) {
      const kept = engine.keepForgedItemInInventory();
      if (kept.reason === 'inventory_full') {
        showNotice('Pending forged item kept safely in Forge (inventory full)', 'error');
      } else if (kept.success && kept.item) {
        showNotice(`${kept.item.name} added to Equipment Inventory`);
      }
      setForgeOpen(false);
      return;
    }
    setUpgradesOpen(false);
    setEquipmentOpen(false);
    setCollectionOpen(false);
    setForgeOpen(true);
  };

  const handleToggleCollection = () => {
    soundEffects.playClick(collectionOpen ? 400 : 540);
    if (forgeOpen) {
      const kept = engine.keepForgedItemInInventory();
      if (kept.reason === 'inventory_full') {
        showNotice('Pending forged item kept safely in Forge (inventory full)', 'error');
      }
      setForgeOpen(false);
    }
    setUpgradesOpen(false);
    setEquipmentOpen(false);
    setCollectionOpen((prev) => !prev);
  };

  const handleCloseForge = () => {
    const kept = engine.keepForgedItemInInventory();
    if (kept.reason === 'inventory_full') {
      soundEffects.playInvalid();
      showForgeFeedback(
        'Inventory is full! Dismantle this item or open Equipment to free 1 slot.',
        'error'
      );
      return;
    }
    soundEffects.playClick(400);
    if (kept.success && kept.item) {
      showNotice(`${kept.item.name} added to Equipment Inventory`);
    }
    setForgeOpen(false);
  };

  const handleStartForge = () => {
    const res = engine.startForge();
    if (res.success) {
      soundEffects.playForgeStart();
      setForgeFeedback(null);
      return;
    }

    soundEffects.playInvalid();
    if (res.reason === 'inventory_full') {
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
        onOpenSettings={handleOpenSettings}
      />

      <main className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        <BattlefieldCanvas
          engine={engine}
          tank={snapshot.tank}
          phase={snapshot.phase}
          isUpgradesOpen={upgradesOpen}
          isEquipmentOpen={equipmentOpen}
          isForgeOpen={forgeOpen}
          isCollectionOpen={collectionOpen}
          forgeStatus={snapshot.forge.status}
          equippedCount={equippedCount}
          unlockedSkillCount={snapshot.unlockedSkillCount}
          hasAffordableUpgrade={hasAffordableUpgrade}
          hasAffordableCollectionUpgrade={hasAffordableCollectionUpgrade}
          onToggleUpgrades={handleToggleUpgrades}
          onToggleEquipment={handleToggleEquipment}
          onToggleForge={handleToggleForge}
          onToggleCollection={handleToggleCollection}
        />

        {snapshot.phase === 'ACTIVE' && upgradesOpen && (
          <TankUpgradePanel
            upgrades={snapshot.upgrades}
            goldBalance={snapshot.currencies.gold}
            feedback={upgradeFeedback}
            highlightedUpgradeId={highlightedUpgradeId}
            onPurchaseUpgrade={handlePurchaseUpgrade}
            onClose={() => {
              soundEffects.playClick(400);
              setUpgradesOpen(false);
            }}
          />
        )}

        {snapshot.phase === 'ACTIVE' && equipmentOpen && (
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
              setEquipmentOpen(false);
              setForgeOpen(true);
            }}
            onClose={() => {
              soundEffects.playClick(400);
              setEquipmentOpen(false);
            }}
          />
        )}

        {snapshot.phase === 'ACTIVE' && forgeOpen && (
          <ForgeModal
            forge={snapshot.forge}
            goldBalance={snapshot.currencies.gold}
            equipmentSlots={snapshot.equipmentSlots}
            inventoryCapacity={snapshot.equipmentCapacity}
            unequippedCount={snapshot.equipmentUnequippedCount}
            feedback={forgeFeedback}
            onStartForge={handleStartForge}
            onEquipForged={handleEquipForged}
            onDismantleForged={handleDismantleForged}
            onOpenEquipment={() => {
              soundEffects.playClick(540);
              const kept = engine.keepForgedItemInInventory();
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
              setForgeOpen(false);
              setEquipmentOpen(true);
            }}
            onClose={handleCloseForge}
          />
        )}

        {snapshot.phase === 'ACTIVE' && collectionOpen && (
          <SkillCollectionModal
            entries={snapshot.skillCollection}
            unlockedCount={snapshot.unlockedSkillCount}
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
              setCollectionOpen(false);
            }}
          />
        )}

        {/* Brief, non-blocking Wave Completion / Boss Encounter Notification */}
        {waveBanner && snapshot.phase === 'ACTIVE' && (
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#12171E]/95 border-2 rounded-lg px-3.5 py-1.5 shadow-xl whitespace-nowrap animate-summon-pop ${
              waveBanner.kind === 'boss_spawn'
                ? 'border-rose-500 text-rose-100'
                : 'border-emerald-400 text-emerald-100'
            }`}
          >
            {waveBanner.kind === 'boss_spawn' ? (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold">
                  Wave {waveBanner.wave} Boss: {BOSS_CONFIG.name}
                </span>
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-white">
                  {waveBanner.isBossWave
                    ? `Boss Defeated! Wave ${waveBanner.wave} Cleared`
                    : `Wave ${waveBanner.wave} Cleared`}
                </span>
                <span className="inline-flex items-center gap-1 font-mono-tabular text-xs font-bold text-amber-300">
                  <Coins className="w-3.5 h-3.5 shrink-0" />+{waveBanner.rewardGold}
                </span>
              </>
            )}
          </div>
        )}

        {snapshot.phase === 'TITLE' && (
          <TitleOverlay
            highestWave={snapshot.wave.highestWave}
            onStart={handleStartGame}
          />
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
            waveReached={snapshot.wave.currentWave}
            battle={snapshot.battle}
            onRestart={handleRestartBattle}
            onReturnToTitle={handleReturnToTitle}
          />
        )}
      </main>

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
        actionBanner={actionBanner}
        statusNotice={statusNotice}
        onSummonClick={handleSummonClick}
        onSkillSlotClick={handleSkillSlotClick}
        onMergeAreaClick={handleMergeAreaClick}
      />
    </div>
  );
}
