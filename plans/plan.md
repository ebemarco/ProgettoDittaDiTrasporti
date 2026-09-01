# Piano: Migrazione Sistema1 a Oracle + PL/SQL + Test + Docker microservizi + CI/CD

## Decisioni confermate con l'utente
- Oracle: **Oracle Database 21c (Express Edition)** containerizzato in Docker (immagine community `gvenzl/oracle-xe:21-slim`), sia per prod (docker-compose) sia per test (Testcontainers, modulo `oracle-xe`). Niente Autonomous DB cloud, niente 23ai/Free.
- Git: repo inizializzato alla **radice del workspace** (Ditta_di_Trasporti), include Sistema1, Sistema2, DATABASE, SPECIFICHE, XML-XSL.
- Test: **Testcontainers** con immagine Oracle XE 21c reale per test di integrazione repository/PLSQL.
- Release GitHub: **sia JAR standalone sia pacchetto docker-compose** (con immagini pubblicate su DockerHub).
- Frontend Next.js: **escluso completamente** da questo piano (l'utente lo aggiungerà in futuro in Sistema1/frontend).
- Guida Oracle linkata dall'utente (migrazione verso Autonomous Database via OCI) **non è applicabile**: è pensata per migrazione cloud gestita (Data Pump/tool OCI), non per un container Oracle locale. Si procede con riscrittura manuale dello schema DDL.

## Stato attuale rilevato (Sistema1)
- Spring Boot 3.3.0, Java 22, Maven. Dipendenze: spring-boot-starter-data-jpa, -web, -test, driver `org.postgresql:postgresql`, JAXB (jakarta + legacy javax da ripulire).
- `Sistema1/docker-compose.yml`: `postgres:14-alpine`, porta 5429:5432, db `ditta_trasporti`.
- `Sistema1/init.sql`: 5 tabelle (Linee, Autobus, Utenti, Autisti, Turni), 3 SEQUENCE, FK `ON DELETE CASCADE, ON UPDATE CASCADE`, `Turni.ID GENERATED ALWAYS AS IDENTITY`.
- `Sistema1/src/main/resources/application.properties`: datasource Postgres, dialect commentato, `ddl-auto=none`.
- Entity JPA in `domain/`: TurniEntity, AutistiEntity, UtentiEntity, AutobusEntity (⚠️ `@GeneratedValue(IDENTITY)` su PK VARCHAR `targa` — bug da correggere), LineeEntity.
- Query native PostgreSQL-specifiche da correggere:
  - `AutistiRepository.inserisciAutista` usa `LIMIT 1` → sostituire con `FETCH FIRST 1 ROW ONLY`.
  - `UtentiRepository` ha insert/update nativi (portabili senza modifiche).
- Nessun test reale oltre `Sistema1ApplicationTests.contextLoads()`.
- `Sistema1/frontend/` esiste ma è vuota (fuori scope).
- Nessun `.git`, nessun `Dockerfile` backend, nessun `.github/workflows`.
- systemintegration/ (JAXB/XML verso Sistema2, socket porta 8087) resta invariato, fuori scope salvo eventuali test.

## Fasi (ognuna verificabile e committabile singolarmente)

### Fase 0 — Setup Git (bloccante per tutto il resto)
1. `git init` alla radice del workspace.
2. Creare `.gitignore` root (target/, *.class, .idea/, *.iml, node_modules/, .env, wallet Oracle se presente, file di backup DATABASE/Sistema1/*.sql se voluminosi — da confermare cosa escludere).
3. Commit iniziale "chore: initial commit".

### Fase 1 — Migrazione PostgreSQL → Oracle 21c XE
*Dipende da Fase 0.*
1. **`Sistema1/docker-compose.yml`**: sostituire servizio postgres con `gvenzl/oracle-xe:21-slim` (env `ORACLE_PASSWORD`, `APP_USER`/`APP_USER_PASSWORD` per schema applicativo, porta 1521), volume persistente, `healthcheck` (l'immagine espone già uno script di healthcheck).
2. **`Sistema1/init.sql` → riscrittura in sintassi Oracle** (nuovo file, es. `Sistema1/oracle-init/01-schema.sql` montato come init script nel container, dato che gvenzl supporta script in `/container-entrypoint-initdb.d/`):
   - Tipi: `VARCHAR2` invece di `VARCHAR`, `NUMBER` invece di `INT/BIGINT`, `DATE`/`TIMESTAMP` invece di `date`/`time` postgres.
   - PK autoincrementanti: mantenere `GENERATED ALWAYS AS IDENTITY` (supportato da Oracle 12c+, quindi anche 21c) per Turni/Utenti/Linee; **rimuovere IDENTITY da Autobus.Targa** (bug, natural key non generabile).
   - FK: Oracle non supporta `ON UPDATE CASCADE` → rimuovere clausola (le PK naturali tipo `targa`/`matricola` non vengono aggiornate in pratica) oppure implementare trigger dedicato se serve davvero (da confermare in fase di implementazione se emergono update reali sulle FK).
   - Sequenze esplicite (Linee, Utenti): mantenere `CREATE SEQUENCE ... START WITH 1 INCREMENT BY 1`, sintassi Oracle compatibile.
3. **`Sistema1/pom.xml`**: rimuovere `org.postgresql:postgresql`, aggiungere driver Oracle `com.oracle.database.jdbc:ojdbc11` (compatibile con 21c) (+ eventualmente `ucp11` se si vuole un connection pool Oracle-specific, opzionale).
4. **`Sistema1/src/main/resources/application.properties`**: `spring.datasource.url=jdbc:oracle:thin:@//localhost:1521/XEPDB1`, `driver-class-name=oracle.jdbc.OracleDriver`, `spring.jpa.database-platform=org.hibernate.dialect.OracleDialect`.
5. **Entity fix**:
   - `AutobusEntity`: rimuovere `@GeneratedValue(strategy = GenerationType.IDENTITY)` sul campo `targa`.
   - Verificare che `GenerationType.IDENTITY` funzioni con Hibernate 6 + Oracle 21c (Hibernate mappa IDENTITY su Oracle usando la clausola IDENTITY nativa da 12c+, ok).
6. **Repository fix**: `AutistiRepository.inserisciAutista` — sostituire `LIMIT 1` con `FETCH FIRST 1 ROW ONLY` nella query nativa.
7. Avviare `docker compose up` e verificare boot applicazione + CRUD manuale via i file `.http` esistenti (`turni.http`, `admin.http`, `autisti.http`) come smoke test.

### Fase 2 — Esercizi PL/SQL
*Dipende da Fase 1 (schema Oracle attivo). Può procedere in parallelo alla Fase 4 (test) una volta pronto lo schema.*
1. Nuovo script `Sistema1/oracle-init/02-plsql.sql` (o file separato eseguito manualmente per esercizio) con oggetti PL/SQL basati sulla logica di dominio esistente:
   - `FUNCTION calcola_durata_turno(p_ora_inizio, p_ora_fine) RETURN NUMBER` — calcola ore di un turno.
   - `PROCEDURE inserisci_turno_autista(p_id_utente, p_data, p_ora_inizio, p_ora_fine)` — valida esistenza autista, verifica sovrapposizioni turni stesso giorno, inserisce, altrimenti solleva eccezione custom (`RAISE_APPLICATION_ERROR`).
   - Tabella di log `turni_audit` + `TRIGGER trg_turni_audit` (AFTER INSERT/UPDATE/DELETE su `turni`) per tracciare modifiche.
   - `PACKAGE pkg_turni` che raggruppa le funzioni/procedure sopra (spec + body).
2. Integrazione lato Spring (facoltativa ma consigliata per "esercitarsi"): un metodo in `TurniServiceImpl` o nuova classe che invoca la function/procedure via `SimpleJdbcCall`/`JdbcTemplate`, esposto da un endpoint dedicato in `TurniController` (es. `POST /ditta/api/turni/plsql/inserisci`).
3. Test JUnit dedicato (vedi Fase 4) che invoca la procedura/funzione tramite Testcontainers.

### Fase 3 — (integrata nelle altre fasi) Commit incrementali su git
Ogni fase termina con commit descrittivo (es. "feat: migrate schema to Oracle Free", "feat: add PL/SQL exercises", "test: add JUnit5 + Testcontainers", "chore: dockerize backend + oracle", "ci: add GitHub Actions pipelines").

### Fase 4 — Test automatici JUnit 5 + Testcontainers
*Dipende da Fase 1 (schema Oracle) e Fase 2 (per test PL/SQL).*
1. **`Sistema1/pom.xml`**: aggiungere `org.testcontainers:oracle-xe` + `org.testcontainers:junit-jupiter`, scope test.
2. Config test: `src/test/resources/application-test.properties` con profilo `test`, o `@DynamicPropertySource` per iniettare URL/credenziali del container Testcontainers (`gvenzl/oracle-xe:21-slim`) a runtime.
3. Test da scrivere:
   - Unit test (Mockito, no DB) per i Service: `TurniServiceImpl`, `UtentiServiceImpl`, `AutobusServiceImpl`, `LineeServiceImpl` — coprire logica esistente (es. `getListaTurniAutistaById`, `insertisciBatchTurni`, `cancellaTuttiTurniUtente`).
   - Integration test con Testcontainers per i Repository: `TurniRepository`, `AutistiRepository` (query nativa fixata), `UtentiRepository`, `LineeRepository`, `AutobusRepository` — avvio container Oracle XE 21c reale, esecuzione script schema (Fase 1) + eventualmente PL/SQL (Fase 2), verifica CRUD.
   - Test dedicato per la chiamata alla function/procedure PL/SQL (Fase 2) via `SimpleJdbcCall`.
   - Test `@WebMvcTest` (MockMvc) per i controller principali (`TurniController`, `AdminController`) con service mockati.
4. Verifica: `./mvnw test` locale (richiede Docker attivo per Testcontainers) — tutti i test verdi.

### Fase 5 — Containerizzazione a microservizi
*Dipende da Fase 1 (schema/driver Oracle) — può iniziare in parallelo alla Fase 4.*
1. **`Sistema1/Dockerfile`** multi-stage: stage build (`maven:3.9-eclipse-temurin-22` + `./mvnw package -DskipTests` oppure con test se si vuole eseguire in build), stage runtime (`eclipse-temurin:22-jre-alpine`), `ENTRYPOINT java -jar app.jar`.
2. **`Sistema1/docker-compose.yml`** aggiornato con due servizi minimi (decomposizione a microservizi):
   - `oracle-db`: immagine `gvenzl/oracle-xe:21-slim`, volume dati, healthcheck, init script montato da `oracle-init/`.
   - `backend`: build dal Dockerfile, `depends_on: oracle-db: condition: service_healthy`, env var per datasource (da `.env`), porta esposta (8080 e 8087 per il socket systemintegration).
   - Frontend **escluso** (nessun servizio placeholder, come da conferma utente).
   - Rete dedicata `ditta-network` e `.env` per credenziali (non committato, aggiunto a `.gitignore`; fornire `.env.example`).
3. Verifica: `docker compose up --build`, healthcheck oracle-db → backend parte solo dopo DB pronto, smoke test via file `.http`.

### Fase 6 — CI/CD (GitHub Actions + DockerHub)
*Dipende da Fase 4 (test) e Fase 5 (Dockerfile).*
1. **`.github/workflows/ci.yml`**: trigger su push/PR verso `main` — checkout, setup JDK 22 (Temurin), cache Maven, `./mvnw -B test` (Testcontainers funziona su runner ubuntu-latest, Docker preinstallato), pubblica report test.
2. **`.github/workflows/release.yml`**: trigger su push di tag `v*.*.*` —
   - Esegue test (riusa/richiama ci.yml o rilancia gli step, per garantire "verificare che i test passino").
   - Build JAR (`./mvnw -B package -DskipTests` dato che i test sono già passati nello step precedente).
   - Build immagine Docker backend, login DockerHub (secrets `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`), push con tag `latest` + tag versione.
   - Crea GitHub Release (es. azione `softprops/action-gh-release`) allegando: JAR standalone + pacchetto zip con `docker-compose.yml` (aggiornato per puntare all'immagine pubblicata su DockerHub invece che a build locale) e istruzioni minime.
3. Documentare (README o sezione dedicata) i secrets/variabili da configurare su GitHub: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`.
4. Verifica: push di un tag di prova (es. `v0.1.0`) e controllo esecuzione workflow su GitHub Actions + presenza release con asset.

## File rilevanti (percorsi principali da modificare/creare)
- [Sistema1/docker-compose.yml](Sistema1/docker-compose.yml) — sostituzione Postgres→Oracle, aggiunta servizio backend.
- [Sistema1/init.sql](Sistema1/init.sql) — sostituito da nuovi script Oracle in `Sistema1/oracle-init/`.
- [Sistema1/pom.xml](Sistema1/pom.xml) — driver Oracle, Testcontainers.
- [Sistema1/src/main/resources/application.properties](Sistema1/src/main/resources/application.properties) — datasource/dialect Oracle.
- `Sistema1/src/main/java/com/beltra/sistema1/domain/AutobusEntity.java` — fix `@GeneratedValue`.
- `Sistema1/src/main/java/com/beltra/sistema1/repository/AutistiRepository.java` — fix query nativa `LIMIT 1`.
- `Sistema1/src/test/java/com/beltra/sistema1/**` — nuovi test unit/integration.
- `Sistema1/Dockerfile` — nuovo.
- `.github/workflows/ci.yml`, `.github/workflows/release.yml` — nuovi.
- `.gitignore` (root) — nuovo.

## Verifica complessiva
- `./mvnw test` locale con Docker attivo → verde.
- `docker compose up --build` → backend risponde su `/ditta/api/*` con Oracle come DB.
- Query manuali PL/SQL da SQL*Plus/SQLcl dentro il container per validare function/procedure/trigger.
- Push tag → GitHub Actions verde → Release pubblicata con JAR + pacchetto compose → immagini visibili su DockerHub.

## Stato implementazione (aggiornato)
- **Fase 0 (Git)**: già completata prima di iniziare (repo esistente alla radice, remote `origin/main`, `.gitignore` già presente e ignora `DATABASE/`).
- **Scoperta importante**: `Sistema1/init.sql` (usato dal vecchio docker-compose Postgres) era STALE — tabella `Turni` con colonna `Matricola`, NON coerente con `TurniEntity.java` (che ha `id_utente`, non `matricola`). Trovato backup più recente e coerente: `DATABASE/Sistema1/backup_18-06-2024.sql` (turni.id_utente, 11 autisti, 12 utenti, 357 turni, 24 autobus, 16 linee). Utente ha confermato di usare QUESTO schema come base (non init.sql).
- **Fase 1 (Oracle 21c XE) — IN CORSO**:
  - Creato `Sistema1/oracle-init/01-schema.sql` (DDL Oracle: linee, autobus, utenti, autisti, turni — con id_utente su turni, FK corrette, IDENTITY GENERATED BY DEFAULT/ALWAYS).
  - Creato `Sistema1/oracle-init/02-data.sql` (dati generati via script Python temporaneo da backup_18-06-2024.sql, poi cancellato — 12 utenti, 11 autisti, 24 autobus, 16 linee, 357 turni, con TO_DATE per orari e OVERRIDING SYSTEM VALUE per turni.id).
  - Aggiornato `Sistema1/docker-compose.yml`: servizio `db` ora usa `gvenzl/oracle-xe:21-slim`, porta 1521, env ORACLE_PASSWORD/APP_USER=ditta_trasporti/APP_USER_PASSWORD, volumi `oracle_data` + mount `./oracle-init` su `/container-entrypoint-initdb.d`, healthcheck.
  - Aggiornato `Sistema1/pom.xml`: rimosso driver postgresql, aggiunto `com.oracle.database.jdbc:ojdbc11`.
  - Aggiornato `Sistema1/src/main/resources/application.properties`: url `jdbc:oracle:thin:@//localhost:1521/XEPDB1`, user `ditta_trasporti`, driver `oracle.jdbc.OracleDriver`, dialect `OracleDialect`.
  - Rimosso `schema="public", catalog="ditta_trasporti"` da tutte le `@Table` delle entity (AutobusEntity, LineeEntity, TurniEntity, UtentiEntity, AutistiEntity) — Oracle usa lo schema dell'utente connesso (ditta_trasporti), non ha "catalog" Postgres-style.
  - Fix `AutobusEntity`: rimosso `@GeneratedValue(IDENTITY)` errato su `targa` (natural key, non generabile).
  - Fix `AutistiRepository.inserisciAutista`: `limit 1` → `fetch first 1 row only`.
  - `./mvnw compile` verificato OK (nessun errore di compilazione).
  - **Verifica end-to-end con `docker compose up`** ancora da completare: Docker CLI non è nel PATH di PowerShell su questa macchina, ma funziona dentro WSL (`wsl docker ...`, `wsl docker compose ...`). Il comando `wsl bash -lc "cd '/mnt/c/.../Sistema1' && docker compose up -d"` è stato lanciato ma il pull dell'immagine `gvenzl/oracle-xe:21-slim` è lento (>150s, immagine pesante). Da ricontrollare l'esito (schema/dati caricati correttamente, boot Spring Boot OK) prima di considerare la Fase 1 conclusa.
- **Ancora da fare**: verificare boot applicazione contro Oracle reale, poi Fase 2 (PL/SQL), Fase 4 (test), Fase 5 (Dockerfile+docker-compose backend), Fase 6 (CI/CD). Ricordarsi di aggiornare/rimuovere `Sistema1/init.sql` (Postgres, ora obsoleto) quando si conclude la Fase 1, e valutare se aggiornare anche `DATABASE/Sistema1/*` docs.

1. Cosa escludere esattamente dal git tracking in `DATABASE/Sistema1/*.sql` (backup voluminosi) — proposta: ignorarli o spostarli, da confermare.
2. Se implementare davvero il trigger per `ON UPDATE CASCADE` mancante in Oracle, o se è accettabile ometterlo (le chiavi naturali coinvolte, es. `targa`, raramente vengono aggiornate).
3. Se rendere `java.sql.Date/Time` → `java.time.LocalDate/LocalTime` (modernizzazione opzionale, non richiesta esplicitamente, valutabile in Fase 1 se non aumenta troppo lo scope).