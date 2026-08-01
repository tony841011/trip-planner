/**
 * 旅遊行程規劃工具 - Trip Planner v2
 * 純前端靜態應用，可部署於 GitHub Pages
 * 新增：航班、行李清單、費用支出、需購買清單、交通資訊（路線圖＋時刻表）
 */

const STORAGE_KEY = 'trip-planner-data-v2';

// ========== State ==========
let state = {
  trips: [],
  currentTripId: null,
  currentDayIndex: 0,
  currentTab: 'itinerary',
  editingTripId: null,
  editingActivityId: null,
  editingPackingId: null,
  editingExpenseId: null,
  editingShoppingId: null,
  editingRouteId: null,
  editingTimetableId: null,
  editingHotelId: null,
  tempPhotoBase64: null,
  tempRoutePhotoBase64: null,
  tempHotelPdf: null, // { name, data (base64) }
  map: null,
  markers: []
};

const DEFAULT_PACKING = [
  { category: '證件文件', name: '護照', qty: 1 },
  { category: '證件文件', name: '機票 / 電子機票', qty: 1 },
  { category: '證件文件', name: '信用卡 / 現金', qty: 1 },
  { category: '證件文件', name: '旅遊保險證明', qty: 1 },
  { category: '衣物', name: '換洗衣物', qty: 1 },
  { category: '衣物', name: '外套 / 薄外套', qty: 1 },
  { category: '衣物', name: '內衣褲 / 襪子', qty: 1 },
  { category: '盥洗用品', name: '牙刷牙膏', qty: 1 },
  { category: '盥洗用品', name: '洗面乳 / 保養品', qty: 1 },
  { category: '盥洗用品', name: '毛巾', qty: 1 },
  { category: '電子產品', name: '手機 + 充電器', qty: 1 },
  { category: '電子產品', name: '行動電源', qty: 1 },
  { category: '電子產品', name: '轉接插頭', qty: 1 },
  { category: '藥品', name: '常備藥（感冒、腸胃）', qty: 1 },
  { category: '藥品', name: 'OK繃 / 急救用品', qty: 1 },
  { category: '其他', name: '購物袋 / 折疊購物袋', qty: 1 },
  { category: '其他', name: '雨傘 / 雨衣', qty: 1 }
];

