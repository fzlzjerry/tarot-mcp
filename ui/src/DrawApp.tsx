import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type ArcFanHandle } from "./ArcFan.js";
import { ConnectionSettings } from "./ConnectionSettings.js";
import { DrawStage } from "./DrawStage.js";
import { ReadingBoard } from "./ReadingBoard.js";
import { RitualStage } from "./RitualStage.js";
import { SetupForm } from "./SetupForm.js";
import { cutDeck, shuffleWithSeed } from "./deck-order.js";
import { type FlipRect, prefersReducedMotion } from "./flip.js";
import { t } from "./i18n.js";
import { toggleSelection } from "./selection.js";
import type { DrawClient, DrawError, Language } from "./types.js";
import { useDrawSession } from "./useDrawSession.js";
import { useWebMcp } from "./webmcp/useWebMcp.js";

interface DrawAppProps {
  client: DrawClient;
}

export function DrawApp({ client }: DrawAppProps) {
  return (
    <div className="draw-app" data-surface={client.target}>
      <DrawTable client={client} />
    </div>
  );
}

function DrawTable({ client }: DrawAppProps) {
  const session = useDrawSession(client);
  const {
    language,
    setLanguage,
    stage,
    setStage,
    draw,
    reading,
    restoredUiSnapshot,
    pendingConfirmation,
    error,
    pendingBegin,
    beginReading,
    retryBegin,
  } = session;
  const [deckOrder, setDeckOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [placementDrawId, setPlacementDrawId] = useState<string>();
  const [ritualCheckpoint, setRitualCheckpoint] = useState(false);
  const tableDrawId = draw?.drawId ?? reading?.drawId;
  const activeDrawId = useRef(tableDrawId);
  activeDrawId.current = tableDrawId;
  const revealCheckpoint = useRef<{
    drawId?: string;
    revealedIndices: number[];
    continuationSent: boolean;
  }>({ revealedIndices: [], continuationSent: false });
  useEffect(() => {
    activeDrawId.current = tableDrawId;
    return () => {
      activeDrawId.current = undefined;
    };
  }, [tableDrawId]);
  const [origins, setOrigins] = useState<Record<string, FlipRect>>({});
  const [returning, setReturning] = useState<{
    slotId: string;
    target: FlipRect;
  }>();
  const returningSlot = useRef<string | undefined>(undefined);
  const arcRef = useRef<ArcFanHandle | null>(null);
  const selectionLocked =
    session.selectionLocked || Boolean(returning) || stage === "confirming";
  const baseOrder = useMemo(
    () => draw?.slots.map((slot) => slot.slotId) ?? [],
    [draw],
  );

  useEffect(() => {
    setDeckOrder(restoredUiSnapshot?.deckOrder ?? baseOrder);
    setSelected(restoredUiSnapshot?.selectedSlotIds ?? []);
    setPlacementDrawId(tableDrawId);
    setRitualCheckpoint(false);
    revealCheckpoint.current = {
      drawId: tableDrawId,
      revealedIndices: restoredUiSnapshot?.revealedIndices ?? [],
      continuationSent: restoredUiSnapshot?.continuationSent ?? false,
    };
    setOrigins({});
    setReturning(undefined);
    returningSlot.current = undefined;
  }, [baseOrder, tableDrawId, restoredUiSnapshot]);

  useWebMcp(client.target === "web", {
    ...session,
    selectedCount: selected.length,
  });

  const saveUiCheckpoint = useCallback(() => {
    if (
      !client.writeUiState ||
      !tableDrawId ||
      placementDrawId !== tableDrawId ||
      activeDrawId.current !== tableDrawId ||
      deckOrder.length !== 78
    )
      return;
    const progress = revealCheckpoint.current;
    client.writeUiState({
      version: 1,
      drawId: tableDrawId,
      deckOrder,
      selectedSlotIds: selected,
      ...(!reading && pendingConfirmation ? { pendingConfirmation } : {}),
      ...(reading?.drawId === tableDrawId ? { confirmedReading: reading } : {}),
      revealedIndices:
        progress.drawId === tableDrawId ? progress.revealedIndices : [],
      continuationSent:
        progress.drawId === tableDrawId && progress.continuationSent,
    });
  }, [
    client,
    tableDrawId,
    placementDrawId,
    deckOrder,
    selected,
    reading,
    pendingConfirmation,
  ]);

  useEffect(() => {
    if (
      stage === "selecting" ||
      stage === "confirming" ||
      stage === "reading" ||
      (stage === "ritual" && ritualCheckpoint)
    )
      saveUiCheckpoint();
  }, [stage, ritualCheckpoint, saveUiCheckpoint]);

  const onUiCheckpoint = useCallback(
    (revealedIndices: number[], continuationSent: boolean) => {
      if (activeDrawId.current !== tableDrawId) return;
      revealCheckpoint.current = {
        drawId: tableDrawId,
        revealedIndices,
        continuationSent,
      };
      saveUiCheckpoint();
    },
    [tableDrawId, saveUiCheckpoint],
  );

  const shuffleDeck = (): void => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    setDeckOrder((current) => shuffleWithSeed(current, seed));
    setRitualCheckpoint(true);
  };
  const confirm = () => {
    if (selectionLocked || returningSlot.current) return;
    void session.confirm(selected, deckOrder);
  };
  const restart = session.restart;

  const commitRemove = useCallback((slotId: string) => {
    setSelected((current) => current.filter((id) => id !== slotId));
    setOrigins(({ [slotId]: _removed, ...rest }) => rest);
    setReturning(undefined);
    returningSlot.current = undefined;
    arcRef.current?.focusSlot(slotId);
  }, []);

  const removeCard = useCallback(
    (slotId: string) => {
      if (
        selectionLocked ||
        returningSlot.current ||
        !selected.includes(slotId)
      )
        return;
      const target = arcRef.current?.rectFor(slotId);
      if (!target || prefersReducedMotion()) {
        commitRemove(slotId);
        return;
      }
      returningSlot.current = slotId;
      setReturning({ slotId, target });
    },
    [commitRemove, selected, selectionLocked],
  );

  const toggleCard = useCallback(
    (slotId: string, origin: FlipRect) => {
      if (!draw || selectionLocked || returningSlot.current) return;
      if (selected.includes(slotId)) {
        removeCard(slotId);
        return;
      }
      if (selected.length >= draw.requiredCount) return;
      setOrigins((current) => ({ ...current, [slotId]: origin }));
      setSelected((current) =>
        toggleSelection(current, slotId, draw.requiredCount),
      );
    },
    [draw, removeCard, selected, selectionLocked],
  );

  const forgetOrigin = useCallback((slotId: string) => {
    setOrigins(({ [slotId]: _consumed, ...rest }) => rest);
  }, []);
  const undo = useCallback(() => {
    if (selectionLocked || returningSlot.current) return;
    const last = selected[selected.length - 1];
    if (last) removeCard(last);
  }, [removeCard, selected, selectionLocked]);
  const clearAll = useCallback(() => {
    if (selectionLocked || returningSlot.current) return;
    setSelected([]);
    setOrigins({});
  }, [selectionLocked]);

  const expired =
    error?.code === "DRAW_NOT_FOUND" ||
    error?.code === "DRAW_EXPIRED" ||
    (Boolean(draw) && (error?.httpStatus === 404 || error?.httpStatus === 410));
  const conflict = error?.code === "DRAW_ALREADY_CONFIRMED";
  const unauthorized = error?.httpStatus === 401;
  const noticeMessage = expired
    ? t(language, "deckExpired")
    : conflict
      ? t(language, "confirmationConflict")
      : unauthorized
        ? t(
            language,
            client.target === "web"
              ? "credentialsExpired"
              : "tunnelCredentialsExpired",
          )
        : session.selectionLocked
          ? t(language, "confirmationUnknown")
          : error?.message;
  const notice = error ? (
    <ErrorBanner
      error={Object.assign(new Error(noticeMessage), {
        code: error.code,
        httpStatus: error.httpStatus,
      })}
      language={language}
      onRetry={
        expired || conflict || pendingBegin || stage === "confirming"
          ? undefined
          : session.selectionLocked
            ? () => void session.retryConfirm()
            : stage === "setup"
              ? retryBegin
              : undefined
      }
      onRestart={pendingBegin || stage === "confirming" ? undefined : restart}
    >
      {unauthorized && client.target === "web" ? (
        <ConnectionSettings client={client} language={language} />
      ) : null}
    </ErrorBanner>
  ) : undefined;

  if (stage === "setup") {
    return (
      <SetupForm
        language={language}
        client={client}
        onLanguageChange={setLanguage}
        onSubmit={(input) => void beginReading(input).catch(() => undefined)}
        isPending={pendingBegin}
        notice={notice}
      />
    );
  }
  if (stage === "waiting") {
    return (
      <main className="waiting-shell" aria-live="polite">
        <span className="waiting-symbol" aria-hidden="true">
          ✦
        </span>
        <p>{t(language, "waiting")}</p>
        {notice}
      </main>
    );
  }
  if (stage === "reading" && reading) {
    return (
      <ReadingBoard
        key={reading.drawId ?? reading.readingId}
        reading={reading}
        client={client}
        backImageUri={reading.deckBackImageUri ?? draw?.deckBackImageUri}
        language={language}
        onRestart={restart}
        initialRevealedIndices={restoredUiSnapshot?.revealedIndices}
        initialContinuationSent={restoredUiSnapshot?.continuationSent}
        onUiCheckpoint={onUiCheckpoint}
      />
    );
  }
  if (!draw) {
    return (
      <main className="waiting-shell">
        <ErrorBanner
          error={error ?? new Error("Missing draw data")}
          language={language}
          onRestart={restart}
        />
      </main>
    );
  }
  if (stage === "ritual") {
    return (
      <RitualStage
        total={baseOrder.length}
        spreadName={draw.spreadName}
        deckBackImageUri={draw.deckBackImageUri}
        language={language}
        notice={notice}
        onShuffle={shuffleDeck}
        onReady={(cutIndex) => {
          setDeckOrder((current) => cutDeck(current, cutIndex));
          setStage("selecting");
        }}
        onSkip={() => setStage("selecting")}
      />
    );
  }
  return (
    <DrawStage
      client={client}
      draw={draw}
      deckOrder={deckOrder}
      selected={selected}
      origins={origins}
      returning={returning}
      arcRef={arcRef}
      onToggle={toggleCard}
      onRemove={removeCard}
      onOriginConsumed={forgetOrigin}
      onDeparted={commitRemove}
      onUndo={undo}
      onClear={clearAll}
      onConfirm={confirm}
      language={language}
      isConfirming={stage === "confirming"}
      selectionLocked={selectionLocked}
      notice={notice}
    />
  );
}

function ErrorBanner({
  error,
  language,
  onRetry,
  onRestart,
  children,
}: {
  error: DrawError;
  language: Language;
  onRetry?: () => void;
  onRestart?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="error-banner" role="alert">
      <div>
        <strong>{t(language, "error")}</strong>
        <span>{error.message}</span>
      </div>
      {children}
      <div className="error-banner__actions">
        {onRetry ? (
          <button type="button" onClick={onRetry}>
            {t(language, "tryAgain")}
          </button>
        ) : null}
        {onRestart ? (
          <button type="button" onClick={onRestart}>
            {t(language, "restart")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
