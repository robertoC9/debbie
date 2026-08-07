// Navegación con scroll suave hacia cada sección
document.querySelectorAll('.nav-links a').forEach(function (link) {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    var target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Botón "Leer el blog" desplaza hasta las últimas entradas
var ctaBtn = document.getElementById('cta-btn');
if (ctaBtn) {
  ctaBtn.addEventListener('click', function () {
    document.getElementById('posts').scrollIntoView({ behavior: 'smooth' });
  });
}

// ========== AUTENTICACIÓN (JWT en header Authorization) ==========
var authBtn = document.getElementById('auth-btn');
var authModalEl = document.getElementById('auth-modal');
var authModal = null;
if (authModalEl) {
  authModal = new bootstrap.Modal(authModalEl);
}

var currentUser = null;
var token = localStorage.getItem('debbie_token') || null; // JWT persistido

function setAuthButton() {
  if (!authBtn) return;
  if (currentUser) {
    authBtn.textContent = currentUser.name;
    authBtn.style.pointerEvents = 'none';
    authBtn.style.opacity = '0.6';
  } else {
    authBtn.textContent = 'Únete al club';
    authBtn.style.pointerEvents = 'auto';
    authBtn.style.opacity = '1';
  }
}

function showAuthMsg(msg, isError) {
  var el = document.getElementById('auth-msg');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? '#FF4D6D' : '#7BD88F';
  }
}

function showLoggedIn(user) {
  currentUser = user;
  localStorage.setItem('debbie_user', JSON.stringify(user));
  setAuthButton();
  document.getElementById('conversaciones').hidden = false;
  document.getElementById('chat-user-name').textContent = user.name;
  document.getElementById('club').hidden = true;
  loadMessages();
  document.getElementById('club').scrollIntoView({ behavior: 'smooth' });
}

function showLoggedOut() {
  currentUser = null;
  token = null;
  localStorage.removeItem('debbie_user');
  localStorage.removeItem('debbie_token');
  setAuthButton();
  document.getElementById('conversaciones').hidden = true;
  document.getElementById('club').hidden = false;
}

// Botón abrir modal
if (authBtn) {
  authBtn.addEventListener('click', function () {
    if (!currentUser && authModal) {
      document.getElementById('auth-msg').textContent = '';
      document.getElementById('register-form').reset();
      authModal.show();
    }
  });
}

// Registro
var registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = document.getElementById('reg-name').value.trim();
    var email = document.getElementById('reg-email').value.trim();
    var password = document.getElementById('reg-password').value;
    var website = document.getElementById('reg-website') ? document.getElementById('reg-website').value : '';

    showAuthMsg('Creando cuenta...', false);
    try {
      var res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, password: password, website: website })
      });
      var data = await res.json();
      if (res.ok) {
        // El registro crea la cuenta e inicia sesión automáticamente.
        token = data.token;
        localStorage.setItem('debbie_token', token);
        showLoggedIn(data.user);
        if (authModal) authModal.hide();
      } else {
        showAuthMsg(data.message, true);
      }
    } catch (err) {
      showAuthMsg('Error de conexión. Inténtalo de nuevo.', true);
    }
  });
}

// Cambiar a login
var goLogin = document.getElementById('go-login');
if (goLogin) {
  goLogin.addEventListener('click', function (e) {
    e.preventDefault();
    var modalTitle = document.getElementById('auth-modal-title');
    modalTitle.textContent = 'Inicia sesión';
    // Reconstruir modal a login
    var body = document.querySelector('.club-modal .modal-body');
    body.innerHTML = `
      <form id="login-form">
        <div class="mb-3">
          <input type="email" class="form-control club-input" id="login-email" placeholder="tu@correo.com" required>
        </div>
        <div class="mb-3">
          <input type="password" class="form-control club-input" id="login-password" placeholder="Contraseña" required>
        </div>
        <button type="submit" class="btn w-100 club-btn">Entrar</button>
      </form>
      <p class="auth-msg" id="auth-msg"></p>
      <p class="auth-switch">¿No tienes cuenta? <a href="#" id="go-register">Crea una</a></p>
    `;
    attachLogin();
    attachGoRegister();
  });
}