// ========== Utilities ==========
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const week = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}/${d.getDate()}（${week[d.getDay()]}）`;
}

function daysBetween(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const days = [];
  let cur = new Date(s);
  while (cur <= e) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function categoryLabel(cat) {
  const map = {
    sightseeing: '景點', food: '美食', transport: '交通',
    hotel: '住宿', shopping: '購物', other: '其他'
  };
  return map[cat] || '其他';
}

function categoryIcon(cat) {
  const map = {
    sightseeing: 'fa-landmark', food: 'fa-utensils', transport: 'fa-train',
    hotel: 'fa-bed', shopping: 'fa-shopping-bag', other: 'fa-circle'
  };
  return map[cat] || 'fa-circle';
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const text = document.getElementById('toastMsg');
  text.textContent = msg;
  icon.className = type === 'success'
    ? 'fas fa-check-circle text-green-400'
    : 'fas fa-exclamation-circle text-amber-400';
  toast.classList.remove('hidden');
  const duration = type === 'error' ? 4500 : 2800;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

const MAX_PHOTO_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function showPhotoError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  } else {
    el.textContent = '';
    el.classList.add('hidden');
  }
}

function clearAllData() {
  localStorage.removeItem('trip-planner-data-v2');
  localStorage.removeItem('trip-planner-data-v1');
  state.trips = [];
  state.currentTripId = null;
  state.currentDayIndex = 0;
  state.currentTab = 'itinerary';
  if (state.map) {
    try { state.map.remove(); } catch (e) {}
    state.map = null;
    state.markers = [];
  }
  showToast('已清除所有資料');
  closeAllModals();
  render();
}

function emptyFlight() {
  return {
    airline: '', flightNo: '', from: '', to: '',
    departDate: '', departTime: '', arriveDate: '', arriveTime: '',
    baggage: '', notes: ''
  };
}

function ensureTripData(trip) {
  if (!trip.flights) {
    trip.flights = { outbound: emptyFlight(), return: emptyFlight() };
  }
  if (!trip.flights.outbound) trip.flights.outbound = emptyFlight();
  if (!trip.flights.return) trip.flights.return = emptyFlight();
  if (!Array.isArray(trip.packingList)) trip.packingList = [];
  if (!Array.isArray(trip.expenses)) trip.expenses = [];
  if (!Array.isArray(trip.shoppingList)) trip.shoppingList = [];
  if (!Array.isArray(trip.routeMaps)) trip.routeMaps = [];
  if (!Array.isArray(trip.timetableLinks)) trip.timetableLinks = [];
  if (!Array.isArray(trip.hotels)) trip.hotels = [];
  return trip;
}

// ========== Storage ==========
function loadData() {
  try {
    // try v2 first, then migrate from v1
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem('trip-planner-data-v1');
    }
    if (raw) {
      const data = JSON.parse(raw);
      state.trips = (data.trips || []).map(ensureTripData);
      state.currentTripId = data.currentTripId || null;
      saveData(); // migrate to v2
    }
  } catch (e) {
    console.warn('Load failed', e);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    trips: state.trips,
    currentTripId: state.currentTripId
  }));
}

// ========== Trip CRUD ==========
function createTrip(name, dest, start, end) {
  const dates = daysBetween(start, end);
  const trip = ensureTripData({
    id: uid(),
    name,
    destination: dest,
    startDate: start,
    endDate: end,
    days: dates.map(d => ({ date: d, activities: [] })),
    createdAt: new Date().toISOString()
  });
  state.trips.unshift(trip);
  state.currentTripId = trip.id;
  state.currentDayIndex = 0;
  state.currentTab = 'itinerary';
  saveData();
  return trip;
}

function updateTrip(id, name, dest, start, end) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;
  trip.name = name;
  trip.destination = dest;
  if (trip.startDate !== start || trip.endDate !== end) {
    const oldMap = {};
    trip.days.forEach(d => { oldMap[d.date] = d.activities; });
    const newDates = daysBetween(start, end);
    trip.days = newDates.map(d => ({
      date: d,
      activities: oldMap[d] || []
    }));
    trip.startDate = start;
    trip.endDate = end;
    state.currentDayIndex = 0;
  }
  saveData();
}

function deleteTrip(id) {
  state.trips = state.trips.filter(t => t.id !== id);
  if (state.currentTripId === id) {
    state.currentTripId = state.trips[0]?.id || null;
    state.currentDayIndex = 0;
  }
  saveData();
}

function getCurrentTrip() {
  const trip = state.trips.find(t => t.id === state.currentTripId) || null;
  if (trip) ensureTripData(trip);
  return trip;
}

// ========== Activity CRUD ==========
function addActivity(dayIndex, data) {
  const trip = getCurrentTrip();
  if (!trip || !trip.days[dayIndex]) return;
  const act = {
    id: uid(),
    time: data.time || '',
    title: data.title,
    location: data.location || '',
    lat: data.lat ? parseFloat(data.lat) : null,
    lng: data.lng ? parseFloat(data.lng) : null,
    notes: data.notes || '',
    category: data.category || 'other'
  };
  trip.days[dayIndex].activities.push(act);
  trip.days[dayIndex].activities.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  saveData();
}

function updateActivity(dayIndex, actId, data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const act = trip.days[dayIndex].activities.find(a => a.id === actId);
  if (!act) return;
  Object.assign(act, {
    time: data.time || '',
    title: data.title,
    location: data.location || '',
    lat: data.lat ? parseFloat(data.lat) : null,
    lng: data.lng ? parseFloat(data.lng) : null,
    notes: data.notes || '',
    category: data.category || 'other'
  });
  trip.days[dayIndex].activities.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  saveData();
}

function deleteActivity(dayIndex, actId) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.days[dayIndex].activities = trip.days[dayIndex].activities.filter(a => a.id !== actId);
  saveData();
}

// ========== Flights ==========
function saveFlight(type, data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.flights[type] = { ...data };
  saveData();
}

// ========== Packing ==========
function addPackingItem(data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.packingList.push({
    id: uid(),
    category: data.category,
    name: data.name,
    qty: parseInt(data.qty, 10) || 1,
    checked: false
  });
  saveData();
}

function updatePackingItem(id, data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = trip.packingList.find(i => i.id === id);
  if (!item) return;
  item.category = data.category;
  item.name = data.name;
  item.qty = parseInt(data.qty, 10) || 1;
  saveData();
}

function togglePackingChecked(id) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = trip.packingList.find(i => i.id === id);
  if (item) {
    item.checked = !item.checked;
    saveData();
  }
}

function deletePackingItem(id) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.packingList = trip.packingList.filter(i => i.id !== id);
  saveData();
}

function loadDefaultPacking() {
  const trip = getCurrentTrip();
  if (!trip) return;
  if (trip.packingList.length > 0 && !confirm('目前已有行李項目，確定要載入預設清單嗎？（會保留現有項目）')) return;
  DEFAULT_PACKING.forEach(d => {
    trip.packingList.push({
      id: uid(),
      category: d.category,
      name: d.name,
      qty: d.qty,
      checked: false
    });
  });
  saveData();
  showToast('已載入預設行李清單');
}

// ========== Expenses ==========
function addExpense(data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.expenses.push({
    id: uid(),
    category: data.category,
    name: data.name,
    amount: parseFloat(data.amount) || 0,
    currency: data.currency || 'TWD',
    date: data.date || '',
    taxRefund: !!data.taxRefund,
    notes: data.notes || ''
  });
  saveData();
}

function updateExpense(id, data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = trip.expenses.find(i => i.id === id);
  if (!item) return;
  Object.assign(item, {
    category: data.category,
    name: data.name,
    amount: parseFloat(data.amount) || 0,
    currency: data.currency || 'TWD',
    date: data.date || '',
    taxRefund: !!data.taxRefund,
    notes: data.notes || ''
  });
  saveData();
}

function deleteExpense(id) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.expenses = trip.expenses.filter(i => i.id !== id);
  saveData();
}

// ========== Shopping ==========
function addShoppingItem(data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.shoppingList.push({
    id: uid(),
    category: data.category,
    name: data.name,
    qty: parseInt(data.qty, 10) || 1,
    buyer: data.buyer || '',
    photo: data.photo || null,
    notes: data.notes || '',
    done: false
  });
  saveData();
}

function updateShoppingItem(id, data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = trip.shoppingList.find(i => i.id === id);
  if (!item) return;
  Object.assign(item, {
    category: data.category,
    name: data.name,
    qty: parseInt(data.qty, 10) || 1,
    buyer: data.buyer || '',
    photo: data.photo !== undefined ? data.photo : item.photo,
    notes: data.notes || ''
  });
  saveData();
}

function toggleShoppingDone(id) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = trip.shoppingList.find(i => i.id === id);
  if (item) {
    item.done = !item.done;
    saveData();
  }
}

function deleteShoppingItem(id) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.shoppingList = trip.shoppingList.filter(i => i.id !== id);
  saveData();
}

// ========== Transport: Route Maps ==========
function addRouteMap(data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.routeMaps.push({
    id: uid(),
    title: data.title,
    photo: data.photo || null,
    notes: data.notes || ''
  });
  saveData();
}

function updateRouteMap(id, data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = trip.routeMaps.find(i => i.id === id);
  if (!item) return;
  item.title = data.title;
  item.notes = data.notes || '';
  if (data.photo !== undefined) item.photo = data.photo;
  saveData();
}

function deleteRouteMap(id) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.routeMaps = trip.routeMaps.filter(i => i.id !== id);
  saveData();
}

// ========== Transport: Timetable Links ==========
function addTimetableLink(data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.timetableLinks.push({
    id: uid(),
    title: data.title,
    url: data.url,
    notes: data.notes || ''
  });
  saveData();
}

function updateTimetableLink(id, data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = trip.timetableLinks.find(i => i.id === id);
  if (!item) return;
  item.title = data.title;
  item.url = data.url;
  item.notes = data.notes || '';
  saveData();
}

function deleteTimetableLink(id) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.timetableLinks = trip.timetableLinks.filter(i => i.id !== id);
  saveData();
}

// ========== Hotels ==========
const MAX_PDF_SIZE = 2 * 1024 * 1024; // 2 MB

function breakfastLabel(v) {
  const map = {
    unknown: '未確認',
    included: '含早餐',
    not_included: '不含早餐',
    optional: '可加購'
  };
  return map[v] || '未確認';
}

function addHotel(data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.hotels.push({
    id: uid(),
    name: data.name,
    checkInDate: data.checkInDate || '',
    checkOutDate: data.checkOutDate || '',
    checkInTime: data.checkInTime || '',
    checkOutTime: data.checkOutTime || '',
    breakfast: data.breakfast || 'unknown',
    facilities: data.facilities || '',
    notes: data.notes || '',
    pdf: data.pdf || null // { name, data }
  });
  // sort by check-in date
  trip.hotels.sort((a, b) => (a.checkInDate || '9999').localeCompare(b.checkInDate || '9999'));
  saveData();
}

function updateHotel(id, data) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = trip.hotels.find(i => i.id === id);
  if (!item) return;
  item.name = data.name;
  item.checkInDate = data.checkInDate || '';
  item.checkOutDate = data.checkOutDate || '';
  item.checkInTime = data.checkInTime || '';
  item.checkOutTime = data.checkOutTime || '';
  item.breakfast = data.breakfast || 'unknown';
  item.facilities = data.facilities || '';
  item.notes = data.notes || '';
  if (data.pdf !== undefined) item.pdf = data.pdf;
  trip.hotels.sort((a, b) => (a.checkInDate || '9999').localeCompare(b.checkInDate || '9999'));
  saveData();
}

function deleteHotel(id) {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.hotels = trip.hotels.filter(i => i.id !== id);
  saveData();
}

// ========== Map ==========
function initMap() {
  if (state.map) return;
  state.map = L.map('map', { zoomControl: true }).setView([25.033, 121.565], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(state.map);
}

function clearMarkers() {
  state.markers.forEach(m => state.map.removeLayer(m));
  state.markers = [];
}

function updateMapMarkers() {
  if (!state.map) return;
  clearMarkers();
  const trip = getCurrentTrip();
  if (!trip) return;
  const day = trip.days[state.currentDayIndex];
  if (!day) return;
  const bounds = [];
  day.activities.forEach(act => {
    if (act.lat != null && act.lng != null) {
      const marker = L.marker([act.lat, act.lng])
        .addTo(state.map)
        .bindPopup(`
          <strong>${act.title}</strong><br>
          ${act.time ? act.time + ' · ' : ''}${categoryLabel(act.category)}
          ${act.location ? '<br><span style="color:#64748b">' + act.location + '</span>' : ''}
        `);
      state.markers.push(marker);
      bounds.push([act.lat, act.lng]);
    }
  });
  if (bounds.length === 1) state.map.setView(bounds[0], 15);
  else if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [40, 40] });
}

function focusMarker(lat, lng) {
  if (state.map && lat != null && lng != null) state.map.setView([lat, lng], 16);
}

// ========== Geocoding ==========
async function geocode(query) {
  if (!query.trim()) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW,zh,en' } });
  if (!res.ok) throw new Error('Geocode failed');
  const data = await res.json();
  if (data.length === 0) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display: data[0].display_name
  };
}

// ========== Tab switching ==========
function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('hidden', el.id !== 'tab-' + tab);
  });
  if (tab === 'itinerary') {
    setTimeout(() => {
      if (!state.map) initMap();
      if (state.map) {
        state.map.invalidateSize();
        updateMapMarkers();
      }
    }, 50);
  }
  renderTabContent();
}

function renderTabContent() {
  const trip = getCurrentTrip();
  if (!trip) return;
  if (state.currentTab === 'itinerary') renderItinerary(trip);
  else if (state.currentTab === 'flights') renderFlights(trip);
  else if (state.currentTab === 'packing') renderPacking(trip);
  else if (state.currentTab === 'expenses') renderExpenses(trip);
  else if (state.currentTab === 'shopping') renderShopping(trip);
  else if (state.currentTab === 'transport') renderTransport(trip);
  else if (state.currentTab === 'hotels') renderHotels(trip);
}

// ========== Render helpers ==========
function renderItinerary(trip) {
  const daysList = document.getElementById('daysList');
  daysList.innerHTML = trip.days.map((d, i) => `
    <button class="day-btn ${i === state.currentDayIndex ? 'active' : ''}" data-day="${i}">
      <div class="flex items-center justify-between">
        <span>第 ${i + 1} 天</span>
        <span class="text-xs opacity-70">${formatDate(d.date)}</span>
      </div>
      <div class="text-xs text-slate-400 mt-0.5">${d.activities.length} 個活動</div>
    </button>
  `).join('');

  const day = trip.days[state.currentDayIndex];
  document.getElementById('currentDayLabel').textContent = `第 ${state.currentDayIndex + 1} 天`;
  document.getElementById('currentDayDate').textContent = formatDate(day.date);

  const list = document.getElementById('activitiesList');
  if (day.activities.length === 0) {
    list.innerHTML = `
      <div class="px-5 py-12 text-center text-slate-400">
        <i class="fas fa-calendar-plus text-3xl mb-3 opacity-50"></i>
        <p>還沒有活動，點「新增活動」開始規劃吧！</p>
      </div>
    `;
  } else {
    list.innerHTML = day.activities.map(act => `
      <div class="activity-card" data-act-id="${act.id}">
        <div class="flex gap-4">
          <div class="flex-shrink-0 w-14 text-center">
            <div class="text-sm font-semibold text-primary-600">${act.time || '--:--'}</div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start gap-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium cat-${act.category}">
                <i class="fas ${categoryIcon(act.category)} mr-1"></i>${categoryLabel(act.category)}
              </span>
              <h4 class="font-semibold text-slate-800 truncate">${act.title}</h4>
            </div>
            ${act.location ? `<p class="text-sm text-slate-500 mt-1"><i class="fas fa-map-marker-alt mr-1 opacity-60"></i>${act.location}</p>` : ''}
            ${act.notes ? `<p class="text-sm text-slate-400 mt-1 line-clamp-2">${act.notes}</p>` : ''}
          </div>
          <div class="act-actions flex gap-1 flex-shrink-0">
            <button class="btn-ghost p-2 text-slate-400 hover:text-primary-600 edit-act" data-id="${act.id}" title="編輯">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn-ghost p-2 text-slate-400 hover:text-red-500 del-act" data-id="${act.id}" title="刪除">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  setTimeout(() => {
    if (!state.map) initMap();
    if (state.map) {
      state.map.invalidateSize();
      updateMapMarkers();
    }
  }, 50);
}

