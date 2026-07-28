const EMAIL_DOMAIN = '@ifto.edu.br';

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const recoveryTab = document.getElementById('recoveryTab');
const loginFormSection = document.getElementById('loginForm');
const registerFormSection = document.getElementById('registerForm');
const recoveryFormSection = document.getElementById('recoveryForm');
const loginMessage = document.getElementById('loginMessage');
const addDeviceMessage = document.getElementById('addDeviceMessage');
const profileMessage = document.getElementById('profileMessage');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const headerActions = document.getElementById('headerActions');
const navToggle = document.getElementById('navToggle');
const deviceList = document.getElementById('deviceList');
const totalDevicesEl = document.getElementById('totalDevices');
const availableDevicesEl = document.getElementById('availableDevices');
const inUseDevicesEl = document.getElementById('inUseDevices');
const maintenanceDevicesEl = document.getElementById('maintenanceDevices');

const sections = Array.from(document.querySelectorAll('.tab-section'));
const navButtons = Array.from(document.querySelectorAll('.header-nav-btn'));
const headerNav = document.querySelector('.header-nav');
const reservationsList = document.getElementById('reservationsList');

const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const registerName = document.getElementById('registerName');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerConfirmPassword = document.getElementById('registerConfirmPassword');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const profilePassword = document.getElementById('profilePassword');
const recoveryEmail = document.getElementById('recoveryEmail');

const addDeviceForm = document.getElementById('addDeviceForm');
const deviceNameInput = document.getElementById('deviceName');
const deviceStatusSelect = document.getElementById('deviceStatus');

const profileForm = document.getElementById('profileForm');
const loginForm = loginFormSection.querySelector('form');
const registerForm = registerFormSection.querySelector('form');
const recoveryRequestForm = document.getElementById('recoveryRequestForm');

let currentUser = null;
let currentDevices = [];
let autoRefreshInterval = null;
let isSwitchingAuthTab = false;

function showMessage(element, message, success = false) {
  element.textContent = message;
  element.style.color = success ? '#2f80ed' : '#eb5757';
}

function resetMessages() {
  loginMessage.textContent = '';
  addDeviceMessage.textContent = '';
  profileMessage.textContent = '';
}

function switchAuthTab(tab) {
  const authTabs = {
    login: { button: loginTab, section: loginFormSection },
    register: { button: registerTab, section: registerFormSection },
    recovery: { button: recoveryTab, section: recoveryFormSection }
  };
  const next = authTabs[tab];
  const current = Object.values(authTabs).find(item => !item.section.classList.contains('hidden'));

  if (isSwitchingAuthTab || !next || !current || current === next) return;

  isSwitchingAuthTab = true;
  current.section.classList.add('auth-section-leaving');

  setTimeout(() => {
    Object.values(authTabs).forEach(item => item.button.classList.toggle('active', item === next));
    current.section.classList.remove('auth-section-leaving');
    current.section.classList.add('hidden');
    next.section.classList.remove('hidden');
    next.section.classList.add('auth-section-entering');
    resetMessages();

    setTimeout(() => {
      next.section.classList.remove('auth-section-entering');
      isSwitchingAuthTab = false;
    }, 320);
  }, 140);
}

function showSection(targetId) {
  sections.forEach(section => section.classList.toggle('hidden', section.id !== targetId));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetId));
  headerNav.classList.remove('is-open');
  if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('pt-BR');
}

function updateDashboardStats() {
  const devices = currentDevices;
  totalDevicesEl.textContent = devices.length;
  availableDevicesEl.textContent = devices.filter(d => d.status === 'Disponível').length;
  inUseDevicesEl.textContent = devices.filter(d => d.status === 'Em uso').length;
  maintenanceDevicesEl.textContent = devices.filter(d => d.status === 'Em manutenção').length;
}

