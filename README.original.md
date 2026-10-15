# Trébol Estudio · Solar residencial (PWA)

Continuación del proyecto `trebol-solar-pwa`: mismo diseño y esquema de instalación, ahora con comparación de escenarios,
cantidades automáticas, catálogo editable, IVA/contingencia opcionales, PDF y CSV, e instalación en Replit.
Sin build ni dependencias de ejecución; funciona sin conexión.

## Replit (instalable)
1. Crea un Repl **Node.js** y sube el contenido de esta carpeta (o importa el .zip). Conserva `.replit`.
2. **Run** muestra la app en el Webview (`server.mjs` sirve `public/`). Pruebas: Shell → `npm test`.
3. **Deploy → Static** (el `.replit` ya trae `publicDir = "public"`; sin build ni run command). Da una URL HTTPS `*.replit.app`.
4. Instala desde esa URL (no desde el Webview de desarrollo):
   - iPad/iPhone: Safari → Compartir → *Añadir a pantalla de inicio*.
   - Escritorio/Android: botón **Instalar app** (aparece cuando el navegador lo permite) o el icono de instalar de Chrome/Edge.
5. Tras cambiar archivos en `public/`, sube el número de `CACHE` en `public/sw.js` y vuelve a desplegar.

Otros hosts: sube solo `public/` (Netlify, Vercel, Cloudflare Pages, GitHub Pages).

## Estructura
- `public/solar-math.js` cálculo, escenarios, partidas automáticas, totales, CSV (probado en `tests/`)
- `public/app.js` tu interfaz original (proyectos, esquema, formularios); `public/extras.js` escenarios, catálogo, totales y PDF
- Las tablas apilan los controles de estado, URL y fecha dentro de su celda para evitar que se crucen con los encabezados o conceptos vecinos.
- `public/vendor/` jsPDF; `public/fonts/` DM Sans y Playfair Display (locales, para uso sin conexión)

## Cálculo
Consumo anual = kWh ÷ días × 365. Meta = anual × (1 + %). kWp = meta ÷ (rendimiento × 365). Paneles mínimos = techo(kWp × 1000 ÷ W).
Generación = paneles × W ÷ 1000 × rendimiento × 365. Área = paneles × m² × (1 + holgura). DC/AC real = kWp ÷ kW del inversor.
Cable por cadena = 2 × (altura + ruta) × (1 + reserva). Cable CC = por cadena × cadenas; CA = ruta CA × reserva × 3; canalización = altura + rutas, con reserva.
Las cantidades automáticas se vuelven manuales al editarlas y pueden volver a automáticas.

## Datos, precios y logo
- Proyectos, catálogo y logo se guardan solo en el navegador del dispositivo (no se sincronizan). Usa CSV como respaldo.
- Los precios son **referencias provisionales editables**, no consultas en vivo. Marca "Verificado" solo con URL y fecha.
- No hay logo por defecto: sube el oficial con "Añadir logo" (PNG o JPG).
- Estimación preliminar: confirma strings, voltajes, protecciones, estructura e interconexión con fichas técnicas y un profesional.
