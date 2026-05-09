document.addEventListener("DOMContentLoaded", () => {
  const wizard = document.getElementById("reserva-wizard");
  if (!wizard) {
    return;
  }

  iniciarWizard().catch((error) => {
    console.error("Error inicializando el wizard:", error);
    mostrarMensajeGlobal("No se pudo cargar la reserva. Recarga la pagina.", "error");
  });
});

async function iniciarWizard() {
  const HORARIOS = [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00"
  ];

  const MESES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
  ];

  const DIAS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

  const state = {
    paso: 1,
    serviciosCatalogo: [],
    barberos: [],
    serviciosSeleccionados: new Set(),
    barbero: "Sin preferencia",
    fecha: "",
    hora: "",
    cliente: {
      nombre: "",
      apellido: "",
      telefono: "",
      correo: "",
      nota: ""
    },
    calendarioVista: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ocupados: [],
    reservasDia: []
  };

  const ui = {
    form: document.getElementById("reserva-wizard"),
    panes: Array.from(document.querySelectorAll(".wizard-pane")),
    steps: Array.from(document.querySelectorAll(".wizard-step")),
    serviciosGrid: document.getElementById("servicios-grid"),
    barbero: document.getElementById("barbero"),
    contadorServicios: document.getElementById("contador-servicios"),
    totalServicios: document.getElementById("total-servicios"),
    btnStep1Next: document.getElementById("btn-step-1-next"),
    btnStep2Next: document.getElementById("btn-step-2-next"),
    btnStep3Next: document.getElementById("btn-step-3-next"),
    prevMonth: document.getElementById("prev-month"),
    nextMonth: document.getElementById("next-month"),
    monthLabel: document.getElementById("month-label"),
    calendarGrid: document.getElementById("calendar-grid"),
    horariosList: document.getElementById("horarios-list"),
    reservasDiaList: document.getElementById("reservas-dia-list"),
    mensaje: document.getElementById("mensaje-reserva"),
    nombre: document.getElementById("cliente-nombre"),
    apellido: document.getElementById("cliente-apellido"),
    telefono: document.getElementById("cliente-telefono"),
    correo: document.getElementById("cliente-correo"),
    nota: document.getElementById("cliente-nota"),
    resumenServicios: document.getElementById("resumen-servicios"),
    resumenBarbero: document.getElementById("resumen-barbero"),
    resumenFecha: document.getElementById("resumen-fecha"),
    resumenHora: document.getElementById("resumen-hora"),
    resumenCliente: document.getElementById("resumen-cliente"),
    resumenTelefono: document.getElementById("resumen-telefono"),
    resumenTotal: document.getElementById("resumen-total"),
    goStepButtons: Array.from(document.querySelectorAll("[data-go-step]"))
  };

  const configResp = await fetch("/api/config-reserva");
  if (!configResp.ok) {
    throw new Error("No se pudo cargar la configuracion de reservas.");
  }
  const config = await configResp.json();
  state.serviciosCatalogo = Array.isArray(config.servicios) ? config.servicios : [];
  state.barberos = Array.isArray(config.barberos) ? config.barberos : [];

  renderServicios();
  renderBarberos();
  renderTotales();
  renderCalendario();
  renderHorarios(HORARIOS);
  renderReservasDia();
  cambiarPaso(1);

  ui.serviciosGrid.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".servicio-card");
    if (!boton) {
      return;
    }

    const servicioId = boton.dataset.id;
    if (!servicioId) {
      return;
    }

    if (state.serviciosSeleccionados.has(servicioId)) {
      state.serviciosSeleccionados.delete(servicioId);
    } else {
      state.serviciosSeleccionados.add(servicioId);
    }

    renderServicios();
    renderTotales();
  });

  ui.barbero.addEventListener("change", () => {
    state.barbero = ui.barbero.value || "Sin preferencia";
  });

  ui.prevMonth.addEventListener("click", () => {
    state.calendarioVista = new Date(
      state.calendarioVista.getFullYear(),
      state.calendarioVista.getMonth() - 1,
      1
    );
    renderCalendario();
  });

  ui.nextMonth.addEventListener("click", () => {
    state.calendarioVista = new Date(
      state.calendarioVista.getFullYear(),
      state.calendarioVista.getMonth() + 1,
      1
    );
    renderCalendario();
  });

  ui.calendarGrid.addEventListener("click", async (evento) => {
    const botonDia = evento.target.closest(".calendar-day");
    if (!botonDia || botonDia.disabled) {
      return;
    }

    state.fecha = botonDia.dataset.date || "";
    state.hora = "";
    renderCalendario();
    await cargarHorariosOcupados(HORARIOS);
    renderHorarios(HORARIOS);
  });

  ui.horariosList.addEventListener("click", (evento) => {
    const botonHora = evento.target.closest(".slot-btn");
    if (!botonHora || botonHora.disabled) {
      return;
    }

    state.hora = botonHora.dataset.hora || "";
    renderHorarios(HORARIOS);
  });

  ui.btnStep1Next.addEventListener("click", () => {
    if (!state.serviciosSeleccionados.size) {
      mostrarMensaje("Selecciona al menos un servicio para continuar.", "error");
      return;
    }
    limpiarMensaje();
    cambiarPaso(2);
  });

  ui.btnStep2Next.addEventListener("click", () => {
    if (!state.fecha || !state.hora) {
      mostrarMensaje("Selecciona una fecha y una hora disponible.", "error");
      return;
    }
    limpiarMensaje();
    cambiarPaso(3);
  });

  ui.btnStep3Next.addEventListener("click", () => {
    if (!capturarCliente()) {
      mostrarMensaje("Completa nombre, apellido y telefono para continuar.", "error");
      return;
    }

    actualizarResumen();
    limpiarMensaje();
    cambiarPaso(4);
  });

  ui.goStepButtons.forEach((boton) => {
    boton.addEventListener("click", () => {
      const destino = Number(boton.dataset.goStep);
      if (destino >= 1 && destino <= 4) {
        limpiarMensaje();
        cambiarPaso(destino);
      }
    });
  });

  ui.form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (!capturarCliente()) {
      mostrarMensaje("Faltan datos obligatorios del cliente.", "error");
      return;
    }

    if (!state.serviciosSeleccionados.size || !state.fecha || !state.hora) {
      mostrarMensaje("La reserva no esta completa.", "error");
      return;
    }

    const payload = {
      servicios: Array.from(state.serviciosSeleccionados),
      barbero: state.barbero || "Sin preferencia",
      fecha: state.fecha,
      hora: state.hora,
      cliente: { ...state.cliente }
    };

    try {
      const respuesta = await fetch("/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await respuesta.json();

      if (!respuesta.ok) {
        mostrarMensaje(data.mensaje || "No se pudo guardar la reserva.", "error");
        if (respuesta.status === 409) {
          await cargarHorariosOcupados(HORARIOS);
          renderHorarios(HORARIOS);
          cambiarPaso(2);
        }
        return;
      }

      mostrarMensaje("Reserva guardada correctamente en reservas.json", "exito");
      reiniciarWizard(HORARIOS);
    } catch (error) {
      console.error("Error enviando reserva:", error);
      mostrarMensaje("Error de conexion con el servidor.", "error");
    }
  });

  async function cargarHorariosOcupados(horariosBase) {
    if (!state.fecha) {
      state.ocupados = [];
      state.reservasDia = [];
      renderHorarios(horariosBase);
      renderReservasDia();
      return;
    }

    try {
      const respuesta = await fetch(`/api/horarios-ocupados?fecha=${encodeURIComponent(state.fecha)}`);
      if (!respuesta.ok) {
        throw new Error("No se pudo consultar horarios ocupados.");
      }
      const data = await respuesta.json();
      state.ocupados = Array.isArray(data.ocupados) ? data.ocupados : [];
      state.reservasDia = Array.isArray(data.reservas) ? data.reservas : [];

      if (state.hora && state.ocupados.includes(state.hora)) {
        state.hora = "";
      }

      renderReservasDia();
    } catch (error) {
      console.error("Error consultando horarios:", error);
      state.ocupados = [];
      state.reservasDia = [];
      renderReservasDia();
    }
  }

  function renderServicios() {
    const html = state.serviciosCatalogo
      .map((servicio) => {
        const seleccionado = state.serviciosSeleccionados.has(servicio.id);
        return `
          <button
            type="button"
            class="servicio-card ${seleccionado ? "seleccionado" : ""}"
            data-id="${servicio.id}"
            aria-pressed="${seleccionado ? "true" : "false"}"
          >
            <strong>${servicio.nombre}</strong>
            <span>${formatoMoneda(servicio.precio)}</span>
            <small>${servicio.duracion}</small>
            <em>${seleccionado ? "Seleccionado" : "Disponible"}</em>
          </button>
        `;
      })
      .join("");

    ui.serviciosGrid.innerHTML = html;
  }

  function renderBarberos() {
    ui.barbero.innerHTML = state.barberos
      .map((barbero) => `<option value="${escapeHtml(barbero)}">${barbero}</option>`)
      .join("");
    ui.barbero.value = state.barbero;
  }

  function renderTotales() {
    ui.contadorServicios.textContent = String(state.serviciosSeleccionados.size);
    ui.totalServicios.textContent = formatoMoneda(calcularTotal());
  }

  function renderCalendario() {
    const year = state.calendarioVista.getFullYear();
    const month = state.calendarioVista.getMonth();
    const primerDiaMes = new Date(year, month, 1);
    const ultimoDiaMes = new Date(year, month + 1, 0);
    const diasMes = ultimoDiaMes.getDate();
    const offset = primerDiaMes.getDay();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    ui.monthLabel.textContent = `${MESES[month]} ${year}`;
    const celdas = [];

    DIAS.forEach((dia) => {
      celdas.push(`<div class="calendar-weekday">${dia}</div>`);
    });

    for (let i = 0; i < offset; i += 1) {
      celdas.push('<div class="calendar-empty"></div>');
    }

    for (let dia = 1; dia <= diasMes; dia += 1) {
      const fechaObj = new Date(year, month, dia);
      fechaObj.setHours(0, 0, 0, 0);
      const iso = toISODate(fechaObj);
      const esPasado = fechaObj < hoy;
      const seleccionado = state.fecha === iso;
      const clases = ["calendar-day"];
      if (seleccionado) {
        clases.push("seleccionado");
      }
      celdas.push(`
        <button
          type="button"
          class="${clases.join(" ")}"
          data-date="${iso}"
          ${esPasado ? "disabled" : ""}
        >
          ${dia}
        </button>
      `);
    }

    ui.calendarGrid.innerHTML = celdas.join("");
  }

  function renderHorarios(horariosBase) {
    ui.horariosList.innerHTML = horariosBase
      .map((hora) => {
        const ocupado = state.ocupados.includes(hora);
        const seleccionado = state.hora === hora;
        return `
          <button
            type="button"
            class="slot-btn ${ocupado ? "ocupado" : ""} ${seleccionado ? "seleccionado" : ""}"
            data-hora="${hora}"
            ${ocupado ? "disabled" : ""}
          >
            ${ocupado ? `${hora} ocupado` : hora}
          </button>
        `;
      })
      .join("");
  }

  function renderReservasDia() {
    if (!state.fecha) {
      ui.reservasDiaList.innerHTML = '<li class="vacio">Selecciona una fecha para ver ocupacion.</li>';
      return;
    }

    if (!state.reservasDia.length) {
      ui.reservasDiaList.innerHTML = '<li class="vacio">No hay reservas guardadas para esta fecha.</li>';
      return;
    }

    ui.reservasDiaList.innerHTML = state.reservasDia
      .map((reserva) => {
        const nombreCliente = reserva.cliente
          ? `${limpiarTexto(reserva.cliente.nombre)} ${limpiarTexto(reserva.cliente.apellido)}`.trim()
          : limpiarTexto(reserva.nombre) || "Cliente";

        const servicioTexto = Array.isArray(reserva.servicios) && reserva.servicios.length
          ? reserva.servicios.map((servicio) => servicio.nombre).join(", ")
          : limpiarTexto(reserva.servicio) || "Servicio";

        return `
          <li>
            <strong>${limpiarTexto(reserva.hora) || "--:--"}</strong>
            <span>${escapeHtml(servicioTexto)}</span>
            <small>${escapeHtml(nombreCliente)}</small>
          </li>
        `;
      })
      .join("");
  }

  function cambiarPaso(nuevoPaso) {
    state.paso = nuevoPaso;
    ui.panes.forEach((pane) => {
      const esActivo = Number(pane.dataset.step) === nuevoPaso;
      pane.classList.toggle("oculto", !esActivo);
    });

    ui.steps.forEach((step) => {
      const numero = Number(step.dataset.stepIndicator);
      step.classList.toggle("activo", numero === nuevoPaso);
      step.classList.toggle("completado", numero < nuevoPaso);
      const badge = step.querySelector(".step-badge");
      if (!badge) {
        return;
      }
      badge.textContent = numero < nuevoPaso ? "OK" : String(numero);
    });
  }

  function capturarCliente() {
    state.cliente = {
      nombre: limpiarTexto(ui.nombre.value),
      apellido: limpiarTexto(ui.apellido.value),
      telefono: limpiarTexto(ui.telefono.value),
      correo: limpiarTexto(ui.correo.value),
      nota: limpiarTexto(ui.nota.value)
    };

    return Boolean(state.cliente.nombre && state.cliente.apellido && state.cliente.telefono);
  }

  function actualizarResumen() {
    const serviciosSeleccionados = state.serviciosCatalogo.filter((servicio) =>
      state.serviciosSeleccionados.has(servicio.id)
    );

    ui.resumenServicios.textContent = serviciosSeleccionados.map((servicio) => servicio.nombre).join(", ");
    ui.resumenBarbero.textContent = state.barbero || "Sin preferencia";
    ui.resumenFecha.textContent = formatearFechaLarga(state.fecha);
    ui.resumenHora.textContent = state.hora;
    ui.resumenCliente.textContent = `${state.cliente.nombre} ${state.cliente.apellido}`.trim();
    ui.resumenTelefono.textContent = state.cliente.telefono;
    ui.resumenTotal.textContent = formatoMoneda(calcularTotal());
  }

  function reiniciarWizard(horariosBase) {
    state.serviciosSeleccionados.clear();
    state.barbero = "Sin preferencia";
    state.fecha = "";
    state.hora = "";
    state.ocupados = [];
    state.reservasDia = [];
    state.cliente = {
      nombre: "",
      apellido: "",
      telefono: "",
      correo: "",
      nota: ""
    };

    ui.form.reset();
    ui.barbero.value = state.barbero;

    renderServicios();
    renderTotales();
    renderCalendario();
    renderHorarios(horariosBase);
    renderReservasDia();
    cambiarPaso(1);
  }

  function calcularTotal() {
    return state.serviciosCatalogo
      .filter((servicio) => state.serviciosSeleccionados.has(servicio.id))
      .reduce((acumulado, servicio) => acumulado + servicio.precio, 0);
  }

  function formatoMoneda(valor) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0
    }).format(valor);
  }

  function toISODate(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatearFechaLarga(isoDate) {
    if (!isoDate) {
      return "";
    }
    const [year, month, day] = isoDate.split("-").map((item) => Number(item));
    const fecha = new Date(year, month - 1, day);
    return fecha.toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function mostrarMensaje(texto, tipo) {
    ui.mensaje.textContent = texto;
    ui.mensaje.className = `mensaje ${tipo}`;
  }

  function limpiarMensaje() {
    ui.mensaje.textContent = "";
    ui.mensaje.className = "mensaje";
  }
}

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function escapeHtml(texto) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function mostrarMensajeGlobal(texto, tipo) {
  const mensaje = document.getElementById("mensaje-reserva");
  if (!mensaje) {
    return;
  }
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo}`;
}
