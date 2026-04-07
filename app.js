(() => {
  const QUESTIONNAIRE_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeHG_YqT1OB6zaiQ-0ewnmAbx4rXTUwBHtlivP2wDT21sHYQQ/viewform?usp=publish-editor";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle("hidden", Boolean(hidden));
  }

  function clearInvalidStyles(formEl) {
    $$(".ring-2.ring-red-500", formEl).forEach((x) => {
      x.classList.remove("ring-2", "ring-red-500");
    });
    $$(".outline-red-500", formEl).forEach((x) => {
      x.classList.remove("outline-red-500");
    });
    $$(".outline-2", formEl).forEach((x) => {
      // harmless if already removed; only remove from our known-invalid style classes
      if (x.classList.contains("outline")) x.classList.remove("outline-2");
    });
  }

  function markInvalid(el) {
    if (!el) return;
    // Use a light border/ring so it still looks good with Tailwind focus styles.
    el.classList.add("ring-2", "ring-red-500");
  }

  function showError(errorEl, messages) {
    if (!errorEl) return;
    const list = Array.isArray(messages) ? messages : [String(messages)];
    errorEl.innerHTML = `<ul class="list-disc pl-5">${list.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`;
    setHidden(errorEl, false);
  }

  function hideError(errorEl) {
    if (!errorEl) return;
    errorEl.textContent = "";
    setHidden(errorEl, true);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getStepTitle(stepIndex) {
    const stepDefs = [
      { title: "Account", desc: "Choose your profile details." },
      { title: "Personal", desc: "Tell us who you are." },
      { title: "Address", desc: "Where can we reach you by mail?" },
      { title: "Preferences", desc: "Final choices before submitting." },
    ];
    return stepDefs[stepIndex] || { title: `Step ${stepIndex + 1}`, desc: "" };
  }

  function validateStep(formEl, stepIndex) {
    const stepFields = [
      // Website + bio are optional in this experiment.
      ["username-step", "job-title-step"],
      ["first-name-step", "last-name-step", "email-step", "phone-step"],
      ["country-step", "street-address-step", "city-step", "region-step", "postal-code-step"],
      // Step 4 is special: radio group + checkbox.
      [],
    ];

    clearInvalidStyles(formEl);
    const errors = [];

    if (stepIndex !== 3) {
      for (const id of stepFields[stepIndex]) {
        const el = document.getElementById(id);
        if (!el) continue;
        const val = (el.value || "").trim();
        if (!val) {
          errors.push(`${getStepTitle(stepIndex).title}: ${getLabelForId(id)} is required.`);
          markInvalid(el);
        } else if (typeof el.checkValidity === "function" && !el.checkValidity()) {
          errors.push(`${getLabelForId(id)} looks invalid.`);
          markInvalid(el);
        }
      }
    } else {
      const radioChecked = $(`input[name="preferred-contact-step"]:checked`, formEl);
      const termsEl = $("#terms-step", formEl);
      if (!radioChecked) {
        errors.push(`Preferences: Please choose a preferred contact method.`);
        // Mark radio inputs so user sees where the problem is.
        $$(`input[name="preferred-contact-step"]`, formEl).forEach((r) => markInvalid(r));
      }
      if (!termsEl || !termsEl.checked) {
        errors.push(`Preferences: You must confirm the information is accurate.`);
        markInvalid(termsEl);
      }
    }

    return { ok: errors.length === 0, errors };
  }

  function getLabelForId(id) {
    const el = document.getElementById(id);
    if (!el) return id;
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (!label) return id;
    return label.textContent.trim().replace(/\s+/g, " ");
  }

  function resetStepperUI() {
    const stepperForm = $("#form-stepper");
    const panels = $$(".step-panel");
    const errorEl = $("#stepperError");
    const doneEl = $("#stepper-done");
    const backBtn = $("#step-back");
    const nextBtn = $("#step-next");
    const badge = $("#stepperBadge");
    const titleEl = $("#stepperTitle");
    const progressText = $("#stepperProgressText");

    let currentStep = 0;

    function updateUI() {
      panels.forEach((p, idx) => setHidden(p, idx !== currentStep));
      const step = getStepTitle(currentStep);
      if (badge) badge.textContent = String(currentStep + 1);
      if (titleEl) titleEl.textContent = step.title;
      if (progressText) progressText.textContent = `Step ${currentStep + 1} of ${panels.length}`;

      setHidden(doneEl, true);
      if (backBtn) backBtn.disabled = currentStep === 0;
      if (nextBtn) nextBtn.textContent = currentStep === panels.length - 1 ? "Finish" : "Next";
      hideError(errorEl);
    }

    function goToStep(stepIdx) {
      currentStep = stepIdx;
      updateUI();
    }

    $("#reset-stepper")?.addEventListener("click", () => {
      stepperForm?.reset();
      goToStep(0);
    });

    $("#step-back")?.addEventListener("click", () => {
      if (currentStep > 0) goToStep(currentStep - 1);
    });

    stepperForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const { ok, errors } = validateStep(stepperForm, currentStep);
      if (!ok) {
        showError(errorEl, errors);
        return;
      }

      // If it's the last step, "finish".
      if (currentStep === panels.length - 1) {
        try {
          localStorage.setItem("formAllCompleted", "true");
          localStorage.setItem("formStepperCompleted", "true");
        } catch {
          // ignore storage failures
        }
        hideError(errorEl);
        setHidden(stepperForm, true);
        setHidden(doneEl, false);
        doneEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      goToStep(currentStep + 1);
    });

    // Initialize
    goToStep(0);
    return { goToStep };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const questionnaireLink = $("#questionnaireLink");
    if (questionnaireLink) questionnaireLink.href = QUESTIONNAIRE_URL;

    const formAll = $("#form-all");
    const sectionAll = $("#section-all");
    const unlockBanner = $("#all-unlock");
    const stepperSection = $("#section-stepper");

    const landing = $("#landing");
    const startBtn = $("#startBtn");
    const consentEl = $("#consent");
    const consentError = $("#consentError");

    const phaseDialog = $("#phaseDialog");
    const phaseDialogText = $("#phaseDialogText");
    const phaseDialogOk = $("#phaseDialogOk");

    const alreadyAll = (() => {
      try {
        return localStorage.getItem("formAllCompleted") === "true";
      } catch {
        return false;
      }
    })();

    const alreadyStepper = (() => {
      try {
        return localStorage.getItem("formStepperCompleted") === "true";
      } catch {
        return false;
      }
    })();

    const started = (() => {
      try {
        return localStorage.getItem("experimentStarted") === "true";
      } catch {
        return false;
      }
    })();

    // Stepper logic (only attaches handlers; it initializes to Step 1).
    const stepperController = resetStepperUI();

    const showPhaseDialog = (text, onOk) => {
      if (!phaseDialog) return onOk?.();
      if (phaseDialogText) phaseDialogText.textContent = text;
      setHidden(phaseDialog, false);
      if (phaseDialogOk) {
        phaseDialogOk.onclick = () => {
          setHidden(phaseDialog, true);
          onOk?.();
        };
      }
    };

    // Initial stage selection
    if (alreadyStepper) {
      setHidden(landing, true);
      setHidden(sectionAll, true);
      setHidden(stepperSection, false);
      setHidden($("#form-stepper"), true);
      setHidden($("#stepper-done"), false);
      setHidden(phaseDialog, true);
    } else if (alreadyAll) {
      setHidden(landing, true);
      setHidden(sectionAll, true);
      setHidden(stepperSection, false);
      setHidden($("#form-stepper"), false);
      setHidden($("#stepper-done"), true);
      setHidden(phaseDialog, true);
      stepperController?.goToStep?.(0);
    } else if (started) {
      // User started Form 1 but hasn't completed it yet.
      setHidden(landing, true);
      setHidden(sectionAll, false);
      setHidden(stepperSection, true);
      setHidden(unlockBanner, true);
      setHidden(phaseDialog, true);
    } else {
      // Fresh load: show landing.
      setHidden(landing, false);
      setHidden(sectionAll, true);
      setHidden(stepperSection, true);
      setHidden(unlockBanner, true);
      setHidden(phaseDialog, true);
    }

    // Start flow
    startBtn?.addEventListener("click", () => {
      if (!consentEl?.checked) {
        if (consentError) {
          consentError.textContent = "Please check the consent box to continue.";
          setHidden(consentError, false);
        }
        return;
      }

      if (consentError) {
        consentError.textContent = "";
        setHidden(consentError, true);
      }

      showPhaseDialog(
        "You will now complete the first form (all fields at once). No data is saved anywhere; everything stays in your browser.",
        () => {
        try {
          localStorage.setItem("experimentStarted", "true");
        } catch {
          // ignore
        }

        setHidden(landing, true);
        setHidden(stepperSection, true);
        setHidden(sectionAll, false);
        setHidden(unlockBanner, true);
        }
      );
    });

    // Reset Form 1
    $("#reset-all")?.addEventListener("click", () => {
      formAll?.reset();
      setHidden(landing, false);
      setHidden(sectionAll, true);
      setHidden(stepperSection, true);
      setHidden(unlockBanner, true);
      setHidden($("#form-stepper"), false);
      setHidden($("#stepper-done"), true);
      setHidden(phaseDialog, true);
      try {
        localStorage.removeItem("experimentStarted");
        localStorage.removeItem("formAllCompleted");
        localStorage.removeItem("formStepperCompleted");
      } catch {
        // ignore
      }
      stepperController?.goToStep?.(0);
    });

    // Form 1 completion -> show stepper after confirmation
    formAll?.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!formAll.checkValidity()) {
        formAll.reportValidity();
        return;
      }

      // Clear + hide Form 1 while we confirm the next phase.
      formAll.reset();
      setHidden(unlockBanner, true);
      setHidden(sectionAll, true);
      setHidden(stepperSection, true);
      setHidden($("#form-stepper"), true);
      setHidden($("#stepper-done"), true);

      showPhaseDialog(
        "You will now complete the second format of the form using the stepper. No data is saved anywhere; everything stays in your browser.",
        () => {
        try {
          localStorage.setItem("formAllCompleted", "true");
        } catch {
          // ignore
        }

        setHidden(stepperSection, false);
        setHidden($("#form-stepper"), false);
        setHidden($("#stepper-done"), true);
        $("#form-stepper")?.reset?.();
        stepperController?.goToStep?.(0);
        }
      );
    });
  });
})();

