import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { get, post } from "../../api/api";
import OnboardingWizard from "./OnboardingWizard";

const OnboardingContext = createContext(null);

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export default function OnboardingProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({
    status: "not_started", // not_started | in_progress | completed | dismissed
    step: null,
    payload: {},
    can_show: false,
  });
  const [open, setOpen] = useState(false);

  async function fetchState() {
    try {
      const s = await get("onboarding/state");
      setState(s || { status: "not_started", step: null, payload: {}, can_show: true });
      setOpen(!!s?.can_show && (s.status === "not_started" || s.status === "in_progress"));
    } catch {
      // молча, чтобы не мешать основному UI
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo(
    () => ({
      refresh: fetchState,
      start: async () => {
        await post("onboarding/state", { status: "in_progress", step: "welcome" });
        await fetchState();
        setOpen(true);
      },
      patch: async (patchObj, nextStep) => {
        await post("onboarding/state", {
          status: "in_progress",
          step: nextStep || state.step,
          patch: patchObj || {},
        });
        await fetchState();
      },
      complete: async () => {
        await post("onboarding/complete", {});
        await fetchState();
        setOpen(false);
      },
      dismiss: async () => {
        await post("onboarding/dismiss", {});
        await fetchState();
        setOpen(false);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.step]
  );

  const value = useMemo(() => ({ loading, state, open, setOpen, api }), [loading, state, open, api]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {/* Визард рендерим поверх, если можно показывать и пользователь не завершил */}
      {open && state.status !== "completed" && (
        <OnboardingWizard
          stepKey={state.step || "welcome"}
          initialPayload={state.payload || {}}
          onClose={() => api.dismiss()}
          onPatch={(patch, next) => api.patch(patch, next)}
          onComplete={() => api.complete()}
        />
      )}
    </OnboardingContext.Provider>
  );
}