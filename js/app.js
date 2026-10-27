(function () {
  "use strict";

  var TOWNS = window.TOWNS || [];
  var FLAIR = window.FLAIR || [];
  var BASE_PRICE = 90;
  var BASE_DAYS = 2;
  var EXTRA_DAY_FEE = 10;
  var MAX_DAYS = 5;
  var MAX_FLAIR = 5;   // flair pieces per sign (all included, price never changes)

  // Order script (Google Apps Script web app, lawnbombs-leads). Same /exec URL as the old live form.
  var SUBMIT_URL = "https://script.google.com/macros/s/AKfycbz5iW0TlUrADO5mq7DhDCYyB1bAmkLjzN8mmm73J0GSEK6RNN70KMLZXTd2-Usg0sGg/exec";
  var IS_LIVE_SITE = /(^|\.)lawnbombsfl\.com$/.test(location.hostname);
  var sending = false;

  // Picked flair ids, in the order they were picked. This Set is the single source of truth:
  // the count, Review step and order payload all read from it (never from the DOM).
  var selectedFlair = new Set();
  var currentStep = 1;
  var TOTAL_STEPS = 5;
  var lastFocusedEl = null;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ============================================================
     TOWNS — render dropdown, price notes, FAQ copy, footer
     ============================================================ */
  function renderTowns() {
    var select = $("#town");
    var opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Select your town";
    opt.disabled = true;
    opt.selected = true;
    // defaultSelected matters: form.reset() goes back to the default option. Without it, reset
    // skipped this disabled placeholder and silently picked the first town (Estero).
    opt.defaultSelected = true;
    select.appendChild(opt);

    TOWNS.forEach(function (town) {
      var o = document.createElement("option");
      o.value = town.name;
      o.dataset.fee = town.fee;
      var label = town.name;
      if (town.fee) label += " (+$" + town.fee + " travel fee)";
      if (town.comingSoon) {
        label += " — " + town.comingSoon;
        o.disabled = true;
      }
      o.textContent = label;
      select.appendChild(o);
    });

    ["change", "input"].forEach(function (ev) {
      select.addEventListener(ev, function () {
        if (select.value) clearError("town");
        syncTown();
      });
    });

    renderTownCopy();
  }

  /* One lookup for the travel fee, used by BOTH the Town hint and the total (data: js/towns.js). */
  function townByName(name) {
    return TOWNS.filter(function (t) { return t.name === name && !t.comingSoon; })[0] || null;
  }
  function travelFeeFor(name) {
    var t = townByName(name);
    return t ? (t.fee || 0) : 0;
  }
  // Recompute the hint from the CURRENT Town value (never from the last event), then the total.
  function syncTownHint() {
    var hint = $("#town-fee-hint");
    if (!hint) return;
    var t = townByName($("#town").value);
    var fee = t ? travelFeeFor(t.name) : 0;
    var text = "";
    if (t && fee) text = "+$" + fee + " travel fee for " + t.name + ".";
    else if (t && t.note) text = t.note;   // the "Other — text us" catch-all only
    hint.textContent = text;
    hint.hidden = !text;
  }
  function syncTown() {
    syncTownHint();
    updateTotal();
  }

  /* Town wording, all generated from TOWNS (js/towns.js) */
  function listJoin(names) {
    if (names.length <= 1) return names.join("");
    if (names.length === 2) return names[0] + " and " + names[1];
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  }
  function realTowns() { return TOWNS.filter(function (t) { return !t.note; }); }
  function feeGroupsText() {
    // e.g. "Lehigh Acres (+$15), Naples and Fort Myers Beach (+$20)"
    var fees = [];
    TOWNS.forEach(function (t) { if (t.fee > 0 && !t.comingSoon && fees.indexOf(t.fee) === -1) fees.push(t.fee); });
    fees.sort(function (a, b) { return a - b; });
    return fees.map(function (fee) {
      return listJoin(TOWNS.filter(function (t) { return t.fee === fee && !t.comingSoon; }).map(function (t) { return t.name; })) + " (+$" + fee + ")";
    }).join(", ");
  }
  function renderTownCopy() {
    var live = realTowns().filter(function (t) { return !t.comingSoon; });
    var soon = realTowns().filter(function (t) { return t.comingSoon; });
    var noFee = live.filter(function (t) { return !t.fee; }).map(function (t) { return t.name; });
    var feeText = feeGroupsText();
    var travel = feeText ? "No travel fee except " + feeText + "." : "No travel fee anywhere we serve.";

    var chips = $("#towns-chips");
    chips.innerHTML = "";
    realTowns().forEach(function (t) {
      var chip = document.createElement("span");
      chip.className = "town-chip" + (t.comingSoon ? " town-chip--soon" : t.fee ? " town-chip--fee" : "");
      chip.textContent = t.name + (t.comingSoon ? " — " + t.comingSoon : t.fee ? " (+$" + t.fee + ")" : "");
      chips.appendChild(chip);
    });
    $("#travel-note").textContent = travel;

    $("#faq-towns").textContent = "We serve " + listJoin(live.map(function (t) { return t.name; })) + ". " + travel +
      (soon.length ? " " + soon.map(function (t) { return t.name + " is " + t.comingSoon.charAt(0).toLowerCase() + t.comingSoon.slice(1) + "."; }).join(" ") : "") +
      " Somewhere else? Text 239-494-2377 and we'll let you know.";

    $("#hero-towns").textContent = "Serving " + listJoin(live.map(function (t) { return t.name; })) +
      (soon.length ? " · " + soon.map(function (t) { return t.name + " " + t.comingSoon.charAt(0).toLowerCase() + t.comingSoon.slice(1); }).join(" · ") : "");

    $("#footer-towns").textContent = "Serving: " + realTowns().map(function (t) {
      if (t.comingSoon) return t.name + " (" + t.comingSoon + ")";
      if (t.fee) return t.name + " (+$" + t.fee + ")";
      return t.name;
    }).join(" · ");
    var cnt = $("#flair-total-count"); if (cnt) cnt.textContent = FLAIR.length;
  }

  /* ============================================================
     OCCASION TILES (Step 1)
     ============================================================ */
  function renderOccasionTiles() {
    var select = $("#occasion");
    var grid = $("#occasion-grid");
    grid.innerHTML = "";
    $$("option", select).forEach(function (option) {
      if (!option.value) return;
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "occasion-tile";
      tile.setAttribute("aria-pressed", "false");
      tile.textContent = option.value;
      tile.addEventListener("click", function () {
        $$(".occasion-tile", grid).forEach(function (t) { t.setAttribute("aria-pressed", "false"); });
        tile.setAttribute("aria-pressed", "true");
        select.value = option.value;
        clearError("occasion");
        grid.classList.remove("invalid");
      });
      grid.appendChild(tile);
    });
  }

  /* ============================================================
     FLAIR PICKER (Step 2)
     ============================================================ */
  function renderFlairChips() {
    var categories = (window.FLAIR_GROUPS || []).filter(function (g) {
      return FLAIR.some(function (f) { return f.category === g; });
    });
    FLAIR.forEach(function (f) { if (categories.indexOf(f.category) === -1) categories.push(f.category); });
    var row = $("#flair-chips");
    row.innerHTML = "";

    var allChip = makeChip("All", true);
    row.appendChild(allChip);
    categories.forEach(function (cat) { row.appendChild(makeChip(cat, false)); });

    function makeChip(label, active) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = label;
      chip.dataset.category = label;
      chip.setAttribute("aria-pressed", active ? "true" : "false");
      chip.addEventListener("click", function () {
        $$(".chip", row).forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        if (label !== "All") setGroupOpen(label, true);
        filterFlair(label);
        var grid = $("#flair-grid");
        if (grid && label !== "All") {
          var sec = grid.querySelector('.flair-group[data-group="' + label.replace(/"/g, '\\"') + '"]');
          if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      });
      return chip;
    }
  }


  /* ---- Flair search: matches name + group, case-insensitive, partial ---- */
  var flairQuery = "";
  function flairMatches(item) {
    var q = flairQuery.trim().toLowerCase();
    if (!q) return true;
    var hay = (item.name + " " + item.category + " " + (item.tags || []).join(" ")).toLowerCase();
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }
  function setupFlairSearch(onChange) {
    var input = document.getElementById("flair-search");
    var clear = document.getElementById("flair-search-clear");
    if (!input) return;
    input.addEventListener("input", function () {
      flairQuery = input.value;
      clear.hidden = !input.value;
      onChange();
    });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });
    clear.addEventListener("click", function () {
      input.value = ""; flairQuery = ""; clear.hidden = true;
      onChange(); input.focus();
    });
  }
  function setFlairEmpty(isEmpty) {
    var el = document.getElementById("flair-empty");
    if (el) el.hidden = !isEmpty;
  }

  var flairCategory = "All";
  var flairById = {};
  FLAIR.forEach(function (f) { flairById[f.id] = f; });
  // Which group sections the customer has opened (collapsed sections keep their lazy images unloaded).
  var openGroups = {};

  function setGroupOpen(group, open) {
    openGroups[group] = !!open;
    var grid = $("#flair-grid");
    if (!grid) return;
    $$(".flair-group", grid).forEach(function (sec) {
      if (sec.dataset.group === group) applyGroupState(sec);
    });
  }
  function applyGroupState(sec) {
    var searching = !!flairQuery.trim();
    var open = searching || flairCategory !== "All" || !!openGroups[sec.dataset.group];
    var head = sec.querySelector(".flair-group__head");
    var body = sec.querySelector(".flair-grid");
    head.setAttribute("aria-expanded", open ? "true" : "false");
    body.hidden = !open;
    sec.classList.toggle("is-open", open);
  }

  function filterFlair(category) {
    if (category) flairCategory = category;
    var shown = 0;
    $$(".flair-group", $("#flair-grid")).forEach(function (sec) {
      var inGroup = flairCategory === "All" || sec.dataset.group === flairCategory;
      var groupShown = 0;
      $$(".flair-card", sec).forEach(function (card) {
        var item = flairById[card.dataset.id];
        var show = inGroup && (!item || flairMatches(item));
        card.style.display = show ? "" : "none";
        if (show) groupShown++;
      });
      sec.hidden = groupShown === 0;
      var c = sec.querySelector(".flair-group__count");
      if (c) c.textContent = groupShown;
      applyGroupState(sec);
      shown += groupShown;
    });
    setFlairEmpty(shown === 0);
  }

  function makeFlairCard(item) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "flair-card";
      card.dataset.category = item.category;
      card.dataset.id = item.id;
      card.setAttribute("aria-pressed", "false");

      var thumb = document.createElement("span");
      thumb.className = "flair-card__thumb";
      var placeholder = document.createElement("span");
      placeholder.className = "flair-card__placeholder";
      placeholder.hidden = true;   // only shown if the photo really fails to load (no flash while loading)
      var pName = document.createElement("span");
      pName.className = "flair-card__placeholder-name";
      pName.textContent = item.name;
      var pNote = document.createElement("span");
      pNote.className = "flair-card__placeholder-note";
      pNote.textContent = "Photo coming";
      placeholder.appendChild(pName);
      placeholder.appendChild(pNote);
      thumb.appendChild(placeholder);

      var img = document.createElement("img");
      img.alt = item.name + " flair";
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 320;
      img.height = 320;
      img.onerror = function () { img.remove(); placeholder.hidden = false; thumb.classList.add("is-missing"); };
      img.src = item.img;
      thumb.appendChild(img);

      var check = document.createElement("span");
      check.className = "flair-card__check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";

      var name = document.createElement("span");
      name.className = "flair-card__name";
      name.textContent = item.name;

      card.appendChild(thumb);
      card.appendChild(check);
      card.appendChild(name);

      card.addEventListener("click", function () {
        if (selectedFlair.has(item.id)) {
          selectedFlair.delete(item.id);
          hideFlairLimit();
        } else if (selectedFlair.size >= MAX_FLAIR) {
          showFlairLimit(card);   // gentle block: don't select a 6th piece
          return;
        } else {
          selectedFlair.add(item.id);
        }
        card.setAttribute("aria-pressed", selectedFlair.has(item.id) ? "true" : "false");
        updateFlairCount();
      });
      return card;
  }

  function renderFlairGrid() {
    var grid = $("#flair-grid");
    grid.innerHTML = "";
    var groups = (window.FLAIR_GROUPS || []).slice();
    FLAIR.forEach(function (f) { if (groups.indexOf(f.category) === -1) groups.push(f.category); });
    var first = true;
    groups.forEach(function (group, gi) {
      var items = FLAIR.filter(function (f) { return f.category === group; });
      if (!items.length) return;
      var sec = document.createElement("section");
      sec.className = "flair-group";
      sec.dataset.group = group;

      var head = document.createElement("button");
      head.type = "button";
      head.className = "flair-group__head";
      head.id = "flair-group-head-" + gi;
      head.setAttribute("aria-controls", "flair-group-body-" + gi);
      head.innerHTML = '<span class="flair-group__name"></span><span class="flair-group__count"></span><span class="flair-group__chev" aria-hidden="true">▾</span>';
      head.querySelector(".flair-group__name").textContent = group;
      head.querySelector(".flair-group__count").textContent = items.length;
      head.addEventListener("click", function () {
        if (flairQuery.trim() || flairCategory !== "All") return;   // all matches stay open while filtering
        setGroupOpen(group, !openGroups[group]);
      });

      var body = document.createElement("div");
      body.className = "flair-grid";
      body.id = "flair-group-body-" + gi;
      body.setAttribute("role", "group");
      body.setAttribute("aria-labelledby", head.id);
      items.forEach(function (item) { body.appendChild(makeFlairCard(item)); });

      sec.appendChild(head);
      sec.appendChild(body);
      grid.appendChild(sec);
      if (first) { openGroups[group] = true; first = false; }   // first group starts open
      applyGroupState(sec);
    });
    var more = document.getElementById("flair-more-note");
    if (more && window.FLAIR_MORE_NOTE) {
      more.textContent = window.FLAIR_MORE_NOTE + " ";
      var a = document.createElement("a");
      a.href = "sms:+12394942377";
      a.textContent = "Text 239-494-2377";
      more.appendChild(a);
    }
  }

  function updateFlairCount() {
    var n = selectedFlair.size;
    $("#flair-count").textContent = n + " of " + MAX_FLAIR + " picked — all included";
    var bar = $("#totalbar-flair");
    if (bar) bar.textContent = n + " of " + MAX_FLAIR + " flair";
    var grid = $("#flair-grid");
    if (grid) grid.classList.toggle("is-maxed", n >= MAX_FLAIR);
    $$(".flair-grid", grid || document).forEach(function (g) { g.classList.toggle("is-maxed", n >= MAX_FLAIR); });
  }

  var flairLimitTimer = null;
  function showFlairLimit(card) {
    var msg = $("#flair-limit-msg");
    if (!msg) return;
    msg.hidden = false;
    clearTimeout(flairLimitTimer);
    flairLimitTimer = setTimeout(hideFlairLimit, 4000);
    if (card) {
      card.classList.remove("is-nope");
      void card.offsetWidth;   // restart the nudge animation
      card.classList.add("is-nope");
    }
  }
  function hideFlairLimit() {
    clearTimeout(flairLimitTimer);
    var msg = $("#flair-limit-msg");
    if (msg) msg.hidden = true;
  }

  // Names of the picked flair, in pick order (read from the Set, not the DOM).
  function pickedFlairNames() {
    return Array.from(selectedFlair).map(function (id) {
      var item = flairById[id];
      return item ? item.name : id;
    });
  }

  /* ============================================================
     DAYS STEPPER (Step 4)
     ============================================================ */
  function initDaysStepper() {
    var select = $("#days");
    var display = $("#days-display");
    var minus = $("#days-minus");
    var plus = $("#days-plus");

    function render() {
      var n = parseInt(select.value, 10);
      display.textContent = n + (n === 1 ? " day" : " days");
      minus.disabled = n <= BASE_DAYS;
      plus.disabled = n >= MAX_DAYS;
    }

    minus.addEventListener("click", function () {
      var n = Math.max(BASE_DAYS, parseInt(select.value, 10) - 1);
      select.value = n;
      render();
      updateTotal();
    });
    plus.addEventListener("click", function () {
      var n = Math.min(MAX_DAYS, parseInt(select.value, 10) + 1);
      select.value = n;
      render();
      updateTotal();
    });

    render();
  }

  /* ============================================================
     PRICE TOTAL
     ============================================================ */
  function computePrice() {
    var days = parseInt($("#days").value, 10) || BASE_DAYS;
    var townName = $("#town").value;
    var town = townByName(townName);
    var travelFee = travelFeeFor(townName);
    var extraDays = Math.max(0, days - BASE_DAYS);
    var extraDaysFee = extraDays * EXTRA_DAY_FEE;
    var total = BASE_PRICE + extraDaysFee + travelFee;
    return { days: days, town: town, travelFee: travelFee, extraDays: extraDays, extraDaysFee: extraDaysFee, total: total };
  }

  function updateTotal() {
    var price = computePrice();
    $("#total").textContent = "$" + price.total;   // #total is aria-live, so screen readers hear the new total
  }

  /* ============================================================
     VALIDATION
     ============================================================ */
  // message: false/empty hides the error; true shows the default text; a string replaces the text.
  var defaultErrors = {};
  function showError(fieldId, message) {
    var err = document.getElementById("err-" + fieldId);
    var field = document.getElementById(fieldId);
    if (err) {
      if (!(fieldId in defaultErrors)) defaultErrors[fieldId] = err.textContent;
      err.textContent = typeof message === "string" ? message : defaultErrors[fieldId];
      err.hidden = !message;
    }
    if (field) {
      field.classList.toggle("invalid", !!message);
      if (field.tagName !== "SELECT" || field.id === "town") field.setAttribute("aria-invalid", message ? "true" : "false");
    }
  }

  /* Dates: everything is local time. Earliest event date is tomorrow (setup is the night before). */
  function toISO(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function tomorrowISO() {
    var t = new Date();
    return toISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1));
  }
  function setMinDate() {
    var input = $("#event-date");
    if (input) input.min = tomorrowISO();
  }
  function niceDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return iso || "—";
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  /* US mobile: 10 digits (a leading 1 is OK). Accepts (239) 555-0100, 239-555-0100, 239.555.0100, +1 239 555 0100. */
  function phoneDigits(raw) {
    var d = String(raw || "").replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    return d;
  }
  function isValidUSMobile(raw) {
    return /^[2-9]\d{2}[2-9]\d{6}$/.test(phoneDigits(raw));
  }
  function formatPhone(raw) {
    var d = phoneDigits(raw);
    return d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : String(raw || "").trim();
  }
  function clearError(fieldId) { showError(fieldId, false); }

  function validateStep(step) {
    var ok = true;
    if (step === 1) {
      if (!$("#occasion").value) {
        showError("occasion", true); $("#occasion-grid").classList.add("invalid"); ok = false;
      } else { clearError("occasion"); $("#occasion-grid").classList.remove("invalid"); }
      var date = $("#event-date");
      setMinDate();
      if (!date.value) { showError("event-date", true); ok = false; }
      else if (date.value < tomorrowISO()) {
        showError("event-date", "That date is too soon. The earliest is tomorrow, " + niceDate(tomorrowISO()) + ".");
        ok = false;
      } else clearError("event-date");
    }
    if (step === 4) {
      [
        ["address", $("#address").value.trim()],
        ["town", $("#town").value],
        ["customer-name", $("#customer-name").value.trim()],
        ["mobile", $("#mobile").value.trim()]
      ].forEach(function (pair) {
        if (!pair[1]) { showError(pair[0], true); ok = false; } else clearError(pair[0]);
      });
      var mobile = $("#mobile").value.trim();
      if (mobile && !isValidUSMobile(mobile)) {
        showError("mobile", "That number doesn't look right. Please use a 10-digit US mobile number, like (239) 555-0100.");
        ok = false;
      }
    }
    return ok;
  }

  /* ============================================================
     WIZARD STEP NAVIGATION
     ============================================================ */
  var STEP_TITLES = {
    1: "Occasion & date",
    2: "Flair",
    3: "Style",
    4: "Where & when",
    5: "Review"
  };

  function showStep(step) {
    currentStep = step;
    $$(".wizard-step").forEach(function (section) {
      section.hidden = parseInt(section.dataset.step, 10) !== step;
    });
    $("#wizard-progress-fill").style.width = (step / TOTAL_STEPS * 100) + "%";
    $("#wizard-step-title").textContent = "Step " + step + " of " + TOTAL_STEPS + " — " + STEP_TITLES[step];
    $("#wizard-back").disabled = step === 1;
    $("#wizard-next").hidden = step === TOTAL_STEPS;
    $("#submit-order").hidden = step !== TOTAL_STEPS;   // "Send my order" lives in the sticky bar on Step 5
    var wbody = $(".wizard-body");
    if (wbody) wbody.classList.toggle("is-flair-step", step === 2);
    if (step !== 2) hideFlairLimit();
    if (step === 4) syncTown();   // entering Step 4 (also when coming Back to it)
    if (step === TOTAL_STEPS) renderReview();
    var body = $(".wizard-body");
    if (body) body.scrollTop = 0;
    var live = $("#wizard-live");
    if (live) live.textContent = "Step " + step + " of " + TOTAL_STEPS + ": " + STEP_TITLES[step] + ". Total $" + computePrice().total + ".";
  }

  function nextStep() {
    if (!validateStep(currentStep)) {
      focusFirstInvalid();
      return;
    }
    if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
  }
  function focusFirstInvalid() {
    var first = $(".wizard .invalid");
    if (!first) return;
    if (first.id === "occasion-grid") first = $(".occasion-tile", first);
    if (first && first.focus) first.focus();
  }
  function prevStep() {
    if (currentStep > 1) showStep(currentStep - 1);
  }

  /* ============================================================
     REVIEW STEP
     ============================================================ */
  function renderReview() {
    var occasion = $("#occasion").value || "—";
    var eventISO = $("#event-date").value;
    var dates = yardDates(eventISO, computePrice().days);
    var honoreeName = $("#honoree-name").value.trim();
    var age = $("#honoree-age").value;
    var honoree = honoreeName ? honoreeName + (age ? " (turning " + age + ")" : "") : "—";
    var theme = $("#theme").value.trim() || "—";
    var colors = $("#colors").value.trim() || "—";
    var address = $("#address").value.trim() || "—";
    var town = $("#town").value || "—";
    var days = $("#days").value;
    var name = $("#customer-name").value.trim() || "—";
    var mobile = formatPhone($("#mobile").value) || "—";
    var notes = $("#notes").value.trim();
    var heard = $("#heard-from").value || "—";

    // Bug fix: this used Array.prototype.slice.call(selectedFlair), which always returns []
    // for a Set (a Set has no length or index properties), so Review showed "Flair (0)".
    var flairNames = pickedFlairNames();

    var rows = [
      ["Occasion", occasion],
      ["Event date", niceDate(eventISO)],
      ["Sign goes up", dates.setup ? niceDate(dates.setup) + ", the night before" : "—"],
      ["Pickup", dates.pickup ? "After " + niceDate(dates.pickup) + " (end of day " + days + ")" : "—"],
      ["Honoree", honoree],
      ["Theme", theme],
      ["Colors", colors],
      ["Address", address],
      ["Town", town],
      ["Days in yard", days + (days === "1" ? " day" : " days")],
      ["Your name", name],
      ["Mobile number", mobile],
      ["Heard about us", heard]
    ];
    if (notes) rows.push(["Notes", notes]);

    var html = rows.map(function (r) {
      return '<div class="review-row"><dt>' + r[0] + "</dt><dd>" + escapeHtml(r[1]) + "</dd></div>";
    }).join("");
    html += '<div class="review-row review-row--flair"><dt>Flair (' + flairNames.length + ')</dt><dd>' +
      (flairNames.length ? escapeHtml(flairNames.join(", ")) : "None picked — that's OK, all is optional") + "</dd></div>";
    $("#review-summary").innerHTML = html;

    var price = computePrice();
    var breakdown = '<h3>Price breakdown</h3>' +
      '<div class="breakdown-row"><span>Base (' + BASE_DAYS + ' days, all flair included)</span><span>$' + BASE_PRICE + '</span></div>';
    if (price.extraDays > 0) {
      breakdown += '<div class="breakdown-row"><span>Extra days (' + price.extraDays + ' × $' + EXTRA_DAY_FEE + ')</span><span>$' + price.extraDaysFee + '</span></div>';
    }
    if (price.travelFee > 0) {
      breakdown += '<div class="breakdown-row"><span>Travel fee (' + town + ')</span><span>$' + price.travelFee + '</span></div>';
    }
    breakdown += '<div class="breakdown-row total"><span>Total</span><span>$' + price.total + '</span></div>';
    $("#review-breakdown").innerHTML = breakdown;
  }

  /* ============================================================
     ORDER PAYLOAD: field names match what the order script (lawnbombs-leads-v4.gs) reads.
     ============================================================ */
  function shiftISO(iso, n) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  /* Yard days: the sign goes up the NIGHT BEFORE the event (that evening is free, not counted).
     Day 1 = the event day, so "2 days" = event day + the next day, and we pick it up after the last day.
     e.g. event Sat Nov 14, 2 days: up Fri Nov 13 night, in the yard Sat + Sun, pickup after Sun Nov 15. */
  function yardDates(eventISO, days) {
    return { setup: shiftISO(eventISO, -1), pickup: shiftISO(eventISO, days - 1) };
  }
  function buildOrderPayload() {
    var price = computePrice();
    var flair = pickedFlairNames();
    var townName = $("#town").value;
    var eventDate = $("#event-date").value;
    var notes = $("#notes").value.trim();
    var pickup = yardDates(eventDate, price.days).pickup;
    return {
      // Same rule as the old live form: orders from anywhere but the real site are marked [TEST].
      customerName: (IS_LIVE_SITE ? "" : "[TEST] ") + $("#customer-name").value.trim(),
      phone: formatPhone($("#mobile").value),
      email: "",
      celebrationType: $("#occasion").value,
      signName: $("#honoree-name").value.trim(),
      age: $("#honoree-age").value.trim(),
      celebrationDate: eventDate,
      address: $("#address").value.trim(),
      colors: $("#colors").value.trim(),
      theme: $("#theme").value.trim(),
      price: price.total,
      yardDays: price.days,
      extraDays: price.extraDays,
      total: price.total,
      pickupDate: pickup,
      setupDate: shiftISO(eventDate, -1),
      flair: flair.join(", "),
      customerNotes: notes,
      notes: "Town: " + townName + " | Travel: $" + price.travelFee + " | " +
             (flair.length ? "Flair: " + flair.join(", ") + " | " : "") +
             "Yard time: " + price.days + " days | Total: $" + price.total +
             (notes ? "\n" + notes : ""),
      heardFrom: $("#heard-from").value || "",
      website: ($("#lb-hp") || {}).value || "",   // honeypot (bots fill it; the script then saves nothing)
      pageUrl: location.href,
      submittedAtLocal: new Date().toString(),
      town: townName,
      travelFee: price.travelFee
    };
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ============================================================
     SUBMIT / THANK YOU
     ============================================================ */
  function handleSubmit(event) {
    event.preventDefault();
    if (currentStep !== TOTAL_STEPS) { nextStep(); return; }

    if (!validateStep(1)) { showStep(1); focusFirstInvalid(); return; }
    if (!validateStep(4)) { showStep(4); focusFirstInvalid(); return; }

    if (sending) return;
    var price = computePrice();
    var townName = $("#town").value;
    var eventDate = $("#event-date").value;

    var picked = pickedFlairNames();
    var payload = buildOrderPayload();
    var btn = $("#submit-order"), err = $("#submit-error");
    err.hidden = true;
    sending = true;
    btn.disabled = true;
    btn.textContent = "Sending…";
    // Same request as the old live form: text/plain + no-cors, so the browser skips the CORS
    // preflight that Apps Script can't answer. The script parses the body as JSON.
    // no-cors means the reply can't be read: success = the request reached Google.
    fetch(SUBMIT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function () {
      sending = false;
      btn.disabled = false;
      btn.textContent = "Send my order";
      showThanks(price, townName, eventDate, picked);
    }).catch(function () {
      sending = false;
      btn.disabled = false;
      btn.textContent = "Try again";
      err.hidden = false;
      err.scrollIntoView({ block: "nearest" });
    });
  }

  function showThanks(price, townName, eventDate, picked) {
    var summaryHtml =
      '<dl class="thanks-dl">' +
      '<div><dt>Total</dt><dd><strong>$' + price.total + '</strong></dd></div>' +
      '<div><dt>Event date</dt><dd>' + escapeHtml(niceDate(eventDate)) + '</dd></div>' +
      '<div><dt>Town</dt><dd>' + escapeHtml(townName) + '</dd></div>' +
      '<div><dt>Days in yard</dt><dd>' + escapeHtml(price.days + " days") + '</dd></div>' +
      '</dl>' +
      '<h3 class="thanks-flair-title">Flair picked (' + picked.length + ')</h3>' +
      (picked.length
        ? '<ul class="thanks-flair">' + picked.map(function (n) { return '<li>' + escapeHtml(n) + '</li>'; }).join("") + '</ul>'
        : '<p>No flair picked — that\'s OK, text us if you change your mind.</p>');
    $("#thanks-summary").innerHTML = summaryHtml;

    $("#order-form").querySelector(".wizard-body").hidden = true;
    $("#wizard-totalbar").hidden = true;
    $("#thanks").hidden = false;
    var title = $("#thanks-title");
    if (title) { title.setAttribute("tabindex", "-1"); title.focus(); }
  }

  /* ============================================================
     WIZARD OPEN / CLOSE
     ============================================================ */
  /* Focus trap: while a dialog is open, the rest of the page is inert and Tab cycles inside it. */
  function setBackgroundInert(dialog, on) {
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === dialog || el.tagName === "SCRIPT") return;
      if (on) { el.setAttribute("inert", ""); el.setAttribute("aria-hidden", "true"); }
      else { el.removeAttribute("inert"); el.removeAttribute("aria-hidden"); }
    });
  }
  function focusables(root) {
    return $$('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])', root).filter(function (el) {
      return !el.disabled && el.tabIndex !== -1 && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    });
  }
  function trapTab(e, root) {
    if (e.key !== "Tab") return;
    var list = focusables(root);
    if (!list.length) { e.preventDefault(); return; }
    var first = list[0], last = list[list.length - 1];
    var inside = root.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
  }

  function openWizard() {
    lastFocusedEl = document.activeElement;
    $("#order-wizard").hidden = false;
    setBackgroundInert($("#order-wizard"), true);
    setMinDate();
    document.documentElement.style.overflow = "hidden";
    showStep(1);
    syncTown();
    var firstTile = $(".occasion-tile");
    if (firstTile) firstTile.focus();
    if (location.hash !== "#order") history.pushState(null, "", "#order");
  }

  function closeWizard() {
    $("#order-wizard").hidden = true;
    setBackgroundInert($("#order-wizard"), false);
    document.documentElement.style.overflow = "";
    if (location.hash === "#order") history.pushState(null, "", location.pathname + location.search);
    if (lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus();
  }

  function resetWizard() {
    $("#order-form").reset();
    $("#submit-error").hidden = true;
    $("#submit-order").disabled = false;
    $("#submit-order").textContent = "Send my order";
    selectedFlair.clear();
    hideFlairLimit();
    $$(".flair-card").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    $$(".occasion-tile").forEach(function (t) { t.setAttribute("aria-pressed", "false"); });
    ["occasion", "event-date", "address", "town", "customer-name", "mobile"].forEach(clearError);
    $("#occasion-grid").classList.remove("invalid");
    updateFlairCount();
    $("#order-form").querySelector(".wizard-body").hidden = false;
    $("#wizard-totalbar").hidden = false;
    $("#thanks").hidden = true;
    initDaysStepper();
    syncTown();
  }

  /* ============================================================
     LIGHTBOX
     ============================================================ */
  function initLightbox() {
    var lightbox = $("#lightbox");
    var img = $("#lightbox-img");
    var opener = null;
    function open(el) {
      opener = el;
      img.src = el.dataset.full || el.src;
      img.alt = el.alt;
      lightbox.hidden = false;
      setBackgroundInert(lightbox, true);
      $("#lightbox-close").focus();
    }
    $$(".polaroid img").forEach(function (el) {
      // Keyboard: each photo is a focusable button (Enter or Space opens it)
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", "View larger photo: " + el.alt);
      el.addEventListener("click", function () { open(el); });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(el); }
      });
    });
    function close() {
      if (lightbox.hidden) return;
      lightbox.hidden = true; img.src = "";
      setBackgroundInert(lightbox, false);
      if (opener) opener.focus();
    }
    $("#lightbox-close").addEventListener("click", close);
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) close(); });
    document.addEventListener("keydown", function (e) {
      if (lightbox.hidden) return;
      if (e.key === "Escape") close();
      else trapTab(e, lightbox);
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  document.addEventListener("DOMContentLoaded", function () {
    renderTowns();
    renderOccasionTiles();
    renderFlairChips();
    renderFlairGrid();
    setupFlairSearch(function () { filterFlair(); });
    initDaysStepper();
    updateFlairCount();
    updateTotal();
    initLightbox();
    setMinDate();
    syncTown();   // on load
    // Browser form restore (back/forward cache, restored tabs) and autofill can change the Town
    // value without a change event, so re-sync at those moments too.
    window.addEventListener("pageshow", syncTown);
    window.addEventListener("load", syncTown);
    $("#order-form").addEventListener("reset", function () { setTimeout(syncTown, 0); });
    $("#town").addEventListener("focus", syncTownHint);
    $("#town").addEventListener("blur", syncTownHint);

    ["event-date", "address", "customer-name", "mobile"].forEach(function (id) {
      var field = document.getElementById(id);
      ["input", "change"].forEach(function (ev) { field.addEventListener(ev, function () { if (field.value.trim()) clearError(id); }); });
    });
    $("#mobile").addEventListener("blur", function () {
      var m = $("#mobile");
      if (isValidUSMobile(m.value)) m.value = formatPhone(m.value);
    });

    $$("[data-open-wizard]").forEach(function (btn) {
      btn.addEventListener("click", openWizard);
    });
    $("#wizard-close").addEventListener("click", closeWizard);
    $("#wizard-next").addEventListener("click", nextStep);
    $("#wizard-back").addEventListener("click", prevStep);
    $("#order-form").addEventListener("submit", handleSubmit);
    $("#thanks-close").addEventListener("click", function () {
      closeWizard();
      resetWizard();
    });

    document.addEventListener("keydown", function (e) {
      var wiz = $("#order-wizard");
      if (wiz.hidden) return;
      if (e.key === "Escape") closeWizard();
      else trapTab(e, wiz);
    });
    window.addEventListener("hashchange", function () {
      if (location.hash === "#order" && $("#order-wizard").hidden) openWizard();
    });
    if (location.hash === "#order") openWizard();
  });
})();