function renderFlights(trip) {
  const o = trip.flights.outbound;
  const r = trip.flights.return;
  document.getElementById('outAirline').value = o.airline || '';
  document.getElementById('outFlightNo').value = o.flightNo || '';
  document.getElementById('outFrom').value = o.from || '';
  document.getElementById('outTo').value = o.to || '';
  document.getElementById('outDepartDate').value = o.departDate || '';
  document.getElementById('outDepartTime').value = o.departTime || '';
  document.getElementById('outArriveDate').value = o.arriveDate || '';
  document.getElementById('outArriveTime').value = o.arriveTime || '';
  document.getElementById('outBaggage').value = o.baggage || '';
  document.getElementById('outNotes').value = o.notes || '';

  document.getElementById('retAirline').value = r.airline || '';
  document.getElementById('retFlightNo').value = r.flightNo || '';
  document.getElementById('retFrom').value = r.from || '';
  document.getElementById('retTo').value = r.to || '';
  document.getElementById('retDepartDate').value = r.departDate || '';
  document.getElementById('retDepartTime').value = r.departTime || '';
  document.getElementById('retArriveDate').value = r.arriveDate || '';
  document.getElementById('retArriveTime').value = r.arriveTime || '';
  document.getElementById('retBaggage').value = r.baggage || '';
  document.getElementById('retNotes').value = r.notes || '';
}

