fetch("header.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("header").innerHTML = data;
  });

fetch("footer.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("footer").innerHTML = data;
  });



  fetch("header.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("header").innerHTML = data;

    // ACTIVAR LINK ACTUAL
    const enlaces = document.querySelectorAll(".nav a");

    const paginaActual =
      window.location.pathname.split("/").pop();

    enlaces.forEach(enlace => {
      const href = enlace.getAttribute("href");

      if (href === paginaActual) {
        enlace.classList.add("activo");
      }
    });
  });

fetch("footer.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("footer").innerHTML = data;
  });