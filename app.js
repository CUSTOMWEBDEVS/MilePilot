import { api, syncQueue, getQueueCount } from "./api.js";
import { $, $$, mountIcons, today, formatNumber, formatCurrency, formatDate, escapeHtml, debounce } from "./utils.js";

const state = {
  vehicles: [],
  mileageLogs: [],
  fuelLogs: [],
  maintenanceLogs: [],
  activeView: location.hash.replace("#", "") || "dashboard"
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  mountIcons();
  setupTheme();
  setupNavigation();
  setupModals();
  setupForms();
  setupNearbySearch();
  setupConnectionEvents();
  setupServiceWorker();
  setDefaultDates();

  try {
    await refreshData();
    await updateConnectionStatus();
  } catch (error) {
    toast(error.message || "Unable to load app data.", "error");
  }
}

async function refreshData() {
  const data = await api.bootstrap();
  state.vehicles = data.vehicles || [];
  state.mileageLogs = data.mileageLogs || [];
  state.fuelLogs = data.fuelLogs || [];
  state.maintenanceLogs = data.maintenanceLogs || [];
  populateVehicleSelects();
  renderAll();
}

function renderAll() {
  renderStats();
  renderVehicles();
  renderDashboardVehicles();
  renderServiceAlerts();
  renderActivity();
  renderFuelTable();
  renderMaintenanceTable();
}

function setupTheme() {
  const saved = localStorage.getItem("milepilot-theme");
  const preferred = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = saved || preferred;
  updateThemeIcon();

  $("#themeButton").addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("milepilot-theme", document.documentElement.dataset.theme);
    updateThemeIcon();
  });
}

function updateThemeIcon() {
  $("#themeButton span").dataset.icon = document.documentElement.dataset.theme === "dark" ? "sun" : "moon";
  mountIcons($("#themeButton"));
}

function setupNavigation() {
  $$("[data-view]").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    showView(link.dataset.view);
  }));

  $$("[data-view-link]").forEach(button => button.addEventListener("click", () => showView(button.dataset.viewLink)));

  window.addEventListener("hashchange", () => showView(location.hash.replace("#", "") || "dashboard", false));
  showView(state.activeView, false);
}

function showView(name, updateHash = true) {
  state.activeView = name;
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `${name}View`));
  $$("[data-view]").forEach(link => link.classList.toggle("active", link.dataset.view === name));
  if (updateHash) history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupModals() {
  $$("[data-open-modal]").forEach(button => {
    button.addEventListener("click", () => {
      const sourceDialog = button.closest("dialog");
      if (sourceDialog?.open) sourceDialog.close();
      openModal(button.dataset.openModal);
    });
  });

  $$("[data-close-modal]").forEach(button => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });

  $$(".modal").forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
  });
}

function openModal(id) {
  if (!activeVehicles().length && ["mileageModal", "fuelModal", "maintenanceModal"].includes(id)) {
    toast("Add a vehicle first.", "error");
    document.getElementById("vehicleModal").showModal();
    return;
  }
  document.getElementById(id)?.showModal();
}

function setupForms() {
  $("#vehicleForm").addEventListener("submit", handleVehicleSubmit);
  $("#mileageForm").addEventListener("submit", handleMileageSubmit);
  $("#fuelForm").addEventListener("submit", handleFuelSubmit);
  $("#maintenanceForm").addEventListener("submit", handleMaintenanceSubmit);
  $("#vehicleSearch").addEventListener("input", debounce(renderVehicles));
  $("#showArchived").addEventListener("change", renderVehicles);
  $("#syncButton").addEventListener("click", handleSync);
}