function renderPacking(trip) {
  const container = document.getElementById('packingList');
  if (trip.packingList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-400">
        <i class="fas fa-suitcase text-3xl mb-3 opacity-50"></i>
        <p>還沒有行李項目</p>
        <p class="text-sm mt-1">可點「載入預設清單」快速開始</p>
      </div>
    `;
    return;
  }

  // group by category
  const groups = {};
  trip.packingList.forEach(item => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });

  const checkedCount = trip.packingList.filter(i => i.checked).length;
  let html = `<p class="text-sm text-slate-500 mb-2">已勾選 ${checkedCount} / ${trip.packingList.length} 項</p>`;

  Object.keys(groups).forEach(cat => {
    html += `<div>
      <h4 class="text-sm font-semibold text-slate-600 mb-2">${cat}</h4>
      <div class="space-y-1">
        ${groups[cat].map(item => `
          <div class="pack-item ${item.checked ? 'checked' : ''}" data-pack-id="${item.id}">
            <input type="checkbox" class="pack-check w-4 h-4 rounded border-slate-300 text-primary-600" ${item.checked ? 'checked' : ''} data-id="${item.id}" />
            <span class="pack-name flex-1 text-sm">${item.name}${item.qty > 1 ? ` ×${item.qty}` : ''}</span>
            <button class="btn-ghost p-1 text-slate-400 hover:text-primary-600 edit-pack" data-id="${item.id}" title="編輯"><i class="fas fa-pen text-xs"></i></button>
            <button class="btn-ghost p-1 text-slate-400 hover:text-red-500 del-pack" data-id="${item.id}" title="刪除"><i class="fas fa-trash-alt text-xs"></i></button>
          </div>
        `).join('')}
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function renderExpenses(trip) {
  const list = document.getElementById('expensesList');
  const summary = document.getElementById('expenseSummary');

  // summary by currency
  const totals = {};
  trip.expenses.forEach(e => {
    totals[e.currency] = (totals[e.currency] || 0) + e.amount;
  });
  const summaryText = Object.keys(totals).length
    ? '合計：' + Object.entries(totals).map(([c, a]) => `${c} ${a.toLocaleString()}`).join(' / ')
    : '尚無支出記錄';
  summary.textContent = summaryText;

  if (trip.expenses.length === 0) {
    list.innerHTML = `
      <div class="px-5 py-12 text-center text-slate-400">
        <i class="fas fa-receipt text-3xl mb-3 opacity-50"></i>
        <p>還沒有費用記錄</p>
      </div>
    `;
    return;
  }

  list.innerHTML = trip.expenses.map(e => `
    <div class="px-5 py-3 flex items-start gap-3 hover:bg-slate-50">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">${e.category}</span>
          ${e.taxRefund ? '<span class="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700">可退稅</span>' : ''}
          <span class="font-medium text-slate-800">${e.name}</span>
        </div>
        <div class="text-sm text-slate-500 mt-0.5">
          ${e.date ? formatDate(e.date) + ' · ' : ''}${e.currency} ${e.amount.toLocaleString()}
          ${e.notes ? ' · ' + e.notes : ''}
        </div>
      </div>
      <div class="flex gap-1 flex-shrink-0">
        <button class="btn-ghost p-2 text-slate-400 hover:text-primary-600 edit-exp" data-id="${e.id}"><i class="fas fa-pen"></i></button>
        <button class="btn-ghost p-2 text-slate-400 hover:text-red-500 del-exp" data-id="${e.id}"><i class="fas fa-trash-alt"></i></button>
      </div>
    </div>
  `).join('');
}

function renderShopping(trip) {
  const container = document.getElementById('shoppingList');
  if (trip.shoppingList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-400">
        <i class="fas fa-shopping-cart text-3xl mb-3 opacity-50"></i>
        <p>還沒有需購買項目</p>
      </div>
    `;
    return;
  }

  container.innerHTML = trip.shoppingList.map(item => `
    <div class="flex gap-3 p-3 rounded-xl border border-slate-200 ${item.done ? 'bg-slate-50 opacity-75' : 'bg-white'}">
      <div class="flex-shrink-0 pt-1">
        <input type="checkbox" class="shop-done w-4 h-4 rounded border-slate-300 text-primary-600" ${item.done ? 'checked' : ''} data-id="${item.id}" />
      </div>
      ${item.photo ? `<img src="${item.photo}" class="shop-photo-thumb" alt="參考照片" data-photo="${item.id}" />` : ''}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-pink-100 text-pink-800">${item.category}</span>
          <span class="font-medium text-slate-800 ${item.done ? 'line-through text-slate-400' : ''}">${item.name}</span>
        </div>
        <div class="text-sm text-slate-500 mt-0.5">
          數量：${item.qty}${item.buyer ? ' · 購買人：' + item.buyer : ''}
        </div>
        ${item.notes ? `<p class="text-xs text-slate-400 mt-1">${item.notes}</p>` : ''}
      </div>
      <div class="flex gap-1 flex-shrink-0">
        <button class="btn-ghost p-2 text-slate-400 hover:text-primary-600 edit-shop" data-id="${item.id}"><i class="fas fa-pen"></i></button>
        <button class="btn-ghost p-2 text-slate-400 hover:text-red-500 del-shop" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
      </div>
    </div>
  `).join('');
}

function renderTransport(trip) {
  // 路線圖 - accordion style
  const routeContainer = document.getElementById('routeList');
  if (trip.routeMaps.length === 0) {
    routeContainer.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <i class="fas fa-route text-2xl mb-2 opacity-50"></i>
        <p class="text-sm">尚未新增路線圖</p>
        <p class="text-xs mt-1">可上傳地鐵圖、公車路線或 Google Maps 截圖</p>
      </div>
    `;
  } else {
    routeContainer.innerHTML = trip.routeMaps.map(item => `
      <details class="group border border-slate-200 rounded-xl overflow-hidden bg-white">
        <summary class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 list-none">
          <div class="flex items-center gap-2 min-w-0">
            <i class="fas fa-map text-primary-500 flex-shrink-0"></i>
            <span class="font-medium text-slate-800 truncate">${item.title}</span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="btn-ghost p-1.5 text-slate-400 hover:text-primary-600 edit-route" data-id="${item.id}" onclick="event.preventDefault();event.stopPropagation()"><i class="fas fa-pen text-xs"></i></button>
            <button class="btn-ghost p-1.5 text-slate-400 hover:text-red-500 del-route" data-id="${item.id}" onclick="event.preventDefault();event.stopPropagation()"><i class="fas fa-trash-alt text-xs"></i></button>
            <i class="fas fa-chevron-down text-slate-400 text-xs transition-transform group-open:rotate-180 ml-1"></i>
          </div>
        </summary>
        <div class="px-4 pb-4 border-t border-slate-100">
          ${item.photo ? `<img src="${item.photo}" class="w-full max-h-80 object-contain rounded-lg mt-3 border border-slate-200" alt="${item.title}" />` : '<p class="text-sm text-slate-400 mt-3">無圖片</p>'}
          ${item.notes ? `<p class="text-sm text-slate-600 mt-3 whitespace-pre-wrap">${item.notes}</p>` : ''}
        </div>
      </details>
    `).join('');
  }

  // 時刻表連結 - accordion style
  const ttContainer = document.getElementById('timetableList');
  if (trip.timetableLinks.length === 0) {
    ttContainer.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <i class="fas fa-clock text-2xl mb-2 opacity-50"></i>
        <p class="text-sm">尚未新增時刻表連結</p>
        <p class="text-xs mt-1">可加入官方時刻表、Google Maps 交通或 App 連結</p>
      </div>
    `;
  } else {
    ttContainer.innerHTML = trip.timetableLinks.map(item => `
      <details class="group border border-slate-200 rounded-xl overflow-hidden bg-white">
        <summary class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 list-none">
          <div class="flex items-center gap-2 min-w-0">
            <i class="fas fa-external-link-alt text-primary-500 flex-shrink-0"></i>
            <span class="font-medium text-slate-800 truncate">${item.title}</span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="btn-ghost p-1.5 text-slate-400 hover:text-primary-600 edit-tt" data-id="${item.id}" onclick="event.preventDefault();event.stopPropagation()"><i class="fas fa-pen text-xs"></i></button>
            <button class="btn-ghost p-1.5 text-slate-400 hover:text-red-500 del-tt" data-id="${item.id}" onclick="event.preventDefault();event.stopPropagation()"><i class="fas fa-trash-alt text-xs"></i></button>
            <i class="fas fa-chevron-down text-slate-400 text-xs transition-transform group-open:rotate-180 ml-1"></i>
          </div>
        </summary>
        <div class="px-4 pb-4 border-t border-slate-100 space-y-2">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-primary-600 hover:underline text-sm mt-3 break-all">
            <i class="fas fa-link"></i>${item.url}
          </a>
          ${item.notes ? `<p class="text-sm text-slate-600 whitespace-pre-wrap">${item.notes}</p>` : ''}
        </div>
      </details>
    `).join('');
  }
}

function renderHotels(trip) {
  const container = document.getElementById('hotelsList');
  if (trip.hotels.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-400">
        <i class="fas fa-hotel text-3xl mb-3 opacity-50"></i>
        <p>還沒有飯店資訊</p>
        <p class="text-sm mt-1">可新增多家飯店並上傳訂房 PDF</p>
      </div>
    `;
    return;
  }

  container.innerHTML = trip.hotels.map(h => {
    const period = [h.checkInDate, h.checkOutDate].filter(Boolean).map(formatDate).join(' ～ ');
    const times = [];
    if (h.checkInTime) times.push(`入住 ${h.checkInTime}`);
    if (h.checkOutTime) times.push(`退房 ${h.checkOutTime}`);
    return `
      <details class="group border border-slate-200 rounded-xl overflow-hidden bg-white">
        <summary class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 list-none">
          <div class="min-w-0">
            <div class="font-medium text-slate-800 truncate">${h.name}</div>
            <div class="text-xs text-slate-500 mt-0.5">
              ${period || '日期未填'}
              ${times.length ? ' · ' + times.join(' / ') : ''}
              · ${breakfastLabel(h.breakfast)}
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0 ml-2">
            <button class="btn-ghost p-1.5 text-slate-400 hover:text-primary-600 edit-hotel" data-id="${h.id}" onclick="event.preventDefault();event.stopPropagation()"><i class="fas fa-pen text-xs"></i></button>
            <button class="btn-ghost p-1.5 text-slate-400 hover:text-red-500 del-hotel" data-id="${h.id}" onclick="event.preventDefault();event.stopPropagation()"><i class="fas fa-trash-alt text-xs"></i></button>
            <i class="fas fa-chevron-down text-slate-400 text-xs transition-transform group-open:rotate-180 ml-1"></i>
          </div>
        </summary>
        <div class="px-4 pb-4 border-t border-slate-100 space-y-2 text-sm">
          <div class="grid grid-cols-2 gap-2 mt-3">
            <div><span class="text-slate-400">入住</span><br>${h.checkInDate ? formatDate(h.checkInDate) : '—'} ${h.checkInTime || ''}</div>
            <div><span class="text-slate-400">退房</span><br>${h.checkOutDate ? formatDate(h.checkOutDate) : '—'} ${h.checkOutTime || ''}</div>
          </div>
          <div><span class="text-slate-400">早餐：</span>${breakfastLabel(h.breakfast)}</div>
          ${h.facilities ? `<div><span class="text-slate-400">設施／服務：</span><span class="whitespace-pre-wrap">${h.facilities}</span></div>` : ''}
          ${h.notes ? `<div><span class="text-slate-400">注意事項：</span><span class="whitespace-pre-wrap">${h.notes}</span></div>` : ''}
          ${h.pdf ? `
            <div class="flex items-center gap-2 pt-1">
              <i class="fas fa-file-pdf text-red-500"></i>
              <button type="button" class="text-primary-600 hover:underline download-hotel-pdf" data-id="${h.id}">
                下載訂房 PDF（${h.pdf.name || 'booking.pdf'}）
              </button>
            </div>
          ` : '<div class="text-slate-400">尚無訂房 PDF</div>'}
        </div>
      </details>
    `;
  }).join('');
}

function render() {
  const trip = getCurrentTrip();
  const empty = document.getElementById('emptyState');
  const view = document.getElementById('tripView');

  if (!trip) {
    empty.classList.remove('hidden');
    view.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  view.classList.remove('hidden');

  document.getElementById('tripTitle').textContent = trip.name;
  document.getElementById('tripDestinationText').textContent = trip.destination;
  document.getElementById('tripDateRange').textContent =
    `${formatDate(trip.startDate)} ～ ${formatDate(trip.endDate)} · 共 ${trip.days.length} 天`;

  // keep current tab
  switchTab(state.currentTab);
}

function renderTripsList() {
  const list = document.getElementById('tripsList');
  const noMsg = document.getElementById('noTripsMsg');
  if (state.trips.length === 0) {
    list.innerHTML = '';
    noMsg.classList.remove('hidden');
    return;
  }
  noMsg.classList.add('hidden');
  list.innerHTML = state.trips.map(t => `
    <button class="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition flex items-center justify-between group"
            data-trip-id="${t.id}">
      <div>
        <div class="font-medium text-slate-800">${t.name}</div>
        <div class="text-xs text-slate-500 mt-0.5">${t.destination} · ${t.days.length} 天</div>
      </div>
      <i class="fas fa-chevron-right text-slate-300 group-hover:text-primary-500"></i>
    </button>
  `).join('');
}

// ========== Modal helpers ==========
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  state.tempPhotoBase64 = null;
  state.tempRoutePhotoBase64 = null;
  state.tempHotelPdf = null;
}

// ========== Event Bindings ==========
function bindEvents() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // New trip
  document.getElementById('btnNewTrip').addEventListener('click', () => openTripModal());
  document.getElementById('btnEmptyNew').addEventListener('click', () => openTripModal());

  // My trips
  document.getElementById('btnMyTrips').addEventListener('click', () => {
    renderTripsList();
    openModal('tripsModal');
  });

  // Clear all data
  document.getElementById('btnClearAllData').addEventListener('click', () => {
    if (confirm('確定要清除本裝置上的「所有行程資料」嗎？\n\n包含行程、航班、行李、費用、購物清單、交通資訊等，此操作無法復原。')) {
      if (confirm('再次確認：真的要全部刪除嗎？')) {
        clearAllData();
      }
    }
  });

  // Trip form
  document.getElementById('tripForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('tripName').value.trim();
    const dest = document.getElementById('tripDest').value.trim();
    const start = document.getElementById('tripStart').value;
    const end = document.getElementById('tripEnd').value;
    if (!name || !dest || !start || !end) return;
    if (new Date(end) < new Date(start)) {
      showToast('結束日期不能早於開始日期', 'error');
      return;
    }
    if (state.editingTripId) {
      updateTrip(state.editingTripId, name, dest, start, end);
      showToast('行程已更新');
    } else {
      createTrip(name, dest, start, end);
      showToast('行程已建立');
    }
    state.editingTripId = null;
    closeModal('tripModal');
    render();
  });

  document.getElementById('btnEditTrip').addEventListener('click', () => {
    const trip = getCurrentTrip();
    if (trip) openTripModal(trip);
  });

  document.getElementById('btnDeleteTrip').addEventListener('click', () => {
    const trip = getCurrentTrip();
    if (!trip) return;
    if (confirm(`確定要刪除「${trip.name}」嗎？此操作無法復原。`)) {
      deleteTrip(trip.id);
      showToast('行程已刪除');
      render();
    }
  });

  // Activity
  document.getElementById('btnAddActivity').addEventListener('click', () => openActivityModal());
  document.getElementById('activityForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      time: document.getElementById('actTime').value,
      title: document.getElementById('actTitle').value.trim(),
      location: document.getElementById('actLocation').value.trim(),
      lat: document.getElementById('actLat').value,
      lng: document.getElementById('actLng').value,
      notes: document.getElementById('actNotes').value.trim(),
      category: document.getElementById('actCategory').value
    };
    if (!data.title) return;
    if (state.editingActivityId) {
      updateActivity(state.currentDayIndex, state.editingActivityId, data);
      showToast('活動已更新');
    } else {
      addActivity(state.currentDayIndex, data);
      showToast('活動已新增');
    }
    state.editingActivityId = null;
    closeModal('activityModal');
    render();
  });

  document.getElementById('btnGeocode').addEventListener('click', async () => {
    const q = document.getElementById('actLocation').value.trim();
    const status = document.getElementById('geocodeStatus');
    if (!q) {
      status.textContent = '請先輸入地點名稱';
      status.classList.remove('hidden');
      return;
    }
    status.textContent = '搜尋中…';
    status.classList.remove('hidden');
    try {
      const result = await geocode(q);
      if (result) {
        document.getElementById('actLat').value = result.lat.toFixed(6);
        document.getElementById('actLng').value = result.lng.toFixed(6);
        status.textContent = `找到：${result.display.slice(0, 60)}…`;
        showToast('座標已填入');
      } else {
        status.textContent = '找不到該地點，請手動輸入座標';
      }
    } catch (err) {
      status.textContent = '搜尋失敗，請稍後再試或手動輸入';
    }
  });

  // Flights
  document.getElementById('outboundFlightForm').addEventListener('submit', e => {
    e.preventDefault();
    saveFlight('outbound', {
      airline: document.getElementById('outAirline').value.trim(),
      flightNo: document.getElementById('outFlightNo').value.trim(),
      from: document.getElementById('outFrom').value.trim(),
      to: document.getElementById('outTo').value.trim(),
      departDate: document.getElementById('outDepartDate').value,
      departTime: document.getElementById('outDepartTime').value,
      arriveDate: document.getElementById('outArriveDate').value,
      arriveTime: document.getElementById('outArriveTime').value,
      baggage: document.getElementById('outBaggage').value.trim(),
      notes: document.getElementById('outNotes').value.trim()
    });
    showToast('去程航班已儲存');
  });

  document.getElementById('returnFlightForm').addEventListener('submit', e => {
    e.preventDefault();
    saveFlight('return', {
      airline: document.getElementById('retAirline').value.trim(),
      flightNo: document.getElementById('retFlightNo').value.trim(),
      from: document.getElementById('retFrom').value.trim(),
      to: document.getElementById('retTo').value.trim(),
      departDate: document.getElementById('retDepartDate').value,
      departTime: document.getElementById('retDepartTime').value,
      arriveDate: document.getElementById('retArriveDate').value,
      arriveTime: document.getElementById('retArriveTime').value,
      baggage: document.getElementById('retBaggage').value.trim(),
      notes: document.getElementById('retNotes').value.trim()
    });
    showToast('回程航班已儲存');
  });

  // Packing
  document.getElementById('btnAddPacking').addEventListener('click', () => openPackingModal());
  document.getElementById('btnLoadDefaultPacking').addEventListener('click', () => {
    loadDefaultPacking();
    render();
  });
  document.getElementById('packingForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      category: document.getElementById('packCategory').value,
      name: document.getElementById('packName').value.trim(),
      qty: document.getElementById('packQty').value
    };
    if (!data.name) return;
    if (state.editingPackingId) {
      updatePackingItem(state.editingPackingId, data);
      showToast('項目已更新');
    } else {
      addPackingItem(data);
      showToast('項目已新增');
    }
    state.editingPackingId = null;
    closeModal('packingModal');
    render();
  });

  // Expense
  document.getElementById('btnAddExpense').addEventListener('click', () => openExpenseModal());
  document.getElementById('expenseForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      category: document.getElementById('expCategory').value,
      name: document.getElementById('expName').value.trim(),
      amount: document.getElementById('expAmount').value,
      currency: document.getElementById('expCurrency').value,
      date: document.getElementById('expDate').value,
      taxRefund: document.getElementById('expTaxRefund').checked,
      notes: document.getElementById('expNotes').value.trim()
    };
    if (!data.name) return;
    if (state.editingExpenseId) {
      updateExpense(state.editingExpenseId, data);
      showToast('支出已更新');
    } else {
      addExpense(data);
      showToast('支出已新增');
    }
    state.editingExpenseId = null;
    closeModal('expenseModal');
    render();
  });

  // Shopping
  document.getElementById('btnAddShopping').addEventListener('click', () => openShoppingModal());
  document.getElementById('shoppingForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      category: document.getElementById('shopCategory').value,
      name: document.getElementById('shopName').value.trim(),
      qty: document.getElementById('shopQty').value,
      buyer: document.getElementById('shopBuyer').value.trim(),
      photo: state.tempPhotoBase64,
      notes: document.getElementById('shopNotes').value.trim()
    };
    if (!data.name) return;
    if (state.editingShoppingId) {
      // keep existing photo if no new one
      const trip = getCurrentTrip();
      const existing = trip.shoppingList.find(i => i.id === state.editingShoppingId);
      if (state.tempPhotoBase64 === null && existing) data.photo = existing.photo;
      updateShoppingItem(state.editingShoppingId, data);
      showToast('項目已更新');
    } else {
      addShoppingItem(data);
      showToast('項目已新增');
    }
    state.editingShoppingId = null;
    state.tempPhotoBase64 = null;
    closeModal('shoppingModal');
    render();
  });

  // Photo handling (shopping)
  document.getElementById('shopPhoto').addEventListener('change', e => {
    const file = e.target.files[0];
    showPhotoError('shopPhotoError', null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      const msg = '上傳失敗：請選擇圖片檔案（JPG、PNG、WebP 等）';
      showPhotoError('shopPhotoError', msg);
      showToast(msg, 'error');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      const msg = `上傳失敗：檔案太大（${formatFileSize(file.size)}），上限為 1.5 MB。請壓縮後再試。`;
      showPhotoError('shopPhotoError', msg);
      showToast(msg, 'error');
      e.target.value = '';
      state.tempPhotoBase64 = null;
      document.getElementById('shopPhotoPreview').classList.add('hidden');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      state.tempPhotoBase64 = ev.target.result;
      document.getElementById('shopPhotoImg').src = ev.target.result;
      document.getElementById('shopPhotoPreview').classList.remove('hidden');
      showPhotoError('shopPhotoError', null);
    };
    reader.onerror = () => {
      const msg = '上傳失敗：無法讀取此檔案，請換一張圖片再試';
      showPhotoError('shopPhotoError', msg);
      showToast(msg, 'error');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btnClearPhoto').addEventListener('click', () => {
    state.tempPhotoBase64 = null;
    document.getElementById('shopPhoto').value = '';
    document.getElementById('shopPhotoPreview').classList.add('hidden');
    showPhotoError('shopPhotoError', null);
  });

  // Transport - Route
  document.getElementById('btnAddRoute').addEventListener('click', () => openRouteModal());
  document.getElementById('routeForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      title: document.getElementById('routeTitle').value.trim(),
      photo: state.tempRoutePhotoBase64,
      notes: document.getElementById('routeNotes').value.trim()
    };
    if (!data.title) return;
    if (state.editingRouteId) {
      const trip = getCurrentTrip();
      const existing = trip.routeMaps.find(i => i.id === state.editingRouteId);
      if (state.tempRoutePhotoBase64 === null && existing) data.photo = existing.photo;
      updateRouteMap(state.editingRouteId, data);
      showToast('路線圖已更新');
    } else {
      addRouteMap(data);
      showToast('路線圖已新增');
    }
    state.editingRouteId = null;
    state.tempRoutePhotoBase64 = null;
    closeModal('routeModal');
    render();
  });

  document.getElementById('routePhoto').addEventListener('change', e => {
    const file = e.target.files[0];
    showPhotoError('routePhotoError', null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      const msg = '上傳失敗：請選擇圖片檔案（JPG、PNG、WebP 等）';
      showPhotoError('routePhotoError', msg);
      showToast(msg, 'error');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      const msg = `上傳失敗：檔案太大（${formatFileSize(file.size)}），上限為 1.5 MB。請壓縮後再試。`;
      showPhotoError('routePhotoError', msg);
      showToast(msg, 'error');
      e.target.value = '';
      state.tempRoutePhotoBase64 = null;
      document.getElementById('routePhotoPreview').classList.add('hidden');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      state.tempRoutePhotoBase64 = ev.target.result;
      document.getElementById('routePhotoImg').src = ev.target.result;
      document.getElementById('routePhotoPreview').classList.remove('hidden');
      showPhotoError('routePhotoError', null);
    };
    reader.onerror = () => {
      const msg = '上傳失敗：無法讀取此檔案，請換一張圖片再試';
      showPhotoError('routePhotoError', msg);
      showToast(msg, 'error');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btnClearRoutePhoto').addEventListener('click', () => {
    state.tempRoutePhotoBase64 = null;
    document.getElementById('routePhoto').value = '';
    document.getElementById('routePhotoPreview').classList.add('hidden');
    showPhotoError('routePhotoError', null);
  });

  // Transport - Timetable
  document.getElementById('btnAddTimetable').addEventListener('click', () => openTimetableModal());
  document.getElementById('timetableForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      title: document.getElementById('ttTitle').value.trim(),
      url: document.getElementById('ttUrl').value.trim(),
      notes: document.getElementById('ttNotes').value.trim()
    };
    if (!data.title || !data.url) return;
    if (state.editingTimetableId) {
      updateTimetableLink(state.editingTimetableId, data);
      showToast('時刻表連結已更新');
    } else {
      addTimetableLink(data);
      showToast('時刻表連結已新增');
    }
    state.editingTimetableId = null;
    closeModal('timetableModal');
    render();
  });

  // Hotels
  document.getElementById('btnAddHotel').addEventListener('click', () => openHotelModal());
  document.getElementById('hotelForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      name: document.getElementById('hotelName').value.trim(),
      checkInDate: document.getElementById('hotelCheckInDate').value,
      checkOutDate: document.getElementById('hotelCheckOutDate').value,
      checkInTime: document.getElementById('hotelCheckInTime').value,
      checkOutTime: document.getElementById('hotelCheckOutTime').value,
      breakfast: document.getElementById('hotelBreakfast').value,
      facilities: document.getElementById('hotelFacilities').value.trim(),
      notes: document.getElementById('hotelNotes').value.trim(),
      pdf: state.tempHotelPdf
    };
    if (!data.name) return;
    if (state.editingHotelId) {
      const trip = getCurrentTrip();
      const existing = trip.hotels.find(i => i.id === state.editingHotelId);
      if (state.tempHotelPdf === null && existing) data.pdf = existing.pdf;
      updateHotel(state.editingHotelId, data);
      showToast('飯店資訊已更新');
    } else {
      addHotel(data);
      showToast('飯店已新增');
    }
    state.editingHotelId = null;
    state.tempHotelPdf = null;
    closeModal('hotelModal');
    render();
  });

  document.getElementById('hotelPdf').addEventListener('change', e => {
    const file = e.target.files[0];
    showPhotoError('hotelPdfError', null);
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      const msg = '上傳失敗：請選擇 PDF 檔案';
      showPhotoError('hotelPdfError', msg);
      showToast(msg, 'error');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      const msg = `上傳失敗：檔案太大（${formatFileSize(file.size)}），上限為 2 MB。請壓縮後再試。`;
      showPhotoError('hotelPdfError', msg);
      showToast(msg, 'error');
      e.target.value = '';
      state.tempHotelPdf = null;
      document.getElementById('hotelPdfPreview').classList.add('hidden');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      state.tempHotelPdf = { name: file.name, data: ev.target.result };
      document.getElementById('hotelPdfName').textContent = file.name;
      document.getElementById('hotelPdfPreview').classList.remove('hidden');
      showPhotoError('hotelPdfError', null);
    };
    reader.onerror = () => {
      const msg = '上傳失敗：無法讀取此 PDF，請換一個檔案再試';
      showPhotoError('hotelPdfError', msg);
      showToast(msg, 'error');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btnClearHotelPdf').addEventListener('click', () => {
    state.tempHotelPdf = null;
    document.getElementById('hotelPdf').value = '';
    document.getElementById('hotelPdfPreview').classList.add('hidden');
    showPhotoError('hotelPdfError', null);
  });

  // Export / Print
  document.getElementById('btnExport').addEventListener('click', () => {
    const trip = getCurrentTrip();
    if (!trip) return;
    const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已匯出 JSON');
  });

  document.getElementById('btnPrint').addEventListener('click', () => window.print());

  // Close modals
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeAllModals());
  });
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', () => closeAllModals());
  });

  // Delegated events
  document.addEventListener('click', e => {
    // Day switch
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) {
      state.currentDayIndex = parseInt(dayBtn.dataset.day, 10);
      render();
      return;
    }

    // Activity edit/delete
    const editAct = e.target.closest('.edit-act');
    if (editAct) {
      const trip = getCurrentTrip();
      const act = trip.days[state.currentDayIndex].activities.find(a => a.id === editAct.dataset.id);
      if (act) openActivityModal(act);
      return;
    }
    const delAct = e.target.closest('.del-act');
    if (delAct) {
      if (confirm('確定刪除此活動？')) {
        deleteActivity(state.currentDayIndex, delAct.dataset.id);
        showToast('活動已刪除');
        render();
      }
      return;
    }

    // Click activity to focus map
    const card = e.target.closest('.activity-card');
    if (card && !e.target.closest('.act-actions')) {
      const trip = getCurrentTrip();
      const act = trip.days[state.currentDayIndex].activities.find(a => a.id === card.dataset.actId);
      if (act && act.lat != null) focusMarker(act.lat, act.lng);
      return;
    }

    // Packing
    const packCheck = e.target.closest('.pack-check');
    if (packCheck) {
      togglePackingChecked(packCheck.dataset.id);
      render();
      return;
    }
    const editPack = e.target.closest('.edit-pack');
    if (editPack) {
      const trip = getCurrentTrip();
      const item = trip.packingList.find(i => i.id === editPack.dataset.id);
      if (item) openPackingModal(item);
      return;
    }
    const delPack = e.target.closest('.del-pack');
    if (delPack) {
      if (confirm('確定刪除此項目？')) {
        deletePackingItem(delPack.dataset.id);
        showToast('已刪除');
        render();
      }
      return;
    }

    // Expense
    const editExp = e.target.closest('.edit-exp');
    if (editExp) {
      const trip = getCurrentTrip();
      const item = trip.expenses.find(i => i.id === editExp.dataset.id);
      if (item) openExpenseModal(item);
      return;
    }
    const delExp = e.target.closest('.del-exp');
    if (delExp) {
      if (confirm('確定刪除此支出？')) {
        deleteExpense(delExp.dataset.id);
        showToast('已刪除');
        render();
      }
      return;
    }

    // Shopping
    const shopDone = e.target.closest('.shop-done');
    if (shopDone) {
      toggleShoppingDone(shopDone.dataset.id);
      render();
      return;
    }
    const editShop = e.target.closest('.edit-shop');
    if (editShop) {
      const trip = getCurrentTrip();
      const item = trip.shoppingList.find(i => i.id === editShop.dataset.id);
      if (item) openShoppingModal(item);
      return;
    }
    const delShop = e.target.closest('.del-shop');
    if (delShop) {
      if (confirm('確定刪除此項目？')) {
        deleteShoppingItem(delShop.dataset.id);
        showToast('已刪除');
        render();
      }
      return;
    }

    // Route maps
    const editRoute = e.target.closest('.edit-route');
    if (editRoute) {
      const trip = getCurrentTrip();
      const item = trip.routeMaps.find(i => i.id === editRoute.dataset.id);
      if (item) openRouteModal(item);
      return;
    }
    const delRoute = e.target.closest('.del-route');
    if (delRoute) {
      if (confirm('確定刪除此路線圖？')) {
        deleteRouteMap(delRoute.dataset.id);
        showToast('已刪除');
        render();
      }
      return;
    }

    // Timetable links
    const editTt = e.target.closest('.edit-tt');
    if (editTt) {
      const trip = getCurrentTrip();
      const item = trip.timetableLinks.find(i => i.id === editTt.dataset.id);
      if (item) openTimetableModal(item);
      return;
    }
    const delTt = e.target.closest('.del-tt');
    if (delTt) {
      if (confirm('確定刪除此時刻表連結？')) {
        deleteTimetableLink(delTt.dataset.id);
        showToast('已刪除');
        render();
      }
      return;
    }

    // Hotels
    const editHotel = e.target.closest('.edit-hotel');
    if (editHotel) {
      const trip = getCurrentTrip();
      const item = trip.hotels.find(i => i.id === editHotel.dataset.id);
      if (item) openHotelModal(item);
      return;
    }
    const delHotel = e.target.closest('.del-hotel');
    if (delHotel) {
      if (confirm('確定刪除此飯店資訊？')) {
        deleteHotel(delHotel.dataset.id);
        showToast('已刪除');
        render();
      }
      return;
    }
    const dlPdf = e.target.closest('.download-hotel-pdf');
    if (dlPdf) {
      const trip = getCurrentTrip();
      const item = trip.hotels.find(i => i.id === dlPdf.dataset.id);
      if (item && item.pdf && item.pdf.data) {
        const a = document.createElement('a');
        a.href = item.pdf.data;
        a.download = item.pdf.name || 'booking.pdf';
        a.click();
      }
      return;
    }

    // Select trip
    const tripBtn = e.target.closest('[data-trip-id]');
    if (tripBtn) {
      state.currentTripId = tripBtn.dataset.tripId;
      state.currentDayIndex = 0;
      state.currentTab = 'itinerary';
      saveData();
      closeModal('tripsModal');
      render();
    }
  });
}

