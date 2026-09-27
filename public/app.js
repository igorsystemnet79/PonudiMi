const $ = function(selector) {
  return document.querySelector(selector);
};

const modal = $("#modal");
const dialogBody = $("#dialogBody");

let token = localStorage.getItem("pm_token");

const categories = [
  "Automobili",
  "Nekretnine",
  "Mobilni telefoni",
  "Tehnika",
  "Usluge",
  "Građevina",
  "Poljoprivreda",
  "Moda",
  "Ostalo"
];

const categoryIcons = ["🚗", "🏠", "📱", "💻", "🛠️", "👷", "🚜", "👕", "•••"];

const categoryCounts = [12580, 23120, 15890, 9452, 18760, 8542, 7310, 4125, 0];

const initialCategory = new URLSearchParams(window.location.search).get("category") || "";
let activeCategory = initialCategory;
const categoryImageMap = {
  "Automobili": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=500&h=400&fit=crop",
  "Nekretnine": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&h=400&fit=crop",
  "Mobilni telefoni": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&h=400&fit=crop",
  "Tehnika": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&h=400&fit=crop",
  "Usluge": "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=500&h=400&fit=crop",
  "Građevina": "https://images.unsplash.com/photo-1503387762-592def58ef4e?w=500&h=400&fit=crop",
  "Poljoprivreda": "https://images.unsplash.com/photo-1464227783982-cc95a0c2f3d6?w=500&h=400&fit=crop",
  "Moda": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&h=400&fit=crop",
  "Ostalo": "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=500&h=400&fit=crop"
};

function categoryName(category) {
  return typeof category === "string" ? category : category.name;
}

function categoryImage(category, index) {
  return (category && category.image) || categoryImageMap[categoryName(category)] || "/reference-homepage.png";
}


function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, function(character) {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}

function closeModal() {
  modal.classList.add("hidden");
  dialogBody.innerHTML = "";
}

function openModal(html) {
  dialogBody.innerHTML = html;
  modal.classList.remove("hidden");
}

function updateAuthUI() {
  const loginBtn = $("#loginBtn");
  const registerBtn = $("#registerBtn");
  const userBtn = $("#userBtn");
  const logoutBtn = $("#logoutBtn");

  if (token) {
    if (loginBtn) loginBtn.classList.add("hidden");
    if (registerBtn) registerBtn.classList.add("hidden");
    if (userBtn) userBtn.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
  } else {
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (registerBtn) registerBtn.classList.remove("hidden");
    if (userBtn) userBtn.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
  }
}

function logout() {
  localStorage.removeItem("pm_token");
  token = null;
  updateAuthUI();
  alert("Uspešno ste odjavljeni.");
  window.location.reload();
}

async function api(url, options) {
  const requestOptions = options || {};

  const response = await fetch(url, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(requestOptions.headers || {})
    }
  });

  let data;

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (response.status === 401) {
    localStorage.removeItem("pm_token");
    token = null;
    updateAuthUI();
    throw new Error(data.error || "Prijava je istekla. Molimo prijavite se ponovo.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Došlo je do greške.");
  }

  return data;
}

