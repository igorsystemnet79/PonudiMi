const $ = function(selector) {
  return document.querySelector(selector);
};

const modal = $("#modal");
const dialogBody = $("#dialogBody");

let token = localStorage.getItem("pm_token");

const categories = [
  "Polovni automobili",
  "Nekretnine",
  "Mobilni telefoni",
  "Tehnika",
  "Usluge",
  "Građevina",
  "Poljoprivreda",
  "Moda",
  "Ostalo"
];

const categoryIcons = [
  "🚗",
  "🏠",
  "📱",
  "💻",
  "🛠️",
  "👷",
  "🚜",
  "👕",
  "•••"
];

const categoryCounts = [
  12580,
  23120,
  15890,
  9452,
  18760,
  8542,
  7310,
  4125,
  0
];

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

  if (!loginBtn || !registerBtn || !userBtn || !logoutBtn) {
    return;
  }

  if (token) {
    loginBtn.classList.add("hidden");
    registerBtn.classList.add("hidden");
    userBtn.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    loginBtn.classList.remove("hidden");
    registerBtn.classList.remove("hidden");
    userBtn.classList.add("hidden");
    logoutBtn.classList.add("hidden");
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

    throw new Error(
      data.error || "Prijava je istekla. Molimo prijavite se ponovo."
    );
  }

  if (!response.ok) {
    throw new Error(data.error || "Došlo je do greške.");
  }

  return data;
}

function renderCategories() {
  const categoriesElement = $("#categories");
  const categorySelect = $("#category");

  if (!categoriesElement || !categorySelect) {
    return;
  }

  categoriesElement.innerHTML = categories
    .map(function(category, index) {
      return `
        <button
          class="cat"
          type="button"
          data-category="${escapeHtml(category)}"
        >
          <b>${categoryIcons[index]} ${escapeHtml(category)}</b>
          <small>
            ${categoryCounts[index].toLocaleString("sr-RS")} oglasa
          </small>
        </button>
      `;
    })
    .join("");

  categorySelect.innerHTML =
    '<option value="">Sve kategorije</option>' +
    categories
      .map(function(category) {
        return `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`;
      })
      .join("");

  categoriesElement.querySelectorAll(".cat").forEach(function(button) {
    button.addEventListener("click", function() {
      categorySelect.value = button.dataset.category;
      doSearch();
    });
  });
}

function listingImageMarkup(image, title) {
  const safeTitle = escapeHtml(title || "Oglas");

  if (!image) {
    return `
      <div
        class="offer-image-placeholder"
        aria-label="Slika oglasa nije dostupna"
      >
        📦
      </div>
    `;
  }

  const safeImage = escapeHtml(image);

  return `
    <img
      src="${safeImage}"
      alt="${safeTitle}"
      onerror="this.replaceWith(Object.assign(document.createElement('div'), {className: 'offer-image-placeholder', textContent: '📦'}))"
    >
  `;
}