function openTripModal(trip = null) {
  state.editingTripId = trip ? trip.id : null;
  document.getElementById('tripModalTitle').textContent = trip ? '編輯行程' : '新增行程';
  document.getElementById('tripName').value = trip ? trip.name : '';
  document.getElementById('tripDest').value = trip ? trip.destination : '';
  document.getElementById('tripStart').value = trip ? trip.startDate : '';
  document.getElementById('tripEnd').value = trip ? trip.endDate : '';
  openModal('tripModal');
}

function openActivityModal(act = null) {
  state.editingActivityId = act ? act.id : null;
  document.getElementById('activityModalTitle').textContent = act ? '編輯活動' : '新增活動';
  document.getElementById('actTime').value = act ? act.time : '';
  document.getElementById('actTitle').value = act ? act.title : '';
  document.getElementById('actLocation').value = act ? act.location : '';
  document.getElementById('actLat').value = act && act.lat != null ? act.lat : '';
  document.getElementById('actLng').value = act && act.lng != null ? act.lng : '';
  document.getElementById('actNotes').value = act ? act.notes : '';
  document.getElementById('actCategory').value = act ? act.category : 'sightseeing';
  document.getElementById('geocodeStatus').classList.add('hidden');
  openModal('activityModal');
}

function openPackingModal(item = null) {
  state.editingPackingId = item ? item.id : null;
  document.getElementById('packingModalTitle').textContent = item ? '編輯行李項目' : '新增行李項目';
  document.getElementById('packCategory').value = item ? item.category : '衣物';
  document.getElementById('packName').value = item ? item.name : '';
  document.getElementById('packQty').value = item ? item.qty : 1;
  openModal('packingModal');
}

