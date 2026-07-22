import { queueRequest, getQueuedRequests, removeQueuedRequest, setCache, getCache } from "./db.js";
import { uid } from "./utils.js";

const API_BASE_URL = "https://script.google.com/macros/s/AKfycbzdO_bD1NzIqfaKLuPb8LuAlYCTTH6fWF7tPG7piUBB_fiHeoz20uolCZzRx0rlX_G8/exec";
const DEMO_MODE = API_BASE_URL.includes("PASTE_YOUR");

function buildUrl(action, params = {}) {
  const url = new URL(API_BASE_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function request(action, { method = "GET", params = {}, body = null, queueWhenOffline = true } = {}) {
  if (DEMO_MODE) return demoRequest(action, { method, params, body });

  if (!navigator.onLine && method !== "GET" && queueWhenOffline) {
    const queued = { id: uid("queue"), action, method, params, body, createdAt: Date.now() };
    await queueRequest(queued);
    return { success: true, queued: true, data: body };
  }

  try {
    const response = await fetch(buildUrl(action, params), {
      method,
      headers: method === "GET" ? undefined : { "Content-Type": "text/plain;charset=utf-8" },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "follow"
    });

    if (!response.ok) throw new Error(`Request failed with ${response.status}`);
    const payload = await response.json();
    if (!payload.success) throw new Error(payload.error || "Unknown API error");
    return payload;
  } catch (error) {
    if (method !== "GET" && queueWhenOffline) {
      const queued = { id: uid("queue"), action, method, params, body, createdAt: Date.now() };
      await queueRequest(queued);
      return { success: true, queued: true, data: body };
    }
    throw error;
  }
}

export async function syncQueue() {
  if (DEMO_MODE || !navigator.onLine) return { synced: 0, remaining: (await getQueuedRequests()).length };
  const queued = await getQueuedRequests();
  let synced = 0;
  for (const item of queued) {
    try {
      await request(item.action, {
        method: item.method,
        params: item.params,
        body: item.body,
        queueWhenOffline: false
      });
      await removeQueuedRequest(item.id);
      synced += 1;
    } catch {
      break;
    }
  }
  return { synced, remaining: (await getQueuedRequests()).length };
}

export async function getQueueCount() {
  return (await getQueuedRequests()).length;
}

export const api = {
  async bootstrap() {
    try {
      const response = await request("bootstrap");
      await setCache("bootstrap", response.data);
      return response.data;
    } catch (error) {
      const cached = await getCache("bootstrap");
      if (cached) return cached;
      throw error;
    }
  },
  saveVehicle: vehicle => request(vehicle.id ? "updateVehicle" : "createVehicle", { method: "POST", body: vehicle }),
  archiveVehicle: (id, archived) => request("archiveVehicle", { method: "POST", body: { id, archived } }),
  addMileage: record => request("addMileage", { method: "POST", body: record }),
  addFuel: record => request("addFuel", { method: "POST", body: record }),
  addMaintenance: record => request("addMaintenance", { method: "POST", body: record }),
  resetOil: record => request("resetOil", { method: "POST", body: record }),
  nearbyByCoordinates: (lat, lng) => request("nearbyShops", { params: { lat, lng } }),
  nearbyByZip: zip => request("nearbyShops", { params: { zip } })
};

const demoKey = "milepilot-demo-data";

function defaultDemoData() {
  const vehicleId = "veh_demo";
  return {
    vehicles: [{
      id: vehicleId,
      year: 2021,
      make: "Ford",
      model: "F-150",
      trim: "Lariat",
      nickname: "Daily Driver",
      color: "Carbonized Gray",
      currentMileage: 48720,
      oilInterval: 5000,
      warningThreshold: 500,
      lastOilMileage: 45100,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }],
    mileageLogs: [
      { id: "mile_1", vehicleId, mileage: 48720, date: new Date().toISOString().slice(0,10), note: "Current reading" }
    ],
    fuelLogs: [
      { id: "fuel_1", vehicleId, date: "2026-07-12", mileage: 48340, gallons: 19.1, pricePerGallon: 3.129, totalCost: 59.76, fullTank: true, station: "QuikTrip", mpg: 18.7 },
      { id: "fuel_2", vehicleId, date: "2026-07-20", mileage: 48720, gallons: 20.3, pricePerGallon: 3.079, totalCost: 62.50, fullTank: true, station: "Casey's", mpg: 18.72 }
    ],
    maintenanceLogs: [
      { id: "maint_1", vehicleId, serviceType: "Oil Change", date: "2026-05-22", mileage: 45100, cost: 82.49, shop: "Local Garage", notes: "Full synthetic and filter" }
    ]
  };
}

function readDemoData() {
  const stored = localStorage.getItem(demoKey);
  if (!stored) {
    const data = defaultDemoData();
    localStorage.setItem(demoKey, JSON.stringify(data));
    return data;
  }
  return JSON.parse(stored);
}

function writeDemoData(data) {
  localStorage.setItem(demoKey, JSON.stringify(data));
}

async function demoRequest(action, { body, params }) {
  const data = readDemoData();
  const now = new Date().toISOString();

  if (action === "bootstrap") return { success: true, data };

  if (action === "createVehicle") {
    const vehicle = { ...body, id: uid("veh"), archived: false, lastOilMileage: body.lastOilMileage === undefined ? Number(body.currentMileage) : Number(body.lastOilMileage), createdAt: now, updatedAt: now };
    data.vehicles.push(vehicle);
    writeDemoData(data);
    return { success: true, data: vehicle };
  }

  if (action === "updateVehicle") {
    const index = data.vehicles.findIndex(item => item.id === body.id);
    data.vehicles[index] = { ...data.vehicles[index], ...body, updatedAt: now };
    writeDemoData(data);
    return { success: true, data: data.vehicles[index] };
  }

  if (action === "archiveVehicle") {
    const vehicle = data.vehicles.find(item => item.id === body.id);
    vehicle.archived = Boolean(body.archived);
    vehicle.updatedAt = now;
    writeDemoData(data);
    return { success: true, data: vehicle };
  }

  if (action === "addMileage") {
    const record = { ...body, id: uid("mile"), createdAt: now };
    data.mileageLogs.push(record);
    const vehicle = data.vehicles.find(item => item.id === body.vehicleId);
    vehicle.currentMileage = Math.max(Number(vehicle.currentMileage), Number(body.mileage));
    vehicle.updatedAt = now;
    writeDemoData(data);
    return { success: true, data: record };
  }

  if (action === "addFuel") {
    const previous = [...data.fuelLogs]
      .filter(item => item.vehicleId === body.vehicleId && item.fullTank)
      .sort((a, b) => Number(b.mileage) - Number(a.mileage))[0];
    const mpg = body.fullTank && previous && Number(body.mileage) > Number(previous.mileage)
      ? (Number(body.mileage) - Number(previous.mileage)) / Number(body.gallons)
      : null;
    const record = { ...body, id: uid("fuel"), totalCost: Number(body.gallons) * Number(body.pricePerGallon), mpg, createdAt: now };
    data.fuelLogs.push(record);
    const vehicle = data.vehicles.find(item => item.id === body.vehicleId);
    vehicle.currentMileage = Math.max(Number(vehicle.currentMileage), Number(body.mileage));
    writeDemoData(data);
    return { success: true, data: record };
  }

  if (action === "addMaintenance") {
    const record = { ...body, id: uid("maint"), createdAt: now };
    data.maintenanceLogs.push(record);
    const vehicle = data.vehicles.find(item => item.id === body.vehicleId);
    vehicle.currentMileage = Math.max(Number(vehicle.currentMileage), Number(body.mileage));
    if (String(body.serviceType).toLowerCase() === "oil change") vehicle.lastOilMileage = Number(body.mileage);
    writeDemoData(data);
    return { success: true, data: record };
  }

  if (action === "resetOil") {
    const vehicle = data.vehicles.find(item => item.id === body.vehicleId);
    if (!vehicle) throw new Error("Vehicle not found.");
    const mileage = Number(body.mileage ?? vehicle.currentMileage);
    vehicle.currentMileage = Math.max(Number(vehicle.currentMileage), mileage);
    vehicle.lastOilMileage = mileage;
    vehicle.updatedAt = now;
    const record = {
      id: uid("maint"), vehicleId: body.vehicleId, serviceType: "Oil Change",
      date: body.date, mileage, cost: 0, shop: "", notes: body.notes || "Oil life reset", createdAt: now
    };
    data.maintenanceLogs.push(record);
    writeDemoData(data);
    return { success: true, data: { vehicle, maintenance: record } };
  }

  if (action === "nearbyShops") {
    return {
      success: true,
      data: [
        { name: "Precision Auto Care", address: "123 Main Street", rating: 4.8, reviewCount: 318, distanceMiles: 2.4, score: 94 },
        { name: "County Line Automotive", address: "842 Highway 21", rating: 4.7, reviewCount: 201, distanceMiles: 4.1, score: 89 },
        { name: "Quick Lane Service Center", address: "55 Commerce Drive", rating: 4.5, reviewCount: 426, distanceMiles: 1.8, score: 87 }
      ]
    };
  }

  throw new Error(`Unknown demo action: ${action}`);
}
