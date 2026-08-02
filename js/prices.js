/* ============================================================
   DPA — prices.js — Módulo de Precios
   ============================================================ */

'use strict';

const Prices = {

  render() {
    const settings = Storage.getSettings();
    const p = settings.prices || {};

    const indEl = document.getElementById('priceIndividualPrices');
    if (indEl) indEl.value = p.individual || 0;

    const acadEl = document.getElementById('priceAcademiaPrices');
    if (acadEl) acadEl.value = p.academia || 0;

    this._buildGrupalGrid(p.grupal || {});

    const pctInput = document.getElementById('profPercentagePrices');
    if (pctInput) pctInput.value = settings.profPercentage || 50;

    const pct = settings.profPercentage || 50;
    const profBar = document.getElementById('pctProfBarPrices');
    const clubBar = document.getElementById('pctClubBarPrices');
    if (profBar) { profBar.style.width = pct + '%'; profBar.textContent = 'Profesor ' + pct + '%'; }
    if (clubBar) { clubBar.style.width = (100 - pct) + '%'; clubBar.textContent = 'Club ' + (100 - pct) + '%'; }
  },

  _buildGrupalGrid(grupal) {
    const container = document.getElementById('grupalPricesGrid');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 2; i <= 12; i++) {
      const key = String(i);
      const div = document.createElement('div');
      div.className = 'grupal-price-item';
      div.innerHTML =
        '<label class="grupal-price-label">' + i + ' personas</label>' +
        '<div class="input-prefix">' +
          '<span class="prefix">$</span>' +
          '<input type="number" class="form-control grupal-price-input"' +
                 ' data-persons="' + key + '" value="' + (grupal[key] || 0) + '" min="0"' +
                 ' id="grupalPriceP' + key + '" />' +
        '</div>';
      container.appendChild(div);
    }
  },

  save() {
    const settings = Storage.getSettings();

    const indEl  = document.getElementById('priceIndividualPrices');
    const acadEl = document.getElementById('priceAcademiaPrices');
    const pctEl  = document.getElementById('profPercentagePrices');

    const individual = indEl  ? (Number(indEl.value)  || 0) : 0;
    const academia   = acadEl ? (Number(acadEl.value)  || 0) : 0;
    const profPct    = pctEl  ? (Number(pctEl.value)   || 50) : (settings.profPercentage || 50);

    const grupal = {};
    document.querySelectorAll('.grupal-price-input').forEach(function(inp) {
      const k = inp.dataset.persons;
      grupal[k] = Number(inp.value) || 0;
    });

    settings.prices = { individual: individual, grupal: grupal, academia: academia };
    settings.profPercentage = profPct;

    Storage.saveSettings(settings);
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Precios guardados correctamente', 'success');
    }
  },

  init() {
    const saveBtn = document.getElementById('savePricesBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() { Prices.save(); });
    }

    const pctInput = document.getElementById('profPercentagePrices');
    if (pctInput) {
      pctInput.addEventListener('input', function(e) {
        const pct = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
        const profBar = document.getElementById('pctProfBarPrices');
        const clubBar = document.getElementById('pctClubBarPrices');
        if (profBar) { profBar.style.width = pct + '%'; profBar.textContent = 'Profesor ' + pct + '%'; }
        if (clubBar) { clubBar.style.width = (100 - pct) + '%'; clubBar.textContent = 'Club ' + (100 - pct) + '%'; }
      });
    }
  },
};

window.Prices = Prices;