function renderCategories(categoryList) {
  const categoriesElement = $("#categories");
  const categorySelect = $("#category");

  if (!categoriesElement) {
    return;
  }

  const list = Array.isArray(categoryList) && categoryList.length ? categoryList : categories;

  categoriesElement.innerHTML = list.map(function(category, index) {
    const name = categoryName(category);
    return `
      <a href="#ponude" class="category-card" data-category="${escapeHtml(name)}" aria-label="Pretraži kategoriju ${escapeHtml(name)}">
        <div class="category-image">
          <img src="${escapeHtml(categoryImage(category, index))}" alt="${escapeHtml(name)}" loading="lazy">
        </div>
        <span class="category-name">${escapeHtml(name)}</span>
      </a>
    `;
  }).join("");

  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">Sve kategorije</option>' + list.map(function(category) {
      const name = categoryName(category);
      return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    }).join("");
  }

  categoriesElement.querySelectorAll(".category-card[data-category]").forEach(function(button) {
    button.addEventListener("click", function(event) {
      event.preventDefault();
      activeCategory = button.dataset.category || "";
      if (categorySelect) categorySelect.value = activeCategory;
      doSearch();
      const offers = $("#ponude");
      if (offers) offers.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
function listingImageMarkup(image, title) {
  const safeTitle = escapeHtml(title || "Oglas");

  if (!image) {
    return `<div class="offer-image-placeholder" aria-label="Slika oglasa nije dostupna">📦</div>`;
  }

  const safeImage = escapeHtml(image);

  return `
    <img src="${safeImage}" alt="${safeTitle}" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className: 'offer-image-placeholder', textContent: '📦'}))">
  `;
}

async function doSearch() {
  const searchInput = $("#q");
  const categorySelect = $("#category");
  const locationInput = $("#location");
  const featured = $("#featured");

  if (!searchInput || !locationInput || !featured) {
    return;
  }

  const q = searchInput.value.trim();
  const category = categorySelect ? categorySelect.value.trim() : activeCategory;
  const location = locationInput.value.trim();

  featured.innerHTML = "Učitavanje ponuda…";

  try {
    const data = await api(
      "/api/listings?q=" + encodeURIComponent(q) +
      "&category=" + encodeURIComponent(category) +
      "&location=" + encodeURIComponent(location)
    );

    if (!data.length) {
      featured.innerHTML = "Nema rezultata za izabranu pretragu.";
      return;
    }

    featured.innerHTML = data
      .slice(0, 4)
      .map(function(item) {
        const price = item.price
          ? new Intl.NumberFormat("sr-RS").format(item.price) + " €"
          : "Po dogovoru";

        return `
          <article class="offer-item">
            <div class="offer-image">${listingImageMarkup(item.image, item.title)}</div>
            <div class="offer-info">
              <div class="offer-title">${escapeHtml(item.title)}</div>
              <div class="offer-price">${price}</div>
              <div class="offer-location">${escapeHtml(item.location || "Lokacija nije navedena")}</div>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Početne ponude nisu učitane:", error);
    if (!q && !category && !location && featured.dataset.fallbackMarkup) {
      featured.innerHTML = featured.dataset.fallbackMarkup;
    } else {
      featured.innerHTML = '<span class="error-message">' + escapeHtml(error.message) + "</span>";
    }
  }
}

function register() {
  openModal(`
    <h2>Registracija</h2>

    <div class="tabs">
      <button class="active" id="individualTab" type="button">Fizičko lice</button>
      <button id="companyTab" type="button">Pravno lice</button>
    </div>

    <form id="registerForm">
      <input name="name" placeholder="Ime i prezime" autocomplete="name" required>
      <input name="email" type="email" placeholder="Email" autocomplete="email" required>
      <input name="password" type="password" placeholder="Lozinka (najmanje 6 karaktera)" autocomplete="new-password" minlength="6" required>
      <div id="companyFields"></div>
      <button class="submit" type="submit">Kreiraj nalog</button>
    </form>
  `);

  let accountType = "individual";

  const individualTab = $("#individualTab");
  const companyTab = $("#companyTab");
  const companyFields = $("#companyFields");
  const registerForm = $("#registerForm");

  individualTab.onclick = function() {
    accountType = "individual";
    individualTab.classList.add("active");
    companyTab.classList.remove("active");
    companyFields.innerHTML = "";
  };

  companyTab.onclick = function() {
    accountType = "company";
    companyTab.classList.add("active");
    individualTab.classList.remove("active");
    companyFields.innerHTML = `
      <input name="companyName" placeholder="Naziv firme" autocomplete="organization" required>
      <input name="pib" placeholder="PIB" inputmode="numeric">
    `;
  };

  registerForm.onsubmit = async function(event) {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const values = Object.fromEntries(formData);

    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...values, type: accountType })
      });

      token = data.token;
      localStorage.setItem("pm_token", token);
      updateAuthUI();
      closeModal();
      alert("Registracija je uspešna.");
    } catch (error) {
      alert(error.message);
    }
  };
}

function login() {
  openModal(`
    <h2>Prijava</h2>

    <form id="loginForm">
      <input name="email" type="email" placeholder="Email" autocomplete="email" required>
      <input name="password" type="password" placeholder="Lozinka" autocomplete="current-password" required>
      <button class="submit" type="submit">Prijavi se</button>
    </form>
  `);

  const loginForm = $("#loginForm");

  loginForm.onsubmit = async function(event) {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(loginForm));

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values)
      });

      token = data.token;
      localStorage.setItem("pm_token", token);
      updateAuthUI();
      closeModal();
      alert("Uspešna prijava.");
    } catch (error) {
      alert(error.message);
    }
  };
}

function requireAuth() {
  if (!token) {
    alert("Za ovu opciju potrebna je prijava.");
    login();
    return false;
  }
  return true;
}

function listing() {
  if (!requireAuth()) {
    return;
  }

  openModal(`
    <h2>Objavi oglas</h2>

    <form id="listingForm">
      <input name="title" placeholder="Naslov oglasa" required>
      <select name="category" required>
        ${categories.map(function(category) {
          return `<option value="${escapeHtml(categoryName(category))}">${escapeHtml(categoryName(category))}</option>`;
        }).join("")}
      </select>
      <input name="location" placeholder="Lokacija" required>
      <input name="price" type="number" min="0" step="0.01" placeholder="Cena (€)">
      <input name="image" type="url" placeholder="Link do slike (opciono)">
      <textarea name="description" placeholder="Opis oglasa"></textarea>
      <button class="submit" type="submit">Objavi oglas</button>
    </form>
  `);

  const listingForm = $("#listingForm");

  listingForm.onsubmit = async function(event) {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(listingForm));

    try {
      await api("/api/listings", {
        method: "POST",
        body: JSON.stringify(values)
      });

      closeModal();
      await doSearch();
      alert("Oglas je uspešno objavljen.");
    } catch (error) {
      alert(error.message);
    }
  };
}

function request() {
  if (!requireAuth()) {
    return;
  }

  openModal(`
    <h2>Postavi zahtev</h2>

    <form id="requestForm">
      <input name="title" placeholder="Šta tražite?" required>
      <select name="category">
        <option value="">Kategorija</option>
        ${categories.map(function(category) {
          return `<option value="${escapeHtml(categoryName(category))}">${escapeHtml(categoryName(category))}</option>`;
        }).join("")}
      </select>
      <input name="location" placeholder="Lokacija">
      <input name="budget" type="number" min="0" step="0.01" placeholder="Budžet (€)">
      <textarea name="description" placeholder="Opišite šta vam je potrebno"></textarea>
      <button class="submit" type="submit">Pošalji zahtev</button>
    </form>
  `);

  const requestForm = $("#requestForm");

  requestForm.onsubmit = async function(event) {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(requestForm));

    try {
      await api("/api/requests", {
        method: "POST",
        body: JSON.stringify(values)
      });

      closeModal();
      alert("Zahtev je uspešno sačuvan.");
    } catch (error) {
      alert(error.message);
    }
  };
}

function support() {
  openModal(`
    <h2>Centar za podršku</h2>

    <div class="tabs">
      <button class="active" id="chatTab" type="button">PonudiMi Asistent</button>
      <button id="faqTab" type="button">Najčešća pitanja</button>
      <button id="ticketTab" type="button">Pošalji upit</button>
    </div>

    <div id="supportArea"></div>
  `);

  showChat();

  $("#chatTab").onclick = showChat;
  $("#faqTab").onclick = showFaq;
  $("#ticketTab").onclick = showTicket;
}

function setSupportActiveTab(tabId) {
  document.querySelectorAll(".tabs button").forEach(function(button) {
    button.classList.remove("active");
  });

  const tab = $(tabId);

  if (tab) {
    tab.classList.add("active");
  }
}

function showChat() {
  setSupportActiveTab("#chatTab");

  $("#supportArea").innerHTML = `
    <div class="notice">Asistent može da pomogne oko registracije, prijave, oglasa, zahteva i paketa za firme.</div>
    <div class="chat" id="chat">
      <div class="msg bot">Zdravo! Kako mogu da pomognem?</div>
    </div>
    <div class="chatrow">
      <input id="chatInput" placeholder="Napišite pitanje..." autocomplete="off">
      <button class="submit" id="sendChatBtn" type="button">Pošalji</button>
    </div>
  `;

  $("#sendChatBtn").onclick = sendChat;

  $("#chatInput").onkeydown = function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      sendChat();
    }
  };
}

async function sendChat() {
  const input = $("#chatInput");
  const chat = $("#chat");

  if (!input || !chat) {
    return;
  }

  const message = input.value.trim();

  if (!message) {
    return;
  }

  chat.innerHTML += `<div class="msg me">${escapeHtml(message)}</div>`;

  input.value = "";
  chat.scrollTop = chat.scrollHeight;

  try {
    const data = await api("/api/support/chat", {
      method: "POST",
      body: JSON.stringify({ message: message })
    });

    chat.innerHTML += `<div class="msg bot">${escapeHtml(data.answer)}</div>`;
  } catch (error) {
    chat.innerHTML += `<div class="msg bot">${escapeHtml(error.message)}</div>`;
  }

  chat.scrollTop = chat.scrollHeight;
}

function showFaq() {
  setSupportActiveTab("#faqTab");

  const questions = [
    "Kako da se registrujem kao fizičko lice?",
    "Kako da registrujem firmu?",
    "Kako da se prijavim?",
    "Kako da objavim oglas?",
    "Kako da postavim zahtev?",
    "Kako rade paketi za firme?"
  ];

  $("#supportArea").innerHTML = `
    <div class="faq">
      ${questions.map(function(question, index) {
        return `
          <button type="button" class="faq-question" data-question-index="${index}">
            ${escapeHtml(question)}
          </button>
        `;
      }).join("")}
    </div>
  `;

  document.querySelectorAll(".faq-question").forEach(function(button) {
    button.onclick = async function() {
      const question = questions[Number(button.dataset.questionIndex)];

      try {
        const data = await api("/api/support/chat", {
          method: "POST",
          body: JSON.stringify({ message: question })
        });
        alert(data.answer);
      } catch (error) {
        alert(error.message);
      }
    };
  });
}

function showTicket() {
  setSupportActiveTab("#ticketTab");

  $("#supportArea").innerHTML = `
    <form id="ticketForm">
      <input name="name" placeholder="Ime i prezime" autocomplete="name" required>
      <input name="email" type="email" placeholder="Email" autocomplete="email" required>
      <input name="subject" placeholder="Naslov upita" required>
      <textarea name="message" placeholder="Opišite problem ili pitanje" required></textarea>
      <button class="submit" type="submit">Pošalji upit</button>
    </form>
  `;

  const ticketForm = $("#ticketForm");

  ticketForm.onsubmit = async function(event) {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(ticketForm));

    try {
      const data = await api("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify(values)
      });

      closeModal();
      alert(data.message);
    } catch (error) {
      alert(error.message);
    }
  };
}


async function loadCategories() {
  try {
    const data = await api("/api/categories");
    if (Array.isArray(data) && data.length) {
      categories = data;
      renderCategories(categories);
    } else {
      renderCategories(categories);
    }
  } catch (error) {
    console.error("Kategorije nisu učitane:", error);
    renderCategories(categories);
  }
}

function relativeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return "pre " + minutes + (minutes === 1 ? " minut" : " minuta");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return "pre " + hours + (hours === 1 ? " sat" : " sata");
  const days = Math.floor(hours / 24);
  return "pre " + days + (days === 1 ? " dan" : " dana");
}

async function loadLatestRequests() {
  const requestList = $("#requestList");
  if (!requestList) return;

  try {
    const data = await api("/api/requests?limit=5");
    if (!data.length) {
      requestList.innerHTML = '<li class="request-item">Trenutno nema aktivnih zahteva.</li>';
      return;
    }

    requestList.innerHTML = data.map(function(item) {
      const place = item.location || "Lokacija nije navedena";
      const time = relativeDate(item.created_at);
      return `<li class="request-item">${escapeHtml(item.title)}<div class="request-date">${escapeHtml(place)}${time ? " · " + time : ""}</div></li>`;
    }).join("");
  } catch (error) {
    console.error("Zahtevi nisu učitani:", error);
    if (requestList.dataset.fallbackMarkup) requestList.innerHTML = requestList.dataset.fallbackMarkup;
  }
}
function bindPageEvents() {
  const closeButton = $("#close");
  const searchForm = $("#searchForm");
  const searchButton = $("#searchBtn");
  const supportButton = $("#supportBtn");
  const loginButton = $("#loginBtn");
  const registerButton = $("#registerBtn");
  const ctaRegisterButton = $("#ctaRegister");
  const listingButton = $("#listingBtn");
  const requestButton = $("#requestBtn");
  const logoutButton = $("#logoutBtn");
  const userButton = $("#userBtn");
  const heroRegisterButton = $("#heroRegisterBtn");
  const heroSearchButton = $("#heroSearchBtn");
  const searchInput = $("#q");

  if (closeButton) {
    closeButton.onclick = closeModal;
  }

  if (modal) {
    modal.onclick = function(event) {
      if (event.target === modal) {
        closeModal();
      }
    };
  }

  const bindAction = function(element, handler) {
    if (!element) return;
    element.onclick = function(event) {
      if (event) event.preventDefault();
      handler();
    };
  };

  if (searchForm) {
    searchForm.onsubmit = function(event) {
      event.preventDefault();
      doSearch();
    };
  } else if (searchButton) {
    bindAction(searchButton, doSearch);
  }

  if (searchInput && !searchForm) {
    searchInput.onkeydown = function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        doSearch();
      }
    };
  }

  bindAction(supportButton, support);
  bindAction(loginButton, login);
  bindAction(registerButton, register);
  bindAction(ctaRegisterButton, register);
  bindAction(listingButton, listing);
  bindAction(requestButton, request);
  bindAction(logoutButton, logout);

  if (userButton) {
    userButton.onclick = function() {
      alert("Profil korisnika ćemo dodati u sledećoj verziji.");
    };
  }

  if (heroRegisterButton) {
    heroRegisterButton.onclick = register;
  }

  if (heroSearchButton) {
    heroSearchButton.onclick = function() {
      if (!searchInput) {
        return;
      }

      searchInput.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      searchInput.focus();
    };
  }
}

function init() {
  renderCategories(categories);
  bindPageEvents();
  updateAuthUI();

  const featured = $("#featured");
  if (featured) {
    featured.dataset.fallbackMarkup = featured.innerHTML;
  }

  const requestList = $("#requestList");
  if (requestList) {
    requestList.dataset.fallbackMarkup = requestList.innerHTML;
  }

  doSearch();
  loadCategories();
  loadLatestRequests();
}

init();