async function doSearch() {
  const searchInput = $("#q");
  const categorySelect = $("#category");
  const locationInput = $("#location");
  const featured = $("#featured");

  if (!searchInput || !categorySelect || !locationInput || !featured) {
    return;
  }

  const q = searchInput.value.trim();
  const category = categorySelect.value.trim();
  const location = locationInput.value.trim();

  featured.innerHTML = "Učitavanje ponuda…";

  try {
    const data = await api(
      "/api/listings?q=" +
        encodeURIComponent(q) +
        "&category=" +
        encodeURIComponent(category) +
        "&location=" +
        encodeURIComponent(location)
    );

    if (!data.length) {
      featured.innerHTML = "Nema rezultata za izabranu pretragu.";
      return;
    }

    featured.innerHTML = data
      .slice(0, 3)
      .map(function(item) {
        const price = item.price
          ? new Intl.NumberFormat("sr-RS").format(item.price) + " €"
          : "Po dogovoru";

        return `
          <div class="offer">
            ${listingImageMarkup(item.image, item.title)}
            <div>
              <b>${escapeHtml(item.title)}</b><br>
              <small>
                ${escapeHtml(item.location || "Lokacija nije navedena")}
                • ${price}
              </small>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    featured.innerHTML =
      '<span class="error-message">' + escapeHtml(error.message) + "</span>";
  }
}

function register() {
  openModal(`
    <h2>Registracija</h2>

    <div class="tabs">
      <button class="active" id="individualTab" type="button">
        Fizičko lice
      </button>

      <button id="companyTab" type="button">
        Pravno lice
      </button>
    </div>

    <form id="registerForm">
      <input
        name="name"
        placeholder="Ime i prezime"
        autocomplete="name"
        required
      >

      <input
        name="email"
        type="email"
        placeholder="Email"
        autocomplete="email"
        required
      >

      <input
        name="password"
        type="password"
        placeholder="Lozinka (najmanje 6 karaktera)"
        autocomplete="new-password"
        minlength="6"
        required
      >

      <div id="companyFields"></div>

      <button class="submit" type="submit">
        Kreiraj nalog
      </button>
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
      <input
        name="companyName"
        placeholder="Naziv firme"
        autocomplete="organization"
        required
      >

      <input
        name="pib"
        placeholder="PIB"
        inputmode="numeric"
      >
    `;
  };

  registerForm.onsubmit = async function(event) {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const values = Object.fromEntries(formData);

    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          type: accountType
        })
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
      <input
        name="email"
        type="email"
        placeholder="Email"
        autocomplete="email"
        required
      >

      <input
        name="password"
        type="password"
        placeholder="Lozinka"
        autocomplete="current-password"
        required
      >

      <button class="submit" type="submit">
        Prijavi se
      </button>
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
      <input
        name="title"
        placeholder="Naslov oglasa"
        required
      >

      <select name="category" required>
        ${categories
          .map(function(category) {
            return `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`;
          })
          .join("")}
      </select>

      <input
        name="location"
        placeholder="Lokacija"
        required
      >

      <input
        name="price"
        type="number"
        min="0"
        step="0.01"
        placeholder="Cena (€)"
      >

      <input
        name="image"
        type="url"
        placeholder="Link do slike (opciono)"
      >

      <textarea
        name="description"
        placeholder="Opis oglasa"
      ></textarea>

      <button class="submit" type="submit">
        Objavi oglas
      </button>
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
      <input
        name="title"
        placeholder="Šta tražite?"
        required
      >

      <select name="category">
        <option value="">Kategorija</option>
        ${categories
          .map(function(category) {
            return `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`;
          })
          .join("")}
      </select>

      <input
        name="location"
        placeholder="Lokacija"
      >

      <input
        name="budget"
        type="number"
        min="0"
        step="0.01"
        placeholder="Budžet (€)"
      >

      <textarea
        name="description"
        placeholder="Opišite šta vam je potrebno"
      ></textarea>

      <button class="submit" type="submit">
        Pošalji zahtev
      </button>
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
      <button class="active" id="chatTab" type="button">
        PonudiMi Asistent
      </button>

      <button id="faqTab" type="button">
        Najčešća pitanja
      </button>

      <button id="ticketTab" type="button">
        Pošalji upit
      </button>
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
    <div class="notice">
      Asistent može da pomogne oko registracije, prijave, oglasa,
      zahteva i paketa za firme.
    </div>

    <div class="chat" id="chat">
      <div class="msg bot">Zdravo! Kako mogu da pomognem?</div>
    </div>

    <div class="chatrow">
      <input
        id="chatInput"
        placeholder="Napišite pitanje..."
        autocomplete="off"
      >

      <button class="submit" id="sendChatBtn" type="button">
        Pošalji
      </button>
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

  chat.innerHTML += `
    <div class="msg me">${escapeHtml(message)}</div>
  `;

  input.value = "";
  chat.scrollTop = chat.scrollHeight;

  try {
    const data = await api("/api/support/chat", {
      method: "POST",
      body: JSON.stringify({
        message: message
      })
    });

    chat.innerHTML += `
      <div class="msg bot">${escapeHtml(data.answer)}</div>
    `;
  } catch (error) {
    chat.innerHTML += `
      <div class="msg bot">
        ${escapeHtml(error.message)}
      </div>
    `;
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
      ${questions
        .map(function(question, index) {
          return `
            <button
              type="button"
              class="faq-question"
              data-question-index="${index}"
            >
              ${escapeHtml(question)}
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  document.querySelectorAll(".faq-question").forEach(function(button) {
    button.onclick = async function() {
      const question = questions[Number(button.dataset.questionIndex)];

      try {
        const data = await api("/api/support/chat", {
          method: "POST",
          body: JSON.stringify({
            message: question
          })
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
      <input
        name="name"
        placeholder="Ime i prezime"
        autocomplete="name"
        required
      >

      <input
        name="email"
        type="email"
        placeholder="Email"
        autocomplete="email"
        required
      >

      <input
        name="subject"
        placeholder="Naslov upita"
        required
      >

      <textarea
        name="message"
        placeholder="Opišite problem ili pitanje"
        required
      ></textarea>

      <button class="submit" type="submit">
        Pošalji upit
      </button>
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

function bindPageEvents() {
  const closeButton = $("#close");
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

  if (searchButton) {
    searchButton.onclick = doSearch;
  }

  if (searchInput) {
    searchInput.onkeydown = function(event) {
      if (event.key === "Enter") {
        doSearch();
      }
    };
  }

  if (supportButton) {
    supportButton.onclick = support;
  }

  if (loginButton) {
    loginButton.onclick = login;
  }

  if (registerButton) {
    registerButton.onclick = register;
  }

  if (ctaRegisterButton) {
    ctaRegisterButton.onclick = register;
  }

  if (listingButton) {
    listingButton.onclick = listing;
  }

  if (requestButton) {
    requestButton.onclick = request;
  }

  if (logoutButton) {
    logoutButton.onclick = logout;
  }

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
  renderCategories();
  bindPageEvents();
  updateAuthUI();
  doSearch();
}

init();
