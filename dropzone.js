(() => {
    const LIB = {
        tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
        pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
        pdfWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
        mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js"
    };
    const CHIAVE = "eventiCaricati";

    const MESI = {
        gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3, aprile: 4, apr: 4,
        maggio: 5, mag: 5, giugno: 6, giu: 6, luglio: 7, lug: 7, agosto: 8, ago: 8,
        settembre: 9, sett: 9, set: 9, ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12
    };
    const NOMI_MESI = Object.keys(MESI).sort((a, b) => b.length - a.length).join("|");

    const RE_RANGE = new RegExp(`dal\\s+(\\d{1,2})(?:\\s*(${NOMI_MESI}))?\\s+al\\s+(\\d{1,2})\\s*(${NOMI_MESI})\\b\\.?(?:\\s+(\\d{4}))?`, "i");
    const RE_TESTUALE = new RegExp(`(?<!\\d)(\\d{1,2})\\s*°?\\s*(${NOMI_MESI})\\b\\.?(?:\\s+(\\d{4}))?`, "i");
    const RE_NUMERICA = /(?<![\d:])(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{4}|\d{2}))?(?![\d:])/;
    const RE_ORA = /\b(?:(?:ore|alle|dalle|h)\.?\s*(\d{1,2})(?:[:.]([0-5]\d))?|(\d{1,2}):([0-5]\d))\b/gi;
    const RE_OGGETTO = /oggetto\s*:?\s*(.+)/i;
    const PAROLE_VUOTE = "il giorno|il|dal|al|alle|dalle|ore|del|data|giorno|h";

    const stile = document.createElement("style");
    stile.textContent = `
        #dropOverlay {
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: none;
            justify-content: center;
            align-items: center;
            background: rgba(214, 236, 255, 0.85);
            backdrop-filter: blur(3px);
        }
        #dropOverlay.active { display: flex; }
        #dropOverlay div {
            padding: 48px 64px;
            font-size: 1.6rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            text-align: center;
            color: #000;
            background: #fff;
            border: 4px dashed #38b6ff;
            box-shadow: 8px 8px 0 #d6ecff, 0 0 30px rgba(56, 182, 255, 0.4);
        }
        .dz-actions {
            position: fixed;
            right: 24px;
            bottom: 24px;
            z-index: 900;
            display: flex;
            gap: 12px;
        }
        .dz-actions button {
            padding: 12px 20px;
            font-family: var(--font-pixel, monospace);
            font-size: 1rem;
            font-weight: 600;
            text-transform: uppercase;
            color: #000;
            background: #38b6ff;
            border: 2px solid #0a8fe8;
            box-shadow: 4px 4px 0 #d6ecff;
            cursor: pointer;
        }
        .dz-actions button.secondary { background: #fff; }
        .dz-actions button:hover { background: #d6ecff; }
        .dz-actions button:active { transform: translate(4px, 4px); box-shadow: none; }
        #uploadToast {
            position: fixed;
            left: 50%;
            bottom: 24px;
            z-index: 3000;
            max-width: 90%;
            padding: 12px 20px;
            font-family: var(--font-pixel, monospace);
            font-size: 0.95rem;
            color: #000;
            background: #fff;
            border: 3px solid #38b6ff;
            box-shadow: 4px 4px 0 #d6ecff;
            transform: translate(-50%, 200%);
            transition: transform 0.25s ease;
        }
        #uploadToast.show { transform: translate(-50%, 0); }
        #uploadToast.error { border-color: #000; background: #fff3f3; }
    `;
    document.head.appendChild(stile);

    const overlay = document.createElement("div");
    overlay.id = "dropOverlay";
    overlay.innerHTML = "<div>Rilascia qui foto o file</div>";

    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,.pdf,.docx,.txt,.csv";
    input.hidden = true;

    const azioni = document.createElement("div");
    azioni.className = "dz-actions";
    const bottone = document.createElement("button");
    bottone.type = "button";
    bottone.textContent = "+ Carica file";
    const svuota = document.createElement("button");
    svuota.type = "button";
    svuota.className = "secondary";
    svuota.textContent = "Svuota caricati";
    azioni.append(bottone, svuota);

    const toast = document.createElement("div");
    toast.id = "uploadToast";
    toast.setAttribute("aria-live", "polite");

    document.body.append(overlay, input, azioni, toast);

    let timerToast;
    let profondita = 0;
    let nomeCorrente = "";
    let worker;
    const scriptCaricati = {};

    function mostra(testo, tipo) {
        clearTimeout(timerToast);
        toast.textContent = testo;
        toast.className = "show" + (tipo === "error" ? " error" : "");
        if (tipo !== "busy") timerToast = setTimeout(() => toast.classList.remove("show"), 5000);
    }

    function caricaScript(url) {
        if (!scriptCaricati[url]) {
            scriptCaricati[url] = new Promise((ok, ko) => {
                const s = document.createElement("script");
                s.src = url;
                s.onload = ok;
                s.onerror = () => ko(new Error("Impossibile caricare le librerie di lettura"));
                document.head.appendChild(s);
            });
        }
        return scriptCaricati[url];
    }

    function leggiArchivio() {
        try {
            return JSON.parse(localStorage.getItem(CHIAVE)) || [];
        } catch {
            return [];
        }
    }

    function scriviArchivio(eventi) {
        try {
            localStorage.setItem(CHIAVE, JSON.stringify(eventi));
        } catch {
            mostra("Memoria del browser piena o non disponibile", "error");
        }
    }

    async function ottieniWorker() {
        if (!worker) {
            await caricaScript(LIB.tesseract);
            worker = await Tesseract.createWorker("ita", 1, {
                logger: (m) => {
                    if (m.status === "recognizing text") {
                        mostra(`${nomeCorrente}: lettura ${Math.round(m.progress * 100)}%`, "busy");
                    }
                }
            });
        }
        return worker;
    }

    async function testoDaImmagine(file) {
        if (/heic|heif/i.test(file.type + file.name)) {
            throw new Error("formato HEIC non supportato, converti in JPG");
        }
        const lettore = await ottieniWorker();
        const { data } = await lettore.recognize(file);
        return data.text;
    }

    async function testoDaPdf(file) {
        await caricaScript(LIB.pdf);
        pdfjsLib.GlobalWorkerOptions.workerSrc = LIB.pdfWorker;
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        let testo = "";
        for (let n = 1; n <= pdf.numPages; n++) {
            const pagina = await pdf.getPage(n);
            const contenuto = await pagina.getTextContent();
            let paginaTesto = contenuto.items.map((i) => i.str + (i.hasEOL ? "\n" : " ")).join("");
            if (paginaTesto.trim().length < 20) {
                const viewport = pagina.getViewport({ scale: 2 });
                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await pagina.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
                const lettore = await ottieniWorker();
                paginaTesto = (await lettore.recognize(canvas)).data.text;
            }
            testo += paginaTesto + "\n";
        }
        return testo;
    }

    async function testoDaDocx(file) {
        await caricaScript(LIB.mammoth);
        const risultato = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        return risultato.value;
    }

    async function estraiTesto(file) {
        const nome = file.name.toLowerCase();
        if (file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/.test(nome)) return testoDaImmagine(file);
        if (file.type === "application/pdf" || nome.endsWith(".pdf")) return testoDaPdf(file);
        if (nome.endsWith(".docx")) return testoDaDocx(file);
        if (file.type.startsWith("text/") || /\.(txt|csv)$/.test(nome)) return file.text();
        throw new Error("formato non supportato (usa immagini, PDF, DOCX, TXT, CSV)");
    }

    const pad = (n) => String(n).padStart(2, "0");

    function costruisciData(giorno, mese, anno) {
        const oggi = new Date();
        let y = anno ? Number(anno) : oggi.getFullYear();
        if (anno && String(anno).length === 2) y += 2000;
        const m = Number(mese);
        const d = Number(giorno);
        if (m < 1 || m > 12 || d < 1 || d > 31) return null;
        let data = new Date(Date.UTC(y, m - 1, d));
        if (data.getUTCMonth() !== m - 1) return null;
        if (!anno && data < new Date(oggi.getTime() - 60 * 864e5)) {
            data = new Date(Date.UTC(y + 1, m - 1, d));
        }
        return data;
    }

    const iso = (data) => `${data.getUTCFullYear()}-${pad(data.getUTCMonth() + 1)}-${pad(data.getUTCDate())}`;

    function pulisciTitolo(testo) {
        let t = testo.replace(/\s+/g, " ");
        const bordi = /^[\s\-–—:,;.()|]+|[\s\-–—:,;.()|]+$/g;
        const inizio = new RegExp(`^(?:${PAROLE_VUOTE})\\s+`, "i");
        const fine = new RegExp(`\\s+(?:${PAROLE_VUOTE})$`, "i");
        let precedente;
        do {
            precedente = t;
            t = t.replace(bordi, "").replace(inizio, "").replace(fine, "");
        } while (t !== precedente);
        return t;
    }

    function leggiRiga(riga) {
        let resto = riga;
        const orari = [];
        resto = resto.replace(RE_ORA, (tutto, h1, m1, h2, m2) => {
            const ora = Number(h1 ?? h2);
            if (ora > 23) return tutto;
            orari.push(`${pad(ora)}:${m1 ?? m2 ?? "00"}`);
            return " ";
        });

        let inizio = null;
        let fine = null;

        let m = resto.match(RE_RANGE);
        if (m) {
            const mese = MESI[(m[2] || m[4]).toLowerCase()];
            const meseFine = MESI[m[4].toLowerCase()];
            inizio = costruisciData(m[1], mese, m[5]);
            fine = costruisciData(m[3], meseFine, m[5]);
        } else if ((m = resto.match(RE_TESTUALE))) {
            inizio = costruisciData(m[1], MESI[m[2].toLowerCase()], m[3]);
        } else if ((m = resto.match(RE_NUMERICA))) {
            inizio = costruisciData(m[1], m[2], m[3]);
        }

        if (!inizio) return null;
        resto = resto.replace(m[0], " ");

        const evento = { titoloGrezzo: pulisciTitolo(resto) };
        if (fine && fine > inizio) {
            evento.allDay = true;
            evento.start = iso(inizio);
            evento.end = iso(new Date(fine.getTime() + 864e5));
        } else if (orari.length) {
            evento.allDay = false;
            evento.start = `${iso(inizio)}T${orari[0]}:00`;
            if (orari[1]) evento.end = `${iso(inizio)}T${orari[1]}:00`;
        } else {
            evento.allDay = true;
            evento.start = iso(inizio);
        }
        return evento;
    }

    function estraiEventi(testo, nomeFile) {
        const righe = testo.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
        const oggetto = (testo.match(RE_OGGETTO) || [])[1];
        const nomeBase = nomeFile.replace(/\.[^.]+$/, "");
        const trovati = [];
        let ultimaRiga = "";

        for (const riga of righe) {
            const evento = leggiRiga(riga);
            if (!evento) {
                if (riga.replace(/[^\p{L}]/gu, "").length >= 3) ultimaRiga = riga;
                continue;
            }
            const valido = evento.titoloGrezzo.replace(/[^\p{L}]/gu, "").length >= 3;
            const titolo = valido ? evento.titoloGrezzo : (oggetto ? oggetto.trim() : ultimaRiga || nomeBase);
            const { titoloGrezzo, ...campi } = evento;
            trovati.push({
                id: `up_${Date.now()}_${trovati.length}`,
                title: titolo.slice(0, 90),
                description: `${riga}\n\n(Da: ${nomeFile})`,
                ...campi
            });
        }
        return trovati;
    }

    async function elabora(elenco) {
        const files = Array.from(elenco);
        for (const file of files) {
            nomeCorrente = file.name;
            mostra(`Lettura di ${file.name}…`, "busy");
            try {
                const testo = await estraiTesto(file);
                const nuovi = estraiEventi(testo, file.name);
                const archivio = leggiArchivio();
                const chiavi = new Set(archivio.map((e) => `${e.title}|${e.start}`));
                const aggiunti = nuovi.filter((e) => !chiavi.has(`${e.title}|${e.start}`));
                scriviArchivio(archivio.concat(aggiunti));

                const sorgente = calendar.getEventSourceById("caricati");
                if (sorgente) sorgente.refetch();

                if (aggiunti.length) {
                    calendar.gotoDate(aggiunti[0].start);
                    mostra(`${file.name}: aggiunti ${aggiunti.length} impegni`);
                } else {
                    mostra(`${file.name}: nessuna data trovata nel testo`);
                }
            } catch (errore) {
                mostra(`${file.name}: ${errore.message}`, "error");
            }
        }
    }

    const haFile = (e) => e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

    window.addEventListener("dragenter", (e) => {
        if (!haFile(e)) return;
        e.preventDefault();
        profondita++;
        overlay.classList.add("active");
    });

    window.addEventListener("dragover", (e) => {
        if (haFile(e)) e.preventDefault();
    });

    window.addEventListener("dragleave", (e) => {
        if (!haFile(e)) return;
        profondita--;
        if (profondita <= 0) overlay.classList.remove("active");
    });

    window.addEventListener("drop", (e) => {
        if (!haFile(e)) return;
        e.preventDefault();
        profondita = 0;
        overlay.classList.remove("active");
        elabora(e.dataTransfer.files);
    });

    window.addEventListener("paste", (e) => {
        if (e.clipboardData && e.clipboardData.files.length) elabora(e.clipboardData.files);
    });

    bottone.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
        elabora(input.files);
        input.value = "";
    });

    svuota.addEventListener("click", () => {
        if (!leggiArchivio().length) return mostra("Nessun impegno caricato da rimuovere");
        if (!confirm("Rimuovere tutti gli impegni caricati da file e foto?")) return;
        scriviArchivio([]);
        calendar.getEventSourceById("caricati").refetch();
        mostra("Impegni caricati rimossi");
    });

    document.addEventListener("DOMContentLoaded", () => {
        calendar.addEventSource({
            id: "caricati",
            events: (info, riuscito) => riuscito(leggiArchivio())
        });
    });
})();
