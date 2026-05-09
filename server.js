const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const RESERVAS_PATH = path.join(__dirname, "reservas.json");

const SERVICIOS = [
  { id: "corte-clasico", nombre: "Corte Clasico", precio: 45000, duracion: "30-45 min" },
  { id: "fade-taper", nombre: "Fade & Taper", precio: 55000, duracion: "40-50 min" },
  { id: "arreglo-barba", nombre: "Arreglo de Barba", precio: 30000, duracion: "20-30 min" },
  { id: "afeitado-navaja", nombre: "Afeitado Navaja", precio: 40000, duracion: "35-45 min" },
  { id: "combo-ejecutivo", nombre: "Combo Ejecutivo", precio: 75000, duracion: "60-80 min" },
  { id: "combo-joven", nombre: "Combo Joven", precio: 60000, duracion: "50-65 min" },
  { id: "diseno-lineas", nombre: "Diseno de Lineas", precio: 35000, duracion: "20-35 min" },
  { id: "tratamiento-capilar", nombre: "Tratamiento Capilar", precio: 50000, duracion: "45-60 min" }
];

const BARBEROS = [
  "Sin preferencia",
  "Andres Torres - Maestro en Barba",
  "Luis Herrera - Especialista en Fade",
  "Camilo Ruiz - Corte Clasico"
];

const SERVICIOS_POR_ID = new Map(SERVICIOS.map((servicio) => [servicio.id, servicio]));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function limpiarTexto(valor) {
  return String(valor ?? "").trim();
}

function obtenerFechaHora(reserva) {
  return {
    fecha: limpiarTexto(reserva?.fecha),
    hora: limpiarTexto(reserva?.hora)
  };
}

async function leerReservas() {
  try {
    const contenido = await fs.readFile(RESERVAS_PATH, "utf8");
    const contenidoLimpio = contenido.replace(/^\uFEFF/, "").trim();
    if (!contenidoLimpio) {
      return [];
    }

    const reservas = JSON.parse(contenidoLimpio);
    return Array.isArray(reservas) ? reservas : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(RESERVAS_PATH, "[]\n", "utf8");
      return [];
    }
    throw error;
  }
}

async function guardarReservas(reservas) {
  await fs.writeFile(RESERVAS_PATH, JSON.stringify(reservas, null, 2), "utf8");
}

app.get("/api/config-reserva", (req, res) => {
  return res.status(200).json({
    servicios: SERVICIOS,
    barberos: BARBEROS
  });
});

app.get("/api/horarios-ocupados", async (req, res) => {
  const fecha = limpiarTexto(req.query.fecha);
  if (!fecha) {
    return res.status(400).json({ mensaje: "La fecha es obligatoria" });
  }

  try {
    const reservas = await leerReservas();
    const reservasDia = reservas.filter((reserva) => obtenerFechaHora(reserva).fecha === fecha);
    const ocupados = [...new Set(reservasDia.map((reserva) => obtenerFechaHora(reserva).hora).filter(Boolean))];

    return res.status(200).json({
      fecha,
      ocupados,
      reservas: reservasDia
    });
  } catch (error) {
    console.error("Error consultando horarios ocupados:", error);
    return res.status(500).json({ mensaje: "Error al consultar horarios ocupados" });
  }
});

app.post("/reservar", async (req, res) => {
  const serviciosIds = Array.isArray(req.body?.servicios) ? req.body.servicios : [];
  const barbero = limpiarTexto(req.body?.barbero) || "Sin preferencia";
  const fecha = limpiarTexto(req.body?.fecha);
  const hora = limpiarTexto(req.body?.hora);
  const clienteNombre = limpiarTexto(req.body?.cliente?.nombre);
  const clienteApellido = limpiarTexto(req.body?.cliente?.apellido);
  const clienteTelefono = limpiarTexto(req.body?.cliente?.telefono);
  const clienteCorreo = limpiarTexto(req.body?.cliente?.correo);
  const clienteNota = limpiarTexto(req.body?.cliente?.nota);

  if (!serviciosIds.length || !fecha || !hora || !clienteNombre || !clienteApellido || !clienteTelefono) {
    return res.status(400).json({ mensaje: "Todos los campos obligatorios deben completarse" });
  }

  const serviciosSeleccionados = serviciosIds
    .map((id) => SERVICIOS_POR_ID.get(limpiarTexto(id)))
    .filter(Boolean);

  if (!serviciosSeleccionados.length) {
    return res.status(400).json({ mensaje: "Debes seleccionar al menos un servicio valido" });
  }

  const total = serviciosSeleccionados.reduce((acumulado, servicio) => acumulado + servicio.precio, 0);

  const reservaNueva = {
    id: `res-${Date.now()}`,
    fecha,
    hora,
    barbero,
    servicios: serviciosSeleccionados,
    total,
    cliente: {
      nombre: clienteNombre,
      apellido: clienteApellido,
      telefono: clienteTelefono,
      correo: clienteCorreo,
      nota: clienteNota
    },
    creadoEn: new Date().toISOString(),
    // Campos de compatibilidad con registros antiguos.
    nombre: `${clienteNombre} ${clienteApellido}`.trim(),
    telefono: clienteTelefono,
    servicio: serviciosSeleccionados.map((servicio) => servicio.nombre).join(", ")
  };

  try {
    const reservas = await leerReservas();
    const ocupado = reservas.some((reserva) => {
      const slot = obtenerFechaHora(reserva);
      return slot.fecha === fecha && slot.hora === hora;
    });

    if (ocupado) {
      return res.status(409).json({ mensaje: "Ocupado: este espacio de tiempo ya esta reservado" });
    }

    reservas.push(reservaNueva);
    await guardarReservas(reservas);
    return res.status(201).json({ mensaje: "Reserva guardada correctamente", reserva: reservaNueva });
  } catch (error) {
    console.error("Error al guardar la reserva:", error);
    return res.status(500).json({ mensaje: "Error al guardar la reserva" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