async function handleVehicleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const raw = Object.fromEntries(new FormData(form));
  const vehicle = {
    id: raw.id || undefined,
    year: Number(raw.year),
    make: raw.make.trim(),
    model: raw.model.trim(),
    trim: raw.trim.trim(),
    nickname: raw.nickname.trim(),
    color: raw.color.trim(),
    currentMileage: Number(raw.currentMileage),
    lastOilMileage: raw.lastOilMileage === "" ? undefined : Number(raw.lastOilMileage),
    currentOilLifePercent: raw.currentOilLifePercent === "" ? undefined : Number(raw.currentOilLifePercent),
    oilLifeReadingMileage: raw.currentOilLifePercent === "" ? undefined : Number(raw.currentMileage),
    oilInterval: Number(raw.oilInterval),
    warningThreshold: Number(raw.warningThreshold)
  };
  const result = await api.saveVehicle(vehicle);
  form.closest("dialog").close();
  form.reset();
  form.elements.oilInterval.value = 5000;
  form.elements.warningThreshold.value = 500;
  $("#vehicleModalTitle").textContent = "Add vehicle";
  await refreshData();
  await updateConnectionStatus();
  toast(result.queued ? "Vehicle saved offline and queued." : "Vehicle saved.", "success");
}

async function handleMileageSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const raw = Object.fromEntries(new FormData(form));
  const result = await api.addMileage({
    vehicleId: raw.vehicleId,
    mileage: Number(raw.mileage),
    date: raw.date,
    note: raw.note.trim()
  });
  form.closest("dialog").close();
  form.reset();
  setDefaultDates();
  await refreshData();
  await updateConnectionStatus();
  toast(result.queued ? "Mileage queued for sync." : "Mileage updated.", "success");
}

async function handleFuelSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const raw = Object.fromEntries(new FormData(form));
  const result = await api.addFuel({
    vehicleId: raw.vehicleId,
    date: raw.date,
    mileage: Number(raw.mileage),
    gallons: Number(raw.gallons),
    pricePerGallon: Number(raw.pricePerGallon),
    fullTank: form.elements.fullTank.checked,
    station: raw.station.trim()
  });
  form.closest("dialog").close();
  form.reset();
  form.elements.fullTank.checked = true;
  setDefaultDates();
  await refreshData();
  await updateConnectionStatus();
  toast(result.queued ? "Fuel stop queued for sync." : "Fuel stop saved.", "success");
}

async function handleMaintenanceSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const raw = Object.fromEntries(new FormData(form));
  const result = await api.addMaintenance({
    vehicleId: raw.vehicleId,
    serviceType: raw.serviceType,
    date: raw.date,
    mileage: Number(raw.mileage),
    cost: Number(raw.cost || 0),
    shop: raw.shop.trim(),
    notes: raw.notes.trim()
  });
  form.closest("dialog").close();
  form.reset();
  setDefaultDates();
  await refreshData();
  await updateConnectionStatus();
  toast(result.queued ? "Service record queued for sync." : "Service record saved.", "success");
}

function populateVehicleSelects() {
  const options = activeVehicles().map(vehicle =>
    `<option value="${vehicle.id}">${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</option>`
  ).join("");

  $$("#mileageForm select, #fuelForm select, #maintenanceForm select").forEach(select => {
    const current = select.value;
    select.innerHTML = options || `<option value="">No active vehicles</option>`;
    if ([...select.options].some(option => option.value === current)) select.value = current;
  });
}

function activeVehicles() {
  return state.vehicles.filter(vehicle => !toBoolean(vehicle.archived));
}

function getVehicle(id) {
  return state.vehicles.find(vehicle => vehicle.id === id);
}