function openExpenseModal(item = null) {
  state.editingExpenseId = item ? item.id : null;
  document.getElementById('expenseModalTitle').textContent = item ? '編輯支出' : '新增支出';
  document.getElementById('expCategory').value = item ? item.category : '吃飯';
  document.getElementById('expName').value = item ? item.name : '';
  document.getElementById('expAmount').value = item ? item.amount : '';
  document.getElementById('expCurrency').value = item ? item.currency : 'TWD';
  document.getElementById('expDate').value = item ? item.date : '';
  document.getElementById('expTaxRefund').checked = item ? !!item.taxRefund : false;
  document.getElementById('expNotes').value = item ? item.notes : '';
  openModal('expenseModal');
}

function openShoppingModal(item = null) {
  state.editingShoppingId = item ? item.id : null;
  state.tempPhotoBase64 = null;
  document.getElementById('shoppingModalTitle').textContent = item ? '編輯需購買項目' : '新增需購買項目';
  document.getElementById('shopCategory').value = item ? item.category : '伴手禮';
  document.getElementById('shopName').value = item ? item.name : '';
  document.getElementById('shopQty').value = item ? item.qty : 1;
  document.getElementById('shopBuyer').value = item ? item.buyer : '';
  document.getElementById('shopNotes').value = item ? item.notes : '';
  document.getElementById('shopPhoto').value = '';
  showPhotoError('shopPhotoError', null);
  if (item && item.photo) {
    state.tempPhotoBase64 = item.photo;
    document.getElementById('shopPhotoImg').src = item.photo;
    document.getElementById('shopPhotoPreview').classList.remove('hidden');
  } else {
    document.getElementById('shopPhotoPreview').classList.add('hidden');
  }
  openModal('shoppingModal');
}

