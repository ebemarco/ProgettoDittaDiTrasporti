-- Esercizi PL/SQL basati sulla logica di dominio di Sistema1 (turni/autisti/autobus/linee).
-- Eseguito automaticamente dal container gvenzl/oracle-xe (dopo 01-schema.sql e 02-data.sql).
ALTER SESSION SET CONTAINER = XEPDB1;
ALTER SESSION SET CURRENT_SCHEMA = ditta_trasporti;

-- Tabella di audit per tracciare le modifiche ai turni.
CREATE TABLE turni_audit (
    audit_id    NUMBER GENERATED ALWAYS AS IDENTITY,
    turno_id    NUMBER NOT NULL,
    operazione  VARCHAR2(10) NOT NULL,
    eseguito_il TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT turni_audit_pkey PRIMARY KEY (audit_id)
);

CREATE OR REPLACE TRIGGER trg_turni_audit
AFTER INSERT OR UPDATE OR DELETE ON turni
FOR EACH ROW
DECLARE
    v_operazione VARCHAR2(10);
    v_turno_id   NUMBER;
BEGIN
    IF INSERTING THEN
        v_operazione := 'INSERT';
        v_turno_id := :NEW.id;
    ELSIF UPDATING THEN
        v_operazione := 'UPDATE';
        v_turno_id := :NEW.id;
    ELSE
        v_operazione := 'DELETE';
        v_turno_id := :OLD.id;
    END IF;

    INSERT INTO turni_audit (turno_id, operazione) VALUES (v_turno_id, v_operazione);
END;
/

CREATE OR REPLACE PACKAGE pkg_turni AS

    -- Calcola la durata di un turno in ore (con decimali), dati orario di inizio e fine.
    FUNCTION calcola_durata_turno(p_ora_inizio IN DATE, p_ora_fine IN DATE) RETURN NUMBER;

    -- Inserisce un nuovo turno validando l'esistenza di autista/autobus/linea e le sovrapposizioni
    -- di orario per lo stesso autista nello stesso giorno; restituisce l'id generato.
    PROCEDURE inserisci_turno(
        p_data       IN DATE,
        p_ora_inizio IN DATE,
        p_ora_fine   IN DATE,
        p_targa      IN VARCHAR2,
        p_num_linea  IN NUMBER,
        p_id_utente  IN NUMBER,
        p_nuovo_id   OUT NUMBER
    );

END pkg_turni;
/

CREATE OR REPLACE PACKAGE BODY pkg_turni AS

    FUNCTION calcola_durata_turno(p_ora_inizio IN DATE, p_ora_fine IN DATE) RETURN NUMBER IS
    BEGIN
        IF p_ora_fine <= p_ora_inizio THEN
            RAISE_APPLICATION_ERROR(-20001, 'ora_fine deve essere successiva a ora_inizio');
        END IF;
        RETURN (p_ora_fine - p_ora_inizio) * 24;
    END calcola_durata_turno;

    PROCEDURE inserisci_turno(
        p_data       IN DATE,
        p_ora_inizio IN DATE,
        p_ora_fine   IN DATE,
        p_targa      IN VARCHAR2,
        p_num_linea  IN NUMBER,
        p_id_utente  IN NUMBER,
        p_nuovo_id   OUT NUMBER
    ) IS
        v_count NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM autisti WHERE id_utente = p_id_utente;
        IF v_count = 0 THEN
            RAISE_APPLICATION_ERROR(-20002, 'Autista con id_utente ' || p_id_utente || ' non esistente');
        END IF;

        SELECT COUNT(*) INTO v_count FROM autobus WHERE targa = p_targa;
        IF v_count = 0 THEN
            RAISE_APPLICATION_ERROR(-20003, 'Autobus con targa ' || p_targa || ' non esistente');
        END IF;

        SELECT COUNT(*) INTO v_count FROM linee WHERE num_linea = p_num_linea;
        IF v_count = 0 THEN
            RAISE_APPLICATION_ERROR(-20004, 'Linea ' || p_num_linea || ' non esistente');
        END IF;

        -- Oracle non ha il predicato standard OVERLAPS: due intervalli si sovrappongono se
        -- l'inizio dell'uno precede la fine dell'altro in entrambe le direzioni. Si confronta
        -- solo la frazione di giorno (ora_inizio/ora_fine possono avere una parte "data" diversa
        -- a seconda che siano stati scritti da script SQL o dal driver JDBC via java.sql.Time).
        SELECT COUNT(*) INTO v_count
        FROM turni
        WHERE id_utente = p_id_utente
          AND data = p_data
          AND (p_ora_inizio - TRUNC(p_ora_inizio)) < (ora_fine - TRUNC(ora_fine))
          AND (p_ora_fine - TRUNC(p_ora_fine)) > (ora_inizio - TRUNC(ora_inizio));
        IF v_count > 0 THEN
            RAISE_APPLICATION_ERROR(-20005, 'Turno sovrapposto ad un altro turno gia'' assegnato all''autista');
        END IF;

        INSERT INTO turni (data, ora_inizio, ora_fine, targa, num_linea, id_utente)
        VALUES (p_data, p_ora_inizio, p_ora_fine, p_targa, p_num_linea, p_id_utente)
        RETURNING id INTO p_nuovo_id;
    END inserisci_turno;

END pkg_turni;
/
