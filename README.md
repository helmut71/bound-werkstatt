# Bound Werkstatt

Ein freier Baukasten für digitale Rallyes, Schnitzeljagden und Lernpfade, die im Browser laufen.
Ein Bound ist eine einzelne JSON-Datei. Editor, Vorschau und Player stecken in einer HTML-Datei ohne Build-Tools und ohne Server.

> Inspiriert von Konzepten wie bei Actionbound, aber ein eigenständiges Projekt ohne Verbindung zu dessen Anbieter.

## Funktionen

- **Elementtypen:** Info (Text, Bild, Audio, Video), Quiz (Auswahl, Mehrfachauswahl, Text, Zahl, Sortieren, Zuordnen), Aufgabe (Foto, Video, Audio, Text, Datei), Code finden (QR-Scan oder Eingabe), Ort finden (GPS mit Kompass und Karte), Umfrage, Timer, Verzweigung, Sprung, Variable, Ende
- **Punkte:** Versuche, Abzug pro Fehler, Hinweise gegen Punktabzug, Zeitlimit pro Frage und für den ganzen Bound
- **Logik:** eigene Variablen, Bedingungen, Aktionen, Weichen
- **Auswertung:** Ergebnisliste, Urkunde, Bestenliste auf dem Gerät, Ergebnis als JSON
- **Karte:** eigene schlanke Karte mit OpenStreetMap-Kacheln, Ziel per Klick setzen
- **QR-Codes:** integrierter Generator (bis Version 40) für Code-Stationen und Spiel-Links, druckbar oder als SVG
- **Speichern:** Bound als JSON, Autosave im Browser, Rückgängig/Wiederholen
- **Export:** „Player-Datei“ erzeugt eine einzelne HTML-Datei, die nur den Bound spielt (mit `#edit` hinten an der Adresse öffnet sie wieder im Editor)

## Spiel-Link (ohne Upload)

Im Editor erzeugt **Spiel-Link** eine Adresse, in der der ganze Bound steckt (`…/#spiel=…`). Wer sie öffnet, sieht nur das Spiel. Das Hosting der Seite genügt einmal, pro Rallye ist kein Upload nötig. Sehr große Bounds und eingebettete Bilder machen den Link lang, dann besser Bild-Links verwenden. Aus kurzen Links erzeugt der Dialog direkt einen QR-Code (der Generator kann bis ca. 2300 Zeichen, gut lesbar sind etwa 600).

## Spielen per Datei im Repo

Lege deinen gespeicherten Bound (`.json`) ins Repo, zum Beispiel nach `bounds/mein-bound.json`. Spieler öffnen dann nur das Spiel, ohne Editor:

```
https://<dein-name>.github.io/<repo>/?play=bounds/mein-bound.json
```

Das Beispiel: `?play=examples/raetselrallye-stadtpark.json`. Es werden nur Dateien von derselben Webseite geladen. Auf diesem Weg laufen Kamera, GPS und Kompass, weil GitHub Pages HTTPS nutzt.

## Benutzen

`index.html` im Browser öffnen oder über GitHub Pages hosten. Für GPS, Kamera und Kompass muss die Seite über **HTTPS** oder lokal geladen werden.

## Entwickeln

```
src/
  core.js     Datenmodell, Spiel-Engine, Markdown-Light
  qr.js       QR-Generator (Byte-Modus, Korrektur M, Version 1–10)
  ui.js       DOM-Helfer, Dateien, Karte
  player.js   Player
  editor.js   Editor
  main.js     Beispiel und Start
  head.html   Gerüst und Styles
build.py      fügt alles zu index.html zusammen
test/         Tests (Engine in Node, Oberfläche mit Playwright)
examples/     Beispiel-Bounds
```

```
python3 build.py             # erzeugt index.html
node test/engine_test.js     # Engine-Logik
node test/qrtest.js          # erzeugt test/qr.json; mit OpenCV gegenlesen (siehe unten)
python3 test/ui_test2.py     # Oberflächentest (Playwright + Chrome)
```

Der QR-Test schreibt Matrizen nach `test/qr.json`. Zum Gegenprüfen mit `cv2.QRCodeDetector` die Matrizen in Bilder umwandeln und dekodieren.

## Format

```json
{
  "format": "bound-werkstatt",
  "version": 1,
  "meta": { "title": "…", "variables": [{ "name": "weg", "initial": 0 }] },
  "elements": [{ "id": "q1", "type": "quiz", "sub": "single", "title": "…", "options": [] }]
}
```

Ein vollständiges Beispiel liegt in `examples/raetselrallye-stadtpark.json`.

## Datenschutz und Hinweise zum Hosten

- `index.html` lädt Schriften von Google Fonts. Für Datenschutz ohne externe Anfragen die Schriften selbst hosten oder den `<link>` entfernen; die Seite fällt auf Systemschriften zurück.
- Kartenkacheln kommen von `tile.openstreetmap.org`. Bitte die [Nutzungsrichtlinie](https://operations.osmfoundation.org/policies/tiles/) beachten und bei hoher Last einen eigenen Kachelserver verwenden. Die Ortssuche nutzt Nominatim.
- Spielstände, Bestenliste und Entwurf liegen nur im `localStorage` des jeweiligen Geräts. Es gibt kein Backend.

## Lizenz

MIT, siehe `LICENSE`.