function oilStatus(vehicle) {
  const current = Number(vehicle.currentMileage || 0);
  const hasStoredLast = vehicle.lastOilMileage !== undefined && vehicle.lastOilMileage !== null && vehicle.lastOilMileage !== "";
  const last = hasStoredLast ? Number(vehicle.lastOilMileage) : current;
  const interval = Math.max(1, Number(vehicle.oilInterval || 5000));
  const warning = Math.max(0, Number(vehicle.warningThreshold || 500));
  const milesSinceChange = Math.max(0, current - last);

  const sensorPercentRaw = Number(vehicle.currentOilLifePercent);
  const readingMileageRaw = Number(vehicle.oilLifeReadingMileage);
  const hasSensorReading = Number.isFinite(sensorPercentRaw) && sensorPercentRaw >= 0 && sensorPercentRaw <= 100;
  const readingMileage = Number.isFinite(readingMileageRaw) && readingMileageRaw >= last ? readingMileageRaw : current;

  let due;
  let predictionSource = "interval";
  if (hasSensorReading && sensorPercentRaw < 100) {
    const drivenAtReading = Math.max(0, readingMileage - last);
    const usedFraction = Math.max(0.01, (100 - sensorPercentRaw) / 100);
    const sensorEstimatedLife = drivenAtReading > 0 ? drivenAtReading / usedFraction : interval;
    const boundedLife = Math.min(interval * 2, Math.max(interval * 0.35, sensorEstimatedLife));
    due = Math.round(last + boundedLife);
    predictionSource = "oil-life reading";
  } else {
    due = Math.round(last + interval);
  }

  const remaining = due - current;
  const predictedLife = Math.max(1, due - last);
  const percentRemaining = Math.min(100, Math.max(0, (remaining / predictedLife) * 100));
  const percentUsed = 100 - percentRemaining;
  let level = "good";
  if (remaining <= 0) level = "danger";
  else if (remaining <= warning) level = "warning";
  return { current, last, interval, warning, due, remaining, milesSinceChange, percentUsed, percentRemaining, level, predictionSource };
}

function renderStats() {
  const vehicles = activeVehicles();
  const totalMiles = vehicles.reduce((sum, item) => sum + Number(item.currentMileage || 0), 0);
  const validMpg = state.fuelLogs.map(item => Number(item.mpg)).filter(value => Number.isFinite(value) && value > 0);
  const avgMpg = validMpg.length ? validMpg.reduce((a, b) => a + b, 0) / validMpg.length : null;
  const spend = state.maintenanceLogs.reduce((sum, item) => sum + Number(item.cost || 0), 0);

  $("#statVehicles").textContent = formatNumber(vehicles.length);
  $("#statMiles").textContent = formatNumber(totalMiles);
  $("#statMpg").textContent = avgMpg ? avgMpg.toFixed(1) : "--";
  $("#statSpend").textContent = formatCurrency(spend);

  const healthScores = vehicles.map(vehicle => {
    const status = oilStatus(vehicle);
    if (status.level === "danger") return 25;
    if (status.level === "warning") return 65;
    return 100;
  });
  const health = healthScores.length ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) : 0;
  $("#garageHealth").textContent = healthScores.length ? `${health}%` : "--";
  $("#garageHealthBar").style.width = `${health}%`;
  $("#garageHealthText").textContent = healthScores.length
    ? health >= 90 ? "Your garage is in excellent shape." : health >= 65 ? "One or more vehicles need attention soon." : "Service is overdue."
    : "Add your first vehicle to begin.";
}

function renderDashboardVehicles() {
  const vehicles = activeVehicles().slice(0, 3);
  $("#dashboardVehicles").innerHTML = vehicles.length
    ? vehicles.map(vehicleCard).join("")
    : emptyState("No vehicles yet. Add your first vehicle to start tracking.");
  bindVehicleActions($("#dashboardVehicles"));
}

