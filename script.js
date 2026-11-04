let calendar;

const modal = document.getElementById("eventModal");
const modalTitle = document.getElementById("modalTitle");
const modalDate = document.getElementById("modalDate");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");

function formattaData(evento) {
    const opzioni = evento.allDay
        ? { day: "numeric", month: "long", year: "numeric" }
        : { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" };
    const inizio = evento.start.toLocaleString("it-IT", opzioni);
    if (!evento.end) return inizio;
    const fine = evento.end.toLocaleString("it-IT", opzioni);
    return fine === inizio ? inizio : `${inizio} → ${fine}`;
}

function apriModal(evento) {
    modalTitle.textContent = evento.title;
    modalDate.textContent = formattaData(evento);
    modalBody.textContent = evento.extendedProps.description || "Nessun dettaglio presente.";
    modal.classList.add("open");
    modalClose.focus();
}

function chiudiModal() {
    modal.classList.remove("open");
}

function caricaImpegniDaMail() {
    fetch("submit.php")
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((data) => {
            calendar.removeAllEvents();
            calendar.addEventSource(data);
        })
        .catch((error) => {
            console.error("Errore nel caricamento degli impegni:", error);
        });
}

modalClose.addEventListener("click", chiudiModal);

modal.addEventListener("click", (e) => {
    if (e.target === modal) chiudiModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") chiudiModal();
});

document.addEventListener("DOMContentLoaded", () => {
    calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
        initialView: "dayGridMonth",
        locale: "it",
        firstDay: 1,
        height: "100%",
        nowIndicator: true,
        dayMaxEvents: true,
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,listWeek"
        },
        buttonText: {
            today: "Oggi",
            month: "Mese",
            week: "Settimana",
            list: "Lista"
        },
        eventClick: (info) => {
            info.jsEvent.preventDefault();
            apriModal(info.event);
        }
    });

    calendar.render();
    caricaImpegniDaMail();
});