function attachLogin() {
  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      showAuthMsg('Ingresando...', false);
      try {
        var res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: password })
        });
        var data = await res.json();
        if (res.ok) {
          token = data.token;
          localStorage.setItem('debbie_token', token);
          showLoggedIn(data.user);
          if (authModal) authModal.hide();
        } else {
          showAuthMsg(data.message, true);
        }
      } catch (err) {
        showAuthMsg('Error de conexión. Inténtalo de nuevo.', true);
      }
    });
  }
}

function attachGoRegister() {
  var goRegister = document.getElementById('go-register');
  if (goRegister) {
    goRegister.addEventListener('click', function (e) {
      e.preventDefault();
      // Volver a cargar la página para mostrar el formulario de registro
      location.reload();
    });
  }
}

// Cerrar sesión
var logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async function () {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
    showLoggedOut();
  });
}

// ========== MENSAJES (Conversaciones con Débora) ==========
function loadMessages() {
  var chatBox = document.getElementById('chat-box');
  var empty = document.getElementById('chat-empty');

  fetch('/api/messages', {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {}
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.ok) {
        chatBox.innerHTML = '';
        if (data.data.length === 0) {
          chatBox.appendChild(empty);
          empty.style.display = 'block';
        } else {
          empty.style.display = 'none';
          data.data.forEach(function (m) {
            appendMessage(m.content, m.created_at);
          });
        }
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    })
    .catch(function (err) {
      console.error('Error cargando mensajes:', err);
    });
}

function appendMessage(content, createdAt) {
  var chatBox = document.getElementById('chat-box');
  var div = document.createElement('div');
  div.className = 'chat-msg';
  var time = createdAt ? new Date(createdAt).toLocaleString() : '';
  div.innerHTML = '<div class="chat-bubble">' + escapeHtml(content) + '<span class="chat-time">' + time + '</span></div>';
  chatBox.appendChild(div);
}

function escapeHtml(str) {
  var p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

var chatForm = document.getElementById('chat-form');
if (chatForm) {
  chatForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var input = document.getElementById('chat-input');
    var content = input.value.trim();
    if (!content) return;

    try {
      var res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? 'Bearer ' + token : ''
        },
        body: JSON.stringify({ content: content })
      });
      var data = await res.json();
      if (res.ok) {
        input.value = '';
        appendMessage(data.data.content, data.data.created_at);
        document.getElementById('chat-empty').style.display = 'none';
        document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight;
      } else {
        alert(data.message || 'No se pudo enviar el mensaje.');
      }
    } catch (err) {
      alert('Error de conexión. Inténtalo de nuevo.');
    }
  });
}

// ========== RESTAURAR SESIÓN AL CARGAR ==========
// La sesión se guarda como JWT en localStorage y se envía en el header Authorization.
// Consultamos /api/me para validar el token y restaurar la sesión al navegar.
(function restoreSession() {
  if (!token) {
    showLoggedOut();
    return;
  }
  fetch('/api/me', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(function (res) {
      if (res.status === 200) return res.json();
      return { ok: false };
    })
    .then(function (data) {
      if (data && data.ok) {
        showLoggedIn(data.user);
      } else {
        showLoggedOut();
      }
    })
    .catch(function () {
      showLoggedOut();
    });
})();

// Aplica transparencia al retrato del hero usando la utilidad opacity de Bootstrap
(function () {
  var portrait = document.querySelector('.hero-portrait');
  if (!portrait) return;
  portrait.classList.add('opacity-50');
})();

// Reintenta reproducir el video si el navegador bloquea el autoplay
var heroVideo = document.getElementById('hero-video');
if (heroVideo) {
  heroVideo.loop = true;
  heroVideo.play().catch(function () {
    document.addEventListener('click', function playOnce() {
      heroVideo.play();
      document.removeEventListener('click', playOnce);
    }, { once: true });
  });
  heroVideo.addEventListener('ended', function () {
    heroVideo.currentTime = 0;
    heroVideo.play();
  });
}