function renderVehicles() {
  const search = $("#vehicleSearch").value.trim().toLowerCase();
  const showArchived = $("#showArchived").checked;
  const vehicles = state.vehicles.filter(vehicle => {
    if (!showArchived && toBoolean(vehicle.archived)) return false;
    return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.nickname || ""}`.toLowerCase().includes(search);
  });

  $("#vehicleList").innerHTML = vehicles.length
    ? vehicles.map(vehicleCard).join("")
    : emptyState("No vehicles match your current filters.");
  bindVehicleActions($("#vehicleList"));
}

function vehicleCard(vehicle) {
  const status = oilStatus(vehicle);
  const archived = toBoolean(vehicle.archived);
  const remainingText = status.remaining <= 0
    ? `${formatNumber(Math.abs(status.remaining))} miles overdue`
    : `${formatNumber(status.remaining)} miles remaining`;

  return `
    <article class="vehicle-card ${archived ? "archived" : ""}">
      <div class="vehicle-top">
        <div class="vehicle-title">
          <small>${escapeHtml(vehicle.nickname || vehicle.color || "Vehicle")}</small>
          <h3>${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</h3>
        </div>
        <div class="vehicle-menu">
          <button class="mini-button" data-edit-vehicle="${vehicle.id}" title="Edit"><span data-icon="edit"></span></button>
          <button class="mini-button" data-archive-vehicle="${vehicle.id}" data-archived="${archived}" title="${archived ? "Restore" : "Archive"}"><span data-icon="${archived ? "restore" : "archive"}"></span></button>
        </div>
      </div>
      <div class="vehicle-mileage">
        <strong>${formatNumber(vehicle.currentMileage)}</strong>
        <span>current miles</span>
      </div>
      <div class="oil-life-block">
        <div class="oil-life-count">
          <strong>${Math.round(status.percentRemaining)}%</strong>
          <span>oil life remaining</span>
        </div>
        <div class="service-progress">
          <header>
            <span>Predicted oil change at ${formatNumber(status.due)} mi</span>
            <span>${remainingText}</span>
          </header>
          <div class="progress-track oil-life-track"><span class="${status.level}" style="width:${status.percentRemaining}%"></span></div>
          <small class="oil-prediction-note">${formatNumber(status.milesSinceChange)} miles since last change · prediction from ${status.predictionSource}</small>
        </div>
      </div>
      ${archived ? "" : `<button class="oil-reset-button" data-reset-oil="${vehicle.id}"><span data-icon="sync"></span> Oil changed — reset to 100%</button>`}
    </article>
  `;
}

function bindVehicleActions(root) {
  mountIcons(root);
  $$('[data-edit-vehicle]', root).forEach(button => button.addEventListener("click", () => editVehicle(button.dataset.editVehicle)));
  $$('[data-archive-vehicle]', root).forEach(button => button.addEventListener("click", async () => {
    const archived = button.dataset.archived === "true";
    await api.archiveVehicle(button.dataset.archiveVehicle, !archived);
    await refreshData();
    toast(archived ? "Vehicle restored." : "Vehicle archived.", "success");
  }));
  $$('[data-reset-oil]', root).forEach(button => button.addEventListener("click", async () => {
    const vehicle = getVehicle(button.dataset.resetOil);
    if (!vehicle) return;
    const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    if (!confirm(`Reset oil life for ${label} at ${formatNumber(vehicle.currentMileage)} miles? This will also add an Oil Change maintenance record.`)) return;
    button.disabled = true;
    try {
      const result = await api.resetOil({
        vehicleId: vehicle.id,
        mileage: Number(vehicle.currentMileage),
        date: today(),
        notes: "Oil life reset from dashboard"
      });
      await refreshData();
      await updateConnectionStatus();
      toast(result.queued ? "Oil reset queued for sync." : "Oil life reset to 100%.", "success");
    } catch (error) {
      toast(error.message || "Unable to reset oil life.", "error");
    } finally {
      button.disabled = false;
    }
  }));
}

function editVehicle(id) {
  const vehicle = getVehicle(id);
  if (!vehicle) return;
  const form = $("#vehicleForm");
  Object.entries(vehicle).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
  $("#vehicleModalTitle").textContent = "Edit vehicle";
  openModal("vehicleModal");
}

function renderServiceAlerts() {
  const alerts = activeVehicles()
    .map(vehicle => ({ vehicle, status: oilStatus(vehicle) }))
    .filter(item => item.status.level !== "good")
    .sort((a, b) => a.status.remaining - b.status.remaining);

  $("#serviceCount").textContent = alerts.length;
  $("#serviceAlerts").innerHTML = alerts.length
    ? alerts.map(({ vehicle, status }) => `
        <div class="activity-item">
          <span class="activity-icon" data-icon="wrench"></span>
          <div class="activity-copy">
            <strong>${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</strong>
            <small>${status.remaining <= 0 ? `${formatNumber(Math.abs(status.remaining))} miles overdue` : `Oil change due in ${formatNumber(status.remaining)} miles`}</small>
          </div>
          <small>${formatNumber(status.due)} mi</small>
        </div>
      `).join("")
    : emptyState("No service alerts. Everything looks good.");
  mountIcons($("#serviceAlerts"));
}

function renderActivity() {
  const activities = [
    ...state.mileageLogs.map(item => ({ ...item, type: "Mileage", icon: "odometer", title: `${formatNumber(item.mileage)} miles logged` })),
    ...state.fuelLogs.map(item => ({ ...item, type: "Fuel", icon: "fuel", title: `${Number(item.gallons).toFixed(1)} gallons added` })),
    ...state.maintenanceLogs.map(item => ({ ...item, type: "Service", icon: "wrench", title: item.serviceType }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  $("#recentActivity").innerHTML = activities.length ? activities.map(item => {
    const vehicle = getVehicle(item.vehicleId);
    return `
      <div class="activity-item">
        <span class="activity-icon" data-icon="${item.icon}"></span>
        <div class="activity-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${vehicle ? `${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}` : "Unknown vehicle"}</small>
        </div>
        <small>${formatDate(item.date)}</small>
      </div>
    `;
  }).join("") : emptyState("No activity yet.");
  mountIcons($("#recentActivity"));
}

function renderFuelTable() {
  const rows = [...state.fuelLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  $("#fuelTableBody").innerHTML = rows.map(item => {
    const vehicle = getVehicle(item.vehicleId);
    return `
      <tr>
        <td>${formatDate(item.date)}</td>
        <td>${vehicle ? `${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}` : "Unknown"}</td>
        <td>${formatNumber(item.mileage)}</td>
        <td>${Number(item.gallons).toFixed(2)}</td>
        <td>${formatCurrency(item.pricePerGallon)}</td>
        <td>${formatCurrency(item.totalCost || Number(item.gallons) * Number(item.pricePerGallon))}</td>
        <td>${item.mpg ? Number(item.mpg).toFixed(1) : "—"}</td>
      </tr>
    `;
  }).join("");
  $("#fuelEmpty").style.display = rows.length ? "none" : "block";
}

function renderMaintenanceTable() {
  const rows = [...state.maintenanceLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  $("#maintenanceTableBody").innerHTML = rows.map(item => {
    const vehicle = getVehicle(item.vehicleId);
    return `
      <tr>
        <td>${formatDate(item.date)}</td>
        <td>${vehicle ? `${escapeHtml(vehicle.year)} ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}` : "Unknown"}</td>
        <td>${escapeHtml(item.serviceType)}</td>
        <td>${formatNumber(item.mileage)}</td>
        <td>${formatCurrency(item.cost)}</td>
        <td>${escapeHtml(item.shop || "—")}</td>
        <td>${escapeHtml(item.notes || "—")}</td>
      </tr>
    `;
  }).join("");
  $("#maintenanceEmpty").style.display = rows.length ? "none" : "block";
}

function setupNearbySearch() {
  $("#zipSearchButton").addEventListener("click", async () => {
    const zip = $("#zipInput").value.trim();
    if (!/^\d{5}$/.test(zip)) return toast("Enter a valid five-digit ZIP code.", "error");
    await loadShops(() => api.nearbyByZip(zip));
  });

  $("#gpsSearchButton").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("GPS is not supported by this browser.", "error");
    navigator.geolocation.getCurrentPosition(
      position => loadShops(() => api.nearbyByCoordinates(position.coords.latitude, position.coords.longitude)),
      () => toast("Unable to access your location.", "error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function loadShops(loader) {
  const debug = $("#shopDebug");
  debug.hidden = true;
  debug.textContent = "";
  $("#shopResults").innerHTML = `<div class="empty-state">Searching nearby service shops...</div>`;
  try {
    const response = await loader();
    console.info("MilePilot nearby shop response", response);
    const result = response.data || {};
    const shops = Array.isArray(result) ? result : (result.shops || []);
    if (!Array.isArray(result) && result.diagnostics) {
      debug.hidden = false;
      debug.textContent = `Provider: ${result.diagnostics.provider || "unknown"} · ZIP/GPS resolved: ${result.diagnostics.latitude}, ${result.diagnostics.longitude} · Results: ${shops.length}`;
    }
    $("#shopResults").innerHTML = shops.length ? shops.map(shop => `
      <article class="shop-card">
        <header>
          <div>
            <h3>${escapeHtml(shop.name)}</h3>
            <p>${escapeHtml(shop.address || "")}</p>
          </div>
          <span class="score-badge">${Math.round(Number(shop.score || 0))}</span>
        </header>
        <div class="shop-meta">
          <span>${Number(shop.distanceMiles || 0).toFixed(1)} miles away</span>
          <span>${escapeHtml(shop.openingHours || "Hours not listed")}</span>
        </div>
        <div class="shop-actions">
          ${shop.phone ? `<a class="button button-secondary" href="tel:${escapeHtml(shop.phone)}">Call</a>` : ""}
          ${shop.website ? `<a class="button button-secondary" href="${escapeHtml(shop.website)}" target="_blank" rel="noopener noreferrer">Website</a>` : ""}
          <a class="button button-primary" href="${escapeHtml(shop.mapsUrl || "#")}" target="_blank" rel="noopener noreferrer">Open in Maps</a>
        </div>
        <small class="shop-source">Listing data from OpenStreetMap contributors</small>
      </article>
    `).join("") : emptyState("No shops found within 25 miles.");
  } catch (error) {
    console.error("MilePilot nearby shop search failed", error);
    debug.hidden = false;
    debug.textContent = `Shop search error: ${error.message || error}. Open Apps Script → Executions for the server-side details.`;
    $("#shopResults").innerHTML = emptyState("Unable to load nearby shops. Diagnostic details are shown above.");
    toast(error.message || "Unable to load nearby shops.", "error");
  }
}

function setupConnectionEvents() {
  window.addEventListener("online", async () => {
    await updateConnectionStatus();
    await handleSync(true);
  });
  window.addEventListener("offline", updateConnectionStatus);
}

async function updateConnectionStatus() {
  const count = await getQueueCount();
  const online = navigator.onLine;
  $("#connectionDot").className = `status-dot ${online ? "online" : "offline"}`;
  $("#connectionLabel").textContent = online ? "Online" : "Offline mode";
  $("#queueLabel").textContent = count ? `${count} queued change${count === 1 ? "" : "s"}` : "No queued changes";
}

async function handleSync(silent = false) {
  const result = await syncQueue();
  await updateConnectionStatus();
  if (result.synced) {
    await refreshData();
    if (!silent) toast(`Synced ${result.synced} queued change${result.synced === 1 ? "" : "s"}.`, "success");
  } else if (!silent) {
    toast(result.remaining ? "Changes are still waiting for a connection." : "Everything is already synced.", result.remaining ? "error" : "success");
  }
}

function setupServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  }
}

function setDefaultDates() {
  $$('#mileageForm input[type="date"], #fuelForm input[type="date"], #maintenanceForm input[type="date"]').forEach(input => {
    if (!input.value) input.value = today();
  });
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function toBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function toast(message, type = "success") {
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.textContent = message;
  $("#toastRegion").appendChild(element);
  setTimeout(() => element.remove(), 3800);
}
