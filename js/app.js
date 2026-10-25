(function () {
  "use strict";

  var TOWNS = window.TOWNS || [];
  var FLAIR = window.FLAIR || [];
  var BASE_PRICE = 90;
  var BASE_DAYS = 2;
  var EXTRA_DAY_FEE = 10;
  var MAX_DAYS = 5;
  var MAX_FLAIR = 5;   // flair pieces per sign (all included, price never changes)

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

    select.addEventListener("change", function () {
      var selected = TOWNS.filter(function (t) { return t.name === select.value; })[0];
      var hint = $("#town-fee-hint");
      if (!selected) { hint.textContent = ""; }
      else if (selected.fee) { hint.textContent = "+$" + selected.fee + " travel fee for " + selected.name + "."; }
      else if (selected.note) { hint.textContent = selected.note; }
      else { hint.textContent = "No travel fee for " + selected.name + "."; }
      clearError("town");
      updateTotal();
    });

    renderTownCopy();
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
      });
      grid.appendChild(tile);
    });
  }

  /* ============================================================
     FLAIR PICKER (Step 2)
     ============================================================ */
  function renderFlairChips() {
    var categories = [];
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
        filterFlair(label);
      });
      return chip;
    }
  }


  /* ---- Flair search: matches name + tags, case-insensitive, partial ---- */
  var flairQuery = "";
  function flairMatches(item) {
    var q = flairQuery.trim().toLowerCase();
    if (!q) return true;
    var hay = (item.name + " " + (item.tags || []).join(" ")).toLowerCase();
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
  function filterFlair(category) {
    if (category) flairCategory = category;
    var shown = 0;
    $$(".flair-card", $("#flair-grid")).forEach(function (card) {
      var item = flairById[card.dataset.id];
      var show = (flairCategory === "All" || card.dataset.category === flairCategory) && (!item || flairMatches(item));
      card.style.display = show ? "" : "none";
      if (show) shown++;
    });
    setFlairEmpty(shown === 0);
  }

  function renderFlairGrid() {
    var grid = $("#flair-grid");
    grid.innerHTML = "";
    FLAIR.forEach(function (item) {
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
      img.onerror = function () { img.remove(); };
      img.onload = function () { placeholder.hidden = true; };
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

      grid.appendChild(card);
    });
  }

  function updateFlairCount() {
    var n = selectedFlair.size;
    $("#flair-count").textContent = n + " of " + MAX_FLAIR + " picked — all included";
    var bar = $("#totalbar-flair");
    if (bar) bar.textContent = n + " of " + MAX_FLAIR + " flair";
    var grid = $("#flair-grid");
    if (grid) grid.classList.toggle("is-maxed", n >= MAX_FLAIR);
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
    var town = TOWNS.filter(function (t) { return t.name === townName; })[0];
    var travelFee = town ? (town.fee || 0) : 0;
    var extraDays = Math.max(0, days - BASE_DAYS);
    var extraDaysFee = extraDays * EXTRA_DAY_FEE;
    var total = BASE_PRICE + extraDaysFee + travelFee;
    return { days: days, town: town, travelFee: travelFee, extraDays: extraDays, extraDaysFee: extraDaysFee, total: total };
  }

  function updateTotal() {
    var price = computePrice();
    $("#total").textContent = "$" + price.total;
  }

  /* ============================================================
     VALIDATION
     ============================================================ */
  function showError(fieldId, message) {
    var err = document.getElementById("err-" + fieldId);
    var field = document.getElementById(fieldId);
    if (err) err.hidden = !message;
    if (field) field.classList.toggle("invalid", !!message);
  }
  function clearError(fieldId) { showError(fieldId, false); }

  function validateStep(step) {
    var ok = true;
    if (step === 1) {
      var date = $("#event-date");
      if (!date.value) { showError("event-date", true); ok = false; } else clearError("event-date");
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
    $("#wizard-next").style.display = step === TOTAL_STEPS ? "none" : "";
    var wbody = $(".wizard-body");
    if (wbody) wbody.classList.toggle("is-flair-step", step === 2);
    if (step !== 2) hideFlairLimit();
    if (step === TOTAL_STEPS) renderReview();
    var body = $(".wizard-body");
    if (body) body.scrollTop = 0;
  }

  function nextStep() {
    if (!validateStep(currentStep)) {
      var firstInvalid = $(".invalid");
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
  }
  function prevStep() {
    if (currentStep > 1) showStep(currentStep - 1);
  }

  /* ============================================================
     REVIEW STEP
     ============================================================ */
  function renderReview() {
    var occasion = $("#occasion").value || "—";
    var eventDate = $("#event-date").value || "—";
    var honoreeName = $("#honoree-name").value.trim();
    var age = $("#honoree-age").value;
    var honoree = honoreeName ? honoreeName + (age ? " (turning " + age + ")" : "") : "—";
    var theme = $("#theme").value.trim() || "—";
    var colors = $("#colors").value.trim() || "—";
    var address = $("#address").value.trim() || "—";
    var town = $("#town").value || "—";
    var days = $("#days").value;
    var name = $("#customer-name").value.trim() || "—";
    var mobile = $("#mobile").value.trim() || "—";
    var notes = $("#notes").value.trim();

    // Bug fix: this used Array.prototype.slice.call(selectedFlair), which always returns []
    // for a Set (a Set has no length or index properties), so Review showed "Flair (0)".
    var flairNames = pickedFlairNames();

    var rows = [
      ["Occasion", occasion],
      ["Event date", eventDate],
      ["Honoree", honoree],
      ["Theme", theme],
      ["Colors", colors],
      ["Address", address],
      ["Town", town],
      ["Days in yard", days + (days === "1" ? " day" : " days")],
      ["Your name", name],
      ["Mobile number", mobile]
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
     ORDER PAYLOAD (built for preview only; NEVER sent on this branch)
     Field names match what the order script already reads.
     ============================================================ */
  function shiftISO(iso, n) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function buildOrderPayload() {
    var price = computePrice();
    var flair = pickedFlairNames();
    var townName = $("#town").value;
    var eventDate = $("#event-date").value;
    var notes = $("#notes").value.trim();
    var pickup = shiftISO(eventDate, price.days - 1);
    return {
      customerName: "[PREVIEW] " + $("#customer-name").value.trim(),
      phone: $("#mobile").value.trim(),
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

    if (!validateStep(4)) {
      showStep(4);
      var firstInvalid = $(".invalid");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // PREVIEW ONLY: orders are disabled on this branch. Nothing is sent anywhere
    // (no fetch, no XHR, no sendBeacon, no form action) on any hostname.
    // The thank-you panel shows "Preview only: this order wasn't sent."
    var price = computePrice();
    var townName = $("#town").value;
    var eventDate = $("#event-date").value;

    var picked = pickedFlairNames();
    var payload = buildOrderPayload();
    window.LB_LAST_ORDER = payload;   // for checking only; never sent
    if (window.console && console.info) console.info("LawnBombs preview: order NOT sent.", payload);
    var summaryHtml =
      '<dl class="thanks-dl">' +
      '<div><dt>Total</dt><dd><strong>$' + price.total + '</strong></dd></div>' +
      '<div><dt>Event date</dt><dd>' + escapeHtml(eventDate) + '</dd></div>' +
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
  }

  /* ============================================================
     WIZARD OPEN / CLOSE
     ============================================================ */
  function openWizard() {
    lastFocusedEl = document.activeElement;
    $("#order-wizard").hidden = false;
    document.documentElement.style.overflow = "hidden";
    showStep(1);
    updateTotal();
    var firstTile = $(".occasion-tile");
    if (firstTile) firstTile.focus();
    if (location.hash !== "#order") history.pushState(null, "", "#order");
  }

  function closeWizard() {
    $("#order-wizard").hidden = true;
    document.documentElement.style.overflow = "";
    if (location.hash === "#order") history.pushState(null, "", location.pathname + location.search);
    if (lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus();
  }

  function resetWizard() {
    $("#order-form").reset();
    selectedFlair.clear();
    hideFlairLimit();
    $$(".flair-card").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
    $$(".occasion-tile").forEach(function (t) { t.setAttribute("aria-pressed", "false"); });
    updateFlairCount();
    $("#order-form").querySelector(".wizard-body").hidden = false;
    $("#wizard-totalbar").hidden = false;
    $("#thanks").hidden = true;
    initDaysStepper();
    updateTotal();
  }

  /* ============================================================
     LIGHTBOX
     ============================================================ */
  function initLightbox() {
    var lightbox = $("#lightbox");
    var img = $("#lightbox-img");
    $$(".polaroid img").forEach(function (el) {
      el.addEventListener("click", function () {
        img.src = el.dataset.full || el.src;
        img.alt = el.alt;
        lightbox.hidden = false;
      });
    });
    function close() { lightbox.hidden = true; img.src = ""; }
    $("#lightbox-close").addEventListener("click", close);
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lightbox.hidden) close();
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

    ["event-date", "address", "customer-name", "mobile"].forEach(function (id) {
      var field = document.getElementById(id);
      ["input", "change"].forEach(function (ev) { field.addEventListener(ev, function () { if (field.value.trim()) clearError(id); }); });
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
      if (e.key === "Escape" && !$("#order-wizard").hidden) closeWizard();
    });
    window.addEventListener("hashchange", function () {
      if (location.hash === "#order" && $("#order-wizard").hidden) openWizard();
    });
    if (location.hash === "#order") openWizard();
  });
})();
