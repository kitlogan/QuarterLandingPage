/* The Quarter Athletics Club — waitlist capture
 * ---------------------------------------------
 * Static site, no backend. We submit the form straight to Mailchimp with a real
 * POST into a hidden <iframe>, so the visitor stays on our own styled page.
 *
 * Why not JSONP (the /subscribe/post-json trick)? Mailchimp serves that response
 * as `Content-Type: text/html` and, for errors, as TWO concatenated callback
 * calls — `cb({…})cb({…})` — which isn't valid JavaScript. Modern browsers'
 * Opaque Response Blocking (ORB) then refuse to execute it in a <script>, so the
 * callback never fires and the request silently times out. A form POST into a
 * hidden iframe is immune to that and is the reliable no-backend method.
 *
 * The one cost: the iframe response is cross-origin, so we can't READ it — we
 * can't tell "subscribed" from "already subscribed" or "invalid email". So we
 * show an optimistic confirmation once the POST round-trips. Set the opt-in flag
 * below so that confirmation copy matches your audience.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ SET-UP (Kit):                                                             │
 * │  • MAILCHIMP_ACTION — your audience's form action URL (Mailchimp →        │
 * │    Audience → Signup forms → Embedded form; copy the <form action="…">).  │
 * │    u, id and the honeypot field name are all derived from it.             │
 * │  • MAILCHIMP_DOUBLE_OPTIN — true if your audience uses double opt-in      │
 * │    (Mailchimp's default: signup lands as "pending" until they click the   │
 * │    confirmation email). false if single opt-in (subscribed immediately).  │
 * │    Audience → Settings → "Audience name & defaults" → Enable double optin.│
 * │  • The signup form must have reCAPTCHA OFF and EMAIL as the only required  │
 * │    merge field.                                                            │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
const MAILCHIMP_ACTION =
  "https://quarterathleticsclub.us8.list-manage.com/subscribe/post?u=ea4a1881a470bb99ac7b6b049&id=622803b823&f_id=00f90be0f0";
const MAILCHIMP_DOUBLE_OPTIN = false;

(function () {
  "use strict";

  var modal = document.getElementById("waitlist");
  if (!modal) return;

  var dialog = modal.querySelector(".modal__dialog");
  var form = modal.querySelector(".wl-form");
  var fname = modal.querySelector("#wl-fname");
  var lname = modal.querySelector("#wl-lname");
  var input = modal.querySelector("#wl-email"); // the email field
  var submit = modal.querySelector(".wl-submit");
  var submitLabel = modal.querySelector(".wl-submit__label");
  var msg = modal.querySelector(".wl-msg");
  var formView = modal.querySelector('[data-view="form"]');
  var successView = modal.querySelector('[data-view="success"]');
  var successTitle = modal.querySelector("[data-success-focus]");
  var successDesc = modal.querySelector("[data-success-desc]");
  var pageEl = document.querySelector(".page");
  var sink = document.querySelector('iframe[name="wl-sink"]');

  var lastTrigger = null; // element to restore focus to on close
  var submitting = false; // a POST is in flight
  var awaiting = false; // waiting for the iframe to load the POST response
  var sinkTimer = null; // fallback timer in case the iframe load never fires
  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /* ---------- point the form at Mailchimp (single source of truth) ---------- */

  var action = (MAILCHIMP_ACTION || "").trim().replace(/&amp;/gi, "&");
  var configured = action.indexOf("list-manage.com") !== -1;
  if (configured) {
    form.setAttribute("action", action);
    form.setAttribute("method", "post");
    form.setAttribute("target", "wl-sink");
    // Inject Mailchimp's anti-bot honeypot: b_<u>_<id>, which must stay empty.
    try {
      var au = new URL(action);
      var u = au.searchParams.get("u");
      var id = au.searchParams.get("id");
      if (u && id) {
        var hp = document.createElement("input");
        hp.type = "text";
        hp.tabIndex = -1;
        hp.value = "";
        hp.name = "b_" + u + "_" + id;
        hp.setAttribute("autocomplete", "off");
        hp.setAttribute("aria-hidden", "true");
        hp.style.cssText = "position:absolute;left:-5000px";
        form.appendChild(hp);
      }
    } catch (e) {
      /* malformed action URL — submission simply won't reach Mailchimp */
    }
  }

  /* ---------- open / close ---------- */

  function openModal(trigger) {
    lastTrigger = trigger || null;
    resetForm();
    modal.hidden = false;
    // Take the rest of the page out of the tab order AND the accessibility tree
    // so the dialog is truly modal for screen readers, not just for Tab.
    if (pageEl) pageEl.setAttribute("inert", "");
    document.addEventListener("keydown", onKeydown, true);
    requestAnimationFrame(function () {
      fname.focus();
    });
  }

  function closeModal() {
    if (modal.hidden) return;
    cancelPending(); // a stray iframe load shouldn't flip a closed modal to success
    modal.hidden = true;
    document.removeEventListener("keydown", onKeydown, true);
    if (pageEl) pageEl.removeAttribute("inert"); // before restoring focus into .page
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  function onKeydown(e) {
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === "Tab") trapFocus(e);
  }

  // Keep Tab focus inside the dialog while it is open.
  function trapFocus(e) {
    var nodes = Array.prototype.filter.call(
      dialog.querySelectorAll(FOCUSABLE),
      function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      }
    );
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    var active = document.activeElement;

    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------- form state ---------- */

  function cancelPending() {
    awaiting = false;
    clearTimeout(sinkTimer);
  }

  function resetForm() {
    cancelPending();
    submitting = false;
    clearInvalid();
    setMsg("", null);
    fname.value = "";
    lname.value = "";
    input.value = "";
    setSubmitting(false);
    // point the dialog's name/description back at the (visible) form view
    dialog.setAttribute("aria-labelledby", "wl-title");
    dialog.setAttribute("aria-describedby", "wl-desc");
    formView.hidden = false;
    successView.hidden = true;
  }

  function setMsg(text, kind) {
    msg.textContent = text || "";
    msg.classList.toggle("is-error", kind === "error");
    msg.classList.toggle("is-ok", kind === "ok");
  }

  // Per-field invalid state — exposed to assistive tech via aria-invalid, which
  // also drives the terracotta border in CSS (.wl-input[aria-invalid="true"]).
  function markInvalid(el) {
    el.setAttribute("aria-invalid", "true");
  }
  function clearInvalid() {
    fname.removeAttribute("aria-invalid");
    lname.removeAttribute("aria-invalid");
    input.removeAttribute("aria-invalid");
  }

  function setSubmitting(on) {
    submitting = on;
    submit.disabled = on;
    if (submitLabel) submitLabel.textContent = on ? "Joining…" : "Join the Waitlist";
  }

  function showSuccess() {
    if (MAILCHIMP_DOUBLE_OPTIN) {
      successTitle.textContent = "Almost there.";
      successDesc.textContent =
        "Check your inbox and click the link to confirm your spot on the waitlist.";
    } else {
      successTitle.textContent = "You’re on the list.";
      successDesc.textContent = "Thanks — we’ll be in touch as launch nears.";
    }
    // re-point the dialog's accessible name/description at the now-visible view
    dialog.setAttribute("aria-labelledby", "wl-success-title");
    dialog.setAttribute("aria-describedby", "wl-success-desc");
    formView.hidden = true;
    successView.hidden = false;
    requestAnimationFrame(function () {
      successTitle.focus();
    });
  }

  // Pragmatic email check — mirrors the browser's own type=email rule closely
  // enough without being punishing. Mailchimp does the authoritative check.
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /* ---------- submit ---------- */

  // Called when the POST has round-tripped (iframe load) or the fallback fires.
  function finishSubmit() {
    if (!awaiting) return;
    cancelPending();
    showSuccess();
  }

  function handleSubmit(e) {
    if (submitting) {
      e.preventDefault();
      return;
    }

    var first = fname.value.trim();
    var last = lname.value.trim();
    var email = input.value.trim();

    // Validate in field order; flag the first offender and focus it.
    clearInvalid();
    var problem = null;
    if (!first) problem = { field: fname, msg: "Please enter your first name." };
    else if (!last) problem = { field: lname, msg: "Please enter your last name." };
    else if (!isValidEmail(email))
      problem = { field: input, msg: "Please enter a valid email address." };

    if (problem) {
      e.preventDefault(); // don't POST an invalid form
      markInvalid(problem.field);
      setMsg(problem.msg, "error");
      problem.field.focus();
      return;
    }

    if (!configured) {
      e.preventDefault();
      setMsg("Waitlist isn’t connected yet — check back soon.", "error");
      return;
    }

    // Valid: submit the trimmed values, then let the browser POST natively into
    // the hidden iframe (we do NOT preventDefault here).
    fname.value = first;
    lname.value = last;
    input.value = email;

    setMsg("", null);
    setSubmitting(true);
    awaiting = true;
    // Fallback: if the iframe's load never fires (blocked, offline), resolve anyway.
    clearTimeout(sinkTimer);
    sinkTimer = setTimeout(finishSubmit, 8000);
  }

  /* ---------- wiring ---------- */

  Array.prototype.forEach.call(
    document.querySelectorAll("[data-waitlist-open]"),
    function (btn) {
      btn.addEventListener("click", function () {
        openModal(btn);
      });
    }
  );

  Array.prototype.forEach.call(
    modal.querySelectorAll("[data-waitlist-close]"),
    function (el) {
      el.addEventListener("click", closeModal);
    }
  );

  // The hidden iframe fires `load` once on page init (about:blank) — ignored
  // because `awaiting` is false — and again when the POST response comes back.
  if (sink) {
    sink.addEventListener("load", function () {
      if (awaiting) finishSubmit();
    });
  }

  form.addEventListener("submit", handleSubmit);

  // Enter-to-submit from any field. Enter on a text input triggers requestSubmit
  // (which runs handleSubmit → native POST). Enter on the submit button is left
  // to its native behaviour.
  form.addEventListener("keydown", function (e) {
    if (
      (e.key === "Enter" || e.key === "NumpadEnter") &&
      e.target &&
      e.target.tagName === "INPUT"
    ) {
      e.preventDefault();
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        // Old browsers without requestSubmit: run validation, then POST only if
        // it passed (form.submit() alone would bypass handleSubmit entirely).
        var fake = {
          defaultPrevented: false,
          preventDefault: function () {
            this.defaultPrevented = true;
          },
        };
        handleSubmit(fake);
        if (!fake.defaultPrevented) form.submit();
      }
    }
  });

  // Clear a field's invalid state as soon as the visitor starts fixing it.
  form.addEventListener("input", function (e) {
    if (e.target && e.target.getAttribute("aria-invalid")) {
      e.target.removeAttribute("aria-invalid");
      setMsg("", null);
    }
  });
})();