function renderReservationsList() {
  reservationsList.innerHTML = '';
  
  // Coletar todas as reservas de todos os aparelhos
  const allReservations = [];
  currentDevices.forEach(device => {
    if (device.reservations && device.reservations.length > 0) {
      device.reservations.forEach(res => {
        allReservations.push({
          ...res,
          deviceName: device.name,
          deviceId: device.id
        });
      });
    }
  });

  // Se não houver reservas, mostra mensagem vazia
  if (allReservations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-reservations';
    empty.textContent = 'Nenhum horário reservado.';
    reservationsList.appendChild(empty);
    return;
  }

  // Ordena por data e hora
  allReservations.sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.hour}`);
    const dateB = new Date(`${b.date}T${b.hour}`);
    return dateA - dateB;
  });

  // Renderiza cada reserva
  allReservations.forEach(reservation => {
    const card = document.createElement('div');
    card.className = 'reservation-item';
    card.innerHTML = `
      <h4>${reservation.deviceName}</h4>
      <p><strong>Reservado por:</strong> ${reservation.userName}</p>
      <p><strong>E-mail:</strong> ${reservation.userEmail}</p>
      <div class="reservation-time">
        📅 ${formatDate(reservation.date)} às ${reservation.hour}
      </div>
    `;
    reservationsList.appendChild(card);
  });
}

function buildDeviceCard(device) {
  const card = document.createElement('article');
  card.className = 'device-card';
  const statusClass = device.status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');

  const header = document.createElement('div');
  header.className = 'device-header';
  header.innerHTML = `
    <div>
      <h3>${device.name}</h3>
      <p>ID: ${device.id}</p>
    </div>
    <span class="status-pill status-${statusClass}">${device.status}</span>
  `;
  card.appendChild(header);

  const description = document.createElement('p');
  description.style.color = '#475569';
  description.textContent = `Criado em ${formatDate(device.createdAt)}.`;
  card.appendChild(description);

  if (device.status === 'Disponível') {
    const reserveSection = document.createElement('div');
    reserveSection.className = 'schedule-grid';
    reserveSection.innerHTML = `
      <div>
        <label>Selecione a data</label>
        <input type="date" min="${new Date().toISOString().slice(0, 10)}" value="${new Date().toISOString().slice(0, 10)}" class="reserve-date" />
      </div>
      <div class="reserve-row">
        <select class="reserve-hour"></select>
        <button class="reserve-button">Reservar horário</button>
      </div>
      <div class="slot-list"></div>
      <p class="reserve-message" role="status" aria-live="polite"></p>
    `;

    const hourSelect = reserveSection.querySelector('.reserve-hour');
    const dateInput = reserveSection.querySelector('.reserve-date');
    const reserveButton = reserveSection.querySelector('.reserve-button');
    const slotList = reserveSection.querySelector('.slot-list');
    const reserveMessage = reserveSection.querySelector('.reserve-message');

    const ALL_HOURS = [];
    for (let hour = 8; hour <= 18; hour += 2) ALL_HOURS.push(`${hour}:00`);

    function populateHourOptions(chosenDate) {
      const reserved = (device.reservations || []).filter(r => r.date === chosenDate).map(r => r.hour);
      hourSelect.innerHTML = '';
      const available = ALL_HOURS.filter(h => !reserved.includes(h));

      if (available.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Nenhum horário disponível';
        hourSelect.appendChild(option);
        hourSelect.disabled = true;
        reserveButton.disabled = true;
        return;
      }

      available.forEach(h => {
        const hourNum = parseInt(h.split(':')[0], 10);
        const option = document.createElement('option');
        option.value = h;
        option.textContent = `${String(hourNum).padStart(2, '0')}:00 - ${String(hourNum + 2).padStart(2, '0')}:00`;
        hourSelect.appendChild(option);
      });
      hourSelect.disabled = false;
      reserveButton.disabled = false;
    }

    function renderSlots() {
      const chosenDate = dateInput.value;
      slotList.innerHTML = '';
      const sorted = [...(device.reservations || [])].sort((a, b) => a.hour.localeCompare(b.hour));
      const dayReservations = sorted.filter(r => r.date === chosenDate).map(r => r.hour);

      // Mostrar apenas horários disponíveis
      const available = ALL_HOURS.filter(h => !dayReservations.includes(h));

      if (available.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Nenhum horário disponível para a data selecionada.';
        empty.style.color = '#475569';
        slotList.appendChild(empty);
        updateReserveButtonState();
        return;
      }

      available.forEach(hour => {
        const slot = document.createElement('div');
        slot.className = 'slot-item available fade-in';
        slot.dataset.hour = hour;
        slot.innerHTML = `
          <strong>${hour}</strong>
          <button class="slot-reserve-btn">Reservar</button>
        `;

        // clique rápido no slot preenche o select e foca no botão principal
        slot.querySelector('.slot-reserve-btn').addEventListener('click', () => {
          hourSelect.value = hour;
          updateReserveButtonState();
          reserveButton.focus();
        });

        slotList.appendChild(slot);
      });

      // synchronize select options with availability
      populateHourOptions(chosenDate);
      updateReserveButtonState();
    }

    function updateReserveButtonState() {
      const chosenDate = dateInput.value;
      const chosenHour = hourSelect.value;
      const isReserved = device.reservations.some(r => r.date === chosenDate && r.hour === chosenHour);
      
      if (isReserved) {
        reserveButton.disabled = true;
        reserveButton.textContent = '✓ Horário reservado';
        reserveButton.classList.add('reserved-state');
        reserveMessage.textContent = 'Este aparelho já está reservado nesse horário.';
      } else {
        reserveButton.disabled = false;
        reserveButton.textContent = 'Reservar horário';
        reserveButton.classList.remove('reserved-state');
        reserveMessage.textContent = '';
      }
    }

    reserveButton.addEventListener('click', async () => {
      const chosenDate = dateInput.value;
      const chosenHour = hourSelect.value;
      const existing = device.reservations.find(r => r.date === chosenDate && r.hour === chosenHour);

      if (existing) {
        showMessage(addDeviceMessage, `Horário já reservado: ${chosenHour} em ${formatDate(chosenDate)}.`);
        return;
      }

      try {
        reserveButton.disabled = true;
        reserveButton.textContent = 'Confirmando reserva...';
        const { reservation } = await reserveDeviceApi(device.id, chosenDate, chosenHour);

        // atualiza apenas o dispositivo localmente para resposta rápida
        device.reservations.push(reservation);

        // animação: encontra o slot disponível correspondente e mostra reservado
        const targetSlot = slotList.querySelector(`.slot-item[data-hour="${chosenHour}"]`);
        if (targetSlot) {
          targetSlot.classList.remove('available', 'fade-in');
          targetSlot.classList.add('reserved', 'reserved-animate');
          targetSlot.innerHTML = `\n            <strong>${chosenHour} — Horário reservado</strong>\n            <span>Reservado por ${reservation.userName}</span>\n          `;
          // remove o elemento após animação (opcional) e re-renderiza os slots
          setTimeout(() => {
            renderSlots();
          }, 620);
        } else {
          // se não encontrou slot (por exemplo, lista vazia), apenas re-renderiza
          renderSlots();
        }

        renderReservationsList();
        reserveMessage.textContent = `Horário reservado para ${formatDate(chosenDate)} às ${chosenHour}.`;
        reserveMessage.classList.add('success');
        // mantemos o loadDevices para garantir consistência no backend
        setTimeout(loadDevices, 700);
      } catch (error) {
        reserveMessage.textContent = error.message;
        reserveMessage.classList.remove('success');
        await loadDevices();
      }
    });

    dateInput.addEventListener('change', renderSlots);
    hourSelect.addEventListener('change', () => {
      updateReserveButtonState();
    });
    card.appendChild(reserveSection);
    renderSlots();
  } else {
    const message = document.createElement('p');
    message.style.marginTop = '16px';
    message.style.color = '#475569';
    message.textContent = device.status === 'Em manutenção'
      ? 'Este aparelho está em manutenção e não pode ser reservado.'
      : 'Este aparelho está em uso e não pode ser reservado até liberar.';
    card.appendChild(message);

    if (device.reservations.length > 0) {
      const slotList = document.createElement('div');
      slotList.className = 'slot-list';
      device.reservations.forEach(reservation => {
        const slot = document.createElement('div');
        slot.className = 'slot-item';
        slot.innerHTML = `
          <strong>${reservation.hour} - ${formatDate(reservation.date)}</strong>
          <span>Reservado por ${reservation.userName}</span>
        `;
        slotList.appendChild(slot);
      });
      card.appendChild(slotList);
    }
  }

  return card;
}

function renderDeviceList() {
  deviceList.innerHTML = '';

  if (currentDevices.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = '<p>Nenhum aparelho cadastrado ainda. Vá para a aba de cadastro para adicionar.</p>';
    deviceList.appendChild(empty);
    return;
  }

  currentDevices.forEach(device => {
    deviceList.appendChild(buildDeviceCard(device));
  });
}

function loadProfile(user) {
  if (!user) return;
  profileName.value = user.name;
  profileEmail.value = user.email;
  profilePhone.value = user.phone || '';
}

function showApp() {
  loginScreen.classList.remove('active');
  appScreen.classList.add('active');
  logoutBtn.classList.remove('hidden');
  if (headerActions) headerActions.classList.remove('hidden');
  if (headerNav) headerNav.classList.remove('hidden');
  if (!currentUser) return;
  userNameDisplay.textContent = currentUser.name;
  updateDashboardStats();
  renderReservationsList();
  renderDeviceList();
  loadProfile(currentUser);
  showSection('dashboardSection');
  
  // Auto-refresh dos aparelhos a cada 5 segundos
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(loadDevices, 5000);
}

function showLogin() {
  loginScreen.classList.add('active');
  appScreen.classList.remove('active');
  logoutBtn.classList.add('hidden');
  if (headerActions) headerActions.classList.add('hidden');
  if (headerNav) {
    headerNav.classList.add('hidden');
    headerNav.classList.remove('is-open');
  }
  if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  loginScreen.scrollIntoView({ behavior: 'smooth' });
}

async function loadDevices() {
  try {
    const response = await getDevicesApi();
    currentDevices = response.devices || [];
    updateDashboardStats();
    renderReservationsList();
    renderDeviceList();
  } catch (error) {
    showMessage(addDeviceMessage, error.message);
  }
}

loginTab.addEventListener('click', () => switchAuthTab('login'));
registerTab.addEventListener('click', () => switchAuthTab('register'));
recoveryTab.addEventListener('click', () => switchAuthTab('recovery'));

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  resetMessages();
  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPassword.value;

  try {
    const { token, user } = await loginApi(email, password);
    setAuthToken(token);
    currentUser = user;
    await loadDevices();
    showApp();
  } catch (error) {
    showMessage(loginMessage, error.message);
  }
});

registerForm.addEventListener('submit', async event => {
  event.preventDefault();
  resetMessages();

  const name = registerName.value.trim();
  const email = registerEmail.value.trim().toLowerCase();
  const password = registerPassword.value;
  const confirmPassword = registerConfirmPassword.value;

  if (!name || !email || !password) {
    showMessage(loginMessage, 'Preencha todos os campos do cadastro.');
    return;
  }

  if (!email.endsWith(EMAIL_DOMAIN)) {
    showMessage(loginMessage, `Use um e-mail válido do IFTO (${EMAIL_DOMAIN}).`);
    return;
  }

  if (password !== confirmPassword) {
    showMessage(loginMessage, 'As senhas não correspondem.');
    return;
  }

  try {
    const { token, user } = await registerApi(name, email, password, '');
    setAuthToken(token);
    currentUser = user;
    await loadDevices();
    showApp();
  } catch (error) {
    showMessage(loginMessage, error.message);
  }
});

recoveryRequestForm.addEventListener('submit', event => {
  event.preventDefault();
  const email = recoveryEmail.value.trim().toLowerCase();

  if (!email.endsWith(EMAIL_DOMAIN)) {
    showMessage(loginMessage, `Use um e-mail válido do IFTO (${EMAIL_DOMAIN}).`);
    return;
  }

  showMessage(loginMessage, 'Solicitação recebida. Procure a equipe responsável do campus para concluir a redefinição da senha.', true);
});

logoutBtn.addEventListener('click', () => {
  logoutApi();
  currentUser = null;
  currentDevices = [];
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  showLogin();
});

addDeviceForm.addEventListener('submit', async event => {
  event.preventDefault();
  resetMessages();

  const name = deviceNameInput.value.trim();
  const status = deviceStatusSelect.value;

  if (!name) {
    showMessage(addDeviceMessage, 'Informe o nome do aparelho.');
    return;
  }

  try {
    await addDeviceApi(name, status);
    deviceNameInput.value = '';
    deviceStatusSelect.value = 'Disponível';
    showMessage(addDeviceMessage, 'Aparelho cadastrado com sucesso.', true);
    await loadDevices();
  } catch (error) {
    showMessage(addDeviceMessage, error.message);
  }
});

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  resetMessages();

  if (!currentUser) return;

  const name = profileName.value.trim();
  const phone = profilePhone.value.trim();
  const password = profilePassword.value.trim();

  try {
    const { user } = await updateProfileApi({ name, phone, password });
    currentUser = user;
    profilePassword.value = '';
    showMessage(profileMessage, 'Dados atualizados com sucesso.', true);
    userNameDisplay.textContent = currentUser.name;
  } catch (error) {
    showMessage(profileMessage, error.message);
  }
});

navButtons.forEach(button => {
  button.addEventListener('click', () => {
    showSection(button.dataset.target);
  });
});

if (navToggle) {
  navToggle.addEventListener('click', () => {
    const isOpen = headerNav && headerNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  const token = getAuthToken();
  if (!token) {
    showLogin();
    return;
  }

  try {
    const profileResponse = await getProfileApi();
    currentUser = profileResponse.user;
    await loadDevices();
    showApp();
  } catch (error) {
    logoutApi();
    showLogin();
  }
});