function openRouteModal(item = null) {
  state.editingRouteId = item ? item.id : null;
  state.tempRoutePhotoBase64 = null;
  document.getElementById('routeModalTitle').textContent = item ? '編輯路線圖' : '新增路線圖';
  document.getElementById('routeTitle').value = item ? item.title : '';
  document.getElementById('routeNotes').value = item ? item.notes : '';
  document.getElementById('routePhoto').value = '';
  showPhotoError('routePhotoError', null);
  if (item && item.photo) {
    state.tempRoutePhotoBase64 = item.photo;
    document.getElementById('routePhotoImg').src = item.photo;
    document.getElementById('routePhotoPreview').classList.remove('hidden');
  } else {
    document.getElementById('routePhotoPreview').classList.add('hidden');
  }
  openModal('routeModal');
}

function openTimetableModal(item = null) {
  state.editingTimetableId = item ? item.id : null;
  document.getElementById('timetableModalTitle').textContent = item ? '編輯時刻表連結' : '新增時刻表連結';
  document.getElementById('ttTitle').value = item ? item.title : '';
  document.getElementById('ttUrl').value = item ? item.url : '';
  document.getElementById('ttNotes').value = item ? item.notes : '';
  openModal('timetableModal');
}

function openHotelModal(item = null) {
  state.editingHotelId = item ? item.id : null;
  state.tempHotelPdf = null;
  document.getElementById('hotelModalTitle').textContent = item ? '編輯飯店' : '新增飯店';
  document.getElementById('hotelName').value = item ? item.name : '';
  document.getElementById('hotelCheckInDate').value = item ? item.checkInDate : '';
  document.getElementById('hotelCheckOutDate').value = item ? item.checkOutDate : '';
  document.getElementById('hotelCheckInTime').value = item ? item.checkInTime : '';
  document.getElementById('hotelCheckOutTime').value = item ? item.checkOutTime : '';
  document.getElementById('hotelBreakfast').value = item ? item.breakfast : 'unknown';
  document.getElementById('hotelFacilities').value = item ? item.facilities : '';
  document.getElementById('hotelNotes').value = item ? item.notes : '';
  document.getElementById('hotelPdf').value = '';
  showPhotoError('hotelPdfError', null);
  if (item && item.pdf) {
    state.tempHotelPdf = item.pdf;
    document.getElementById('hotelPdfName').textContent = item.pdf.name || 'booking.pdf';
    document.getElementById('hotelPdfPreview').classList.remove('hidden');
  } else {
    document.getElementById('hotelPdfPreview').classList.add('hidden');
  }
  openModal('hotelModal');
}

// ========== Init ==========
function init() {
  loadData();
  bindEvents();
  render();
  if (getCurrentTrip() && state.currentTab === 'itinerary') {
    setTimeout(() => {
      initMap();
      updateMapMarkers();
    }, 100);
  }
}

document.addEventListener('DOMContentLoaded', init);