/* Hero photo cycle
 * ----------------
 * The single square slot (.hero-media) cycles through its .hero-photo images, one
 * at a time. Each photo prints straight into the next: the incoming photo is
 * raised above the current one and prints up from the bottom edge (a CSS clip-path
 * transition, see styles.css) OVER it. The current photo stays fully shown
 * underneath until it's covered, so the print movement is kept but the square is
 * never empty — no retract, no blank frame. Once the incoming photo has fully
 * covered the square, the outgoing one is hidden instantly behind it (no visible
 * retract) and z-indexes settle, ready for the next print. This timer only toggles
 * a class and a z-index, so there's no per-frame JS. Honours prefers-reduced-motion
 * by not cycling at all (CSS shows the first photo statically).
 */
(function () {
  "use strict";

  // --- tunable timings ---
  var PRINT = 900; // ms: how long a photo takes to print up over the previous one
  var HOLD = 2600; // ms: how long a photo stays before the next prints in over it

  var media = document.querySelector(".hero-media");
  if (!media) return;
  var photos = media.querySelectorAll(".hero-photo");
  if (photos.length < 2) return; // nothing to cycle

  // Respect reduced motion — show the first photo statically, don't cycle.
  var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mq && mq.matches) return;

  // Keep the CSS transition duration locked to PRINT (custom prop inherits down).
  media.style.setProperty("--print", PRINT + "ms");
  // Take over from the CSS "show first photo" default; now .is-in drives it.
  // Two z-index layers: the current photo sits at 1, each incoming rises to 2 to
  // print over it, then settles to 1 as the new current while the outgoing drops
  // to 0 (its retract stays hidden behind the incoming). Everything else rests at
  // 0 — all below the vignette (2) and cream clip (3), which live in a separate
  // stacking layer above the photos.
  var i = 0;
  photos[i].classList.add("is-in");
  photos[i].style.zIndex = "1";
  media.classList.add("is-cycling");

  function tick() {
    var prev = i;
    var next = (i + 1) % photos.length;
    // Raise the incoming photo above the current one and print it up over the top.
    photos[next].style.zIndex = "2";
    photos[next].classList.add("is-in");
    i = next;
    setTimeout(function () {
      // Incoming now fully covers the square. Retract the outgoing photo behind it
      // (occluded, so unseen) and settle the incoming into the current layer, ready
      // for the next photo to print above it.
      photos[prev].classList.remove("is-in");
      photos[prev].style.zIndex = "0";
      photos[next].style.zIndex = "1";
      setTimeout(tick, HOLD);
    }, PRINT);
  }

  setTimeout(tick, HOLD);
})();
